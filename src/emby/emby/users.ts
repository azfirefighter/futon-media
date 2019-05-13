import * as _ from 'lodash'
import * as emby from '@/emby/emby'
import * as schedule from 'node-schedule'
import * as utils from '@/utils/utils'

// process.nextTick(() => users.syncAll())

export const users = {
	async get() {
		let Users = (await emby.client.get('/Users')) as User[]
		Users = Users.map(v => new User(v))
		return Users.sort((a, b) => utils.alphabetically(a.Name, b.Name))
	},
	async byUserId(UserId: string) {
		return new User(await emby.client.get(`/Users/${UserId}`))
	},
	async syncAll() {
		let Users = await users.get()
		for (let User of Users) {
			let DisplayPreferences = await User.getDisplayPreferences()
			_.merge(DisplayPreferences, emby.defaults.DisplayPreferences)
			await User.setDisplayPreferences(DisplayPreferences)
			_.merge(User.Configuration, emby.defaults.Configuration)
			await User.setConfiguration(User.Configuration)
			if (User.Name.toLowerCase() != 'admin') {
				_.merge(User.Policy, emby.defaults.Policy)
				await User.setPolicy(User.Policy)
			}
		}
	},
}

export class User {
	constructor(User: User) {
		_.merge(this, User)
	}

	async setConfiguration(Configuration: Configuration) {
		await emby.client.post(`/Users/${this.Id}/Configuration`, {
			query: { api_key: emby.env.ADMIN_KEY },
			body: Configuration,
		})
	}
	async setPolicy(Policy: Policy) {
		await emby.client.post(`/Users/${this.Id}/Policy`, {
			query: { api_key: emby.env.ADMIN_KEY },
			body: Policy,
		})
	}

	async getDisplayPreferences(client = 'emby' as 'emby' | 'ATV') {
		return (await emby.client.get(`/DisplayPreferences/usersettings`, {
			query: { client, userId: this.Id },
		})) as DisplayPreferences
	}
	async setDisplayPreferences(DisplayPreferences: DisplayPreferences) {
		await emby.client.post(`/DisplayPreferences/usersettings`, {
			query: { client: 'emby', userId: this.Id, api_key: emby.env.ADMIN_KEY },
			body: DisplayPreferences,
		})
	}

	async Latest() {
		return (await emby.client.get(`/Users/${this.Id}/Items/Latest`, {
			query: { Limit: 5 },
		})) as emby.Item[]
	}

	async Views() {
		return (await emby.client.get(`/Users/${this.Id}/Views`)) as emby.View[]
	}
}

export interface User {
	Configuration: Configuration
	HasConfiguredEasyPassword: boolean
	HasConfiguredPassword: boolean
	HasPassword: boolean
	Id: string
	LastActivityDate: string
	LastLoginDate: string
	Name: string
	Policy: Policy
	PrimaryImageAspectRatio: number
	PrimaryImageTag: string
	ServerId: string
}

export interface Configuration {
	AudioLanguagePreference: string
	DisplayCollectionsView: boolean
	DisplayMissingEpisodes: boolean
	EnableLocalPassword: boolean
	EnableNextEpisodeAutoPlay: boolean
	GroupedFolders: string[]
	HidePlayedInLatest: boolean
	LatestItemsExcludes: string[]
	MyMediaExcludes: string[]
	OrderedViews: string[]
	PlayDefaultAudioTrack: boolean
	RememberAudioSelections: boolean
	RememberSubtitleSelections: boolean
	SubtitleLanguagePreference: string
	SubtitleMode: string
}

export interface Policy {
	AccessSchedules: any[]
	AuthenticationProviderId: string
	BlockedTags: any[]
	BlockUnratedItems: any[]
	DisablePremiumFeatures: boolean
	EnableAllChannels: boolean
	EnableAllDevices: boolean
	EnableAllFolders: boolean
	EnableAudioPlaybackTranscoding: boolean
	EnableContentDeletion: boolean
	EnableContentDeletionFromFolders: any[]
	EnableContentDownloading: boolean
	EnabledChannels: any[]
	EnabledDevices: any[]
	EnabledFolders: any[]
	EnableLiveTvAccess: boolean
	EnableLiveTvManagement: boolean
	EnableMediaConversion: boolean
	EnableMediaPlayback: boolean
	EnablePlaybackRemuxing: boolean
	EnablePublicSharing: boolean
	EnableRemoteAccess: boolean
	EnableRemoteControlOfOtherUsers: boolean
	EnableSharedDeviceControl: boolean
	EnableSubtitleDownloading: boolean
	EnableSubtitleManagement: boolean
	EnableSyncTranscoding: boolean
	EnableUserPreferenceAccess: boolean
	EnableVideoPlaybackTranscoding: boolean
	ExcludedSubFolders: any[]
	InvalidLoginAttemptCount: number
	IsAdministrator: boolean
	IsDisabled: boolean
	IsHidden: boolean
	IsHiddenRemotely: boolean
	IsTagBlockingModeInclusive: boolean
	RemoteClientBitrateLimit: number
}

export interface DisplayPreferences {
	Client: string
	CustomPrefs: Partial<{
		[key: string]: string
		dashboardTheme: string
		enableNextVideoInfoOverlay: string
		homesection0: string
		homesection1: string
		homesection2: string
		homesection3: string
		homesection4: string
		homesection5: string
		homesection6: string
		skipBackLength: string
		skipForwardLength: string
		tvhome: string
	}>
	Id: string
	PrimaryImageHeight: number
	PrimaryImageWidth: number
	RememberIndexing: boolean
	RememberSorting: boolean
	ScrollDirection: string
	ShowBackdrop: boolean
	ShowSidebar: boolean
	SortBy: string
	SortOrder: string
}
