import {
  SelectionEntitySchema,
  type SelectionSnapshot
} from '../../shared/schemas/agent'

// ========= 类型 =========

/** 模型选择工具的安全输入选项。 */
export type SelectionRequestOption =
  | { readonly kind: 'entity'; readonly optionKey: string; readonly entityRef: string }
  | { readonly kind: 'text'; readonly optionKey: string; readonly label: string; readonly description?: string }

/** 选择请求输入。 */
export interface SelectionRequest {
  /** 所属 Tool Call。 */
  readonly toolCallId: string
  /** 用户要回答的问题。 */
  readonly prompt: string
  /** 单选或多选。 */
  readonly mode: 'single' | 'multiple'
  /** 2～5 个选项。 */
  readonly options: readonly SelectionRequestOption[]
}

/** 选择结果。 */
export type SelectionOutcome =
  | {
      readonly status: 'selected'
      readonly selectedOptionKeys: readonly string[]
      readonly selectedRefs: readonly string[]
    }
  | { readonly status: 'cancelled' }
  | { readonly status: 'expired' }

/** 选择协调器依赖。 */
export interface SelectionCoordinatorOptions {
  /** 从 Runtime 本轮事实池解析实体引用。 */
  readonly resolveEntity: (entityRef: string) => unknown
  /** 时间来源。 */
  readonly now?: () => number
  /** 固定等待时长。 */
  readonly ttlMs?: number
  /** 快照改变通知。 */
  readonly onChange?: (snapshot: SelectionSnapshot) => void
}

/** 内部待决选择。 */
interface PendingSelection {
  /** 当前公开快照。 */
  snapshot: SelectionSnapshot
  /** 完成 Promise。 */
  resolve: (outcome: SelectionOutcome) => void
  /** 固定过期计时器。 */
  timer: ReturnType<typeof setTimeout>
}

// ========= 变量 =========

/** SelectionCard 固定有效期。 */
export const SELECTION_TTL_MS = 10 * 60 * 1_000

// ========= 类 =========

/** 保证 SelectionCard 无副作用、单活动实例与确定性终态。 */
export class SelectionCoordinator {
  /** 当前唯一待决选择。 */
  private pending: PendingSelection | undefined

  /** 时间来源。 */
  private readonly now: () => number

  /** 固定有效期。 */
  private readonly ttlMs: number

  constructor(private readonly options: SelectionCoordinatorOptions) {
    this.now = options.now ?? Date.now
    this.ttlMs = options.ttlMs ?? SELECTION_TTL_MS
  }

  /** 创建无副作用选择；同时只允许一个活动请求。 */
  request(input: SelectionRequest): { snapshot: SelectionSnapshot; outcome: Promise<SelectionOutcome> } {
    if (this.pending) throw Object.assign(new Error('已有活动选择请求。'), { code: 'SELECTION_ALREADY_PENDING' })
    /** 安全展示选项。 */
    const options = input.options.map((option) => {
      if (option.kind === 'text') {
        return {
          kind: 'text' as const,
          optionKey: option.optionKey,
          label: option.label,
          ...(option.description ? { description: option.description } : {})
        }
      }
      /** 从事实池读取的实体，不信任模型提供展示字段。 */
      const entity = SelectionEntitySchema.parse(this.options.resolveEntity(option.entityRef))
      return { kind: 'entity' as const, optionKey: option.optionKey, entity }
    })
    /** 选项 key 去重集合。 */
    const uniqueKeys = new Set(options.map((option) => option.optionKey))
    if (options.length < 2 || options.length > 5 || uniqueKeys.size !== options.length) {
      throw Object.assign(new Error('选择项必须为 2～5 个且 optionKey 唯一。'), { code: 'INVALID_SELECTION' })
    }
    /** 公开选择快照。 */
    const snapshot: SelectionSnapshot = {
      selectionId: crypto.randomUUID(),
      toolCallId: input.toolCallId,
      prompt: input.prompt,
      mode: input.mode,
      options,
      selectedOptionKeys: [],
      expiresAt: this.now() + this.ttlMs,
      status: 'pending'
    }
    /** 待决结果 Promise。 */
    const outcome = new Promise<SelectionOutcome>((resolve) => {
      /** 固定十分钟过期任务。 */
      const timer = setTimeout(() => this.finish({ status: 'expired' }), this.ttlMs)
      this.pending = { snapshot, resolve, timer }
    })
    this.options.onChange?.(snapshot)
    return { snapshot, outcome }
  }

  /** 提交选择；非法 key、重复提交和单选多值均拒绝。 */
  respond(selectionId: string, selectedOptionKeys: readonly string[]): boolean {
    /** 当前待决选择。 */
    const pending = this.pending
    if (!pending || pending.snapshot.selectionId !== selectionId) return false
    /** 合法 key 集合。 */
    const allowed = new Set(pending.snapshot.options.map((option) => option.optionKey))
    /** 去重后的用户选择。 */
    const selected = [...new Set(selectedOptionKeys)]
    if (selected.length === 0 || selected.some((key) => !allowed.has(key))) return false
    if (pending.snapshot.mode === 'single' && selected.length !== 1) return false
    /** 用户选择中由 Runtime 事实池解析出的实体引用。 */
    const selectedRefs = pending.snapshot.options
      .filter((option) => option.kind === 'entity' && selected.includes(option.optionKey))
      .map((option) => option.kind === 'entity' ? `${option.entity.kind}:${option.entity.id}` : '')
    return this.finish({ status: 'selected', selectedOptionKeys: selected, selectedRefs })
  }

  /** 用户取消活动选择。 */
  cancel(selectionId: string): boolean {
    return this.pending?.snapshot.selectionId === selectionId
      ? this.finish({ status: 'cancelled' })
      : false
  }

  /** Turn 生命周期取消活动选择。 */
  cancelActive(): void {
    if (this.pending) this.finish({ status: 'cancelled' })
  }

  /** 将选择推进到唯一终态。 */
  private finish(outcome: SelectionOutcome): boolean {
    /** 待完成选择。 */
    const pending = this.pending
    if (!pending) return false
    clearTimeout(pending.timer)
    this.pending = undefined
    pending.snapshot = {
      ...pending.snapshot,
      status: outcome.status,
      selectedOptionKeys: outcome.status === 'selected' ? [...outcome.selectedOptionKeys] : []
    }
    this.options.onChange?.(pending.snapshot)
    pending.resolve(outcome)
    return true
  }
}
