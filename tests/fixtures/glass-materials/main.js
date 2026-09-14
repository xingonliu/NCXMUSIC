import { createApp } from 'vue'
import GlassMaterialLab from '../../../src/renderer/features/design-system/GlassMaterialLab.vue'
import '../../../src/renderer/design-system/tokens/foundation.css'
import '../../../src/renderer/design-system/components/common-components.css'
import { translateSourceText } from '../../../src/renderer/i18n'
const application = createApp(GlassMaterialLab)
application.config.globalProperties.$tSource = translateSourceText
application.mount('#app')
