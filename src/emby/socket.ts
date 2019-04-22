import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as fastParse from 'fast-json-parse'
import * as media from '@/media/media'
import * as Rx from '@/utils/rxjs'
import * as trakt from '@/adapters/trakt'
import * as Url from 'url-parse'
import * as utils from '@/utils/utils'
import Sockette from '@/utils/sockette'

interface EmbyEvent<Data = any> {
	name: string
	data: Data
}
export const rx = new Rx.Subject<EmbyEvent>()
export const rxSession = rx.pipe(
	Rx.Op.filter(({ name }) => name == 'Sessions'),
	Rx.Op.map(({ data }) => emby.toSessions(data)[0])
)

_.once(() => {
	let url = process.env.EMBY_API_URL.replace('http', 'ws')
	url += `/embywebsocket?api_key=${process.env.EMBY_API_KEY}`
	let ws = new Sockette(url, {
		timeout: 1000,
		maxAttempts: Infinity,
		onerror({ error }) {
			console.error(`emby socket -> %O`, error)
		},
		onopen(message) {
			console.info(`emby socket open ->`, new Url(message.target.url).origin)
			ws.json({ MessageType: 'SessionsStart', Data: '0,1000' })
			ws.json({ MessageType: 'ScheduledTasksInfoStart', Data: '0,1000' })
			ws.json({ MessageType: 'ActivityLogEntryStart', Data: '0,1000' })
		},
		onmessage(message) {
			let { MessageType: name, Data: data } = fastParse(message.data).value || message.data
			rx.next({ name, data })
		},
	})
})()
