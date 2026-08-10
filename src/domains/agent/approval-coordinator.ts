import type { ApprovalSnapshot } from '../../shared/schemas/agent'

// ========= 类型 =========

/** 审批请求输入。 */
export interface ApprovalRequest {
  /** 所属 Tool Call。 */
  readonly toolCallId: string
  /** 用户可理解的动作标题。 */
  readonly title: string
  /** 影响对象摘要。 */
  readonly impact: string
  /** 需要逐次审批的原因。 */
  readonly riskReason: string
}

/** 审批终态。 */
export type ApprovalOutcome = 'approved' | 'rejected' | 'expired' | 'cancelled'

/** 审批协调器依赖。 */
export interface ApprovalCoordinatorOptions {
  /** 当前时间，测试可注入。 */
  readonly now?: () => number
  /** 审批有效期，产品固定五分钟。 */
  readonly ttlMs?: number
  /** 快照改变通知。 */
  readonly onChange?: (snapshot: ApprovalSnapshot) => void
}

/** 内部待决审批。 */
interface PendingApproval {
  /** 当前公开快照。 */
  snapshot: ApprovalSnapshot
  /** 完成 Promise。 */
  resolve: (outcome: ApprovalOutcome) => void
  /** 固定过期计时器。 */
  timer: ReturnType<typeof setTimeout>
}

// ========= 变量 =========

/** ApprovalCard 固定有效期。 */
export const APPROVAL_TTL_MS = 5 * 60 * 1_000

// ========= 类 =========

/** 管理单 Tool Call 逐次授权，拒绝/过期/取消均保证零执行。 */
export class ApprovalCoordinator {
  /** 当前待决审批。 */
  private readonly pending = new Map<string, PendingApproval>()

  /** 时间来源。 */
  private readonly now: () => number

  /** 固定有效期。 */
  private readonly ttlMs: number

  constructor(private readonly options: ApprovalCoordinatorOptions = {}) {
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? APPROVAL_TTL_MS
  }

  /** 创建一次只授权当前 Tool Call 的审批。 */
  request(input: ApprovalRequest): { snapshot: ApprovalSnapshot; outcome: Promise<ApprovalOutcome> } {
    /** 新审批 ID。 */
    const approvalId = crypto.randomUUID()
    /** 审批公开快照。 */
    const snapshot: ApprovalSnapshot = {
      approvalId,
      toolCallId: input.toolCallId,
      title: input.title,
      impact: input.impact,
      riskReason: input.riskReason,
      expiresAt: this.now() + this.ttlMs,
      status: 'pending'
    }
    /** 待决结果 Promise。 */
    const outcome = new Promise<ApprovalOutcome>((resolve) => {
      /** 固定五分钟过期任务。 */
      const timer = setTimeout(() => this.finish(approvalId, 'expired'), this.ttlMs)
      this.pending.set(approvalId, { snapshot, resolve, timer })
    })
    this.options.onChange?.(snapshot)
    return { snapshot, outcome }
  }

  /** 处理 Renderer 的批准或拒绝，重复提交返回 false。 */
  respond(approvalId: string, decision: 'approve' | 'reject'): boolean {
    return this.finish(approvalId, decision === 'approve' ? 'approved' : 'rejected')
  }

  /** 取消当前 Turn 的全部待决审批。 */
  cancelAll(): void {
    for (const approvalId of [...this.pending.keys()]) this.finish(approvalId, 'cancelled')
  }

  /** 返回仍有效的审批快照。 */
  snapshots(): ApprovalSnapshot[] {
    return [...this.pending.values()].map((item) => item.snapshot)
  }

  /** 将审批推进到唯一终态。 */
  private finish(approvalId: string, outcome: ApprovalOutcome): boolean {
    /** 待完成审批。 */
    const pending = this.pending.get(approvalId)
    if (!pending) return false
    clearTimeout(pending.timer)
    this.pending.delete(approvalId)
    pending.snapshot = { ...pending.snapshot, status: outcome }
    this.options.onChange?.(pending.snapshot)
    pending.resolve(outcome)
    return true
  }
}
