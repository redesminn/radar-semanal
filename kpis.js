// Cálculo determinista de indicadores, comparaciones y alertas.
// Todo número del informe sale de aquí; la IA solo interpreta.
import { CONFIG } from './config.js';
import { NUMERICAS, normalizar } from './data.js';
import { num, pct, pctSigno, dinero } from './format.js';

const BASE = NUMERICAS.filter((k) => k !== 'tiempo_respuesta_horas');
export const COMPARABLES = [
  'alcance', 'interacciones', 'clics', 'leads', 'leads_calificados', 'ventas', 'inversion', 'valor_ventas',
  'tasa_interaccion', 'ctr', 'leads_por_mil', 'tasa_calificacion', 'conv_lead_venta',
  'cpl', 'costo_por_venta', 'roas', 'tiempo_respuesta_horas',
];

const div = (a, b) => (a == null || b == null || b === 0 ? null : a / b);
const variacion = (a, r) => (a == null || r == null || r === 0 ? null : (a - r) / r);
const def = (x) => x != null && Number.isFinite(x);

function vacio() {
  // _lp, _vp, _vvp: leads, ventas y valor de ventas de filas pagadas (para costos de pauta).
  const m = { _tr: 0, _trN: 0, _lp: 0, _vp: 0, _vvp: 0 };
  BASE.forEach((k) => { m[k] = null; });
  return m;
}

function acumular(m, f) {
  BASE.forEach((k) => { if (f[k] != null) m[k] = (m[k] ?? 0) + f[k]; });
  if (f.tiempo_respuesta_horas != null) { m._tr += f.tiempo_respuesta_horas; m._trN += 1; }
  if (f.tipo === 'pauta' || f.inversion > 0) {
    m._lp += f.leads ?? 0;
    m._vp += f.ventas ?? 0;
    m._vvp += f.valor_ventas ?? 0;
  }
}

function promediar(lista) {
  const vals = lista.filter(Boolean);
  if (!vals.length) return null;
  const p = vacio();
  BASE.forEach((k) => {
    const xs = vals.map((v) => v[k]).filter((x) => x != null);
    p[k] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  });
  ['_lp', '_vp', '_vvp'].forEach((k) => { p[k] = vals.reduce((a, v) => a + v[k], 0) / vals.length; });
  const trs = vals.filter((v) => v._trN).map((v) => v._tr / v._trN);
  if (trs.length) { p._tr = trs.reduce((a, b) => a + b, 0); p._trN = trs.length; }
  return p;
}

function derivar(m) {
  if (!m) return null;
  const o = {};
  BASE.forEach((k) => { o[k] = m[k]; });
  o.tiempo_respuesta_horas = m._trN ? m._tr / m._trN : null;
  o.tasa_interaccion = div(m.interacciones, m.alcance);
  o.ctr = div(m.clics, m.alcance);
  const lpm = div(m.leads, m.alcance);
  o.leads_por_mil = lpm == null ? null : lpm * 1000;
  o.tasa_calificacion = div(m.leads_calificados, m.leads);
  o.conv_lead_venta = div(m.ventas, m.leads);
  // Los costos solo usan resultados de filas pagadas, para no diluirlos con lo orgánico.
  o.leads_pauta = m.inversion ? m._lp : null;
  o.cpl = m.inversion ? div(m.inversion, m._lp) : null;
  o.costo_por_venta = m.inversion ? div(m.inversion, m._vp) : null;
  o.roas = m.inversion ? div(m._vvp, m.inversion) : null;
  o.cumplimiento_meta = div(m.leads, m.meta_leads);
  return o;
}

function comparar(getter, actual, anterior, previas) {
  const a = derivar(getter(actual));
  const an = anterior ? derivar(getter(anterior)) : null;
  const pr = derivar(promediar(previas.map(getter)));
  const vs = (ref) => {
    if (!a || !ref) return null;
    const o = {};
    COMPARABLES.forEach((k) => { o[k] = variacion(a[k], ref[k]); });
    return o;
  };
  return { actual: a, anterior: an, promedio4: pr, var_anterior: vs(an), var_promedio4: vs(pr) };
}

function alertas(items, u, usaPromedio) {
  const out = [];
  const etiqueta = usaPromedio ? 'al promedio de 4 semanas' : 'a la semana anterior';
  const push = (nivel, canal, metrica, mensaje) => out.push({ nivel, canal, metrica, mensaje });

  for (const it of items) {
    const nombre = it.canal ?? 'Total';
    const a = it.actual;
    const ref = usaPromedio ? it.promedio4 : it.anterior;
    const v = usaPromedio ? it.var_promedio4 : it.var_anterior;

    if (!a) {
      if (ref?.leads) push('alta', nombre, 'datos', `${nombre} no tiene datos esta semana, pero sí en semanas anteriores.`);
      continue;
    }
    if (a.inversion > 0 && a.leads_pauta === 0) {
      push('alta', nombre, 'inversion', `${nombre}: ${dinero(a.inversion)} invertidos sin leads de pauta esta semana.`);
    }
    if (ref && v) {
      const base = ref.leads >= u.minimoBase;
      if (def(v.leads) && v.leads <= u.caidaFuerte && base) {
        push('alta', nombre, 'leads', `${nombre}: los leads bajaron ${pctSigno(v.leads)} frente ${etiqueta} (${num(a.leads)} vs. ${num(ref.leads, 1)}).`);
      }
      if (def(v.conv_lead_venta) && v.conv_lead_venta <= u.caidaFuerte && base && ref.ventas > 0) {
        push('alta', nombre, 'conv_lead_venta', `${nombre}: la conversión de lead a venta pasó de ${pct(ref.conv_lead_venta)} a ${pct(a.conv_lead_venta)}.`);
      }
      if (def(v.alcance) && def(v.leads_por_mil) && v.alcance >= u.subidaAlcance && v.leads_por_mil <= u.caidaEficiencia) {
        push('media', nombre, 'leads_por_mil', `${nombre}: el alcance subió ${pctSigno(v.alcance)}, pero los leads por cada 1.000 de alcance cambiaron ${pctSigno(v.leads_por_mil)} (${num(a.leads_por_mil, 2)} vs. ${num(ref.leads_por_mil, 2)}).`);
      }
      if (it.canal && def(v.cpl) && v.cpl >= u.subidaCosto) {
        push('media', nombre, 'cpl', `${nombre}: el costo por lead subió de ${dinero(ref.cpl)} a ${dinero(a.cpl)} (${pctSigno(v.cpl)}).`);
      }
      if (def(v.tasa_interaccion) && v.tasa_interaccion <= u.caidaFuerte) {
        push('media', nombre, 'tasa_interaccion', `${nombre}: la tasa de interacción bajó de ${pct(ref.tasa_interaccion, 2)} a ${pct(a.tasa_interaccion, 2)}.`);
      }
      if (def(v.tiempo_respuesta_horas) && v.tiempo_respuesta_horas >= u.subidaRespuesta) {
        push('media', nombre, 'tiempo_respuesta_horas', `${nombre}: el tiempo de respuesta subió de ${num(ref.tiempo_respuesta_horas, 1)} h a ${num(a.tiempo_respuesta_horas, 1)} h.`);
      }
      if (def(v.leads) && v.leads >= u.subidaFuerte && a.leads >= u.minimoBase) {
        push('positiva', nombre, 'leads', `${nombre}: los leads subieron ${pctSigno(v.leads)} frente ${etiqueta} (${num(a.leads)} vs. ${num(ref.leads, 1)}).`);
      }
    }
    if (def(a.cumplimiento_meta) && a.cumplimiento_meta < u.cumplimientoMeta) {
      push('media', nombre, 'cumplimiento_meta', `${nombre}: ${num(a.leads)} leads de una meta de ${num(a.meta_leads)} (${pct(a.cumplimiento_meta, 0)}).`);
    }
  }
  const orden = { alta: 0, media: 1, positiva: 2 };
  return out.sort((x, y) => orden[x.nivel] - orden[y.nivel]);
}

const EXPLICACION_FALTANTES = {
  leads_calificados: 'Leads calificados: sin esta columna no se puede medir la calidad del lead.',
  ventas: 'Ventas: sin esta columna no se sabe qué canal genera negocio.',
  valor_ventas: 'Valor de ventas: necesario para calcular el retorno de la pauta (ROAS).',
  inversion: 'Inversión: necesaria para el costo por lead y el control de pauta.',
  tipo: 'Tipo (orgánico o pauta): necesario para separar resultados pagados de orgánicos.',
  citas: 'Citas: permite ver dónde se frena el embudo.',
  cotizaciones: 'Cotizaciones: permite ver dónde se frena el embudo.',
  conversaciones: 'Conversaciones por mensajes o WhatsApp: ayuda a detectar leads sin atribuir.',
  tiempo_respuesta_horas: 'Tiempo de respuesta: ayuda a explicar caídas en la conversión.',
  meta_leads: 'Meta de leads por canal: permite medir cumplimiento.',
  interacciones: 'Interacciones: necesarias para la tasa de interacción.',
  clics: 'Clics: necesarios para la tasa de clics.',
};

export function calcular(filas, columnasAusentes = [], extra = {}) {
  const u = CONFIG.umbrales;
  const semanas = [...new Set(filas.map((f) => f.semana))].sort();
  const canales = [...new Set(filas.map((f) => f.canal))];
  const tipos = [...new Set(filas.map((f) => f.tipo))];
  const porSemana = {};
  const porCanal = {};
  const porTipo = {};

  for (const f of filas) {
    acumular((porSemana[f.semana] ??= vacio()), f);
    acumular(((porCanal[f.semana] ??= {})[f.canal] ??= vacio()), f);
    acumular(((porTipo[f.semana] ??= {})[f.tipo] ??= vacio()), f);
  }

  const actual = semanas.at(-1);
  const anterior = semanas.length > 1 ? semanas.at(-2) : null;
  const previas = semanas.slice(-5, -1);
  const usaPromedio = previas.length >= 2;

  const total = comparar((s) => porSemana[s], actual, anterior, previas);
  const canalesCalc = canales
    .map((c) => ({ canal: c, ...comparar((s) => porCanal[s]?.[c], actual, anterior, previas) }))
    .sort((a, b) => (b.actual?.leads ?? -1) - (a.actual?.leads ?? -1));
  const tiposCalc = tipos.map((t) => ({ tipo: t, ...comparar((s) => porTipo[s]?.[t], actual, anterior, previas) }));

  const etapas = [
    ['Alcance', 'alcance'], ['Clics', 'clics'], ['Leads', 'leads'], ['Leads calificados', 'leads_calificados'],
    ['Citas', 'citas'], ['Cotizaciones', 'cotizaciones'], ['Ventas', 'ventas'],
  ];
  const embudo = etapas
    .filter(([, k]) => total.actual?.[k] != null)
    .map(([nombre, k]) => ({ etapa: extra.etiquetas?.[k] || nombre, valor: total.actual[k], var_promedio4: total.var_promedio4?.[k] ?? null }));

  const ultimas = semanas.slice(-6);
  const tendencia = {
    semanas: ultimas,
    canales: canales.map((c) => ({ canal: c, leads: ultimas.map((s) => porCanal[s]?.[c]?.leads ?? null) })),
    total_leads: ultimas.map((s) => porSemana[s]?.leads ?? null),
  };

  const faltantes = columnasAusentes.filter((k) => EXPLICACION_FALTANTES[k]).map((k) => EXPLICACION_FALTANTES[k]);
  const conDatos = new Set(canales.filter((c) => porCanal[actual]?.[c]).map(normalizar));
  CONFIG.canalesEsperados
    .filter((c) => !conDatos.has(normalizar(c)))
    .forEach((c) => faltantes.push(`${c}: no hay datos para la semana analizada.`));
  if (semanas.length < 5) {
    faltantes.push(`Solo hay ${semanas.length} semana(s) de historial; el promedio usa las disponibles.`);
  }

  return {
    semana_actual: actual,
    semana_anterior: anterior,
    semanas_promedio: previas,
    comparacion_principal: usaPromedio ? 'promedio de 4 semanas' : 'semana anterior',
    n_semanas: semanas.length,
    total,
    por_canal: canalesCalc,
    por_tipo: tiposCalc,
    embudo,
    tendencia,
    alertas: alertas([total, ...canalesCalc], u, usaPromedio),
    notas_semana: filas.filter((f) => f.semana === actual && f.notas).map((f) => `${f.canal} (${f.tipo}): ${f.notas}`),
    datos_faltantes: faltantes,
    definiciones: extra.definiciones || null,
    etiquetas: extra.etiquetas || {},
  };
}

// Versión compacta y redondeada para enviar a la IA.
export function payloadParaIA(calc) {
  const redondear = (x) => {
    if (typeof x === 'number') return Math.round(x * 10000) / 10000;
    if (Array.isArray(x)) return x.map(redondear);
    if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, redondear(v)]));
    return x;
  };
  return redondear(calc);
}
