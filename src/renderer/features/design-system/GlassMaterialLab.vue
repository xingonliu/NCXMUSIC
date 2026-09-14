<script setup lang="ts">
import { CommonButton, CommonDialog } from '../../design-system/components'
import { ref } from 'vue'

// -- State

const dialogVisible = ref(false)
</script>

<template>
  <div class="ncx-glass-lab">
    <div class="ncx-glass-lab-stage">
      <CommonButton material="clear">
        {{ $tSource("完整透明") }}
      </CommonButton>
      <CommonButton
        material="clear"
        frost
      >
        {{ $tSource("完整磨砂") }}
      </CommonButton>
      <CommonButton
        variant="primary"
        material="tinted"
      >
        {{ $tSource("完整带色") }}
      </CommonButton>
      <CommonButton
        variant="primary"
        material="blur"
      >
        {{ $tSource("不完整带色") }}
      </CommonButton>
      <CommonButton material="blur">
        {{ $tSource("不完整按钮") }}
      </CommonButton>
      <CommonButton
        variant="primary"
        @click="dialogVisible = true"
      >
        {{ $tSource("打开面板弹窗") }}
      </CommonButton>
    </div>
    <CommonDialog
      :visible="dialogVisible"
      :title="$tSource('面板玻璃')"
      @close="dialogVisible = false"
    >
      <p>{{ $tSource("弹窗与主导航侧栏使用 Dialog 面板光学：blur 16 / height 24 / amount 48。") }}</p>
      <template #actions>
        <CommonButton
          variant="secondary"
          material="clear"
          frost
          @click="dialogVisible = false"
        >
          {{ $tSource("取消") }}
        </CommonButton>
        <CommonButton
          variant="primary"
          material="tinted"
          @click="dialogVisible = false"
        >
          {{ $tSource("确定") }}
        </CommonButton>
      </template>
    </CommonDialog>
  </div>
</template>

<style scoped>
.ncx-glass-lab-stage {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  padding: 28px 20px;
  border-radius: var(--ncx-squircle-radius-xl);
  background:
    radial-gradient(120% 80% at 12% 10%, #c8f0ff, transparent 58%),
    radial-gradient(90% 70% at 82% 18%, #3b7cff, transparent 55%),
    radial-gradient(80% 90% at 70% 88%, #2aa0ff, transparent 50%),
    linear-gradient(160deg, #c8f0ff 0%, #7ad8c8 46%, #1a6bff 100%);
  -electron-corner-smoothing: var(--ncx-squircle-smoothing);
}
</style>
