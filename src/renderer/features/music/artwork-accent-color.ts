/** 歌词前沿色提取失败时使用的中性浅蓝。 */
export const DEFAULT_LYRIC_ACCENT_COLOR = 'rgb(196 218 255)'

/** 可参与封面取色的 RGB 像素。 */
export interface ArtworkAccentPixel {
  /** 红色通道。 */
  red: number
  /** 绿色通道。 */
  green: number
  /** 蓝色通道。 */
  blue: number
  /** 不透明度通道。 */
  alpha?: number
}

/** 主色统计桶。 */
interface ColorBucket {
  /** 加权红色通道总和。 */
  red: number
  /** 加权绿色通道总和。 */
  green: number
  /** 加权蓝色通道总和。 */
  blue: number
  /** 当前桶的综合色彩权重。 */
  weight: number
  /** 当前桶是否包含可辨识色相。 */
  chromatic: boolean
}

/** 把任意颜色通道约束到合法字节。 */
function colorByte(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)))
}

/** 返回用于亮度计算的线性 sRGB 通道。 */
function linearSrgb(value: number): number {
  const channel = colorByte(value) / 255
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4
}

/** 返回 RGB 颜色的 WCAG 相对亮度。 */
export function relativeColorLuminance(pixel: ArtworkAccentPixel): number {
  return (
    linearSrgb(pixel.red) * 0.2126 +
    linearSrgb(pixel.green) * 0.7152 +
    linearSrgb(pixel.blue) * 0.0722
  )
}

/**
 * 将封面主色统一向白色提亮，不区分任何页面主题。
 *
 * 固定先混入 34% 白色；仍然过暗时继续少量提亮，直到歌词前沿清晰可见。
 */
export function lightenArtworkAccent(pixel: ArtworkAccentPixel): ArtworkAccentPixel {
  let whiteMix = 0.34
  let result: ArtworkAccentPixel
  do {
    result = {
      red: colorByte(pixel.red + (255 - pixel.red) * whiteMix),
      green: colorByte(pixel.green + (255 - pixel.green) * whiteMix),
      blue: colorByte(pixel.blue + (255 - pixel.blue) * whiteMix),
      alpha: 255
    }
    whiteMix += 0.06
  } while (relativeColorLuminance(result) < 0.56 && whiteMix <= 0.88)
  return result
}

/** 将提亮后的封面色输出为 CSS Color 4 空格语法。 */
export function artworkAccentCssColor(pixel: ArtworkAccentPixel): string {
  const lightened = lightenArtworkAccent(pixel)
  return `rgb(${lightened.red} ${lightened.green} ${lightened.blue})`
}

/**
 * 从缩小后的封面像素选择兼顾覆盖面积与辨识度的主色。
 *
 * 颜色先量化到 32 阶色桶；存在足够分量的彩色候选时优先彩色，避免大面积黑白背景
 * 吞掉真正代表封面的色相。
 */
export function selectArtworkAccentColor(
  pixels: readonly ArtworkAccentPixel[]
): ArtworkAccentPixel | undefined {
  const buckets = new Map<number, ColorBucket>()

  pixels.forEach((pixel) => {
    const alpha = (pixel.alpha ?? 255) / 255
    if (alpha < 0.5) return
    const red = colorByte(pixel.red)
    const green = colorByte(pixel.green)
    const blue = colorByte(pixel.blue)
    const maximum = Math.max(red, green, blue) / 255
    const minimum = Math.min(red, green, blue) / 255
    const chroma = maximum - minimum
    const saturation = maximum <= 0 ? 0 : chroma / maximum
    const luminance = (maximum + minimum) / 2
    const visibilityWeight = 0.12 + Math.min(1, luminance * 5)
    const colorWeight = 0.35 + saturation * 1.9
    const weight = alpha * visibilityWeight * colorWeight
    const key = ((red >> 5) << 6) | ((green >> 5) << 3) | (blue >> 5)
    const bucket = buckets.get(key) ?? {
      red: 0,
      green: 0,
      blue: 0,
      weight: 0,
      chromatic: false
    }
    bucket.red += red * weight
    bucket.green += green * weight
    bucket.blue += blue * weight
    bucket.weight += weight
    bucket.chromatic ||= saturation >= 0.18
    buckets.set(key, bucket)
  })

  const rankedBuckets = [...buckets.values()].sort((left, right) => right.weight - left.weight)
  const strongestBucket = rankedBuckets[0]
  const strongestChromaticBucket = rankedBuckets.find((bucket) => bucket.chromatic)
  const selectedBucket = strongestChromaticBucket && strongestBucket &&
    strongestChromaticBucket.weight >= strongestBucket.weight * 0.18
    ? strongestChromaticBucket
    : strongestBucket
  if (!selectedBucket || selectedBucket.weight <= 0) return undefined

  return {
    red: selectedBucket.red / selectedBucket.weight,
    green: selectedBucket.green / selectedBucket.weight,
    blue: selectedBucket.blue / selectedBucket.weight,
    alpha: 255
  }
}

/** 从已经加载且允许 Canvas 读取的封面中提取一次歌词前沿色。 */
export function extractArtworkAccentColor(artwork: CanvasImageSource): string {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return DEFAULT_LYRIC_ACCENT_COLOR
  try {
    context.drawImage(artwork, 0, 0, canvas.width, canvas.height)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data
    const pixels: ArtworkAccentPixel[] = []
    for (let offset = 0; offset < imageData.length; offset += 4) {
      pixels.push({
        red: imageData[offset] ?? 0,
        green: imageData[offset + 1] ?? 0,
        blue: imageData[offset + 2] ?? 0,
        alpha: imageData[offset + 3] ?? 0
      })
    }
    const selectedColor = selectArtworkAccentColor(pixels)
    return selectedColor
      ? artworkAccentCssColor(selectedColor)
      : DEFAULT_LYRIC_ACCENT_COLOR
  } catch {
    return DEFAULT_LYRIC_ACCENT_COLOR
  }
}
