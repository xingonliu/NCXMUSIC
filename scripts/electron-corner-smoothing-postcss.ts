import type { Declaration, PluginCreator } from 'postcss'

// -- Constants

/** Electron 实验性圆角平滑属性。 */
export const ELECTRON_CORNER_SMOOTHING_PROPERTY = '-electron-corner-smoothing'

/** Renderer 设计系统提供的统一平滑度。 */
export const ELECTRON_CORNER_SMOOTHING_VALUE = 'var(--ncx-squircle-smoothing)'

/** CSS 圆角简写、物理方向和逻辑方向属性。 */
const CORNER_RADIUS_PROPERTY_PATTERN = /^border-(?:radius|(?:top|bottom)-(?:left|right)-radius|(?:start|end)-(?:start|end)-radius)$/

/** 可确定为零圆角的长度或百分比。 */
const ZERO_RADIUS_VALUE_PATTERN = /^[-+]?0*(?:\.0+)?(?:[a-z]+|%)?$/i

// -- Functions

/** 判断声明是否可能产生可见圆角。 */
export function isRoundedCornerDeclaration(declaration: Pick<Declaration, 'prop' | 'value'>): boolean {
  if (!CORNER_RADIUS_PROPERTY_PATTERN.test(declaration.prop)) return false

  /** `/` 分隔椭圆半径，空白分隔各角半径。 */
  const radiusValues = declaration.value.trim().split(/[\s/]+/).filter(Boolean)
  if (radiusValues.length === 0) return false
  return radiusValues.some((value) => !ZERO_RADIUS_VALUE_PATTERN.test(value))
}

/** 判断当前规则是否已经显式设置 Electron 圆角平滑。 */
function hasCornerSmoothingDeclaration(declaration: Declaration): boolean {
  return declaration.parent?.nodes.some((node) => (
    node.type === 'decl' && node.prop === ELECTRON_CORNER_SMOOTHING_PROPERTY
  )) ?? false
}

/** 只为实际声明了非零圆角的规则注入 Electron 平滑属性。 */
function injectCornerSmoothing(declaration: Declaration): void {
  if (!isRoundedCornerDeclaration(declaration)) return
  if (hasCornerSmoothingDeclaration(declaration)) return

  declaration.cloneAfter({
    prop: ELECTRON_CORNER_SMOOTHING_PROPERTY,
    value: ELECTRON_CORNER_SMOOTHING_VALUE
  })
}

/** Renderer CSS 构建期圆角平滑插件，避免对全 DOM 使用通配符。 */
const electronCornerSmoothingPostcss: PluginCreator<Record<string, never>> = () => ({
  postcssPlugin: 'ncx-electron-corner-smoothing',
  Declaration: injectCornerSmoothing
})

electronCornerSmoothingPostcss.postcss = true

export default electronCornerSmoothingPostcss
