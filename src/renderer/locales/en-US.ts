import type { zhCN } from './zh-CN'
import type { LocaleMessagesFor } from './types'

// ========= 变量 =========

/** 美式英语界面文案；结构由简体中文基准语言包约束。 */
export const enUS = {
  app: {
    name: 'Ncxmusic',
    caption: 'Agent-native music client'
  },
  routes: {
    'routes.agent': 'AI Assistant',
    'routes.albumDetail': 'Album Details',
    'routes.artistDetail': 'Artist Details',
    'routes.browse': 'Browse',
    'routes.browseArtists': 'Explore Artists',
    'routes.browseCategories': 'Playlist Categories',
    'routes.browseRankings': 'Charts',
    'routes.discover': 'Discover',
    'routes.designSystemLab': 'UI Components',
    'routes.likedSongs': 'Liked Songs',
    'routes.login': 'Sign In',
    'routes.onboarding': 'Welcome',
    'routes.playlistDetail': 'Playlist Details',
    'routes.playerDetail': 'Now Playing',
    'routes.immersiveLyrics': 'Immersive Lyrics',
    'routes.songDetail': 'Song Details',
    'routes.profile': 'Profile',
    'routes.search': 'Search',
    'routes.searchResults': 'Search Results',
    'routes.songCollection': 'Song Collection',
    'routes.settings': 'Settings'
  },
  common: {
    cancel: 'Cancel',
    close: 'Close',
    loading: 'Loading',
    retry: 'Retry',
    unknownArtist: 'Unknown artist',
    unknownAlbum: 'Unknown album'
  },
  errors: {
    protocolInvalidMessage: 'The app received an invalid response. Try again.',
    protocolVersionMismatch: 'The app service version does not match. Restart the app.',
    connectionReplaced: 'The service connection changed. Try again.',
    requestTimeout: 'The request timed out. Try again later.',
    requestCancelled: 'The request was cancelled.',
    upstream: 'The upstream service returned an error. Try again later.',
    utilityUnavailable: 'The local service is temporarily unavailable. Try again later.',
    capabilityUnavailable: 'This capability is currently unavailable.',
    authRequired: 'Sign in before performing this action.',
    alreadyCompleted: 'This action has already been completed.',
    serviceUnavailable: 'The service is temporarily unavailable. Try again later.',
    accountStale: 'The account changed. Refresh and try again.',
    policyDenied: 'The current safety policy does not allow this action.',
    argumentsInvalid: 'The action parameters are invalid. Check them and try again.',
    notFound: 'No matching content was found.',
    providerTimeout: 'The model service timed out. Try again later.',
    generic: 'The operation failed. Try again later.'
  },
  navigation: {
    discover: 'Discover',
    browse: 'Browse',
    search: 'Search',
    agent: 'Xiaoyun',
    designSystem: 'UI Components',
    myMusic: 'My Music',
    liked: 'Liked Songs',
    profile: 'Profile',
    settings: 'Settings'
  },
  music: {
    signin: {
      loginExpired: 'Your session has expired. Sign in again before checking in.',
      alreadyCompleted: 'You have already checked in today.',
      serviceUnavailable: 'Check-in is temporarily unavailable. Try again later.',
      rejected: 'NetEase Cloud Music did not accept this check-in.',
      preparing: 'Your account is preparing write access. Please wait.',
      loginRequired: 'Sign in to your NetEase Cloud Music account first.',
      signing: 'Checking in…',
      succeeded: 'Check-in successful.'
    },
    clipboard: {
      succeeded: 'Copied to the system clipboard.',
      failed: 'Unable to write to the system clipboard.'
    },
    search: {
      mismatch: 'The search response type does not match.',
      loginForPlaylist: 'Sign in to NetEase Cloud Music before adding songs to a playlist.',
      playlistMismatch: 'The playlist response type does not match.',
      liked: 'Added “{song}” to Liked Songs.',
      addedToPlaylist: 'Added “{song}” to “{playlist}”.'
    }
  },
  foundation: {
    eyebrow: 'Foundation 0.1',
    title: 'Project structure is ready',
    description: 'The four-process entry points, domain boundaries, design system, and quality toolchain are in place.',
    layersLabel: 'Initialized project layers',
    ready: 'READY',
    runtime: {
      name: 'Runtime channel',
      generation: 'Utility generation',
      ping: 'Ping latency',
      requests: 'Handled requests'
    },
    layers: [
      { name: 'Electron', description: 'Independent entry points for Main, Preload, and Utility Process.' },
      { name: 'Renderer', description: 'A Vue, Router, and Design System single-page application root.' },
      { name: 'Contracts', description: 'Shared schemas, DTOs, and safe error boundaries.' },
      { name: 'Quality', description: 'TypeScript, ESLint, Stylelint, Vitest, and Playwright.' }
    ]
  },
  player: {
    regionLabel: 'Playback controls',
    emptyTrack: 'No track selected',
    play: 'Play',
    pause: 'Pause',
    previous: 'Previous',
    next: 'Next',
    volume: 'Volume',
    mute: 'Mute',
    unmute: 'Unmute',
    progress: 'Playback progress',
    dismiss: 'Dismiss notification',
    noticeTitle: 'Playback notice',
    downgradedSuffix: ' (downgraded)',
    queue: 'Play queue',
    queueTitle: 'Play Queue',
    queueEmpty: 'The play queue is empty',
    clearQueue: 'Clear queue',
    removeTrack: 'Remove from queue',
    nowPlaying: 'Now playing',
    mode: {
      loop: 'Repeat all',
      'loop-one': 'Repeat one',
      shuffle: 'Shuffle'
    },
    status: {
      idle: 'Idle',
      loading: 'Loading',
      ready: 'Ready',
      playing: 'Playing',
      paused: 'Paused',
      buffering: 'Buffering',
      error: 'Playback failed'
    },
    quality: {
      standard: 'Standard',
      higher: 'Higher',
      exhigh: 'Very high',
      lossless: 'Lossless',
      hires: 'Hi-Res',
      jyeffect: 'HD surround',
      sky: 'Immersive surround',
      dolby: 'Dolby Atmos',
      jymaster: 'Master quality'
    }
  }
} as const satisfies LocaleMessagesFor<typeof zhCN>
