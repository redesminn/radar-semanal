// Orquesta la app: clave, datos, cálculo, llamada a Gemini y exportaciones.
import { CONFIG } from './config.js';
import { leerBuffer } from './data.js';
import { tipoDeLibro, construirTablaMinn } from './minn.js';
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

// Acepta la plantilla del agente (un archivo) o los archivos propios de Minn (métricas + llamadas).
function leerArchivos(lista) {
  if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Revisa la conexión y recarga la página.');
  const libros = lista.map(({ buffer, nombre }) => {
    const esTexto = /\.(csv|tsv|txt)$/i.test(nombre);
    const libro = esTexto ? null : XLSX.read(buffer, { type: 'array' });
    const anio = Number((nombre.match(/20\d\d/) || [])[0]) || new Date().getFullYear();
    return { nombre, buffer, libro, anio, tipo: libro ? tipoDeLibro(libro) : 'generico' };
  });
  const propios = libros.filter((l) => l.tipo !== 'generico');
  if (propios.length) {
    if (!propios.some((l) => l.tipo === 'metricas' || l.tipo === 'llamadas')) {
      throw new Error('Ese archivo no trae métricas por canal. Sube también MÉTRICAS_RRSS y Llamadas agendadas y ventas.');
    }
    return construirTablaMinn(propios);
  }
  if (libros.length > 1) throw new Error('Sube un solo archivo con el formato de la plantilla, o tus archivos de métricas y de llamadas juntos.');
  return leerBuffer(libros[0].buffer, libros[0].nombre);
}

function procesar(lista) {
  mostrarMensaje('');
  try {
    const { filas, columnasAusentes, advertencias, definiciones, etiquetas } = leerArchivos(lista);
    estado.calc = calcular(filas, columnasAusentes, { definiciones, etiquetas });
    estado.informe = null;
    const s = [...new Set(filas.map((f) => f.semana))].sort();
    ui.resumen.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = `${lista.map((a) => a.nombre).join(', ')}: ${estado.calc.n_semanas} semanas (${fecha(s[0], true)} a ${fecha(s.at(-1), true)}), ${estado.calc.por_canal.length} canales.`;
    ui.resumen.append(p);
    advertencias.slice(0, 6).forEach((a) => {
      const linea = document.createElement('p');
      linea.className = 'advertencia';
      linea.textContent = a;
      ui.resumen.append(linea);
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
  const archivos = [...(ui.archivo.files || [])];
  if (!archivos.length) return;
  procesar(await Promise.all(archivos.map(async (f) => ({ buffer: await f.arrayBuffer(), nombre: f.name }))));
});

ui.ejemplo.addEventListener('click', async () => {
  try {
    const res = await fetch('ejemplo_semanas.csv');
    if (!res.ok) throw new Error();
    procesar([{ buffer: await res.arrayBuffer(), nombre: 'ejemplo_semanas.csv' }]);
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
