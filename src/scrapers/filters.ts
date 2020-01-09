import * as _ from 'lodash'
import * as dicts from '@/utils/dicts'
import * as execa from 'execa'
import * as media from '@/media/media'
import * as qs from '@/shims/query-string'
import * as scraper from '@/scrapers/scraper'
import * as torrent from '@/scrapers/torrent'
import * as utils from '@/utils/utils'

export function torrents(torrent: torrent.Torrent, item: media.Item) {
	let collision = item.collisions.find(v => torrent.slug.includes(` ${v} `))
	if (collision) {
		return console.log(`⛔ collision '${collision}' ->`, torrent.json)
	}

	if (!item.aliases.find(v => torrent.slug.includes(` ${v} `))) {
		return console.log(`⛔ !aliases ->`, torrent.json)
	}

	if (item.movie) {
		if (!item.collection.name && !item.years.find(v => torrent.years.includes(v))) {
			return console.log(`⛔ movie !years '${torrent.years}' ->`, torrent.json)
		}
		if (!_.isEmpty(torrent.seasons)) {
			return console.log(`⛔ movie seasons '${torrent.seasons}' ->`, torrent.json)
		}
		if (!_.isEmpty(torrent.episodes)) {
			return console.log(`⛔ movie episodes '${torrent.episodes}' ->`, torrent.json)
		}
		return true
	}

	if (item.show) {
		if (item.isDaily && item.E.a) {
			if (utils.allSlugs(item.E.a).find(v => torrent.slug.includes(` ${v} `))) {
				return true
			}
		}
		if (!utils.includes(item.S.t, 'season')) {
			if (utils.allSlugs(item.S.t).find(v => torrent.slug.includes(` ${v} `))) {
				return true
			}
		}
		if (item.E.t) {
			let epslugs = utils.allSlugs(item.E.t).filter(v => v.includes(' '))
			if (epslugs.find(v => torrent.slug.includes(` ${v} `))) {
				return true
			}
		}

		if (item.seasons.filter(v => v.aired_episodes > 0).length == 1) {
			return true
		}
		if (torrent.seasons.length > 0) {
			if (torrent.seasons.includes(item.S.n)) return true
			return console.log(`⛔ show seasons '${torrent.seasons}' ->`, torrent.json)
		}
		if (torrent.episodes.length > 0) {
			if (torrent.episodes.includes(item.E.n)) return true
			return console.log(`⛔ show episodes '${torrent.episodes}' ->`, torrent.json)
		}
		let stragglers = [`${item.S.n}${item.E.z}`, item.E.z, item.E.n]
		if (stragglers.find(v => torrent.slug.includes(` ${v} `))) {
			return true
		}
		return console.log(`⛔ show return false ->`, torrent.json)
	}

	// if (item.movie && torrent.packs) return true
	// let collision = item.collisions.find(v => utils.contains(torrent.name, v))
	// if (collision) {
	// 	return console.log(`⛔ collision '${collision}' ->`, torrent.short)
	// }
	// if (item.movie) return true

	// if (item.show) {
	// 	try {
	// 		// // console.time(`${torrent.filename}`)
	// 		// // let parsed = execa.sync('/usr/local/bin/guessit', [`"${torrent.filename}"`])
	// 		// let parsed = filenameParse(torrent.filename, true)
	// 		// // if (parsed.seasons.length >= 2) {
	// 		// // console.timeEnd(`${torrent.filename}`)
	// 		// console.log(`${torrent.filename} ->`, parsed)
	// 		// // }

	// 		let match = item.matches.find(v => utils.accuracy(torrent.name, v))
	// 		if (match) return true

	// 		let s00e00s = item.s00e00
	// 			.map(v => torrent.name.match(v))
	// 			.filter(v => v && v.length == 3)
	// 		let s00e00 = s00e00s.find(v => {
	// 			if (_.isEqual([item.S.n, item.E.n], [v[1], v[2]].map(utils.parseInt))) return true
	// 			throw new Error(`'${v[0].trim()}'`)
	// 		})
	// 		if (s00e00) return true

	// 		// if (torrent.packs != undefined) {
	// 		// 	torrent.packs = 1
	// 		// 	if (regex.nthseason(item, name)) return true
	// 		// 	if (regex.season(item, name)) return true

	// 		// 	let seasons0to = regex.seasons0to(item, name)
	// 		// 	if (_.isFinite(seasons0to)) {
	// 		// 		torrent.packs = seasons0to
	// 		// 		return true
	// 		// 	}
	// 		// }

	// 		let e00s = item.e00.map(v => name.match(v)).filter(v => v && v.length == 2)
	// 		let e00 = e00s.find(v => {
	// 			if (_.isEqual([item.E.n], [v[1]].map(utils.parseInt))) return true
	// 			throw new Error(`'${v[0].trim()}'`)
	// 		})
	// 		if (e00) return true

	// 		let straggler = item.stragglers.find(v => utils.accuracy(name, v))
	// 		if (straggler) return true

	// 		return console.log(`⛔ show return false ->`, torrent.short)
	// 	} catch (error) {
	// 		// console.error(`⛔ catch show ${torrent.short} -> %O`, error)
	// 		return console.log(`⛔ catch show ${error.message} ->`, torrent.short)
	// 	}
	// }
}

// export const regex = {
// 	/** `1st season` */
// 	nthseason(item: media.Item, slug: string) {
// 		let matches = slug.match(/ (?<season>\d{1,2})[a-z]{2} (season|chapter) /gi)
// 		matches = (matches || []).map(v => v.trim())
// 		let seasons = matches.map(v => utils.parseInt(v))
// 		if (seasons.includes(item.S.n)) return true
// 	},
// 	/** `season one` */
// 	season(item: media.Item, slug: string) {
// 		let nstrs = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
// 		let matches = slug.match(
// 			/\ss(eason)?\s(one|two|three|four|five|six|seven|eight|nine|ten)\s/gi,
// 		)
// 		matches = (matches || []).map(v => v.trim())
// 		let nstr = matches.map(v => v.split(' ').pop())[0]
// 		let index = nstrs.findIndex(v => v == nstr) + 1
// 		if (item.S.n == index) return true
// 	},
// 	/** `seasons 1 - 2` */
// 	seasons0to(item: media.Item, slug: string) {
// 		slug = slug.replace(/(through)|(and)|(to)/gi, ' ').replace(/\s+/g, ' ')
// 		let matches = [
// 			slug.match(/\s?s(eason(s)?)?\s?\d{1,2}\s?s?(eason)?(\s?\d{1,2}\s)+/gi) || [],
// 			slug.match(/\s?s(eason)?\s?\d{1,2}\s/gi) || [],
// 		].flat()
// 		matches = (matches || []).map(v => v.trim())
// 		matches = matches.join(' ').split(' ')
// 		let ints = matches.map(utils.parseInt).filter(v => _.isInteger(v) && v < 100)
// 		let { min, max } = { min: _.min(ints), max: _.max(ints) }
// 		if (item.S.n >= min && item.S.n <= max) {
// 			return max - min + 1
// 		}
// 	},
// }

// if (process.DEVELOPMENT) {
// 	process.nextTick(async () => _.defaults(global, await import('@/scrapers/filters')))
// }
