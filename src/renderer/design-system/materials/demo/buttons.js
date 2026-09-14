// Extracted unchanged from the supplied liquid-glass/app.js.
function tanh(x) {
  const e = Math.exp(2 * Math.max(-20, Math.min(20, x)));
  return (e - 1) / (e + 1);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}


/** androidx.compose.animation.core.SpringSimulation closed-form step. */
class Spring {
  constructor(value, dampingRatio, stiffness, threshold = 0.001) {
    this.value = value;
    this.target = value;
    this.vel = 0;
    this.z = dampingRatio;
    this.w = Math.sqrt(stiffness);
    this.threshold = threshold;
  }
  set(t) {
    this.target = t;
  }
  snap(t) {
    this.value = this.target = t;
    this.vel = 0;
  }
  get settled() {
    return Math.abs(this.value - this.target) < this.threshold && Math.abs(this.vel) < this.threshold * 25;
  }
  step(dt) {
    if (dt <= 0) return this.value;
    if (this.settled) {
      this.value = this.target;
      this.vel = 0;
      return this.value;
    }
    const z = this.z;
    const w = this.w;
    const disp = this.value - this.target;
    const v0 = this.vel;
    let x;
    let v;
    if (z > 1) {
      const adj = Math.sqrt(z * z - 1);
      const gp = w * (z + adj);
      const gm = w * (z - adj);
      const b = (gm * disp - v0) / (gm - gp);
      const a = disp - b;
      const e1 = Math.exp(-gm * dt);
      const e2 = Math.exp(-gp * dt);
      x = a * e1 + b * e2;
      v = a * -gm * e1 + b * -gp * e2;
    } else if (Math.abs(z - 1) < 1e-5) {
      const a = disp;
      const b = v0 + w * disp;
      const e = Math.exp(-w * dt);
      x = (a + b * dt) * e;
      v = (a + b * dt) * e * -w + b * e;
    } else {
      const wd = w * Math.sqrt(1 - z * z);
      const a = disp;
      const b = (1 / wd) * (z * w * disp + v0);
      const e = Math.exp(-z * w * dt);
      const s = Math.sin(wd * dt);
      const c = Math.cos(wd * dt);
      x = e * (a * c + b * s);
      v = x * -z * w + e * (-wd * a * s + wd * b * c);
    }
    this.value = x + this.target;
    this.vel = v;
    return this.value;
  }
}


/** Kyant InteractiveHighlight — press spring 0.5/300, drag snap, release spring-back. */
class InteractiveHighlight {
  constructor() {
    this.press = new Spring(0, 0.5, 300, 0.001);
    this.px = new Spring(0, 0.5, 300, 0.5);
    this.py = new Spring(0, 0.5, 300, 0.5);
    this.startX = 0;
    this.startY = 0;
    this.down = false;
    this.moved = false;
  }
  get offsetX() {
    return this.px.value - this.startX;
  }
  get offsetY() {
    return this.py.value - this.startY;
  }
  start(lx, ly) {
    this.down = true;
    this.moved = false;
    this.startX = lx;
    this.startY = ly;
    this.px.snap(lx);
    this.py.snap(ly);
    this.press.set(1);
  }
  move(lx, ly) {
    if (!this.down) return;
    if (Math.abs(lx - this.startX) + Math.abs(ly - this.startY) > 10) this.moved = true;
    this.px.snap(lx);
    this.py.snap(ly);
  }
  end() {
    this.down = false;
    this.press.set(0);
    this.px.set(this.startX);
    this.py.set(this.startY);
  }
  step(dt) {
    this.press.step(dt);
    this.px.step(dt);
    this.py.step(dt);
  }
}


function capsule(w, h) {
  return Math.min(w, h) / 2;
}


function buttonDeform(w, h, hl) {
  const progress = hl.press.value;
  const scale = lerp(1, 1 + 4 / h, progress);
  const maxOffset = Math.min(w, h);
  const ox = hl.offsetX;
  const oy = hl.offsetY;
  const tx = maxOffset * tanh(0.05 * ox / Math.max(maxOffset, 1));
  const ty = maxOffset * tanh(0.05 * oy / Math.max(maxOffset, 1));
  const maxDragScale = 4 / h;
  const ang = Math.atan2(oy, ox);
  const maxDim = Math.max(w, h);
  const sx =
    scale +
    maxDragScale * Math.abs(Math.cos(ang) * ox / maxDim) * Math.min(w / h, 1);
  const sy =
    scale +
    maxDragScale * Math.abs(Math.sin(ang) * oy / maxDim) * Math.min(h / w, 1);
  return { tx, ty, sx, sy, progress, ox, oy };
}

function drawButton(r, x, y, w, h, hl, opts = {}) {
  const d = buttonDeform(w, h, hl);
  const surface = opts.tint
    ? [opts.tint[0], opts.tint[1], opts.tint[2], 0.75]
    : opts.surface || [0, 0, 0, 0];
  r.glass({
    x, y, w, h,
    radius: capsule(w, h),
    tx: d.tx,
    ty: d.ty,
    scaleX: d.sx,
    scaleY: d.sy,
    vibrancy: true,
    blur: 2,
    refractionHeight: 12,
    refractionAmount: 24,
    surface,
    highlight: "default",
    pressProgress: d.progress,
    pressPos: [clamp(d.ox + w / 2, 0, w), clamp(d.oy + h / 2, 0, h)],
  });
  if (opts.labelEl) {
    opts.labelEl.style.left = `${x}px`;
    opts.labelEl.style.top = `${y}px`;
    opts.labelEl.style.width = `${w}px`;
    opts.labelEl.style.height = `${h}px`;
    opts.labelEl.style.transform = `translate(${d.tx}px, ${d.ty}px) scale(${d.sx}, ${d.sy})`;
    opts.labelEl.style.transformOrigin = "center center";
  }
}


export { InteractiveHighlight, buttonDeform, drawButton };
