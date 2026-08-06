import { describe, expect, it } from 'vitest'

import { QueueController } from '../../src/domains/player/queue-controller'
import type { QueueItem, QueueSource, TrackSummary } from '../../src/domains/player/types'

// ─────────────────────────────────────────────────────────────────────────────
// 测试夹具区
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE: QueueSource = { kind: 'search' }

/** 构造确定性曲目摘要 */
function track(id: string): TrackSummary {
  return {
    trackId: id,
    name: `曲目 ${id}`,
    artists: ['演唱者'],
    album: '专辑',
    durationMs: 200_000
  }
}

/**
 * 构造使用确定性 ID 与可控随机源的队列控制器。
 *
 * @param randomValues 依次返回的随机数；耗尽后回退到 0
 */
function createController(randomValues: number[] = []): QueueController {
  let idSeed = 0
  let randomIndex = 0
  return new QueueController({
    createId: () => `q${(idSeed += 1)}`,
    random: () => randomValues[randomIndex++] ?? 0,
    now: () => 1_700_000_000_000
  })
}

/** 用给定曲目 ID 建立队列并返回控制器 */
function withQueue(ids: string[], randomValues: number[] = []): QueueController {
  const controller = createController(randomValues)
  controller.replaceAndPlay({ tracks: ids.map(track), source: SOURCE })
  return controller
}

/** 读取队列中的 trackId 顺序 */
function trackOrder(controller: QueueController): string[] {
  return controller.getSnapshot().items.map((item) => item.track.trackId)
}

/** 当前播放项的 trackId */
function currentTrackId(controller: QueueController): string | null {
  return controller.getCurrentItem()?.track.trackId ?? null
}

// ─────────────────────────────────────────────────────────────────────────────
// 建立队列
// ─────────────────────────────────────────────────────────────────────────────

describe('QueueController 建立队列', () => {
  it('歌单播放整体替换队列并从指定项开始', () => {
    const controller = createController()
    const effect = controller.replaceAndPlay({
      tracks: ['a', 'b', 'c'].map(track),
      source: { kind: 'playlist', playlistId: '77' },
      startIndex: 1
    })

    expect(trackOrder(controller)).toEqual(['a', 'b', 'c'])
    expect(effect.nextItem?.track.trackId).toBe('b')
    expect(effect.autoplay).toBe(true)
    expect(effect.changed).toBe(true)
  })

  it('startIndex 越界时回退到第一项', () => {
    const controller = createController()
    const effect = controller.replaceAndPlay({
      tracks: ['a', 'b'].map(track),
      source: SOURCE,
      startIndex: 9
    })

    expect(effect.nextItem?.track.trackId).toBe('a')
  })

  it('空歌单不产生播放项', () => {
    const controller = createController()
    const effect = controller.replaceAndPlay({ tracks: [], source: SOURCE })

    expect(effect.nextItem).toBeNull()
    expect(effect.autoplay).toBe(false)
    expect(controller.getSnapshot().currentItemId).toBeNull()
  })

  it('单曲点播插入当前项之后并立即切换，且不删除既有项', () => {
    const controller = withQueue(['a', 'b', 'c'])
    controller.next('manual') // 当前为 b

    const inserted = controller.createItem(track('x'), { kind: 'agent' })
    const effect = controller.insertAndPlay(inserted)

    expect(trackOrder(controller)).toEqual(['a', 'b', 'x', 'c'])
    expect(effect.nextItem?.track.trackId).toBe('x')
    expect(currentTrackId(controller)).toBe('x')
  })

  it('下一首播放插入当前项之后但不改变当前播放', () => {
    const controller = withQueue(['a', 'b'])
    const items = [track('x'), track('y')].map((item) => controller.createItem(item, SOURCE))
    const effect = controller.playNext(items)

    expect(trackOrder(controller)).toEqual(['a', 'x', 'y', 'b'])
    expect(effect.nextItem).toBeNull()
    expect(currentTrackId(controller)).toBe('a')
  })

  it('追加入队放到末尾且不改变当前播放', () => {
    const controller = withQueue(['a', 'b'])
    const effect = controller.enqueue([controller.createItem(track('z'), SOURCE)])

    expect(trackOrder(controller)).toEqual(['a', 'b', 'z'])
    expect(effect.nextItem).toBeNull()
    expect(currentTrackId(controller)).toBe('a')
  })

  it('空入队不递增 revision', () => {
    const controller = withQueue(['a'])
    const before = controller.getSnapshot().revision
    const effect = controller.enqueue([])

    expect(effect.changed).toBe(false)
    expect(controller.getSnapshot().revision).toBe(before)
  })

  it('同一曲目可重复入队并靠 queueItemId 区分', () => {
    const controller = withQueue(['a'])
    controller.enqueue([controller.createItem(track('a'), SOURCE)])
    const items = controller.getSnapshot().items

    expect(items).toHaveLength(2)
    expect(items[0]?.track.trackId).toBe(items[1]?.track.trackId)
    expect(items[0]?.queueItemId).not.toBe(items[1]?.queueItemId)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 删除与上一首
// ─────────────────────────────────────────────────────────────────────────────

describe('QueueController 删除语义', () => {
  it('删除当前项切换到删除后占据同一位置的项', () => {
    const controller = withQueue(['a', 'b', 'c'])
    controller.next('manual') // 当前为 b
    const currentId = controller.getSnapshot().currentItemId

    const effect = controller.remove(currentId as string)

    expect(trackOrder(controller)).toEqual(['a', 'c'])
    // b 原本在下标 1，删除后下标 1 是 c
    expect(effect.nextItem?.track.trackId).toBe('c')
    expect(effect.autoplay).toBe(true)
  })

  it('删除末项时当前项回到第一项', () => {
    const controller = withQueue(['a', 'b', 'c'])
    controller.next('manual')
    controller.next('manual') // 当前为 c（末项）
    const currentId = controller.getSnapshot().currentItemId

    const effect = controller.remove(currentId as string)

    expect(trackOrder(controller)).toEqual(['a', 'b'])
    expect(effect.nextItem?.track.trackId).toBe('a')
  })

  it('删除当前项的规则优先于 loop-one', () => {
    const controller = withQueue(['a', 'b'])
    controller.setMode('loop-one')
    const currentId = controller.getSnapshot().currentItemId

    const effect = controller.remove(currentId as string)

    // loop-one 不应让它重播已删除的 a
    expect(effect.nextItem?.track.trackId).toBe('b')
  })

  it('删除非当前项不触发切歌', () => {
    const controller = withQueue(['a', 'b', 'c'])
    const items = controller.getSnapshot().items
    const effect = controller.remove(items[2]?.queueItemId as string)

    expect(effect.nextItem).toBeNull()
    expect(effect.changed).toBe(true)
    expect(currentTrackId(controller)).toBe('a')
  })

  it('删除唯一项进入空队列并停止', () => {
    const controller = withQueue(['a'])
    const currentId = controller.getSnapshot().currentItemId

    const effect = controller.remove(currentId as string)

    expect(effect.nextItem).toBeNull()
    expect(controller.getSnapshot().items).toHaveLength(0)
    expect(controller.getSnapshot().currentItemId).toBeNull()
  })

  it('删除不存在的项不改变队列', () => {
    const controller = withQueue(['a', 'b'])
    const before = controller.getSnapshot().revision
    const effect = controller.remove('不存在')

    expect(effect.changed).toBe(false)
    expect(controller.getSnapshot().revision).toBe(before)
  })

  it('clear 停止播放并清空当前项', () => {
    const controller = withQueue(['a', 'b'])
    const effect = controller.clear()

    expect(effect.nextItem).toBeNull()
    expect(effect.changed).toBe(true)
    expect(controller.getSnapshot().items).toHaveLength(0)
    expect(controller.getSnapshot().currentItemId).toBeNull()
  })

  it('previous 始终切歌，不做时长判断', () => {
    const controller = withQueue(['a', 'b', 'c'])
    controller.next('manual') // 当前为 b

    const effect = controller.previous()

    expect(effect.nextItem?.track.trackId).toBe('a')
    expect(effect.autoplay).toBe(true)
  })

  it('在第一项 previous 回到末项', () => {
    const controller = withQueue(['a', 'b', 'c'])
    const effect = controller.previous()

    expect(effect.nextItem?.track.trackId).toBe('c')
  })

  it('reorder 移动队列项并裁剪越界下标', () => {
    const controller = withQueue(['a', 'b', 'c'])
    const items = controller.getSnapshot().items
    controller.reorder(items[0]?.queueItemId as string, 99)

    expect(trackOrder(controller)).toEqual(['b', 'c', 'a'])
  })

  it('reorder 到原位不递增 revision', () => {
    const controller = withQueue(['a', 'b'])
    const items = controller.getSnapshot().items
    const before = controller.getSnapshot().revision
    const effect = controller.reorder(items[0]?.queueItemId as string, 0)

    expect(effect.changed).toBe(false)
    expect(controller.getSnapshot().revision).toBe(before)
  })

  it('selectItem 直接选中且不改动队列结构', () => {
    const controller = withQueue(['a', 'b', 'c'])
    const items = controller.getSnapshot().items
    const effect = controller.selectItem(items[2]?.queueItemId as string)

    expect(effect.nextItem?.track.trackId).toBe('c')
    expect(effect.autoplay).toBe(true)
    expect(trackOrder(controller)).toEqual(['a', 'b', 'c'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 播放模式
// ─────────────────────────────────────────────────────────────────────────────

describe('QueueController 播放模式', () => {
  it('loop 模式末项 ended 回到第一项', () => {
    const controller = withQueue(['a', 'b'])
    controller.next('manual') // 当前为 b（末项）

    const effect = controller.next('ended')

    expect(effect.nextItem?.track.trackId).toBe('a')
  })

  it('loop-one 模式 ended 重播当前项', () => {
    const controller = withQueue(['a', 'b'])
    controller.setMode('loop-one')

    const effect = controller.next('ended')

    expect(effect.nextItem?.track.trackId).toBe('a')
    expect(effect.autoplay).toBe(true)
    expect(currentTrackId(controller)).toBe('a')
  })

  it('loop-one 模式手动 next 跳到下一项', () => {
    const controller = withQueue(['a', 'b'])
    controller.setMode('loop-one')

    const effect = controller.next('manual')

    expect(effect.nextItem?.track.trackId).toBe('b')
  })

  it('切入 shuffle 立即洗牌并从新首项播放', () => {
    // random 序列驱动 Fisher–Yates：i=3 → j=0，i=2 → j=0，i=1 → j=0
    const controller = withQueue(['a', 'b', 'c', 'd'], [0, 0, 0])
    const effect = controller.setMode('shuffle')

    expect(effect.changed).toBe(true)
    expect(effect.nextItem).not.toBeNull()
    // 新首项即为当前项
    expect(effect.nextItem?.queueItemId).toBe(controller.getSnapshot().items[0]?.queueItemId)
    expect(controller.getSnapshot().mode).toBe('shuffle')
  })

  it('洗牌只保留一份队列且不丢失任何曲目', () => {
    const controller = withQueue(['a', 'b', 'c', 'd', 'e'], [0.9, 0.1, 0.7, 0.3])
    controller.setMode('shuffle')

    expect(trackOrder(controller).toSorted()).toEqual(['a', 'b', 'c', 'd', 'e'])
    expect(controller.getSnapshot().items).toHaveLength(5)
  })

  it('切回 loop 不恢复洗牌前顺序', () => {
    const controller = withQueue(['a', 'b', 'c', 'd'], [0, 0, 0])
    controller.setMode('shuffle')
    const shuffled = trackOrder(controller)

    controller.setMode('loop')

    expect(trackOrder(controller)).toEqual(shuffled)
  })

  it('shuffle 末项 ended 重新洗牌且避免上一轮末项成为新首项', () => {
    // 队列多于一项时应用避让规则
    const controller = withQueue(['a', 'b', 'c', 'd'], [0, 0, 0])
    controller.setMode('shuffle')

    // 前进到末项
    controller.next('manual')
    controller.next('manual')
    controller.next('manual')
    const lastId = controller.getSnapshot().items[3]?.queueItemId

    const effect = controller.next('ended')

    expect(effect.changed).toBe(true)
    expect(controller.getSnapshot().items[0]?.queueItemId).not.toBe(lastId)
    expect(effect.nextItem?.queueItemId).toBe(controller.getSnapshot().items[0]?.queueItemId)
  })

  it('setMode 传入相同模式不产生变更', () => {
    const controller = withQueue(['a'])
    const before = controller.getSnapshot().revision
    const effect = controller.setMode('loop')

    expect(effect.changed).toBe(false)
    expect(controller.getSnapshot().revision).toBe(before)
  })

  it('空队列 next 返回停止指令', () => {
    const controller = createController()
    const effect = controller.next('manual')

    expect(effect.nextItem).toBeNull()
    expect(effect.autoplay).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 错误策略
// ─────────────────────────────────────────────────────────────────────────────

describe('QueueController 错误策略', () => {
  it('error-policy 跳过失败项前进到下一首', () => {
    const controller = withQueue(['a', 'b', 'c'])
    const effect = controller.next('error-policy')

    expect(effect.nextItem?.track.trackId).toBe('b')
  })

  it('全部项失败后停止，不进入无限跳转', () => {
    const controller = withQueue(['a', 'b'])

    const first = controller.next('error-policy')
    expect(first.nextItem?.track.trackId).toBe('b')

    const second = controller.next('error-policy')
    expect(second.nextItem).toBeNull()
    expect(second.autoplay).toBe(false)
  })

  it('error-policy 跳过已记录失败的项', () => {
    const controller = withQueue(['a', 'b', 'c'])
    controller.next('error-policy') // a 失败 → b

    const effect = controller.next('error-policy') // b 失败 → c（跳过 a）

    expect(effect.nextItem?.track.trackId).toBe('c')
  })

  it('markPlaybackSucceeded 清空失败集合', () => {
    const controller = withQueue(['a', 'b'])
    controller.next('error-policy') // a 记为失败
    controller.markPlaybackSucceeded()

    // 失败集合已清空，b 失败后可以重新尝试 a
    const effect = controller.next('error-policy')

    expect(effect.nextItem?.track.trackId).toBe('a')
  })

  it('队列结构变更清空失败集合', () => {
    const controller = withQueue(['a', 'b'])
    controller.next('error-policy') // a 记为失败

    controller.enqueue([controller.createItem(track('c'), SOURCE)])
    controller.selectItem(controller.getSnapshot().items[0]?.queueItemId as string)
    const effect = controller.next('error-policy')

    // selectItem 已清空失败集合，从 a 前进到 b
    expect(effect.nextItem?.track.trackId).toBe('b')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 快照与 revision
// ─────────────────────────────────────────────────────────────────────────────

describe('QueueController 快照', () => {
  it('getSnapshot 返回副本，外部修改不影响内部状态', () => {
    const controller = withQueue(['a', 'b'])
    const snapshot = controller.getSnapshot()
    snapshot.items.push(controller.createItem(track('x'), SOURCE))

    expect(controller.getSnapshot().items).toHaveLength(2)
  })

  it('每次结构变更递增 revision', () => {
    const controller = createController()
    expect(controller.getSnapshot().revision).toBe(0)

    controller.replaceAndPlay({ tracks: [track('a')], source: SOURCE })
    expect(controller.getSnapshot().revision).toBe(1)

    controller.enqueue([controller.createItem(track('b'), SOURCE)])
    expect(controller.getSnapshot().revision).toBe(2)
  })

  it('队列项记录来源与入队时间', () => {
    const controller = createController()
    controller.replaceAndPlay({
      tracks: [track('a')],
      source: { kind: 'playlist', playlistId: '42' }
    })
    const item = controller.getSnapshot().items[0] as QueueItem

    expect(item.source).toEqual({ kind: 'playlist', playlistId: '42' })
    expect(item.addedAt).toBe(1_700_000_000_000)
  })
})
