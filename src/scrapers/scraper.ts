import * as _ from 'lodash'
import * as dayjs from 'dayjs'
import * as pAll from 'p-all'
import * as path from 'path'
import * as qs from 'query-string'
import * as magneturi from 'magnet-uri'
import * as utils from '@/utils/utils'
import * as http from '@/adapters/http'
import * as media from '@/media/media'
import * as filters from '@/scrapers/filters'
import * as trackers from '@/scrapers/trackers-list'
import * as torrent from '@/scrapers/torrent'
import * as debrid from '@/debrids/debrid'

export async function scrapeAll(...[item]: ConstructorParameters<typeof Scraper>) {
	// console.log(`results ->`, results.splice(0).map(scraper.json))
	// (await import('./providers/btbit')).BtBit, // (await import('./providers/snowfl')).Snowfl,
	let providers = [
		// (await import('./providers/btdb')).Btdb,
		// (await import('./providers/extratorrent')).ExtraTorrent,
		// (await import('./providers/eztv')).Eztv,
		// (await import('./providers/magnet4you')).Magnet4You,
		// (await import('./providers/magnetdl')).MagnetDl,
		// (await import('./providers/orion')).Orion,
		// (await import('./providers/pirateiro')).Pirateiro,
		(await import('./providers/rarbg')).Rarbg,
		// (await import('./providers/solidtorrents')).SolidTorrents,
		// (await import('./providers/yts')).Yts,
	] as typeof Scraper[]

	let torrents = (await pAll(
		providers.map(scraper => () => new scraper(item).getTorrents())
	)).flat()

	torrents = _.uniqWith(torrents, (from, to) => {
		if (to.hash != from.hash) {
			return false
		}
		to.providers = _.uniq(to.providers.concat(from.providers))
		to.slugs = _.uniq(to.slugs.concat(from.slugs))
		!to.bytes && from.bytes && (to.bytes = from.bytes)
		!to.stamp && from.stamp && (to.stamp = from.stamp)
		!to.seeders && from.seeders && (to.seeders = from.seeders)
		return true
	})

	// let cached = await debrid.getCached(torrents.map(v => v.hash))
	// torrents.forEach((v, i) => (v.cached = cached[i]))

	torrents.sort((a, b) => b.bytes - a.bytes)

	return torrents
}

export interface Scraper {
	getResults(slug: string, sort: string): Promise<Result[]>
}
export class Scraper {
	sorts = ['']
	concurrency = 3

	slugs() {
		let slugs = [] as string[]
		if (this.item.movie) {
			slugs.push(this.item.title)
			if (this.item.movie.belongs_to_collection) {
				let collection = this.item.movie.belongs_to_collection.name.split(' ')
				slugs.push(collection.slice(0, -1).join(' '))
			}
		}
		if (this.item.show) {
			if (this.item.S.n) {
				slugs.push(`${this.item.title} s${this.item.S.z}`)
				slugs.push(`${this.item.title} season ${this.item.S.n}`)
			}
			if (this.item.E.n) {
				slugs.push(`${this.item.title} s${this.item.S.z}e${this.item.E.z}`)
			}
			if (slugs.length == 0) {
				slugs.push(this.item.title)
			}
		}
		return slugs.map(v => utils.toSlug(v))
	}

	constructor(public item: media.Item) {}

	async getTorrents() {
		let combinations = [] as Parameters<typeof Scraper.prototype.getResults>[]
		this.slugs().forEach(slug => this.sorts.forEach(sort => combinations.push([slug, sort])))

		/** get results with slug and sorts query combinations */
		let results = (await pAll(
			combinations.map(([slug, sort], index) => async () => {
				index > 0 && (await utils.pRandom(500))
				return (await this.getResults(slug, sort).catch(error => {
					console.error(`${this.constructor.name} Error ->`, error)
					return [] as Result[]
				})).map(result => ({
					...result,
					providers: [this.constructor.name],
					slugs: [slug],
				}))
			}),
			{ concurrency: this.concurrency }
		)).flat() as Result[]

		/** remove junk results */
		_.remove(results, result => {
			/** clean and check for magnet URL */
			result.magnet = utils.clean(result.magnet)
			let magnet = (qs.parseUrl(result.magnet).query as any) as MagnetQuery
			if (!magnet.xt) {
				console.warn(`${this.constructor.name} junk !magnet.xt ->`, result)
				return true
			}

			/** check and repair name then slugify */
			result.name = result.name || magnet.dn
			if (!result.name) {
				console.warn(`${this.constructor.name} junk !result.name ->`, result)
				return true
			}
			result.name = utils.toSlug(result.name, { toName: true, separator: '.' })

			if (utils.accuracy(this.item.title, result.name).length > 0) {
				console.warn(`${this.constructor.name} junk accuracy > 0`, result)
				return true
			}
		})

		// console.warn(`${this.constructor.name} -> DONE`)
		return results.map(v => new torrent.Torrent(v))
	}
}

export function json(result: Result) {
	return {
		..._.omit(result, 'magnet'),
		bytes: utils.fromBytes(result.bytes),
		stamp: dayjs(result.stamp).fromNow() + ', ' + dayjs(result.stamp).format('MMM DD YYYY'),
	}
}

export interface Result {
	bytes: number
	magnet: string
	name: string
	providers: string[]
	seeders: number
	slugs: string[]
	stamp: number
}

export interface MagnetQuery {
	dn: string
	tr: string[]
	xt: string
}