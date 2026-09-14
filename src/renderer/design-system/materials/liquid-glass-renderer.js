/**
 * Kyant AndroidLiquidGlass (Backdrop) — WebGL 1:1 port.
 * Source: D:/code/chat/docs/liquid-glass/renderer.js
 * AGSL from backdrop/src/commonMain/kotlin/com/kyant/backdrop/internal/Shaders.kt
 * Color matrix from effects/ColorFilter.kt
 * Blur sigma = Skia ConvertRadiusToSigma(radius) = 0.57735 * r + 0.5
 *
 * Overlay hosts pass `{ alpha: true, preserveDrawingBuffer: true }` so glass
 * can be drawn onto a transparent canvas and copied onto component surfaces.
 * Shader programs and glass() uniforms stay identical to the demo.
 */

const SDF = `
float radiusAt(vec2 coord, vec4 radii) {
  if (coord.x >= 0.0) {
    if (coord.y <= 0.0) return radii.y;
    else return radii.z;
  } else {
    if (coord.y <= 0.0) return radii.x;
    else return radii.w;
  }
}

float sdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
  vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
  float outside = length(max(cornerCoord, 0.0)) - radius;
  float inside = min(max(cornerCoord.x, cornerCoord.y), 0.0);
  return outside + inside;
}

vec2 gradSdRoundedRect(vec2 coord, vec2 halfSize, float radius) {
  vec2 cornerCoord = abs(coord) - (halfSize - vec2(radius));
  if (cornerCoord.x >= 0.0 || cornerCoord.y >= 0.0) {
    return sign(coord) * normalize(max(cornerCoord, 0.0) + 1e-6);
  } else {
    float gradX = step(cornerCoord.y, cornerCoord.x);
    return sign(coord) * vec2(gradX, 1.0 - gradX);
  }
}

float circleMap(float x) {
  return 1.0 - sqrt(max(1.0 - x * x, 0.0));
}
`;

const VS_BLIT = `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec2 aUv;
uniform vec4 uUvRect;
out vec2 vUv;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  vUv = mix(uUvRect.xy, uUvRect.zw, aUv);
}`;

const FS_BLIT = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 fragColor;
void main() {
  fragColor = texture(uTex, vUv);
}`;

const FS_COLOR = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uBrightness;
uniform float uContrast;
uniform float uSaturation;
out vec4 fragColor;
void main() {
  vec4 s = texture(uTex, vUv);
  float invSat = 1.0 - uSaturation;
  float r = 0.213 * invSat;
  float g = 0.715 * invSat;
  float b = 0.072 * invSat;
  float c = uContrast;
  float t = 0.5 - c * 0.5 + uBrightness;
  float cr = c * r, cg = c * g, cb = c * b, cs = c * uSaturation;
  vec3 rgb = vec3(
    (cr + cs) * s.r + cg * s.g + cb * s.b + t,
    cr * s.r + (cg + cs) * s.g + cb * s.b + t,
    cr * s.r + cg * s.g + (cb + cs) * s.b + t
  );
  fragColor = vec4(clamp(rgb, 0.0, 1.0), s.a);
}`;

const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uDir;
uniform int uRadius;
uniform float uWeights[32];
out vec4 fragColor;
void main() {
  vec4 acc = texture(uTex, vUv) * uWeights[0];
  for (int i = 1; i <= 31; i++) {
    if (i > uRadius) break;
    vec2 off = uDir * uTexel * float(i);
    acc += texture(uTex, vUv + off) * uWeights[i];
    acc += texture(uTex, vUv - off) * uWeights[i];
  }
  fragColor = acc;
}`;

const VS_IMAGE = `#version 300 es
layout(location = 0) in vec2 aLocal;
uniform vec2 uSize;
uniform vec2 uLayout;
uniform vec2 uCanvas;
out vec2 vUv;
void main() {
  vec2 screen = aLocal * uSize + uLayout;
  vUv = vec2(aLocal.x, 1.0 - aLocal.y);
  vec2 ndc = vec2(screen.x / uCanvas.x * 2.0 - 1.0, 1.0 - screen.y / uCanvas.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FS_IMAGE = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
out vec4 fragColor;
void main() {
  fragColor = texture(uTex, vUv);
}`;

const VS_GLASS = `#version 300 es
layout(location = 0) in vec2 aLocal;
uniform vec2 uSize;
uniform vec2 uLayout;
uniform vec2 uTranslation;
uniform vec2 uScale;
uniform float uRotation;
uniform vec2 uOrigin;
uniform vec2 uCanvas;
uniform float uPad;
out vec2 vLocal;
out vec2 vScreen;
void main() {
  vec2 local = aLocal * (uSize + vec2(uPad * 2.0)) - vec2(uPad);
  vec2 origin = uOrigin * uSize;
  vec2 p = local - origin;
  p *= uScale;
  float rad = uRotation * 0.017453292519943295;
  float cs = cos(rad), sn = sin(rad);
  p = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
  vec2 screen = p + origin + uLayout + uTranslation;
  vLocal = local;
  vScreen = screen;
  vec2 ndc = vec2(screen.x / uCanvas.x * 2.0 - 1.0, 1.0 - screen.y / uCanvas.y * 2.0);
  gl_Position = vec4(ndc, 0.0, 1.0);
}`;

const FS_GLASS = `#version 300 es
precision highp float;
in vec2 vLocal;
in vec2 vScreen;
uniform sampler2D uContent;
uniform vec2 uCanvas;
uniform vec2 uSize;
uniform vec4 uCornerRadii;
uniform float uRefractionHeight;
uniform float uRefractionAmount;
uniform float uDepthEffect;
uniform float uChromaticAberration;
uniform vec2 uScale;
uniform float uRotation;
uniform vec4 uSurface;
uniform int uHighlightStyle;
uniform vec4 uHighlightColor;
uniform float uHighlightWidth;
uniform float uHighlightBlur;
uniform float uHighlightAngle;
uniform float uHighlightFalloff;
uniform float uHighlightAlpha;
uniform vec4 uInnerShadowColor;
uniform float uInnerShadowRadius;
uniform float uInnerShadowOffsetY;
uniform float uInnerShadowAlpha;
uniform float uPressProgress;
uniform vec2 uPressPos;
uniform vec4 uShadowColor;
uniform float uShadowRadius;
uniform float uShadowOffsetY;
uniform int uPass; // 0 glass, 1 shadow
out vec4 fragColor;

${SDF}

vec2 toSceneUv(vec2 screen) {
  return vec2(screen.x / uCanvas.x, 1.0 - screen.y / uCanvas.y);
}

vec2 rotateScale(vec2 v) {
  float rad = uRotation * 0.017453292519943295;
  float cs = cos(rad), sn = sin(rad);
  vec2 s = v * uScale;
  return vec2(s.x * cs - s.y * sn, s.x * sn + s.y * cs);
}

vec4 sampleContent(vec2 screen) {
  vec2 uv = toSceneUv(screen);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture(uContent, uv);
}

vec4 sampleLens(vec2 screen, vec2 disp) {
  return sampleContent(screen + disp);
}

void main() {
  vec2 halfSize = uSize * 0.5;
  vec2 centeredCoord = vLocal - halfSize;
  float radius = radiusAt(vLocal, uCornerRadii);
  radius = min(radius, min(halfSize.x, halfSize.y));
  float sd = sdRoundedRect(centeredCoord, halfSize, radius);

  if (uPass == 1) {
    float sigma = 0.57735 * uShadowRadius + 0.5;
    vec2 shCoord = centeredCoord - vec2(0.0, uShadowOffsetY);
    float ssd = sdRoundedRect(shCoord, halfSize, radius);
    float shadow = 1.0 / (1.0 + exp(ssd * 2.0 / max(sigma, 0.001)));
    fragColor = vec4(uShadowColor.rgb, uShadowColor.a * shadow);
    return;
  }

  float aa = max(fwidth(sd), 0.75);
  float shapeAlpha = 1.0 - smoothstep(-aa, aa, sd);
  if (shapeAlpha < 0.001) discard;

  vec4 color;
  vec2 gradRadius2 = vec2(min(radius * 1.5, min(halfSize.x, halfSize.y)));
  vec2 grad = normalize(
    gradSdRoundedRect(centeredCoord, halfSize, gradRadius2.x)
    + uDepthEffect * normalize(centeredCoord + 1e-5)
  );

  if (uRefractionHeight <= 0.0 || -sd >= uRefractionHeight) {
    color = sampleContent(vScreen);
  } else {
    float sdClamped = min(sd, 0.0);
    float d = circleMap(1.0 - (-sdClamped) / uRefractionHeight) * uRefractionAmount;
    vec2 localDisp = d * grad;
    vec2 disp = rotateScale(localDisp);

    if (uChromaticAberration <= 0.0) {
      color = sampleLens(vScreen, disp);
    } else {
      float dispersionIntensity = uChromaticAberration
        * ((centeredCoord.x * centeredCoord.y) / (halfSize.x * halfSize.y));
      vec2 dispersed = disp * dispersionIntensity;

      vec4 acc = vec4(0.0);
      vec4 red = sampleLens(vScreen, disp + dispersed);
      acc.r += red.r / 3.5; acc.a += red.a / 7.0;
      vec4 orange = sampleLens(vScreen, disp + dispersed * (2.0 / 3.0));
      acc.r += orange.r / 3.5; acc.g += orange.g / 7.0; acc.a += orange.a / 7.0;
      vec4 yellow = sampleLens(vScreen, disp + dispersed * (1.0 / 3.0));
      acc.r += yellow.r / 3.5; acc.g += yellow.g / 3.5; acc.a += yellow.a / 7.0;
      vec4 green = sampleLens(vScreen, disp);
      acc.g += green.g / 3.5; acc.a += green.a / 7.0;
      vec4 cyan = sampleLens(vScreen, disp - dispersed * (1.0 / 3.0));
      acc.g += cyan.g / 3.5; acc.b += cyan.b / 3.0; acc.a += cyan.a / 7.0;
      vec4 blue = sampleLens(vScreen, disp - dispersed * (2.0 / 3.0));
      acc.b += blue.b / 3.0; acc.a += blue.a / 7.0;
      vec4 purple = sampleLens(vScreen, disp - dispersed);
      acc.r += purple.r / 7.0; acc.b += purple.b / 3.0; acc.a += purple.a / 7.0;
      color = acc;
    }
  }

  color.rgb = color.rgb * (1.0 - uSurface.a) + uSurface.rgb * uSurface.a;
  color.a = color.a * (1.0 - uSurface.a) + uSurface.a;

  if (uInnerShadowAlpha > 0.001 && uInnerShadowRadius > 0.0) {
    float sigma = 0.57735 * uInnerShadowRadius + 0.5;
    vec2 ic = centeredCoord - vec2(0.0, uInnerShadowOffsetY);
    float isd = sdRoundedRect(ic, halfSize, radius);
    float inner = clamp(0.5 + isd / max(sigma * 2.0, 0.001), 0.0, 1.0);
    inner *= (1.0 - smoothstep(-aa, aa, sd));
    color.rgb = mix(color.rgb, uInnerShadowColor.rgb, inner * uInnerShadowColor.a * uInnerShadowAlpha);
  }

  if (uHighlightStyle > 0 && uHighlightAlpha > 0.001) {
    float inner = max(-sd, 0.0);
    float hw = max(uHighlightWidth, 0.35);
    float hb = max(uHighlightBlur, 0.15);
    float stroke = 1.0 - smoothstep(hw, hw + hb + aa, inner);
    stroke *= shapeAlpha;
    float intensity = 1.0;
    if (uHighlightStyle >= 2) {
      vec2 g = gradSdRoundedRect(centeredCoord, halfSize, min(radius * 1.5, min(halfSize.x, halfSize.y)));
      vec2 n = vec2(cos(uHighlightAngle), sin(uHighlightAngle));
      float dt = dot(g, n);
      intensity = pow(abs(dt), uHighlightFalloff);
      if (uHighlightStyle == 3) {
        float t = step(0.0, dt);
        vec3 amb = vec3(t);
        color.rgb = mix(color.rgb, amb, intensity * uHighlightAlpha * stroke * 0.38);
      }
    }
    if (uHighlightStyle != 3) {
      color.rgb += uHighlightColor.rgb * uHighlightColor.a * intensity * stroke * uHighlightAlpha;
    }
  }

  if (uPressProgress > 0.001) {
    color.rgb += vec3(0.08) * uPressProgress;
    float dist = distance(vLocal, uPressPos);
    float radiusP = min(uSize.x, uSize.y) * 1.5;
    float intensity = smoothstep(radiusP, radiusP * 0.5, dist);
    color.rgb += vec3(0.15) * uPressProgress * intensity;
  }

  fragColor = vec4(color.rgb, color.a * shapeAlpha);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    console.error(log, src);
    throw new Error(log);
  }
  return s;
}

function program(gl, vs, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(p));
  }
  const loc = {};
  const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES);
  for (let i = 0; i < na; i++) {
    const a = gl.getActiveAttrib(p, i);
    loc[a.name] = gl.getAttribLocation(p, a.name);
  }
  const nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < nu; i++) {
    const u = gl.getActiveUniform(p, i);
    loc[u.name.replace(/\[0]$/, "")] = gl.getUniformLocation(p, u.name);
  }
  return { p, loc };
}

function createTarget(gl, w, h) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fbo, w, h };
}

function destroyTarget(gl, t) {
  if (!t) return;
  gl.deleteFramebuffer(t.fbo);
  gl.deleteTexture(t.tex);
}

function gaussianWeights(radiusPx) {
  const sigma = 0.57735 * radiusPx + 0.5;
  const r = Math.max(1, Math.min(31, Math.ceil(sigma * 3)));
  const w = new Float32Array(32);
  let sum = 0;
  const center = Math.exp(0);
  w[0] = center;
  sum += center;
  for (let i = 1; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    w[i] = v;
    sum += v * 2;
  }
  for (let i = 0; i <= r; i++) w[i] /= sum;
  return { w, r, sigma };
}

class LiquidGlassRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", {
      alpha: options.alpha === true,
      antialias: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: options.preserveDrawingBuffer === true,
    });
    if (!gl) throw new Error("WebGL2 required");
    this.gl = gl;
    this.dpr = 1;
    this.cssW = 1;
    this.cssH = 1;

    this.blit = program(gl, VS_BLIT, FS_BLIT);
    this.color = program(gl, VS_BLIT, FS_COLOR);
    this.blur = program(gl, VS_BLIT, FS_BLUR);
    this.glassProg = program(gl, VS_GLASS, FS_GLASS);
    this.imageProg = program(gl, VS_IMAGE, FS_IMAGE);

    this.quad = gl.createVertexArray();
    gl.bindVertexArray(this.quad);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1, 0, 0,
         1, -1, 1, 0,
        -1,  1, 0, 1,
         1,  1, 1, 1,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 8);
    this._unitUvRect = [0, 0, 1, 1];

    this.unit = gl.createVertexArray();
    gl.bindVertexArray(this.unit);
    const ub = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, ub);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        1, 1,
      ]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    this.wallpaperTex = gl.createTexture();
    this.wallpaperImg = null;
    this.scene = null;
    this.ping = null;
    this.pong = null;
    this.combo = null;
    this.stampTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.stampTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    this.coverUv = [0, 0, 1, 1];
  }

  resize(cssW, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    const w = Math.max(1, Math.round(cssW * dpr));
    const h = Math.max(1, Math.round(cssH * dpr));
    if (this.canvas.width === w && this.canvas.height === h && this.scene) return;
    this.canvas.width = w;
    this.canvas.height = h;
    const gl = this.gl;
    destroyTarget(gl, this.scene);
    destroyTarget(gl, this.ping);
    destroyTarget(gl, this.pong);
    destroyTarget(gl, this.combo);
    this.scene = createTarget(gl, w, h);
    this.ping = createTarget(gl, w, h);
    this.pong = createTarget(gl, w, h);
    this.combo = createTarget(gl, w, h);
    this._updateCover();
  }

  setWallpaper(img) {
    const source = this._untaintedSource(img);
    this.wallpaperImg = source;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.wallpaperTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this._updateCover();
  }

  _untaintedSource(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  _updateCover() {
    const img = this.wallpaperImg;
    if (!img || !this.scene) return;
    const viewW = this.scene.w;
    const viewH = this.scene.h;
    const scale = Math.max(viewW / img.width, viewH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    const ox = (dw - viewW) / 2 / dw;
    const oy = (dh - viewH) / 2 / dh;
    this.coverUv = [ox, oy, ox + viewW / dw, oy + viewH / dh];
  }

  _bindQuad(prog, uvRect = [0, 0, 1, 1]) {
    const gl = this.gl;
    gl.bindVertexArray(this.quad);
    gl.useProgram(prog.p);
    if (prog.loc.uUvRect) {
      gl.uniform4f(prog.loc.uUvRect, uvRect[0], uvRect[1], uvRect[2], uvRect[3]);
    }
  }

  _drawQuadTo(fbo, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, w, h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  _drawWallpaper(target) {
    const gl = this.gl;
    this._bindQuad(this.blit, this.coverUv);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.wallpaperTex);
    gl.uniform1i(this.blit.loc.uTex, 0);
    this._drawQuadTo(target.fbo, target.w, target.h);
  }

  _colorBlit(srcTex, dst, brightness, contrast, saturation) {
    const gl = this.gl;
    this._bindQuad(this.color);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.color.loc.uTex, 0);
    gl.uniform1f(this.color.loc.uBrightness, brightness);
    gl.uniform1f(this.color.loc.uContrast, contrast);
    gl.uniform1f(this.color.loc.uSaturation, saturation);
    this._drawQuadTo(dst.fbo, dst.w, dst.h);
  }

  _blur(src, radiusPx) {
    if (radiusPx <= 0.05) return src;
    const gl = this.gl;
    const { w, r } = gaussianWeights(radiusPx);
    const run = (from, to, dirX, dirY) => {
      this._bindQuad(this.blur);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, from.tex);
      gl.uniform1i(this.blur.loc.uTex, 0);
      gl.uniform2f(this.blur.loc.uTexel, 1 / from.w, 1 / from.h);
      gl.uniform2f(this.blur.loc.uDir, dirX, dirY);
      gl.uniform1i(this.blur.loc.uRadius, r);
      gl.uniform1fv(this.blur.loc.uWeights, w);
      this._drawQuadTo(to.fbo, to.w, to.h);
    };
    run(src, this.pong, 1, 0);
    run(this.pong, this.ping, 0, 1);
    return this.ping;
  }

  begin() {
    this._drawWallpaper(this.scene);
    this._bindQuad(this.blit);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.scene.tex);
    gl.uniform1i(this.blit.loc.uTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  loadSceneSource(source) {
    if (!this.scene || !source) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.wallpaperTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.coverUv = [0, 0, 1, 1];
    this._drawWallpaper(this.scene);
  }

  clearOutput() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  fillRounded(x, y, w, h, r, color) {
    const dpr = this.dpr;
    this._drawGlass({
      x: x * dpr,
      y: y * dpr,
      w: w * dpr,
      h: h * dpr,
      radii: [r, r, r, r].map((v) => v * dpr),
      tx: 0, ty: 0, scaleX: 1, scaleY: 1, rotation: 0,
      refractionHeight: 0, refractionAmount: 0, depthEffect: 0, chromaticAberration: 0,
      surface: color,
      highlightStyle: 0,
      highlightColor: [1, 1, 1, 0],
      highlightWidth: 0, highlightBlur: 0, highlightAngle: 0, highlightFalloff: 1, highlightAlpha: 0,
      innerShadowColor: [0, 0, 0, 0], innerShadowRadius: 0, innerShadowOffsetY: 0, innerShadowAlpha: 0,
      pressProgress: 0, pressPos: [0, 0],
      shadowColor: [0, 0, 0, 0], shadowRadius: 0, shadowOffsetY: 0,
      pass: 0,
      content: this.scene,
      solid: true,
    });
  }

  _copyTarget(src, dst) {
    const gl = this.gl;
    this._bindQuad(this.blit);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, src.tex);
    gl.uniform1i(this.blit.loc.uTex, 0);
    this._drawQuadTo(dst.fbo, dst.w, dst.h);
  }

  stamp(canvas, x, y, w, h, dest = "screen") {
    if (!canvas || w <= 0 || h <= 0) return;
    const gl = this.gl;
    const d = this.dpr;
    gl.bindTexture(gl.TEXTURE_2D, this.stampTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    const target = dest === "combo" ? this.combo : dest === "scene" ? this.scene : null;
    gl.bindVertexArray(this.unit);
    gl.useProgram(this.imageProg.p);
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, target.w, target.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stampTex);
    gl.uniform1i(this.imageProg.loc.uTex, 0);
    gl.uniform2f(this.imageProg.loc.uSize, w * d, h * d);
    gl.uniform2f(this.imageProg.loc.uLayout, x * d, y * d);
    gl.uniform2f(this.imageProg.loc.uCanvas, this.scene.w, this.scene.h);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  combineWithStamp(canvas, x, y, w, h, fromBlurred) {
    const src = fromBlurred || this.scene;
    this._copyTarget(src, this.combo);
    this.stamp(canvas, x, y, w, h, "combo");
    return this.combo;
  }

  glass(params) {
    const d = this.dpr;
    const p = params;
    const r = p.radii || [p.radius, p.radius, p.radius, p.radius];
    const sat = p.vibrancy ? (p.saturation ?? 1.5) : (p.saturation ?? 1);
    const bri = p.brightness ?? 0;
    const con = p.contrast ?? 1;

    let content = p.combined || this.scene;
    if (!p.combined) {
      if (sat !== 1 || bri !== 0 || con !== 1) {
        this._colorBlit(this.scene.tex, this.ping, bri, con, sat);
        content = this.ping;
      }
      const blurPx = (p.blur || 0) * d;
      if (blurPx > 0.05) {
        content = this._blur(content, blurPx);
      }
    }

    const highlight = p.highlight || "default";
    const style = highlight === "none" ? 0 : highlight === "plain" ? 1 : highlight === "ambient" ? 3 : 2;
    const hw = (p.highlightWidth ?? 0.5) * d;
    const hb = (p.highlightBlur ?? hw / 2) * d;
    const shadowOn = p.shadow !== false && p.shadow !== 0;
    const shadowR = (p.shadowRadius ?? 24) * d;
    const shadowOy = (p.shadowOffsetY ?? (p.shadowRadius ?? 24) / 6) * d;
    const shadowCol = p.shadowColor || [0, 0, 0, 0.1 * (p.shadowAlpha ?? 1)];

    const common = {
      x: p.x * d,
      y: p.y * d,
      w: p.w * d,
      h: p.h * d,
      radii: r.map((v) => Math.max(0, v * d)),
      tx: (p.tx || 0) * d,
      ty: (p.ty || 0) * d,
      scaleX: p.scaleX ?? 1,
      scaleY: p.scaleY ?? 1,
      rotation: p.rotation || 0,
      refractionHeight: (p.refractionHeight || 0) * d,
      refractionAmount: -(p.refractionAmount || 0) * d,
      depthEffect: p.depthEffect ? 1 : 0,
      chromaticAberration: p.chromaticAberration || 0,
      surface: p.surface || [0, 0, 0, 0],
      highlightStyle: style,
      highlightColor: p.highlightColor || [1, 1, 1, highlight === "plain" ? 0.38 : 0.5],
      highlightWidth: hw,
      highlightBlur: hb,
      highlightAngle: ((p.highlightAngle ?? 45) * Math.PI) / 180,
      highlightFalloff: p.highlightFalloff ?? 1,
      highlightAlpha: p.highlightAlpha ?? 1,
      innerShadowColor: p.innerShadowColor || [0, 0, 0, 0.15],
      innerShadowRadius: (p.innerShadowRadius || 0) * d,
      innerShadowOffsetY: (p.innerShadowOffsetY ?? p.innerShadowRadius ?? 0) * d,
      innerShadowAlpha: p.innerShadowAlpha ?? (p.innerShadowRadius ? 1 : 0),
      pressProgress: p.pressProgress || 0,
      pressPos: p.pressPos ? [p.pressPos[0] * d, p.pressPos[1] * d] : [p.w * d * 0.5, p.h * d * 0.5],
      shadowColor: shadowCol,
      shadowRadius: shadowR,
      shadowOffsetY: shadowOy,
      content,
    };

    if (shadowOn && shadowCol[3] > 0) {
      this._drawGlass({ ...common, pass: 1 });
    }
    this._drawGlass({ ...common, pass: 0 });
  }

  _drawGlass(g) {
    const gl = this.gl;
    const prog = this.glassProg;
    gl.bindVertexArray(this.unit);
    gl.useProgram(prog.p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, g.content.tex);
    gl.uniform1i(prog.loc.uContent, 0);
    gl.uniform2f(prog.loc.uCanvas, this.scene.w, this.scene.h);
    gl.uniform2f(prog.loc.uSize, g.w, g.h);
    gl.uniform2f(prog.loc.uLayout, g.x, g.y);
    gl.uniform2f(prog.loc.uTranslation, g.tx, g.ty);
    gl.uniform2f(prog.loc.uScale, g.scaleX, g.scaleY);
    gl.uniform1f(prog.loc.uRotation, g.rotation);
    gl.uniform2f(prog.loc.uOrigin, 0.5, 0.5);
    gl.uniform4f(prog.loc.uCornerRadii, g.radii[0], g.radii[1], g.radii[2], g.radii[3]);
    gl.uniform1f(prog.loc.uRefractionHeight, g.refractionHeight);
    gl.uniform1f(prog.loc.uRefractionAmount, g.refractionAmount);
    gl.uniform1f(prog.loc.uDepthEffect, g.depthEffect);
    gl.uniform1f(prog.loc.uChromaticAberration, g.chromaticAberration);
    gl.uniform4f(prog.loc.uSurface, g.surface[0], g.surface[1], g.surface[2], g.surface[3]);
    gl.uniform1i(prog.loc.uHighlightStyle, g.highlightStyle);
    gl.uniform4f(prog.loc.uHighlightColor, g.highlightColor[0], g.highlightColor[1], g.highlightColor[2], g.highlightColor[3]);
    gl.uniform1f(prog.loc.uHighlightWidth, g.highlightWidth);
    gl.uniform1f(prog.loc.uHighlightBlur, g.highlightBlur);
    gl.uniform1f(prog.loc.uHighlightAngle, g.highlightAngle);
    gl.uniform1f(prog.loc.uHighlightFalloff, g.highlightFalloff);
    gl.uniform1f(prog.loc.uHighlightAlpha, g.highlightAlpha);
    gl.uniform4f(prog.loc.uInnerShadowColor, g.innerShadowColor[0], g.innerShadowColor[1], g.innerShadowColor[2], g.innerShadowColor[3]);
    gl.uniform1f(prog.loc.uInnerShadowRadius, g.innerShadowRadius);
    gl.uniform1f(prog.loc.uInnerShadowOffsetY, g.innerShadowOffsetY);
    gl.uniform1f(prog.loc.uInnerShadowAlpha, g.innerShadowAlpha);
    gl.uniform1f(prog.loc.uPressProgress, g.pressProgress);
    gl.uniform2f(prog.loc.uPressPos, g.pressPos[0], g.pressPos[1]);
    gl.uniform4f(prog.loc.uShadowColor, g.shadowColor[0], g.shadowColor[1], g.shadowColor[2], g.shadowColor[3]);
    gl.uniform1f(prog.loc.uShadowRadius, g.shadowRadius);
    gl.uniform1f(prog.loc.uShadowOffsetY, g.shadowOffsetY);
    gl.uniform1i(prog.loc.uPass, g.pass);
    gl.uniform1f(prog.loc.uPad, g.pass === 1 ? g.shadowRadius + Math.abs(g.shadowOffsetY) : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.disable(gl.BLEND);
  }

  end() {}
}

export { LiquidGlassRenderer };
