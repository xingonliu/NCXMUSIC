import {
  DEFAULT_FLUID_MESH_PALETTE,
  interpolateFluidMeshPalette,
  type FluidMeshPalette
} from './fluid-mesh-palette'

// ========= 类型 =========

/** FluidMeshRenderer 初始化参数。 */
export interface FluidMeshRendererOptions {
  /** 调色板完成一次切歌过渡所需的毫秒数。 */
  paletteTransitionMs?: number
  /** 低分辨率画布允许的最大宽度。 */
  maximumRenderWidth?: number
  /** 低分辨率画布允许的最大高度。 */
  maximumRenderHeight?: number
}

/** Shader 中需要频繁更新的 uniform 位置。 */
interface FluidMeshUniforms {
  /** 动画累计时间。 */
  time: WebGLUniformLocation
  /** 低分辨率画布尺寸。 */
  resolution: WebGLUniformLocation
  /** 四个节点的连续 RGB 调色板。 */
  colors: WebGLUniformLocation
  /** 播放状态驱动的流体能量。 */
  energy: WebGLUniformLocation
}

// ========= 变量 =========

/** 全屏四边形顶点 Shader。 */
const VERTEX_SHADER_SOURCE = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

/**
 * 四节点流体网格 Fragment Shader。
 * Simplex Noise 同时扭曲采样空间和节点坐标，输出端加入 3.5% 动态颗粒。
 */
const FRAGMENT_SHADER_SOURCE = `
precision highp float;

varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec3 u_colors[4];
uniform float u_energy;

vec3 permute(vec3 value) {
  return mod(((value * 34.0) + 1.0) * value, 289.0);
}

float simplexNoise(vec2 point) {
  const vec4 constants = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 lattice = floor(point + dot(point, constants.yy));
  vec2 origin = point - lattice + dot(lattice, constants.xx);
  vec2 offset = origin.x > origin.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 corners = origin.xyxy + constants.xxzz;
  corners.xy -= offset;
  lattice = mod(lattice, 289.0);
  vec3 permutation = permute(
    permute(lattice.y + vec3(0.0, offset.y, 1.0)) + lattice.x + vec3(0.0, offset.x, 1.0)
  );
  vec3 attenuation = max(
    0.5 - vec3(dot(origin, origin), dot(corners.xy, corners.xy), dot(corners.zw, corners.zw)),
    0.0
  );
  attenuation *= attenuation;
  attenuation *= attenuation;
  vec3 gradient = 2.0 * fract(permutation * constants.www) - 1.0;
  vec3 absoluteGradient = abs(gradient) - 0.5;
  vec3 gradientFloor = floor(gradient + 0.5);
  vec3 adjustedGradient = gradient - gradientFloor;
  attenuation *= 1.79284291400159 - 0.85373472095314 * (adjustedGradient * adjustedGradient + absoluteGradient * absoluteGradient);
  vec3 contribution;
  contribution.x = adjustedGradient.x * origin.x + absoluteGradient.x * origin.y;
  contribution.yz = adjustedGradient.yz * corners.xz + absoluteGradient.yz * corners.yw;
  return 130.0 * dot(attenuation, contribution);
}

float randomGrain(vec2 coordinate, float frame) {
  return fract(sin(dot(coordinate + frame, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 movingNode(vec2 anchor, float seed, float time) {
  float horizontal = simplexNoise(vec2(seed, time * 0.018 + seed * 1.7));
  float vertical = simplexNoise(vec2(time * -0.015 + seed * 2.3, seed + 4.0));
  return anchor + vec2(horizontal, vertical) * (0.075 + u_energy * 0.02);
}

void main() {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 flow = vec2(
    simplexNoise(v_uv * 1.2 + vec2(u_time * 0.014, -u_time * 0.010)),
    simplexNoise(v_uv * 1.05 + vec2(-u_time * 0.011, u_time * 0.012) + 8.4)
  );
  vec2 warpedUv = v_uv + flow * (0.075 + u_energy * 0.012);
  vec2 position = vec2(warpedUv.x * aspect, warpedUv.y);
  vec2 node0 = movingNode(vec2(0.12, 0.16), 1.3, u_time);
  vec2 node1 = movingNode(vec2(0.86, 0.20), 4.7, u_time);
  vec2 node2 = movingNode(vec2(0.72, 0.83), 8.2, u_time);
  vec2 node3 = movingNode(vec2(0.18, 0.78), 12.6, u_time);
  node0.x *= aspect;
  node1.x *= aspect;
  node2.x *= aspect;
  node3.x *= aspect;
  float weight0 = exp(-dot(position - node0, position - node0) * 2.65);
  float weight1 = exp(-dot(position - node1, position - node1) * 2.65);
  float weight2 = exp(-dot(position - node2, position - node2) * 2.65);
  float weight3 = exp(-dot(position - node3, position - node3) * 2.65);
  float weightTotal = max(weight0 + weight1 + weight2 + weight3, 0.0001);
  vec3 color = (
    u_colors[0] * weight0 +
    u_colors[1] * weight1 +
    u_colors[2] * weight2 +
    u_colors[3] * weight3
  ) / weightTotal;
  float softVariation = simplexNoise(warpedUv * 2.2 - u_time * 0.011) * 0.035;
  color *= 1.0 + softVariation;
  float frame = floor(u_time * 18.0);
  float grain = (randomGrain(gl_FragCoord.xy, frame) - 0.5) * 0.07;
  gl_FragColor = vec4(clamp(color + grain, 0.0, 1.0), 1.0);
}
`

/** 默认调色板线性插值时长。 */
const DEFAULT_PALETTE_TRANSITION_MS = 1_500

/** 默认低分辨率画布最大宽度。 */
const DEFAULT_MAXIMUM_RENDER_WIDTH = 420

/** 默认低分辨率画布最大高度。 */
const DEFAULT_MAXIMUM_RENDER_HEIGHT = 320

/** 流体背景目标帧率；模糊后 30fps 已足够连续。 */
const FRAME_INTERVAL_MS = 1_000 / 30

/** 避免窗口恢复时动画时间突然跃迁的最大帧间隔。 */
const MAXIMUM_CLOCK_DELTA_MS = 50

/** 播放状态下的 Shader 能量。 */
const PLAYING_ENERGY = 1

/** 暂停状态下保留的缓慢呼吸能量。 */
const PAUSED_ENERGY = 0.28

// ========= 函数 =========

/**
 * 编译单个 WebGL Shader，并在失败时释放资源。
 *
 * @param gl WebGL 上下文
 * @param type Shader 类型
 * @param source GLSL 源码
 */
function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  /** 新建的 Shader 对象。 */
  const shader = gl.createShader(type)
  if (!shader) throw new Error('WebGL shader allocation failed.')
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader
  /** 编译器返回的诊断信息。 */
  const log = gl.getShaderInfoLog(shader) ?? 'Unknown shader compilation error.'
  gl.deleteShader(shader)
  throw new Error(log)
}

/**
 * 链接流体背景 WebGL Program。
 *
 * @param gl WebGL 上下文
 */
function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  /** 已编译的顶点 Shader。 */
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  /** 已编译的片元 Shader。 */
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)
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
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program
  /** 链接器返回的诊断信息。 */
  const log = gl.getProgramInfoLog(program) ?? 'Unknown WebGL program link error.'
  gl.deleteProgram(program)
  throw new Error(log)
}

/** 获取必需的 uniform 位置，避免静默渲染空画面。 */
function requireUniform(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
): WebGLUniformLocation {
  /** Program 中查找到的 uniform 位置。 */
  const location = gl.getUniformLocation(program, name)
  if (!location) throw new Error(`Required WebGL uniform is unavailable: ${name}`)
  return location
}

/** 把四节点调色板展平为 uniform3fv 所需的连续数组。 */
function flattenPalette(palette: FluidMeshPalette): Float32Array {
  return new Float32Array(palette.flatMap((color) => [...color]))
}

// ========= 类 =========

/**
 * Apple Music 风格的低分辨率 WebGL 流体网格渲染器。
 * CSS 负责把画布放大和高斯弥散，本类只维护 Shader、调色板和动画时钟。
 */
export class FluidMeshRenderer {
  /** 目标 Canvas。 */
  private readonly canvas: HTMLCanvasElement

  /** Canvas 对应的 WebGL 1 上下文。 */
  private readonly gl: WebGLRenderingContext

  /** 已链接的流体网格 Program。 */
  private readonly program: WebGLProgram

  /** 全屏四边形顶点缓冲。 */
  private readonly positionBuffer: WebGLBuffer

  /** 全屏四边形顶点属性位置。 */
  private readonly positionAttribute: number

  /** 每帧更新的 uniform 位置。 */
  private readonly uniforms: FluidMeshUniforms

  /** 调色板切换线性插值时长。 */
  private readonly paletteTransitionMs: number

  /** 低分辨率画布最大宽度。 */
  private readonly maximumRenderWidth: number

  /** 低分辨率画布最大高度。 */
  private readonly maximumRenderHeight: number

  /** 当前动画帧句柄。 */
  private animationFrame: number | undefined

  /** 动画循环是否处于运行状态。 */
  private running = false

  /** 上一次实际绘制的时间戳。 */
  private lastRenderAt = 0

  /** 上一次推进 Shader 时钟的时间戳。 */
  private lastClockAt = 0

  /** 连续且可暂停的 Shader 流动时间。 */
  private flowTime = 0

  /** 当前播放状态。 */
  private motionActive = true

  /** 系统是否要求减少动态效果。 */
  private reducedMotion = false

  /** 当前画面已经显示的调色板。 */
  private displayedPalette: FluidMeshPalette = DEFAULT_FLUID_MESH_PALETTE

  /** 本轮过渡起始调色板。 */
  private transitionFrom: FluidMeshPalette = DEFAULT_FLUID_MESH_PALETTE

  /** 本轮过渡目标调色板。 */
  private transitionTo: FluidMeshPalette = DEFAULT_FLUID_MESH_PALETTE

  /** 本轮调色板过渡起始时间。 */
  private transitionStartedAt = 0

  /** 绑定实例后的 requestAnimationFrame 回调。 */
  private readonly handleAnimationFrame = (timestamp: number): void => {
    if (!this.running) return
    this.animationFrame = window.requestAnimationFrame(this.handleAnimationFrame)
    if (timestamp - this.lastRenderAt < FRAME_INTERVAL_MS) return
    this.draw(timestamp)
  }

  /**
   * 创建 WebGL 流体网格引擎。
   *
   * @param canvas 低分辨率渲染目标
   * @param options 性能与过渡参数
   */
  constructor(canvas: HTMLCanvasElement, options: FluidMeshRendererOptions = {}) {
    this.canvas = canvas
    this.paletteTransitionMs = options.paletteTransitionMs ?? DEFAULT_PALETTE_TRANSITION_MS
    this.maximumRenderWidth = options.maximumRenderWidth ?? DEFAULT_MAXIMUM_RENDER_WIDTH
    this.maximumRenderHeight = options.maximumRenderHeight ?? DEFAULT_MAXIMUM_RENDER_HEIGHT
    /** 为持续动画优化过的 WebGL 上下文。 */
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
    this.program = createProgram(gl)
    /** 全屏四边形顶点缓冲。 */
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) {
      gl.deleteProgram(this.program)
      throw new Error('WebGL vertex buffer allocation failed.')
    }
    this.positionBuffer = positionBuffer
    this.positionAttribute = gl.getAttribLocation(this.program, 'a_position')
    if (this.positionAttribute < 0) {
      this.destroy()
      throw new Error('Required WebGL position attribute is unavailable.')
    }
    this.uniforms = {
      time: requireUniform(gl, this.program, 'u_time'),
      resolution: requireUniform(gl, this.program, 'u_resolution'),
      colors: requireUniform(gl, this.program, 'u_colors[0]'),
      energy: requireUniform(gl, this.program, 'u_energy')
    }
    this.configurePipeline()
  }

  /** 配置不会逐帧变化的全屏四边形管线。 */
  private configurePipeline(): void {
    /** 覆盖裁剪空间的四边形顶点。 */
    const positions = new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1
    ])
    this.gl.useProgram(this.program)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW)
    this.gl.enableVertexAttribArray(this.positionAttribute)
    this.gl.vertexAttribPointer(this.positionAttribute, 2, this.gl.FLOAT, false, 0, 0)
    this.gl.disable(this.gl.BLEND)
    this.gl.disable(this.gl.DEPTH_TEST)
    this.gl.disable(this.gl.CULL_FACE)
  }

  /**
   * 按容器比例更新低分辨率画布，最长边保持在约 400 像素。
   *
   * @param containerWidth CSS 容器宽度
   * @param containerHeight CSS 容器高度
   */
  resize(containerWidth: number, containerHeight: number): void {
    /** 防止零尺寸容器导致的安全宽度。 */
    const safeWidth = Math.max(1, containerWidth)
    /** 防止零尺寸容器导致的安全高度。 */
    const safeHeight = Math.max(1, containerHeight)
    /** 同时受最大宽高约束的降采样比例。 */
    const scale = Math.min(
      this.maximumRenderWidth / safeWidth,
      this.maximumRenderHeight / safeHeight,
      1
    )
    /** 最终低分辨率像素宽度。 */
    const renderWidth = Math.max(1, Math.round(safeWidth * scale))
    /** 最终低分辨率像素高度。 */
    const renderHeight = Math.max(1, Math.round(safeHeight * scale))
    if (this.canvas.width === renderWidth && this.canvas.height === renderHeight) return
    this.canvas.width = renderWidth
    this.canvas.height = renderHeight
    this.gl.viewport(0, 0, renderWidth, renderHeight)
  }

  /**
   * 从当前画面开始，在 1.5 秒内线性过渡到新调色板。
   *
   * @param palette 新曲目的四节点调色板
   * @param timestamp 可注入的统一时间戳
   */
  setPalette(palette: FluidMeshPalette, timestamp = performance.now()): void {
    this.displayedPalette = this.paletteAt(timestamp)
    this.transitionFrom = this.displayedPalette
    this.transitionTo = palette
    this.transitionStartedAt = timestamp
  }

  /** 当前绑定的低频音频能量提供函数。 */
  private audioEnergyProvider: (() => number) | undefined

  /** 设置低频音频波形能量提供者。 */
  setAudioEnergyProvider(provider?: () => number): void {
    this.audioEnergyProvider = provider
  }

  /** 根据播放状态切换流点能量，暂停时仍保留极慢的呼吸。 */
  setMotionActive(active: boolean): void {
    this.motionActive = active
  }

  /** 根据系统无障碍设置停止空间位移但保留颜色切歌过渡。 */
  setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced
  }

  /** 启动至多 30fps 的动画循环。 */
  start(): void {
    if (this.running) return
    this.running = true
    this.lastRenderAt = 0
    this.lastClockAt = 0
    this.animationFrame = window.requestAnimationFrame(this.handleAnimationFrame)
  }

  /** 停止动画循环并保留当前 Shader 状态。 */
  stop(): void {
    this.running = false
    if (this.animationFrame !== undefined) window.cancelAnimationFrame(this.animationFrame)
    this.animationFrame = undefined
    this.lastClockAt = 0
  }

  /** 释放全部 GPU 资源。 */
  destroy(): void {
    this.stop()
    this.gl.deleteBuffer(this.positionBuffer)
    this.gl.deleteProgram(this.program)
  }

  /** 返回指定时刻线性插值得到的调色板。 */
  private paletteAt(timestamp: number): FluidMeshPalette {
    if (this.transitionStartedAt === 0) return this.transitionTo
    /** 本轮过渡的归一化进度。 */
    const progress = (timestamp - this.transitionStartedAt) / this.paletteTransitionMs
    return interpolateFluidMeshPalette(this.transitionFrom, this.transitionTo, progress)
  }

  /** 执行一次低分辨率 Shader 绘制。 */
  private draw(timestamp: number): void {
    /** 与上一次实际 Shader 时钟之间的间隔。 */
    const clockDelta = this.lastClockAt === 0
      ? 0
      : Math.min(timestamp - this.lastClockAt, MAXIMUM_CLOCK_DELTA_MS)
    /** 播放状态对应的流速。 */
    const motionScale = this.motionActive ? 1 : PAUSED_ENERGY
    if (!this.reducedMotion) this.flowTime += clockDelta * 0.001 * motionScale
    this.lastClockAt = timestamp
    this.lastRenderAt = timestamp
    this.displayedPalette = this.paletteAt(timestamp)
    /** 传入 Shader 的连续调色板数组。 */
    const flattenedPalette = flattenPalette(this.displayedPalette)
    /** 实时低频音频能量 [0, 1]。 */
    const audioEnergy = (this.motionActive && !this.reducedMotion)
      ? (this.audioEnergyProvider?.() ?? 0)
      : 0
    /** 播放状态对应的网格形变能量（基础能量 0.65 + 低频重拍律动 0.75 * audioEnergy）。 */
    const energy = this.reducedMotion
      ? 0
      : (this.motionActive ? PLAYING_ENERGY * (0.65 + audioEnergy * 0.75) : PAUSED_ENERGY)
    this.gl.useProgram(this.program)
    this.gl.uniform1f(this.uniforms.time, this.flowTime)
    this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height)
    this.gl.uniform3fv(this.uniforms.colors, flattenedPalette)
    this.gl.uniform1f(this.uniforms.energy, energy)
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4)
  }
}
