// ========= 类型 =========

/** Apple Music 网页端单层封面纹理的动画参数。 */
export interface AppleMusicArtworkLayerFrame {
  /** 图层中心横坐标，单位为渲染像素。 */
  centerX: number
  /** 图层中心纵坐标，单位为渲染像素。 */
  centerY: number
  /** 方形图层边长，单位为渲染像素。 */
  size: number
  /** 图层顺时针旋转角度，单位为弧度。 */
  rotation: number
}

/** 三个 GPU 封面纹理槽在当前画面中的混合权重。 */
export type AppleMusicArtworkWeights = readonly [number, number, number]

/** Apple Music 网页端背景单个封面图层的固定动画配置。 */
interface AppleMusicArtworkLayerSpec {
  /** 图层边长相对视口宽度的比例。 */
  sizeRatio: number
  /** 每秒旋转弧度。 */
  rotationSpeed: number
  /** 静态中心横坐标相对视口宽度的比例。 */
  centerXRatio: number
  /** 静态中心纵坐标相对视口高度的比例。 */
  centerYRatio: number
  /** 环形轨道半径相对视口宽度的比例。 */
  orbitRadiusRatio: number
  /** 轨道角速度相对自身旋转速度的倍率。 */
  orbitSpeedRatio: number
}

/** WebGL Program 与其全屏四边形顶点属性。 */
interface ProgramBinding {
  /** 已链接的 Program。 */
  program: WebGLProgram
  /** 全屏四边形顶点属性位置。 */
  positionAttribute: number
}

/** 封面图层绘制 Program。 */
interface ArtworkProgramBinding extends ProgramBinding {
  /** 三个可连续重定向的专辑封面纹理槽。 */
  artworks: readonly [WebGLUniformLocation, WebGLUniformLocation, WebGLUniformLocation]
  /** 三个封面纹理槽的当前混合权重。 */
  artworkWeights: WebGLUniformLocation
  /** 渲染目标尺寸。 */
  resolution: WebGLUniformLocation
  /** 当前图层中心点。 */
  center: WebGLUniformLocation
  /** 当前图层边长。 */
  size: WebGLUniformLocation
  /** 当前图层旋转角。 */
  rotation: WebGLUniformLocation
  /** 方形 Sprite 边缘向下层封面羽化的宽度。 */
  edgeFeather: WebGLUniformLocation
}

/** Twist 后处理 Program。 */
interface TwistProgramBinding extends ProgramBinding {
  /** 上一阶段输出纹理。 */
  texture: WebGLUniformLocation
  /** 渲染目标尺寸。 */
  resolution: WebGLUniformLocation
  /** Twist 中心点。 */
  offset: WebGLUniformLocation
  /** Twist 作用半径。 */
  radius: WebGLUniformLocation
  /** Twist 最大旋转角。 */
  angle: WebGLUniformLocation
}

/** Kawase 模糊 Program。 */
interface KawaseProgramBinding extends ProgramBinding {
  /** 上一阶段输出纹理。 */
  texture: WebGLUniformLocation
  /** 渲染目标尺寸。 */
  resolution: WebGLUniformLocation
  /** 当前模糊采样偏移。 */
  offset: WebGLUniformLocation
}

/** 最终色彩调整 Program。 */
interface AdjustmentProgramBinding extends ProgramBinding {
  /** 已完成模糊的纹理。 */
  texture: WebGLUniformLocation
  /** 饱和度倍率。 */
  saturation: WebGLUniformLocation
}

/** 可被后处理链写入和再次采样的离屏目标。 */
interface RenderTarget {
  /** 目标帧缓冲。 */
  framebuffer: WebGLFramebuffer
  /** 帧缓冲绑定的 RGBA 纹理。 */
  texture: WebGLTexture
}

/** AppleMusicArtworkRenderer 初始化参数。 */
export interface FluidMeshRendererOptions {
  /** 低分辨率画布允许的最大宽度。 */
  maximumRenderWidth?: number
  /** 低分辨率画布允许的最大高度。 */
  maximumRenderHeight?: number
}

// ========= Apple Music 网页端参数 =========

/**
 * Apple Music 网页歌词场景公开逆向得到的核心参数。
 * 四张封面依次按 125%、80%、50%、25% 叠放，动画上限为 15 fps。
 */
export const APPLE_MUSIC_WEB_BACKGROUND_CONFIG = {
  maximumFps: 15,
  artworkTransitionMs: 1_500,
  motionTransitionMs: 1_200,
  saturation: 2.75,
  twistAngle: -3.25,
  twistRadiusRatio: 0.72,
  lowFrequencyScalePulse: 0.1,
  lowFrequencyRotationPulse: 0.2,
  lowFrequencyTwistPulse: 0.04,
  audioAttackMs: 65,
  audioReleaseMs: 240,
  spriteEdgeFeather: 0.08,
  kawaseOffsets: [2.5, 5, 10, 20, 30] as const,
  layerSizeRatios: [1.25, 0.8, 0.5, 0.25] as const,
  layerRotationSpeeds: [0.09, -0.24, -0.18, 0.12] as const
} as const

/** 四层封面纹理的尺寸、转速和轨道配置。 */
const ARTWORK_LAYER_SPECS: readonly AppleMusicArtworkLayerSpec[] = [
  {
    sizeRatio: 1.25,
    rotationSpeed: 0.09,
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    orbitRadiusRatio: 0,
    orbitSpeedRatio: 0
  },
  {
    sizeRatio: 0.8,
    rotationSpeed: -0.24,
    centerXRatio: 0.4,
    centerYRatio: 0.4,
    orbitRadiusRatio: 0,
    orbitSpeedRatio: 0
  },
  {
    sizeRatio: 0.5,
    rotationSpeed: -0.18,
    centerXRatio: 0.5,
    centerYRatio: 0.5,
    orbitRadiusRatio: 0.25,
    orbitSpeedRatio: 0.75
  },
  {
    sizeRatio: 0.25,
    rotationSpeed: 0.12,
    centerXRatio: 0.55,
    centerYRatio: 0.55,
    orbitRadiusRatio: 0.25,
    orbitSpeedRatio: 0.75
  }
]

/** 默认低分辨率画布最大宽度。 */
const DEFAULT_MAXIMUM_RENDER_WIDTH = 640

/** 默认低分辨率画布最大高度。 */
const DEFAULT_MAXIMUM_RENDER_HEIGHT = 420

/** Apple Music 网页歌词场景的 15 fps 绘制间隔。 */
const FRAME_INTERVAL_MS = 1_000 / APPLE_MUSIC_WEB_BACKGROUND_CONFIG.maximumFps

/** 避免窗口从后台恢复时动画相位突然跃迁的最大时钟步长。 */
const MAXIMUM_CLOCK_DELTA_MS = 100

// ========= Shader =========

/** 所有后处理阶段共用的全屏四边形顶点 Shader。 */
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

/** 把单张封面按中心、尺寸和旋转角绘制为一个正方形 Sprite。 */
const ARTWORK_FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;
uniform sampler2D u_artwork0;
uniform sampler2D u_artwork1;
uniform sampler2D u_artwork2;
uniform vec3 u_artworkWeights;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform float u_size;
uniform float u_rotation;
uniform float u_edgeFeather;

void main() {
  vec2 point = v_uv * u_resolution - u_center;
  float sine = sin(-u_rotation);
  float cosine = cos(-u_rotation);
  vec2 local = vec2(
    point.x * cosine - point.y * sine,
    point.x * sine + point.y * cosine
  ) / u_size + 0.5;

  if (local.x < 0.0 || local.x > 1.0 || local.y < 0.0 || local.y > 1.0) discard;
  vec4 color = texture2D(u_artwork0, local) * u_artworkWeights.x;
  color += texture2D(u_artwork1, local) * u_artworkWeights.y;
  color += texture2D(u_artwork2, local) * u_artworkWeights.z;
  vec2 edgeDistance = min(local, vec2(1.0) - local);
  float edgeAlpha = smoothstep(0.0, u_edgeFeather, min(edgeDistance.x, edgeDistance.y));
  gl_FragColor = vec4(color.rgb, color.a * edgeAlpha);
}
`

/**
 * Apple Music / pixi-filters TwistFilter 同形的坐标扭曲。
 * 中心旋转量最大，在 radius 边缘按平方曲线衰减到零。
 */
const TWIST_FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform vec2 u_offset;
uniform float u_radius;
uniform float u_angle;

void main() {
  vec2 coordinate = v_uv * u_resolution;
  vec2 relative = coordinate - u_offset;
  float distanceToOffset = length(relative);

  if (distanceToOffset < u_radius) {
    float distanceRatio = (u_radius - distanceToOffset) / u_radius;
    float angle = distanceRatio * distanceRatio * u_angle;
    float sine = sin(angle);
    float cosine = cos(angle);
    relative = vec2(
      relative.x * cosine - relative.y * sine,
      relative.x * sine + relative.y * cosine
    );
  }

  vec2 sampleUv = clamp((relative + u_offset) / u_resolution, 0.0, 1.0);
  gl_FragColor = texture2D(u_texture, sampleUv);
}
`

/** 以九点帐篷核执行一次 Kawase 模糊，避免轴向硬边退化成两点重影。 */
const KAWASE_FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_offset;

void main() {
  vec2 delta = vec2(u_offset + 0.5) / u_resolution;
  vec4 color = texture2D(u_texture, v_uv) * 4.0;
  color += texture2D(u_texture, v_uv + vec2(-delta.x, 0.0)) * 2.0;
  color += texture2D(u_texture, v_uv + vec2(delta.x, 0.0)) * 2.0;
  color += texture2D(u_texture, v_uv + vec2(0.0, -delta.y)) * 2.0;
  color += texture2D(u_texture, v_uv + vec2(0.0, delta.y)) * 2.0;
  color += texture2D(u_texture, v_uv + vec2(-delta.x, -delta.y));
  color += texture2D(u_texture, v_uv + vec2(delta.x, -delta.y));
  color += texture2D(u_texture, v_uv + vec2(-delta.x, delta.y));
  color += texture2D(u_texture, v_uv + vec2(delta.x, delta.y));
  gl_FragColor = color * 0.0625;
}
`

/** 最终按 Apple Music 网页端参数提升封面色场饱和度。 */
const ADJUSTMENT_FRAGMENT_SHADER_SOURCE = `
precision mediump float;

varying vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_saturation;

void main() {
  vec4 source = texture2D(u_texture, v_uv);
  float luminance = dot(source.rgb, vec3(0.2126, 0.7152, 0.0722));
  vec3 saturated = mix(vec3(luminance), source.rgb, u_saturation);
  float dither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  saturated += vec3((dither - 0.5) / 255.0);
  gl_FragColor = vec4(clamp(saturated, 0.0, 1.0), 1.0);
}
`

// ========= 纯函数 =========

/**
 * 计算指定动画时刻的四层封面位置，公式与 Apple Music 网页端重构一致。
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
  /** 鼓点只产生克制的整体缩放和角度脉冲，连续流动相位保持独立。 */
  const energy = clampUnit(audioEnergy)
  const sizePulse = 1 + energy * APPLE_MUSIC_WEB_BACKGROUND_CONFIG.lowFrequencyScalePulse
  const rotationPulse = energy * APPLE_MUSIC_WEB_BACKGROUND_CONFIG.lowFrequencyRotationPulse
  return ARTWORK_LAYER_SPECS.map((spec) => {
    /** 当前图层自身旋转角。 */
    const rotation = elapsedSeconds * spec.rotationSpeed + rotationPulse
    /** 小图层沿圆形轨道移动时使用的相位。 */
    const orbitAngle = rotation * spec.orbitSpeedRatio
    /** 当前图层的轨道半径。 */
    const orbitRadius = width * spec.orbitRadiusRatio
    return {
      centerX: width * spec.centerXRatio + Math.cos(orbitAngle) * orbitRadius,
      centerY: height * spec.centerYRatio + Math.sin(orbitAngle) * orbitRadius,
      size: width * spec.sizeRatio * sizePulse,
      rotation
    }
  })
}

/** 把数值限制到 0～1。 */
function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value))
}

/** Apple Music 状态过渡使用的平滑起停曲线。 */
function smoothTransitionProgress(progress: number): number {
  /** 限制后的线性进度。 */
  const amount = clampUnit(progress)
  return amount * amount * (3 - 2 * amount)
}

/**
 * 在三纹理权重之间执行平滑插值，供切歌时从当前画面连续重定向。
 */
export function interpolateAppleMusicArtworkWeights(
  from: AppleMusicArtworkWeights,
  to: AppleMusicArtworkWeights,
  progress: number
): AppleMusicArtworkWeights {
  /** 平滑起停后的插值进度。 */
  const amount = smoothTransitionProgress(progress)
  return [
    from[0] + (to[0] - from[0]) * amount,
    from[1] + (to[1] - from[1]) * amount,
    from[2] + (to[2] - from[2]) * amount
  ]
}

/** 在播放与暂停速度之间执行平滑起停插值。 */
export function interpolateAppleMusicMotionScale(
  from: number,
  to: number,
  progress: number
): number {
  /** 平滑起停后的插值进度。 */
  const amount = smoothTransitionProgress(progress)
  return from + (to - from) * amount
}

/** 对低频能量执行快速起音、慢速释放的时间常数平滑。 */
export function interpolateAppleMusicAudioEnergy(
  current: number,
  target: number,
  deltaMs: number
): number {
  /** 起音比释放更快，让鼓点清晰但不会闪烁。 */
  const timeConstant = target > current
    ? APPLE_MUSIC_WEB_BACKGROUND_CONFIG.audioAttackMs
    : APPLE_MUSIC_WEB_BACKGROUND_CONFIG.audioReleaseMs
  /** 与帧率无关的指数平滑权重。 */
  const amount = 1 - Math.exp(-Math.max(0, deltaMs) / timeConstant)
  return clampUnit(current + (clampUnit(target) - current) * amount)
}

/** 归一化三纹理权重，并为全零输入提供安全首槽。 */
function normalizeArtworkWeights(weights: AppleMusicArtworkWeights): AppleMusicArtworkWeights {
  /** 三个纹理槽的总贡献。 */
  const total = weights[0] + weights[1] + weights[2]
  if (total <= 0.0001) return [1, 0, 0]
  return [weights[0] / total, weights[1] / total, weights[2] / total]
}

/** 编译单个 Shader，并在失败时释放资源。 */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  /** 新建的 Shader。 */
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader allocation failed.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  /** 浏览器返回的 Shader 编译诊断。 */
  const log = gl.getShaderInfoLog(shader) ?? 'Unknown WebGL shader compilation error.'
  gl.deleteShader(shader)
  throw new Error(log)
}

/** 编译并链接一个使用共用顶点 Shader 的 Program。 */
function createProgramBinding(
  gl: WebGLRenderingContext,
  fragmentSource: string
): ProgramBinding {
  /** 已编译的顶点 Shader。 */
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  /** 已编译的片元 Shader。 */
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource)
  /** 新建的 Shader Program。 */
  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    throw new Error('WebGL program allocation failed.')
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    /** 浏览器返回的 Program 链接诊断。 */
    const log = gl.getProgramInfoLog(program) ?? 'Unknown WebGL program link error.'
    gl.deleteProgram(program)
    throw new Error(log)
  }
  /** 所有 Program 使用相同名称的全屏顶点属性。 */
  const positionAttribute = gl.getAttribLocation(program, 'a_position')
  if (positionAttribute < 0) {
    gl.deleteProgram(program)
    throw new Error('Required WebGL position attribute is unavailable.')
  }
  return { program, positionAttribute }
}

/** 获取必需的 uniform 位置，避免静默输出黑屏。 */
function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  /** Program 中查找到的 uniform。 */
  const location = gl.getUniformLocation(program, name)
  if (!location) throw new Error(`Required WebGL uniform is unavailable: ${name}`)
  return location
}

/** 建立专辑封面图层 Program。 */
function createArtworkProgram(gl: WebGLRenderingContext): ArtworkProgramBinding {
  /** 已建立的基础 Program 绑定。 */
  const binding = createProgramBinding(gl, ARTWORK_FRAGMENT_SHADER_SOURCE)
  return {
    ...binding,
    artworks: [
      requireUniform(gl, binding.program, 'u_artwork0'),
      requireUniform(gl, binding.program, 'u_artwork1'),
      requireUniform(gl, binding.program, 'u_artwork2')
    ],
    artworkWeights: requireUniform(gl, binding.program, 'u_artworkWeights'),
    resolution: requireUniform(gl, binding.program, 'u_resolution'),
    center: requireUniform(gl, binding.program, 'u_center'),
    size: requireUniform(gl, binding.program, 'u_size'),
    rotation: requireUniform(gl, binding.program, 'u_rotation'),
    edgeFeather: requireUniform(gl, binding.program, 'u_edgeFeather')
  }
}

/** 建立 Twist Program。 */
function createTwistProgram(gl: WebGLRenderingContext): TwistProgramBinding {
  /** 已建立的基础 Program 绑定。 */
  const binding = createProgramBinding(gl, TWIST_FRAGMENT_SHADER_SOURCE)
  return {
    ...binding,
    texture: requireUniform(gl, binding.program, 'u_texture'),
    resolution: requireUniform(gl, binding.program, 'u_resolution'),
    offset: requireUniform(gl, binding.program, 'u_offset'),
    radius: requireUniform(gl, binding.program, 'u_radius'),
    angle: requireUniform(gl, binding.program, 'u_angle')
  }
}

/** 建立 Kawase 模糊 Program。 */
function createKawaseProgram(gl: WebGLRenderingContext): KawaseProgramBinding {
  /** 已建立的基础 Program 绑定。 */
  const binding = createProgramBinding(gl, KAWASE_FRAGMENT_SHADER_SOURCE)
  return {
    ...binding,
    texture: requireUniform(gl, binding.program, 'u_texture'),
    resolution: requireUniform(gl, binding.program, 'u_resolution'),
    offset: requireUniform(gl, binding.program, 'u_offset')
  }
}

/** 建立最终色彩调整 Program。 */
function createAdjustmentProgram(gl: WebGLRenderingContext): AdjustmentProgramBinding {
  /** 已建立的基础 Program 绑定。 */
  const binding = createProgramBinding(gl, ADJUSTMENT_FRAGMENT_SHADER_SOURCE)
  return {
    ...binding,
    texture: requireUniform(gl, binding.program, 'u_texture'),
    saturation: requireUniform(gl, binding.program, 'u_saturation')
  }
}

/** 创建线性采样、边缘钳制的 RGBA 纹理。 */
function createTexture(gl: WebGLRenderingContext): WebGLTexture {
  /** 新建的纹理。 */
  const texture = gl.createTexture()
  if (!texture) throw new Error('WebGL texture allocation failed.')
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return texture
}

/** 创建初始为 1×1 的离屏帧缓冲目标。 */
function createRenderTarget(gl: WebGLRenderingContext): RenderTarget {
  /** 目标纹理。 */
  const texture = createTexture(gl)
  /** 目标帧缓冲。 */
  const framebuffer = gl.createFramebuffer()
  if (!framebuffer) {
    gl.deleteTexture(texture)
    throw new Error('WebGL framebuffer allocation failed.')
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  )
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteFramebuffer(framebuffer)
    gl.deleteTexture(texture)
    throw new Error('WebGL framebuffer is incomplete.')
  }
  return { framebuffer, texture }
}

// ========= 渲染器 =========

/**
 * Apple Music 网页端同形的封面纹理背景渲染器。
 *
 * 管线严格按「四层封面 Sprite → Twist → 多次 Kawase Blur → Saturation」执行，
 * 不提取主色、不生成噪声网格，也不读取音频能量。
 */
export class FluidMeshRenderer {
  /** 目标 Canvas。 */
  private readonly canvas: HTMLCanvasElement

  /** Canvas 对应的 WebGL 1 上下文。 */
  private readonly gl: WebGLRenderingContext

  /** 全屏四边形顶点缓冲。 */
  private readonly positionBuffer: WebGLBuffer

  /** 四个连续后处理 Program。 */
  private readonly artworkProgram: ArtworkProgramBinding
  private readonly twistProgram: TwistProgramBinding
  private readonly kawaseProgram: KawaseProgramBinding
  private readonly adjustmentProgram: AdjustmentProgramBinding

  /** Scene、Ping、Pong 三个离屏纹理。 */
  private readonly renderTargets: readonly [RenderTarget, RenderTarget, RenderTarget]

  /** 当前画面与切歌过渡使用的三个专辑封面纹理槽。 */
  private readonly artworkTextures: readonly [WebGLTexture, WebGLTexture, WebGLTexture]

  /** 当前是否已经上传可绘制的封面。 */
  private hasArtwork = false

  /** 当前画面已显示的三纹理权重。 */
  private displayedArtworkWeights: AppleMusicArtworkWeights = [1, 0, 0]

  /** 本次切歌过渡起始权重。 */
  private artworkTransitionFrom: AppleMusicArtworkWeights = [1, 0, 0]

  /** 本次切歌过渡目标权重。 */
  private artworkTransitionTo: AppleMusicArtworkWeights = [1, 0, 0]

  /** 本次切歌交叉混合起始时间。 */
  private artworkTransitionStartedAt = 0

  /** 低分辨率画布最大宽度。 */
  private readonly maximumRenderWidth: number

  /** 低分辨率画布最大高度。 */
  private readonly maximumRenderHeight: number

  /** 当前动画帧句柄。 */
  private animationFrame: number | undefined

  /** 动画循环是否运行。 */
  private running = false

  /** 系统是否要求减少动态效果。 */
  private reducedMotion = false

  /** 上一次实际绘制时间。 */
  private lastRenderAt = 0

  /** 上一次推进动画相位的时间。 */
  private lastClockAt = 0

  /** 四层封面动画累计时间。 */
  private motionTime = 0

  /** 当前播放器意图是否为播放。 */
  private motionActive = true

  /** 当前画面使用的连续运动速度倍率。 */
  private displayedMotionScale = 1

  /** 本次速度过渡起始倍率。 */
  private motionTransitionFrom = 1

  /** 本次速度过渡目标倍率。 */
  private motionTransitionTo = 1

  /** 本次播放/暂停速度过渡起始时间。 */
  private motionTransitionStartedAt = 0

  /** 当前绑定的 50～120 Hz 低频能量提供函数。 */
  private audioEnergyProvider: (() => number) | undefined

  /** 当前画面使用的平滑低频能量。 */
  private displayedAudioEnergy = 0

  /** 实例是否已经释放。 */
  private destroyed = false

  /** 绑定实例后的动画帧回调。 */
  private readonly handleAnimationFrame = (timestamp: number): void => {
    if (!this.running || this.destroyed) return
    this.animationFrame = window.requestAnimationFrame(this.handleAnimationFrame)
    if (timestamp - this.lastRenderAt < FRAME_INTERVAL_MS) return
    this.draw(timestamp)
  }

  /** 创建 Apple Music 网页端同形背景引擎。 */
  constructor(canvas: HTMLCanvasElement, options: FluidMeshRendererOptions = {}) {
    this.canvas = canvas
    this.maximumRenderWidth = options.maximumRenderWidth ?? DEFAULT_MAXIMUM_RENDER_WIDTH
    this.maximumRenderHeight = options.maximumRenderHeight ?? DEFAULT_MAXIMUM_RENDER_HEIGHT
    /** 为持续低帧率背景动画优化的 WebGL 上下文。 */
    const gl = canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false,
      powerPreference: 'low-power'
    })
    if (!gl) throw new Error('WebGL is unavailable for the immersive lyrics background.')
    this.gl = gl

    /** 四个处理阶段的 Program。 */
    this.artworkProgram = createArtworkProgram(gl)
    this.twistProgram = createTwistProgram(gl)
    this.kawaseProgram = createKawaseProgram(gl)
    this.adjustmentProgram = createAdjustmentProgram(gl)

    /** 共用全屏四边形缓冲。 */
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) throw new Error('WebGL vertex buffer allocation failed.')
    this.positionBuffer = positionBuffer

    this.renderTargets = [
      createRenderTarget(gl),
      createRenderTarget(gl),
      createRenderTarget(gl)
    ]
    this.artworkTextures = [
      createTexture(gl),
      createTexture(gl),
      createTexture(gl)
    ]
    /** 未使用的纹理槽也初始化为完整的 1×1 纹理，避免 WebGL 不完整采样。 */
    for (const texture of this.artworkTextures) {
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        new Uint8Array([0, 0, 0, 255])
      )
    }
    this.configurePipeline()
  }

  /** 配置不会逐帧变化的 WebGL 状态和全屏四边形。 */
  private configurePipeline(): void {
    /** 覆盖裁剪空间的四边形顶点。 */
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ])
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.disable(this.gl.CULL_FACE)
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 1)
  }

  /** 绑定 Program 及其共用全屏四边形属性。 */
  private bindProgram(binding: ProgramBinding): void {
    this.gl.useProgram(binding.program)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(binding.positionAttribute)
    this.gl.vertexAttribPointer(binding.positionAttribute, 2, this.gl.FLOAT, false, 0, 0)
  }

  /** 把输入纹理绑定到指定纹理单元。 */
  private bindTexture(
    texture: WebGLTexture,
    uniform: WebGLUniformLocation,
    textureUnit = 0
  ): void {
    this.gl.activeTexture(this.gl.TEXTURE0 + textureUnit)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
    this.gl.uniform1i(uniform, textureUnit)
  }

  /** 把三个离屏纹理重新分配为当前 Canvas 尺寸。 */
  private resizeRenderTargets(width: number, height: number): void {
    for (const target of this.renderTargets) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, target.texture)
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        width,
        height,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        null
      )
    }
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
  }

  /**
   * 按容器比例更新低分辨率画布。
   * 最长边维持在约 640 像素，结合 15 fps 和多次 Kawase 模糊控制 GPU 成本。
   */
  resize(containerWidth: number, containerHeight: number): void {
    /** 防止零尺寸容器导致无效纹理。 */
    const safeWidth = Math.max(1, containerWidth)
    /** 防止零尺寸容器导致无效纹理。 */
    const safeHeight = Math.max(1, containerHeight)
    /** 同时受最大宽高约束的降采样比例。 */
    const scale = Math.min(
      this.maximumRenderWidth / safeWidth,
      this.maximumRenderHeight / safeHeight,
      1
    )
    /** 最终渲染像素宽度。 */
    const renderWidth = Math.max(1, Math.round(safeWidth * scale))
    /** 最终渲染像素高度。 */
    const renderHeight = Math.max(1, Math.round(safeHeight * scale))
    if (this.canvas.width === renderWidth && this.canvas.height === renderHeight) return
    this.canvas.width = renderWidth
    this.canvas.height = renderHeight
    this.resizeRenderTargets(renderWidth, renderHeight)
    this.draw(performance.now())
  }

  /** 返回指定时刻切歌交叉混合得到的三纹理权重。 */
  private artworkWeightsAt(timestamp: number): AppleMusicArtworkWeights {
    if (this.artworkTransitionStartedAt === 0) return this.artworkTransitionTo
    /** 当前切歌动画归一化进度。 */
    const progress = (
      timestamp - this.artworkTransitionStartedAt
    ) / APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs
    return interpolateAppleMusicArtworkWeights(
      this.artworkTransitionFrom,
      this.artworkTransitionTo,
      progress
    )
  }

  /** 返回指定时刻播放/暂停缓动得到的运动速度倍率。 */
  private motionScaleAt(timestamp: number): number {
    if (this.motionTransitionStartedAt === 0) return this.motionTransitionTo
    /** 当前速度动画归一化进度。 */
    const progress = (
      timestamp - this.motionTransitionStartedAt
    ) / APPLE_MUSIC_WEB_BACKGROUND_CONFIG.motionTransitionMs
    return interpolateAppleMusicMotionScale(
      this.motionTransitionFrom,
      this.motionTransitionTo,
      progress
    )
  }

  /** 当前是否仍有需要持续重绘的封面或速度动画。 */
  private shouldContinueAnimating(timestamp: number): boolean {
    if (this.reducedMotion || !this.hasArtwork) return false
    /** 切歌纹理交叉混合是否尚未完成。 */
    const artworkTransitioning = this.artworkTransitionStartedAt > 0 &&
      timestamp - this.artworkTransitionStartedAt <
        APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs
    /** 播放/暂停速度过渡是否尚未完成。 */
    const motionTransitioning = this.motionTransitionStartedAt > 0 &&
      timestamp - this.motionTransitionStartedAt <
        APPLE_MUSIC_WEB_BACKGROUND_CONFIG.motionTransitionMs
    return artworkTransitioning || motionTransitioning || this.motionScaleAt(timestamp) > 0.0001
  }

  /** 上传已经完成跨域校验和解码的专辑封面并平滑重定向混合权重。 */
  setArtwork(image: HTMLImageElement): void {
    if (this.destroyed) return
    /** 全部状态使用同一个高精度时间戳，避免首帧权重不一致。 */
    const timestamp = performance.now()

    if (!this.hasArtwork) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, this.artworkTextures[0])
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        image
      )
      this.hasArtwork = true
      this.displayedArtworkWeights = [1, 0, 0]
      this.artworkTransitionFrom = [1, 0, 0]
      this.artworkTransitionTo = [1, 0, 0]
      this.artworkTransitionStartedAt = 0
      this.draw(timestamp)
      this.start()
      return
    }

    /** 上一次切歌动画在此刻已经显示的权重。 */
    const currentWeights = this.artworkWeightsAt(timestamp)
    /** 优先复用当前贡献最小的纹理槽，连续切歌时视觉跳变量最小。 */
    let targetSlot = 0
    for (let slot = 1; slot < currentWeights.length; slot += 1) {
      if ((currentWeights[slot] ?? 0) < (currentWeights[targetSlot] ?? 0)) targetSlot = slot
    }
    /** 被覆盖槽先从当前画面中移除，再归一化其他槽的可见贡献。 */
    const retainedWeights = [...currentWeights] as [number, number, number]
    retainedWeights[targetSlot] = 0
    const transitionFrom = normalizeArtworkWeights(retainedWeights)
    /** 新封面最终独占的目标权重。 */
    const transitionTo: [number, number, number] = [0, 0, 0]
    transitionTo[targetSlot] = 1

    const targetTexture = this.artworkTextures[targetSlot]
    if (!targetTexture) throw new Error(`Missing artwork texture slot ${targetSlot}`)
    this.gl.bindTexture(this.gl.TEXTURE_2D, targetTexture)
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    )
    this.displayedArtworkWeights = transitionFrom
    this.artworkTransitionFrom = transitionFrom
    this.artworkTransitionTo = transitionTo
    this.artworkTransitionStartedAt = this.reducedMotion ? 0 : timestamp
    if (this.reducedMotion) this.displayedArtworkWeights = transitionTo
    this.draw(timestamp)
    this.start()
  }

  /** 清空封面并输出安全的深色底。 */
  clearArtwork(): void {
    this.hasArtwork = false
    this.displayedArtworkWeights = [1, 0, 0]
    this.artworkTransitionFrom = [1, 0, 0]
    this.artworkTransitionTo = [1, 0, 0]
    this.artworkTransitionStartedAt = 0
    this.displayedAudioEnergy = 0
    this.draw(performance.now())
    this.stop()
  }

  /** 绑定播放器的实时低频能量读取函数。 */
  setAudioEnergyProvider(provider?: () => number): void {
    this.audioEnergyProvider = provider
  }

  /**
   * 播放时平滑恢复完整速度，暂停时把运动速度缓动到零且保留当前动画相位。
   *
   * @param active 当前是否播放
   * @param immediate 初始化渲染器时是否立即采用目标速度
   */
  setMotionActive(active: boolean, immediate = false): void {
    this.motionActive = active
    /** 减少动态效果下始终冻结空间变换。 */
    const targetScale = this.reducedMotion ? 0 : (active ? 1 : 0)
    /** 全部速度状态使用同一个高精度时间戳。 */
    const timestamp = performance.now()
    this.displayedMotionScale = this.motionScaleAt(timestamp)
    this.motionTransitionFrom = immediate ? targetScale : this.displayedMotionScale
    this.motionTransitionTo = targetScale
    this.motionTransitionStartedAt = immediate || this.reducedMotion ? 0 : timestamp
    if (immediate || this.reducedMotion) this.displayedMotionScale = targetScale
    this.draw(timestamp)
    this.start()
  }

  /** 启用减少动态效果时冻结封面变换，同时保留当前静态色场。 */
  setReducedMotion(reduced: boolean): void {
    if (this.reducedMotion === reduced) return
    this.reducedMotion = reduced
    if (reduced) {
      this.displayedArtworkWeights = this.artworkTransitionTo
      this.artworkTransitionFrom = this.artworkTransitionTo
      this.artworkTransitionStartedAt = 0
      this.displayedMotionScale = 0
      this.motionTransitionFrom = 0
      this.motionTransitionTo = 0
      this.motionTransitionStartedAt = 0
      this.displayedAudioEnergy = 0
      this.stop()
      this.draw(performance.now())
      return
    }
    this.setMotionActive(this.motionActive)
  }

  /** 启动 Apple Music 网页端同样的至多 15 fps 动画循环。 */
  start(): void {
    if (this.running || this.destroyed) return
    /** 启动时是否确实还有动画工作。 */
    const timestamp = performance.now()
    if (!this.shouldContinueAnimating(timestamp)) {
      this.draw(timestamp)
      return
    }
    this.running = true
    this.lastRenderAt = 0
    this.lastClockAt = 0
    this.animationFrame = window.requestAnimationFrame(this.handleAnimationFrame)
  }

  /** 停止动画循环并保留当前纹理和相位。 */
  stop(): void {
    this.running = false
    if (this.animationFrame !== undefined) window.cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
    this.lastClockAt = 0
  }

  /** 释放全部 GPU 资源。 */
  destroy(): void {
    if (this.destroyed) return
    this.stop()
    this.destroyed = true
    this.gl.deleteBuffer(this.positionBuffer)
    for (const texture of this.artworkTextures) this.gl.deleteTexture(texture)
    for (const target of this.renderTargets) {
      this.gl.deleteFramebuffer(target.framebuffer)
      this.gl.deleteTexture(target.texture)
    }
    this.gl.deleteProgram(this.artworkProgram.program)
    this.gl.deleteProgram(this.twistProgram.program)
    this.gl.deleteProgram(this.kawaseProgram.program)
    this.gl.deleteProgram(this.adjustmentProgram.program)
  }

  /** 把四张封面 Sprite 合成到 Scene 纹理。 */
  private drawArtworkScene(target: RenderTarget, audioEnergy: number): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.gl.clearColor(0.035, 0.035, 0.04, 1)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    if (!this.hasArtwork) return

    this.bindProgram(this.artworkProgram)
    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
    this.artworkTextures.forEach((texture, index) => {
      /** 当前纹理槽对应的 sampler uniform。 */
      const uniform = this.artworkProgram.artworks[index]
      if (uniform) this.bindTexture(texture, uniform, index)
    })
    this.gl.uniform3fv(
      this.artworkProgram.artworkWeights,
      new Float32Array(this.displayedArtworkWeights)
    )
    this.gl.uniform2f(
      this.artworkProgram.resolution,
      this.canvas.width,
      this.canvas.height
    )

    /** 当前时刻四层封面的位置和旋转。 */
    const frames = createAppleMusicArtworkLayerFrames(
      this.canvas.width,
      this.canvas.height,
      this.motionTime,
      audioEnergy
    )
    for (const frame of frames) {
      this.gl.uniform2f(this.artworkProgram.center, frame.centerX, frame.centerY)
      this.gl.uniform1f(this.artworkProgram.size, frame.size)
      this.gl.uniform1f(this.artworkProgram.rotation, frame.rotation)
      this.gl.uniform1f(
        this.artworkProgram.edgeFeather,
        APPLE_MUSIC_WEB_BACKGROUND_CONFIG.spriteEdgeFeather
      )
      this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
    }
    this.gl.disable(this.gl.BLEND)
  }

  /** 对 Scene 纹理应用平方衰减的中心 Twist。 */
  private drawTwist(source: WebGLTexture, target: RenderTarget, audioEnergy: number): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.bindProgram(this.twistProgram)
    this.bindTexture(source, this.twistProgram.texture)
    this.gl.uniform2f(this.twistProgram.resolution, this.canvas.width, this.canvas.height)
    this.gl.uniform2f(
      this.twistProgram.offset,
      this.canvas.width / 2,
      this.canvas.height / 2
    )
    this.gl.uniform1f(
      this.twistProgram.radius,
      this.canvas.width * APPLE_MUSIC_WEB_BACKGROUND_CONFIG.twistRadiusRatio
    )
    this.gl.uniform1f(
      this.twistProgram.angle,
      APPLE_MUSIC_WEB_BACKGROUND_CONFIG.twistAngle * (
        1 + audioEnergy * APPLE_MUSIC_WEB_BACKGROUND_CONFIG.lowFrequencyTwistPulse
      )
    )
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  /** 执行一次 Kawase 对角采样模糊。 */
  private drawKawase(
    source: WebGLTexture,
    target: RenderTarget,
    offset: number
  ): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, target.framebuffer)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.bindProgram(this.kawaseProgram)
    this.bindTexture(source, this.kawaseProgram.texture)
    this.gl.uniform2f(this.kawaseProgram.resolution, this.canvas.width, this.canvas.height)
    this.gl.uniform1f(this.kawaseProgram.offset, offset)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  /** 把模糊结果增艳并输出到屏幕 Canvas。 */
  private drawAdjustment(source: WebGLTexture): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
    this.bindProgram(this.adjustmentProgram)
    this.bindTexture(source, this.adjustmentProgram.texture)
    this.gl.uniform1f(
      this.adjustmentProgram.saturation,
      APPLE_MUSIC_WEB_BACKGROUND_CONFIG.saturation
    )
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }

  /** 执行一次完整的 Apple Music 网页端背景后处理链。 */
  private draw(timestamp: number): void {
    if (this.destroyed || this.canvas.width < 1 || this.canvas.height < 1) return
    /** 与上一次动画相位更新之间的安全间隔。 */
    const clockDelta = this.lastClockAt === 0
      ? 0
      : Math.min(timestamp - this.lastClockAt, MAXIMUM_CLOCK_DELTA_MS)
    this.displayedArtworkWeights = this.artworkWeightsAt(timestamp)
    this.displayedMotionScale = this.motionScaleAt(timestamp)
    /** 播放时读取 50～120 Hz；暂停或减少动态效果时让律动自然释放到零。 */
    const targetAudioEnergy = this.motionActive && !this.reducedMotion
      ? clampUnit(this.audioEnergyProvider?.() ?? 0)
      : 0
    this.displayedAudioEnergy = interpolateAppleMusicAudioEnergy(
      this.displayedAudioEnergy,
      targetAudioEnergy,
      clockDelta || FRAME_INTERVAL_MS
    )
    if (!this.reducedMotion) {
      this.motionTime += clockDelta * 0.001 * this.displayedMotionScale
    }

    if (
      this.artworkTransitionStartedAt > 0 &&
      timestamp - this.artworkTransitionStartedAt >=
        APPLE_MUSIC_WEB_BACKGROUND_CONFIG.artworkTransitionMs
    ) {
      this.artworkTransitionFrom = this.artworkTransitionTo
      this.artworkTransitionStartedAt = 0
    }
    if (
      this.motionTransitionStartedAt > 0 &&
      timestamp - this.motionTransitionStartedAt >=
        APPLE_MUSIC_WEB_BACKGROUND_CONFIG.motionTransitionMs
    ) {
      this.motionTransitionFrom = this.motionTransitionTo
      this.motionTransitionStartedAt = 0
    }
    this.lastClockAt = timestamp
    this.lastRenderAt = timestamp

    /** Scene、Twist 和 Ping-Pong 模糊目标。 */
    const [sceneTarget, firstPingTarget, secondPingTarget] = this.renderTargets
    this.drawArtworkScene(sceneTarget, this.displayedAudioEnergy)
    this.drawTwist(sceneTarget.texture, firstPingTarget, this.displayedAudioEnergy)

    /** 当前模糊阶段的源纹理。 */
    let source = firstPingTarget.texture
    /** 下一次模糊写入的目标。 */
    let target = secondPingTarget
    for (const offset of APPLE_MUSIC_WEB_BACKGROUND_CONFIG.kawaseOffsets) {
      this.drawKawase(source, target, offset)
      source = target.texture
      target = target === firstPingTarget ? secondPingTarget : firstPingTarget
    }
    this.drawAdjustment(source)
    if (this.running && !this.shouldContinueAnimating(timestamp)) this.stop()
  }
}
