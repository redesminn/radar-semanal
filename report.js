// Construye el informe visual (HTML) y las exportaciones para Excel.
import { esc, num, pct, pctSigno, dinero, fecha } from './format.js';

const COSTOS = new Set(['cpl', 'costo_por_venta', 'tiempo_respuesta_horas']);
const NEUTRAS = new Set(['inversion']); // subir o bajar la inversión no es bueno ni malo por sí solo

function delta(v, metrica = 'leads') {
  if (v == null || !Number.isFinite(v)) return '<span class="delta">—</span>';
  const mejor = COSTOS.has(metrica) ? v < 0 : v > 0;
  const clase = Math.abs(v) < 0.005 || NEUTRAS.has(metrica) ? '' : mejor ? 'sube' : 'baja';
  return `<span class="delta ${clase}">${pctSigno(v)}</span>`;
}

function embudoHTML(embudo) {
  if (!embudo.length) return '';
  const max = Math.log10(Math.max(...embudo.map((e) => e.valor), 10));
  const filas = embudo.map((e, i) => {
    const ancho = e.valor > 0 ? Math.max(4, (Math.log10(e.valor + 1) / max) * 100) : 0;
    const previo = embudo[i - 1];
    const paso = previo && previo.valor > 0 ? `${pct(e.valor / previo.valor)} del paso anterior` : '';
    return `<div class="etapa">
      <span class="etapa-nombre">${esc(e.etapa)}</span>
      <span class="etapa-barra"><span style="width:${ancho.toFixed(1)}%"></span></span>
      <span class="etapa-valor">${num(e.valor)}</span>
      <span class="etapa-paso">${paso}</span>
      <span class="etapa-var">${delta(e.var_promedio4)}</span>
    </div>`;
  }).join('');
  return `<section class="bloque">
    <h3>Embudo de la semana</h3>
    <p class="nota">Barras en escala logarítmica para que alcance y ventas quepan en la misma vista. La última columna compara con el promedio de 4 semanas.</p>
    <div class="embudo">${filas}</div>
  </section>`;
}

function tablaCanales(calc) {
  const L = calc.etiquetas?.leads || 'Leads';
  const V = calc.etiquetas?.ventas || 'Venta';
  const filas = calc.por_canal.map((c) => {
    const a = c.actual || {};
    return `<tr>
      <th scope="row">${esc(c.canal)}</th>
      <td>${num(a.alcance)}</td>
      <td>${pct(a.tasa_interaccion, 2)}</td>
      <td>${num(a.clics)}</td>
      <td><strong>${num(a.leads)}</strong></td>
      <td>${num(a.leads_por_mil, a.leads_por_mil != null && a.leads_por_mil < 0.1 ? 3 : 2)}</td>
      <td>${pct(a.conv_lead_venta)}</td>
      <td>${delta(c.var_anterior?.leads)}</td>
      <td>${delta(c.var_promedio4?.leads)}</td>
    </tr>`;
  }).join('');
  const t = calc.total.actual || {};
  return `<section class="bloque">
    <h3>Canales</h3>
    <div class="desplazable"><table class="tabla">
      <thead><tr><th scope="col">Canal</th><th scope="col">Alcance</th><th scope="col">Interacción</th><th scope="col">Clics</th><th scope="col">${esc(L)}</th><th scope="col">${esc(L)} por 1.000</th><th scope="col">${esc(L)} a ${esc(V.toLowerCase())}</th><th scope="col">${esc(L)} vs. semana anterior</th><th scope="col">${esc(L)} vs. promedio 4 semanas</th></tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><th scope="row">Total</th><td>${num(t.alcance)}</td><td>${pct(t.tasa_interaccion, 2)}</td><td>${num(t.clics)}</td><td><strong>${num(t.leads)}</strong></td><td>${num(t.leads_por_mil, t.leads_por_mil != null && t.leads_por_mil < 0.1 ? 3 : 2)}</td><td>${pct(t.conv_lead_venta)}</td><td>${delta(calc.total.var_anterior?.leads)}</td><td>${delta(calc.total.var_promedio4?.leads)}</td></tr></tfoot>
    </table></div>
  </section>`;
}

function pautaHTML(calc) {
  const p = calc.por_tipo.find((t) => t.tipo === 'pauta');
  if (!p?.actual?.inversion) return '';
  const a = p.actual;
  const v = p.var_promedio4 || p.var_anterior || {};
  const dato = (etiqueta, valor, variacion, metrica) => `<div class="dato"><span class="dato-etiqueta">${etiqueta}</span><span class="dato-valor">${valor}</span>${delta(variacion, metrica)}</div>`;
  return `<section class="bloque">
    <h3>Pauta</h3>
    <div class="datos">
      ${dato('Inversión', dinero(a.inversion), v.inversion, 'inversion')}
      ${dato('Leads', num(a.leads), v.leads, 'leads')}
      ${dato('Costo por lead', dinero(a.cpl), v.cpl, 'cpl')}
      ${dato('Ventas', num(a.ventas), v.ventas, 'ventas')}
      ${dato('ROAS', a.roas == null ? '—' : `${num(a.roas, 1)} x`, v.roas, 'roas')}
    </div>
  </section>`;
}

function alertasHTML(calc, inf) {
  const etiquetas = { alta: 'Atención', media: 'Revisar', positiva: 'Buena señal' };
  const lista = calc.alertas.map((a) => `<li data-nivel="${a.nivel}"><span class="nivel">${etiquetas[a.nivel]}</span>${esc(a.mensaje)}</li>`).join('');
  const lectura = inf?.lectura_alertas?.length
    ? `<div class="lectura"><h4>Lectura del agente</h4><ul>${inf.lectura_alertas.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>` : '';
  return `<section class="bloque">
    <h3>Alertas</h3>
    ${lista ? `<ul class="alertas">${lista}</ul>` : '<p class="nota">Sin alertas con los umbrales actuales.</p>'}
    ${lectura}
  </section>`;
}

function tendenciaHTML(calc) {
  const { semanas, canales, total_leads: tot } = calc.tendencia;
  if (semanas.length < 2) return '';
  const cab = semanas.map((s) => `<th scope="col">${esc(fecha(s, true))}</th>`).join('');
  const filas = canales.map((c) => `<tr><th scope="row">${esc(c.canal)}</th>${c.leads.map((l) => `<td>${num(l)}</td>`).join('')}</tr>`).join('');
  return `<section class="bloque">
    <h3>Tendencia: ${esc((calc.etiquetas?.leads || 'leads').toLowerCase())}</h3>
    <div class="desplazable"><table class="tabla compacta">
      <thead><tr><th scope="col">Canal</th>${cab}</tr></thead>
      <tbody>${filas}</tbody>
      <tfoot><tr><th scope="row">Total</th>${tot.map((l) => `<td>${num(l)}</td>`).join('')}</tr></tfoot>
    </table></div>
  </section>`;
}

function analisisHTML(inf) {
  if (!inf) {
    return `<section class="pendiente">
      <p>Estas son las cifras de la semana. Pulsa <strong>Generar informe</strong> para que el agente añada hallazgos, hipótesis y acciones priorizadas.</p>
    </section>`;
  }
  const hallazgos = inf.hallazgos.map((h) => `<li><span class="cifra">${esc(h.cifra)}</span><strong>${esc(h.titulo)}</strong><p>${esc(h.detalle)}</p></li>`).join('');
  const hipotesis = inf.hipotesis.map((h) => `<li><p class="enunciado">${esc(h.enunciado)}</p><p><span class="rotulo">Evidencia:</span> ${esc(h.evidencia)}</p><p><span class="rotulo">Cómo validarla:</span> ${esc(h.como_validar)}</p></li>`).join('');
  return `<section class="bloque">
      <h3>Hallazgos</h3>
      <ol class="hallazgos">${hallazgos}</ol>
    </section>
    <section class="bloque">
      <h3>Hipótesis</h3>
      <ul class="hipotesis">${hipotesis}</ul>
    </section>
    <section class="bloque">
      <h3>Acciones propuestas</h3>
      <div class="desplazable"><table class="tabla acciones">
        <thead><tr><th scope="col">Prioridad</th><th scope="col">Acción</th><th scope="col">Canal</th><th scope="col">Responsable</th><th scope="col">KPI a mover</th><th scope="col">Plazo</th></tr></thead>
        <tbody>${inf.acciones.map((a) => `<tr><td><span class="chip ${esc(a.prioridad).toLowerCase()}">${esc(a.prioridad)}</span></td><td>${esc(a.accion)}</td><td>${esc(a.canal)}</td><td>${esc(a.responsable)}</td><td>${esc(a.kpi_a_mover)}</td><td>${esc(a.plazo)}</td></tr>`).join('')}</tbody>
      </table></div>
    </section>`;
}

export function renderInforme(calc, inf = null, modelo = '') {
  const faltantes = [...new Set([...(calc.datos_faltantes || []), ...(inf?.datos_faltantes || [])])];
  const titular = inf
    ? `<h2 class="titular">${esc(inf.titular)}</h2><p class="resumen">${esc(inf.resumen)}</p>`
    : `<h2 class="titular">${num(calc.total.actual?.leads)} ${esc((calc.etiquetas?.leads || 'leads').toLowerCase())} y ${num(calc.total.actual?.ventas)} ${esc((calc.etiquetas?.ventas || 'ventas').toLowerCase())} esta semana</h2>`;
  return `<article class="informe">
    <header class="inf-cabecera">
      <div>
        <p class="inf-semana">Semana del ${esc(fecha(calc.semana_actual))}</p>
        <p class="nota">Comparada con la semana anterior y con el ${esc(calc.comparacion_principal)}.</p>
      </div>
      <div class="inf-botones">
        <button type="button" data-accion="copiar">Copiar tablas para Excel</button>
        ${inf ? '<button type="button" data-accion="csv">Descargar acciones (CSV)</button>' : ''}
        <button type="button" data-accion="pdf">Guardar como PDF</button>
      </div>
    </header>
    ${titular}
    ${embudoHTML(calc.embudo)}
    ${analisisHTML(inf)}
    ${tablaCanales(calc)}
    ${pautaHTML(calc)}
    ${alertasHTML(calc, inf)}
    ${tendenciaHTML(calc)}
    ${faltantes.length ? `<section class="bloque"><h3>Datos que faltan</h3><ul class="faltantes">${faltantes.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
    ${calc.definiciones ? `<details class="definiciones"><summary>Cómo se calcularon las cifras</summary><dl>${Object.entries(calc.definiciones).map(([k, v]) => `<dt>${esc(k.replace(/_/g, ' '))}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}
    <footer class="inf-pie">Cifras calculadas por la app a partir de tus archivos.${inf ? ` Interpretación generada con ${esc(modelo)}: revísala antes de decidir.` : ''}</footer>
  </article>`;
}

// Tablas separadas por tabulaciones: se pegan directo en Excel.
const decimal = (x, d = 4) => (x == null || !Number.isFinite(x) ? '' : String(Math.round(x * 10 ** d) / 10 ** d).replace('.', ','));

export function tablasExcel(calc, inf) {
  const cab = ['Canal', 'Alcance', 'Interacciones', 'Tasa de interacción', 'Clics', 'Leads', 'Leads por 1.000', 'Leads calificados', 'Ventas', 'Conversión lead a venta', 'Inversión', 'Costo por lead', 'Var. leads vs. sem. ant.', 'Var. leads vs. prom. 4 sem.'];
  const fila = (nombre, c) => {
    const a = c.actual || {};
    return [nombre, a.alcance, a.interacciones, decimal(a.tasa_interaccion), a.clics, a.leads, decimal(a.leads_por_mil, 2), a.leads_calificados, a.ventas, decimal(a.conv_lead_venta), a.inversion, decimal(a.cpl, 0), decimal(c.var_anterior?.leads), decimal(c.var_promedio4?.leads)]
      .map((v) => (v == null ? '' : v)).join('\t');
  };
  const partes = [`Semana\t${calc.semana_actual}`, '', cab.join('\t'), ...calc.por_canal.map((c) => fila(c.canal, c)), fila('Total', calc.total)];
  if (inf) {
    partes.push('', ['Prioridad', 'Acción', 'Canal', 'Responsable', 'KPI a mover', 'Plazo'].join('\t'));
    inf.acciones.forEach((a) => partes.push([a.prioridad, a.accion, a.canal, a.responsable, a.kpi_a_mover, a.plazo].join('\t')));
  }
  return partes.join('\n');
}

export function csvAcciones(calc, inf) {
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const filas = [['semana', 'prioridad', 'accion', 'canal', 'responsable', 'kpi_a_mover', 'plazo']]
    .concat(inf.acciones.map((a) => [calc.semana_actual, a.prioridad, a.accion, a.canal, a.responsable, a.kpi_a_mover, a.plazo]));
  return '\uFEFF' + filas.map((f) => f.map(q).join(';')).join('\r\n');
}
