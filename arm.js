/**
 * arm.js — Visualizador Anatómico del Brazo con Canvas 2D
 *
 * Corrección clave: ángulo base = Math.PI/2 (hacia ABAJO)
 * El hombro está fijo en la parte superior-central del canvas.
 * El brazo oscila lateralmente dentro del canvas.
 */

class ArmVisualizer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx    = this.canvas.getContext('2d');
    this.W      = this.canvas.width;   // 380
    this.H      = this.canvas.height;  // 420

    this.t        = 0;
    this.ossLevel = 0;   // 0 = sano, 1 = totalmente osificado

    // Rango de movimiento (ROM)
    this.romMax     = Math.PI * 0.36;  // ±65° máximo
    this.romCurrent = this.romMax;

    // Hombro: centrado en X, cerca de la parte superior
    this.shoulderX  = this.W / 2;   // 190
    this.shoulderY  = 72;

    // Longitudes de segmentos
    this.humLength  = 118;   // húmero
    this.foreLength = 98;    // antebrazo
    this.handLength = 50;    // mano

    this.flareActive = false;
    this.flareTimer  = 0;

    this._startLoop();
  }

  _startLoop() {
    const loop = () => {
      this._update();
      this._draw();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _update() {
    this.t += 0.016;

    // ROM decrece con la osificación (FOP bloquea articulaciones)
    const factor    = Math.max(0.04, 1 - this.ossLevel * 0.93);
    this.romCurrent = this.romMax * factor;

    // Ángulo del húmero: PI/2 = apunta ABAJO; oscila ±romCurrent lateralmente
    this.ang1 = Math.PI / 2 + Math.sin(this.t) * this.romCurrent;

    // Ángulo relativo del codo (dobla hacia "adelante")
    this.ang2 = 0.38 + Math.sin(this.t * 1.22 + 0.5) * this.romCurrent * 0.42;

    if (this.flareActive) {
      this.flareTimer++;
      if (this.flareTimer > 130) {
        this.flareActive = false;
        this.flareTimer  = 0;
      }
    }
  }

  // ── Forward kinematics: calcula todas las posiciones ──
  _positions() {
    const sx = this.shoulderX, sy = this.shoulderY;

    const elbowX = sx + Math.cos(this.ang1) * this.humLength;
    const elbowY = sy + Math.sin(this.ang1) * this.humLength;

    const ang2abs = this.ang1 + this.ang2;  // ángulo absoluto del antebrazo
    const wristX  = elbowX + Math.cos(ang2abs) * this.foreLength;
    const wristY  = elbowY + Math.sin(ang2abs) * this.foreLength;

    const ang3abs = ang2abs + 0.12;
    const tipX    = wristX + Math.cos(ang3abs) * this.handLength;
    const tipY    = wristY + Math.sin(ang3abs) * this.handLength;

    return { sx, sy, elbowX, elbowY, wristX, wristY, tipX, tipY };
  }

  // ── Silueta de hombro/torso ──
  _drawTorso(sx, sy) {
    const ctx = this.ctx;
    ctx.save();
    const g = ctx.createRadialGradient(sx, sy - 12, 6, sx, sy - 12, 55);
    g.addColorStop(0, 'rgba(28, 50, 84, 0.88)');
    g.addColorStop(1, 'rgba(10, 20, 40, 0.00)');
    ctx.beginPath();
    ctx.ellipse(sx, sy - 12, 56, 40, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.font      = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(56,189,248,0.50)';
    ctx.textAlign = 'center';
    ctx.fillText('Hombro', sx, sy - 48);
    ctx.restore();
  }

  // ── Hueso cortical nativo (capa base blanca) ──
  _drawBoneCore(x0, y0, x1, y1, w) {
    const ctx = this.ctx;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = -dy / len, ny = dx / len;
    ctx.save();
    const g = ctx.createLinearGradient(x0 + nx*w, y0, x0 - nx*w, y0);
    g.addColorStop(0,   'rgba(215, 205, 175, 0.55)');
    g.addColorStop(0.5, 'rgba(252, 248, 235, 0.82)');
    g.addColorStop(1,   'rgba(215, 205, 175, 0.55)');
    ctx.beginPath();
    ctx.moveTo(x0 + nx*w,     y0 + ny*w);
    ctx.lineTo(x1 + nx*w*0.7, y1 + ny*w*0.7);
    ctx.lineTo(x1 - nx*w*0.7, y1 - ny*w*0.7);
    ctx.lineTo(x0 - nx*w,     y0 - ny*w);
    ctx.closePath();
    ctx.fillStyle   = g;
    ctx.shadowColor = 'rgba(255, 248, 220, 0.3)';
    ctx.shadowBlur  = 5;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ── Segmento muscular + capa de osificación ──
  _drawSegment(x0, y0, x1, y1, hw, ossRatio) {
    const ctx = this.ctx;
    const dx  = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len === 0) return;
    const nx = -dy / len, ny = dx / len;

    // Helper: dibuja un cuadrilátero
    const poly = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
    };

    const segPts = [
      [x0 + nx*hw,       y0 + ny*hw],
      [x1 + nx*hw*0.62,  y1 + ny*hw*0.62],
      [x1 - nx*hw*0.62,  y1 - ny*hw*0.62],
      [x0 - nx*hw,       y0 - ny*hw],
    ];

    ctx.save();

    // 1. Músculo rojo
    const gM = ctx.createLinearGradient(x0 + nx*hw, y0, x0 - nx*hw, y0);
    gM.addColorStop(0,    'rgba(195, 42, 42, 0.92)');
    gM.addColorStop(0.38, 'rgba(228, 65, 55, 0.96)');
    gM.addColorStop(0.62, 'rgba(228, 65, 55, 0.96)');
    gM.addColorStop(1,    'rgba(155, 25, 25, 0.86)');
    poly(segPts);
    ctx.fillStyle = gM;
    ctx.fill();

    // 2. Osificación progresiva (crece desde la base del segmento)
    if (ossRatio > 0.01) {
      const prog  = Math.min(ossRatio * 1.15, 1.0);
      const alpha = Math.min(ossRatio, 1.0);
      const mx    = x0 + dx * prog, my = y0 + dy * prog;
      const ossPts = [
        [x0 + nx*hw,      y0 + ny*hw],
        [mx + nx*hw*0.62, my + ny*hw*0.62],
        [mx - nx*hw*0.62, my - ny*hw*0.62],
        [x0 - nx*hw,      y0 - ny*hw],
      ];
      const gB = ctx.createLinearGradient(x0 + nx*hw, y0, x0 - nx*hw, y0);
      gB.addColorStop(0,   `rgba(208, 188, 138, ${alpha * 0.90})`);
      gB.addColorStop(0.4, `rgba(250, 246, 230, ${alpha * 0.97})`);
      gB.addColorStop(0.6, `rgba(235, 220, 175, ${alpha * 0.93})`);
      gB.addColorStop(1,   `rgba(208, 188, 138, ${alpha * 0.90})`);
      poly(ossPts);
      if (alpha > 0.22) {
        ctx.shadowColor = 'rgba(240, 215, 155, 0.55)';
        ctx.shadowBlur  = 12 * alpha;
      }
      ctx.fillStyle = gB;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Brillo cortical (línea lateral)
      if (alpha > 0.18) {
        ctx.strokeStyle = `rgba(255, 252, 240, ${alpha * 0.52})`;
        ctx.lineWidth   = 1.8;
        ctx.shadowColor = 'rgba(240, 220, 160, 0.65)';
        ctx.shadowBlur  = 7 * alpha;
        ctx.beginPath();
        ctx.moveTo(x0 + nx*3.5, y0 + ny*3.5);
        ctx.lineTo(mx + nx*3.5,  my + ny*3.5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // 3. Contorno
    poly(segPts);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    ctx.restore();
  }

  // ── Articulación esférica ──
  _drawJoint(x, y, r, ossRatio) {
    const ctx = this.ctx;
    ctx.save();
    const g = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.08, x, y, r);
    if (ossRatio < 0.45) {
      g.addColorStop(0, 'rgba(120, 170, 230, 0.95)');
      g.addColorStop(1, 'rgba(60,  100, 190, 0.80)');
    } else {
      const a = Math.min((ossRatio - 0.45) / 0.55, 1);
      g.addColorStop(0, `rgba(${_l(120,252,a)}, ${_l(170,248,a)}, ${_l(230,230,a)}, 0.97)`);
      g.addColorStop(1, `rgba(${_l(60, 215,a)}, ${_l(100,195,a)}, ${_l(190,145,a)}, 0.88)`);
    }
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    if (ossRatio > 0.28) {
      ctx.shadowColor = 'rgba(238, 212, 150, 0.72)';
      ctx.shadowBlur  = 10 * ossRatio;
    }
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // ── Efecto de brote inflamatorio ──
  _drawFlare(x, y) {
    if (!this.flareActive) return;
    const ctx      = this.ctx;
    const progress = this.flareTimer / 130;
    const radius   = 90 * progress;
    const alpha    = (1 - progress) * 0.55;
    ctx.save();
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0,   `rgba(239, 68, 68, ${alpha})`);
    g.addColorStop(0.5, `rgba(251, 146, 60, ${alpha * 0.5})`);
    g.addColorStop(1,   'rgba(239, 68, 68, 0)');
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // ── Arco ROM (rango de movimiento permitido) ──
  _drawROM(cx, cy) {
    const ctx = this.ctx;
    ctx.save();
    const pulse = 0.10 + 0.06 * Math.sin(this.t * 2.2);
    const r     = this.humLength + 16;

    // Arco centrado en PI/2 (abajo)
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth   = 1.2;
    ctx.setLineDash([5, 7]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI/2 - this.romCurrent, Math.PI/2 + this.romCurrent);
    ctx.stroke();
    ctx.setLineDash([]);

    // Puntos de límite
    [Math.PI/2 - this.romCurrent, Math.PI/2 + this.romCurrent].forEach(a => {
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a)*r, cy + Math.sin(a)*r, 3, 0, Math.PI*2);
      ctx.fillStyle = `rgba(56, 189, 248, ${pulse * 1.8})`;
      ctx.fill();
    });

    ctx.restore();
  }

  // ── Etiquetas anatómicas ──
  _drawLabels(p) {
    const ctx = this.ctx;
    ctx.save();
    ctx.textAlign = 'left';

    // Métricas principales
    ctx.font      = '700 10.5px Inter, sans-serif';
    ctx.fillStyle = 'rgba(148, 184, 212, 0.82)';
    ctx.fillText(`Osificación: ${(this.ossLevel * 100).toFixed(1)}%`, 10, 20);
    const romDeg  = (this.romCurrent * 180 / Math.PI).toFixed(0);
    ctx.fillStyle = this.ossLevel > 0.5 ? 'rgba(251,146,60,0.95)' : 'rgba(52,211,153,0.95)';
    ctx.fillText(`ROM: ${romDeg}°`, 10, 36);

    // Etiquetas de articulaciones
    ctx.font      = '10px Inter, sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.62)';
    ctx.fillText('Codo',   p.elbowX + 14, p.elbowY + 4);
    ctx.fillText('Muñeca', p.wristX + 12, p.wristY + 4);

    // Etiquetas de segmentos
    ctx.fillStyle = 'rgba(148, 184, 212, 0.45)';
    const midHumX = (p.sx     + p.elbowX) / 2;
    const midHumY = (p.sy     + p.elbowY) / 2;
    const midFoX  = (p.elbowX + p.wristX) / 2;
    const midFoY  = (p.elbowY + p.wristY) / 2;
    ctx.fillText('Húmero',    midHumX + 18, midHumY);
    ctx.fillText('Antebrazo', midFoX  + 14, midFoY);

    ctx.restore();
  }

  // ── Dibujado principal ──
  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.W, this.H);

    const p = this._positions();

    // Contexto visual: silueta de hombro
    this._drawTorso(p.sx, p.sy);

    // Arco de rango de movimiento
    this._drawROM(p.sx, p.sy);

    // Hueso cortical nativo (capa base)
    this._drawBoneCore(p.sx,     p.sy,     p.elbowX, p.elbowY, 6.5);
    this._drawBoneCore(p.elbowX, p.elbowY, p.wristX, p.wristY, 4.5);

    // Niveles de osificación (el húmero se osifica primero)
    const ossHum  = Math.min(this.ossLevel * 1.30, 1);
    const ossFore = Math.max(0, this.ossLevel * 1.15 - 0.12);
    const ossHand = Math.max(0, this.ossLevel * 1.10 - 0.42);

    // Segmentos con tejido muscular / osificación
    this._drawSegment(p.sx,     p.sy,     p.elbowX, p.elbowY, 15, ossHum);
    this._drawSegment(p.elbowX, p.elbowY, p.wristX, p.wristY, 11, ossFore);
    this._drawSegment(p.wristX, p.wristY, p.tipX,   p.tipY,    7, ossHand);

    // Articulaciones
    this._drawJoint(p.sx,     p.sy,     15, ossHum);
    this._drawJoint(p.elbowX, p.elbowY, 12, (ossHum + ossFore) / 2);
    this._drawJoint(p.wristX, p.wristY,  9, ossFore);
    this._drawJoint(p.tipX,   p.tipY,    6, ossHand);

    // Brote inflamatorio
    this._drawFlare(p.elbowX, p.elbowY);

    // Etiquetas
    this._drawLabels(p);

    // Título inferior
    ctx.save();
    ctx.font      = '700 11px Orbitron, sans-serif';
    ctx.fillStyle = 'rgba(56, 189, 248, 0.42)';
    ctx.textAlign = 'center';
    ctx.fillText('MODELO BIOMECÁNICO · FOP', this.W / 2, this.H - 12);
    ctx.restore();
  }

  // ── API pública ──
  setOssification(level) { this.ossLevel = Math.max(0, Math.min(1, level)); }
  triggerFlare()          { this.flareActive = true;  this.flareTimer = 0; }
  reset()                 { this.ossLevel = 0; this.flareActive = false; this.flareTimer = 0; }
}

function _l(a, b, t) { return Math.round(a + (b - a) * t); }
window.ArmVisualizer = ArmVisualizer;
