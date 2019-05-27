import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as debrid from '@/debrids/debrid'
import * as ffprobe from '@/adapters/ffprobe'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as pQueue from 'p-queue'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'
import { Premiumize } from '@/debrids/premiumize'
import { Putio } from '@/debrids/putio'
import { RealDebrid } from '@/debrids/realdebrid'

export const debrids = { realdebrid: RealDebrid, premiumize: Premiumize, putio: Putio }

export async function cached(hashes: string[]) {
	let entries = Object.entries({ realdebrid: RealDebrid, premiumize: Premiumize })
	let resolved = await Promise.all(entries.map(([k, v]) => v.cached(hashes)))
	return hashes.map((v, index) => {
		return entries.map(([key], i) => resolved[i][index] && key).filter(Boolean)
	}) as Debrids[][]
}

let queue = new pQueue({ concurrency: 1 })
export function download(torrents: torrent.Torrent[]) {
	return queue.add(async () => {
		for (let torrent of torrents) {
			console.log(`download torrent ->`, torrent.short)
			let success = await RealDebrid.download(torrent.magnet).catch(error => {
				console.error(`RealDebrid download '${torrent.magnet}' -> %O`, error)
				return false
			})
			if (success) {
				console.log(`👍 download success ->`, torrent.short)
				return
			}
		}
	})
}

export async function getStreamUrl(
	torrents: torrent.Torrent[],
	item: media.Item,
	channels: number,
	codecs: { audio: string[]; video: string[] }
) {
	for (let torrent of torrents) {
		let next = false
		for (let cached of torrent.cached) {
			if (next) continue
			console.log(`getStreamUrl '${cached}' torrent ->`, torrent.json)
			let debrid = new debrids[cached]().use(torrent.magnet)

			let files = (await debrid.getFiles().catch(error => {
				console.error(`getFiles -> %O`, error)
			})) as debrid.File[]
			if (!files) continue
			files = files.filter(v => !v.path.toLowerCase().includes('rarbg.com.mp4'))
			if (files.length == 0) {
				console.warn(`!files ->`, torrent.short)
				next = true
				continue
			}

			let file: debrid.File
			if (item.show) {
				let tests = [
					`S${item.S.z}E${item.E.z}`,
					`S${item.S.z}xE${item.E.z}`,
					`${item.S.n}x${item.E.z}`,
					`${item.S.n}x${item.E.n}`,
					`${item.S.n}${item.E.z}`,
					`Episode${item.E.z}`,
					`Ep${item.E.z}`,
					`E${item.E.z}`,
					`${item.E.z}`,
				]
				let skips = `${item.title} ${item.year}`
				if (item.episode) skips += ` ${item.episode.title}`
				for (let test of tests) {
					file = files.find(v => {
						let name = _.trim(utils.accuracy(skips, v.name).join(' '))
						return utils.includes(name, test)
					})
					if (file) break
				}
				if (!file) console.warn(`!show file ->`, files.map(v => v.name).sort())
			}
			if (!file) {
				let title = item.title
				if (item.movie) title += ` ${item.year}`
				if (item.episode) title += ` S${item.S.z}E${item.E.z} ${item.E.t} ${item.E.a}`
				let levens = files.map(file => ({ ...file, leven: utils.leven(file.name, title) }))
				file = levens.sort((a, b) => a.leven - b.leven)[0]
			}

			let stream = (await debrid.streamUrl(file).catch(error => {
				console.error(`debrid.streamUrl -> %O`, error)
			})) as string
			if (!stream) continue
			if (stream.startsWith('http:')) stream = stream.replace('http:', 'https:')

			console.log(`probe stream ->`, stream)
			let probe = (await ffprobe
				.probe(stream, { format: true, streams: true })
				.catch(error => console.error(`ffprobe '${stream}' -> %O`, error))) as ffprobe.Probe
			if (!probe) {
				next = true
				continue
			}

			console.log(`probe format ->`, ffprobe.json(probe.format))
			probe.streams = probe.streams.filter(({ codec_type }) =>
				['video', 'audio'].includes(codec_type)
			)

			// let tags = {} as Record<string, string>
			// _.defaults(tags, probe.format.tags, ...probe.streams.map(v => v.tags))
			// tags = _.pick(tags, _.keys(tags).filter(v => v.includes('date') || v.includes('time')))
			// let creation = _.size(tags) > 0 && dayjs(_.values(tags)[0])
			// if (creation && creation.subtract(1, 'day').valueOf() < item.released) {
			// 	console.warn(
			// 		`probe !creation ->`,
			// 		creation.toLocaleString(),
			// 		dayjs(item.released).toLocaleString()
			// 	)
			// 	continue
			// }

			let videos = probe.streams.filter(({ codec_name, codec_type, tags }) => {
				if (codec_type != 'video') return false
				if (codec_name == 'mjpeg') return false
				if (!tags || !tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (videos.length == 0) {
				console.warn(`probe videos.length == 0 ->`, torrent.short)
				next = true
				continue
			}
			let vkeys = ['codec_long_name', 'codec_name', 'profile']
			console.log(`probe videos ->`, videos.map(v => _.pick(v, vkeys)))
			if (_.size(codecs.video) > 0 && !codecs.video.includes(videos[0].codec_name)) {
				console.warn(`probe !codecs.video ->`, torrent.short, videos[0].codec_name)
				next = true
				continue
			}

			let audios = probe.streams.filter(({ codec_type, tags }) => {
				if (codec_type != 'audio') return false
				if (!tags) return true
				if (tags.title && utils.includes(tags.title, 'commentary')) return false
				if (!tags.language) return true
				return tags.language.startsWith('en') || tags.language.startsWith('un')
			})
			if (audios.length == 0) {
				console.warn(`probe audios.length == 0 ->`, torrent.short)
				next = true
				continue
			}
			let akeys = ['channel_layout', 'channels', 'codec_long_name', 'codec_name', 'profile']
			console.log(`probe audios ->`, audios.map(v => _.pick(v, akeys)))
			if (!audios.find(v => v.channels <= channels)) {
				console.warn(`probe !channels ->`, torrent.short, audios.map(v => v.channels))
				next = true
				continue
			}
			if (
				_.size(codecs.audio) > 0 &&
				!audios.find(v => codecs.audio.includes(v.codec_name))
			) {
				console.warn(`probe !codecs.audio ->`, torrent.short, audios.map(v => v.codec_name))
				next = true
				continue
			}

			return stream
		}
	}
}

export type Debrids = keyof typeof debrids
