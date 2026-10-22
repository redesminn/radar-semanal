// Lectura del Excel o CSV semanal y normalización de columnas.
export const COLUMNAS = {
  semana: ['semana', 'fecha', 'semana_inicio', 'fecha_inicio'],
  canal: ['canal', 'red', 'red_social', 'plataforma'],
  tipo: ['tipo', 'organico_pauta', 'origen'],
  inversion: ['inversion', 'inversion_cop', 'gasto', 'inversion_pauta'],
  alcance: ['alcance', 'reach'],
  impresiones: ['impresiones', 'impressions'],
  interacciones: ['interacciones', 'engagement'],
  clics: ['clics', 'clicks'],
  leads: ['leads', 'lead'],
  leads_calificados: ['leads_calificados', 'calificados'],
  citas: ['citas', 'reuniones'],
  cotizaciones: ['cotizaciones', 'propuestas'],
  ventas: ['ventas', 'cierres'],
  valor_ventas: ['valor_ventas', 'ingresos', 'valor_ventas_cop'],
  conversaciones: ['conversaciones', 'mensajes', 'dms', 'whatsapp'],
  tiempo_respuesta_horas: ['tiempo_respuesta_horas', 'tiempo_respuesta'],
  meta_leads: ['meta_leads', 'meta'],
  notas: ['notas', 'comentarios', 'observaciones', 'contexto'],
};

export const OBLIGATORIAS = ['semana', 'canal', 'alcance', 'leads'];
export const NUMERICAS = Object.keys(COLUMNAS).filter((k) => !['semana', 'canal', 'tipo', 'notas'].includes(k));

export const normalizar = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function mapearEncabezados(encabezados) {
  const mapa = {};
  for (const original of encabezados) {
    const n = normalizar(original);
    for (const [clave, alias] of Object.entries(COLUMNAS)) {
      if (!mapa[clave] && alias.includes(n)) mapa[clave] = original;
    }
  }
  return mapa;
}

export function parsearNumero(v) {
  if (v === '' || v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/cop|usd/gi, '').replace(/[\s$%]/g, '');
  if (!s) return null;
  const punto = s.includes('.');
  const coma = s.includes(',');
  if (punto && coma) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (punto && /^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function normalizarSemana(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number' && typeof XLSX !== 'undefined') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  const ymd = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`;
  return s;
}

function normalizarTipo(v) {
  const n = normalizar(v);
  if (!n) return 'sin_dato';
  if (/pauta|pago|paid|ads|pagado/.test(n)) return 'pauta';
  if (/org/.test(n)) return 'organico';
  return n;
}

// Convierte filas crudas (objetos con encabezados originales) en filas normalizadas.
export function normalizarFilas(crudas) {
  if (!crudas.length) throw new Error('El archivo no tiene filas de datos. La primera fila debe tener los encabezados.');
  const mapa = mapearEncabezados(Object.keys(crudas[0]));
  const faltan = OBLIGATORIAS.filter((c) => !mapa[c]);
  if (faltan.length) {
    throw new Error(`Faltan columnas obligatorias: ${faltan.join(', ')}. Revisa los nombres en contexto/06_diccionario_datos.md.`);
  }
  const filas = [];
  const advertencias = [];
  crudas.forEach((c, i) => {
    const semana = normalizarSemana(c[mapa.semana]);
    const canal = String(c[mapa.canal] ?? '').trim();
    if (!semana || !canal) {
      if (Object.values(c).some((v) => v !== '')) advertencias.push(`Fila ${i + 2}: sin semana o canal, no se tuvo en cuenta.`);
      return;
    }
    const fila = {
      semana,
      canal,
      tipo: mapa.tipo ? normalizarTipo(c[mapa.tipo]) : 'sin_dato',
      notas: mapa.notas ? String(c[mapa.notas] ?? '').trim() : '',
    };
    for (const k of NUMERICAS) fila[k] = mapa[k] ? parsearNumero(c[mapa[k]]) : null;
    filas.push(fila);
  });
  if (!filas.length) throw new Error('No hay filas válidas: revisa que cada fila tenga semana y canal.');
  const columnasAusentes = Object.keys(COLUMNAS).filter((k) => !mapa[k]);
  return { filas, columnasAusentes, advertencias };
}

// Lee un Excel (.xlsx/.xls) o CSV desde un ArrayBuffer con SheetJS.
export function leerBuffer(buffer, nombre = '') {
  if (typeof XLSX === 'undefined') throw new Error('No se pudo cargar el lector de Excel. Revisa la conexión y recarga la página.');
  // Los CSV se decodifican como UTF-8 para conservar tildes y eñes.
  const libro = /\.(csv|tsv|txt)$/i.test(nombre)
    ? XLSX.read(new TextDecoder('utf-8').decode(buffer), { type: 'string' })
    : XLSX.read(buffer, { type: 'array' });
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const crudas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: true });
  return normalizarFilas(crudas);
}
