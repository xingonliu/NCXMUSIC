<script setup lang="ts">
import { ShieldAlert } from '@lucide/vue'
import { computed, onUnmounted, ref } from 'vue'

import type { ApprovalSnapshot } from '../../../../shared/schemas/agent'
import { CommonButton } from '../../../design-system/components'

// ========= 类型 =========

interface ApprovalCardProps {
  readonly approval: ApprovalSnapshot
}

interface ApprovalCardEmits {
  (event: 'approve', approvalId: string): void
  (event: 'reject', approvalId: string): void
}

const props = defineProps<ApprovalCardProps>()
const emit = defineEmits<ApprovalCardEmits>()

const now = ref<number>(Date.now())

const timer = setInterval(() => {
  now.value = Date.now()
}, 1_000)

const pending = computed<boolean>(() => props.approval.status === 'pending' && props.approval.expiresAt > now.value)

const remaining = computed<string>(() => {
  const seconds = Math.max(0, Math.ceil((props.approval.expiresAt - now.value) / 1_000))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
})

const terminalLabel = computed<string>(() => {
  const labels = { approved: 'APPROVED', rejected: 'REJECTED', expired: 'EXPIRED', cancelled: 'CANCELLED', pending: '' }
  return labels[props.approval.status]
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <article
    class="agent-approval-card"
    aria-label="操作审批"
  >
    <header>
      <ShieldAlert
        :size="16"
        :stroke-width="2"
      />
      <div>
        <strong>{{ approval.title }}</strong>
        <span v-if="pending">EXPIRES IN {{ remaining }}</span>
        <span v-else>STATUS: {{ terminalLabel }}</span>
      </div>
    </header>
    <dl>
      <div><dt>IMPACT</dt><dd>{{ approval.impact }}</dd></div>
      <div><dt>REASON</dt><dd>{{ approval.riskReason }}</dd></div>
    </dl>
    <footer v-if="pending">
      <CommonButton
        variant="secondary"
        size="compact"
        @click="emit('reject', approval.approvalId)"
      >
        拒绝 (Reject)
      </CommonButton>
      <CommonButton
        variant="primary"
        size="compact"
        @click="emit('approve', approval.approvalId)"
      >
        批准 (Approve)
      </CommonButton>
    </footer>
  </article>
</template>
