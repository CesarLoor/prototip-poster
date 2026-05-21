# FOP Simulator — EDO Poster Científico

**Simulador interactivo de Fibrodisplasia Osificante Progresiva (FOP)**  
Modelación matemática mediante Ecuaciones Diferenciales Ordinarias (EDO) con método Runge-Kutta 4.

## 🌐 Demo en vivo
> [Ver simulador desplegado →](https://cesarloor.github.io/prototip-poster/)

## 🧬 Descripción del Modelo

El sistema EDO de 3 variables de estado simula la dinámica de la FOP:

| Variable | Descripción |
|----------|-------------|
| `N(t)` | Células Mesenquimales (precursoras) |
| `B(t)` | Tejido Osificado heterotópico |
| `S(t)` | Señal Inflamatoria / BMP |

### Ecuaciones del modelo:
```
dN/dt = r·N·(1 − N/K) − δ·B·N
dB/dt = α·N·f(S) − μ·B
dS/dt = σ − γ·S − β·S·N

f(S) = S² / (1 + S²)   ← Función de Hill (activación umbral BMP)
```

## 🛠️ Stack Tecnológico

- **HTML5 Canvas** — Visualización del brazo articulado
- **Vanilla JavaScript** — Lógica, animación, interactividad
- **Runge-Kutta 4** — Integración numérica del sistema EDO
- **CSS3 Variables + Glassmorphism** — UI premium dark theme
- **requestAnimationFrame** — Animación fluida a 60 fps

## 📁 Estructura del proyecto

```
fop-simulator/
├── index.html      # Estructura principal
├── style.css       # Tema oscuro premium
├── ode.js          # Solver RK4 + modelo FOP
├── arm.js          # Visualizador anatómico (Canvas 2D)
├── chart.js        # Gráfica de series de tiempo
├── particles.js    # Sistema de partículas de fondo
└── main.js         # Orquestador principal
```

## 🚀 Uso local

Simplemente abre `index.html` en cualquier navegador moderno. No requiere servidor ni dependencias.

## 🔬 Presets clínicos incluidos

- **Mutación ACVR1 R206H** — Perfil más común de FOP (alta señal BMP)
- **Escenario Tratado** — Simulación de inhibidor ALK2 (Garetosmab/Palovarotene)

---
*Proyecto de póster científico — Modelación Matemática con EDO, 2026*
