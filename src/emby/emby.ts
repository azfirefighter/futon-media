import * as _ from 'lodash'
import * as http from '@/adapters/http'

// export const env = {
// 	ADMIN_ID: process.env.ADMIN_ID,
// 	ADMIN_KEY: process.env.ADMIN_KEY,
// 	HOST: process.env.HOST,
// 	KEY: process.env.KEY,
// 	PORT: process.env.PORT,
// 	PROTO: process.env.PROTO,
// 	STRM_PORT: process.env.STRM_PORT,
// }

export const URL = `${process.env.EMBY_PROTO}//${process.env.EMBY_HOST}:${process.env.EMBY_PORT}`

export const client = new http.Http({
	baseUrl: `${URL}/emby`,
	query: { api_key: process.env.EMBY_KEY },
})

// export async function getSystemInfo() {
// 	return (await client.get('/System/Info', { silent: true })) as SystemInfo
// }

export * from '@/emby/emby/defaults'
export * from '@/emby/emby/library'
export * from '@/emby/emby/sessions'
export * from '@/emby/emby/socket'
export * from '@/emby/emby/tail'
export * from '@/emby/emby/users'

export interface SystemInfo {
	CachePath: string
	CanLaunchWebBrowser: boolean
	CanSelfRestart: boolean
	CanSelfUpdate: boolean
	CompletedInstallations: any[]
	HardwareAccelerationRequiresPremiere: boolean
	HasPendingRestart: boolean
	HasUpdateAvailable: boolean
	HttpServerPortNumber: number
	HttpsPortNumber: number
	Id: string
	InternalMetadataPath: string
	IsShuttingDown: boolean
	ItemsByNamePath: string
	LocalAddress: string
	LogPath: string
	OperatingSystem: string
	OperatingSystemDisplayName: string
	ProgramDataPath: string
	ServerName: string
	SupportsAutoRunAtStartup: boolean
	SupportsHttps: boolean
	SupportsLibraryMonitor: boolean
	SystemUpdateLevel: string
	TranscodingTempPath: string
	Version: string
	WanAddress: string
	WebSocketPortNumber: number
}

export interface SystemLog {
	DateCreated: string
	DateModified: string
	Name: string
	Size: number
}
