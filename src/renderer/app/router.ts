import { defineComponent } from 'vue'
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router'

// ========= 变量 =========

/** 不输出任何 DOM 的路由占位组件；仅用于先搭建导航骨架。 */
const RouteSkeletonView = defineComponent({
  name: 'RouteSkeletonView',
  setup() {
    return () => null
  }
})

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
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.discover',
      playerBar: 'show'
    }
  },
  {
    path: '/search',
    name: 'search',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.search',
      playerBar: 'show'
    }
  },
  {
    path: '/search/results',
    name: 'search-results',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 2,
      title: 'routes.searchResults',
      playerBar: 'show',
      fallbackRoute: 'search'
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
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.likedSongs',
      playerBar: 'show'
    }
  },
  {
    path: '/playlists/:playlistId',
    name: 'playlist-detail',
    component: RouteSkeletonView,
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
    component: RouteSkeletonView,
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
    component: RouteSkeletonView,
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
    component: RouteSkeletonView,
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
    component: RouteSkeletonView,
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
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.profile',
      playerBar: 'hide'
    }
  },
  {
    path: '/settings',
    name: 'settings',
    component: RouteSkeletonView,
    meta: {
      pageLevel: 1,
      title: 'routes.settings',
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
