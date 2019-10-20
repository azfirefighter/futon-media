import * as _ from 'lodash'
import * as debrids from '@/debrids/debrids'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'
import * as pAll from 'p-all'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Emitter from '@/utils/emitter'
import Fastify from '@/adapters/fastify'
import { Db } from '@/adapters/db'

const fastify = Fastify(process.env.EMBY_PROXY_PORT)
const emitter = new Emitter<string, string>()

const db = new Db(__filename)
process.nextTick(async () => {
	process.DEVELOPMENT && (await db.flush())
})

async function getDebridStreamUrl(Query: emby.StrmQuery, Item: emby.Item) {
	let t = Date.now()

	let Session = (await emby.sessions.get()).find(v => v.ItemPath == Item.Path)
	let PlaybackInfo = await emby.PlaybackInfo.get(Item.Id, Session && Session.UserId)
	console.log(`PlaybackInfo ->`, PlaybackInfo)

	if (process.DEVELOPMENT) {
		return 'https://whitetreefairy-sto.energycdn.com/dl/2bQ74BXOQcwsenIZWFJSWg/1572156133/675000842/5d3894d4c0d876.18082955/How%20the%20Universe%20Works%20S02E04%201080p%20WEB-DL%20DD%2B%202.0%20x264-TrollHD.mkv'
		// return 'https://lazycarefulsailor-sto.energycdn.com/dl/aiGuRJQkn0AVJ2bfVAItyQ/1572142690/675000842/5da9d83ec2a9c6.33536050/Starsky.And.Hutch.2004.1080p.BluRay.x264.DTS-FGT.mkv'
		// return 'https://phantasmagoricfairytale-sto.energycdn.com/dl/uat0AxAx0BEAddz2zeRVyg/1572129772/675000842/5da6353eb18ad8.55901578/The.Lion.King.2019.2160p.BluRay.REMUX.HEVC.DTS-HD.MA.TrueHD.7.1-FGT.mkv'
	}

	let UserId = await db.get(`UserId:${query.slug}`)
	if (UserId) Session = Sessions.find(v => v.UserId == UserId) || Session

	Session = (Sessions.find(v => {
		if (!v.StrmPath) return
		if (query.type == 'show') {
			let zero = `S${utils.zeroSlug(query.season)}E${utils.zeroSlug(query.episode)}`
			if (!v.StrmPath.includes(zero)) return
		}
		let ids = emby.library.pathIds(v.StrmPath)
		if (ids.imdb && query.imdb) return ids.imdb == query.imdb
		if (ids.tmdb && query.tmdb) return ids.tmdb == query.tmdb
		if (ids.tvdb && query.tvdb) return ids.tvdb == query.tvdb
	}) || Session) as emby.Session

	let { Quality, Channels, Codecs } = Session
	let skey = `${rkey}:${utils.hash([Quality, Channels, Codecs.audio, Codecs.video])}`
	let streamUrl = await db.get(skey)
	if (streamUrl) return streamUrl

	console.log(`getDebridStreamUrl '${strm}' ->`, Session.json)

	let full = (await trakt.client.get(`/${query.type}s/${query.slug}`)) as trakt.Full
	let item = new media.Item({ type: query.type, [query.type]: full })
	if (query.type == 'show') {
		let seasons = (await trakt.client.get(`/shows/${query.slug}/seasons`)) as trakt.Season[]
		item.use({ type: 'season', season: seasons.find(v => v.number == query.season) })
		let episode = (await trakt.client.get(
			`/shows/${query.slug}/seasons/${query.season}/episodes/${query.episode}`,
		)) as trakt.Episode
		item.use({ type: 'episode', episode })
	}

	let torrents = await scraper.scrapeAll(item, Session.isSD)

	// if (!process.DEVELOPMENT) console.log(`all torrents '${strm}' ->`, torrents.length)
	console.log(`all torrents '${strm}' ->`, torrents.length, torrents.map(v => v.short))

	let cacheds = torrents.filter(v => v.cached.length > 0)
	if (cacheds.length == 0) {
		debrids.download(torrents, item)
		throw new Error(`cacheds.length == 0`)
	}

	// if (!process.DEVELOPMENT) console.log(`strm cacheds '${strm}' ->`, cacheds.length)
	console.log(`strm cacheds '${strm}' ->`, cacheds.length, cacheds.map(v => v.short))

	streamUrl = await debrids.getStreamUrl(cacheds, item, Channels, Codecs)
	if (!streamUrl) {
		debrids.download(torrents, item)
		throw new Error(`getDebridStreamUrl !streamUrl -> '${strm}'`)
	}
	await db.put(skey, streamUrl, utils.duration(1, 'day'))

	console.log(Date.now() - t, `👍 streamUrl '${strm}' ->`, streamUrl)
	return streamUrl
}

fastify.get('/strm', async (request, reply) => {
	if (_.isEmpty(request.query)) return reply.redirect('/dev/null')

	let Query = _.mapValues(request.query, v =>
		utils.isNumeric(v) ? _.parseInt(v) : v,
	) as emby.StrmQuery
	let Item = await emby.library.byPath(emby.library.toStrmPath(Query, true))
	console.warn(`/strm ->`, emby.library.toName(Item))

	let stream = (await db.get(Item.Id)) as string
	if (!stream) {
		if (!emitter.eventNames().includes(Item.Id)) {
			try {
				stream = await getDebridStreamUrl(Query, Item)
				await db.put(Item.Id, stream, utils.duration(1, 'minute'))
				emitter.emit(Item.Id, stream)
			} catch (error) {
				console.error(`/strm ${emby.library.toName(Item)} -> %O`, error)
				await db.put(Item.Id, '/dev/null', utils.duration(1, 'minute'))
				emitter.emit(Item.Id, '/dev/null')
			}
		} else {
			stream = await emitter.toPromise(Item.Id)
		}
	}

	console.log(`reply.redirect(${stream}) ->`)
	reply.redirect(stream)
})
