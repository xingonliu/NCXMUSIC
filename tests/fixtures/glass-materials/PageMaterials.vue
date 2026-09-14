<script setup>
import { ref } from 'vue'
import { CommonButton, CommonDialog } from '../../../src/renderer/design-system/components'
import MusicDetailHero from '../../../src/renderer/features/music/components/MusicDetailHero.vue'
import Cover from '../../../src/renderer/features/music/components/Cover.vue'
import { useRoute, useRouter } from 'vue-router'
const route = useRoute()
const router = useRouter()
const open = ref(false)
const artwork = new URL('./artwork.svg', window.location.href).href
</script>
<template>
  <div>
    <MusicDetailHero
      v-if="route.name !== 'settings'"
      :artwork-url="artwork"
    >
      <div>
        <h1>Music &amp; Glass</h1><p>Integrated material verification</p>
        <CommonButton
          material="tinted"
          variant="primary"
          data-testid="hero-play"
          @click="open = true"
        >
          播放
        </CommonButton>
        <CommonButton
          material="clear"
          data-testid="hero-more"
        >
          更多
        </CommonButton>
      </div>
    </MusicDetailHero>
    <section style="padding:32px 0; min-height:1000px">
      <h2>{{ route.name === 'settings' ? '设置' : '封面操作' }}</h2>
      <CommonButton
        material="tinted"
        variant="primary"
        data-testid="settings-apply"
        @click="router.push('/settings')"
      >
        应用设置
      </CommonButton>
      <div
        v-if="route.name !== 'settings'"
        style="width:220px; margin-top:24px"
      >
        <Cover
          :src="artwork"
          alt="Material sample"
          :always-show-shadow="true"
          :show-play-button="true"
          @play="open = true"
        />
      </div>
    </section>
    <CommonDialog
      :visible="open"
      title="播放操作"
      @close="open = false"
    >
      <p>正文保持清晰。</p>
    </CommonDialog>
  </div>
</template>
