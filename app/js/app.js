import { store } from './store.js';
import {
  esc, $, $$, toast, formModal, emptyState, download, confirmBox,
  NETWORKS, POST_STATUS, TASK_STATUS, SERVICES, MONTHS,
  statusOf, fmtDate, fmtMoney, todayISO,
} from './ui.js';
import { renderClient, postModal, taskFields } from './client.js';
import { renderIdeasHub, renderMetricsHub } from './global.js';

const main = $('#main');
const state = { calMonth: new Date().toISOString().slice(0, 7), calClient: '', taskClient: '' };

// ---------- Campos de cliente ----------
export const clientFields = [
  { k: 'name', label: 'Nombre del cliente / marca', required: true },
  { k: 'industry', label: 'Rubro', placeholder: 'Gastronomía, moda, salud…' },
  { k: 'status', label: 'Estado', type: 'select', allowEmpty: false, options: [{ v: 'activo', l: 'Activo' }, { v: 'pausado', l: 'Pausado' }, { v: 'prospecto', l: 'Prospecto' }, { v: 'finalizado', l: 'Finalizado' }] },
  { k: 'color', label: 'Color identificador', type: 'color' },
  { k: 'contact', label: 'Persona de contacto' },
  { k: 'phone', label: 'WhatsApp / teléfono' },
  { k: 'email', label: 'Email' },
  { k: 'website', label: 'Sitio web' },
  { k: 'instagram', label: 'Instagram (@usuario)' },
  { k: 'tiktok', label: 'TikTok (@usuario)' },
  { k: 'facebook', label: 'Facebook (página)' },
  { k: 'linkedin', label: 'LinkedIn' },
  { k: 'fee', label: 'Fee mensual ($)', type: 'number' },
  { k: 'startDate', label: 'Fecha de inicio', type: 'date' },
  { k: 'services', label: 'Servicios contratados', type: 'checkboxes', options: SERVICES },
  { k: 'notes', label: 'Notas', type: 'textarea', rows: 3 },
];

export function clientModal(client, after) {
  formModal({
    title: client ? 'Editar cliente' : 'Nuevo cliente',
    fields: clientFields,
    values: client || { status: 'activo', color: randomColor() },
    wide: true,
    onSave(v) {
      const saved = store.upsert('clients', { ...(client || {}), ...v });
      toast(client ? 'Cliente actualizado' : 'Cliente creado');
      after ? after(saved) : (location.hash = `#/cliente/${saved.id}/resumen`);
    },
    onDelete: client ? () => { store.removeClient(client.id); toast('Cliente eliminado'); location.hash = '#/clientes'; } : null,
  });
}

function randomColor() {
  const c = ['#E891AA', '#A9C7F2', '#9AD6B9', '#F4C27A', '#C9A7EB', '#F29E8E', '#7FC8C2', '#D4A5A5'];
  return c[Math.floor(Math.random() * c.length)];
}

const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
export const avatar = (c, size = '') => `<span class="avatar ${size}" style="background:${esc(c.color || '#E891AA')}">${esc(initials(c.name))}</span>`;

// ---------- Sidebar ----------
function renderSidebar() {
  const route = location.hash || '#/';
  const clients = store.all('clients').filter((c) => c.status !== 'finalizado').sort((a, b) => a.name.localeCompare(b.name));
  const link = (href, icon, label) => `<a href="${href}" class="nav-link ${route === href || (href !== '#/' && route.startsWith(href)) ? 'active' : ''}"><span class="nav-ico">${icon}</span>${label}</a>`;
  $('#sidebar').innerHTML = `
    <div class="brand"><span class="brand-mark">J</span><div><strong>Jetza<em>Board</em></strong><small>Gestión de clientes</small></div></div>
    <nav>
      ${link('#/', '◐', 'Inicio')}
      ${link('#/clientes', '♡', 'Clientes')}
      ${link('#/calendario', '▦', 'Calendario general')}
      ${link('#/ideas', '✦', 'Banco de ideas')}
      ${link('#/metricas', '↗', 'Métricas')}
      ${link('#/tareas', '✓', 'Tareas')}
      ${link('#/ajustes', '⚙', 'Ajustes')}
    </nav>
    <div class="side-section">
      <div class="side-title"><span>Mis clientes</span><button class="icon-btn sm" id="sideAdd" title="Nuevo cliente">＋</button></div>
      <div class="side-clients">
        ${clients.map((c) => `<a href="#/cliente/${c.id}/resumen" class="side-client ${route.includes(c.id) ? 'active' : ''}">${avatar(c, 'xs')}<span>${esc(c.name)}</span></a>`).join('') || '<p class="muted small">Todavía no cargaste clientes.</p>'}
      </div>
    </div>`;
  $('#sideAdd').onclick = () => clientModal();
}

// ---------- Router ----------
function router() {
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
  document.body.classList.remove('menu-open');
  renderSidebar();
  window.scrollTo(0, 0);
  const [view, id, tab] = parts;
  switch (view) {
    case '': return renderDashboard();
    case 'clientes': return renderClients();
    case 'cliente': return renderClient(main, id, tab || 'resumen');
    case 'calendario': return renderGlobalCalendar();
    case 'tareas': return renderTasks();
    case 'ideas': return renderIdeasHub(main);
    case 'metricas': return renderMetricsHub(main);
    case 'ajustes': return renderSettings();
    default: location.hash = '#/';
  }
}

// ---------- Dashboard ----------
function renderDashboard() {
  const clients = store.all('clients');
  const active = clients.filter((c) => c.status === 'activo');
  const posts = store.all('posts');
  const today = todayISO();
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const upcoming = posts.filter((p) => p.date >= today && p.date <= in7).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  const toReview = posts.filter((p) => p.status === 'revision');
  const tasks = store.all('tasks').filter((t) => t.status !== 'done');
  const overdue = tasks.filter((t) => t.due && t.due < today);
  const monthPosts = posts.filter((p) => p.date?.startsWith(month));
  const income = active.reduce((s, c) => s + (Number(c.fee) || 0), 0);
  const cname = (id) => store.get('clients', id)?.name || '—';
  const hour = new Date().getHours();
  const hi = hour < 12 ? 'Buen día' : hour < 20 ? 'Buenas tardes' : 'Buenas noches';

  main.innerHTML = `
    <header class="page-head">
      <div><p class="eyebrow">${new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p><h1>${hi}, ${esc(store.settings().ownerName || 'Jetza')} ✿</h1></div>
      <div class="actions"><button class="btn ghost" id="qPost">＋ Publicación</button><button class="btn primary" id="qClient">＋ Cliente</button></div>
    </header>
    <section class="kpis">
      <div class="kpi"><span>Clientes activos</span><strong>${active.length}</strong><small>${clients.length} en total</small></div>
      <div class="kpi"><span>Publicaciones este mes</span><strong>${monthPosts.length}</strong><small>${monthPosts.filter((p) => p.status === 'publicado').length} publicadas</small></div>
      <div class="kpi"><span>Para revisar / aprobar</span><strong>${toReview.length}</strong><small>en estado "En revisión"</small></div>
      <div class="kpi"><span>Ingreso mensual estimado</span><strong>${fmtMoney(income)}</strong><small>suma de fees activos</small></div>
    </section>
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h2>Próximos 7 días</h2><a href="#/calendario" class="link">Ver calendario →</a></div>
        ${upcoming.length ? `<ul class="list">${upcoming.map((p) => `
          <li class="list-item clickable" data-post="${p.id}">
            <span class="date-pill">${fmtDate(p.date)}${p.time ? `<small>${esc(p.time)}</small>` : ''}</span>
            <div class="grow"><strong>${esc(p.title || p.format || 'Publicación')}</strong><small>${esc(cname(p.clientId))} · ${esc(p.network || '')} · ${esc(p.format || '')}</small></div>
            <span class="badge" style="background:${statusOf(p.status).c}">${statusOf(p.status).l}</span>
          </li>`).join('')}</ul>` : emptyState('🗓', 'No hay publicaciones planificadas para esta semana.')}
      </section>
      <section class="card">
        <div class="card-head"><h2>Tareas pendientes</h2><a href="#/tareas" class="link">Ver tablero →</a></div>
        ${overdue.length ? `<p class="alert">⚠ Tenés ${overdue.length} tarea(s) vencida(s).</p>` : ''}
        ${tasks.length ? `<ul class="list">${tasks.sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).slice(0, 8).map((t) => `
          <li class="list-item"><span class="prio prio-${esc(t.priority || 'media')}"></span>
            <div class="grow"><strong>${esc(t.title)}</strong><small>${esc(cname(t.clientId))}${t.due ? ' · vence ' + fmtDate(t.due) : ''}</small></div>
            <span class="badge soft">${esc(TASK_STATUS.find((s) => s.v === t.status)?.l || '')}</span></li>`).join('')}</ul>` : emptyState('✓', 'Sin tareas pendientes. ¡Bien ahí!')}
      </section>
    </div>
    <section class="card">
      <div class="card-head"><h2>Clientes</h2><a href="#/clientes" class="link">Ver todos →</a></div>
      ${active.length ? `<div class="client-grid">${active.map(clientCard).join('')}</div>` : emptyState('♡', 'Empezá cargando tu primer cliente.', '<button class="btn primary" id="emptyClient">＋ Nuevo cliente</button>')}
    </section>`;
  $('#qClient').onclick = () => clientModal();
  $('#qPost').onclick = () => clients.length ? postModal(null, { date: today }, router) : toast('Primero creá un cliente', 'err');
  $('#emptyClient') && ($('#emptyClient').onclick = () => clientModal());
  $$('[data-post]').forEach((el) => (el.onclick = () => postModal(store.get('posts', el.dataset.post), null, router)));
}

function clientCard(c) {
  const posts = store.byClient('posts', c.id);
  const month = todayISO().slice(0, 7);
  const mp = posts.filter((p) => p.date?.startsWith(month));
  const done = mp.filter((p) => ['publicado', 'programado', 'aprobado'].includes(p.status)).length;
  const pct = mp.length ? Math.round((done / mp.length) * 100) : 0;
  const projects = store.byClient('projects', c.id).filter((p) => p.status !== 'finalizado').length;
  return `<a class="client-card" href="#/cliente/${c.id}/resumen" style="--accent:${esc(c.color || '#E891AA')}">
    <div class="cc-top">${avatar(c)}<div><strong>${esc(c.name)}</strong><small>${esc(c.industry || 'Sin rubro')}</small></div><span class="badge soft status-${esc(c.status)}">${esc(c.status || '')}</span></div>
    <div class="cc-services">${(c.services || []).slice(0, 3).map((s) => `<span class="chip">${esc(s)}</span>`).join('')}${(c.services || []).length > 3 ? `<span class="chip">+${c.services.length - 3}</span>` : ''}</div>
    <div class="cc-stats"><span><b>${mp.length}</b> posts este mes</span><span><b>${projects}</b> proyectos</span></div>
    <div class="progress"><div style="width:${pct}%"></div></div><small class="muted">${pct}% del mes listo</small>
  </a>`;
}

// ---------- Clientes ----------
function renderClients() {
  const q = (state.clientQuery || '').toLowerCase();
  const filter = state.clientFilter || 'todos';
  let clients = store.all('clients').sort((a, b) => a.name.localeCompare(b.name));
  if (filter !== 'todos') clients = clients.filter((c) => c.status === filter);
  if (q) clients = clients.filter((c) => [c.name, c.industry, c.contact, c.instagram].join(' ').toLowerCase().includes(q));
  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Cartera</p><h1>Clientes</h1></div>
      <div class="actions"><button class="btn primary" id="newClient">＋ Nuevo cliente</button></div></header>
    <div class="toolbar">
      <input type="search" id="cq" placeholder="Buscar cliente, rubro, contacto…" value="${esc(state.clientQuery || '')}">
      <div class="seg">${['todos', 'activo', 'pausado', 'prospecto', 'finalizado'].map((f) => `<button class="${f === filter ? 'on' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
    </div>
    ${clients.length ? `<div class="client-grid">${clients.map(clientCard).join('')}</div>` : emptyState('♡', 'No hay clientes que coincidan.')}`;
  $('#newClient').onclick = () => clientModal();
  const cq = $('#cq');
  cq.oninput = () => { state.clientQuery = cq.value; renderClients(); const n = $('#cq'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  $$('[data-f]').forEach((b) => (b.onclick = () => { state.clientFilter = b.dataset.f; renderClients(); }));
}

// ---------- Calendario (reutilizable) ----------
export function calendarHTML(month, posts, { showClient = true } = {}) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const startDow = (first.getDay() + 6) % 7; // lunes = 0
  const days = new Date(y, m, 0).getDate();
  const today = todayISO();
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push('<div class="cal-cell out"></div>');
  for (let d = 1; d <= days; d++) {
    const iso = `${month}-${String(d).padStart(2, '0')}`;
    const dayPosts = posts.filter((p) => p.date === iso).sort((a, b) => (a.time || '').localeCompare(b.time || ''));
    cells.push(`<div class="cal-cell ${iso === today ? 'today' : ''}" data-day="${iso}">
      <div class="cal-day"><span>${d}</span><button class="cal-add" data-add="${iso}" title="Agregar">＋</button></div>
      ${dayPosts.map((p) => {
        const c = store.get('clients', p.clientId);
        return `<div class="cal-post" draggable="true" data-post="${p.id}" style="border-left-color:${esc(c?.color || '#ccc')};background:${statusOf(p.status).c}33" title="${esc(statusOf(p.status).l)}">
          <span class="dot" style="background:${statusOf(p.status).c}"></span>
          <span class="cp-text">${p.time ? `<b>${esc(p.time)}</b> ` : ''}${esc(p.format || '')}${showClient && c ? ` · ${esc(c.name)}` : ''}${p.title ? ` — ${esc(p.title)}` : ''}</span>
        </div>`;
      }).join('')}
    </div>`);
  }
  return `<div class="cal">
    <div class="cal-head">${['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => `<div>${d}</div>`).join('')}</div>
    <div class="cal-grid">${cells.join('')}</div>
  </div>
  <div class="legend status-legend">${POST_STATUS.map((s) => `<span class="legend-item"><i style="background:${s.c}"></i>${s.l}</span>`).join('')}</div>`;
}

export function bindCalendar(root, { clientId, rerender }) {
  $$('[data-add]', root).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); postModal(null, { date: b.dataset.add, clientId }, rerender); }));
  $$('[data-post]', root).forEach((el) => {
    el.onclick = (e) => { e.stopPropagation(); postModal(store.get('posts', el.dataset.post), null, rerender); };
    el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', el.dataset.post); el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
  });
  $$('[data-day]', root).forEach((cell) => {
    cell.ondragover = (e) => { e.preventDefault(); cell.classList.add('drop'); };
    cell.ondragleave = () => cell.classList.remove('drop');
    cell.ondrop = (e) => {
      e.preventDefault();
      cell.classList.remove('drop');
      const id = e.dataTransfer.getData('text/plain');
      const p = store.get('posts', id);
      if (p && p.date !== cell.dataset.day) { store.upsert('posts', { ...p, date: cell.dataset.day }); toast('Publicación movida'); rerender(); }
    };
  });
}

export function monthNav(month) {
  const [y, m] = month.split('-').map(Number);
  return `<div class="month-nav"><button class="icon-btn" data-mnav="-1">‹</button><strong>${MONTHS[m - 1]} ${y}</strong><button class="icon-btn" data-mnav="1">›</button><button class="btn ghost sm" data-mnav="0">Hoy</button></div>`;
}

export function shiftMonth(month, delta) {
  if (delta === 0) return todayISO().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function renderGlobalCalendar() {
  const clients = store.all('clients');
  let posts = store.all('posts').filter((p) => p.date?.startsWith(state.calMonth));
  if (state.calClient) posts = posts.filter((p) => p.clientId === state.calClient);
  if (state.calNet) posts = posts.filter((p) => p.network === state.calNet);
  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Planificación</p><h1>Calendario general</h1></div>
      <div class="actions"><button class="btn primary" id="newPost">＋ Publicación</button></div></header>
    <div class="toolbar">
      ${monthNav(state.calMonth)}
      <select id="calClient"><option value="">Todos los clientes</option>${clients.map((c) => `<option value="${c.id}" ${c.id === state.calClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <select id="calNet"><option value="">Todas las redes</option>${NETWORKS.map((n) => `<option ${n === state.calNet ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <span class="muted small">${posts.length} publicaciones · arrastrá para reprogramar</span>
    </div>
    ${calendarHTML(state.calMonth, posts)}`;
  $$('[data-mnav]').forEach((b) => (b.onclick = () => { state.calMonth = shiftMonth(state.calMonth, Number(b.dataset.mnav)); renderGlobalCalendar(); }));
  $('#calClient').onchange = (e) => { state.calClient = e.target.value; renderGlobalCalendar(); };
  $('#calNet').onchange = (e) => { state.calNet = e.target.value; renderGlobalCalendar(); };
  $('#newPost').onclick = () => clients.length ? postModal(null, { clientId: state.calClient, date: todayISO() }, renderGlobalCalendar) : toast('Primero creá un cliente', 'err');
  bindCalendar(main, { clientId: state.calClient, rerender: renderGlobalCalendar });
}

// ---------- Tareas (kanban) ----------
export function kanbanHTML(tasks, showClient = true) {
  const cname = (id) => store.get('clients', id);
  return `<div class="kanban">${TASK_STATUS.map((s) => {
    const col = tasks.filter((t) => (t.status || 'todo') === s.v);
    return `<div class="kcol" data-col="${s.v}"><div class="kcol-head"><span>${s.l}</span><b>${col.length}</b></div>
      ${col.map((t) => {
        const c = cname(t.clientId);
        const proj = t.projectId ? store.get('projects', t.projectId) : null;
        const late = t.due && t.due < todayISO() && t.status !== 'done';
        return `<div class="kcard" draggable="true" data-task="${t.id}">
          <div class="kc-top"><span class="prio prio-${esc(t.priority || 'media')}"></span><strong>${esc(t.title)}</strong></div>
          ${t.notes ? `<p class="small muted clamp">${esc(t.notes)}</p>` : ''}
          <div class="kc-meta">${showClient && c ? `<span class="chip" style="border-color:${esc(c.color)}">${esc(c.name)}</span>` : ''}${proj ? `<span class="chip">${esc(proj.name)}</span>` : ''}${t.due ? `<span class="chip ${late ? 'late' : ''}">${fmtDate(t.due)}</span>` : ''}</div>
        </div>`;
      }).join('')}
      <button class="kadd" data-addtask="${s.v}">＋ Agregar</button></div>`;
  }).join('')}</div>`;
}

export function bindKanban(root, { clientId, rerender }) {
  $$('[data-task]', root).forEach((el) => {
    el.onclick = () => taskModal(store.get('tasks', el.dataset.task), {}, rerender);
    el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', el.dataset.task); el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
  });
  $$('[data-col]', root).forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
    col.ondragleave = () => col.classList.remove('drop');
    col.ondrop = (e) => {
      e.preventDefault(); col.classList.remove('drop');
      const t = store.get('tasks', e.dataTransfer.getData('text/plain'));
      if (t && t.status !== col.dataset.col) { store.upsert('tasks', { ...t, status: col.dataset.col }); rerender(); }
    };
  });
  $$('[data-addtask]', root).forEach((b) => (b.onclick = () => taskModal(null, { status: b.dataset.addtask, clientId }, rerender)));
}

export function taskModal(task, defaults, after) {
  const values = task || { status: 'todo', priority: 'media', ...defaults };
  formModal({
    title: task ? 'Editar tarea' : 'Nueva tarea',
    fields: taskFields(values.clientId),
    values,
    onSave(v) { store.upsert('tasks', { ...(task || {}), ...v }); toast('Tarea guardada'); after(); },
    onDelete: task ? () => { store.remove('tasks', task.id); after(); } : null,
  });
}

function renderTasks() {
  const clients = store.all('clients');
  let tasks = store.all('tasks');
  if (state.taskClient) tasks = tasks.filter((t) => t.clientId === state.taskClient);
  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Producción</p><h1>Tareas</h1></div>
      <div class="actions"><button class="btn primary" id="newTask">＋ Tarea</button></div></header>
    <div class="toolbar"><select id="tClient"><option value="">Todos los clientes</option>${clients.map((c) => `<option value="${c.id}" ${c.id === state.taskClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <span class="muted small">Arrastrá las tarjetas entre columnas</span></div>
    ${kanbanHTML(tasks)}`;
  $('#tClient').onchange = (e) => { state.taskClient = e.target.value; renderTasks(); };
  $('#newTask').onclick = () => taskModal(null, { clientId: state.taskClient }, renderTasks);
  bindKanban(main, { clientId: state.taskClient, rerender: renderTasks });
}

// ---------- Ajustes ----------
function renderSettings() {
  const s = store.settings();
  const counts = ['clients', 'projects', 'posts', 'ideas', 'competitors', 'analyses', 'metrics', 'copies', 'media', 'tasks'].map((k) => `${k}: ${store.all(k).length}`).join(' · ');
  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Configuración</p><h1>Ajustes</h1></div></header>
    <div class="grid-2">
      <section class="card">
        <h2>General</h2>
        <div class="form-grid"><div class="field full"><label>Tu nombre</label><input id="sOwner" value="${esc(s.ownerName || '')}"></div></div>
        <h2 class="mt">Meta (Facebook / Instagram / Ads)</h2>
        <p class="small"><b>Opción fácil — botón “Conectar con Facebook”:</b> creá una app en <b>developers.facebook.com</b> (tipo “Empresa”), agregá el producto <b>Inicio de sesión con Facebook</b> y en su configuración sumá la dirección de este sitio en “Dominios permitidos para el SDK de JavaScript”. Copiá el <b>App ID</b> acá.</p>
        <div class="form-grid">
          <div class="field"><label>App ID de Meta</label><input id="sAppId" value="${esc(s.metaAppId || '')}" placeholder="123456789012345"></div>
          <div class="field"><label>&nbsp;</label><button class="btn ghost" id="fbLogin">f Conectar con Facebook</button></div>
        </div>
        <p class="small muted mt"><b>Opción manual — pegar un token:</b> generá un token de acceso de usuario en <b>developers.facebook.com → Herramientas → Explorador de la API Graph</b> con los permisos <code>ads_read</code>, <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>pages_show_list</code> y <code>pages_read_engagement</code>. Para no tener que renovarlo cada pocas horas, convertilo en un token de larga duración (60 días) o usá un usuario del sistema de Business Manager.</p>
        <div class="form-grid">
          <div class="field full"><label>Token de acceso de Meta</label><input id="sMeta" type="password" value="${esc(s.metaToken || '')}" placeholder="EAAG…"></div>
          <div class="field"><label>Versión de la Graph API</label><input id="sGraph" value="${esc(s.graphVersion || 'v23.0')}"></div>
          <div class="field"><label>&nbsp;</label><button class="btn ghost" id="testMeta">Probar conexión</button></div>
        </div>
        <div id="metaResult" class="small"></div>
        <h2 class="mt">IA para copys e ideas (Claude)</h2>
        <p class="small muted">Opcional. Creá una API key en <b>console.anthropic.com</b>. Se guarda solo en este navegador y se usa para generar copys, ideas y análisis.</p>
        <div class="form-grid"><div class="field full"><label>API key de Claude</label><input id="sAI" type="password" value="${esc(s.anthropicKey || '')}" placeholder="sk-ant-…"></div></div>
        <div class="row-end"><button class="btn primary" id="saveSettings">Guardar ajustes</button></div>
      </section>
      <section class="card">
        <h2>Respaldo de datos</h2>
        <p class="small muted">Todo se guarda en este navegador. Descargá un respaldo seguido, sobre todo antes de cambiar de compu o borrar el historial. Las imágenes y reels del banco no se incluyen en el respaldo (quedan guardados en este navegador).</p>
        <p class="small">${esc(counts)}</p>
        <div class="row gap"><button class="btn primary" id="exp">⬇ Exportar respaldo</button>
          <label class="btn ghost">⬆ Importar respaldo<input type="file" id="imp" accept="application/json" hidden></label></div>
        <h2 class="mt">Zona de peligro</h2>
        <button class="btn danger ghost" id="wipe">Borrar todos los datos</button>
      </section>
    </div>`;
  $('#saveSettings').onclick = () => {
    store.saveSettings({ ownerName: $('#sOwner').value.trim(), metaAppId: $('#sAppId').value.trim(), metaToken: $('#sMeta').value.trim(), graphVersion: $('#sGraph').value.trim() || 'v23.0', anthropicKey: $('#sAI').value.trim() });
    toast('Ajustes guardados');
  };
  $('#fbLogin').onclick = async () => {
    store.saveSettings({ metaAppId: $('#sAppId').value.trim() });
    try {
      const { metaLogin } = await import('./integrations.js');
      await metaLogin();
      toast('Facebook conectado ✓'); renderSettings(); $('#testMeta').click();
    } catch (e) { toast(e.message, 'err'); }
  };
  $('#testMeta').onclick = async () => {
    store.saveSettings({ metaToken: $('#sMeta').value.trim(), graphVersion: $('#sGraph').value.trim() || 'v23.0' });
    const out = $('#metaResult');
    out.innerHTML = 'Conectando…';
    try {
      const { meta } = await import('./integrations.js');
      const me = await meta.me();
      const [acts, igs] = await Promise.all([meta.adAccounts().catch(() => ({ data: [] })), meta.igAccounts().catch(() => ({ data: [] }))]);
      out.innerHTML = `<p class="ok-text">✓ Conectado como <b>${esc(me.name)}</b></p>
        <p><b>Cuentas publicitarias:</b><br>${(acts.data || []).map((a) => `${esc(a.name)} — <code>${esc(a.id)}</code>`).join('<br>') || 'ninguna'}</p>
        <p><b>Cuentas de Instagram:</b><br>${(igs.data || []).filter((p) => p.instagram_business_account).map((p) => `@${esc(p.instagram_business_account.username)} — <code>${esc(p.instagram_business_account.id)}</code>`).join('<br>') || 'ninguna'}</p>
        <p class="muted">Ahora andá a <a href="#/metricas">Métricas</a> y tocá “Conectar cuentas” en cada cliente.</p>`;
    } catch (e) { out.innerHTML = `<p class="err-text">${esc(e.message)}</p>`; }
  };
  $('#exp').onclick = () => download(`jetzaboard-respaldo-${todayISO()}.json`, store.exportJSON());
  $('#imp').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (!confirmBox('Esto reemplaza todos los datos actuales por los del respaldo. ¿Continuar?')) return;
    try { store.importJSON(await f.text()); toast('Respaldo importado'); router(); } catch (err) { toast(err.message, 'err'); }
  };
  $('#wipe').onclick = () => {
    if (confirmBox('¿Seguro? Se borran TODOS los clientes y datos de este navegador.') && confirmBox('Última confirmación: esta acción no se puede deshacer.')) {
      store.importJSON(JSON.stringify({ clients: [], settings: store.settings() }));
      toast('Datos borrados'); location.hash = '#/';
    }
  };
}

// ---------- Inicio ----------
window.addEventListener('hashchange', router);
$('#menuBtn').onclick = () => document.body.classList.toggle('menu-open');
$('#scrim').onclick = () => document.body.classList.remove('menu-open');
export const rerenderRoute = router;
router();

