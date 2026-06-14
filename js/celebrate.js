import { showToast } from './toast.js';

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;

const COLORS = ['#bf3636', '#2e7d32', '#1976d2', '#f9a825', '#8e24aa', '#00acc1', '#ff7043', '#ec407a'];

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed; inset:0; width:100%; height:100%; pointer-events:none; z-index:3000;';
  document.body.appendChild(canvas);
  ctx = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
}

function resize() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function spawn(count) {
  ensureCanvas();
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: cx + (Math.random() - 0.5) * 80,
      y: H * 0.32,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 5,
      g: 0.14 + Math.random() * 0.12,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      life: 1
    });
  }
  if (!rafId) loop();
}

function loop() {
  rafId = requestAnimationFrame(loop);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles.forEach((p) => {
    p.vy += p.g;
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.99;
    p.rot += p.vr;
    p.life -= 0.008;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
    ctx.restore();
  });
  particles = particles.filter((p) => p.life > 0 && p.y < window.innerHeight + 60);
  if (particles.length === 0) {
    cancelAnimationFrame(rafId);
    rafId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

export function celebrate(message, big = false) {
  if (!prefersReducedMotion()) {
    spawn(big ? 160 : 55);
    if (big) {
      setTimeout(() => spawn(130), 220);
      setTimeout(() => spawn(110), 480);
    }
  }
  if (message) showToast(message);
}
