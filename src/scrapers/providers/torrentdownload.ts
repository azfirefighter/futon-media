import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as dayjs from 'dayjs'
import * as http from '@/adapters/http'
import * as path from 'path'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as utils from '@/utils/utils'

export const client = scraper.Scraper.http({
	baseUrl: 'https://www.torrentdownload.info',
	cloudflare: '/search?q=ubuntu',
})

export class TorrentDownload extends scraper.Scraper {
	sorts = ['searchs', 'search']

	async getResults(slug: string, sort: string) {
		let $ = cheerio.load(await client.get(`/${sort}`, { query: { q: slug } as Partial<Query> }))
		let results = [] as scraper.Result[]
		$('table:last-of-type tr:has(.tt-name)').each((i, el) => {
			try {
				let $el = $(el)
				let link = $el.find('.tt-name > a')
				let hash = link.attr('href').split('/')[1]
				let title = link.text()
				let age = $el.find('td.tdnormal:nth-of-type(2)').text()
				age = age.replace('ago', '').trim()
				age = age.replace(/^last/i, '1')
				results.push({
					bytes: utils.toBytes($el.find('td.tdnormal:nth-of-type(3)').text()),
					name: title,
					magnet: `magnet:?xt=urn:btih:${hash}&dn=${title}`,
					seeders: utils.parseInt($el.find('td.tdseed').text()),
					stamp: utils.toStamp(age),
				} as scraper.Result)
			} catch (error) {
				console.error(`${this.constructor.name} -> %O`, error.message)
			}
		})
		return results
	}
}

interface Query {
	q: string
}
