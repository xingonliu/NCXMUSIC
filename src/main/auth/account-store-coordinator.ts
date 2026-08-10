import type { RuntimeStatus } from '../../shared/contracts/control-plane'
import {
  AccountStoreReadyEventSchema,
  type AccountStoreOpenCommand
} from '../../shared/contracts/account-store-control'
import type { AccountId } from '../../shared/schemas/account'

// ========= 类型 =========

/** Main 与 Utility 账户空间控制面所需的最小传输接口。 */
export interface AccountStoreControlTransport {
  /** 返回当前可用 Utility 代次。 */
  currentGeneration(): number | undefined
  /** 向当前 Utility 发送控制消息。 */
  postControl(message: AccountStoreOpenCommand): boolean
  /** 订阅 Utility 控制事件。 */
  onControlMessage(listener: (message: unknown) => void): () => void
  /** 订阅 Utility 生命周期状态。 */
  onStatus(listener: (status: RuntimeStatus) => void): () => void
}

/** 等待账户空间确认的请求。 */
interface PendingAccountStoreRequest {
  /** 发起请求时的 Utility 代次。 */
  utilityGeneration: number
  /** 请求成功回调。 */
  resolve: () => void
  /** 请求失败回调。 */
  reject: (error: Error) => void
  /** 有限等待计时器。 */
  timer: ReturnType<typeof setTimeout>
}

// ========= 类 =========

/** Main 侧账户空间协调器，只有收到 Utility ready 回执后才允许账户写操作。 */
export class AccountStoreCoordinator {
  /** 正在等待 Utility 回执的账户空间请求。 */
  private readonly pending = new Map<string, PendingAccountStoreRequest>()

  /** Utility 控制消息订阅清理函数。 */
  private readonly unsubscribeMessage: () => void

  /** Utility 状态订阅清理函数。 */
  private readonly unsubscribeStatus: () => void

  constructor(private readonly transport: AccountStoreControlTransport) {
    this.unsubscribeMessage = transport.onControlMessage((message) => this.handleMessage(message))
    this.unsubscribeStatus = transport.onStatus((status) => {
      if (status.state !== 'ready') this.rejectAll('Utility 在账户空间切换前退出。')
    })
  }

  /** 打开指定账户空间并等待 SQLite、迁移与 generation 全部生效。 */
  open(accountId: AccountId, accountGeneration: number): Promise<void> {
    /** 当前 Utility 代次。 */
    const utilityGeneration = this.transport.currentGeneration()
    if (!utilityGeneration) return Promise.reject(new Error('Utility is unavailable'))

    /** 账户空间切换请求 ID。 */
    const requestId = crypto.randomUUID()
    /** 类型化账户空间切换命令。 */
    const command: AccountStoreOpenCommand = {
      kind: 'account-store.open',
      requestId,
      accountId,
      accountGeneration
    }
    return new Promise((resolve, reject) => {
      /** 防止账户空间切换永久挂起的计时器。 */
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        reject(new Error('Utility account store open timed out'))
      }, 8_000)
      this.pending.set(requestId, { utilityGeneration, resolve, reject, timer })
      if (!this.transport.postControl(command)) {
        clearTimeout(timer)
        this.pending.delete(requestId)
        reject(new Error('Utility is unavailable'))
      }
    })
  }

  /** 释放订阅并拒绝尚未完成的账户空间请求。 */
  shutdown(): void {
    this.unsubscribeMessage()
    this.unsubscribeStatus()
    this.rejectAll('账户空间协调器已关闭。')
  }

  /** 处理 Utility 发回的账户空间完成事件。 */
  private handleMessage(message: unknown): void {
    /** 经 Schema 校验的账户空间事件。 */
    const parsed = AccountStoreReadyEventSchema.safeParse(message)
    if (!parsed.success) return
    /** 与事件对应的等待请求。 */
    const pending = this.pending.get(parsed.data.requestId)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(parsed.data.requestId)
    if (
      pending.utilityGeneration !== this.transport.currentGeneration() ||
      !parsed.data.accepted
    ) {
      pending.reject(new Error('Utility rejected the account store context'))
      return
    }
    pending.resolve()
  }

  /** 以统一原因拒绝全部在途请求。 */
  private rejectAll(message: string): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(message))
    }
    this.pending.clear()
  }
}
