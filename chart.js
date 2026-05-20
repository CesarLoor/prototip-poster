/**
 * chart.js — Graficador de Series de Tiempo EDO
 *
 * Dibuja N(t), B(t), S(t) con:
 *  - Líneas suavizadas con bezier
 *  - Relleno con gradiente bajo cada curva
 *  - Eje X (tiempo) y eje Y (concentración normalizada)
 *  - Cursor de tiempo interactivo (scrubber)
 *  - Animación de dibujado progresivo
 */

class ODEChart {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");
    this.W = this.canvas.width;
    this.H = this.canvas.height;

    this.data = null; // Array de {t, N, B, S}
    this.drawProgress = 0; // 0–1 (animación de entrada)
    this.animRunning = false;
    this.cursorT = 0; // tiempo del cursor
    this.maxT = 365;

    // Padding
    this.pad = { top: 25, right: 20, bottom: 40, left: 52 };

    // Colores
    this.colors = {
      N: { line: "#38bdf8", fill: "rgba(56,189,248,0.12)" },
      B: { line: "#f472b6", fill: "rgba(244,114,182,0.12)" },
      S: { line: "#34d399", fill: "rgba(52,211,153,0.12)" },
    };

    // Cursor
    this.canvas.addEventListener("mousemove", (e) => this._onMouseMove(e));
    this.canvas.addEventListener("mouseleave", () => {
      this._drawEmpty();
      this._drawIfData();
    });

    // Dibujo vacío inicial
    this._drawEmpty();
  }

  _drawEmpty() {
    const ctx = this.ctx;
    const { W, H, pad } = this;
    ctx.clearRect(0, 0, W, H);

    // Grid
    this._drawGrid();
    this._drawAxes();

    // Mensaje
    ctx.save();
    ctx.font = "500 13px Inter, sans-serif";
    ctx.fillStyle = "rgba(74, 122, 155, 0.6)";
    ctx.textAlign = "center";
    ctx.fillText(
      "Presiona ▶ Ejecutar Simulación para ver resultados",
      W / 2,
      H / 2,
    );
    ctx.textAlign = "left";
    ctx.restore();
  }

  _drawGrid() {
    const ctx = this.ctx;
    const { W, H, pad } = this;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;

    ctx.save();
    ctx.strokeStyle = "rgba(56,189,248,0.07)";
    ctx.lineWidth = 1;

    // Horizontales
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + innerH * (1 - i / 5);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(W - pad.right, y);
      ctx.stroke();
    }
    // Verticales
    for (let i = 0; i <= 6; i++) {
      const x = pad.left + (innerW * i) / 6;
      ctx.beginPath();
      ctx.moveTo(x, pad.top);
      ctx.lineTo(x, H - pad.bottom);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawAxes() {
    const ctx = this.ctx;
    const { W, H, pad } = this;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;

    ctx.save();
    ctx.strokeStyle = "rgba(148, 184, 212, 0.4)";
    ctx.lineWidth = 1.5;

    // Eje Y
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, H - pad.bottom);
    ctx.stroke();

    // Eje X
    ctx.beginPath();
    ctx.moveTo(pad.left, H - pad.bottom);
    ctx.lineTo(W - pad.right, H - pad.bottom);
    ctx.stroke();

    // Labels X (tiempo)
    ctx.font = "10px JetBrains Mono, monospace";
    ctx.fillStyle = "rgba(148, 184, 212, 0.7)";
    ctx.textAlign = "center";
    for (let i = 0; i <= 6; i++) {
      const t = Math.round((i * this.maxT) / 6);
      const x = pad.left + (innerW * i) / 6;
      ctx.fillText(t, x, H - pad.bottom + 16);
    }
    ctx.fillText("días →", W - pad.right - 10, H - pad.bottom + 28);

    // Labels Y
    ctx.textAlign = "right";
    for (let i = 0; i <= 5; i++) {
      const v = (i / 5).toFixed(1);
      const y = pad.top + innerH * (1 - i / 5);
      ctx.fillText(v, pad.left - 6, y + 4);
    }

    ctx.restore();
  }

  /** Convierte (t, v) a pixel */
  _toPixel(t, v, maxV) {
    const { W, H, pad, maxT } = this;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;
    const x = pad.left + (t / maxT) * innerW;
    const y = H - pad.bottom - (v / maxV) * innerH;
    return [x, Math.max(pad.top, Math.min(H - pad.bottom, y))];
  }

  /** Dibuja una curva con área bajo la curva */
  _drawCurve(series, key, maxV, progress) {
    const ctx = this.ctx;
    const { W, H, pad } = this;
    const { line, fill } = this.colors[key];

    const n = Math.floor(series.length * progress);
    if (n < 2) return;

    const pts = series.slice(0, n).map((d) => this._toPixel(d.t, d[key], maxV));

    // Fill
    ctx.save();
    const gFill = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
    gFill.addColorStop(0, fill.replace("0.12", "0.25"));
    gFill.addColorStop(1, fill.replace("0.12", "0.0"));
    ctx.fillStyle = gFill;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], H - pad.bottom);
    pts.forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(pts[pts.length - 1][0], H - pad.bottom);
    ctx.closePath();
    ctx.fill();

    // Línea con bezier suave
    ctx.strokeStyle = line;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = line;
    ctx.shadowBlur = 6;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
    }
    ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Punto final animado
    const last = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(last[0], last[1], 4, 0, Math.PI * 2);
    ctx.fillStyle = line;
    ctx.shadowColor = line;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
  }

  _drawCursorLine(t) {
    if (!this.data) return;
    const ctx = this.ctx;
    const { W, H, pad, maxT } = this;
    const innerW = W - pad.left - pad.right;
    const innerH = H - pad.top - pad.bottom;

    const x = pad.left + (t / maxT) * innerW;
    if (x < pad.left || x > W - pad.right) return;

    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.2)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, H - pad.bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    // Tooltip
    const closest = this.data.reduce(
      (acc, d) => (Math.abs(d.t - t) < Math.abs(acc.t - t) ? d : acc),
      this.data[0],
    );

    ctx.font = "700 10px JetBrains Mono, monospace";
    ctx.textAlign = "left";
    const tx = x + 8;
    const ty = pad.top + 14;
    const lines = [
      { label: `t=${t.toFixed(0)}d`, color: "rgba(255,255,255,0.5)" },
      { label: `N=${closest.N.toFixed(3)}`, color: this.colors.N.line },
      { label: `B=${closest.B.toFixed(3)}`, color: this.colors.B.line },
      { label: `S=${closest.S.toFixed(3)}`, color: this.colors.S.line },
    ];
    lines.forEach((l, i) => {
      ctx.fillStyle = l.color;
      ctx.fillText(l.label, tx + (x > W - 100 ? -90 : 0), ty + i * 14);
    });

    ctx.restore();
  }

  _drawIfData() {
    if (this.data && this.drawProgress >= 1) {
      this._render(1);
    }
  }

  _onMouseMove(e) {
    if (!this.data) return;
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const { pad, W, maxT } = this;
    const innerW = W - pad.left - pad.right;
    const t = ((mx - pad.left) / innerW) * maxT;
    if (t < 0 || t > maxT) return;
    this.cursorT = t;
    this._render(this.drawProgress);
    this._drawCursorLine(t);
  }

  _render(progress) {
    const ctx = this.ctx;
    this.drawProgress = progress;

    ctx.clearRect(0, 0, this.W, this.H);
    this._drawGrid();
    this._drawAxes();

    if (!this.data) return;

    const maxN = Math.max(...this.data.map((d) => d.N));
    const maxB = Math.max(...this.data.map((d) => d.B));
    const maxS = Math.max(...this.data.map((d) => d.S));
    const maxV = Math.max(maxN, maxB, maxS, 1) * 1.1;

    this._drawCurve(this.data, "S", maxV, progress);
    this._drawCurve(this.data, "N", maxV, progress);
    this._drawCurve(this.data, "B", maxV, progress);
  }

  /** Inicia animación de dibujado progresivo */
  animate(data, maxT = 365) {
    this.data = data;
    this.maxT = maxT;
    this.drawProgress = 0;

    const duration = 1800; // ms
    const start = performance.now();

    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out
      const eased = 1 - Math.pow(1 - progress, 3);
      this._render(eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /** Mueve el cursor al tiempo t */
  setCursorTime(t) {
    this.cursorT = t;
    this._render(this.drawProgress);
    this._drawCursorLine(t);
  }
}

window.ODEChart = ODEChart;
