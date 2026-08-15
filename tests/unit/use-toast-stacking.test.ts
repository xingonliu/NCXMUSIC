import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissToast, showToast, toastList, useToast } from '../../src/renderer/design-system/use-toast'

describe('use-toast 多通知有序堆叠服务', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    dismissToast()
  })

  it('频繁弹出通知时按顺序追加到 toastList 队列中', () => {
    expect(toastList.value).toHaveLength(0)

    const id1 = showToast('第一条通知', 'info')
    const id2 = showToast({ title: '第二条', message: '内容2', type: 'success' })
    const id3 = showToast('第三条通知', 'warning')

    expect(toastList.value).toHaveLength(3)
    const [t1, t2, t3] = toastList.value
    expect(t1?.id).toBe(id1)
    expect(t1?.message).toBe('第一条通知')
    expect(t2?.id).toBe(id2)
    expect(t2?.type).toBe('success')
    expect(t3?.id).toBe(id3)
    expect(t3?.type).toBe('warning')
  })

  it('点击特定 Toast 的关闭按钮能够精准从队列中移除该条通知', () => {
    const id1 = showToast('通知 1')
    const id2 = showToast('通知 2')
    const id3 = showToast('通知 3')

    expect(toastList.value).toHaveLength(3)

    // 单独移除中间的通知 2
    dismissToast(id2)

    expect(toastList.value).toHaveLength(2)
    expect(toastList.value.map((t) => t.id)).toEqual([id1, id3])
  })

  it('超出最大堆叠数时自动安全移除最旧的一条通知', () => {
    for (let i = 1; i <= 6; i++) {
      showToast(`通知 ${i}`)
    }

    expect(toastList.value).toHaveLength(5)
    expect(toastList.value[0]?.message).toBe('通知 2')
    expect(toastList.value[4]?.message).toBe('通知 6')
  })

  it('到期自动关闭单条通知', () => {
    showToast({ message: '短时通知', duration: 1000 })
    expect(toastList.value).toHaveLength(1)

    vi.advanceTimersByTime(1000)
    expect(toastList.value).toHaveLength(0)
  })

  it('useToast 提供便捷方法', () => {
    const toast = useToast()
    toast.success('操作成功')
    toast.danger('操作失败')

    expect(toastList.value).toHaveLength(2)
    expect(toastList.value[0]?.type).toBe('success')
    expect(toastList.value[1]?.type).toBe('danger')
  })
})
