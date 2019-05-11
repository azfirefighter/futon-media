#!/usr/bin/env node

import 'module-alias/register'
import 'dotenv/config'
import 'node-env-dev'
import '@/adapters/logs'
import '@/dev/devtools'
import '@/mocks/mocks'

// use dynamic imports to avoid circular null references
async function start() {
	await import('@/emby/emby')
	await import('@/emby/collections')
	await import('@/emby/search')
	await import('@/emby/strm')
}
setTimeout(
	() => start().catch(error => console.error(`start -> %O`, error)),
	process.DEVELOPMENT ? 1000 : 1 // wait for Debugger attached
)
