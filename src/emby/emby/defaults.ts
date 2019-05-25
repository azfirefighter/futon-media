import * as emby from '@/emby/emby'

export const defaults = {
	Configuration: {
		AudioLanguagePreference: 'eng',
		DisplayCollectionsView: true,
		DisplayMissingEpisodes: false,
		EnableNextEpisodeAutoPlay: false,
		HidePlayedInLatest: false,
		PlayDefaultAudioTrack: false,
		RememberAudioSelections: true,
		RememberSubtitleSelections: true,
		SubtitleLanguagePreference: 'eng',
		SubtitleMode: 'OnlyForced',
	} as Partial<emby.UserConfiguration>,

	DisplayPreferences: {
		CustomPrefs: {
			'dashboardTheme': '',
			'enableNextVideoInfoOverlay': 'false',
			'homesection0': '',
			'homesection1': '',
			'homesection2': 'nextup',
			'homesection3': 'latestmedia',
			'homesection4': 'none',
			'homesection5': 'none',
			'homesection6': '',
			// 'items-Movie-Person-sortby': 'PremiereDate,PremiereDate,PremiereDate',
			// 'items-Movie-Person-sortorder': 'Descending',
			// 'items-Series-Person-sortby': 'PremiereDate,PremiereDate,PremiereDate',
			// 'items-Series-Person-sortorder': 'Descending',
			'skipBackLength': '15000',
			'skipForwardLength': '30000',
			'subtitleeditor-language': 'eng',
			'tvhome': '',
		},
		PrimaryImageHeight: 250,
		PrimaryImageWidth: 250,
		RememberIndexing: false,
		RememberSorting: false,
		ScrollDirection: 'Horizontal',
		ShowBackdrop: true,
		ShowSidebar: false,
		SortBy: 'SortName',
		SortOrder: 'Ascending',
	} as Partial<emby.DisplayPreferences>,

	Policy: {
		AccessSchedules: [],
		BlockUnratedItems: [],
		BlockedTags: [],
		DisablePremiumFeatures: false,
		EnableAllChannels: true,
		EnableAllDevices: true,
		EnableAllFolders: true,
		EnableAudioPlaybackTranscoding: false,
		EnableContentDeletion: false,
		EnableContentDeletionFromFolders: [],
		EnableContentDownloading: false,
		EnableLiveTvAccess: false,
		EnableLiveTvManagement: false,
		EnableMediaConversion: false,
		EnableMediaPlayback: true,
		EnablePlaybackRemuxing: false,
		EnablePublicSharing: false,
		EnableRemoteAccess: true,
		EnableRemoteControlOfOtherUsers: false,
		EnableSharedDeviceControl: false,
		EnableSubtitleDownloading: true,
		EnableSubtitleManagement: false,
		EnableSyncTranscoding: false,
		EnableUserPreferenceAccess: false,
		EnableVideoPlaybackTranscoding: false,
		EnabledChannels: [],
		EnabledDevices: [],
		EnabledFolders: [],
		ExcludedSubFolders: [],
		InvalidLoginAttemptCount: 0,
		IsAdministrator: false,
		IsDisabled: false,
		IsHidden: true,
		IsHiddenRemotely: true,
		IsTagBlockingModeInclusive: false,
		RemoteClientBitrateLimit: 0,
	} as Partial<emby.Policy>,
}
