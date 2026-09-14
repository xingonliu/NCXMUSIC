import { createApp, defineComponent, h } from 'vue'
import { createRouter, createMemoryHistory } from 'vue-router'
import AppShell from '../../../src/renderer/design-system/patterns/AppShell.vue'
import PlayerBar from '../../../src/renderer/features/music/components/PlayerBar.vue'
import PageMaterials from './PageMaterials.vue'
import { translateSourceText } from '../../../src/renderer/i18n'
import '../../../src/renderer/design-system/styles/global.css'
import '../../../src/renderer/design-system/patterns/app-shell.css'

// Only the native account/window boundary is replaced; UI components remain real.
globalThis.ncx = {
  platform: 'win32',
  account: {
    onSnapshot: () => () => {},
    snapshot: async () => ({ state: 'logged_out', accountGeneration: 1, activeAccount: { kind: 'guest', accountId: 'guest:local', displayName: '游客' } })
  },
  lifecycle: { onFlushRequest: () => () => {} },
  runtime: {
    loadPlaybackSnapshot: async () => ({ ok: true, data: null }),
    savePlaybackSnapshot: async () => ({ ok: true, data: null })
  },
  windowControls: {
    onSnapshot: () => () => {},
    snapshot: async () => ({ platform: 'win32', fullscreen: false, maximized: false, focused: true })
  }
}
const routes = ['discover', 'browse', 'search', 'agent', 'design-system-lab', 'profile', 'settings', 'playlist-detail', 'liked-songs'].map(name => ({
  name, path: '/' + name, component: PageMaterials, meta: { pageLevel: 1, title: name, playerBar: 'show', pageLayout: name === 'settings' ? 'standard' : 'hero' }
}))
const router = createRouter({ history: createMemoryHistory(), routes })
await router.push('/discover')
const root = defineComponent({ setup: () => () => [h(AppShell), h(PlayerBar)] })
const application = createApp(root)
application.config.globalProperties.$tSource = translateSourceText
application.use(router).mount('#app')
