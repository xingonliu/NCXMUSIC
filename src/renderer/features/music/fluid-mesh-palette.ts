// ========= 类型 =========

/** Shader 使用的归一化 RGB 色彩。 */
export type FluidRgbColor = readonly [red: number, green: number, blue: number]

/** 流体网格固定使用的四节点调色板。 */
export type FluidMeshPalette = readonly [
  FluidRgbColor,
  FluidRgbColor,
  FluidRgbColor,
  FluidRgbColor
]

/** OKLab 色彩，用于感知一致的聚类和距离计算。 */
interface OklabColor {
  /** 感知明度。 */
  lightness: number
  /** 绿红轴分量。 */
  a: number
  /** 蓝黄轴分量。 */
  b: number
}

/** OKLCH 色彩，用于限制背景明度和色度。 */
export interface OklchColor {
  /** 感知明度。 */
  lightness: number
  /** 感知色度。 */
  chroma: number
  /** 色相角，单位为弧度。 */
  hue: number
}

/** 带像素权重的聚类样本。 */
interface WeightedColorSample {
  /** 量化色块覆盖的像素数量。 */
  weight: number
  /** 量化色块对应的 OKLab 色彩。 */
  color: OklabColor
}

/** K-Means 聚类后的候选色。 */
interface PaletteCluster {
  /** 聚类中心色。 */
  color: OklabColor
  /** 聚类覆盖的像素总权重。 */
  weight: number
}

// ========= 变量 =========

/** 无封面时使用的深色流体调色板。 */
export const DEFAULT_FLUID_MESH_PALETTE: FluidMeshPalette = [
  [0.18, 0.12, 0.27],
  [0.08, 0.24, 0.30],
  [0.33, 0.18, 0.29],
  [0.055, 0.075, 0.10]
]

/** 调色板固定节点数量。 */
const PALETTE_SIZE = 4

/** 封面取样画布边长。 */
const SAMPLE_CANVAS_SIZE = 72

/** K-Means 最大迭代次数。 */
const K_MEANS_ITERATIONS = 10

/** 低透明像素的剔除阈值。 */
const MINIMUM_ALPHA = 192

/** 颜色直方图每通道保留的高位数量。 */
const HISTOGRAM_CHANNEL_BITS = 5

/** 直方图每通道丢弃的低位数量。 */
const HISTOGRAM_SHIFT = 8 - HISTOGRAM_CHANNEL_BITS

/** 归一化 RGB 的最大通道值。 */
const MAXIMUM_RGB_CHANNEL = 255

// ========= 函数 =========

/** 把数值限制在给定闭区间。 */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** 把 sRGB 通道转换为线性光通道。 */
function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

/** 把线性光通道转换为 sRGB 通道。 */
function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055
}

/** 把归一化 sRGB 转换为 OKLab。 */
function rgbToOklab(color: FluidRgbColor): OklabColor {
  /** 线性红色通道。 */
  const red = srgbToLinear(color[0])
  /** 线性绿色通道。 */
  const green = srgbToLinear(color[1])
  /** 线性蓝色通道。 */
  const blue = srgbToLinear(color[2])
  /** OKLab 转换使用的长波锥体响应。 */
  const long = Math.cbrt(0.4122214708 * red + 0.5363325363 * green + 0.0514459929 * blue)
  /** OKLab 转换使用的中波锥体响应。 */
  const medium = Math.cbrt(0.2119034982 * red + 0.6806995451 * green + 0.1073969566 * blue)
  /** OKLab 转换使用的短波锥体响应。 */
  const short = Math.cbrt(0.0883024619 * red + 0.2817188376 * green + 0.6299787005 * blue)

  return {
    lightness: 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short,
    a: 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short,
    b: 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short
  }
}

/** 把 OKLab 转换为未裁剪的归一化 sRGB。 */
function oklabToRgb(color: OklabColor): FluidRgbColor {
  /** 逆变换后的长波锥体响应。 */
  const longRoot = color.lightness + 0.3963377774 * color.a + 0.2158037573 * color.b
  /** 逆变换后的中波锥体响应。 */
  const mediumRoot = color.lightness - 0.1055613458 * color.a - 0.0638541728 * color.b
  /** 逆变换后的短波锥体响应。 */
  const shortRoot = color.lightness - 0.0894841775 * color.a - 1.291485548 * color.b
  /** 线性长波锥体响应。 */
  const long = longRoot ** 3
  /** 线性中波锥体响应。 */
  const medium = mediumRoot ** 3
  /** 线性短波锥体响应。 */
  const short = shortRoot ** 3
  /** 线性红色通道。 */
  const red = 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short
  /** 线性绿色通道。 */
  const green = -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short
  /** 线性蓝色通道。 */
  const blue = -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short

  return [linearToSrgb(red), linearToSrgb(green), linearToSrgb(blue)]
}

/** 把 OKLab 转换为 OKLCH。 */
function oklabToOklch(color: OklabColor): OklchColor {
  return {
    lightness: color.lightness,
    chroma: Math.hypot(color.a, color.b),
    hue: Math.atan2(color.b, color.a)
  }
}

/** 把 OKLCH 转换为 OKLab。 */
function oklchToOklab(color: OklchColor): OklabColor {
  return {
    lightness: color.lightness,
    a: color.chroma * Math.cos(color.hue),
    b: color.chroma * Math.sin(color.hue)
  }
}

/** 判断 RGB 是否完整落在 sRGB 色域中。 */
function isInSrgbGamut(color: FluidRgbColor): boolean {
  return color.every((channel) => Number.isFinite(channel) && channel >= 0 && channel <= 1)
}

/**
 * 把 OKLCH 映射到 sRGB；超出色域时逐步降低色度并保持明度与色相。
 *
 * @param color 需要映射的 OKLCH 色彩
 */
function gamutMapOklch(color: OklchColor): FluidRgbColor {
  /** 当前尝试的色度。 */
  let chroma = color.chroma
  /** 当前尝试转换出的 RGB。 */
  let rgb = oklabToRgb(oklchToOklab(color))

  for (let attempt = 0; attempt < 12 && !isInSrgbGamut(rgb); attempt += 1) {
    chroma *= 0.82
    rgb = oklabToRgb(oklchToOklab({ ...color, chroma }))
  }

  return [
    clamp(rgb[0], 0, 1),
    clamp(rgb[1], 0, 1),
    clamp(rgb[2], 0, 1)
  ]
}

/**
 * 返回 RGB 对应的 OKLCH，供色彩约束验证和上层诊断使用。
 *
 * @param color 归一化 sRGB 色彩
 */
export function rgbToOklch(color: FluidRgbColor): OklchColor {
  return oklabToOklch(rgbToOklab(color))
}

/** 计算两个 OKLab 色彩的平方距离。 */
function colorDistanceSquared(first: OklabColor, second: OklabColor): number {
  /** 明度轴差值。 */
  const lightness = first.lightness - second.lightness
  /** 绿红轴差值。 */
  const a = first.a - second.a
  /** 蓝黄轴差值。 */
  const b = first.b - second.b
  return lightness * lightness + a * a + b * b
}

/** 从量化键还原色块中心的归一化 RGB。 */
function histogramKeyToRgb(key: number): FluidRgbColor {
  /** 单个量化通道的位掩码。 */
  const channelMask = (1 << HISTOGRAM_CHANNEL_BITS) - 1
  /** 量化区间的中心偏移。 */
  const bucketCenter = (1 << HISTOGRAM_SHIFT) / 2
  /** 红色量化通道。 */
  const red = (key >> (HISTOGRAM_CHANNEL_BITS * 2)) & channelMask
  /** 绿色量化通道。 */
  const green = (key >> HISTOGRAM_CHANNEL_BITS) & channelMask
  /** 蓝色量化通道。 */
  const blue = key & channelMask
  return [
    (red * (1 << HISTOGRAM_SHIFT) + bucketCenter) / MAXIMUM_RGB_CHANNEL,
    (green * (1 << HISTOGRAM_SHIFT) + bucketCenter) / MAXIMUM_RGB_CHANNEL,
    (blue * (1 << HISTOGRAM_SHIFT) + bucketCenter) / MAXIMUM_RGB_CHANNEL
  ]
}

/** 把 RGBA 像素压缩为带权重的五位 RGB 直方图样本。 */
function buildWeightedSamples(pixels: Uint8ClampedArray): WeightedColorSample[] {
  /** 量化色块到像素数量的映射。 */
  const histogram = new Map<number, number>()

  for (let offset = 0; offset + 3 < pixels.length; offset += 4) {
    if ((pixels[offset + 3] ?? 0) < MINIMUM_ALPHA) continue
    /** 当前像素的红色量化值。 */
    const red = (pixels[offset] ?? 0) >> HISTOGRAM_SHIFT
    /** 当前像素的绿色量化值。 */
    const green = (pixels[offset + 1] ?? 0) >> HISTOGRAM_SHIFT
    /** 当前像素的蓝色量化值。 */
    const blue = (pixels[offset + 2] ?? 0) >> HISTOGRAM_SHIFT
    /** 当前像素的直方图键。 */
    const key = (red << (HISTOGRAM_CHANNEL_BITS * 2)) | (green << HISTOGRAM_CHANNEL_BITS) | blue
    histogram.set(key, (histogram.get(key) ?? 0) + 1)
  }

  return [...histogram.entries()].map(([key, weight]) => ({
    weight,
    color: rgbToOklab(histogramKeyToRgb(key))
  }))
}

/** 使用确定性的加权最远点策略选择 K-Means 初始中心。 */
function initializeCentroids(samples: WeightedColorSample[]): OklabColor[] {
  /** 按覆盖像素数降序排列的样本。 */
  const sortedSamples = [...samples].sort((first, second) => second.weight - first.weight)
  /** 已选择的聚类中心。 */
  const centroids: OklabColor[] = []
  if (sortedSamples[0]) centroids.push({ ...sortedSamples[0].color })

  while (centroids.length < Math.min(PALETTE_SIZE, sortedSamples.length)) {
    /** 下一轮最合适的样本。 */
    let bestSample = sortedSamples[0]
    /** 下一轮样本当前最高评分。 */
    let bestScore = -1
    for (const sample of sortedSamples) {
      /** 样本到已选中心的最短感知距离。 */
      const nearestDistance = Math.min(...centroids.map((centroid) => (
        colorDistanceSquared(sample.color, centroid)
      )))
      /** 同时考虑覆盖率和色差的确定性评分。 */
      const score = nearestDistance * Math.sqrt(sample.weight)
      if (score > bestScore) {
        bestSample = sample
        bestScore = score
      }
    }
    if (!bestSample) break
    centroids.push({ ...bestSample.color })
  }

  return centroids
}

/** 使用加权 K-Means 把直方图样本聚为最多四种代表色。 */
function clusterSamples(samples: WeightedColorSample[]): PaletteCluster[] {
  /** 当前聚类中心。 */
  let centroids = initializeCentroids(samples)
  if (centroids.length === 0) return []

  for (let iteration = 0; iteration < K_MEANS_ITERATIONS; iteration += 1) {
    /** 每个聚类的加权明度和。 */
    const lightnessSums = centroids.map(() => 0)
    /** 每个聚类的加权绿红轴和。 */
    const aSums = centroids.map(() => 0)
    /** 每个聚类的加权蓝黄轴和。 */
    const bSums = centroids.map(() => 0)
    /** 每个聚类的像素总权重。 */
    const weightSums = centroids.map(() => 0)

    for (const sample of samples) {
      /** 当前样本最接近的聚类索引。 */
      let nearestIndex = 0
      /** 当前样本与最近聚类的平方距离。 */
      let nearestDistance = Number.POSITIVE_INFINITY
      centroids.forEach((centroid, index) => {
        /** 当前样本与候选聚类的平方距离。 */
        const distance = colorDistanceSquared(sample.color, centroid)
        if (distance < nearestDistance) {
          nearestDistance = distance
          nearestIndex = index
        }
      })
      lightnessSums[nearestIndex] = (lightnessSums[nearestIndex] ?? 0) + sample.color.lightness * sample.weight
      aSums[nearestIndex] = (aSums[nearestIndex] ?? 0) + sample.color.a * sample.weight
      bSums[nearestIndex] = (bSums[nearestIndex] ?? 0) + sample.color.b * sample.weight
      weightSums[nearestIndex] = (weightSums[nearestIndex] ?? 0) + sample.weight
    }

    centroids = centroids.map((centroid, index) => {
      /** 当前聚类覆盖的像素权重。 */
      const weight = weightSums[index] ?? 0
      if (weight === 0) return centroid
      return {
        lightness: (lightnessSums[index] ?? 0) / weight,
        a: (aSums[index] ?? 0) / weight,
        b: (bSums[index] ?? 0) / weight
      }
    })
  }

  /** 最终聚类覆盖的像素权重。 */
  const clusterWeights = centroids.map(() => 0)
  for (const sample of samples) {
    /** 当前样本最近的聚类索引。 */
    let nearestIndex = 0
    /** 当前样本到最近聚类的平方距离。 */
    let nearestDistance = Number.POSITIVE_INFINITY
    centroids.forEach((centroid, index) => {
      /** 当前样本到候选聚类的平方距离。 */
      const distance = colorDistanceSquared(sample.color, centroid)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    clusterWeights[nearestIndex] = (clusterWeights[nearestIndex] ?? 0) + sample.weight
  }

  return centroids
    .map((color, index) => ({ color, weight: clusterWeights[index] ?? 0 }))
    .filter((cluster) => cluster.weight > 0)
}

/** 从候选聚类中挑选与已选色差异最大的聚类。 */
function pickMostDistinctCluster(
  clusters: PaletteCluster[],
  selected: PaletteCluster[]
): PaletteCluster | undefined {
  /** 尚未被选中的候选聚类。 */
  const available = clusters.filter((cluster) => !selected.includes(cluster))
  return available.sort((first, second) => {
    /** 第一候选到已选色的最小距离。 */
    const firstDistance = Math.min(...selected.map((cluster) => (
      colorDistanceSquared(first.color, cluster.color)
    )))
    /** 第二候选到已选色的最小距离。 */
    const secondDistance = Math.min(...selected.map((cluster) => (
      colorDistanceSquared(second.color, cluster.color)
    )))
    /** 第一候选兼顾覆盖率后的评分。 */
    const firstScore = firstDistance * (1 + Math.log1p(first.weight))
    /** 第二候选兼顾覆盖率后的评分。 */
    const secondScore = secondDistance * (1 + Math.log1p(second.weight))
    return secondScore - firstScore
  })[0]
}

/** 生成单色封面缺少的辅助色，避免四个 Shader 节点完全重合。 */
function deriveMissingColor(base: OklabColor, index: number): OklabColor {
  /** 基准色的圆柱坐标。 */
  const baseLch = oklabToOklch(base)
  /** 不同补位节点使用的色相偏移。 */
  const hueOffset = index % 2 === 0 ? Math.PI * 0.58 : -Math.PI * 0.32
  /** 不同补位节点使用的明度偏移。 */
  const lightnessOffset = index % 2 === 0 ? 0.08 : -0.07
  return oklchToOklab({
    lightness: clamp(baseLch.lightness + lightnessOffset, 0.12, 0.52),
    chroma: clamp(baseLch.chroma * 0.85 + 0.035, 0.035, 0.16),
    hue: baseLch.hue + hueOffset
  })
}

/** 把聚类候选组织为主色、辅色、高光色和暗部色。 */
function selectPaletteRoles(clusters: PaletteCluster[]): OklabColor[] {
  /** 按像素覆盖率排列的聚类。 */
  const byWeight = [...clusters].sort((first, second) => second.weight - first.weight)
  /** 已选择的代表聚类。 */
  const selected: PaletteCluster[] = []
  if (byWeight[0]) selected.push(byWeight[0])

  while (selected.length < Math.min(PALETTE_SIZE, byWeight.length)) {
    /** 与已选色差异最大的下一聚类。 */
    const next = pickMostDistinctCluster(byWeight, selected)
    if (!next) break
    selected.push(next)
  }

  /** 选中色彩的 OKLab 副本。 */
  const colors = selected.map((cluster) => ({ ...cluster.color }))
  /** 补位时使用的基准色。 */
  const base = colors[0] ?? rgbToOklab(DEFAULT_FLUID_MESH_PALETTE[0])
  while (colors.length < PALETTE_SIZE) colors.push(deriveMissingColor(base, colors.length))

  /** 主色使用覆盖率最大的色彩。 */
  const dominant = colors[0] ?? base
  /** 暗部色使用感知明度最低的色彩。 */
  const shadow = [...colors].sort((first, second) => first.lightness - second.lightness)[0] ?? base
  /** 高光色优先使用明度与色度综合最高的色彩。 */
  const highlight = [...colors].sort((first, second) => {
    /** 第一候选的明度色度综合评分。 */
    const firstScore = first.lightness + oklabToOklch(first).chroma * 0.6
    /** 第二候选的明度色度综合评分。 */
    const secondScore = second.lightness + oklabToOklch(second).chroma * 0.6
    return secondScore - firstScore
  })[0] ?? base
  /** 辅色使用与主色距离最大的剩余色彩。 */
  const secondary = [...colors].sort((first, second) => (
    colorDistanceSquared(second, dominant) - colorDistanceSquared(first, dominant)
  ))[0] ?? base

  return [dominant, secondary, highlight, shadow]
}

/**
 * 依据节点角色限制 OKLCH 明度与色度，保证白色歌词对比度。
 *
 * @param color 原始聚类色
 * @param roleIndex 节点角色索引：主色、辅色、高光、暗部
 */
function correctPaletteColor(color: OklabColor, roleIndex: number): FluidRgbColor {
  /** 各角色允许的最低明度。 */
  const minimumLightness = [0.20, 0.18, 0.30, 0.15][roleIndex] ?? 0.18
  /** 各角色允许的最高明度。 */
  const maximumLightness = [0.38, 0.40, 0.45, 0.25][roleIndex] ?? 0.45
  /** 原始色彩的 OKLCH 表达。 */
  const lch = oklabToOklch(color)
  /** 极低色度封面需要的最小背景色度。 */
  const minimumChroma = roleIndex === 3 ? 0.025 : 0.045
  /** 暗部节点使用更克制的最大色度。 */
  const maximumChroma = roleIndex === 3 ? 0.13 : 0.19
  return gamutMapOklch({
    lightness: clamp(lch.lightness, minimumLightness, maximumLightness),
    chroma: clamp(lch.chroma, minimumChroma, maximumChroma),
    hue: Number.isFinite(lch.hue) ? lch.hue : 0
  })
}

/**
 * 从封面 RGBA 像素提取并修正四节点调色板。
 *
 * @param pixels 连续 RGBA 像素
 */
export function extractFluidMeshPalette(pixels: Uint8ClampedArray): FluidMeshPalette {
  /** 封面量化后的带权重颜色样本。 */
  const samples = buildWeightedSamples(pixels)
  if (samples.length === 0) return DEFAULT_FLUID_MESH_PALETTE
  /** K-Means 得到的代表色聚类。 */
  const clusters = clusterSamples(samples)
  /** 按网格职责排好的四个聚类中心。 */
  const roles = selectPaletteRoles(clusters)
  return [
    correctPaletteColor(roles[0] ?? rgbToOklab(DEFAULT_FLUID_MESH_PALETTE[0]), 0),
    correctPaletteColor(roles[1] ?? rgbToOklab(DEFAULT_FLUID_MESH_PALETTE[1]), 1),
    correctPaletteColor(roles[2] ?? rgbToOklab(DEFAULT_FLUID_MESH_PALETTE[2]), 2),
    correctPaletteColor(roles[3] ?? rgbToOklab(DEFAULT_FLUID_MESH_PALETTE[3]), 3)
  ]
}

/** 把字符串稳定映射为无符号整数。 */
function hashSeed(seed: string): number {
  /** FNV-1a 哈希累积值。 */
  let hash = 2166136261
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

/**
 * 为无法读取像素的跨域封面生成稳定的深色调色板。
 *
 * @param seed 通常使用封面 URL
 */
export function createFallbackFluidMeshPalette(seed: string): FluidMeshPalette {
  /** URL 哈希得到的基础色相。 */
  const hue = (hashSeed(seed) / 0xffffffff) * Math.PI * 2
  return [
    gamutMapOklch({ lightness: 0.32, chroma: 0.14, hue }),
    gamutMapOklch({ lightness: 0.29, chroma: 0.12, hue: hue + Math.PI * 0.62 }),
    gamutMapOklch({ lightness: 0.42, chroma: 0.15, hue: hue - Math.PI * 0.24 }),
    gamutMapOklch({ lightness: 0.18, chroma: 0.07, hue: hue + Math.PI * 0.18 })
  ]
}

/**
 * 在两套调色板之间执行逐 RGB 向量线性插值。
 *
 * @param from 起始调色板
 * @param to 目标调色板
 * @param progress 归一化过渡进度
 */
export function interpolateFluidMeshPalette(
  from: FluidMeshPalette,
  to: FluidMeshPalette,
  progress: number
): FluidMeshPalette {
  /** 限制后的线性插值进度。 */
  const amount = clamp(progress, 0, 1)
  /** 对单个 RGB 节点执行线性插值。 */
  const interpolateColor = (index: number): FluidRgbColor => {
    /** 起始节点色。 */
    const start = from[index] ?? DEFAULT_FLUID_MESH_PALETTE[index] ?? [0, 0, 0]
    /** 目标节点色。 */
    const end = to[index] ?? DEFAULT_FLUID_MESH_PALETTE[index] ?? [0, 0, 0]
    return [
      start[0] + (end[0] - start[0]) * amount,
      start[1] + (end[1] - start[1]) * amount,
      start[2] + (end[2] - start[2]) * amount
    ]
  }

  return [interpolateColor(0), interpolateColor(1), interpolateColor(2), interpolateColor(3)]
}

/** 创建可被 AbortSignal 中断的图片加载任务。 */
function loadImage(source: string, signal?: AbortSignal): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    /** 承载封面像素的临时图片。 */
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'

    /** 移除图片加载阶段注册的监听器。 */
    function cleanup(): void {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
      signal?.removeEventListener('abort', handleAbort)
    }

    /** 图片成功加载后的完成处理。 */
    function handleLoad(): void {
      cleanup()
      resolve(image)
    }

    /** 图片加载失败后的错误处理。 */
    function handleError(): void {
      cleanup()
      reject(new Error('Album artwork could not be loaded for palette extraction.'))
    }

    /** 封面切换或组件卸载后的中断处理。 */
    function handleAbort(): void {
      cleanup()
      image.src = ''
      reject(new DOMException('Artwork palette extraction was aborted.', 'AbortError'))
    }

    if (signal?.aborted) {
      handleAbort()
      return
    }
    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })
    signal?.addEventListener('abort', handleAbort, { once: true })
    image.src = source
  })
}

/**
 * 从远程专辑封面读取像素并生成流体网格调色板。
 *
 * @param artworkUrl 专辑封面地址
 * @param signal 封面切换时使用的取消信号
 */
export async function extractArtworkFluidMeshPalette(
  artworkUrl: string,
  signal?: AbortSignal
): Promise<FluidMeshPalette> {
  /** 已完成跨域加载的专辑封面。 */
  const image = await loadImage(artworkUrl, signal)
  if (signal?.aborted) throw new DOMException('Artwork palette extraction was aborted.', 'AbortError')
  /** 用于低成本读取封面像素的离屏画布。 */
  const canvas = document.createElement('canvas')
  canvas.width = SAMPLE_CANVAS_SIZE
  canvas.height = SAMPLE_CANVAS_SIZE
  /** 频繁读取像素优化后的二维上下文。 */
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('A 2D canvas context is required for palette extraction.')
  /** 保持封面比例时需要裁切的源边长。 */
  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight)
  /** 居中裁切的源横坐标。 */
  const sourceX = Math.max(0, (image.naturalWidth - sourceSize) / 2)
  /** 居中裁切的源纵坐标。 */
  const sourceY = Math.max(0, (image.naturalHeight - sourceSize) / 2)
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceSize,
    sourceSize,
    0,
    0,
    SAMPLE_CANVAS_SIZE,
    SAMPLE_CANVAS_SIZE
  )
  /** 降采样后的连续 RGBA 像素。 */
  const pixels = context.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE).data
  return extractFluidMeshPalette(pixels)
}
