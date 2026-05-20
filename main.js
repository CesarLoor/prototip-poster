/**
 * main.js — Orquestador Principal del Simulador FOP
 *
 * Conecta: FOPModel (EDO) + ArmVisualizer (canvas brazo) + ODEChart (gráfica)
 * Gestiona:
 *  - Lectura de sliders y actualización de parámetros en tiempo real
 *  - Ejecución de la simulación y animación de resultados
 *  - Scrubber de tiempo → actualiza brazo + cursor de gráfica
 *  - Presets clínicos (mutación ACVR1 / escenario tratado)
 *  - Botón de brote inflamatorio
 */

(function () {
  'use strict';

  /* ─── ESTADO GLOBAL ─── */
  let model     = null;
  let arm       = null;
  let chart     = null;
  let simData   = null;     // resultados EDO
  let scrubbing = false;    // ¿el scrubber está activo?
  let autoScrubId = null;   // ID del animation frame del scrubber automático

  /* ─── INIT ─── */
  window.addEventListener('DOMContentLoaded', () => {
    model = new FOPModel();
    arm   = new ArmVisualizer('armCanvas');
    chart = new ODEChart('chartCanvas');

    _bindSliders();
    _bindButtons();
    _bindTimeSlider();

    // Muestra parámetros iniciales
    _updateAllLabels();

    console.log('%c[FOP Simulator] Iniciado correctamente ✓', 'color:#38bdf8;font-weight:bold');
  });

  /* ─────────────────────────────────────────────
     SLIDERS — actualización en tiempo real
  ───────────────────────────────────────────── */
  const PARAM_MAP = {
    r:     { label: 'rVal',  decimals: 2 },
    K:     { label: 'KVal',  decimals: 2 },
    delta: { label: 'dVal',  decimals: 2 },
    alpha: { label: 'aVal',  decimals: 2 },
    mu:    { label: 'mVal',  decimals: 3 },
    sigma: { label: 'sVal',  decimals: 2 },
    gamma: { label: 'gVal',  decimals: 2 },
    beta:  { label: 'bVal',  decimals: 2 },
    N0:    { label: 'N0Val', decimals: 2 },
    B0:    { label: 'B0Val', decimals: 3 },
    S0:    { label: 'S0Val', decimals: 2 },
  };

  function _bindSliders() {
    Object.keys(PARAM_MAP).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        _updateLabel(id);
        // Si ya hay datos, re-ejecutar live (debounced)
        _debouncedRun();
      });
    });
  }

  function _updateLabel(id) {
    const meta = PARAM_MAP[id];
    const el   = document.getElementById(id);
    const lbl  = document.getElementById(meta.label);
    if (el && lbl) lbl.textContent = parseFloat(el.value).toFixed(meta.decimals);
  }

  function _updateAllLabels() {
    Object.keys(PARAM_MAP).forEach(id => _updateLabel(id));
  }

  /* ─── Debounce para re-ejecución con sliders ─── */
  let _debounceTimer = null;
  function _debouncedRun() {
    if (!simData) return;   // Solo si ya se ejecutó al menos una vez
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(_runSimulation, 280);
  }

  /* ─────────────────────────────────────────────
     LEER PARÁMETROS DESDE LA UI
  ───────────────────────────────────────────── */
  function _readParams() {
    const g = id => parseFloat(document.getElementById(id).value);
    return {
      r:     g('r'),
      K:     g('K'),
      delta: g('delta'),
      alpha: g('alpha'),
      mu:    g('mu'),
      sigma: g('sigma'),
      gamma: g('gamma'),
      beta:  g('beta'),
      N0:    g('N0'),
      B0:    g('B0'),
      S0:    g('S0'),
    };
  }

  /* ─────────────────────────────────────────────
     EJECUTAR SIMULACIÓN
  ───────────────────────────────────────────── */
  function _runSimulation(flareAt = null) {
    const params = _readParams();
    model.setParams(params);

    // Resolver EDO (RK4, paso h=0.5 días, hasta 365 días)
    simData = model.solve(365, 0.5, flareAt);

    // Animar gráfica
    chart.animate(simData, 365);

    // Resetear scrubber
    document.getElementById('timeSlider').value = 0;
    document.getElementById('tLabel').textContent = '0';

    // Iniciar reproducción automática del brazo
    _startAutoScrub();

    // Info box
    const finalB  = simData[simData.length - 1].B.toFixed(3);
    const finalN  = simData[simData.length - 1].N.toFixed(3);
    const ossPercent = Math.min(100, (simData[simData.length-1].B / (model.K * 1.5)) * 100).toFixed(1);

    document.getElementById('infoBox').innerHTML = `
      <strong>Simulación completada</strong> — 365 días · ${simData.length} pasos RK4<br/>
      Células mesenquimales finales <span style="color:#38bdf8">N=${finalN}</span> &nbsp;|&nbsp;
      Tejido osificado <span style="color:#f472b6">B=${finalB}</span><br/>
      Osificación estimada: <span style="color:${ossPercent > 50 ? '#fb923c' : '#34d399'}">${ossPercent}%</span>
      ${flareAt ? `<br/>⚡ <span style="color:#ef4444">Brote simulado en día ${flareAt}</span>` : ''}
    `;
  }

  /* ─────────────────────────────────────────────
     SCRUBBER DE TIEMPO — sincroniza brazo + cursor
  ───────────────────────────────────────────── */
  function _bindTimeSlider() {
    const slider = document.getElementById('timeSlider');
    const label  = document.getElementById('tLabel');

    slider.addEventListener('input', () => {
      if (!simData) return;
      clearAutoScrub();
      scrubbing = true;
      const t   = parseInt(slider.value);
      label.textContent = t;
      _updateArmFromTime(t);
      chart.setCursorTime(t);
    });

    slider.addEventListener('change', () => { scrubbing = false; });
  }

  function _updateArmFromTime(t) {
    if (!simData || !arm) return;

    // Encontrar punto más cercano en los datos
    const idx = simData.findIndex(d => d.t >= t);
    const pt  = idx >= 0 ? simData[idx] : simData[simData.length - 1];

    // Nivel de osificación normalizado (0–1)
    const maxB = Math.max(...simData.map(d => d.B));
    const ossLevel = maxB > 0 ? Math.min(1, pt.B / (maxB * 1.05)) : 0;

    arm.setOssification(ossLevel);

    // Actualizar barra de porcentaje
    const pct = (ossLevel * 100).toFixed(1);
    document.getElementById('ossBar').style.width  = `${pct}%`;
    document.getElementById('ossPct').textContent  = `${pct}%`;
  }

  /* ─── Reproducción automática del tiempo ─── */
  function _startAutoScrub() {
    clearAutoScrub();
    const slider  = document.getElementById('timeSlider');
    const label   = document.getElementById('tLabel');
    const duration = 4000; // ms para recorrer 365 días
    const start    = performance.now();

    const step = (now) => {
      if (scrubbing) return;
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const t = Math.round(progress * 365);

      slider.value          = t;
      label.textContent     = t;
      _updateArmFromTime(t);

      if (progress < 1) {
        autoScrubId = requestAnimationFrame(step);
      }
    };
    autoScrubId = requestAnimationFrame(step);
  }

  function clearAutoScrub() {
    if (autoScrubId) {
      cancelAnimationFrame(autoScrubId);
      autoScrubId = null;
    }
  }

  /* ─────────────────────────────────────────────
     BOTONES
  ───────────────────────────────────────────── */
  function _bindButtons() {
    // ▶ Ejecutar
    document.getElementById('btnRun').addEventListener('click', () => {
      _runSimulation();
    });

    // ↺ Reiniciar
    document.getElementById('btnReset').addEventListener('click', () => {
      _resetAll();
    });

    // ⚡ Brote inflamatorio
    document.getElementById('btnFlare').addEventListener('click', () => {
      const currentT = parseInt(document.getElementById('timeSlider').value);
      const flareDay = simData ? Math.max(30, currentT || 60) : 60;

      // Efecto visual en el panel del brazo
      document.getElementById('armSection').classList.add('flare-active');
      setTimeout(() => document.getElementById('armSection').classList.remove('flare-active'), 1300);

      arm.triggerFlare();
      _runSimulation(flareDay);

      document.getElementById('infoBox').innerHTML +=
        `<br/>🔥 <span style="color:#ef4444;font-weight:bold">¡Brote inflamatorio en día ${flareDay}!</span> La señal BMP aumentó abruptamente, acelerando la osificación heterotópica.`;
    });

    // 🧬 Preset mutación ACVR1 (R206H — variante más común en FOP)
    document.getElementById('btnPreset1').addEventListener('click', () => {
      _applyPreset({
        r: 0.55, K: 1.8, delta: 0.25,
        alpha: 1.10, mu: 0.02,
        sigma: 0.65, gamma: 0.15, beta: 0.10,
        N0: 0.70, B0: 0.02, S0: 0.45,
      });
      document.getElementById('infoBox').innerHTML =
        `🧬 <strong>Preset: Mutación ACVR1 R206H</strong><br/>
         Alta producción de señal BMP (σ=0.65), baja degradación ósea (μ=0.02),
         tasa de osificación elevada (α=1.10). Simula el perfil clínico más común de FOP.`;
    });

    // 💊 Preset tratado (inhibidor ALK2 en ensayo)
    document.getElementById('btnPreset2').addEventListener('click', () => {
      _applyPreset({
        r: 0.20, K: 1.0, delta: 0.60,
        alpha: 0.12, mu: 0.18,
        sigma: 0.08, gamma: 0.55, beta: 0.45,
        N0: 0.30, B0: 0.005, S0: 0.05,
      });
      document.getElementById('infoBox').innerHTML =
        `💊 <strong>Preset: Escenario Tratado (inhibidor ALK2)</strong><br/>
         Baja señal BMP (σ=0.08), alta degradación de señal (γ=0.55),
         osificación reducida (α=0.12). Modelo del efecto del fármaco Garetosmab / Palovarotene.`;
    });
  }

  function _applyPreset(params) {
    // Actualizar sliders
    Object.keys(params).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = params[id];
        _updateLabel(id);
      }
    });
    _runSimulation();
  }

  function _resetAll() {
    clearAutoScrub();
    simData = null;
    scrubbing = false;

    // Sliders a valores por defecto
    const defaults = {
      r: 0.30, K: 1.00, delta: 0.50,
      alpha: 0.40, mu: 0.050,
      sigma: 0.20, gamma: 0.30, beta: 0.20,
      N0: 0.50, B0: 0.010, S0: 0.10,
    };
    Object.keys(defaults).forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.value = defaults[id]; _updateLabel(id); }
    });

    // Reset brazo
    arm.reset();
    document.getElementById('ossBar').style.width  = '0%';
    document.getElementById('ossPct').textContent  = '0%';

    // Reset slider
    const slider = document.getElementById('timeSlider');
    slider.value = 0;
    document.getElementById('tLabel').textContent = '0';

    // Reset chart
    chart.data = null;
    chart._drawEmpty();

    document.getElementById('infoBox').innerHTML =
      'Ajusta los parámetros y presiona <strong>▶ Ejecutar</strong> para iniciar la simulación numérica del modelo EDO de 3 variables de estado.';
  }

})();
