import { store, mediaDB, uid } from './store.js';
import {
  esc, $, $$, toast, formModal, openModal, emptyState, download, confirmBox, lineChart, barList,
  NETWORKS, FORMATS, POST_STATUS, CHAR_LIMITS, statusOf, fmtNum, fmtDate, fmtMoney, todayISO, MONTHS,
} from './ui.js';
import {
  clientModal, avatar, calendarHTML, bindCalendar, monthNav, shiftMonth, kanbanHTML, bindKanban, rerenderRoute,
} from './app.js';
import { connectAccountsModal, syncClientMonth, improvementCards, connectedChips, metaConnectCard, bindMetaConnect, prevMonth } from './global.js';

const TABS = [
  ['resumen', 'Resumen'], ['proyectos', 'Proyectos y tareas'], ['estrategia', 'Estrategia'], ['competencia', 'Competencia'],
  ['ideas', 'Ideas'], ['calendario', 'Planificación'], ['copys', 'Copys'], ['medios', 'Banco de medios'],
  ['analisis', 'Análisis de contenido'], ['metricas', 'Métricas y Meta Ads'],
];
const ui = { month: todayISO().slice(0, 7), calView: 'mes', ideaFilter: 'todas', mediaFilter: 'todos', mediaProject: '', taskProject: '' };

export function renderClient(main, id, tab) {
  const c = store.get('clients', id);
  if (!c) { location.hash = '#/clientes'; return; }
  main.innerHTML = `
    <header class="client-head" style="--accent:${esc(c.color || '#E891AA')}">
      <div class="ch-left">${avatar(c, 'lg')}<div><p class="eyebrow">${esc(c.industry || 'Cliente')}</p><h1>${esc(c.name)}</h1>
        <div class="socials">${socialLinks(c)}</div></div></div>
      <div class="actions"><button class="btn ghost" id="editClient">Editar datos</button></div>
    </header>
    <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/cliente/${c.id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="tabBody"></div>`;
  $('#editClient').onclick = () => clientModal(c, () => rerenderRoute());
  $('.tabs .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const body = $('#tabBody');
  const rerender = () => renderClient(main, id, tab);
  const views = { resumen, proyectos, estrategia, competencia, ideas, calendario, copys, medios, analisis, metricas };
  (views[tab] || resumen)(body, store.get('clients', id), rerender);
}

function socialLinks(c) {
  const h = (v) => String(v || '').replace(/^@/, '');
  const links = [
    c.instagram && `<a target="_blank" rel="noopener" href="https://instagram.com/${esc(h(c.instagram))}">IG @${esc(h(c.instagram))}</a>`,
    c.tiktok && `<a target="_blank" rel="noopener" href="https://tiktok.com/@${esc(h(c.tiktok))}">TikTok @${esc(h(c.tiktok))}</a>`,
    c.facebook && `<span>FB ${esc(c.facebook)}</span>`,
    c.linkedin && `<span>in ${esc(c.linkedin)}</span>`,
    c.website && `<a target="_blank" rel="noopener" href="${esc(/^https?:/.test(c.website) ? c.website : 'https://' + c.website)}">${esc(c.website)}</a>`,
  ].filter(Boolean);
  return links.join('<span class="sep">·</span>');
}

// =============== RESUMEN ===============
const brandFields = [
  { k: 'audience', label: 'Público objetivo', type: 'textarea', rows: 3 },
  { k: 'tone', label: 'Tono de voz', type: 'textarea', rows: 2, placeholder: 'Cercano, divertido, usa emojis, tutea…' },
  { k: 'values', label: 'Propuesta de valor / diferenciales', type: 'textarea', rows: 3 },
  { k: 'dosDonts', label: 'Qué SÍ y qué NO decir', type: 'textarea', rows: 3 },
  { k: 'colors', label: 'Paleta de colores (HEX separados por coma)', placeholder: '#E891AA, #2A2A2A, #FAF7F5' },
  { k: 'fonts', label: 'Tipografías' },
  { k: 'drive', label: 'Link a carpeta de Drive / manual de marca', full: true },
];

function resumen(body, c, rerender) {
  const b = c.brand || {};
  const posts = store.byClient('posts', c.id);
  const month = todayISO().slice(0, 7);
  const upcoming = posts.filter((p) => p.date >= todayISO()).sort((a, z) => a.date.localeCompare(z.date)).slice(0, 6);
  const colors = String(b.colors || '').split(',').map((x) => x.trim()).filter(Boolean);
  body.innerHTML = `
    <section class="kpis">
      <div class="kpi"><span>Posts este mes</span><strong>${posts.filter((p) => p.date?.startsWith(month)).length}</strong></div>
      <div class="kpi"><span>Proyectos activos</span><strong>${store.byClient('projects', c.id).filter((p) => p.status !== 'finalizado').length}</strong></div>
      <div class="kpi"><span>Ideas en banco</span><strong>${store.byClient('ideas', c.id).filter((i) => i.status !== 'usada' && i.status !== 'descartada').length}</strong></div>
      <div class="kpi"><span>Archivos en banco</span><strong>${store.byClient('media', c.id).length}</strong></div>
    </section>
    <div class="grid-2">
      <section class="card">
        <div class="card-head"><h2>Datos del cliente</h2></div>
        <dl class="dl">
          <dt>Estado</dt><dd><span class="badge soft status-${esc(c.status)}">${esc(c.status || '—')}</span></dd>
          <dt>Contacto</dt><dd>${esc(c.contact || '—')}</dd>
          <dt>WhatsApp</dt><dd>${c.phone ? `<a href="https://wa.me/${esc(String(c.phone).replace(/\D/g, ''))}" target="_blank" rel="noopener">${esc(c.phone)}</a>` : '—'}</dd>
          <dt>Email</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</dd>
          <dt>Fee mensual</dt><dd>${fmtMoney(c.fee)}</dd>
          <dt>Cliente desde</dt><dd>${c.startDate ? new Date(c.startDate + 'T12:00').toLocaleDateString('es-AR') : '—'}</dd>
          <dt>Servicios</dt><dd>${(c.services || []).map((s) => `<span class="chip">${esc(s)}</span>`).join(' ') || '—'}</dd>
        </dl>
        ${c.notes ? `<p class="note">${esc(c.notes)}</p>` : ''}
      </section>
      <section class="card">
        <div class="card-head"><h2>Identidad de marca</h2><button class="btn ghost sm" id="editBrand">Editar</button></div>
        ${Object.values(b).some(Boolean) ? `<dl class="dl">
          <dt>Público</dt><dd>${esc(b.audience || '—')}</dd>
          <dt>Tono</dt><dd>${esc(b.tone || '—')}</dd>
          <dt>Diferenciales</dt><dd>${esc(b.values || '—')}</dd>
          <dt>Sí / No</dt><dd class="pre">${esc(b.dosDonts || '—')}</dd>
          <dt>Colores</dt><dd>${colors.map((col) => `<span class="swatch" style="background:${esc(col)}" title="${esc(col)}"></span>`).join('') || '—'}</dd>
          <dt>Tipografías</dt><dd>${esc(b.fonts || '—')}</dd>
          <dt>Manual / Drive</dt><dd>${b.drive ? `<a href="${esc(b.drive)}" target="_blank" rel="noopener">Abrir</a>` : '—'}</dd>
        </dl>` : emptyState('✦', 'Cargá el tono de voz, público y paleta. La IA los usa para escribir los copys.')}
      </section>
    </div>
    <section class="card">
      <div class="card-head"><h2>Próximas publicaciones</h2><a class="link" href="#/cliente/${c.id}/calendario">Planificación →</a></div>
      ${upcoming.length ? postList(upcoming) : emptyState('🗓', 'No hay publicaciones próximas.')}
    </section>`;
  $('#editBrand').onclick = () => formModal({
    title: 'Identidad de marca', fields: brandFields, values: b, wide: true,
    onSave(v) { store.upsert('clients', { ...c, brand: v }); toast('Marca guardada'); rerender(); },
  });
  bindPostList(body, rerender);
}

function postList(posts) {
  return `<ul class="list">${posts.map((p) => `
    <li class="list-item clickable" data-plist="${p.id}">
      <span class="date-pill">${fmtDate(p.date)}${p.time ? `<small>${esc(p.time)}</small>` : ''}</span>
      <div class="grow"><strong>${esc(p.title || p.format || 'Publicación')}</strong><small>${esc(p.network || '')} · ${esc(p.format || '')}${p.pillar ? ' · ' + esc(p.pillar) : ''}</small></div>
      <span class="badge" style="background:${statusOf(p.status).c}">${statusOf(p.status).l}</span>
    </li>`).join('')}</ul>`;
}
function bindPostList(root, rerender) {
  $$('[data-plist]', root).forEach((el) => (el.onclick = () => postModal(store.get('posts', el.dataset.plist), null, rerender)));
}

// =============== PUBLICACIÓN (modal) ===============
export function pillarsOf(c) {
  return String(c?.strategy?.pillars || '').split('\n').map((l) => l.split(/[-–|:]/)[0].trim()).filter(Boolean);
}

export function postModal(post, defaults, after) {
  const clean = Object.fromEntries(Object.entries(defaults || {}).filter(([, v]) => v !== undefined && v !== ''));
  const values = post ? { ...post } : { status: 'idea', network: 'Instagram', format: 'Reel', ...clean };
  let mediaIds = [...(values.mediaIds || [])];
  const clients = store.all('clients');
  if (!values.clientId && clients.length === 1) values.clientId = clients[0].id;
  const fields = (cid) => {
    const c = store.get('clients', cid);
    return [
      { k: 'clientId', label: 'Cliente', type: 'select', required: true, options: clients.map((x) => ({ v: x.id, l: x.name })) },
      { k: 'projectId', label: 'Proyecto', type: 'select', options: store.byClient('projects', cid).map((p) => ({ v: p.id, l: p.name })) },
      { k: 'date', label: 'Fecha', type: 'date', required: true },
      { k: 'time', label: 'Hora', type: 'time' },
      { k: 'network', label: 'Red social', type: 'select', options: NETWORKS },
      { k: 'format', label: 'Formato', type: 'select', options: FORMATS },
      { k: 'pillar', label: 'Pilar de contenido', type: 'select', options: pillarsOf(c) },
      { k: 'status', label: 'Estado', type: 'select', allowEmpty: false, options: POST_STATUS.map((s) => ({ v: s.v, l: s.l })) },
      { k: 'title', label: 'Título / tema', full: true, placeholder: 'Ej: 3 errores al elegir…' },
      { k: 'hook', label: 'Gancho (primeros 3 segundos / primera línea)', full: true },
      { k: 'script', label: 'Guion / estructura del contenido', type: 'textarea', rows: 3 },
      { k: 'copy', label: 'Copy', type: 'textarea', rows: 6 },
      { k: 'hashtags', label: 'Hashtags', full: true },
      { k: 'link', label: 'Link de la publicación (cuando esté publicada)', full: true },
      { k: 'notes', label: 'Notas / feedback del cliente', type: 'textarea', rows: 2 },
    ];
  };
  const open = (vals) => formModal({
    title: post ? 'Editar publicación' : 'Nueva publicación',
    fields: fields(vals.clientId), values: vals, wide: true,
    extraFooter: '<button class="btn ghost" data-dup>Duplicar</button>',
    onMount(el, close) {
      const counter = document.createElement('small');
      counter.className = 'counter';
      const copyEl = el.querySelector('[name="copy"]');
      copyEl.after(counter);
      const upd = () => {
        const lim = CHAR_LIMITS[el.querySelector('[name="network"]').value] || 2200;
        const len = copyEl.value.length + (el.querySelector('[name="hashtags"]').value.length ? el.querySelector('[name="hashtags"]').value.length + 2 : 0);
        counter.textContent = `${len} / ${lim} caracteres`;
        counter.classList.toggle('over', len > lim);
      };
      ['copy', 'hashtags', 'network'].forEach((n) => el.querySelector(`[name="${n}"]`).addEventListener('input', upd));
      upd();
      // Medios adjuntos
      const mediaBox = document.createElement('div');
      mediaBox.className = 'field full';
      el.querySelector('form').appendChild(mediaBox);
      const drawMedia = () => {
        mediaBox.innerHTML = `<label>Archivos adjuntos</label><div class="attach">${mediaIds.map((m) => `<div class="thumb sm" data-mid="${m}"></div>`).join('')}<button type="button" class="btn ghost sm" data-pick>＋ Adjuntar del banco</button></div>`;
        mediaIds.forEach((m) => fillThumb(mediaBox.querySelector(`[data-mid="${m}"]`), m, () => { mediaIds = mediaIds.filter((x) => x !== m); drawMedia(); }));
        mediaBox.querySelector('[data-pick]').onclick = () => {
          const cid = el.querySelector('[name="clientId"]').value;
          if (!cid) return toast('Elegí un cliente primero', 'err');
          mediaPicker(cid, mediaIds, (ids) => { mediaIds = ids; drawMedia(); });
        };
      };
      drawMedia();
      // Cambiar cliente → recargar opciones de proyecto y pilar
      el.querySelector('[name="clientId"]').addEventListener('change', (e) => {
        const cur = { ...vals, ...readAll(el) , clientId: e.target.value, projectId: '', pillar: '' };
        close(); open(cur);
      });
      el.querySelector('[data-dup]').onclick = () => {
        const v = readAll(el);
        store.upsert('posts', { ...v, mediaIds, id: undefined, status: 'idea', title: (v.title || '') + ' (copia)' });
        toast('Publicación duplicada'); close(); after && after();
      };
      function readAll(root) {
        const o = {};
        $$('[name]', root).forEach((i) => { if (i.type !== 'checkbox') o[i.name] = i.value; });
        return o;
      }
    },
    onSave(v) {
      store.upsert('posts', { ...(post || {}), ...v, mediaIds });
      toast('Publicación guardada');
      after && after();
    },
    onDelete: post ? () => { store.remove('posts', post.id); after && after(); } : null,
  });
  open(values);
}

// =============== PROYECTOS Y TAREAS ===============
const projectFields = [
  { k: 'name', label: 'Nombre del proyecto', required: true, full: true },
  { k: 'type', label: 'Tipo', type: 'select', options: ['Gestión mensual de redes', 'Campaña', 'Lanzamiento', 'Edición de videos', 'Diseño de piezas', 'Estrategia', 'Meta Ads', 'Sesión de fotos / contenido', 'Otro'] },
  { k: 'status', label: 'Estado', type: 'select', allowEmpty: false, options: [{ v: 'planificado', l: 'Planificado' }, { v: 'en_curso', l: 'En curso' }, { v: 'pausado', l: 'Pausado' }, { v: 'finalizado', l: 'Finalizado' }] },
  { k: 'start', label: 'Inicio', type: 'date' },
  { k: 'end', label: 'Entrega / fin', type: 'date' },
  { k: 'budget', label: 'Presupuesto ($)', type: 'number' },
  { k: 'deliverables', label: 'Entregables', type: 'textarea', rows: 3, placeholder: '12 posts, 8 reels, 30 historias…' },
  { k: 'desc', label: 'Descripción / brief', type: 'textarea', rows: 3 },
];

export function taskFields(clientId) {
  return [
    { k: 'title', label: 'Tarea', required: true, full: true },
    { k: 'clientId', label: 'Cliente', type: 'select', options: store.all('clients').map((c) => ({ v: c.id, l: c.name })) },
    { k: 'projectId', label: 'Proyecto', type: 'select', options: (clientId ? store.byClient('projects', clientId) : store.all('projects')).map((p) => ({ v: p.id, l: p.name })) },
    { k: 'status', label: 'Estado', type: 'select', allowEmpty: false, options: [{ v: 'todo', l: 'Por hacer' }, { v: 'doing', l: 'En proceso' }, { v: 'review', l: 'En revisión' }, { v: 'done', l: 'Listo' }] },
    { k: 'priority', label: 'Prioridad', type: 'select', allowEmpty: false, options: [{ v: 'alta', l: 'Alta' }, { v: 'media', l: 'Media' }, { v: 'baja', l: 'Baja' }] },
    { k: 'due', label: 'Vence', type: 'date' },
    { k: 'notes', label: 'Detalle', type: 'textarea', rows: 3 },
  ];
}

function proyectos(body, c, rerender) {
  const projects = store.byClient('projects', c.id);
  const allTasks = store.byClient('tasks', c.id);
  const tasks = ui.taskProject ? allTasks.filter((t) => t.projectId === ui.taskProject) : allTasks;
  const stLabel = { planificado: 'Planificado', en_curso: 'En curso', pausado: 'Pausado', finalizado: 'Finalizado' };
  body.innerHTML = `
    <div class="section-head"><h2>Proyectos</h2><button class="btn primary" id="newProj">＋ Proyecto</button></div>
    ${projects.length ? `<div class="card-grid">${projects.map((p) => {
      const pt = allTasks.filter((t) => t.projectId === p.id);
      const done = pt.filter((t) => t.status === 'done').length;
      const pp = store.byClient('posts', c.id).filter((x) => x.projectId === p.id).length;
      return `<div class="card proj clickable" data-proj="${p.id}">
        <div class="card-head"><strong>${esc(p.name)}</strong><span class="badge soft">${esc(stLabel[p.status] || p.status || '')}</span></div>
        <p class="small muted">${esc(p.type || '')}${p.end ? ' · entrega ' + fmtDate(p.end) : ''}${p.budget ? ' · ' + fmtMoney(p.budget) : ''}</p>
        ${p.deliverables ? `<p class="small clamp">${esc(p.deliverables)}</p>` : ''}
        <div class="progress"><div style="width:${pt.length ? (done / pt.length) * 100 : 0}%"></div></div>
        <small class="muted">${done}/${pt.length} tareas · ${pp} publicaciones</small>
      </div>`;
    }).join('')}</div>` : emptyState('▤', 'Separá el trabajo del cliente en proyectos: gestión mensual, campañas, lanzamientos, ediciones…')}
    <div class="section-head mt"><h2>Tablero de tareas</h2>
      <select id="tp"><option value="">Todos los proyectos</option>${projects.map((p) => `<option value="${p.id}" ${p.id === ui.taskProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    ${kanbanHTML(tasks, false)}`;
  const projModal = (p) => formModal({
    title: p ? 'Editar proyecto' : 'Nuevo proyecto', fields: projectFields, values: p || { status: 'en_curso', start: todayISO() }, wide: true,
    onSave(v) { store.upsert('projects', { ...(p || {}), ...v, clientId: c.id }); toast('Proyecto guardado'); rerender(); },
    onDelete: p ? () => { store.remove('projects', p.id); rerender(); } : null,
  });
  $('#newProj').onclick = () => projModal();
  $$('[data-proj]', body).forEach((el) => (el.onclick = () => projModal(store.get('projects', el.dataset.proj))));
  $('#tp').onchange = (e) => { ui.taskProject = e.target.value; rerender(); };
  bindKanban(body, { clientId: c.id, rerender });
  // Las tareas nuevas creadas acá se asignan al proyecto filtrado
  $$('[data-addtask]', body).forEach((b) => {
    const orig = b.onclick;
    b.onclick = () => {
      if (!ui.taskProject) return orig();
      formModal({
        title: 'Nueva tarea', fields: taskFields(c.id), values: { status: b.dataset.addtask, priority: 'media', clientId: c.id, projectId: ui.taskProject },
        onSave(v) { store.upsert('tasks', v); rerender(); },
      });
    };
  });
}

// =============== ESTRATEGIA ===============
const strategyFields = [
  { k: 'objective', label: 'Objetivo principal (SMART)', type: 'textarea', rows: 2, placeholder: 'Aumentar 20% las consultas por WhatsApp en 3 meses' },
  { k: 'pillars', label: 'Pilares de contenido (uno por línea: "Nombre - %")', type: 'textarea', rows: 5, placeholder: 'Educativo - 40%\nInspiracional - 20%\nVenta - 25%\nComunidad - 15%' },
  { k: 'persona', label: 'Buyer persona', type: 'textarea', rows: 4, placeholder: 'Nombre, edad, ocupación, dolores, deseos, objeciones, dónde consume contenido…' },
  { k: 'networks', label: 'Redes prioritarias y rol de cada una', type: 'textarea', rows: 2 },
  { k: 'frequency', label: 'Frecuencia de publicación', placeholder: '3 reels + 2 carruseles por semana, historias diarias', full: true },
  { k: 'fortalezas', label: 'FODA — Fortalezas', type: 'textarea', rows: 2 },
  { k: 'oportunidades', label: 'FODA — Oportunidades', type: 'textarea', rows: 2 },
  { k: 'debilidades', label: 'FODA — Debilidades', type: 'textarea', rows: 2 },
  { k: 'amenazas', label: 'FODA — Amenazas', type: 'textarea', rows: 2 },
  { k: 'kpis', label: 'KPIs a medir', type: 'textarea', rows: 2, placeholder: 'Alcance, ER, guardados, mensajes, clics al link…' },
  { k: 'funnel', label: 'Embudo (TOFU / MOFU / BOFU)', type: 'textarea', rows: 3 },
  { k: 'notes', label: 'Notas / acuerdos con el cliente', type: 'textarea', rows: 2 },
];

function parsePillars(text) {
  return String(text || '').split('\n').map((l) => {
    const name = l.split(/[-–|:]/)[0].trim();
    const pct = Number((l.match(/(\d+(?:[.,]\d+)?)\s*%?\s*$/) || [])[1]?.replace(',', '.')) || 0;
    return name ? { name, pct } : null;
  }).filter(Boolean);
}

function estrategia(body, c, rerender) {
  const s = c.strategy || {};
  const pillars = parsePillars(s.pillars);
  const month = ui.month;
  const mp = store.byClient('posts', c.id).filter((p) => p.date?.startsWith(month));
  const box = (title, val) => `<div class="sbox"><h4>${title}</h4><p class="pre">${esc(val || '—')}</p></div>`;
  body.innerHTML = `
    <div class="section-head"><h2>Estrategia de contenido</h2>
      <div class="row gap"><button class="btn ghost" id="aiStrat">✨ Sugerir con IA</button><button class="btn primary" id="editStrat">Editar estrategia</button></div></div>
    ${Object.values(s).some(Boolean) ? `
    <div class="grid-2">
      <section class="card">${box('🎯 Objetivo', s.objective)}${box('👤 Buyer persona', s.persona)}${box('📱 Redes y rol', s.networks)}${box('🗓 Frecuencia', s.frequency)}</section>
      <section class="card">
        <h4>Pilares de contenido — plan vs. real (${MONTHS[Number(month.slice(5)) - 1]})</h4>
        ${pillars.length ? `<table class="table"><thead><tr><th>Pilar</th><th>Plan</th><th>Real</th><th>Posts</th></tr></thead><tbody>
          ${pillars.map((p) => { const n = mp.filter((x) => x.pillar === p.name).length; return `<tr><td>${esc(p.name)}</td><td>${p.pct ? p.pct + '%' : '—'}</td><td>${mp.length ? Math.round((n / mp.length) * 100) + '%' : '—'}</td><td>${n}</td></tr>`; }).join('')}
        </tbody></table>` : '<p class="muted">Definí los pilares para ver la distribución.</p>'}
        ${box('📊 KPIs', s.kpis)}${box('🔻 Embudo', s.funnel)}
      </section>
    </div>
    <section class="card"><h4>FODA</h4><div class="swot">
      <div class="sw f"><b>Fortalezas</b><p class="pre">${esc(s.fortalezas || '—')}</p></div>
      <div class="sw o"><b>Oportunidades</b><p class="pre">${esc(s.oportunidades || '—')}</p></div>
      <div class="sw d"><b>Debilidades</b><p class="pre">${esc(s.debilidades || '—')}</p></div>
      <div class="sw a"><b>Amenazas</b><p class="pre">${esc(s.amenazas || '—')}</p></div>
    </div>${s.notes ? `<p class="note">${esc(s.notes)}</p>` : ''}</section>` : emptyState('🎯', 'Definí objetivo, buyer persona, pilares y FODA. Todo lo demás (ideas, copys, calendario) se apoya en esto.')}`;
  $('#editStrat').onclick = () => formModal({
    title: 'Estrategia', fields: strategyFields, values: s, wide: true,
    onSave(v) { store.upsert('clients', { ...c, strategy: v }); toast('Estrategia guardada'); rerender(); },
  });
  $('#aiStrat').onclick = () => aiModal({
    title: 'Sugerencia de estrategia',
    prompt: `${clientContext(c)}\n\nCompetidores cargados:\n${competitorsText(c)}\n\nPropuesta una estrategia de contenido para redes sociales para esta marca. Incluí: objetivo SMART, buyer persona, 4 pilares de contenido con % sugerido, redes prioritarias con su rol, frecuencia semanal, FODA breve, KPIs y una idea de embudo TOFU/MOFU/BOFU. Usá títulos cortos y viñetas.`,
  });
}

// =============== COMPETENCIA ===============
const competitorFields = [
  { k: 'name', label: 'Nombre', required: true },
  { k: 'handle', label: 'Usuario / link' },
  { k: 'network', label: 'Red principal', type: 'select', options: NETWORKS },
  { k: 'followers', label: 'Seguidores', type: 'number' },
  { k: 'engagement', label: 'Engagement estimado (%)', type: 'number' },
  { k: 'frequency', label: 'Frecuencia de publicación', placeholder: '4 posts/semana' },
  { k: 'formats', label: 'Formatos que más usa', full: true },
  { k: 'strengths', label: 'Qué hace bien', type: 'textarea', rows: 2 },
  { k: 'weaknesses', label: 'Qué hace mal / oportunidades para nosotros', type: 'textarea', rows: 2 },
  { k: 'topContent', label: 'Contenidos destacados (links + por qué funcionan)', type: 'textarea', rows: 3 },
  { k: 'ads', label: 'Anuncios activos (Biblioteca de anuncios de Meta)', type: 'textarea', rows: 2 },
];

function competencia(body, c, rerender) {
  const list = store.byClient('competitors', c.id);
  const lastFollowers = latestFollowers(c.id);
  body.innerHTML = `
    <div class="section-head"><h2>Competencia y referentes</h2>
      <div class="row gap">${list.length ? '<button class="btn ghost" id="aiComp">✨ Analizar con IA</button>' : ''}<button class="btn primary" id="newComp">＋ Competidor</button></div></div>
    ${list.length ? `
      <section class="card"><h4>Seguidores comparados</h4>${barList([
        ...(lastFollowers ? [{ label: c.name + ' (nosotros)', value: lastFollowers }] : []),
        ...list.filter((x) => x.followers).map((x) => ({ label: x.name, value: Number(x.followers) })),
      ].sort((a, b) => b.value - a.value))}</section>
      <div class="card-grid">${list.map((x) => `
        <div class="card clickable" data-comp="${x.id}">
          <div class="card-head"><strong>${esc(x.name)}</strong><span class="chip">${esc(x.network || '')}</span></div>
          <p class="small muted">${esc(x.handle || '')}</p>
          <div class="mini-stats"><span><b>${fmtNum(x.followers)}</b> seguidores</span><span><b>${x.engagement ? fmtNum(x.engagement) + '%' : '—'}</b> ER</span><span>${esc(x.frequency || '')}</span></div>
          ${x.strengths ? `<p class="small"><b>✓</b> ${esc(x.strengths)}</p>` : ''}
          ${x.weaknesses ? `<p class="small"><b>↗</b> ${esc(x.weaknesses)}</p>` : ''}
          <div class="row gap mt-s">
            ${x.handle ? `<a class="link small" target="_blank" rel="noopener" href="${esc(/^https?:/.test(x.handle) ? x.handle : 'https://instagram.com/' + x.handle.replace(/^@/, ''))}" onclick="event.stopPropagation()">Ver perfil</a>` : ''}
            <a class="link small" target="_blank" rel="noopener" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&q=${encodeURIComponent(x.name)}" onclick="event.stopPropagation()">Biblioteca de anuncios</a>
          </div>
        </div>`).join('')}</div>` : emptyState('🔍', 'Registrá competidores y referentes: qué publican, qué les funciona y qué oportunidades dejan.')}`;
  const modal = (x) => formModal({
    title: x ? 'Editar competidor' : 'Nuevo competidor', fields: competitorFields, values: x || { network: 'Instagram' }, wide: true,
    onSave(v) { store.upsert('competitors', { ...(x || {}), ...v, clientId: c.id }); toast('Guardado'); rerender(); },
    onDelete: x ? () => { store.remove('competitors', x.id); rerender(); } : null,
  });
  $('#newComp').onclick = () => modal();
  $$('[data-comp]', body).forEach((el) => (el.onclick = () => modal(store.get('competitors', el.dataset.comp))));
  $('#aiComp') && ($('#aiComp').onclick = () => aiModal({
    title: 'Análisis de competencia',
    prompt: `${clientContext(c)}\n\nCompetidores:\n${competitorsText(c)}\n\nHacé un análisis comparativo: qué patrones de contenido les funcionan, qué huecos dejan, 5 oportunidades concretas de diferenciación para ${c.name} y 5 ideas de contenido inspiradas (sin copiar) en lo que funciona.`,
  }));
}

function competitorsText(c) {
  return store.byClient('competitors', c.id).map((x) => `- ${x.name} (${x.network || ''}, ${x.followers || '?'} seguidores, ER ${x.engagement || '?'}%). Bien: ${x.strengths || '-'}. Mal: ${x.weaknesses || '-'}. Destacados: ${x.topContent || '-'}`).join('\n') || '(ninguno)';
}

// =============== IDEAS ===============
export const ideaFields = (c) => [
  { k: 'title', label: 'Idea', required: true, full: true },
  { k: 'format', label: 'Formato', type: 'select', options: FORMATS },
  { k: 'network', label: 'Red', type: 'select', options: NETWORKS },
  { k: 'pillar', label: 'Pilar', type: 'select', options: pillarsOf(c) },
  { k: 'status', label: 'Estado', type: 'select', allowEmpty: false, options: [{ v: 'nueva', l: 'Nueva' }, { v: 'aprobada', l: 'Aprobada' }, { v: 'usada', l: 'Usada' }, { v: 'descartada', l: 'Descartada' }] },
  { k: 'hook', label: 'Gancho', full: true },
  { k: 'desc', label: 'Desarrollo / guion', type: 'textarea', rows: 4 },
  { k: 'reference', label: 'Referencia (link de inspiración / trend / audio)', full: true },
];

function ideas(body, c, rerender) {
  const all = store.byClient('ideas', c.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const f = ui.ideaFilter;
  const list = f === 'todas' ? all.filter((i) => i.status !== 'descartada') : all.filter((i) => i.status === f);
  body.innerHTML = `
    <div class="section-head"><h2>Banco de ideas</h2>
      <div class="row gap"><button class="btn ghost" id="aiIdeas">✨ Generar ideas con IA</button><button class="btn primary" id="newIdea">＋ Idea</button></div></div>
    <div class="toolbar"><div class="seg">${[['todas', 'Activas'], ['nueva', 'Nuevas'], ['aprobada', 'Aprobadas'], ['usada', 'Usadas'], ['descartada', 'Descartadas']].map(([k, l]) => `<button class="${k === f ? 'on' : ''}" data-if="${k}">${l} <b>${k === 'todas' ? all.filter((i) => i.status !== 'descartada').length : all.filter((i) => i.status === k).length}</b></button>`).join('')}</div></div>
    ${list.length ? `<div class="card-grid">${list.map((i) => `
      <div class="card idea clickable" data-idea="${i.id}">
        <div class="row gap wrap">${i.format ? `<span class="chip">${esc(i.format)}</span>` : ''}${i.pillar ? `<span class="chip pink">${esc(i.pillar)}</span>` : ''}<span class="chip soft">${esc(i.status || 'nueva')}</span></div>
        <strong class="idea-title">${esc(i.title)}</strong>
        ${i.hook ? `<p class="small"><i>“${esc(i.hook)}”</i></p>` : ''}
        ${i.desc ? `<p class="small muted clamp">${esc(i.desc)}</p>` : ''}
        <button class="btn ghost sm" data-toplan="${i.id}">→ Pasar al calendario</button>
      </div>`).join('')}</div>` : emptyState('💡', 'Anotá ideas apenas aparecen: trends, preguntas de clientes, audios, referencias.')}`;
  const modal = (i) => formModal({
    title: i ? 'Editar idea' : 'Nueva idea', fields: ideaFields(c), values: i || { status: 'nueva', network: 'Instagram' }, wide: true,
    onSave(v) { store.upsert('ideas', { ...(i || {}), ...v, clientId: c.id }); toast('Idea guardada'); rerender(); },
    onDelete: i ? () => { store.remove('ideas', i.id); rerender(); } : null,
  });
  $('#newIdea').onclick = () => modal();
  $$('[data-if]', body).forEach((b) => (b.onclick = () => { ui.ideaFilter = b.dataset.if; rerender(); }));
  $$('[data-idea]', body).forEach((el) => (el.onclick = () => modal(store.get('ideas', el.dataset.idea))));
  $$('[data-toplan]', body).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const i = store.get('ideas', b.dataset.toplan);
    postModal(null, { clientId: c.id, date: todayISO(), title: i.title, hook: i.hook, script: i.desc, format: i.format, network: i.network || 'Instagram', pillar: i.pillar, status: 'produccion' }, () => {
      store.upsert('ideas', { ...i, status: 'usada' }); rerender();
    });
  }));
  $('#aiIdeas').onclick = () => generateIdeas(c, rerender);
}

export function generateIdeas(c, rerender) {
  const top = topAnalyses(c.id, 5).map((a) => `- ${a.title || a.format} (${a.format}, ER ${er(a).toFixed(2)}%): ${a.whyWorked || ''}`).join('\n') || '(sin datos)';
  const m = openModal({
    title: 'Generar ideas con IA', wide: true,
    body: `<div class="form-grid">
      <div class="field"><label>Cantidad</label><input id="giN" type="number" value="10" min="3" max="30"></div>
      <div class="field"><label>Formato preferido</label><select id="giF"><option value="">Mixto</option>${FORMATS.map((x) => `<option>${x}</option>`).join('')}</select></div>
      <div class="field full"><label>Contexto extra (fecha especial, lanzamiento, promo…)</label><textarea id="giX" rows="2"></textarea></div>
    </div><div id="giOut"></div>`,
    footer: '<span class="spacer"></span><button class="btn ghost" data-close>Cerrar</button><button class="btn primary" id="giGo">✨ Generar</button>',
  });
  const out = $('#giOut', m.el);
  $('#giGo', m.el).onclick = async () => {
    out.innerHTML = '<p class="loading">Pensando ideas…</p>';
    const prompt = `${clientContext(c)}\n\nContenidos que mejor funcionaron:\n${top}\n\nCompetencia:\n${competitorsText(c)}\n\n${$('#giX', m.el).value}\n\nGenerá ${$('#giN', m.el).value} ideas de contenido${$('#giF', m.el).value ? ' en formato ' + $('#giF', m.el).value : ''} para redes sociales. Devolvé SOLO un array JSON (sin texto antes ni después, sin bloque de código) de objetos con las claves: "title", "format" (uno de: ${FORMATS.join(', ')}), "pillar" (uno de: ${pillarsOf(c).join(', ') || 'libre'}), "hook" (primera frase o primeros 3 segundos), "desc" (desarrollo en 2-4 líneas).`;
    try {
      const txt = await (await import('./integrations.js')).askClaude(prompt, { maxTokens: 8000 });
      const arr = JSON.parse(txt.slice(txt.indexOf('['), txt.lastIndexOf(']') + 1));
      out.innerHTML = `<p class="small muted">Elegí las que querés guardar en el banco:</p>${arr.map((i, n) => `
        <label class="ai-idea"><input type="checkbox" checked data-n="${n}"><div><strong>${esc(i.title)}</strong> <span class="chip">${esc(i.format || '')}</span> ${i.pillar ? `<span class="chip pink">${esc(i.pillar)}</span>` : ''}<p class="small"><i>${esc(i.hook || '')}</i></p><p class="small muted">${esc(i.desc || '')}</p></div></label>`).join('')}
        <div class="row-end"><button class="btn primary" id="giSave">Guardar seleccionadas</button></div>`;
      $('#giSave', m.el).onclick = () => {
        $$('[data-n]:checked', out).forEach((cb) => store.upsert('ideas', { ...arr[cb.dataset.n], clientId: c.id, status: 'nueva', network: 'Instagram' }));
        toast('Ideas guardadas'); m.close(); rerender();
      };
    } catch (e) { out.innerHTML = `<p class="err-text">${esc(e.message)}</p>`; }
  };
}

// =============== PLANIFICACIÓN (calendario del cliente) ===============
function calendario(body, c, rerender) {
  const posts = store.byClient('posts', c.id).filter((p) => p.date?.startsWith(ui.month));
  const count = (key) => Object.entries(posts.reduce((acc, p) => { const k = p[key] || '—'; acc[k] = (acc[k] || 0) + 1; return acc; }, {})).map(([label, value]) => ({ label, value }));
  body.innerHTML = `
    <div class="section-head"><h2>Planificación mensual</h2>
      <div class="row gap"><button class="btn ghost" id="exportCsv">⬇ Exportar mes (CSV)</button><button class="btn ghost" id="printPlan">🖨 Grilla para el cliente</button><button class="btn primary" id="newPost">＋ Publicación</button></div></div>
    <div class="toolbar">${monthNav(ui.month)}<div class="seg"><button class="${ui.calView === 'mes' ? 'on' : ''}" data-cv="mes">Calendario</button><button class="${ui.calView === 'lista' ? 'on' : ''}" data-cv="lista">Lista</button><button class="${ui.calView === 'feed' ? 'on' : ''}" data-cv="feed">Vista feed</button></div></div>
    <div class="plan-summary">
      <div class="card"><h4>Por estado</h4>${barList(POST_STATUS.map((s) => ({ label: s.l, value: posts.filter((p) => p.status === s.v).length })))}</div>
      <div class="card"><h4>Por formato</h4>${posts.length ? barList(count('format')) : '<p class="muted small">—</p>'}</div>
      <div class="card"><h4>Por red</h4>${posts.length ? barList(count('network'), 'var(--blue)') : '<p class="muted small">—</p>'}</div>
    </div>
    <div id="calBody"></div>`;
  const cb = $('#calBody', body);
  const sorted = [...posts].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
  if (ui.calView === 'mes') { cb.innerHTML = calendarHTML(ui.month, posts, { showClient: false }); bindCalendar(cb, { clientId: c.id, rerender }); }
  else if (ui.calView === 'lista') { cb.innerHTML = `<section class="card">${sorted.length ? postList(sorted) : emptyState('🗓', 'Sin publicaciones este mes.')}</section>`; bindPostList(cb, rerender); }
  else {
    const feed = sorted.filter((p) => p.network === 'Instagram' || !p.network).reverse();
    cb.innerHTML = feed.length ? `<p class="small muted">Previsualización del feed de Instagram (lo más nuevo arriba). Adjuntá imágenes a cada publicación para verlas.</p><div class="feed">${feed.map((p) => `<div class="feed-cell" data-plist="${p.id}" data-fm="${(p.mediaIds || [])[0] || ''}"><span>${esc(p.format || '')}<br>${fmtDate(p.date)}</span></div>`).join('')}</div>` : emptyState('▦', 'Sin publicaciones de Instagram este mes.');
    $$('[data-fm]', cb).forEach((el) => el.dataset.fm && fillThumb(el, el.dataset.fm));
    bindPostList(cb, rerender);
  }
  $$('[data-mnav]', body).forEach((b) => (b.onclick = () => { ui.month = shiftMonth(ui.month, Number(b.dataset.mnav)); rerender(); }));
  $$('[data-cv]', body).forEach((b) => (b.onclick = () => { ui.calView = b.dataset.cv; rerender(); }));
  $('#newPost').onclick = () => postModal(null, { clientId: c.id, date: ui.month === todayISO().slice(0, 7) ? todayISO() : ui.month + '-01' }, rerender);
  $('#exportCsv').onclick = () => {
    const cols = ['date', 'time', 'network', 'format', 'pillar', 'status', 'title', 'hook', 'copy', 'hashtags', 'notes'];
    const head = ['Fecha', 'Hora', 'Red', 'Formato', 'Pilar', 'Estado', 'Título', 'Gancho', 'Copy', 'Hashtags', 'Notas'];
    const rows = sorted.map((p) => cols.map((k) => `"${String(k === 'status' ? statusOf(p.status).l : p[k] || '').replace(/"/g, '""')}"`).join(','));
    download(`${c.name}-plan-${ui.month}.csv`, '﻿' + [head.join(','), ...rows].join('\n'), 'text/csv');
  };
  $('#printPlan').onclick = () => printPlan(c, sorted);
}

function printPlan(c, posts) {
  const [y, m] = ui.month.split('-');
  const w = window.open('', '_blank');
  if (!w) return toast('Permití las ventanas emergentes para imprimir', 'err');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.name)} — Plan ${MONTHS[m - 1]} ${y}</title>
    <style>body{font-family:system-ui,sans-serif;padding:24px;color:#2a2a2a}h1{font-weight:500}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #e5dede;padding:8px;vertical-align:top;text-align:left}th{background:#FDE8EE}td.copy{white-space:pre-wrap;max-width:420px}</style></head>
    <body><h1>${esc(c.name)} · Planificación ${MONTHS[m - 1]} ${y}</h1><p>${posts.length} publicaciones</p>
    <table><thead><tr><th>Fecha</th><th>Red / formato</th><th>Tema</th><th>Copy</th><th>Estado</th><th>Aprobado ✓ / comentarios</th></tr></thead><tbody>
    ${posts.map((p) => `<tr><td>${fmtDate(p.date)} ${esc(p.time || '')}</td><td>${esc(p.network || '')}<br>${esc(p.format || '')}</td><td><b>${esc(p.title || '')}</b><br>${esc(p.hook || '')}</td><td class="copy">${esc(p.copy || '')}\n${esc(p.hashtags || '')}</td><td>${statusOf(p.status).l}</td><td></td></tr>`).join('')}
    </tbody></table><script>setTimeout(()=>print(),300)<\/script></body></html>`);
  w.document.close();
}

// =============== COPYS ===============
const FORMULAS = {
  'Gancho + valor + CTA': (t) => `${t.hook || '¿Sabías que…?'}\n\n${t.topic ? `Hoy te cuento sobre ${t.topic}.` : '[Desarrollá el valor en 2-3 líneas]'}\n\n✔ [Punto 1]\n✔ [Punto 2]\n✔ [Punto 3]\n\n${t.cta || '👉 Guardalo para tenerlo a mano.'}`,
  'AIDA': (t) => `🔸 ${t.hook || '[Atención: frase que frene el scroll]'}\n\n[Interés: contá el problema o situación de ${t.topic || 'tu público'}]\n\n[Deseo: mostrá el beneficio / transformación]\n\n${t.cta || '👉 [Acción: escribinos / link en bio]'}`,
  'PAS (Problema-Agitación-Solución)': (t) => `${t.hook || '[Problema: ¿Te pasa que…?]'}\n\n[Agitación: qué pasa si no se resuelve]\n\n[Solución: cómo ${t.topic || 'tu producto/servicio'} lo resuelve]\n\n${t.cta || '📩 Escribinos y te asesoramos.'}`,
  'Antes – Después – Puente': (t) => `Antes: [situación inicial]\nDespués: [resultado soñado]\n\nEl puente: ${t.topic || '[cómo llegar]'}\n\n${t.cta || '👉 ¿Querés lograrlo? Escribinos.'}`,
  'Storytelling': (t) => `${t.hook || '[Arrancá en el medio de la historia]'}\n\n[Contexto breve]\n[Conflicto]\n[Giro / aprendizaje sobre ${t.topic || 'el tema'}]\n\n[Moraleja que conecta con la marca]\n\n${t.cta || '💬 ¿Te pasó algo parecido? Contame.'}`,
  'Lista / tips': (t) => `${t.hook || `5 claves sobre ${t.topic || '[tema]'}`} 👇\n\n1️⃣ \n2️⃣ \n3️⃣ \n4️⃣ \n5️⃣ \n\n${t.cta || '📌 Guardalo y compartilo con quien lo necesite.'}`,
  'Venta directa / promo': (t) => `${t.hook || '🔥 [Oferta o novedad]'}\n\n${t.topic ? `✨ ${t.topic}` : '[Producto / servicio]'}\n✔ [Beneficio 1]\n✔ [Beneficio 2]\n📍 [Dónde / cuándo]\n\n${t.cta || '👉 Pedí el tuyo por WhatsApp (link en bio).'}`,
};
const HOOKS = ['Nadie te cuenta esto sobre…', 'Dejá de hacer esto si querés…', 'El error que comete el 90%…', 'Esto me hubiera gustado saber antes de…', '3 cosas que cambiaron mi…', 'POV: …', 'No compres … sin ver esto', '¿Por qué nadie habla de…?', 'Probé … durante 30 días y…', 'Guardá este post para cuando…'];
const CTAS = ['👉 Guardalo para después', '💬 Comentá "QUIERO" y te mando la info', '📩 Escribinos por WhatsApp (link en bio)', '🔁 Compartilo con quien lo necesita', '👇 Contame en comentarios', '🛒 Pedí el tuyo desde el link en bio', '📍 Te esperamos en …', '🔔 Seguinos para más tips'];

function copys(body, c, rerender) {
  const saved = store.byClient('copies', c.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const sets = store.byClient('hashtagSets', c.id);
  body.innerHTML = `
    <div class="copy-layout">
      <section class="card">
        <h2>Generador de copys</h2>
        <div class="form-grid">
          <div class="field"><label>Red social</label><select id="cpNet">${NETWORKS.map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div class="field"><label>Formato</label><select id="cpFmt">${FORMATS.map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div class="field"><label>Fórmula</label><select id="cpFor">${Object.keys(FORMULAS).map((n) => `<option>${n}</option>`).join('')}</select></div>
          <div class="field"><label>Objetivo</label><select id="cpObj"><option>Alcance / viralidad</option><option>Interacción / comunidad</option><option>Guardados (valor)</option><option>Mensajes / leads</option><option>Venta</option><option>Tráfico al link</option></select></div>
          <div class="field full"><label>Tema / qué se muestra</label><input id="cpTopic" placeholder="Ej: lanzamiento del menú de verano"></div>
          <div class="field full"><label>Gancho</label><input id="cpHook" placeholder="Elegí uno de abajo o escribí el tuyo"><div class="chips-pick">${HOOKS.map((h) => `<button type="button" class="chip pick" data-hook="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
          <div class="field full"><label>CTA</label><input id="cpCta"><div class="chips-pick">${CTAS.map((h) => `<button type="button" class="chip pick" data-cta="${esc(h)}">${esc(h)}</button>`).join('')}</div></div>
        </div>
        <div class="row gap"><button class="btn ghost" id="cpTpl">📝 Armar con plantilla</button><button class="btn primary" id="cpAI">✨ Escribir con IA (3 opciones)</button></div>
        <div class="field full mt"><label>Copy</label><textarea id="cpText" rows="10" placeholder="Tu copy aparece acá. Podés editarlo libremente."></textarea><small class="counter" id="cpCount"></small></div>
        <div class="field full"><label>Hashtags</label><input id="cpTags"><div class="chips-pick">${sets.map((s) => `<button type="button" class="chip pick" data-set="${s.id}">#${esc(s.name)}</button>`).join('')}<button type="button" class="chip pick add" id="newSet">＋ Set de hashtags</button></div></div>
        <div class="row gap"><input id="cpTitle" placeholder="Nombre para guardarlo (opcional)" class="grow"><button class="btn ghost" id="cpCopy">Copiar</button><button class="btn primary" id="cpSave">Guardar copy</button></div>
      </section>
      <section class="card">
        <h2>Copys guardados <span class="muted small">(${saved.length})</span></h2>
        <input type="search" id="cpSearch" placeholder="Buscar…" class="mb">
        <div id="cpList">${saved.length ? saved.map((s) => `
          <div class="saved-copy" data-cid="${s.id}" data-search="${esc((s.title + ' ' + s.text).toLowerCase())}">
            <div class="row between"><strong>${esc(s.title || 'Sin título')}</strong><span class="chip">${esc(s.network || '')}</span></div>
            <p class="small pre clamp">${esc(s.text)}</p>
            <div class="row gap"><button class="link small" data-use="${s.id}">Usar</button><button class="link small" data-cpy="${s.id}">Copiar</button><button class="link small danger" data-delc="${s.id}">Eliminar</button></div>
          </div>`).join('') : '<p class="muted small">Todavía no guardaste copys.</p>'}</div>
      </section>
    </div>`;
  const txt = $('#cpText', body), tags = $('#cpTags', body), count = $('#cpCount', body), net = $('#cpNet', body);
  const upd = () => {
    const lim = CHAR_LIMITS[net.value] || 2200;
    const len = txt.value.length + (tags.value ? tags.value.length + 2 : 0);
    const hashCount = (tags.value.match(/#/g) || []).length;
    count.textContent = `${len} / ${lim} caracteres · ${hashCount} hashtags${net.value === 'Instagram' && hashCount > 5 ? ' (Instagram recomienda 3–5)' : ''}`;
    count.classList.toggle('over', len > lim);
  };
  [txt, tags, net].forEach((e) => e.addEventListener('input', upd)); upd();
  $$('[data-hook]', body).forEach((b) => (b.onclick = () => ($('#cpHook', body).value = b.dataset.hook)));
  $$('[data-cta]', body).forEach((b) => (b.onclick = () => ($('#cpCta', body).value = b.dataset.cta)));
  $$('[data-set]', body).forEach((b) => (b.onclick = () => { tags.value = (tags.value + ' ' + store.get('hashtagSets', b.dataset.set).tags).trim(); upd(); }));
  $('#newSet', body).onclick = () => formModal({
    title: 'Set de hashtags', fields: [{ k: 'name', label: 'Nombre del set', required: true }, { k: 'tags', label: 'Hashtags', type: 'textarea', rows: 3, placeholder: '#gastronomia #cordoba #brunch' }],
    onSave(v) { store.upsert('hashtagSets', { ...v, clientId: c.id }); rerender(); },
  });
  const inputs = () => ({ topic: $('#cpTopic', body).value, hook: $('#cpHook', body).value, cta: $('#cpCta', body).value });
  $('#cpTpl', body).onclick = () => { txt.value = FORMULAS[$('#cpFor', body).value](inputs()); upd(); };
  $('#cpAI', body).onclick = () => {
    const t = inputs();
    aiModal({
      title: 'Copys con IA',
      prompt: `${clientContext(c)}\n\nEscribí 3 opciones de copy distintas para ${net.value}, formato ${$('#cpFmt', body).value}, objetivo: ${$('#cpObj', body).value}. Estructura: ${$('#cpFor', body).value}.\nTema: ${t.topic || '(a elección según la estrategia)'}\n${t.hook ? 'Gancho a usar o mejorar: ' + t.hook : ''}\n${t.cta ? 'CTA: ' + t.cta : ''}\nRespetá el límite de ${CHAR_LIMITS[net.value]} caracteres. Separá cada opción con una línea que diga solo "---". No incluyas hashtags; al final de todo, después de otra línea "---", sugerí 8 hashtags relevantes en una sola línea.`,
      onUse(text) {
        const parts = text.split(/\n-{3,}\n/);
        const last = parts[parts.length - 1];
        if (/^\s*#/.test(last)) { tags.value = last.trim(); parts.pop(); }
        txt.value = parts[0].trim();
        upd();
        if (parts.length > 1) toast(`La IA generó ${parts.length} opciones: se cargó la primera. El resto queda en el cuadro de la IA.`);
      },
      keepOpen: true,
    });
  };
  $('#cpCopy', body).onclick = () => { navigator.clipboard.writeText(txt.value + (tags.value ? '\n\n' + tags.value : '')); toast('Copiado al portapapeles'); };
  $('#cpSave', body).onclick = () => {
    if (!txt.value.trim()) return toast('El copy está vacío', 'err');
    store.upsert('copies', { clientId: c.id, title: $('#cpTitle', body).value || $('#cpTopic', body).value, network: net.value, formula: $('#cpFor', body).value, text: txt.value + (tags.value ? '\n\n' + tags.value : '') });
    toast('Copy guardado'); rerender();
  };
  $('#cpSearch', body).oninput = (e) => $$('.saved-copy', body).forEach((el) => (el.style.display = el.dataset.search.includes(e.target.value.toLowerCase()) ? '' : 'none'));
  $$('[data-use]', body).forEach((b) => (b.onclick = () => { txt.value = store.get('copies', b.dataset.use).text; tags.value = ''; upd(); txt.scrollIntoView({ behavior: 'smooth' }); }));
  $$('[data-cpy]', body).forEach((b) => (b.onclick = () => { navigator.clipboard.writeText(store.get('copies', b.dataset.cpy).text); toast('Copiado'); }));
  $$('[data-delc]', body).forEach((b) => (b.onclick = () => { if (confirmBox('¿Eliminar este copy?')) { store.remove('copies', b.dataset.delc); rerender(); } }));
}

// =============== BANCO DE MEDIOS ===============
async function fillThumb(el, mediaId, onRemove) {
  if (!el) return;
  const m = store.get('media', mediaId);
  if (!m) { el.innerHTML = '<span class="small muted">?</span>'; return; }
  const url = await mediaDB.url(mediaId);
  el.innerHTML = m.type?.startsWith('video') ? `<video src="${url}" muted preload="metadata"></video><span class="play">▶</span>` : `<img src="${url}" alt="${esc(m.name)}" loading="lazy">`;
  if (onRemove) {
    const x = document.createElement('button');
    x.type = 'button'; x.className = 'thumb-x'; x.textContent = '✕';
    x.onclick = (e) => { e.stopPropagation(); onRemove(); };
    el.appendChild(x);
  }
}

async function uploadFiles(files, clientId, extra = {}) {
  let n = 0;
  for (const f of files) {
    if (!/^(image|video)\//.test(f.type)) { toast(`${f.name}: solo imágenes o videos`, 'err'); continue; }
    const id = uid();
    try {
      await mediaDB.put(id, f);
      store.upsert('media', { id, clientId, name: f.name, type: f.type, size: f.size, tags: '', ...extra });
      n++;
    } catch (e) { toast(`No se pudo guardar ${f.name}: ${e.message}`, 'err'); }
  }
  if (n) toast(`${n} archivo(s) subido(s)`);
}

function mediaPicker(clientId, selected, onDone) {
  let sel = new Set(selected);
  const draw = (m) => {
    const items = store.byClient('media', clientId);
    $('#mpGrid', m.el).innerHTML = items.length ? items.map((x) => `<div class="thumb pickable ${sel.has(x.id) ? 'sel' : ''}" data-pk="${x.id}"></div>`).join('') : '<p class="muted">El banco está vacío. Subí archivos.</p>';
    items.forEach((x) => fillThumb($(`[data-pk="${x.id}"]`, m.el), x.id));
    $$('[data-pk]', m.el).forEach((el) => (el.onclick = () => { sel.has(el.dataset.pk) ? sel.delete(el.dataset.pk) : sel.add(el.dataset.pk); el.classList.toggle('sel'); }));
  };
  const m = openModal({
    title: 'Elegir archivos del banco', wide: true,
    body: '<label class="btn ghost sm">⬆ Subir nuevos<input type="file" id="mpUp" multiple accept="image/*,video/*" hidden></label><div class="media-grid mt" id="mpGrid"></div>',
    footer: '<span class="spacer"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="mpOk">Listo</button>',
    onMount(el) {
      setTimeout(() => draw(m));
      $('#mpUp', el).onchange = async (e) => { await uploadFiles([...e.target.files], clientId); draw(m); };
      $('#mpOk', el).onclick = () => { onDone([...sel]); m.close(); };
    },
  });
}

function medios(body, c, rerender) {
  const projects = store.byClient('projects', c.id);
  let items = store.byClient('media', c.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  if (ui.mediaFilter === 'imagenes') items = items.filter((m) => m.type?.startsWith('image'));
  if (ui.mediaFilter === 'videos') items = items.filter((m) => m.type?.startsWith('video'));
  if (ui.mediaProject) items = items.filter((m) => m.projectId === ui.mediaProject);
  const q = (ui.mediaQuery || '').toLowerCase();
  if (q) items = items.filter((m) => (m.name + ' ' + (m.tags || '')).toLowerCase().includes(q));
  const totalMB = store.byClient('media', c.id).reduce((s, m) => s + (m.size || 0), 0) / 1048576;
  body.innerHTML = `
    <div class="section-head"><h2>Banco de imágenes y reels</h2><label class="btn primary">⬆ Subir archivos<input type="file" id="upl" multiple accept="image/*,video/*" hidden></label></div>
    <div class="toolbar">
      <div class="seg">${[['todos', 'Todo'], ['imagenes', 'Imágenes'], ['videos', 'Videos / reels']].map(([k, l]) => `<button class="${k === ui.mediaFilter ? 'on' : ''}" data-mf="${k}">${l}</button>`).join('')}</div>
      <select id="mp"><option value="">Todos los proyectos</option>${projects.map((p) => `<option value="${p.id}" ${p.id === ui.mediaProject ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
      <input type="search" id="mq" placeholder="Buscar por nombre o etiqueta" value="${esc(ui.mediaQuery || '')}">
      <span class="muted small">${totalMB.toFixed(1)} MB usados</span>
    </div>
    <div class="dropzone" id="drop">Arrastrá imágenes o videos acá para subirlos</div>
    ${items.length ? `<div class="media-grid">${items.map((m) => `
      <figure class="media-item" data-media="${m.id}"><div class="thumb" data-th="${m.id}"></div>
        <figcaption><span class="clamp1">${esc(m.name)}</span>${m.tags ? `<small class="muted clamp1">${esc(m.tags)}</small>` : ''}</figcaption></figure>`).join('')}</div>`
      : emptyState('🖼', 'Subí fotos, piezas finales, reels editados y material en bruto del cliente.')}
    <p class="small muted mt">Los archivos se guardan en este navegador. Para material pesado o compartido con el cliente, usá el link de Drive en "Identidad de marca".</p>`;
  items.forEach((m) => fillThumb($(`[data-th="${m.id}"]`, body), m.id));
  const extra = () => (ui.mediaProject ? { projectId: ui.mediaProject } : {});
  $('#upl', body).onchange = async (e) => { await uploadFiles([...e.target.files], c.id, extra()); rerender(); };
  const drop = $('#drop', body);
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('on'); };
  drop.ondragleave = () => drop.classList.remove('on');
  drop.ondrop = async (e) => { e.preventDefault(); drop.classList.remove('on'); await uploadFiles([...e.dataTransfer.files], c.id, extra()); rerender(); };
  $$('[data-mf]', body).forEach((b) => (b.onclick = () => { ui.mediaFilter = b.dataset.mf; rerender(); }));
  $('#mp', body).onchange = (e) => { ui.mediaProject = e.target.value; rerender(); };
  $('#mq', body).onchange = (e) => { ui.mediaQuery = e.target.value; rerender(); };
  $$('[data-media]', body).forEach((el) => (el.onclick = () => mediaDetail(store.get('media', el.dataset.media), c, rerender)));
}

async function mediaDetail(m, c, rerender) {
  const url = await mediaDB.url(m.id);
  const usedIn = store.byClient('posts', c.id).filter((p) => (p.mediaIds || []).includes(m.id));
  const fields = [
    { k: 'name', label: 'Nombre' },
    { k: 'projectId', label: 'Proyecto', type: 'select', options: store.byClient('projects', c.id).map((p) => ({ v: p.id, l: p.name })) },
    { k: 'tags', label: 'Etiquetas', full: true, placeholder: 'producto, verano, crudo, final…' },
  ];
  const md = openModal({
    title: m.name, wide: true,
    body: `<div class="media-detail"><div class="md-preview">${m.type?.startsWith('video') ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="">`}</div>
      <div><div id="mdForm"></div><p class="small muted">${(m.size / 1048576).toFixed(2)} MB · ${esc(m.type)}</p>
      ${usedIn.length ? `<p class="small">Usado en: ${usedIn.map((p) => `${fmtDate(p.date)} ${esc(p.title || p.format || '')}`).join(', ')}</p>` : ''}</div></div>`,
    footer: `<button class="btn danger ghost" id="mdDel">Eliminar</button><span class="spacer"></span><a class="btn ghost" href="${url}" download="${esc(m.name)}">⬇ Descargar</a><button class="btn ghost" id="mdPost">＋ Crear publicación</button><button class="btn primary" id="mdSave">Guardar</button>`,
  });
  const { formHTML, readForm } = await import('./ui.js');
  $('#mdForm', md.el).innerHTML = formHTML(fields, m);
  $('#mdSave', md.el).onclick = () => { store.upsert('media', { ...m, ...readForm(md.el, fields) }); md.close(); rerender(); };
  $('#mdDel', md.el).onclick = async () => {
    if (!confirmBox('¿Eliminar el archivo?')) return;
    await mediaDB.del(m.id); store.remove('media', m.id);
    usedIn.forEach((p) => store.upsert('posts', { ...p, mediaIds: p.mediaIds.filter((x) => x !== m.id) }));
    md.close(); rerender();
  };
  $('#mdPost', md.el).onclick = () => { md.close(); postModal(null, { clientId: c.id, date: todayISO(), mediaIds: [m.id], format: m.type?.startsWith('video') ? 'Reel' : 'Post estático' }, rerender); };
}

// =============== ANÁLISIS DE CONTENIDO ===============
const er = (a) => {
  const inter = ['likes', 'comments', 'shares', 'saves'].reduce((s, k) => s + (Number(a[k]) || 0), 0);
  const base = Number(a.reach) || Number(a.views) || 0;
  return base ? (inter / base) * 100 : 0;
};
function topAnalyses(clientId, n) { return store.byClient('analyses', clientId).sort((a, b) => er(b) - er(a)).slice(0, n); }

const analysisFields = [
  { k: 'title', label: 'Contenido / tema', required: true, full: true },
  { k: 'date', label: 'Fecha de publicación', type: 'date' },
  { k: 'network', label: 'Red', type: 'select', options: NETWORKS },
  { k: 'format', label: 'Formato', type: 'select', options: FORMATS },
  { k: 'link', label: 'Link', full: true },
  { k: 'reach', label: 'Alcance', type: 'number' },
  { k: 'views', label: 'Reproducciones / impresiones', type: 'number' },
  { k: 'likes', label: 'Me gusta', type: 'number' },
  { k: 'comments', label: 'Comentarios', type: 'number' },
  { k: 'shares', label: 'Compartidos', type: 'number' },
  { k: 'saves', label: 'Guardados', type: 'number' },
  { k: 'followers', label: 'Seguidores ganados', type: 'number' },
  { k: 'retention', label: 'Retención promedio (%) / tiempo de reproducción', type: 'number' },
  { k: 'hook', label: 'Gancho usado', full: true },
  { k: 'whyWorked', label: '¿Por qué funcionó (o no)? Aprendizajes', type: 'textarea', rows: 3 },
];

function analisis(body, c, rerender) {
  const list = store.byClient('analyses', c.id).sort((a, b) => er(b) - er(a));
  const byFormat = Object.entries(list.reduce((acc, a) => { const k = a.format || '—'; (acc[k] = acc[k] || []).push(er(a)); return acc; }, {}))
    .map(([label, arr]) => ({ label, value: arr.reduce((s, v) => s + v, 0) / arr.length, display: (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2) + '% · ' + arr.length }))
    .sort((a, b) => b.value - a.value);
  const avgER = list.length ? list.reduce((s, a) => s + er(a), 0) / list.length : 0;
  body.innerHTML = `
    <div class="section-head"><h2>Análisis de contenido</h2>
      <div class="row gap">${c.igId ? '<button class="btn ghost" id="igImport">⬇ Importar de Instagram</button>' : ''}${list.length ? '<button class="btn ghost" id="aiAnal">✨ ¿Qué está funcionando?</button>' : ''}<button class="btn primary" id="newAn">＋ Registrar contenido</button></div></div>
    ${!c.igId ? '<p class="small muted">Tip: cargá el ID de Instagram del cliente en "Métricas y Meta Ads" para importar publicaciones automáticamente.</p>' : ''}
    ${list.length ? `
    <section class="kpis">
      <div class="kpi"><span>Contenidos analizados</span><strong>${list.length}</strong></div>
      <div class="kpi"><span>Engagement promedio</span><strong>${avgER.toFixed(2)}%</strong><small>(interacciones / alcance)</small></div>
      <div class="kpi"><span>Mejor formato</span><strong class="sm">${esc(byFormat[0]?.label || '—')}</strong></div>
      <div class="kpi"><span>Alcance total</span><strong>${fmtNum(list.reduce((s, a) => s + (Number(a.reach) || 0), 0))}</strong></div>
    </section>
    <div class="grid-2">
      <section class="card"><h4>🏆 Top 5 por engagement</h4><ol class="top">${list.slice(0, 5).map((a) => `<li data-an="${a.id}" class="clickable"><strong>${esc(a.title)}</strong><small>${esc(a.format || '')} · ${er(a).toFixed(2)}% ER · ${fmtNum(a.reach)} alcance</small>${a.whyWorked ? `<p class="small muted">${esc(a.whyWorked)}</p>` : ''}</li>`).join('')}</ol></section>
      <section class="card"><h4>Engagement promedio por formato</h4>${barList(byFormat)}</section>
    </div>
    <section class="card table-wrap"><table class="table">
      <thead><tr><th>Contenido</th><th>Fecha</th><th>Formato</th><th>Alcance</th><th>Likes</th><th>Coment.</th><th>Compart.</th><th>Guard.</th><th>ER</th></tr></thead>
      <tbody>${list.map((a) => `<tr class="clickable" data-an="${a.id}"><td>${a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a> ` : ''}${esc(a.title)}</td><td>${fmtDate(a.date)}</td><td>${esc(a.format || '')}</td><td>${fmtNum(a.reach)}</td><td>${fmtNum(a.likes)}</td><td>${fmtNum(a.comments)}</td><td>${fmtNum(a.shares)}</td><td>${fmtNum(a.saves)}</td><td><b class="${er(a) >= avgER ? 'ok-text' : ''}">${er(a).toFixed(2)}%</b></td></tr>`).join('')}</tbody>
    </table></section>` : emptyState('📈', 'Registrá los contenidos que publicaste con sus métricas para descubrir qué formatos, temas y ganchos funcionan mejor.')}`;
  const modal = (a) => formModal({
    title: a ? 'Editar análisis' : 'Registrar contenido', fields: analysisFields, values: a || { date: todayISO(), network: 'Instagram', format: 'Reel' }, wide: true,
    onSave(v) { store.upsert('analyses', { ...(a || {}), ...v, clientId: c.id }); toast('Guardado'); rerender(); },
    onDelete: a ? () => { store.remove('analyses', a.id); rerender(); } : null,
  });
  $('#newAn').onclick = () => modal();
  $$('[data-an]', body).forEach((el) => (el.onclick = () => modal(store.get('analyses', el.dataset.an))));
  $('#aiAnal') && ($('#aiAnal').onclick = () => aiModal({
    title: '¿Qué está funcionando?',
    prompt: `${clientContext(c)}\n\nContenidos publicados con métricas (ER = interacciones/alcance):\n${list.slice(0, 40).map((a) => `- [${a.format}] "${a.title}" | gancho: ${a.hook || '-'} | alcance ${a.reach || '?'} | likes ${a.likes || 0} | coment ${a.comments || 0} | compart ${a.shares || 0} | guard ${a.saves || 0} | ER ${er(a).toFixed(2)}% | notas: ${a.whyWorked || '-'}`).join('\n')}\n\nAnalizá patrones: qué formatos, temas, ganchos y tipos de contenido rinden mejor y peor. Dame 5 conclusiones accionables y 5 ideas de próximos contenidos que repliquen lo que funciona.`,
  }));
  $('#igImport') && ($('#igImport').onclick = async () => {
    const btn = $('#igImport'); btn.disabled = true; btn.textContent = 'Importando…';
    try {
      const { meta } = await import('./integrations.js');
      const media = await meta.igMedia(c.igId, 30);
      const existing = new Set(store.byClient('analyses', c.id).map((a) => a.igMediaId));
      let n = 0;
      const fmtMap = { VIDEO: 'Reel', CAROUSEL_ALBUM: 'Carrusel', IMAGE: 'Post estático' };
      media.forEach((m) => {
        const prev = store.byClient('analyses', c.id).find((a) => a.igMediaId === m.id);
        const rec = {
          ...(prev || {}), clientId: c.id, igMediaId: m.id, network: 'Instagram',
          title: prev?.title || (m.caption || '').split('\n')[0].slice(0, 90) || 'Publicación de Instagram',
          date: m.timestamp?.slice(0, 10), link: m.permalink,
          format: m.media_product_type === 'REELS' ? 'Reel' : fmtMap[m.media_type] || 'Post estático',
          likes: m.like_count ?? '', comments: m.comments_count ?? '', reach: m.reach ?? '', saves: m.saved ?? '', shares: m.shares ?? '', views: m.views ?? '',
        };
        store.upsert('analyses', rec);
        if (!existing.has(m.id)) n++;
      });
      toast(`${n} publicaciones nuevas importadas, ${media.length - n} actualizadas`);
      rerender();
    } catch (e) { toast(e.message, 'err'); btn.disabled = false; btn.textContent = '⬇ Importar de Instagram'; }
  });
}

// =============== MÉTRICAS Y META ADS ===============
const metricFields = [
  { k: 'month', label: 'Mes', type: 'month', required: true },
  { k: 'network', label: 'Red', type: 'select', options: NETWORKS, allowEmpty: false },
  { k: 'followers', label: 'Seguidores (fin de mes)', type: 'number' },
  { k: 'reach', label: 'Alcance', type: 'number' },
  { k: 'impressions', label: 'Impresiones / visualizaciones', type: 'number' },
  { k: 'interactions', label: 'Interacciones totales', type: 'number' },
  { k: 'profileVisits', label: 'Visitas al perfil', type: 'number' },
  { k: 'linkClicks', label: 'Clics en el link', type: 'number' },
  { k: 'messages', label: 'Mensajes / consultas', type: 'number' },
  { k: 'posts', label: 'Publicaciones del mes', type: 'number' },
  { k: 'notes', label: 'Notas / contexto del mes', type: 'textarea', rows: 2 },
];

function latestFollowers(clientId) {
  const m = store.byClient('metrics', clientId).filter((x) => x.followers).sort((a, b) => b.month.localeCompare(a.month));
  return m[0] ? Number(m[0].followers) : 0;
}

function metricas(body, c, rerender) {
  const net = ui.metricNet || 'Instagram';
  const rows = store.byClient('metrics', c.id).filter((m) => m.network === net).sort((a, b) => a.month.localeCompare(b.month));
  const labels = rows.map((r) => { const [y, m] = r.month.split('-'); return MONTHS[m - 1].slice(0, 3) + ' ' + y.slice(2); });
  const growth = (i, k) => (i > 0 && rows[i - 1][k] ? (((rows[i][k] - rows[i - 1][k]) / rows[i - 1][k]) * 100) : null);
  const strat = c.strategy || {};
  body.innerHTML = `
    ${store.settings().metaToken ? '' : metaConnectCard()}
    <section class="card">
      <div class="card-head"><div><h2>Cuentas conectadas</h2><div class="conns mt-s">${connectedChips(c)}</div></div>
        <div class="row gap wrap"><button class="btn ghost" id="metaIds">🔗 ${c.igId || c.fbPageId || c.adAccountId ? 'Cambiar cuentas' : 'Conectar cuentas'}</button>
        ${c.igId || c.fbPageId || c.adAccountId ? '<button class="btn primary" id="syncMonth">⟳ Actualizar mes desde Meta</button>' : ''}</div></div>
    </section>
    <div class="section-head"><h2>¿Qué mejoró este mes?</h2><div class="toolbar no-mb">${monthNav(ui.month)}<span class="muted small">vs. ${MONTHS[Number(prevMonth(ui.month).slice(5)) - 1]}</span></div></div>
    <div class="grid-2">
      <section class="card"><h4>📸 Instagram</h4>${improvementCards(c.id, 'Instagram', ui.month)}</section>
      <section class="card"><h4>👍 Facebook</h4>${improvementCards(c.id, 'Facebook', ui.month)}</section>
      <section class="card"><h4>📣 Meta Ads</h4>${improvementCards(c.id, 'Meta Ads', ui.month)}</section>
      <section class="card"><div class="card-head"><h4>🎯 Estrategia</h4><a class="link small" href="#/cliente/${c.id}/estrategia">Ver / editar →</a></div>
        ${strat.objective ? `<p><b>Objetivo:</b> ${esc(strat.objective)}</p>${strat.kpis ? `<p class="small"><b>KPIs:</b> ${esc(strat.kpis)}</p>` : ''}${strat.frequency ? `<p class="small"><b>Frecuencia:</b> ${esc(strat.frequency)}</p>` : ''}` : '<p class="muted small">Cargá la estrategia para comparar los resultados con el objetivo.</p>'}</section>
    </div>
    <div class="section-head mt"><h2>Métricas orgánicas mensuales</h2>
      <div class="row gap"><select id="mNet">${NETWORKS.map((n) => `<option ${n === net ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${c.igId && net === 'Instagram' ? '<button class="btn ghost" id="igPull">⬇ Traer seguidores de IG</button>' : ''}
      <button class="btn ghost" id="aiReport">✨ Redactar informe</button><button class="btn primary" id="newMetric">＋ Cargar mes</button></div></div>
    ${rows.length ? `
      <div class="grid-2">
        <section class="card"><h4>Seguidores</h4>${lineChart(labels, [{ name: 'Seguidores', color: '#E891AA', values: rows.map((r) => r.followers) }])}</section>
        <section class="card"><h4>Alcance e interacciones</h4>${lineChart(labels, [{ name: 'Alcance', color: '#7FA7E0', values: rows.map((r) => r.reach) }, { name: 'Interacciones', color: '#9AD6B9', values: rows.map((r) => r.interactions) }])}</section>
      </div>
      <section class="card table-wrap"><table class="table"><thead><tr><th>Mes</th><th>Seguidores</th><th>Crec.</th><th>Alcance</th><th>Impresiones</th><th>Interacc.</th><th>ER</th><th>Visitas</th><th>Clics</th><th>Mensajes</th><th>Posts</th></tr></thead>
      <tbody>${rows.map((r, i) => { const g = growth(i, 'followers'); return `<tr class="clickable" data-met="${r.id}"><td>${labels[i]}</td><td>${fmtNum(r.followers)}</td><td class="${g > 0 ? 'ok-text' : g < 0 ? 'err-text' : ''}">${g == null ? '—' : (g > 0 ? '+' : '') + g.toFixed(1) + '%'}</td><td>${fmtNum(r.reach)}</td><td>${fmtNum(r.impressions)}</td><td>${fmtNum(r.interactions)}</td><td>${r.reach && r.interactions ? ((r.interactions / r.reach) * 100).toFixed(2) + '%' : '—'}</td><td>${fmtNum(r.profileVisits)}</td><td>${fmtNum(r.linkClicks)}</td><td>${fmtNum(r.messages)}</td><td>${fmtNum(r.posts)}</td></tr>`; }).join('')}</tbody></table></section>`
      : emptyState('📊', `Cargá las métricas de ${net} de cada mes para ver la evolución.`)}
    <div class="section-head mt"><h2>Meta Ads</h2>
      <div class="row gap"><select id="adPreset">${[['today', 'Hoy'], ['yesterday', 'Ayer'], ['last_7d', 'Últimos 7 días'], ['last_14d', 'Últimos 14 días'], ['last_30d', 'Últimos 30 días'], ['this_month', 'Este mes'], ['last_month', 'Mes pasado'], ['last_90d', 'Últimos 90 días']].map(([v, l]) => `<option value="${v}" ${v === (ui.adPreset || 'last_30d') ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn primary" id="adLoad" ${c.adAccountId ? '' : 'disabled'}>Cargar datos de Ads</button></div></div>
    <div id="adsBody">${c.adAccountId ? '<p class="muted small">Elegí el período y tocá "Cargar datos de Ads".</p>' : emptyState('📣', 'Configurá el ID de la cuenta publicitaria para ver gasto, resultados y campañas.')}</div>`;

  $('#mNet', body).onchange = (e) => { ui.metricNet = e.target.value; rerender(); };
  const modal = (r) => formModal({
    title: r ? 'Editar métricas' : 'Cargar métricas del mes', fields: metricFields, values: r || { month: todayISO().slice(0, 7), network: net }, wide: true,
    onSave(v) {
      const dup = store.byClient('metrics', c.id).find((x) => x.month === v.month && x.network === v.network && x.id !== r?.id);
      store.upsert('metrics', { ...(dup || r || {}), ...v, clientId: c.id });
      toast('Métricas guardadas'); rerender();
    },
    onDelete: r ? () => { store.remove('metrics', r.id); rerender(); } : null,
  });
  $('#newMetric', body).onclick = () => modal();
  $$('[data-met]', body).forEach((el) => (el.onclick = () => modal(store.get('metrics', el.dataset.met))));
  $('#metaIds', body).onclick = () => connectAccountsModal(c, rerender);
  bindMetaConnect(body, rerender);
  $$('[data-mnav]', body).forEach((b) => (b.onclick = () => { ui.month = shiftMonth(ui.month, Number(b.dataset.mnav)); rerender(); }));
  $('#syncMonth', body) && ($('#syncMonth', body).onclick = async (e) => {
    e.target.disabled = true; e.target.textContent = 'Actualizando…';
    const r = await syncClientMonth(c, ui.month);
    if (r.failed.length) toast(r.failed.join(' · '), 'err'); else toast('✓ Actualizado: ' + r.done.join(', '));
    rerender();
  });
  $('#igPull', body) && ($('#igPull', body).onclick = async () => {
    try {
      const { meta } = await import('./integrations.js');
      const p = await meta.igProfile(c.igId);
      const month = todayISO().slice(0, 7);
      const ex = store.byClient('metrics', c.id).find((x) => x.month === month && x.network === 'Instagram');
      store.upsert('metrics', { ...(ex || {}), clientId: c.id, month, network: 'Instagram', followers: p.followers_count });
      toast(`@${p.username}: ${fmtNum(p.followers_count)} seguidores guardados en ${month}`); rerender();
    } catch (e) { toast(e.message, 'err'); }
  });
  $('#aiReport', body).onclick = () => aiModal({
    title: 'Informe mensual',
    prompt: `${clientContext(c)}\n\nMétricas mensuales de ${net}:\n${rows.map((r) => `${r.month}: seguidores ${r.followers || '?'}, alcance ${r.reach || '?'}, impresiones ${r.impressions || '?'}, interacciones ${r.interactions || '?'}, visitas ${r.profileVisits || '?'}, clics ${r.linkClicks || '?'}, mensajes ${r.messages || '?'}, posts ${r.posts || '?'}. ${r.notes || ''}`).join('\n') || '(sin datos)'}\n\nTop contenidos:\n${topAnalyses(c.id, 5).map((a) => `- ${a.title} (${a.format}) ER ${er(a).toFixed(2)}%`).join('\n') || '(sin datos)'}\n\nRedactá un informe mensual para enviarle al cliente: resumen ejecutivo, resultados vs. mes anterior, contenidos destacados, aprendizajes y próximos pasos. Tono profesional y cercano, claro para alguien que no es experto en marketing.`,
  });
  $('#adPreset', body).onchange = (e) => (ui.adPreset = e.target.value);
  $('#adLoad', body).onclick = () => loadAds(c, $('#adsBody', body));
}

async function loadAds(c, box) {
  const preset = ui.adPreset || 'last_30d';
  box.innerHTML = '<p class="loading">Consultando Meta Ads…</p>';
  try {
    const { meta, actionValue } = await import('./integrations.js');
    const [ins, daily, camps] = await Promise.all([
      meta.accountInsights(c.adAccountId, preset), meta.dailyInsights(c.adAccountId, preset), meta.campaigns(c.adAccountId, preset),
    ]);
    if (!ins) { box.innerHTML = emptyState('📣', 'No hay datos de anuncios en este período.'); return; }
    const results = {
      'Mensajes iniciados': actionValue(ins.actions, ['onsite_conversion.messaging_conversation_started_7d']),
      'Leads': actionValue(ins.actions, ['lead', 'onsite_conversion.lead_grouped']),
      'Compras': actionValue(ins.actions, ['purchase', 'omni_purchase']),
      'Clics en el enlace': actionValue(ins.actions, ['link_click']),
      'Interacciones': actionValue(ins.actions, ['post_engagement']),
      'Reproducciones de video': actionValue(ins.actions, ['video_view']),
    };
    const resultsHTML = Object.entries(results).filter(([, v]) => v).map(([k, v]) => `<div class="kpi"><span>${k}</span><strong>${fmtNum(v)}</strong><small>${ins.spend && v ? 'costo ' + fmtMoney(ins.spend / v) + ' c/u' : ''}</small></div>`).join('');
    const active = camps.filter((x) => x.insights?.data?.[0]);
    box.innerHTML = `
      <section class="kpis">
        <div class="kpi"><span>Gasto</span><strong>${fmtMoney(ins.spend)}</strong></div>
        <div class="kpi"><span>Alcance</span><strong>${fmtNum(ins.reach)}</strong><small>frecuencia ${fmtNum(ins.frequency)}</small></div>
        <div class="kpi"><span>Impresiones</span><strong>${fmtNum(ins.impressions)}</strong><small>CPM ${fmtMoney(ins.cpm)}</small></div>
        <div class="kpi"><span>Clics</span><strong>${fmtNum(ins.clicks)}</strong><small>CTR ${fmtNum(ins.ctr)}% · CPC ${fmtMoney(ins.cpc)}</small></div>
      </section>
      ${resultsHTML ? `<section class="kpis">${resultsHTML}</section>` : ''}
      <section class="card"><h4>Gasto y clics por día</h4>${lineChart(daily.map((d) => fmtDate(d.date_start)), [{ name: 'Gasto', color: '#E891AA', values: daily.map((d) => Number(d.spend)) }, { name: 'Clics', color: '#7FA7E0', values: daily.map((d) => Number(d.clicks)) }])}</section>
      <section class="card table-wrap"><h4>Campañas con actividad (${active.length} de ${camps.length})</h4>
        <table class="table"><thead><tr><th>Campaña</th><th>Estado</th><th>Objetivo</th><th>Gasto</th><th>Alcance</th><th>Clics</th><th>CTR</th><th>CPC</th></tr></thead>
        <tbody>${active.sort((a, b) => b.insights.data[0].spend - a.insights.data[0].spend).map((x) => { const i = x.insights.data[0]; return `<tr><td>${esc(x.name)}</td><td><span class="badge soft">${esc(x.status)}</span></td><td class="small">${esc(String(x.objective || '').replace('OUTCOME_', ''))}</td><td>${fmtMoney(i.spend)}</td><td>${fmtNum(i.reach)}</td><td>${fmtNum(i.clicks)}</td><td>${fmtNum(i.ctr)}%</td><td>${fmtMoney(i.cpc)}</td></tr>`; }).join('') || '<tr><td colspan="8" class="muted">Sin campañas con gasto en este período.</td></tr>'}</tbody></table>
      </section>
      <p class="small muted">Montos en la moneda de la cuenta publicitaria. Datos en vivo desde la API de Marketing de Meta.</p>`;
  } catch (e) { box.innerHTML = `<p class="err-text">${esc(e.message)}</p>`; }
}

// =============== IA (modal compartido) ===============
function clientContext(c) {
  return `Datos de la marca:\n${brandContextInline(c)}`;
}
function brandContextInline(c) {
  const b = c.brand || {}, s = c.strategy || {};
  return [
    `Marca: ${c.name}`, c.industry && `Rubro: ${c.industry}`, b.audience && `Público: ${b.audience}`, b.tone && `Tono de voz: ${b.tone}`,
    b.values && `Diferenciales: ${b.values}`, b.dosDonts && `Qué sí / no decir: ${b.dosDonts}`, s.objective && `Objetivo: ${s.objective}`,
    s.pillars && `Pilares: ${s.pillars.replace(/\n/g, '; ')}`, s.persona && `Buyer persona: ${s.persona}`,
  ].filter(Boolean).join('\n');
}

function aiModal({ title, prompt, onUse, keepOpen }) {
  const m = openModal({
    title: '✨ ' + title, wide: true,
    body: `<details class="small"><summary>Ver / editar instrucciones para la IA</summary><textarea id="aiPrompt" rows="8">${esc(prompt)}</textarea></details><div id="aiOut" class="ai-out"><p class="loading">Generando…</p></div>`,
    footer: `<span class="spacer"></span><button class="btn ghost" id="aiRetry">Regenerar</button><button class="btn ghost" id="aiCopy">Copiar</button>${onUse ? '<button class="btn primary" id="aiUse">Usar</button>' : ''}<button class="btn ghost" data-close>Cerrar</button>`,
  });
  let result = '';
  const run = async () => {
    const out = $('#aiOut', m.el);
    out.innerHTML = '<p class="loading">Generando…</p>';
    try {
      const { askClaude } = await import('./integrations.js');
      result = await askClaude($('#aiPrompt', m.el).value, { maxTokens: 8000 });
      out.innerHTML = `<div class="pre">${esc(result)}</div>`;
    } catch (e) { out.innerHTML = `<p class="err-text">${esc(e.message)}</p>${/API key/.test(e.message) ? '<p><a href="#/ajustes" data-close>Ir a Ajustes</a></p>' : ''}`; $$('[data-close]', out).forEach((a) => (a.onclick = m.close)); }
  };
  $('#aiRetry', m.el).onclick = run;
  $('#aiCopy', m.el).onclick = () => { navigator.clipboard.writeText(result); toast('Copiado'); };
  $('#aiUse', m.el) && ($('#aiUse', m.el).onclick = () => { onUse(result); if (!keepOpen) m.close(); });
  run();
}
