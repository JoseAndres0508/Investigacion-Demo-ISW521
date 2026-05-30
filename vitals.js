/**
 * vitals.js — Medición de Core Web Vitals con PerformanceObserver nativo
 * ISW-521 · Programación en Ambiente Web I · UTN Sede San Carlos · 2026
 *
 * Sin librerías externas. Cada métrica usa la API del navegador directamente.
 * Referencias:
 *   https://web.dev/lcp/
 *   https://web.dev/inp/
 *   https://web.dev/cls/
 */

'use strict';

/* ============================================================
   ESTADO GLOBAL DE CADA MÉTRICA
   ============================================================ */

/** Último elemento LCP detectado (para mostrar en consola si el docente lo pide) */
let lcpEntry = null;

/** Umbral en ms para clasificar LCP como "bueno" (modificable en vivo) */
let LCP_UMBRAL_BUENO = 2500;
const LCP_UMBRAL_MALO = 4000;

/** Todas las interacciones registradas durante la sesión */
const interacciones = [];

/** Score de CLS acumulado y contador de desplazamientos */
let clsScore = 0;
let clsShiftCount = 0;

/** Temporizador pendiente de la demo CLS */
let clsTimeout = null;


/* ============================================================
   UTILIDADES DE UI
   ============================================================ */

/**
 * Aplica una clase de color (good / needs-work / bad) a una tarjeta
 * y actualiza el texto de estado.
 *
 * @param {string} cardId     - id del elemento .metric-card
 * @param {string} statusId   - id del elemento .metric-status
 * @param {'good'|'needs-work'|'bad'} nivel
 * @param {string} statusText - texto descriptivo del estado
 */
function actualizarEstadoTarjeta(cardId, statusId, nivel, statusText) {
  const card   = document.getElementById(cardId);
  const status = document.getElementById(statusId);

  // Quitar clases anteriores y aplicar la nueva
  card.classList.remove('good', 'needs-work', 'bad');
  card.classList.add(nivel);

  status.textContent = statusText;
}


/* ============================================================
   LCP — Largest Contentful Paint
   ============================================================ */

/**
 * Observa entradas de tipo 'largest-contentful-paint'.
 * buffered: true → captura entradas que ocurrieron antes de que
 * el observer fuera registrado (importante al cargar la página).
 *
 * El navegador puede emitir varias entradas LCP durante la carga;
 * el valor definitivo es el de la ÚLTIMA entrada antes de que el
 * usuario interactúe por primera vez (visibilitychange / pointerdown).
 */
function iniciarMedicionLCP() {
  if (!('PerformanceObserver' in window)) {
    document.getElementById('lcp-status').textContent = 'PerformanceObserver no soportado';
    return;
  }

  const observer = new PerformanceObserver((entryList) => {
    // La última entrada es siempre la más representativa
    const entries = entryList.getEntries();
    lcpEntry = entries[entries.length - 1];

    const tiempoMs = lcpEntry.startTime;
    const tiempoSeg = (tiempoMs / 1000).toFixed(2) + ' s';

    // Actualizar valor en pantalla
    document.getElementById('lcp-value').textContent = tiempoSeg;

    // Elemento que disparó el LCP (tag + id/clase si existe)
    const el = lcpEntry.element;
    const descripcionElemento = el
      ? `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + [...el.classList].join('.') : ''}`
      : 'desconocido';
    document.getElementById('lcp-element').textContent = 'Elemento: ' + descripcionElemento;

    // Clasificar según umbrales (LCP_UMBRAL_BUENO es modificable en vivo)
    if (tiempoMs <= LCP_UMBRAL_BUENO) {
      actualizarEstadoTarjeta('card-lcp', 'lcp-status', 'good', '✅ Bueno');
    } else if (tiempoMs <= LCP_UMBRAL_MALO) {
      actualizarEstadoTarjeta('card-lcp', 'lcp-status', 'needs-work', '⚠️ Necesita mejora');
    } else {
      actualizarEstadoTarjeta('card-lcp', 'lcp-status', 'bad', '❌ Malo');
    }
  });

  // El LCP solo se emite mientras la pestaña está activa y antes de la
  // primera interacción del usuario.
  observer.observe({ type: 'largest-contentful-paint', buffered: true });
}


/* ============================================================
   INP — Interaction to Next Paint
   ============================================================ */

/**
 * INP no tiene una entrada directa en PerformanceObserver.
 * Se mide observando entradas de tipo 'event' y tomando la
 * peor duración (percentil alto) de todas las interacciones.
 *
 * Nota: en producción la librería web-vitals usa un algoritmo
 * más preciso (descarta las N mejores según el total de
 * interacciones). Aquí simplificamos tomando el máximo para
 * poder explicarlo línea a línea.
 */
function iniciarMedicionINP() {
  if (!('PerformanceObserver' in window)) return;

  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      // Solo consideramos eventos que representan interacciones reales
      // (interactionId > 0 filtra eventos internos del navegador)
      if (entry.interactionId > 0) {
        registrarInteraccion(entry);
      }
    }
  });

  // 'event' captura clicks, teclado y taps
  // buffered: true → incluye eventos que ocurrieron antes de este punto
  observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
}

/**
 * Guarda la interacción, actualiza el peor valor (INP) y refresca la UI.
 *
 * @param {PerformanceEventTiming} entry
 */
function registrarInteraccion(entry) {
  const duracion = Math.round(entry.duration);
  interacciones.push(duracion);

  // INP es el peor valor registrado (versión simplificada)
  const peor = Math.max(...interacciones);

  // Actualizar panel
  document.getElementById('inp-value').textContent = peor + ' ms';
  document.getElementById('inp-count').textContent =
    'Interacciones registradas: ' + interacciones.length;

  // Clasificar
  let nivel, statusText;
  if (peor <= 200) {
    nivel = 'good';    statusText = '✅ Bueno';
  } else if (peor <= 500) {
    nivel = 'needs-work'; statusText = '⚠️ Necesita mejora';
  } else {
    nivel = 'bad';    statusText = '❌ Malo';
  }
  actualizarEstadoTarjeta('card-inp', 'inp-status', nivel, statusText);

  // Añadir al log visual
  agregarEntradaLog(entry.name, duracion, nivel);
}

/**
 * Añade una fila al log de interacciones visible en la página.
 */
function agregarEntradaLog(tipo, duracion, nivel) {
  const log = document.getElementById('inp-log');

  // Quitar el placeholder si sigue ahí
  const placeholder = log.querySelector('.log-placeholder');
  if (placeholder) placeholder.remove();

  const fila = document.createElement('div');
  fila.className = `log-entry ${nivel}`;
  fila.textContent =
    `[${new Date().toLocaleTimeString()}] ${tipo} → ${duracion} ms`;

  // Insertar al inicio para que lo más reciente quede arriba
  log.insertBefore(fila, log.firstChild);
}

/**
 * Bloquea el hilo principal durante `ms` milisegundos.
 * Esto simula trabajo pesado de JavaScript (ejemplo: cálculos complejos,
 * manipulación excesiva del DOM) que retrasa el pintado de la respuesta.
 *
 * En producción NUNCA hagas esto — es solo para la demo.
 *
 * @param {number} ms - milisegundos a bloquear
 */
function simularTrabajo(ms) {
  const inicio = performance.now();
  // Bucle síncrono que bloquea el hilo — simula trabajo real
  while (performance.now() - inicio < ms) {
    // Ocupado a propósito
  }
  // El navegador registrará la duración de este evento en la métrica INP
}


/* ============================================================
   CLS — Cumulative Layout Shift
   ============================================================ */

/**
 * Observa entradas de tipo 'layout-shift'.
 * Cada entrada tiene un 'value' que representa la fracción del
 * viewport que se desplazó × la fracción del elemento visible.
 *
 * Técnicamente el CLS real agrupa los shifts en ventanas de sesión
 * de máx 5s con gaps de 1s. Aquí acumulamos todo para la demo.
 */
function iniciarMedicionCLS() {
  if (!('PerformanceObserver' in window)) return;

  const observer = new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      // hadRecentInput: true → el usuario acaba de interactuar;
      // estos shifts NO se cuentan en el CLS real (son esperados).
      if (!entry.hadRecentInput) {
        clsScore += entry.value;
        clsShiftCount++;
        actualizarUICLS();
      }
    }
  });

  observer.observe({ type: 'layout-shift', buffered: true });
}

/**
 * Refresca el panel de CLS con el score y la clasificación actuales.
 */
function actualizarUICLS() {
  document.getElementById('cls-value').textContent  = clsScore.toFixed(3);
  document.getElementById('cls-shifts').textContent =
    'Desplazamientos detectados: ' + clsShiftCount;

  let nivel, statusText;
  if (clsScore <= 0.1) {
    nivel = 'good';       statusText = '✅ Bueno';
  } else if (clsScore <= 0.25) {
    nivel = 'needs-work'; statusText = '⚠️ Necesita mejora';
  } else {
    nivel = 'bad';        statusText = '❌ Malo';
  }
  actualizarEstadoTarjeta('card-cls', 'cls-status', nivel, statusText);
}

/**
 * DEMO CLS MALO:
 * Inserta un banner en el DOM después del delay configurado.
 * El banner empuja el texto hacia abajo → shift real → CLS sube.
 */
function demoCLSMalo() {
  const delay = parseInt(
    document.getElementById('input-cls-delay').value, 10
  ) || 2000;

  limpiarBannerCLS();

  document.getElementById('cls-explanation').textContent =
    `⏳ El banner aparecerá en ${delay / 1000}s y empujará el texto…`;

  clsTimeout = setTimeout(() => {
    const area  = document.getElementById('cls-demo-area');
    const texto = document.getElementById('cls-texto-contenido');

    const banner = document.createElement('div');
    banner.className = 'cls-banner';
    banner.id = 'cls-banner-demo';
    banner.textContent = '🚨 ¡Banner insertado sin reserva de espacio! Esto causa CLS.';

    // Insertar ANTES del texto → lo empuja hacia abajo → shift
    area.insertBefore(banner, texto);

    document.getElementById('cls-explanation').textContent =
      'El banner apareció sin que el espacio estuviera reservado. ' +
      'Observa cómo el score de CLS subió en el panel de arriba.';
  }, delay);
}

/**
 * DEMO CLS CORREGIDO:
 * Reserva el espacio con un placeholder (div con altura fija)
 * antes de que aparezca el banner. Cuando el banner llega,
 * ocupa el espacio ya reservado → sin desplazamiento → CLS = 0.
 */
function demoCLSBueno() {
  const delay = parseInt(
    document.getElementById('input-cls-delay').value, 10
  ) || 2000;

  limpiarBannerCLS();

  const area  = document.getElementById('cls-demo-area');
  const texto = document.getElementById('cls-texto-contenido');

  // Insertar placeholder con la misma altura que tendrá el banner
  const placeholder = document.createElement('div');
  placeholder.className = 'cls-placeholder';
  placeholder.id = 'cls-placeholder-demo';
  placeholder.textContent = '↕ Espacio reservado para el banner (sin CLS)';
  area.insertBefore(placeholder, texto);

  document.getElementById('cls-explanation').textContent =
    `✅ El espacio ya está reservado. El banner aparecerá en ${delay / 1000}s sin mover el texto.`;

  clsTimeout = setTimeout(() => {
    const ph = document.getElementById('cls-placeholder-demo');
    if (!ph) return;

    // Reemplazar el placeholder con el banner real → sin desplazamiento
    const banner = document.createElement('div');
    banner.className = 'cls-banner';
    banner.id = 'cls-banner-demo';
    banner.style.background = 'var(--good)';
    banner.style.color = '#000';
    banner.textContent = '✅ Banner en el espacio reservado. El CLS no subió.';
    banner.style.height = ph.offsetHeight + 'px';

    ph.replaceWith(banner);

    document.getElementById('cls-explanation').textContent =
      'El texto no se movió porque el espacio ya estaba reservado. ' +
      'Compara el score de CLS con el modo anterior.';
  }, delay);
}

/**
 * Limpia el banner y el placeholder del área de demo.
 */
function limpiarBannerCLS() {
  clearTimeout(clsTimeout);
  const banner      = document.getElementById('cls-banner-demo');
  const placeholder = document.getElementById('cls-placeholder-demo');
  if (banner)      banner.remove();
  if (placeholder) placeholder.remove();
}

/**
 * Reinicia la demo de CLS: limpia el área y resetea el score visual.
 * (El score real del navegador no se puede resetear, pero reseteamos
 *  nuestro contador para la demo.)
 */
function resetCLS() {
  limpiarBannerCLS();
  clsScore = 0;
  clsShiftCount = 0;
  actualizarUICLS();
  document.getElementById('card-cls').classList.remove('good', 'needs-work', 'bad');
  document.getElementById('cls-status').textContent = 'Monitoreando…';
  document.getElementById('cls-explanation').textContent = 'Demo reseteada. Presiona un botón para iniciar.';
}


/* ============================================================
   MODIFICACIONES EN VIVO
   ============================================================ */

/**
 * Permite cambiar el umbral "bueno" de LCP durante la presentación.
 * El docente puede pedir esto en vivo para mostrar cómo cambia el color.
 *
 * @param {string|number} nuevoUmbralMs
 */
function actualizarUmbralLCP(nuevoUmbralMs) {
  LCP_UMBRAL_BUENO = parseInt(nuevoUmbralMs, 10);

  // Re-evaluar el color si ya tenemos un valor de LCP
  const valorActual = document.getElementById('lcp-value').textContent;
  if (valorActual !== '—') {
    const ms = parseFloat(valorActual) * 1000;
    let nivel, statusText;
    if (ms <= LCP_UMBRAL_BUENO) {
      nivel = 'good';       statusText = '✅ Bueno';
    } else if (ms <= LCP_UMBRAL_MALO) {
      nivel = 'needs-work'; statusText = '⚠️ Necesita mejora';
    } else {
      nivel = 'bad';        statusText = '❌ Malo';
    }
    actualizarEstadoTarjeta('card-lcp', 'lcp-status', nivel, statusText);
  }

  console.log(`[CWV Demo] Umbral LCP "bueno" actualizado a ${LCP_UMBRAL_BUENO} ms`);
}

/**
 * Imprime en consola el elemento que disparó el LCP.
 * El docente puede pedir "¿qué elemento disparó el LCP?" — esto lo responde.
 */
function mostrarElementoLCP() {
  if (!lcpEntry) {
    console.warn('[CWV Demo] Aún no se ha registrado una entrada LCP.');
    return;
  }
  console.group('[CWV Demo] Entrada LCP');
  console.log('Elemento:', lcpEntry.element);
  console.log('Tag:', lcpEntry.element?.tagName);
  console.log('startTime:', lcpEntry.startTime.toFixed(2), 'ms');
  console.log('size:', lcpEntry.size, 'px²');
  console.log('URL (si es imagen):', lcpEntry.url);
  console.groupEnd();
  alert(`Elemento LCP: <${lcpEntry.element?.tagName?.toLowerCase() ?? 'desconocido'}>
startTime: ${lcpEntry.startTime.toFixed(0)} ms
Revisa la consola del navegador (F12) para ver el objeto completo.`);
}


/* ============================================================
   INICIALIZACIÓN
   ============================================================ */

/**
 * Arranca los tres observers al cargar la página.
 * Se usa DOMContentLoaded para garantizar que el DOM existe,
 * pero los observers capturan entradas anteriores gracias a buffered: true.
 */
document.addEventListener('DOMContentLoaded', () => {
  iniciarMedicionLCP();
  iniciarMedicionINP();
  iniciarMedicionCLS();

  console.log('[CWV Demo] PerformanceObservers activos para LCP, INP y CLS.');
  console.log('[CWV Demo] Funciones disponibles en consola:');
  console.log('  simularTrabajo(ms)     → genera una interacción lenta para INP');
  console.log('  demoCLSMalo()          → provoca CLS alto');
  console.log('  demoCLSBueno()         → muestra la corrección');
  console.log('  resetCLS()             → reinicia la demo de CLS');
  console.log('  actualizarUmbralLCP(ms) → cambia el umbral "bueno" en vivo');
  console.log('  mostrarElementoLCP()   → imprime la entrada LCP en consola');
});
