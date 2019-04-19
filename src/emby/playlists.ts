import * as _ from 'lodash'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as pAll from 'p-all'
import * as qs from 'query-string'
import * as utils from '@/utils/utils'
import * as trakt from '@/adapters/trakt'
import * as emby from '@/emby/emby'
import * as media from '@/media/media'

export async function syncPlaylists() {
	let lists = (await trakt.client.get(`/lists/trending`, {
		verbose: true,
		memoize: process.env.NODE_ENV == 'development',
	})) as trakt.ResponseList[]
	let list = lists[4].list
	let url = `/users/${list.user.ids.slug}/lists/${list.ids.trakt}/items`
	let results = (await trakt.client.get(url, {
		verbose: true,
		memoize: process.env.NODE_ENV == 'development',
	})) as trakt.Result[]
	results.splice(10)
	let items = results.map(v => new media.Item(v))
	await pAll(
		items.map(item => async () => {
			await fs.outputFile(emby.toStrmPath(item), `/dev/null`)
		}),
		{ concurrency: 1 }
	)
	await emby.refreshLibrary()
}