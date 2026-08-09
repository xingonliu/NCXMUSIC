import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

import RoutePlaceholder from '../design-system/patterns/RoutePlaceholder.vue'
import DesignSystemLabPage from '../features/design-system/DesignSystemLabPage.vue'
import CollectionDetailPage from '../features/music/CollectionDetailPage.vue'
import ArtistDetailPage from '../features/music/ArtistDetailPage.vue'
import DiscoverPage from '../features/music/DiscoverPage.vue'
import ImmersiveLyricsPage from '../features/music/ImmersiveLyricsPage.vue'
import PlaybackDetailPage from '../features/music/PlaybackDetailPage.vue'
import LikedSongsPage from '../features/music/LikedSongsPage.vue'
import SearchPage from '../features/music/SearchPage.vue'
import SearchResultsPage from '../features/music/SearchResultsPage.vue'
import SongCollectionPage from '../features/music/SongCollectionPage.vue'
import SettingsPage from '../features/settings/SettingsPage.vue'
import ProfilePage from '../features/profile/ProfilePage.vue'

// ========= 变量 =========

/** 首版空内容区页面占位组件。 */
const RouteSkeletonView = RoutePlaceholder

/** 首版冻结的 Vue Router 路由表。 */
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: { name: 'discover' }
  },
  {
    path: '/onboarding',
    name: 'onboarding',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.onboarding',
      playerBar: 'hide'
    }
  },
  {
    path: '/login',
    name: 'login',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.login',
      playerBar: 'hide'
    }
  },
  {
    path: '/discover',
    name: 'discover',
    component: DiscoverPage,
    meta: {
      pageLevel: 1,
      title: 'routes.discover',
      playerBar: 'show'
    }
  },
  {
    path: '/search',
    name: 'search',
    component: SearchPage,
    meta: {
      pageLevel: 1,
      title: 'routes.search',
      playerBar: 'show'
    }
  },
  {
    path: '/search/results',
    name: 'search-results',
    component: SearchResultsPage,
    meta: {
      pageLevel: 2,
      title: 'routes.searchResults',
      playerBar: 'show',
      fallbackRoute: 'search'
    }
  },
  {
    path: '/discover/collection/:collection(new|daily)',
    name: 'song-collection',
    component: SongCollectionPage,
    meta: {
      pageLevel: 2,
      title: 'routes.songCollection',
      playerBar: 'show',
      fallbackRoute: 'discover'
    }
  },
  {
    path: '/agent',
    name: 'agent',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.agent',
      playerBar: 'show'
    }
  },
  {
    path: '/library/liked',
    name: 'liked-songs',
    component: LikedSongsPage,
    meta: {
      pageLevel: 1,
      title: 'routes.likedSongs',
      playerBar: 'show'
    }
  },
  {
    path: '/playlists/:playlistId',
    name: 'playlist-detail',
    component: CollectionDetailPage,
    meta: {
      pageLevel: 2,
      title: 'routes.playlistDetail',
      playerBar: 'show',
      fallbackRoute: 'discover'
    }
  },
  {
    path: '/albums/:albumId',
    name: 'album-detail',
    component: CollectionDetailPage,
    meta: {
      pageLevel: 2,
      title: 'routes.albumDetail',
      playerBar: 'show',
      fallbackRoute: 'discover'
    }
  },
  {
    path: '/artists/:artistId',
    name: 'artist-detail',
    component: ArtistDetailPage,
    meta: {
      pageLevel: 2,
      title: 'routes.artistDetail',
      playerBar: 'show',
      fallbackRoute: 'discover'
    }
  },
  {
    path: '/playback',
    name: 'playback-detail',
    component: PlaybackDetailPage,
    meta: {
      pageLevel: 2,
      title: 'routes.playbackDetail',
      playerBar: 'hide',
      fallbackRoute: 'discover'
    }
  },
  {
    path: '/lyrics',
    name: 'immersive-lyrics',
    component: ImmersiveLyricsPage,
    meta: {
      pageLevel: 2,
      title: 'routes.immersiveLyrics',
      playerBar: 'hide',
      headerVariant: 'transparent',
      fallbackRoute: 'playback-detail'
    }
  },
  {
    path: '/profile',
    name: 'profile',
    component: ProfilePage,
    meta: {
      pageLevel: 1,
      title: 'routes.profile',
      playerBar: 'hide'
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: SettingsPage,
    meta: {
      pageLevel: 1,
      title: 'routes.settings',
      playerBar: 'hide'
    }
  },
  {
    path: '/design-system',
    name: 'design-system-lab',
    component: DesignSystemLabPage,
    meta: {
      pageLevel: 1,
      title: 'routes.designSystemLab',
      playerBar: 'hide'
    }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: { name: 'discover' }
  }
]

// ========= 路由 =========

export const router = createRouter({
  history: createWebHashHistory(),
  routes
})
