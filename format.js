// Formatos en español de Colombia.
const LOC = 'es-CO';
const ok = (n) => n != null && Number.isFinite(n);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const num = (n, dec = 0) => (ok(n) ? n.toLocaleString(LOC, { maximumFractionDigits: dec }) : '—');

export const pct = (x, dec = 1) => (ok(x) ? `${(x * 100).toLocaleString(LOC, { maximumFractionDigits: dec })} %` : '—');

export function pctSigno(x, dec = 0) {
  if (!ok(x)) return '—';
  const signo = x > 0 ? '+' : x < 0 ? '−' : '';
  return `${signo}${Math.abs(x * 100).toLocaleString(LOC, { maximumFractionDigits: dec })} %`;
}

export const dinero = (n) => (ok(n) ? `$ ${n.toLocaleString(LOC, { maximumFractionDigits: 0 })}` : '—');

export function fecha(s, corta = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return s ?? '';
  const d = new Date(`${s}T12:00:00`);
  return d.toLocaleDateString(LOC, corta ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' });
}
