// Asistente: chat con Claude que conoce los datos de tus clientes y puede proponer
// ideas, publicaciones y tareas (se guardan solo cuando confirmás).
import { store } from './store.js';
import { esc, $, $$, toast, FORMATS, NETWORKS, todayISO, statusOf } from './ui.js';

const conversations = new Map(); // clave: id de cliente o '_all'
let current = '_all';
let busy = false;
let activeStream = null;

// ---------- Contexto con los datos de la app ----------
function clientSummary(c, detailed) {
  const b = c.brand || {}, s = c.strategy || {};
  const lines = [`## ${c.name} (client_id: ${c.id})`, `Rubro: ${c.industry || '-'} · Estado: ${c.status || '-'} · Servicios: ${(c.services || []).join(', ') || '-'}`];
  if (b.tone || b.audience) lines.push(`Tono de voz: ${b.tone || '-'}\nPúblico: ${b.audience || '-'}`);
  if (detailed) {
    if (b.values) lines.push(`Diferenciales: ${b.values}`);
    if (b.dosDonts) lines.push(`Qué sí / no decir: ${b.dosDonts}`);
  }
  if (s.objective) lines.push(`Objetivo: ${s.objective}`);
  if (s.pillars) lines.push(`Pilares: ${s.pillars.replace(/\n/g, '; ')}`);
  if (detailed) {
    if (s.persona) lines.push(`Buyer persona: ${s.persona}`);
    if (s.frequency) lines.push(`Frecuencia: ${s.frequency}`);
    if (s.kpis) lines.push(`KPIs: ${s.kpis}`);
    const comps = store.byClient('competitors', c.id);
    if (comps.length) lines.push('Competencia:\n' + comps.map((x) => `- ${x.name} (${x.network || ''}, ${x.followers || '?'} seg.): bien: ${x.strengths || '-'}; mal: ${x.weaknesses || '-'}`).join('\n'));
  }
  const today = todayISO();
  const posts = store.byClient('posts', c.id).filter((p) => p.date >= shift(today, detailed ? -30 : 0) && p.date <= shift(today, 60)).sort((a, z) => a.date.localeCompare(z.date));
  if (posts.length) lines.push(`Publicaciones (${detailed ? 'últimos 30 y próximos 60 días' : 'próximos 60 días'}):\n` + posts.slice(0, detailed ? 60 : 15).map((p) => `- ${p.date}${p.time ? ' ' + p.time : ''} · ${p.network || ''} · ${p.format || ''} · ${statusOf(p.status).l}${p.pillar ? ' · ' + p.pillar : ''} · ${p.title || ''}`).join('\n'));
  const ideas = store.byClient('ideas', c.id).filter((i) => i.status !== 'usada' && i.status !== 'descartada');
  if (ideas.length) lines.push(`Ideas pendientes:\n` + ideas.slice(0, detailed ? 40 : 8).map((i) => `- [${i.status}] ${i.title}${i.format ? ' (' + i.format + ')' : ''}`).join('\n'));
  const tasks = store.byClient('tasks', c.id).filter((t) => t.status !== 'done');
  if (tasks.length) lines.push(`Tareas abiertas:\n` + tasks.map((t) => `- ${t.title}${t.due ? ' (vence ' + t.due + (t.due < today ? ', ATRASADA' : '') + ')' : ''} [${t.priority || 'media'}]`).join('\n'));
  const mets = store.byClient('metrics', c.id).sort((a, z) => z.month.localeCompare(a.month)).slice(0, detailed ? 12 : 4);
  if (mets.length) lines.push('Métricas mensuales:\n' + mets.map((m) => `- ${m.month} ${m.network}: ` + ['followers', 'reach', 'interactions', 'profileVisits', 'posts', 'spend', 'results', 'clicks'].filter((k) => m[k] !== undefined && m[k] !== '').map((k) => `${k}=${m[k]}`).join(', ')).join('\n'));
  if (detailed) {
    const an = store.byClient('analyses', c.id).map((a) => ({ ...a, er: Number(a.reach) ? ((['likes', 'comments', 'shares', 'saves'].reduce((s2, k) => s2 + (Number(a[k]) || 0), 0)) / Number(a.reach)) * 100 : 0 })).sort((a, z) => z.er - a.er).slice(0, 8);
    if (an.length) lines.push('Contenidos con mejor engagement:\n' + an.map((a) => `- [${a.format}] ${a.title}: ER ${a.er.toFixed(2)}%, alcance ${a.reach || '?'}. ${a.whyWorked || ''}`).join('\n'));
  }
  return lines.join('\n');
}

function shift(iso, days) { return new Date(new Date(iso + 'T12:00:00').getTime() + days * 864e5).toISOString().slice(0, 10); }

function contextText() {
  const clients = store.all('clients').filter((c) => c.status !== 'finalizado');
  const head = `Fecha de hoy: ${todayISO()} (${new Date().toLocaleDateString('es-AR', { weekday: 'long' })}).`;
  if (current !== '_all') {
    const c = store.get('clients', current);
    if (c) return `${head}\nLa usuaria está trabajando en el cliente ${c.name}. Otros clientes: ${clients.filter((x) => x.id !== c.id).map((x) => `${x.name} (client_id: ${x.id})`).join(', ') || 'ninguno'}.\n\n${clientSummary(c, true)}`;
  }
  return `${head}\nVista general de todos los clientes.\n\n${clients.map((c) => clientSummary(c, false)).join('\n\n') || 'Todavía no hay clientes cargados.'}`;
}

const SYSTEM = `Sos la asistente de marketing dentro de JetzaBoard, la app de gestión de clientes de una community manager, social media manager, editora de video y estratega de contenido de Argentina.
Ayudás con estrategia, planificación de contenido, copys, guiones de reels, ideas, análisis de métricas, informes para clientes y organización del trabajo.

Cómo trabajar:
- Escribí en español rioplatense, claro y concreto. Usá viñetas y títulos cortos cuando ayuden; nada de relleno.
- Basate en los datos de los clientes que vienen en el contexto (marca, tono, estrategia, publicaciones, métricas). Si falta un dato importante, decilo y sugerí cargarlo en la app; no inventes cifras, precios ni promociones.
- Respetá el tono de voz de cada marca al escribir copys.
- Cuando la usuaria pida armar ideas, una planificación o tareas, usá las herramientas crear_ideas, crear_publicaciones o crear_tareas para proponerlas. La app le muestra la propuesta con un botón para guardarla: nada queda guardado hasta que ella confirme, así que nunca digas que ya se guardó.
- Para planificaciones, repartí las fechas según la frecuencia de la estrategia y los pilares, evitá fechas pasadas y no dupliques publicaciones que ya existen.
- Usá siempre el client_id exacto del contexto.`;

// ---------- Herramientas ----------
const TOOLS = [
  {
    name: 'crear_ideas',
    description: 'Propone ideas de contenido para guardar en el Banco de ideas. La usuaria confirma antes de guardarlas.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string', description: 'client_id del contexto, o vacío para ideas generales' },
        ideas: { type: 'array', items: { type: 'object', properties: {
          title: { type: 'string' }, format: { type: 'string', enum: FORMATS }, pillar: { type: 'string' },
          hook: { type: 'string', description: 'Gancho: primera línea o primeros 3 segundos' }, desc: { type: 'string', description: 'Desarrollo o guion breve' },
        }, required: ['title'] } },
      },
      required: ['ideas'],
    },
  },
  {
    name: 'crear_publicaciones',
    description: 'Propone publicaciones para el calendario de un cliente (planificación). La usuaria confirma antes de guardarlas.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        posts: { type: 'array', items: { type: 'object', properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' }, time: { type: 'string', description: 'HH:MM (opcional)' },
          network: { type: 'string', enum: NETWORKS }, format: { type: 'string', enum: FORMATS }, pillar: { type: 'string' },
          title: { type: 'string' }, hook: { type: 'string' }, script: { type: 'string', description: 'Guion o estructura' },
          copy: { type: 'string' }, hashtags: { type: 'string' },
        }, required: ['date', 'title'] } },
      },
      required: ['client_id', 'posts'],
    },
  },
  {
    name: 'crear_tareas',
    description: 'Propone tareas para el tablero de tareas. La usuaria confirma antes de guardarlas.',
    eager_input_streaming: true,
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        tasks: { type: 'array', items: { type: 'object', properties: {
          title: { type: 'string' }, due: { type: 'string', description: 'YYYY-MM-DD (opcional)' },
          priority: { type: 'string', enum: ['alta', 'media', 'baja'] }, notes: { type: 'string' },
        }, required: ['title'] } },
      },
      required: ['tasks'],
    },
  },
];

const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '');
function validate(name, input) {
  if (!input || typeof input !== 'object') return 'Entrada vacía.';
  const listKey = { crear_ideas: 'ideas', crear_publicaciones: 'posts', crear_tareas: 'tasks' }[name];
  if (!listKey) return `Herramienta desconocida: ${name}`;
  const list = input[listKey];
  if (!Array.isArray(list) || !list.length) return `Falta la lista "${listKey}".`;
  if (input.client_id && !store.get('clients', input.client_id)) return `client_id inexistente: ${input.client_id}. Usá uno del contexto.`;
  if (name === 'crear_publicaciones' && !input.client_id) return 'Falta client_id.';
  for (const it of list) {
    if (!it || typeof it.title !== 'string' || !it.title.trim()) return 'Cada elemento necesita "title".';
    if (name === 'crear_publicaciones' && !isDate(it.date)) return `Fecha inválida en "${it.title}" (usar YYYY-MM-DD).`;
    if (it.due && !isDate(it.due)) return `Fecha de vencimiento inválida en "${it.title}".`;
  }
  return null;
}

// ---------- Interfaz ----------
function convo() {
  if (!conversations.has(current)) conversations.set(current, { api: [], ui: [] });
  return conversations.get(current);
}

function md(text) {
  const lines = esc(text).split('\n');
  let html = '', inList = false;
  for (const raw of lines) {
    let l = raw.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|\s)\*(\S.+?)\*(?=\s|$)/g, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
    const li = l.match(/^\s*(?:[-•*]|\d+[.)])\s+(.*)/);
    if (li) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${li[1]}</li>`; continue; }
    if (inList) { html += '</ul>'; inList = false; }
    const h = l.match(/^#{1,4}\s+(.*)/);
    if (h) html += `<p class="as-h">${h[1]}</p>`;
    else if (l.trim()) html += `<p>${l}</p>`;
  }
  if (inList) html += '</ul>';
  return html;
}

function clientOptions() {
  return `<option value="_all">Todos los clientes</option>${store.all('clients').filter((c) => c.status !== 'finalizado').sort((a, b) => a.name.localeCompare(b.name)).map((c) => `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;
}

const SUGGESTIONS_CLIENT = ['Planificá las publicaciones del mes que viene', 'Dame 8 ideas de reels para esta semana', '¿Qué mejoró este mes y qué ajustarías?', 'Escribí 3 copys para el próximo post', 'Armá el informe mensual para enviarle'];
const SUGGESTIONS_ALL = ['¿Qué tengo pendiente esta semana?', '¿Qué cliente necesita más atención?', 'Armame las tareas de la semana', 'Ideas de contenido para fechas especiales del mes'];

export function initAssistant() {
  const fab = document.createElement('button');
  fab.className = 'as-fab';
  fab.innerHTML = '✨ <span>Asistente</span>';
  fab.setAttribute('aria-label', 'Abrir asistente');
  const panel = document.createElement('aside');
  panel.className = 'as-panel';
  panel.innerHTML = `
    <header class="as-head">
      <div><strong>✨ Asistente</strong><select id="asClient"></select></div>
      <div class="row gap"><button class="icon-btn" id="asNew" title="Nueva conversación">↺</button><button class="icon-btn" id="asClose" title="Cerrar">✕</button></div>
    </header>
    <div class="as-msgs" id="asMsgs"></div>
    <form class="as-form" id="asForm">
      <textarea id="asInput" rows="2" placeholder="Escribí tu pedido… (Enter para enviar, Shift+Enter nueva línea)"></textarea>
      <button class="btn primary" id="asSend" type="submit">Enviar</button>
    </form>`;
  document.body.append(fab, panel);

  const open = () => {
    const m = location.hash.match(/#\/cliente\/([^/]+)/);
    if (m && !busy) current = m[1];
    document.body.classList.add('as-open');
    draw();
    setTimeout(() => $('#asInput').focus(), 50);
  };
  fab.onclick = open;
  $('#asClose').onclick = () => document.body.classList.remove('as-open');
  $('#asNew').onclick = () => { if (busy) return; conversations.delete(current); draw(); };
  $('#asClient').onchange = (e) => { if (busy) { e.target.value = current; return; } current = e.target.value; draw(); };
  $('#asForm').onsubmit = (e) => { e.preventDefault(); send(); };
  $('#asInput').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  window.addEventListener('hashchange', () => {
    const m = location.hash.match(/#\/cliente\/([^/]+)/);
    if (m && m[1] !== current && !busy && document.body.classList.contains('as-open')) { current = m[1]; draw(); }
  });
}

function draw() {
  $('#asClient').innerHTML = clientOptions();
  $('#asClient').value = store.get('clients', current) ? current : '_all';
  if (!store.get('clients', current)) current = '_all';
  const c = convo();
  const box = $('#asMsgs');
  if (!c.ui.length) {
    const cl = store.get('clients', current);
    const sug = cl ? SUGGESTIONS_CLIENT : SUGGESTIONS_ALL;
    box.innerHTML = `<div class="as-welcome">
      <p><b>Hola${store.settings().ownerName ? ', ' + esc(store.settings().ownerName) : ''} 👋</b></p>
      <p class="small muted">${cl ? `Estoy mirando todo lo de <b>${esc(cl.name)}</b>: marca, estrategia, calendario, ideas, tareas y métricas.` : 'Estoy mirando a todos tus clientes. Elegí uno arriba para trabajar en detalle.'} Puedo proponerte ideas, publicaciones y tareas; se guardan solo si las confirmás.</p>
      ${store.settings().anthropicKey ? '' : '<p class="err-text small">Para usarme, cargá tu API key de Claude en <a href="#/ajustes">Ajustes</a>.</p>'}
      <div class="as-sug">${sug.map((s) => `<button class="chip pick" data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    $$('[data-sug]', box).forEach((b) => (b.onclick = () => { $('#asInput').value = b.dataset.sug; send(); }));
    return;
  }
  box.innerHTML = '';
  c.ui.forEach((m) => box.appendChild(m.el));
  box.scrollTop = box.scrollHeight;
}

function bubble(role, html) {
  const el = document.createElement('div');
  el.className = `as-msg ${role}`;
  el.innerHTML = html;
  convo().ui.push({ role, el });
  const box = $('#asMsgs');
  if (box.querySelector('.as-welcome')) box.innerHTML = '';
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

function setBusy(on) {
  busy = on;
  const btn = $('#asSend');
  btn.textContent = on ? 'Detener' : 'Enviar';
  btn.type = on ? 'button' : 'submit';
  btn.onclick = on ? () => activeStream?.abort() : null;
  $('#asClient').disabled = on;
}

async function send() {
  if (busy) return;
  const input = $('#asInput');
  const text = input.value.trim();
  if (!text) return;
  if (!store.settings().anthropicKey) { toast('Cargá tu API key de Claude en Ajustes', 'err'); return; }
  input.value = '';
  const c = convo();
  bubble('user', `<p>${esc(text).replace(/\n/g, '<br>')}</p>`);
  // Los datos de la app van con el primer mensaje, y se vuelven a mandar solo si cambiaron.
  const ctx = contextText();
  const content = [];
  if (ctx !== c.lastCtx) {
    content.push({ type: 'text', text: `<datos_de_la_app${c.lastCtx ? ' actualizados' : ''}>\n${ctx}\n</datos_de_la_app>` });
    c.lastCtx = ctx;
  }
  content.push({ type: 'text', text });
  c.api.push({ role: 'user', content });
  setBusy(true);
  try {
    await runLoop(c);
  } finally {
    setBusy(false);
    activeStream = null;
  }
}

async function runLoop(c) {
  const { assistantClient } = await import('./integrations.js');
  let client;
  try { client = await assistantClient(); } catch (e) { bubble('assistant error', `<p>${esc(e.message)}</p>`); c.api.pop(); if (!c.api.length) c.lastCtx = ''; return; }
  let retries = 0;
  for (let turn = 0; turn < 5; turn++) {
    const el = bubble('assistant', '<p class="loading">Pensando…</p>');
    let text = '';
    const stream = client.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 64000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools: TOOLS,
      messages: c.api,
    });
    activeStream = stream;
    stream.on('text', (delta) => {
      text += delta;
      el.innerHTML = md(text);
      const box = $('#asMsgs'); box.scrollTop = box.scrollHeight;
    });
    let msg;
    try {
      msg = await stream.finalMessage();
      retries = 0;
    } catch (err) {
      const aborted = err?.name === 'APIUserAbortError' || /abort/i.test(err?.message || '');
      if (aborted) {
        el.innerHTML = (text ? md(text) : '') + '<p class="small muted">⏹ Detenido.</p>';
        // Se descarta el último pedido sin respuesta para que la conversación quede válida.
        if (c.api[c.api.length - 1]?.role === 'user') { c.api.pop(); c.lastCtx = c.api.length ? c.lastCtx : ''; }
        return;
      }
      const isApi = typeof err?.status === 'number';
      if (!isApi && retries++ < 2) { el.remove(); c.ui.pop(); continue; } // conexión cortada o JSON incompleto: reintentar
      el.classList.add('error');
      el.innerHTML = `<p>${esc(friendlyError(err))}</p>`;
      if (c.api[c.api.length - 1]?.role === 'user') { c.api.pop(); if (!c.api.length) c.lastCtx = ''; }
      return;
    }
    // Guardar la respuesta completa (incluye bloques de razonamiento) para el siguiente turno.
    c.api.push({ role: 'assistant', content: msg.content });
    if (!text) el.remove(), c.ui.pop();
    if (msg.stop_reason === 'refusal') { bubble('assistant error', '<p>No puedo ayudar con ese pedido. Probá reformularlo.</p>'); return; }
    if (msg.stop_reason === 'max_tokens') { bubble('assistant error', '<p>La respuesta fue demasiado larga y se cortó. Pedime algo más acotado (por ejemplo, de a una semana).</p>'); return; }
    if (msg.stop_reason !== 'tool_use') return;
    const results = [];
    for (const block of msg.content.filter((b) => b.type === 'tool_use')) {
      const problem = validate(block.name, block.input);
      if (problem) {
        results.push({ type: 'tool_result', tool_use_id: block.id, is_error: true, content: problem });
        continue;
      }
      proposalCard(block.name, block.input);
      results.push({ type: 'tool_result', tool_use_id: block.id, content: 'La propuesta se mostró a la usuaria con un botón para guardarla. Todavía NO está guardada. Cerrá con un comentario breve, sin repetir la lista.' });
    }
    c.api.push({ role: 'user', content: results });
  }
}

function friendlyError(err) {
  if (err?.status === 401) return 'La API key de Claude no es válida. Revisala en Ajustes.';
  if (err?.status === 429) return 'Se alcanzó el límite de uso por minuto. Esperá un momento y probá de nuevo.';
  if (err?.status === 529 || err?.status >= 500) return 'El servicio de Claude está con problemas en este momento. Probá en unos minutos.';
  if (err?.status === 400 && /credit|balance/i.test(err.message || '')) return 'Tu cuenta de Anthropic no tiene crédito. Cargá saldo en console.anthropic.com.';
  return `No se pudo completar: ${err?.message || err}`;
}

// ---------- Tarjetas de propuesta ----------
function proposalCard(name, input) {
  const c = input.client_id ? store.get('clients', input.client_id) : null;
  const cfg = {
    crear_ideas: { list: input.ideas, title: `💡 ${(input.ideas || []).length} ideas`, line: (i) => `<b>${esc(i.title)}</b>${i.format ? ` <span class="chip">${esc(i.format)}</span>` : ''}${i.hook ? `<br><i class="small">${esc(i.hook)}</i>` : ''}` },
    crear_publicaciones: { list: input.posts, title: `🗓 ${(input.posts || []).length} publicaciones`, line: (p) => `<b>${esc(p.date)}${p.time ? ' ' + esc(p.time) : ''}</b> · ${esc(p.format || '')} ${esc(p.network || '')}<br>${esc(p.title)}${p.copy ? `<details class="small"><summary>Ver copy</summary><div class="pre">${esc(p.copy)}${p.hashtags ? '\n\n' + esc(p.hashtags) : ''}</div></details>` : ''}` },
    crear_tareas: { list: input.tasks, title: `✓ ${(input.tasks || []).length} tareas`, line: (t) => `<b>${esc(t.title)}</b>${t.due ? ` · vence ${esc(t.due)}` : ''}${t.priority ? ` · ${esc(t.priority)}` : ''}` },
  }[name];
  const el = bubble('proposal', `
    <div class="row between"><strong>${cfg.title}${c ? ` para ${esc(c.name)}` : ''}</strong><label class="small"><input type="checkbox" data-all checked> Todas</label></div>
    <div class="prop-list">${cfg.list.map((it, n) => `<label class="prop-item"><input type="checkbox" data-n="${n}" checked><div>${cfg.line(it)}</div></label>`).join('')}</div>
    <div class="row gap mt-s"><button class="btn primary sm" data-save>Guardar seleccionadas</button><button class="btn ghost sm" data-discard>Descartar</button></div>`);
  $('[data-all]', el).onchange = (e) => $$('[data-n]', el).forEach((cb) => (cb.checked = e.target.checked));
  $('[data-discard]', el).onclick = () => { el.classList.add('done'); el.querySelector('.row.gap').innerHTML = '<span class="small muted">Descartada</span>'; };
  $('[data-save]', el).onclick = async () => {
    const picked = $$('[data-n]:checked', el).map((cb) => cfg.list[cb.dataset.n]);
    if (!picked.length) return toast('No elegiste ninguna', 'err');
    picked.forEach((it) => {
      if (name === 'crear_ideas') store.upsert('ideas', { clientId: input.client_id || '', title: it.title, format: it.format || '', pillar: it.pillar || '', hook: it.hook || '', desc: it.desc || '', status: 'nueva', network: 'Instagram' });
      if (name === 'crear_publicaciones') store.upsert('posts', { clientId: input.client_id, date: it.date, time: it.time || '', network: it.network || 'Instagram', format: it.format || 'Reel', pillar: it.pillar || '', title: it.title, hook: it.hook || '', script: it.script || '', copy: it.copy || '', hashtags: it.hashtags || '', status: 'idea' });
      if (name === 'crear_tareas') store.upsert('tasks', { clientId: input.client_id || '', title: it.title, due: it.due || '', priority: it.priority || 'media', notes: it.notes || '', status: 'todo' });
    });
    el.classList.add('done');
    el.querySelector('.row.gap').innerHTML = `<span class="small ok-text">✓ Guardadas ${picked.length}</span>`;
    toast(`✓ ${picked.length} guardadas`);
    const { rerenderRoute } = await import('./app.js');
    rerenderRoute();
  };
}

