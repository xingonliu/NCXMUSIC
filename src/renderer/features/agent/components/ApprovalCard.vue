<script setup lang="ts">
import { ShieldAlert } from '@lucide/vue'
import { computed, onUnmounted, ref } from 'vue'

import type { ApprovalSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton } from '../../../design-system/components'

// ========= 类型 =========

/** ApprovalCard 输入。 */
interface ApprovalCardProps {
  /** Utility 权威审批快照。 */
  readonly approval: ApprovalSnapshot
}

/** ApprovalCard 输出。 */
interface ApprovalCardEmits {
  /** 用户仅批准当前 Tool Call。 */
  (event: 'approve', approvalId: string): void
  /** 用户明确拒绝当前 Tool Call。 */
  (event: 'reject', approvalId: string): void
}

// ========= 变量 =========

/** 审批卡输入。 */
const props = defineProps<ApprovalCardProps>()

/** 审批卡事件。 */
const emit = defineEmits<ApprovalCardEmits>()

/** 当前时间，用于轻量剩余时间。 */
const now = ref<number>(Date.now())

/** 每秒刷新一次剩余时间。 */
const timer = setInterval(() => {
  now.value = Date.now()
}, 1_000)

/** 审批是否仍可提交。 */
const pending = computed<boolean>(() => props.approval.status === 'pending' && props.approval.expiresAt > now.value)

/** 剩余分钟和秒。 */
const remaining = computed<string>(() => {
  /** 距审批过期的剩余秒数。 */
  const seconds = Math.max(0, Math.ceil((props.approval.expiresAt - now.value) / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

/** 审批终态文案。 */
const terminalLabel = computed<string>(() => {
  /** 审批终态中文标签。 */
  const labels = { approved: '已批准', rejected: '已拒绝', expired: '已过期', cancelled: '已取消', pending: '' }
  return labels[props.approval.status]
})

// ========= 生命周期 =========

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <article
    class="agent-approval-card"
    aria-label="操作审批"
  >
    <header>
      <span class="agent-approval-icon"><ShieldAlert
        :size="18"
        :stroke-width="1.9"
      /></span>
      <div>
        <strong>{{ approval.title }}</strong>
        <span v-if="pending">{{ remaining }} 后过期</span>
        <span v-else>{{ terminalLabel }}</span>
      </div>
    </header>
    <dl>
      <div><dt>影响</dt><dd>{{ approval.impact }}</dd></div>
      <div><dt>原因</dt><dd>{{ approval.riskReason }}</dd></div>
    </dl>
    <footer v-if="pending">
      <CommonButton
        variant="secondary"
        @click="emit('reject', approval.approvalId)"
      >
        拒绝
      </CommonButton>
      <CommonButton
        variant="primary"
        @click="emit('approve', approval.approvalId)"
      >
        批准
      </CommonButton>
    </footer>
  </article>
</template>
