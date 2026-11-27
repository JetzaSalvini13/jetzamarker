// Helpers de interfaz: escape, modales, formularios genéricos, constantes.
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const NETWORKS = ['Instagram', 'TikTok', 'Facebook', 'LinkedIn', 'YouTube', 'X / Twitter', 'Pinterest', 'Threads'];
export const FORMATS = ['Reel', 'Carrusel', 'Post estático', 'Historia', 'Video largo', 'Short', 'Live', 'Anuncio'];
export const POST_STATUS = [
  { v: 'idea', l: 'Idea', c: '#BDB7B9' },
  { v: 'produccion', l: 'En producción', c: '#F4C27A' },
  { v: 'revision', l: 'En revisión', c: '#A9C7F2' },
  { v: 'aprobado', l: 'Aprobado', c: '#9AD6B9' },
  { v: 'programado', l: 'Programado', c: '#C9A7EB' },
  { v: 'publicado', l: 'Publicado', c: '#E891AA' },
];
export const TASK_STATUS = [
  { v: 'todo', l: 'Por hacer' },
  { v: 'doing', l: 'En proceso' },
  { v: 'review', l: 'En revisión' },
  { v: 'done', l: 'Listo' },
];
export const SERVICES = ['Community Manager', 'Social Media Manager', 'Marketing digital', 'Edición de video', 'Diseño de posts', 'Estrategia de contenido', 'Meta Ads', 'Fotografía'];
export const CHAR_LIMITS = { Instagram: 2200, TikTok: 2200, Facebook: 63206, LinkedIn: 3000, YouTube: 5000, 'X / Twitter': 280, Pinterest: 500, Threads: 500 };

export const statusOf = (v) => POST_STATUS.find((s) => s.v === v) || POST_STATUS[0];
export const fmtNum = (n) => (n === '' || n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-AR', { maximumFractionDigits: 2 }));
export const fmtMoney = (n) => (n ? Number(n).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) : '—');
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (iso) => (iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—');
export const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function toast(msg, type = 'ok') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, 2600);
}

export function confirmBox(msg) { return window.confirm(msg); }

// ---------- Modal ----------
export function openModal({ title, body, footer = '', wide = false, onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <header class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Cerrar">✕</button></header>
      <div class="modal-body">${body}</div>
      ${footer ? `<footer class="modal-foot">${footer}</footer>` : ''}
    </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  document.addEventListener('keydown', onKey);
  document.body.appendChild(wrap);
  onMount && onMount(wrap, close);
  const first = wrap.querySelector('input,textarea,select');
  first && first.focus();
  return { el: wrap, close };
}

// ---------- Formularios genéricos ----------
// field: { k, label, type, options, full, placeholder, help }
function fieldHTML(f, val) {
  const id = 'f_' + f.k;
  const v = val ?? f.default ?? '';
  const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
  let input;
  switch (f.type) {
    case 'textarea':
      input = `<textarea id="${id}" name="${f.k}" rows="${f.rows || 4}" ${ph}>${esc(v)}</textarea>`; break;
    case 'select': {
      const opts = (f.options || []).map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
      input = `<select id="${id}" name="${f.k}">${f.allowEmpty !== false ? '<option value="">—</option>' : ''}${opts.map((o) => `<option value="${esc(o.v)}" ${String(o.v) === String(v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`; break;
    }
    case 'checkboxes': {
      const arr = Array.isArray(v) ? v : [];
      input = `<div class="checks">${f.options.map((o) => `<label class="chk"><input type="checkbox" name="${f.k}" value="${esc(o)}" ${arr.includes(o) ? 'checked' : ''}> ${esc(o)}</label>`).join('')}</div>`; break;
    }
    case 'color':
      input = `<input id="${id}" name="${f.k}" type="color" value="${esc(v || '#E891AA')}">`; break;
    default:
      input = `<input id="${id}" name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}" ${ph} ${f.type === 'number' ? 'step="any"' : ''}>`;
  }
  return `<div class="field ${f.full || f.type === 'textarea' || f.type === 'checkboxes' ? 'full' : ''}"><label for="${id}">${esc(f.label)}</label>${input}${f.help ? `<small>${esc(f.help)}</small>` : ''}</div>`;
}

export function formHTML(fields, values = {}) {
  return `<form class="form-grid" onsubmit="return false">${fields.map((f) => fieldHTML(f, values[f.k])).join('')}</form>`;
}

export function readForm(root, fields) {
  const out = {};
  fields.forEach((f) => {
    if (f.type === 'checkboxes') {
      out[f.k] = $$(`input[name="${f.k}"]:checked`, root).map((i) => i.value);
    } else {
      const el = root.querySelector(`[name="${f.k}"]`);
      if (!el) return;
      out[f.k] = f.type === 'number' ? (el.value === '' ? '' : Number(el.value)) : el.value.trim();
    }
  });
  return out;
}

export function formModal({ title, fields, values = {}, onSave, onDelete, wide, extraFooter = '', onMount: extraMount }) {
  const footer = `
    ${onDelete ? '<button class="btn danger ghost" data-del>Eliminar</button>' : ''}
    <span class="spacer"></span>${extraFooter}
    <button class="btn ghost" data-close>Cancelar</button>
    <button class="btn primary" data-save>Guardar</button>`;
  return openModal({
    title, wide, body: formHTML(fields, values), footer,
    onMount(el, close) {
      el.querySelector('[data-save]').addEventListener('click', () => {
        const v = readForm(el, fields);
        const req = fields.find((f) => f.required && !v[f.k]);
        if (req) { toast(`Completá "${req.label}"`, 'err'); return; }
        if (onSave(v, el) !== false) close();
      });
      const del = el.querySelector('[data-del]');
      del && del.addEventListener('click', () => { if (confirmBox('¿Eliminar definitivamente?')) { onDelete(); close(); } });
      el.querySelector('form').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) el.querySelector('[data-save]').click();
      });
      extraMount && extraMount(el, close);
    },
  });
}

export function emptyState(icon, text, btn = '') {
  return `<div class="empty"><div class="empty-icon">${icon}</div><p>${text}</p>${btn}</div>`;
}

export function download(filename, text, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Gráfico de líneas SVG simple. series: [{name, color, values:[n]}], labels: [str]
export function lineChart(labels, series, height = 220) {
  if (!labels.length) return '<p class="muted">Sin datos todavía.</p>';
  const W = 640, H = height, P = 36, L = 64;
  const all = series.flatMap((s) => s.values).filter((v) => v !== '' && v != null && !isNaN(v));
  const max = Math.max(1, ...all), min = Math.min(0, ...all);
  const x = (i) => L + (labels.length === 1 ? (W - L - P) / 2 : (i * (W - L - P)) / (labels.length - 1));
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const grid = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const val = min + t * (max - min);
    return `<line x1="${L}" x2="${W - P}" y1="${y(val)}" y2="${y(val)}" class="grid"/><text x="${L - 8}" y="${y(val) + 4}" text-anchor="end" class="axis">${fmtNum(Math.round(val))}</text>`;
  }).join('');
  const lines = series.map((s) => {
    const pts = s.values.map((v, i) => (v === '' || v == null || isNaN(v) ? null : [x(i), y(v)])).filter(Boolean);
    return `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p) => p.join(',')).join(' ')}"/>` +
      pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${s.color}"><title>${esc(s.name)}: ${fmtNum(s.values[i])}</title></circle>`).join('');
  }).join('');
  const xl = labels.map((l, i) => `<text x="${x(i)}" y="${H - 10}" text-anchor="middle" class="axis">${esc(l)}</text>`).join('');
  const legend = series.map((s) => `<span class="legend-item"><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${grid}${lines}${xl}</svg><div class="legend">${legend}</div></div>`;
}

export function barList(items, color = 'var(--pink-deep)') {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="barlist">${items.map((i) => `<div class="bar-row"><span class="bar-label">${esc(i.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${(i.value / max) * 100}%;background:${color}"></div></div><span class="bar-val">${esc(i.display ?? fmtNum(i.value))}</span></div>`).join('')}</div>`;
}
