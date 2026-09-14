<script setup lang="ts">
import { Heart, Play } from '@lucide/vue'
import { ref } from 'vue'
import { CommonButton, CommonDialog, CommonIconButton } from '../../design-system/components'
import wallpaper from '../../design-system/materials/demo/wallpaper_light.webp'

// -- Constants
const grades = [
  { material: 'frost', grade: 'G1', label: '高斯模糊与按压形变' },
  { material: 'clear', grade: 'G2-T', label: '完整透明液态玻璃' },
  { material: 'tinted', grade: 'G2-C', label: '完整彩色液态玻璃' }
] as const

// -- State and Variables
const dialogVisible = ref(false)
const selected = ref(false)
const activations = ref(0)
</script>

<template>
  <div class="glass-examples">
    <p>{{ $tSource('按住并拖动按钮查看形变，松手查看回弹；也可用 Tab、空格和 Enter 测试。') }}</p>
    <section
      v-for="grade in grades"
      :key="grade.material"
      class="glass-examples-grade"
      :aria-label="`${grade.grade} ${$tSource(grade.label)}`"
    >
      <h3>{{ grade.grade }} · {{ $tSource(grade.label) }}</h3>
      <div
        class="glass-examples-artwork"
        data-glass-artwork
      >
        <img
          :src="wallpaper"
          alt=""
        >
        <CommonButton
          :material="grade.material"
          :variant="grade.material === 'tinted' ? 'primary' : 'secondary'"
          size="prominent"
          @click="activations += 1"
        >
          <Play :size="16" />{{ $tSource('播放') }}
        </CommonButton>
        <CommonIconButton
          :material="grade.material"
          :variant="grade.material === 'tinted' ? 'primary' : 'secondary'"
          :label="$tSource('收藏')"
          :selected="selected"
          @click="selected = !selected"
        >
          <Heart
            :size="18"
            :fill="selected ? 'currentColor' : 'none'"
          />
        </CommonIconButton>
        <CommonButton
          :material="grade.material"
          :variant="grade.material === 'tinted' ? 'primary' : 'secondary'"
          disabled
        >
          {{ $tSource('已禁用') }}
        </CommonButton>
        <CommonButton
          :material="grade.material"
          :variant="grade.material === 'tinted' ? 'primary' : 'secondary'"
          loading
        >
          {{ $tSource('加载中') }}
        </CommonButton>
      </div>
    </section>
    <output>{{ $tSource('触发次数') }}: {{ activations }}</output>
    <CommonButton @click="dialogVisible = true">
      {{ $tSource('打开 G3 面板及分级按钮') }}
    </CommonButton>
    <CommonDialog
      :visible="dialogVisible"
      :title="$tSource('G3 液态玻璃面板')"
      @close="dialogVisible = false"
    >
      <p>{{ $tSource('面板使用 Dialog 材质，底部按钮使用面板作为背景。') }}</p>
      <template #actions>
        <CommonButton @click="dialogVisible = false">
          {{ $tSource('取消') }}
        </CommonButton>
        <CommonButton
          variant="primary"
          @click="dialogVisible = false"
        >
          {{ $tSource('确认') }}
        </CommonButton>
      </template>
    </CommonDialog>
  </div>
</template>

<style scoped>
.glass-examples {
  display: grid;
  gap: 16px;
}

.glass-examples-grade h3 {
  margin: 0 0 8px;
  font-size: 13px;
}

.glass-examples-artwork {
  position: relative;
  display: flex;
  min-height: 150px;
  align-items: center;
  flex-wrap: wrap;
  gap: 20px;
  padding: 28px;
  border-radius: var(--ncx-squircle-radius-lg);
  isolation: isolate;
}

.glass-examples-artwork > img {
  position: absolute;
  z-index: -1;
  inset: 0;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
</style>
