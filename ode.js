/**
 * ode.js — Runge-Kutta 4th Order Solver
 * Sistema de EDOs para modelación de FOP
 *
 * Variables de Estado:
 *   N(t) = Células Mesenquimales (precursoras)
 *   B(t) = Tejido Osificado (heterotópico)
 *   S(t) = Señal Inflamatoria / BMP
 *
 * Ecuaciones:
 *   dN/dt = r·N·(1 − N/K) − δ·B·N
 *   dB/dt = α·N·f(S) − μ·B
 *   dS/dt = σ − γ·S − β·S·N
 *
 * donde f(S) = S² / (1 + S²)  (función Hill, activación umbral)
 */

class FOPModel {
  constructor(params = {}) {
    this.setParams(params);
  }

  setParams(p) {
    this.r = p.r ?? 0.3; // tasa proliferación
    this.K = p.K ?? 1.0; // capacidad de carga
    this.delta = p.delta ?? 0.5; // diferenciación
    this.alpha = p.alpha ?? 0.4; // osificación
    this.mu = p.mu ?? 0.05; // degradación ósea
    this.sigma = p.sigma ?? 0.2; // producción señal BMP
    this.gamma = p.gamma ?? 0.3; // degradación señal
    this.beta = p.beta ?? 0.2; // consumo señal por células
    // Condiciones iniciales
    this.N0 = p.N0 ?? 0.5;
    this.B0 = p.B0 ?? 0.01;
    this.S0 = p.S0 ?? 0.1;
  }

  /** Función de Hill: activación mediada por señal BMP */
  hillActivation(S, n = 2) {
    return Math.pow(S, n) / (1 + Math.pow(S, n));
  }

  /** Sistema de EDOs */
  derivatives(t, [N, B, S]) {
    const fS = this.hillActivation(S);
    const dN = this.r * N * (1 - N / this.K) - this.delta * B * N;
    const dB = this.alpha * N * fS - this.mu * B;
    const dS = this.sigma - this.gamma * S - this.beta * S * N;
    return [dN, dB, dS];
  }

  /** Un paso Runge-Kutta 4 */
  rk4Step(t, y, h) {
    const k1 = this.derivatives(t, y);
    const k2 = this.derivatives(
      t + h / 2,
      y.map((yi, i) => yi + (h / 2) * k1[i]),
    );
    const k3 = this.derivatives(
      t + h / 2,
      y.map((yi, i) => yi + (h / 2) * k2[i]),
    );
    const k4 = this.derivatives(
      t + h,
      y.map((yi, i) => yi + h * k3[i]),
    );

    return y.map((yi, i) =>
      Math.max(0, yi + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])),
    );
  }

  /**
   * Ejecuta la simulación completa
   * @param {number} tEnd   Tiempo final (días)
   * @param {number} h      Paso de integración
   * @param {number|null} flareAt  Día del brote (null = sin brote)
   * @returns {{t, N, B, S}[]} Array de puntos
   */
  solve(tEnd = 365, h = 0.5, flareAt = null) {
    let t = 0;
    let y = [this.N0, this.B0, this.S0];
    const results = [{ t, N: y[0], B: y[1], S: y[2] }];

    while (t < tEnd) {
      const step = Math.min(h, tEnd - t);

      // Simular brote: incremento de señal inflamatoria
      if (flareAt !== null && Math.abs(t - flareAt) < step) {
        y = [y[0], y[1], Math.min(y[2] + 0.8, 3.0)];
      }

      y = this.rk4Step(t, y, step);
      // Clamp razonable
      y = y.map((v) => Math.max(0, Math.min(v, 10)));
      t += step;

      results.push({ t: +t.toFixed(4), N: y[0], B: y[1], S: y[2] });
    }

    return results;
  }
}

// Export global
window.FOPModel = FOPModel;
