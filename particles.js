/**
 * particles.js — Sistema de Partículas de Fondo
 *
 * Simula un campo de partículas flotantes tipo "moléculas BMP"
 * con líneas de conexión entre partículas cercanas.
 * Corre en el canvas de fondo para no interferir con el contenido.
 */

class ParticleSystem {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.particles = [];
    this.mouse     = { x: -9999, y: -9999 };
    this.frameCount = 0;

    // Colores del tema
    this.palette = [
      'rgba(56, 189, 248,',   // azul
      'rgba(167, 139, 250,',  // púrpura
      'rgba(244, 114, 182,',  // rosa
      'rgba(52,  211, 153,',  // verde
      'rgba(232, 213, 163,',  // hueso
    ];

    this._resize();
    this._init();
    this._bindEvents();
    this._loop();
  }

  _resize() {
    this.canvas.width  = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  _init() {
    const count = Math.floor((window.innerWidth * window.innerHeight) / 18000);
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push(this._makeParticle());
    }
  }

  _makeParticle() {
    const color = this.palette[Math.floor(Math.random() * this.palette.length)];
    return {
      x:   Math.random() * this.canvas.width,
      y:   Math.random() * this.canvas.height,
      vx:  (Math.random() - 0.5) * 0.35,
      vy:  (Math.random() - 0.5) * 0.35,
      r:   1.0 + Math.random() * 2.0,
      color,
      alpha:  0.2 + Math.random() * 0.5,
      pulseOffset: Math.random() * Math.PI * 2,
    };
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this._resize();
      this._init();
    });
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  _loop() {
    this._update();
    this._draw();
    requestAnimationFrame(() => this._loop());
  }

  _update() {
    this.frameCount++;
    for (const p of this.particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Rebotar en bordes suavemente
      if (p.x < 0)                    { p.x = 0;                    p.vx *= -1; }
      if (p.x > this.canvas.width)    { p.x = this.canvas.width;    p.vx *= -1; }
      if (p.y < 0)                    { p.y = 0;                    p.vy *= -1; }
      if (p.y > this.canvas.height)   { p.y = this.canvas.height;   p.vy *= -1; }

      // Leve repulsión del mouse
      const dx   = p.x - this.mouse.x;
      const dy   = p.y - this.mouse.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        const force = (120 - dist) / 120 * 0.012;
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
        // Limitar velocidad
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > 1.2) { p.vx /= speed / 1.2; p.vy /= speed / 1.2; }
      }
    }
  }

  _draw() {
    const ctx  = this.ctx;
    const { width: W, height: H } = this.canvas;
    const t    = this.frameCount * 0.015;

    // Clear con fade (efecto trail muy sutil)
    ctx.fillStyle = 'rgba(4, 13, 26, 0.25)';
    ctx.fillRect(0, 0, W, H);

    // Conexiones entre partículas cercanas
    const maxDist = 120;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a  = this.particles[i];
        const b  = this.particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d  = Math.hypot(dx, dy);
        if (d < maxDist) {
          const alpha = (1 - d / maxDist) * 0.12;
          ctx.save();
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth   = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Partículas
    for (const p of this.particles) {
      const pulse = Math.sin(t + p.pulseOffset) * 0.3;
      const a     = Math.max(0, Math.min(1, p.alpha + pulse));
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + pulse * 0.5, 0, Math.PI * 2);
      ctx.fillStyle   = `${p.color}${a})`;
      ctx.shadowColor = `${p.color}${a * 0.8})`;
      ctx.shadowBlur  = 6;
      ctx.fill();
      ctx.restore();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window._particleSystem = new ParticleSystem('particleCanvas');
});
