import * as _ from 'lodash'
import * as advancedFormat from 'dayjs/plugin/advancedFormat'
import * as crypto from 'crypto'
import * as customParseFormat from 'dayjs/plugin/customParseFormat'
import * as dayjs from 'dayjs'
import * as levenshtein from 'js-levenshtein'
import * as matcher from 'matcher'
import * as path from 'path'
import * as pDelay from 'delay'
import * as relativeTime from 'dayjs/plugin/relativeTime'
import fastStringify from 'fast-safe-stringify'
import numbro, { INumbro } from '@/shims/numbro'
import slugify, { Options as SlugifyOptions } from '@sindresorhus/slugify'
import stripAnsi from 'strip-ansi'
import stripBom = require('strip-bom')

dayjs.extend(advancedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)

export function duration(amount: number, unit: dayjs.OpUnitType) {
	let day = dayjs(0).add(amount, unit)
	return day.valueOf()
}

export function hash(value: any) {
	if (!_.isString(value)) value = fastStringify.stable(value)
	let sha256 = crypto.createHash('sha256').update(value)
	return sha256.digest('hex')
}

export function pTimeout<T = void>(ms: number, value?: T): Promise<T> {
	return pDelay(_.ceil(ms), { value })
}
export function pRandom<T = void>(ms: number, value?: T): Promise<T> {
	return pDelay(_.ceil(_.random(ms * Math.E * 0.1, ms)), { value })
}

export function isNumeric(value: string) {
	return !_.isEmpty(value) && !isNaN(value as any)
}
export function parseInt(value: string) {
	return Number.parseInt(value.replace(/[^\d]/g, ''))
}
export function parseFloat(value: string) {
	return Number.parseFloat(value.replace(/[^\d.]/g, ''))
}
export function zeroSlug(value: number) {
	if (!_.isFinite(value)) return 'NaN'
	if (value >= 100) return value.toString()
	return (value / 100).toFixed(2).slice(-2)
}

export function isForeign(value: string) {
	for (let i = 0; i < value.length; i++) {
		if (value.charCodeAt(i) >= 256) return true
	}
	return false
}
export function isAscii(value: string) {
	return /[^\w\s]/gi.test(value) == false
}
export function squash(value: string) {
	return _.trim(clean(value).replace(/[^\w\s]/gi, ''))
}
export function minify(value: string) {
	return _.trim(clean(value).replace(/[^\w]/gi, '')).toLowerCase()
}
export function clean(value: string) {
	return _.trim(stripBom(stripAnsi(_.unescape(_.deburr(value)))))
}

export function equals(value: string, target: string) {
	return minify(value) == minify(target)
}
export function includes(value: string, target: string) {
	return minify(value).includes(minify(target))
}
export function startsWith(value: string, target: string) {
	return minify(value).startsWith(minify(target))
}
export function unique(values: string[]) {
	return _.uniqWith(values, (a, b) => minify(a) == minify(b))
}

export function contains(value: string, target: string) {
	let values = toSlug(value).split(' ')
	let targets = toSlug(target).split(' ')
	let start = values.findIndex(v => v == targets[0])
	if (start == -1) return false
	for (let i = 0; i < targets.length; i++) {
		if (!equals(targets[i], values[start + i])) return false
	}
	return true
}

/** `accuracies.length == 0` when all of `target` is included in `value` */
export function accuracies(value: string, target: string) {
	let values = _.uniq(toSlug(value).split(' '))
	let targets = _.uniq(toSlug(target).split(' '))
	return targets.filter(v => !values.includes(v))
}
export function accuracy(value: string, target: string) {
	return accuracies(value, target).length == 0
}

/** `leven == 0` when all of `target` is included in `value` */
export function leven(value: string, target: string) {
	value = toSlug(value)
	target = toSlug(target)
	return Math.abs(value.length - target.length - levenshtein(value, target))
}
export { levenshtein }

export function unsquash(value: string, query = false) {
	let [a, b] = [toSlug(value, { squash: true }), toSlug(value)]
	if (a == b) return [a]
	if (query == false) return [a, b]
	let words = value.split(' ').filter(v => isAscii(v.slice(1, -1)))
	return words.length >= 2 ? [toSlug(words.join(' '))] : [a, b]
}

export type SlugOptions = Partial<
	SlugifyOptions & { title: boolean; squash: boolean; stops: boolean }
>
export function toSlug(value: string, options = {} as SlugOptions) {
	_.defaults(options, {
		decamelize: false,
		lowercase: options.title != true,
		separator: ' ',
		squash: options.title == true,
		stops: false,
	} as Parameters<typeof toSlug>[1])
	value = clean(value)
	let slug = slugify(options.squash ? squash(value) : value, { ...options, separator: ' ' })
	let stops = options.stops ? ['a', 'an', 'and', 'in', 'of', 'the', 'to', 'with'] : []
	let split = slug.split(' ').filter(v => !stops.includes(v.toLowerCase()))
	return split.join(options.separator)
}
export { slugify }

export const VIDEOS = ['avi', 'm4a', 'mkv', 'mov', 'mp4', 'mpeg', 'webm', 'wmv']
export function isVideo(file: string) {
	return VIDEOS.includes(path.extname(file.toLowerCase()).slice(1))
}

export function compact<T = any>(value: T) {
	return (_.fromPairs(_.toPairs(value as any).filter(([k, v]) => !_.isNil(v))) as any) as T
}
export function byLength(values: string[]) {
	return _.sortBy(values).sort((a, b) => a.length - b.length)
}
export function alphabetically(a: string, b: string) {
	a = minify(a)
	b = minify(b)
	return a < b ? -1 : a > b ? 1 : (0 as number)
}

export function slider(value: number, min: number, max: number) {
	if (max - min == 0) return 0
	return ((value - min) / (max - min)) * 100
}

export function dispersed(value: number, index: number, max: number) {
	return Math.round(Math.max(index, 0) * (value / Math.max(max, 1)))
}

export function chunks<T = any>(values: T[], max: number) {
	let size = Math.ceil(values.length / Math.max(max, 1))
	let chunks = Array.from(Array(size), v => []) as T[][]
	values.forEach((v, i) => chunks[i % chunks.length].push(v))
	return chunks
}

export function randoms(size = 32) {
	return Array.from(Array(size), v => Math.random().toString())
}
export function nonce() {
	let random = Math.random().toString(36)
	return random.slice(-8)
}

export function defineValue<T, K extends keyof T>(target: T, key: K, value: T[K]) {
	Object.defineProperty(target, key, { value })
}

export function toStamp(value: string) {
	let amount = parseInt(value)
	let unit = _.trim(value.replace(/[^a-z ]/gi, '').toLowerCase())
	unit = unit.split(' ').shift()
	if (unit.endsWith('s')) unit = unit.slice(0, -1)
	let day = dayjs().subtract(amount, unit as any)
	return day.add(1, 'minute').valueOf()
}

const BYTE_UNITS = {
	b: { num: 1, str: 'B' },
	kb: { num: Math.pow(1000, 1), str: 'KB' },
	mb: { num: Math.pow(1000, 2), str: 'MB' },
	gb: { num: Math.pow(1000, 3), str: 'GB' },
	tb: { num: Math.pow(1000, 4), str: 'TB' },
	pb: { num: Math.pow(1000, 5), str: 'PB' },
	eb: { num: Math.pow(1000, 6), str: 'EB' },
	zb: { num: Math.pow(1000, 7), str: 'ZB' },
	yb: { num: Math.pow(1000, 8), str: 'YB' },
	kib: { num: Math.pow(1024, 1), str: 'KiB' },
	mib: { num: Math.pow(1024, 2), str: 'MiB' },
	gib: { num: Math.pow(1024, 3), str: 'GiB' },
	tib: { num: Math.pow(1024, 4), str: 'TiB' },
	pib: { num: Math.pow(1024, 5), str: 'PiB' },
	eib: { num: Math.pow(1024, 6), str: 'EiB' },
	zib: { num: Math.pow(1024, 7), str: 'ZiB' },
	yib: { num: Math.pow(1024, 8), str: 'YiB' },
}
export function toBytes(value: string) {
	let amount = parseFloat(value)
	let unit = value.replace(/[^a-z]/gi, '').toLowerCase()
	return _.parseInt((amount * BYTE_UNITS[unit].num) as any)
}
export function fromBytes(value: number, precision = 1) {
	let units = Object.entries(BYTE_UNITS).map(([k, v]) => v)
	let unit = units.find(unit => value / unit.num < 1000)
	return `${(value / unit.num).toFixed(precision)} ${unit.str}`
}

if (process.DEVELOPMENT) {
	process.nextTick(async () => _.defaults(global, await import('@/utils/utils')))
}
