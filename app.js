// Orquesta la app: clave, datos, cálculo, llamada a Gemini y exportaciones.
import { CONFIG } from './config.js';
import { leerBuffer } from './data.js';
import { calcular, payloadParaIA } from './kpis.js';
import { generarInforme } from './gemini.js';
import { renderInforme, tablasExcel, csvAcciones } from './report.js';
import { fecha } from './format.js';

const $ = (s) => document.querySelector(s);
const estado = { calc: null, informe: null, instrucciones: null };
const CLAVE_SESION = 'radar_semanal_clave';

const ui = {
  clave: $('#clave'), recordar: $('#recordar'), modelo: $('#modelo'),
  archivo: $('#archivo'), ejemplo: $('#usar-ejemplo'), resumen: $('#resumen-datos'),
  contexto: $('#contexto-semana'), generar: $('#generar'), mensaje: $('#mensaje'),
  informe: $('#informe'), aviso: $('#aviso'),
};

function avisar(texto) {
  ui.aviso.textContent = texto;
  ui.aviso.hidden = false;
  clearTimeout(avisar.t);
  avisar.t = setTimeout(() => { ui.aviso.hidden = true; }, 3500);
}

function mostrarMensaje(texto, tipo = 'error') {
  ui.mensaje.textContent = texto;
  ui.mensaje.dataset.tipo = tipo;
  ui.mensaje.hidden = !texto;
}

function pintar() {
  if (!estado.calc) return;
  ui.informe.innerHTML = renderInforme(estado.calc, estado.informe, ui.modelo.value.trim());
  ui.informe.classList.remove('vacio');
}

function actualizarBoton() {
  ui.generar.disabled = !(estado.calc && ui.clave.value.trim());
}

async function cargarInstrucciones() {
  if (estado.instrucciones) return estado.instrucciones;
  try {
    const partes = await Promise.all(CONFIG.archivosContexto.map(async (ruta) => {
      const res = await fetch(ruta);
      if (!res.ok) throw new Error(ruta);
      return res.text();
    }));
    estado.instrucciones = partes.join('\n\n---\n\n');
    return estado.instrucciones;
  } catch (e) {
    throw new Error(`No se pudieron leer los archivos de instrucciones (.md) (${e.message}). Abre la app desde GitHub Pages o con un servidor local; al abrir index.html con doble clic el navegador bloquea esa lectura.`);
  }
}

function procesar(buffer, nombre) {
  mostrarMensaje('');
  try {
    const { filas, columnasAusentes, advertencias } = leerBuffer(buffer, nombre);
    estado.calc = calcular(filas, columnasAusentes);
    estado.informe = null;
    const s = estado.calc.tendencia.semanas;
    const canales = estado.calc.por_canal.length;
    ui.resumen.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = `${nombre}: ${filas.length} filas, ${estado.calc.n_semanas} semanas (${fecha(s[0], true)} a ${fecha(s.at(-1), true)}), ${canales} canales.`;
    ui.resumen.append(p);
    advertencias.slice(0, 5).forEach((a) => {
      const li = document.createElement('p');
      li.className = 'advertencia';
      li.textContent = a;
      ui.resumen.append(li);
    });
    pintar();
  } catch (e) {
    estado.calc = null;
    ui.resumen.textContent = '';
    mostrarMensaje(e.message);
  }
  actualizarBoton();
}

ui.archivo.addEventListener('change', async () => {
  const f = ui.archivo.files?.[0];
  if (f) procesar(await f.arrayBuffer(), f.name);
});

ui.ejemplo.addEventListener('click', async () => {
  try {
    const res = await fetch('ejemplo_semanas.csv');
    if (!res.ok) throw new Error();
    procesar(await res.arrayBuffer(), 'ejemplo_semanas.csv');
  } catch {
    mostrarMensaje('No se pudo abrir el archivo de ejemplo. Abre la app desde GitHub Pages o con un servidor local.');
  }
});

ui.clave.addEventListener('input', () => {
  actualizarBoton();
  if (ui.recordar.checked) try { sessionStorage.setItem(CLAVE_SESION, ui.clave.value.trim()); } catch { /* sin almacenamiento */ }
});

ui.recordar.addEventListener('change', () => {
  try {
    if (ui.recordar.checked) sessionStorage.setItem(CLAVE_SESION, ui.clave.value.trim());
    else sessionStorage.removeItem(CLAVE_SESION);
  } catch { /* sin almacenamiento */ }
});

ui.generar.addEventListener('click', async () => {
  if (!estado.calc) return;
  mostrarMensaje('');
  ui.generar.disabled = true;
  ui.generar.textContent = 'Analizando la semana…';
  ui.informe.setAttribute('aria-busy', 'true');
  try {
    const instrucciones = await cargarInstrucciones();
    estado.informe = await generarInforme({
      apiKey: ui.clave.value.trim(),
      modelo: ui.modelo.value.trim() || CONFIG.modelo,
      temperatura: CONFIG.temperatura,
      instrucciones,
      payload: payloadParaIA(estado.calc),
      contextoSemana: ui.contexto.value,
    });
    pintar();
    avisar('Informe generado.');
  } catch (e) {
    mostrarMensaje(e.message);
  } finally {
    ui.generar.textContent = 'Generar informe';
    ui.informe.removeAttribute('aria-busy');
    actualizarBoton();
  }
});

ui.informe.addEventListener('click', async (ev) => {
  const accion = ev.target.closest('[data-accion]')?.dataset.accion;
  if (!accion || !estado.calc) return;
  if (accion === 'pdf') window.print();
  if (accion === 'copiar') {
    try {
      await navigator.clipboard.writeText(tablasExcel(estado.calc, estado.informe));
      avisar('Tablas copiadas. Pégalas en Excel.');
    } catch {
      mostrarMensaje('El navegador no permitió copiar. Usa Descargar acciones (CSV).');
    }
  }
  if (accion === 'csv' && estado.informe) {
    const blob = new Blob([csvAcciones(estado.calc, estado.informe)], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `acciones_${estado.calc.semana_actual}.csv` });
    a.click();
    URL.revokeObjectURL(a.href);
  }
});

// Inicio
ui.modelo.value = CONFIG.modelo;
try {
  const guardada = sessionStorage.getItem(CLAVE_SESION);
  if (guardada) { ui.clave.value = guardada; ui.recordar.checked = true; }
} catch { /* sin almacenamiento */ }
actualizarBoton();
