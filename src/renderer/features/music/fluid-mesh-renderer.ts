import { Application, Container, Graphics, Sprite, Texture, type Ticker } from 'pixi.js'
import { AdjustmentFilter } from 'pixi-filters/adjustment'
import { KawaseBlurFilter } from 'pixi-filters/kawase-blur'
import { TwistFilter } from 'pixi-filters/twist'

// ========= 类型 =========

/** Apple Music 网页端单层封面纹理的动画参数。 */
export interface AppleMusicArtworkLayerFrame {
  /** 图层中心横坐标，单位为渲染像素。 */
  centerX: number
  /** 图层中心纵坐标，单位为渲染像素。 */
  centerY: number
  /** 方形图层边长，单位为渲染像素。 */
  size: number
  /** 图层最终显示的顺时针旋转角，单位为弧度。 */
  rotation: number
}

/** 三个可被快速重定向的封面组在当前画面中的混合权重。 */
export type AppleMusicArtworkWeights = readonly [number, number, number]

/** Apple Music 网页端背景单个封面图层的固定动画配置。 */
interface AppleMusicArtworkLayerSpec {
  /** 图层边长相对视口宽度的比例。 */
  sizeRatio: number
  /** Apple 运动相位每秒变化的弧度。 */
  phaseSpeed: number
  /** 静态中心横坐标相对视口宽度的比例。 */
  centerXRatio: number
  /** 静态中心纵坐标相对视口高度的比例。 */
  centerYRatio: number
  /** 额外纵向偏移相对视口宽度的比例。 */
  centerYOffsetWidthRatio: number
  /** 环形轨道半径相对视口宽度的比例。 */
  orbitRadiusRatio: number
  /** 轨道角速度相对运动相位的倍率。 */
  orbitSpeedRatio: number
  /** 是否反转 Sprite 自转方向。 */
  reverseSpriteRotation: boolean
}

/** 单个可交叉淡化的封面组。 */
interface ArtworkSlot {
  /** 承载四层同源 Sprite 的容器。 */
  container: Container
  /** 与 Apple Music 网页端一致的四层同源 Sprite。 */
  sprites: readonly [Sprite, Sprite, Sprite, Sprite]
  /** 当前槽独占的封面纹理。 */
  texture: Texture | undefined
}

// ========= Apple Music 网页端参数 =========

/**
 * Apple Music 网页歌词场景打包代码中核验到的固定参数。
 * 这些值只描述 Apple 基线；NcxMusic 保留的增强参数单独列在下方。
 */
export const APPLE_MUSIC_WEB_BACKGROUND_CONFIG = {
  maximumFps: 15,
  artworkTransitionMs: 1_667,
  saturation: 2.75,
  brightness: 0.7,
  contrast: 1.9,
  twistAngle: -3.25,
  twistRadius: 900,
  kawaseFilters: [
    { strength: 5, quality: 1 },
    { strength: 10, quality: 1 },
    { strength: 20, quality: 2 },
    { strength: 40, quality: 2 },
    { strength: 80, quality: 2 }
  ],
  layerSizeRatios: [1.25, 0.8, 0.5, 0.25],
  layerPhaseSpeeds: [0.09, -0.24, -0.18, 0.12]
} as const

/** NcxMusic 在 Apple 基线上保留的交互、音频和快速切歌优化。 */
export const NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS = {
  motionTransitionMs: 1_200,
  reducedMotionArtworkTransitionMs: 180,
  lowFrequencyScalePulse: 0.1,
  lowFrequencyRotationPulse: 0.2,
  lowFrequencyTwistPulse: 0.04,
  audioAttackMs: 65,
  audioReleaseMs: 240,
  maximumClockDeltaMs: 100
} as const

/** 四层封面纹理的尺寸、转速、自转方向和轨道配置。 */
const ARTWORK_LAYER_SPECS: readonly AppleMusicArtworkLayerSpec[] = [
  {
    sizeRatio: 1.25,
    phaseSpeed: 0.09,
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    centerYOffsetWidthRatio: 0,
    orbitRadiusRatio: 0,
    orbitSpeedRatio: 0,
    reverseSpriteRotation: false
  },
  {
    sizeRatio: 0.8,
    phaseSpeed: -0.24,
    centerXRatio: 0.4,
    centerYRatio: 0.4,
    centerYOffsetWidthRatio: 0,
    orbitRadiusRatio: 0,
    orbitSpeedRatio: 0,
    reverseSpriteRotation: false
  },
  {
    sizeRatio: 0.5,
    phaseSpeed: -0.18,
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    centerYOffsetWidthRatio: 0,
    orbitRadiusRatio: 0.25,
    orbitSpeedRatio: 0.75,
    reverseSpriteRotation: true
  },
  {
    sizeRatio: 0.25,
    phaseSpeed: 0.12,
    centerXRatio: 0.55,
    centerYRatio: 0.5,
    centerYOffsetWidthRatio: 0.05,
    orbitRadiusRatio: 0.25,
    orbitSpeedRatio: 0.75,
    reverseSpriteRotation: true
  }
]

/** 三槽中每个槽包含的 Sprite 数量。 */
const SPRITES_PER_ARTWORK = 4

/** 判断浮点权重是否可以视为完全不可见的阈值。 */
const INVISIBLE_WEIGHT_THRESHOLD = 0.0001

// ========= 纯函数 =========

/** 把数值限制到 0～1。 */
function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** 播放和暂停速度过渡使用的平滑起停曲线。 */
function smoothTransitionProgress(progress: number): number {
  /** 限制后的线性进度。 */
  const amount = clampUnit(progress)
  return amount * amount * (3 - 2 * amount)
}

/**
 * 计算指定动画时刻的四层封面位置。
 *
 * 大层直接使用 Apple 相位，小层反转自转但仍用原相位公转；第四层纵向偏移
 * 以视口宽度为基准，这是实际网页代码与常见复刻实现容易混淆的细节。
 *
 * @param width 当前渲染宽度
 * @param height 当前渲染高度
 * @param elapsedSeconds 连续动画时间
 * @param audioEnergy 50～120 Hz 低频能量
 */
export function createAppleMusicArtworkLayerFrames(
  width: number,
  height: number,
  elapsedSeconds: number,
  audioEnergy = 0
): readonly AppleMusicArtworkLayerFrame[] {
  /** 限制后的低频能量。 */
  const energy = clampUnit(audioEnergy)
  /** NcxMusic 保留的鼓点缩放脉冲。 */
  const sizePulse = 1 + energy
    * NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.lowFrequencyScalePulse
  /** NcxMusic 保留的鼓点相位脉冲。 */
  const rotationPulse = energy
    * NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.lowFrequencyRotationPulse

  return ARTWORK_LAYER_SPECS.map((spec) => {
    /** 当前图层未经自转方向修正的 Apple 运动相位。 */
    const phase = elapsedSeconds * spec.phaseSpeed + rotationPulse
    /** 小图层沿圆形轨道移动时使用的相位。 */
    const orbitAngle = phase * spec.orbitSpeedRatio
    /** 当前图层的轨道半径。 */
    const orbitRadius = width * spec.orbitRadiusRatio
    /** Apple 对两张小 Sprite 使用与相位相反的自转方向。 */
    const rotation = spec.reverseSpriteRotation ? -phase : phase

    return {
      centerX: width * spec.centerXRatio + Math.cos(orbitAngle) * orbitRadius,
      centerY: height * spec.centerYRatio
        + width * spec.centerYOffsetWidthRatio
        + Math.sin(orbitAngle) * orbitRadius,
      size: width * spec.sizeRatio * sizePulse,
      rotation
    }
  })
}

/**
 * 在三组封面权重之间执行 Apple 同款线性插值。
 *
 * @param from 当前屏幕权重
 * @param to 新封面目标权重
 * @param progress 归一化过渡进度
 */
export function interpolateAppleMusicArtworkWeights(
  from: AppleMusicArtworkWeights,
  to: AppleMusicArtworkWeights,
  progress: number
): AppleMusicArtworkWeights {
  /** Apple 切歌淡化使用的线性进度。 */
  const amount = clampUnit(progress)
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ]
}

/**
 * 在播放与暂停速度之间执行项目原有的平滑起停插值。
 *
 * @param from 当前速度倍率
 * @param to 目标速度倍率
 * @param progress 归一化过渡进度
 */
export function interpolateAppleMusicMotionScale(
  from: number,
  to: number,
  progress: number
): number {
  /** 平滑起停后的插值进度。 */
  const amount = smoothTransitionProgress(progress)
  return from + (to - from) * amount
}

/**
 * 对低频能量执行快速起音、慢速释放的时间常数平滑。
 *
 * @param current 当前平滑能量
 * @param target 音频分析器目标能量
 * @param deltaMs 距离上一帧的毫秒数
 */
export function interpolateAppleMusicAudioEnergy(
  current: number,
  target: number,
  deltaMs: number
): number {
  /** 起音比释放更快，让鼓点清晰但不会闪烁。 */
  const timeConstant = target > current
    ? NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.audioAttackMs
    : NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.audioReleaseMs
  /** 与帧率无关的指数平滑权重。 */
  const amount = 1 - Math.exp(-Math.max(0, deltaMs) / timeConstant)
  return clampUnit(current + (clampUnit(target) - current) * amount)
}

/** 生成只显示指定纹理槽的独热权重。 */
function createTargetArtworkWeights(slotIndex: number): AppleMusicArtworkWeights {
  return [slotIndex === 0 ? 1 : 0, slotIndex === 1 ? 1 : 0, slotIndex === 2 ? 1 : 0]
}

/**
 * 移除即将被重定向的最弱纹理槽，并重新归一化仍在屏幕上的贡献。
 * 这是项目原有的连续快速切歌优化，可避免新纹理继承旧纹理的非零权重。
 */
function retainArtworkWeights(
  weights: AppleMusicArtworkWeights,
  redirectedSlotIndex: number
): AppleMusicArtworkWeights {
  /** 被保留的三个槽贡献。 */
  const retained = weights.map((weight, index) => (
    index === redirectedSlotIndex ? 0 : weight
  )) as unknown as AppleMusicArtworkWeights
  /** 被保留贡献的总权重。 */
  const total = retained[0] + retained[1] + retained[2]
  if (total <= INVISIBLE_WEIGHT_THRESHOLD) return [0, 0, 0]
  return [retained[0] / total, retained[1] / total, retained[2] / total]
}

/** 建立包含四张空 Sprite 的封面纹理槽。 */
function createArtworkSlot(): ArtworkSlot {
  /** 当前槽的淡化容器。 */
  const container = new Container()
  /** 当前槽中的四张同源 Sprite。 */
  const sprites = Array.from({ length: SPRITES_PER_ARTWORK }, () => {
    /** 使用共享空纹理初始化的 Sprite。 */
    const sprite = new Sprite(Texture.EMPTY)
    sprite.anchor.set(0.5)
    return sprite
  }) as [Sprite, Sprite, Sprite, Sprite]
  container.alpha = 0
  container.addChild(...sprites)
  return { container, sprites, texture: undefined }
}

/** 释放封面 Texture 的 GPU 数据，但保留底层图片 source 给当前渲染批次安全收尾。 */
export function releaseAppleMusicArtworkTexture(texture: Texture): void {
  texture.source.unload()
  texture.destroy(false)
}

// ========= 渲染器 =========

/**
 * 以 PixiJS 8 复现 Apple Music 网页歌词动态背景，并叠加 NcxMusic 的音频响应、
 * 三槽快速切歌、暂停缓停、后台节流和减少动态效果策略。
 */
export class FluidMeshRenderer {
  /** Pixi 应用与 WebGL 渲染循环。 */
  private readonly app: Application

  /** 承载四层封面组并应用完整滤镜链的场景。 */
  private readonly scene = new Container()

  /** 白色底层，保持与 Apple 网页场景一致的合成基底。 */
  private readonly baseLayer = new Graphics()

  /** 三个可在连续快速切歌时重定向的封面组。 */
  private readonly artworkSlots: readonly [ArtworkSlot, ArtworkSlot, ArtworkSlot]

  /** Apple 网页端的中心扭曲滤镜。 */
  private readonly twistFilter: TwistFilter

  /** Apple 网页端五个逻辑 Kawase 模糊滤镜。 */
  private readonly kawaseFilters: readonly KawaseBlurFilter[]

  /** Apple 网页端的最终饱和度、亮度与对比度调整。 */
  private readonly adjustmentFilter: AdjustmentFilter

  /** 当前是否已经上传可绘制的封面。 */
  private hasArtwork = false

  /** 当前画面实际显示的三组封面权重。 */
  private displayedArtworkWeights: AppleMusicArtworkWeights = [0, 0, 0]

  /** 本次切歌过渡起始权重。 */
  private artworkTransitionFrom: AppleMusicArtworkWeights = [0, 0, 0]

  /** 本次切歌过渡目标权重。 */
  private artworkTransitionTo: AppleMusicArtworkWeights = [0, 0, 0]

  /** 本次切歌过渡已经运行的时间。 */
  private artworkTransitionElapsedMs = 0

  /** 本次切歌过渡采用的时长。 */
  private artworkTransitionDurationMs: number = APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs

  /** 本次切歌过渡是否尚未完成。 */
  private artworkTransitionActive = false

  /** 当前累计的连续运动时间。 */
  private motionTimeSeconds = 0

  /** 当前播放器意图是否为播放。 */
  private motionActive = true

  /** 当前画面使用的连续运动速度倍率。 */
  private displayedMotionScale = 1

  /** 本次速度过渡起始倍率。 */
  private motionTransitionFrom = 1

  /** 本次速度过渡目标倍率。 */
  private motionTransitionTo = 1

  /** 本次速度过渡已经运行的时间。 */
  private motionTransitionElapsedMs = 0

  /** 本次播放或暂停速度过渡是否尚未完成。 */
  private motionTransitionActive = false

  /** 当前绑定的 50～120 Hz 低频能量提供函数。 */
  private audioEnergyProvider: (() => number) | undefined

  /** 当前画面使用的平滑低频能量。 */
  private displayedAudioEnergy = 0

  /** 系统是否要求减少动态效果。 */
  private reducedMotion = false

  /** 页面可见性层是否允许渲染器运行。 */
  private runningRequested = false

  /** 实例是否已经释放。 */
  private destroyed = false

  /**
   * 建立已初始化的 PixiJS 8 渲染器。
   *
   * @param canvas 组件提供的固定 Canvas
   */
  static async create(canvas: HTMLCanvasElement): Promise<FluidMeshRenderer> {
    /** 使用 PixiJS 8 异步初始化协议创建的应用。 */
    const app = new Application()
    await app.init({
      canvas,
      width: 1,
      height: 1,
      resolution: 1,
      autoDensity: false,
      antialias: false,
      backgroundAlpha: 0,
      preference: 'webgl',
      powerPreference: 'low-power',
      autoStart: false,
      sharedTicker: false
    })
    return new FluidMeshRenderer(app)
  }

  /** 配置场景、Sprite 和滤镜链；外部必须通过 create 完成异步初始化。 */
  private constructor(app: Application) {
    this.app = app
    this.artworkSlots = [createArtworkSlot(), createArtworkSlot(), createArtworkSlot()]
    this.twistFilter = new TwistFilter({
      angle: APPLE_MUSIC_WEB_BACKGROUND_CONFIG.twistAngle,
      radius: APPLE_MUSIC_WEB_BACKGROUND_CONFIG.twistRadius,
      offset: { x: 0.5, y: 0.5 }
    })
    this.kawaseFilters = APPLE_MUSIC_WEB_BACKGROUND_CONFIG.kawaseFilters.map((options) => (
      new KawaseBlurFilter({ ...options })
    ))
    this.adjustmentFilter = new AdjustmentFilter({
      saturation: APPLE_MUSIC_WEB_BACKGROUND_CONFIG.saturation,
      brightness: APPLE_MUSIC_WEB_BACKGROUND_CONFIG.brightness,
      contrast: APPLE_MUSIC_WEB_BACKGROUND_CONFIG.contrast
    })

    this.scene.addChild(...this.artworkSlots.map((slot) => slot.container))
    this.scene.filters = [
      this.twistFilter,
      ...this.kawaseFilters,
      this.adjustmentFilter
    ]
    this.app.stage.addChild(this.baseLayer, this.scene)
    this.app.ticker.maxFPS = APPLE_MUSIC_WEB_BACKGROUND_CONFIG.maximumFps
    this.app.ticker.add(this.handleTick)
    this.resize(1, 1)
  }

  /** 推进切歌、暂停和音频响应，并在空闲时停掉 Pixi Ticker。 */
  private readonly handleTick = (ticker: Ticker): void => {
    if (this.destroyed) return
    /** 避免窗口从后台恢复时动画相位突然跃迁的安全时间步长。 */
    const deltaMs = Math.min(
      NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.maximumClockDeltaMs,
      Math.max(0, ticker.elapsedMS)
    )

    this.updateArtworkTransition(deltaMs)
    this.updateMotionTransition(deltaMs)
    this.updateAudioEnergy(deltaMs)
    this.motionTimeSeconds += deltaMs * this.displayedMotionScale / 1_000
    this.layoutArtworkLayers()
    this.twistFilter.angle = APPLE_MUSIC_WEB_BACKGROUND_CONFIG.twistAngle
      * (1 + this.displayedAudioEnergy
        * NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.lowFrequencyTwistPulse)

    if (!this.shouldContinueAnimating()) this.app.stop()
  }

  /** 把当前三组封面权重同步到 Pixi 容器透明度。 */
  private applyArtworkWeights(weights: AppleMusicArtworkWeights): void {
    this.displayedArtworkWeights = weights
    this.artworkSlots.forEach((slot, index) => {
      slot.container.alpha = weights[index] ?? 0
    })
  }

  /** 按当前视口、动画相位和低频能量布局全部十二张 Sprite。 */
  private layoutArtworkLayers(): void {
    /** 当前帧四层封面的共享空间状态。 */
    const frames = createAppleMusicArtworkLayerFrames(
      this.app.screen.width,
      this.app.screen.height,
      this.motionTimeSeconds,
      this.displayedAudioEnergy
    )

    this.artworkSlots.forEach((slot) => {
      slot.sprites.forEach((sprite, index) => {
        /** 当前 Sprite 对应的 Apple 图层状态。 */
        const frame = frames[index]
        if (!frame) return
        sprite.position.set(frame.centerX, frame.centerY)
        sprite.width = frame.size
        sprite.height = frame.size
        sprite.rotation = frame.rotation
      })
    })
  }

  /** 推进 Apple 线性切歌过渡，并在完成后释放不再显示的 GPU 纹理。 */
  private updateArtworkTransition(deltaMs: number): void {
    if (!this.artworkTransitionActive) return
    this.artworkTransitionElapsedMs += deltaMs
    /** 当前线性切歌过渡的归一化进度。 */
    const progress = this.artworkTransitionElapsedMs / this.artworkTransitionDurationMs
    this.applyArtworkWeights(interpolateAppleMusicArtworkWeights(
      this.artworkTransitionFrom,
      this.artworkTransitionTo,
      progress
    ))
    if (progress < 1) return
    this.artworkTransitionActive = false
    this.releaseInvisibleArtworkTextures()
  }

  /** 推进项目保留的播放或暂停平滑速度过渡。 */
  private updateMotionTransition(deltaMs: number): void {
    if (!this.motionTransitionActive) return
    this.motionTransitionElapsedMs += deltaMs
    /** 当前速度过渡的归一化进度。 */
    const progress = this.motionTransitionElapsedMs
      / NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.motionTransitionMs
    this.displayedMotionScale = interpolateAppleMusicMotionScale(
      this.motionTransitionFrom,
      this.motionTransitionTo,
      progress
    )
    if (progress < 1) return
    this.displayedMotionScale = this.motionTransitionTo
    this.motionTransitionActive = false
  }

  /** 读取并平滑项目现有的 50～120 Hz 音频能量。 */
  private updateAudioEnergy(deltaMs: number): void {
    /** 减少动态效果或暂停时不再向全屏背景注入音频运动。 */
    const shouldReadAudio = !this.reducedMotion && this.motionActive
    /** 当前音频分析器返回的目标能量。 */
    const targetEnergy = shouldReadAudio ? this.readAudioEnergy() : 0
    this.displayedAudioEnergy = interpolateAppleMusicAudioEnergy(
      this.displayedAudioEnergy,
      targetEnergy,
      deltaMs
    )
  }

  /** 安全读取外部音频能量，避免分析器异常中断渲染循环。 */
  private readAudioEnergy(): number {
    try {
      return this.audioEnergyProvider?.() ?? 0
    } catch {
      return 0
    }
  }

  /** 释放过渡结束后透明槽中的纹理，限制快速切歌的显存占用。 */
  private releaseInvisibleArtworkTextures(): void {
    this.artworkSlots.forEach((slot, index) => {
      if ((this.displayedArtworkWeights[index] ?? 0) > INVISIBLE_WEIGHT_THRESHOLD) return
      this.releaseArtworkSlotTexture(slot)
    })
  }

  /** 解除一个槽的 Sprite 纹理并释放其独占纹理源。 */
  private releaseArtworkSlotTexture(slot: ArtworkSlot): void {
    /** 当前槽即将释放的独占纹理。 */
    const texture = slot.texture
    if (!texture) return
    slot.sprites.forEach((sprite) => {
      sprite.texture = Texture.EMPTY
    })
    slot.texture = undefined
    releaseAppleMusicArtworkTexture(texture)
  }

  /** 判断当前场景是否仍需要持续刷新。 */
  private shouldContinueAnimating(): boolean {
    if (!this.hasArtwork) return false
    if (this.artworkTransitionActive || this.motionTransitionActive) return true
    if (this.displayedAudioEnergy > INVISIBLE_WEIGHT_THRESHOLD) return true
    return !this.reducedMotion && this.displayedMotionScale > INVISIBLE_WEIGHT_THRESHOLD
  }

  /** 在页面允许且场景需要刷新时启动 Pixi Ticker。 */
  private ensureTickerRunning(): void {
    if (!this.destroyed && this.runningRequested && this.shouldContinueAnimating()) {
      this.app.start()
    }
  }

  /**
   * 更新 CSS 视口对应的 Pixi 渲染尺寸和滤镜中心。
   *
   * @param width Canvas 的 CSS 宽度
   * @param height Canvas 的 CSS 高度
   */
  resize(width: number, height: number): void {
    if (this.destroyed) return
    /** 限制后的整数渲染宽度。 */
    const renderWidth = Math.max(1, Math.round(width))
    /** 限制后的整数渲染高度。 */
    const renderHeight = Math.max(1, Math.round(height))
    if (this.app.screen.width === renderWidth && this.app.screen.height === renderHeight) return
    this.app.renderer.resize(renderWidth, renderHeight, 1)
    this.baseLayer.clear().rect(0, 0, renderWidth, renderHeight).fill({ color: 0xffffff })
    this.scene.filterArea = this.app.screen
    this.twistFilter.offset = { x: renderWidth / 2, y: renderHeight / 2 }
    this.layoutArtworkLayers()
    this.app.render()
  }

  /**
   * 上传新封面并从当前画面连续交叉淡化到新封面。
   *
   * @param artwork 已加载且完成跨域校验的 40×40 封面
   */
  setArtwork(artwork: HTMLImageElement): void {
    if (this.destroyed) return
    /** 首次封面固定使用第一槽，后续重定向当前贡献最小的槽。 */
    const targetSlotIndex = this.hasArtwork
      ? this.displayedArtworkWeights.reduce((minimumIndex, weight, index, weights) => (
          weight < (weights[minimumIndex] ?? Number.POSITIVE_INFINITY) ? index : minimumIndex
        ), 0)
      : 0
    /** 即将承载新封面的纹理槽。 */
    const targetSlot = this.artworkSlots[targetSlotIndex]
    if (!targetSlot) return
    /** 从已解码图片建立且不进入全局缓存的独占 Pixi 纹理。 */
    const texture = Texture.from(artwork, true)

    this.releaseArtworkSlotTexture(targetSlot)
    targetSlot.texture = texture
    targetSlot.sprites.forEach((sprite) => {
      sprite.texture = texture
    })

    /** 新封面最终独占显示时的权重。 */
    const targetWeights = createTargetArtworkWeights(targetSlotIndex)
    if (!this.hasArtwork) {
      this.hasArtwork = true
      this.artworkTransitionActive = false
      this.applyArtworkWeights(targetWeights)
      this.layoutArtworkLayers()
      this.app.render()
      this.ensureTickerRunning()
      return
    }

    this.artworkTransitionFrom = retainArtworkWeights(
      this.displayedArtworkWeights,
      targetSlotIndex
    )
    this.artworkTransitionTo = targetWeights
    this.artworkTransitionElapsedMs = 0
    this.artworkTransitionDurationMs = this.reducedMotion
      ? NCX_APPLE_MUSIC_BACKGROUND_ENHANCEMENTS.reducedMotionArtworkTransitionMs
      : APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs
    this.artworkTransitionActive = true
    this.applyArtworkWeights(this.artworkTransitionFrom)
    this.ensureTickerRunning()
  }

  /** 清空全部封面纹理并停止无意义的 GPU 刷新。 */
  clearArtwork(): void {
    if (this.destroyed) return
    this.hasArtwork = false
    this.artworkTransitionActive = false
    this.applyArtworkWeights([0, 0, 0])
    this.artworkSlots.forEach((slot) => this.releaseArtworkSlotTexture(slot))
    this.app.render()
    this.app.stop()
  }

  /**
   * 绑定项目现有的实时低频能量源。
   *
   * @param provider 返回 0～1 能量的无副作用函数
   */
  setAudioEnergyProvider(provider: (() => number) | undefined): void {
    this.audioEnergyProvider = provider
  }

  /**
   * 平滑切换播放或暂停对应的背景运动速度。
   *
   * @param active 当前歌曲是否播放
   * @param immediate 是否在初始化时立即对齐状态
   */
  setMotionActive(active: boolean, immediate = false): void {
    if (this.destroyed) return
    this.motionActive = active
    /** 减少动态效果下始终保持静态画面。 */
    const targetScale = this.reducedMotion ? 0 : (active ? 1 : 0)
    if (immediate) {
      this.displayedMotionScale = targetScale
      this.motionTransitionFrom = targetScale
      this.motionTransitionTo = targetScale
      this.motionTransitionActive = false
    } else {
      this.motionTransitionFrom = this.displayedMotionScale
      this.motionTransitionTo = targetScale
      this.motionTransitionElapsedMs = 0
      this.motionTransitionActive = this.motionTransitionFrom !== targetScale
    }
    this.ensureTickerRunning()
  }

  /**
   * 应用系统减少动态效果偏好：冻结全屏空间运动，但保留短切歌淡化。
   *
   * @param reduced 是否减少动态效果
   */
  setReducedMotion(reduced: boolean): void {
    if (this.destroyed || this.reducedMotion === reduced) return
    this.reducedMotion = reduced
    this.displayedAudioEnergy = 0
    if (reduced) {
      this.displayedMotionScale = 0
      this.motionTransitionFrom = 0
      this.motionTransitionTo = 0
      this.motionTransitionActive = false
      this.layoutArtworkLayers()
      this.app.render()
      if (!this.artworkTransitionActive) this.app.stop()
      return
    }
    this.setMotionActive(this.motionActive)
  }

  /** 允许页面可见时的 Pixi 渲染循环运行。 */
  start(): void {
    if (this.destroyed) return
    this.runningRequested = true
    this.ensureTickerRunning()
  }

  /** 页面隐藏时立即暂停 Pixi 渲染循环。 */
  stop(): void {
    this.runningRequested = false
    this.app.stop()
  }

  /** 释放滤镜、纹理、场景节点和 WebGL 上下文资源。 */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.runningRequested = false
    this.app.stop()
    this.app.ticker.remove(this.handleTick)
    this.artworkSlots.forEach((slot) => this.releaseArtworkSlotTexture(slot))
    this.scene.filters = []
    this.twistFilter.destroy()
    this.kawaseFilters.forEach((filter) => filter.destroy())
    this.adjustmentFilter.destroy()
    this.app.destroy({ removeView: false }, { children: true })
  }
}
