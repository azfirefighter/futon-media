import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as emby from '@/emby/emby'
import * as flatten from 'flat'
import * as Json from '@/shims/json'
import * as media from '@/media/media'
import * as mocks from '@/mocks/mocks'
import * as Rx from '@/shims/rxjs'
import * as schedule from 'node-schedule'
import * as trakt from '@/adapters/trakt'
import * as utils from '@/utils/utils'
import { Db } from '@/adapters/db'

const db = new Db(__filename)
process.nextTick(async () => {
	if (process.DEVELOPMENT) await db.flush()

	if (!process.DEVELOPMENT) {
		schedule.scheduleJob('* * * * *', () => PlaybackInfo.setUserNames())
	}
	emby.rxSocket.subscribe(({ MessageType }) => {
		if (MessageType == 'OnOpen') PlaybackInfo.setUserNames()
	})

	let rxUserAgent = emby.rxItemId.pipe(
		Rx.op.distinctUntilChanged((a, b) => {
			return `${a.ItemId}${a.UserId}${a.useragent}` == `${b.ItemId}${b.UserId}${b.useragent}`
		}),
	)
	rxUserAgent.subscribe(async ({ ItemId, UserId, useragent }) => {
		await Promise.all([
			db.put(`useragent:${UserId}`, useragent),
			db.put(`useragent:${UserId}:${ItemId}`, useragent, utils.duration(1, 'day')),
		])
	})

	let rxPlaybackInfo = Rx.merge(
		emby.rxHttp.pipe(
			Rx.op.filter(({ method, parts }) => method == 'POST' && parts.includes('playbackinfo')),
			Rx.op.map(({ query, useragent }) => ({ ItemId: query.ItemId, useragent })),
			Rx.op.debounceTime(100),
		),
		emby.rxLine.pipe(
			Rx.op.filter(({ level, message }) => {
				return level == 'Debug' && message.startsWith('GetPostedPlaybackInfo ')
			}),
			Rx.op.map(({ message }) => ({ message })),
			Rx.op.debounceTime(100),
		),
	).pipe(Rx.op.bufferCount(2))
	rxPlaybackInfo.subscribe(async buffers => {
		let buffer = _.merge({}, ...buffers) as UnionToIntersection<UnArray<typeof buffers>>
		// console.log('rxPlaybackInfo buffers ->', buffer)

		let value = JSON.parse(buffer.message.slice(buffer.message.indexOf('{'))) as PlaybackInfo
		if (value.Id != buffer.ItemId) {
			console.warn(`rxPlaybackInfo buffer ->`, buffer)
			throw new Error(`rxPlaybackInfo value.Id != buffer.ItemId`)
		}

		await Promise.all([
			db.put(`PlaybackInfo:${buffer.useragent}:${value.UserId}`, value),
			db.put(
				`PlaybackInfo:${buffer.useragent}:${value.UserId}:${value.Id}`,
				value,
				utils.duration(1, 'day'),
			),
		])
	})

	// console.log(`PLAYBACK_INFO ->`, mocks.PLAYBACK_INFO)
	// console.log(`PLAYBACK_INFO flatten ->`, _.mapValues(mocks.PLAYBACK_INFO, v => flatten(v)))
	// console.log(`PLAYBACK_INFO ->`, _.mapValues(mocks.PLAYBACK_INFO, v => new PlaybackInfo(v)))
})

export class PlaybackInfo {
	static async useragent(UserId: string, ItemId: string) {
		for (let i = 0; i < 5; i++) {
			let useragent = (await db.get(`useragent:${UserId}:${ItemId}`)) as string
			if (useragent) return useragent
			await utils.pTimeout(500)
		}
		let useragent = (await db.get(`useragent:${UserId}`)) as string
		if (useragent) return useragent
		console.error(`PlaybackInfo !useragent -> %O`, UserId, ItemId)
	}

	static async get(useragent: string, UserId: string, ItemId?: string) {
		for (let i = 0; i < 5; i++) {
			let value: PlaybackInfo
			if (useragent && UserId && ItemId) {
				value = await db.get(`PlaybackInfo:${useragent}:${UserId}:${ItemId}`)
			} else if (useragent && UserId) {
				value = await db.get(`PlaybackInfo:${useragent}:${UserId}`)
			}
			if (value) return new PlaybackInfo(value)
			await utils.pTimeout(500)
		}
		let value = await db.get(`PlaybackInfo:${useragent}:${UserId}`)
		if (value) return new PlaybackInfo(value)
		console.error(`PlaybackInfo !value -> %O`, useragent, UserId, ItemId)
	}

	static UserNames = {} as Record<string, string>
	static async setUserNames() {
		let Users = await emby.User.get()
		Users.forEach(v => (PlaybackInfo.UserNames[v.Id] = v.Name))
	}
	get UserName() {
		return PlaybackInfo.UserNames[this.UserId]
	}

	get UHD() {
		let UHDs = ['developer', 'robert']
		return UHDs.includes(this.UserName.toLowerCase())
	}
	get HD() {
		let HDs = ['mom']
		return this.UHD || HDs.includes(this.UserName.toLowerCase())
	}
	get Quality(): emby.Quality {
		if (this.AudioChannels > 2 && this.UHD) return 'UHD'
		if (this.AudioChannels > 2 && this.HD) return 'HD'
		return 'SD'
	}

	get Bitrate() {
		return this.MaxStreamingBitrate || this.DeviceProfile.MaxStreamingBitrate
	}

	get AudioChannels() {
		let Channels = [2]
		for (let [k, v] of Object.entries(this.flat)) {
			if (k.endsWith('channels')) {
				Channels.push(_.parseInt(v as string))
			}
			if (k.endsWith('.property') && _.isString(v) && v.toLowerCase() == 'audiochannels') {
				Channels.push(_.parseInt(this.flat[k.replace('.property', '.value')] as string))
			}
		}
		for (let codec of ['dts', 'dca']) {
			if (this.AudioCodecs.includes(codec)) Channels.push(6)
		}
		for (let codec of ['dtshd', 'truehd']) {
			if (this.AudioCodecs.includes(codec)) Channels.push(8)
		}
		return _.max(Channels)
	}

	get AudioCodecs() {
		let AudioCodecs = [] as string[]
		for (let [k, v] of Object.entries(this.flat)) {
			if (!_.isString(v)) continue
			v = v.toLowerCase()
			if (k.endsWith('.audiocodec')) {
				AudioCodecs.push(...v.split(','))
			}
			if (k.endsWith('.type') && (v == 'audio' || v == 'videoaudio')) {
				AudioCodecs.push(this.flat[k.replace('.type', '.codec')] as string)
			}
		}
		if (AudioCodecs.includes('ac3')) AudioCodecs.push('eac3')
		if (AudioCodecs.includes('eac3')) AudioCodecs.push('ac3')
		return _.sortBy(_.uniq(AudioCodecs.filter(Boolean).map(v => v.replace(/^[^\w]/, ''))))
	}
	get VideoCodecs() {
		let VideoCodecs = [] as string[]
		for (let [k, v] of Object.entries(this.flat)) {
			if (!_.isString(v)) continue
			v = v.toLowerCase()
			if (k.endsWith('.videocodec')) {
				VideoCodecs.push(...v.split(','))
			}
			if (k.endsWith('.type') && v == 'video') {
				VideoCodecs.push(this.flat[k.replace('.type', '.codec')] as string)
			}
		}
		return _.sortBy(_.uniq(VideoCodecs.filter(Boolean).map(v => v.replace(/^[^\w]/, ''))))
	}

	get json() {
		return utils.compact({
			AudioChannels: this.AudioChannels,
			AudioCodecs: JSON.stringify(this.AudioCodecs),
			Quality: this.Quality,
			UserName: this.UserName,
			VideoCodecs: JSON.stringify(this.VideoCodecs),
		})
	}

	flat: Record<string, boolean | number | string>
	constructor(PlaybackInfo: PlaybackInfo) {
		_.merge(this, PlaybackInfo)
		Object.defineProperty(this, 'flat', {
			value: _.mapKeys(flatten(PlaybackInfo), (v, k: string) => k.toLowerCase()),
		})
	}
}

export type Quality = 'SD' | 'HD' | 'UHD'

export interface PlaybackInfo {
	AllowAudioStreamCopy: boolean
	AllowVideoStreamCopy: boolean
	AudioStreamIndex: number
	AutoOpenLiveStream: boolean
	DeviceProfile: DeviceProfile
	DirectPlayProtocols: string[]
	EnableDirectPlay: boolean
	EnableDirectStream: boolean
	EnableTranscoding: boolean
	Id: string
	IsPlayback: boolean
	MaxAudioChannels: number
	MaxStreamingBitrate: number
	MediaSourceId: string
	StartTimeTicks: number
	SubtitleStreamIndex: number
	UserId: string
}

export interface DeviceProfile {
	CodecProfiles: CodecProfile[]
	ContainerProfiles: ContainerProfile[]
	DirectPlayProfiles: DirectPlayProfile[]
	EnableAlbumArtInDidl: boolean
	EnableSingleAlbumArtLimit: boolean
	EnableSingleSubtitleLimit: boolean
	IgnoreTranscodeByteRangeRequests: boolean
	MaxAlbumArtHeight: number
	MaxAlbumArtWidth: number
	MaxStreamingBitrate: number
	MusicStreamingTranscodingBitrate: number
	Name: string
	RequiresPlainFolders: boolean
	RequiresPlainVideoItems: boolean
	ResponseProfiles: {
		Conditions: any[]
		Container: string
		MimeType: string
		Type: string
	}[]
	SubtitleProfiles: {
		Format: string
		Method: string
	}[]
	SupportedMediaTypes: string
	TimelineOffsetSeconds: number
	TranscodingProfiles: TranscodingProfile[]
	XmlRootAttributes: any[]
}

export interface CodecProfile {
	ApplyConditions: any[]
	Codec: string
	Conditions: {
		Condition: string
		IsRequired: boolean
		Property: string
		Value: string
	}[]
	Container: string
	Type: string
}

export interface ContainerProfile {
	Conditions: {
		Condition: string
		IsRequired: boolean
		Property: string
		Value: string
	}[]
	Type: string
}

export interface DirectPlayProfile {
	AudioCodec: string
	Container: string
	Type: string
	VideoCodec: string
}

export interface TranscodingProfile {
	AudioCodec: string
	BreakOnNonKeyFrames: boolean
	Container: string
	Context: string
	CopyTimestamps: boolean
	EnableMpegtsM2TsMode: boolean
	EstimateContentLength: boolean
	ManifestSubtitles: string
	MaxAudioChannels: string
	MinSegments: number
	Protocol: string
	SegmentLength: number
	TranscodeSeekInfo: string
	Type: string
	VideoCodec: string
}
