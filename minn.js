// Lector de los archivos propios de Minn:
//   - MÉTRICAS_RRSS (una columna por semana, un bloque por red)
//   - Llamadas agendadas y ventas (una fila por lead + hoja de cierres)
// Los convierte en la tabla semanal (semana + canal + tipo) que usa el agente.
// Los nombres de clientes solo se usan aquí, en tu navegador, para cruzar hojas:
// nunca se envían a Gemini.
import { NUMERICAS, normalizar, parsearNumero } from './data.js';

// ---------- Reglas de atribución (edítalas si cambian tus códigos de fuente) ----------
export function atribuir(fuente, comoLlego) {
  const f = normalizar(fuente);
  const t = normalizar(comoLlego);
  if (/add|campaign|ads/.test(f) || /publicidad/.test(t)) return ['Instagram', 'pauta'];
  if (/tik_?tok/.test(t) || /tiktok/.test(f)) return ['TikTok', 'organico'];
  if (/youtube/.test(f) || /youtube/.test(t)) return ['YouTube', 'organico'];
  if (/^w?app|whatsapp/.test(f)) return ['WhatsApp', 'organico'];
  if (/web/.test(f)) return ['Página web', 'organico'];
  if (/voz_a_voz/.test(t) || /voz_a_voz/.test(f)) return ['Voz a voz', 'organico'];
  if (/ig|insta|linktr/.test(f) || /instagram|los_sigo/.test(t)) return ['Instagram', 'organico'];
  return ['Sin atribuir', 'sin_dato'];
}

export const DEFINICIONES = {
  alcance: 'Instagram: visualizaciones; Stories: alcance; TikTok: visualizaciones de videos; YouTube: sin dato de alcance',
  interacciones: 'Instagram, Stories: interacciones; TikTok: likes + comentarios + compartidos + guardados; YouTube: variación semanal de me gusta + comentarios + compartidos',
  clics: 'Clics en el enlace externo de Instagram',
  leads: 'Llamadas agendadas, por fecha de agendamiento',
  leads_calificados: 'Llamadas con calidad de lead Alto o Medio',
  citas: 'Llamadas tomadas (entraron a la fase de llamada)',
  ventas: 'Cierres por fecha de cierre, sin cancelados',
  valor_ventas: '$ Asesoría + $ Muebles + $ Obra',
  atribucion: 'Canal según la fuente del agendamiento y la respuesta a "¿Por dónde llegó?": códigos de anuncios o "vi una publicidad" = Instagram pauta; "Tik Tok" = TikTok; Wapporg = WhatsApp; pgwebpg = Página web; igorgig y markigsetteo = Instagram orgánico',
};

export const ETIQUETAS = { leads: 'Llamadas agendadas', leads_calificados: 'Llamadas calificadas', citas: 'Llamadas tomadas', ventas: 'Cierres' };

// ---------- Utilidades de fechas ----------
const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12 };
const iso = (d) => d.toISOString().slice(0, 10);

function aFecha(v) {
  if (v == null || v === '') return null;
  let d = null;
  if (typeof v === 'number') {
    const p = XLSX.SSF.parse_date_code(v);
    if (p) d = new Date(Date.UTC(p.y, p.m - 1, p.d));
  } else if (v instanceof Date) {
    d = new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  } else {
    const s = String(v).trim();
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
  }
  return d && d.getUTCFullYear() >= 2020 ? d : null;
}

// Lunes de la semana de una fecha (las semanas de Minn van de lunes a domingo).
function lunes(d) {
  const l = new Date(d);
  l.setUTCDate(l.getUTCDate() - ((l.getUTCDay() + 6) % 7));
  return iso(l);
}

// "29 Dic - 4 Ene", "5 oct - 11 oct" → fecha del lunes. El año se deduce del nombre del archivo.
function semanasDeEncabezado(etiquetas, anioArchivo) {
  let anio = null;
  let mesAnterior = null;
  return etiquetas.map((e) => {
    const m = String(e ?? '').toLowerCase().match(/(\d{1,2})\s*(?:de\s*)?([a-záéíóú]{3})/);
    if (!m || !MESES[m[2]]) return null;
    const mes = MESES[m[2]];
    if (anio == null) anio = mes === 12 ? anioArchivo - 1 : anioArchivo;
    else if (mesAnterior && mes < mesAnterior) anio += 1;
    mesAnterior = mes;
    return lunes(new Date(Date.UTC(anio, mes - 1, +m[1])));
  });
}

// Lee la hoja como matriz desde A1, aunque Excel guarde un rango que empiece más adentro.
function aoa(hoja) {
  if (!hoja?.['!ref']) return [];
  const rango = XLSX.utils.decode_range(hoja['!ref']);
  rango.s.r = 0;
  rango.s.c = 0;
  return XLSX.utils.sheet_to_json(hoja, { header: 1, raw: true, defval: null, blankrows: true, range: rango });
}

// ---------- Detección ----------
export function tipoDeLibro(libro) {
  const nombres = libro.SheetNames.map(normalizar);
  if (nombres.some((n) => n.includes('llamadas'))) return 'llamadas';
  if (nombres.some((n) => n.includes('nuevos_leads') || n.includes('leads_x_campana'))) return 'seguimiento';
  const filas = aoa(libro.Sheets[libro.SheetNames[0]]).slice(0, 15);
  if (filas.some((f) => normalizar(f[2]) === 'tendencia')) return 'metricas';
  return 'generico';
}

// ---------- Métricas de redes ----------
function leerMetricas(libro, anioArchivo) {
  const filas = aoa(libro.Sheets[libro.SheetNames[0]]);
  const cabeceras = filas.map((f, i) => (normalizar(f[2]) === 'tendencia' ? i : -1)).filter((i) => i >= 0);
  const porDefecto = ['Instagram', 'Stories', 'TikTok', 'YouTube'];
  const bloques = cabeceras.map((inicio, b) => {
    const fin = cabeceras[b + 1] ?? filas.length;
    const rotulo = normalizar(filas[inicio - 1]?.[1] ?? '') + normalizar(filas[inicio - 2]?.[1] ?? '');
    let canal = porDefecto[b] ?? `Red ${b + 1}`;
    if (rotulo.includes('historia')) canal = 'Stories';
    else if (rotulo.includes('youtube')) canal = 'YouTube';
    else if (rotulo.includes('tik')) canal = 'TikTok';
    // Primera aparición de cada rótulo dentro del bloque.
    const filasPorRotulo = {};
    for (let i = inicio + 1; i < fin; i += 1) {
      const r = normalizar(filas[i]?.[1]);
      if (r && !(r in filasPorRotulo)) filasPorRotulo[r] = filas[i];
    }
    return { canal, semanas: semanasDeEncabezado(filas[inicio], anioArchivo), filasPorRotulo };
  });

  const salida = [];
  for (const b of bloques) {
    const valor = (rotulo, j) => parsearNumero(b.filasPorRotulo[rotulo]?.[j]);
    const texto = (rotulo, j) => {
      const v = b.filasPorRotulo[rotulo]?.[j];
      return v == null || typeof v === 'number' ? '' : String(v).trim();
    };
    const suma = (rotulos, j) => {
      const xs = rotulos.map((r) => valor(r, j)).filter((x) => x != null);
      return xs.length ? xs.reduce((a, c) => a + c, 0) : null;
    };
    b.semanas.forEach((semana, j) => {
      if (!semana) return;
      let alcance = null;
      let interacciones = null;
      let clics = null;
      let nota = '';
      if (b.canal === 'Instagram') {
        alcance = valor('visualizaciones', j);
        interacciones = valor('interacciones', j);
        clics = valor('clicks_en_el_enlace_externo', j);
        if (texto('publicacion_estrella', j)) nota = `Publicación estrella: ${texto('publicacion_estrella', j)}`;
      } else if (b.canal === 'Stories') {
        alcance = valor('alcance', j);
        interacciones = valor('interacciones', j);
        if (texto('historia_iconica', j)) nota = `Historia icónica: ${texto('historia_iconica', j)}`;
      } else if (b.canal === 'TikTok') {
        alcance = valor('visualizaciones_de_videos', j);
        interacciones = suma(['total_likes', 'total_comentarios', 'total_compartidos', 'total_guardado'], j);
        if (texto('publicacion_estrella', j)) nota = `Publicación estrella: ${texto('publicacion_estrella', j)}`;
      } else if (b.canal === 'YouTube') {
        const hoy = suma(['me_gusta', 'comentarios', 'veces_que_se_compartio'], j);
        const antes = j > 0 ? suma(['me_gusta', 'comentarios', 'veces_que_se_compartio'], j - 1) : null;
        interacciones = hoy != null && antes != null ? Math.max(0, hoy - antes) : null;
      }
      if (alcance == null && interacciones == null) return;
      salida.push({ semana, canal: b.canal, alcance, interacciones, clics, nota });
    });
  }
  return salida;
}

// ---------- Llamadas y cierres ----------
function tabla(hoja, columnaClave) {
  const filas = aoa(hoja);
  const ini = filas.slice(0, 6).findIndex((f) => f.some((c) => normalizar(c) === columnaClave));
  if (ini < 0) return null;
  const cab = filas[ini].map(normalizar);
  const col = (nombre) => cab.findIndex((c) => c === nombre || c.startsWith(nombre));
  return { filas: filas.slice(ini + 1), col, cab };
}

function leerLlamadas(libro) {
  const hojaLlamadas = libro.SheetNames.find((n) => normalizar(n).includes('llamadas'));
  const hojaCierres = libro.SheetNames.find((n) => normalizar(n).includes('cerrad'));
  const t = tabla(libro.Sheets[hojaLlamadas], 'fecha_de_agendamiento');
  if (!t) throw new Error(`No encontré la columna "Fecha de agendamiento" en la hoja ${hojaLlamadas}.`);
  const c = {
    nombre: t.col('nombre'), apellido: t.col('apellido'), llego: t.col('por_donde_llego'),
    fecha: t.col('fecha_de_agendamiento'), llamada: t.col('first_time_enter_llamada'),
    calidad: t.col('calidad_de_lead'), fuente: t.col('fuente'),
  };
  const comoLlego = new Map();
  const llamadas = [];
  for (const f of t.filas) {
    const d = aFecha(f[c.fecha]);
    if (!d) continue;
    const clave = normalizar(`${f[c.nombre] ?? ''} ${f[c.apellido] ?? ''}`);
    if (clave) comoLlego.set(clave, f[c.llego]);
    const [canal, tipo] = atribuir(f[c.fuente], f[c.llego]);
    llamadas.push({
      semana: lunes(d), canal, tipo,
      calificada: /alto|medio/.test(normalizar(f[c.calidad])) ? 1 : 0,
      tomada: aFecha(f[c.llamada]) ? 1 : 0,
    });
  }

  const cierres = [];
  let cancelados = 0;
  if (hojaCierres) {
    const k = tabla(libro.Sheets[hojaCierres], 'cerramos_perros');
    if (k) {
      const cc = {
        nombre: k.col('nombre'), apellido: k.col('apellido'), fecha: k.col('cerramos_perros'), fuente: k.col('fuente_campana'),
      };
      const colsValor = ['asesoria', 'muebles', 'obra'].map((v) => k.cab.indexOf(v)).filter((i) => i >= 0);
      for (const f of k.filas) {
        const d = aFecha(f[cc.fecha]);
        if (!d) continue;
        const nombre = `${f[cc.nombre] ?? ''} ${f[cc.apellido] ?? ''}`;
        if (/cancelad/i.test(nombre)) { cancelados += 1; continue; }
        const [canal, tipo] = atribuir(f[cc.fuente], comoLlego.get(normalizar(nombre)));
        const valores = colsValor.map((i) => parsearNumero(f[i])).filter((x) => x != null);
        cierres.push({ semana: lunes(d), canal, tipo, valor: valores.length ? valores.reduce((a, b) => a + b, 0) : null });
      }
    }
  }
  return { llamadas, cierres, cancelados };
}

// ---------- Ensamble ----------
export function construirTablaMinn(libros) {
  const advertencias = [];
  const met = libros.filter((l) => l.tipo === 'metricas');
  const lla = libros.filter((l) => l.tipo === 'llamadas');
  if (libros.some((l) => l.tipo === 'seguimiento')) {
    advertencias.push('Seguimiento de leads no se usó: sus semanas no coinciden con las de redes (no van de lunes a domingo) y no separa por canal. Las llamadas ya traen ese detalle por lead.');
  }

  const redes = met.flatMap((l) => leerMetricas(l.libro, l.anio));
  const { llamadas = [], cierres = [], cancelados = 0 } = lla.length ? leerLlamadas(lla[0].libro) : {};
  if (cancelados) advertencias.push(`${cancelados} cierres marcados como CANCELADO no se contaron como ventas.`);

  // Semanas válidas: las que tienen métricas de Instagram; si no hay métricas, las de las llamadas.
  let semanas = [...new Set(redes.filter((r) => r.canal === 'Instagram' && r.alcance != null).map((r) => r.semana))].sort();
  if (!semanas.length) semanas = [...new Set(llamadas.map((l) => l.semana))].sort();
  if (!semanas.length) throw new Error('No encontré semanas con datos en los archivos.');
  const primera = semanas[0];
  const ultima = semanas.at(-1);
  const posteriores = llamadas.filter((l) => l.semana > ultima).length;
  if (posteriores && redes.length) {
    advertencias.push(`Hay ${posteriores} llamadas agendadas después de la semana del ${ultima}, pero las métricas de redes llegan hasta esa semana. Actualiza MÉTRICAS_RRSS para analizar la semana más reciente.`);
  }
  const valida = (s) => semanas.includes(s);

  const tabla = new Map();
  const fila = (semana, canal, tipo) => {
    const clave = `${semana}|${canal}|${tipo}`;
    if (!tabla.has(clave)) {
      const f = { semana, canal, tipo, notas: '' };
      NUMERICAS.forEach((k) => { f[k] = null; });
      tabla.set(clave, f);
    }
    return tabla.get(clave);
  };
  const sumar = (f, k, v) => { if (v != null) f[k] = (f[k] ?? 0) + v; };

  for (const r of redes) {
    if (!valida(r.semana)) continue;
    const f = fila(r.semana, r.canal, 'organico');
    f.alcance = r.alcance;
    f.interacciones = r.interacciones;
    f.clics = r.clics;
    f.notas = r.nota;
  }

  // Canales que reciben leads: ceros explícitos en las semanas sin llamadas, para que los promedios sean justos.
  const canalesLeads = new Set([...llamadas, ...cierres].map((l) => `${l.canal}|${l.tipo}`));
  ['Instagram|organico', 'TikTok|organico', 'YouTube|organico'].forEach((c) => { if (lla.length) canalesLeads.add(c); });
  for (const s of semanas) {
    for (const c of canalesLeads) {
      const [canal, tipo] = c.split('|');
      const f = fila(s, canal, tipo);
      ['leads', 'leads_calificados', 'citas', 'ventas'].forEach((k) => { if (f[k] == null) f[k] = 0; });
    }
  }
  for (const l of llamadas) {
    if (!valida(l.semana)) continue;
    const f = fila(l.semana, l.canal, l.tipo);
    sumar(f, 'leads', 1);
    sumar(f, 'leads_calificados', l.calificada);
    sumar(f, 'citas', l.tomada);
  }
  for (const v of cierres) {
    if (!valida(v.semana)) continue;
    const f = fila(v.semana, v.canal, v.tipo);
    sumar(f, 'ventas', 1);
    sumar(f, 'valor_ventas', v.valor);
  }

  const filas = [...tabla.values()];
  const presentes = new Set(['semana', 'canal', 'tipo', 'notas']);
  filas.forEach((f) => NUMERICAS.forEach((k) => { if (f[k] != null) presentes.add(k); }));
  const columnasAusentes = ['inversion', 'impresiones', 'cotizaciones', 'conversaciones', 'tiempo_respuesta_horas', 'meta_leads']
    .filter((k) => !presentes.has(k));
  advertencias.unshift(`Archivos de Minn: ${semanas.length} semanas (${primera} a ${ultima}).`);
  return { filas, columnasAusentes, advertencias, definiciones: DEFINICIONES, etiquetas: ETIQUETAS };
}
