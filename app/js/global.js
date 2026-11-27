// Secciones generales: Banco de ideas (todos los clientes) y Métricas (todos los clientes),
// más la conexión de cuentas de Meta por cliente y la sincronización mensual.
import { store } from './store.js';
import {
  esc, $, $$, toast, formModal, openModal, emptyState, FORMATS, NETWORKS, MONTHS, fmtNum, fmtMoney, todayISO,
} from './ui.js';
import { avatar, monthNav, shiftMonth } from './app.js';
import { postModal, ideaFields, generateIdeas } from './client.js';

const st = { month: todayISO().slice(0, 7), ideaClient: '', ideaQ: '' };
const monthLabel = (m) => { const [y, mm] = m.split('-'); return `${MONTHS[mm - 1]} ${y}`; };
export const prevMonth = (m) => shiftMonth(m, -1);

// ---------- Comparación mes vs. mes anterior ----------
export function metricFor(clientId, network, month) {
  return store.byClient('metrics', clientId).find((x) => x.network === network && x.month === month);
}

export function delta(cur, prev, { inverse = false } = {}) {
  if (cur === '' || cur == null || prev === '' || prev == null || !Number(prev)) return '';
  const d = ((Number(cur) - Number(prev)) / Number(prev)) * 100;
  if (!isFinite(d)) return '';
  const good = inverse ? d < 0 : d > 0;
  const cls = Math.abs(d) < 0.05 ? 'flat' : good ? 'up' : 'down';
  return `<span class="delta ${cls}">${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${Math.abs(d).toFixed(1)}%</span>`;
}

const erOf = (r) => (r && Number(r.reach) && r.interactions !== '' && r.interactions != null ? (Number(r.interactions) / Number(r.reach)) * 100 : null);

// Tarjetas de "qué mejoró" para una red en un mes.
export function improvementCards(clientId, network, month) {
  const cur = metricFor(clientId, network, month);
  const prev = metricFor(clientId, network, prevMonth(month));
  if (!cur) return `<p class="muted small">Sin datos de ${esc(network)} en ${monthLabel(month)}.</p>`;
  if (network === 'Meta Ads') {
    const cpr = (r) => (r && r.results ? r.spend / r.results : null);
    const items = [
      ['Inversión', fmtMoney(cur.spend), delta(cur.spend, prev?.spend)],
      ['Resultados', fmtNum(cur.results), delta(cur.results, prev?.results)],
      ['Costo por resultado', cpr(cur) ? fmtMoney(cpr(cur)) : '—', delta(cpr(cur), cpr(prev), { inverse: true })],
      ['Alcance', fmtNum(cur.reach), delta(cur.reach, prev?.reach)],
      ['Clics', fmtNum(cur.clicks), delta(cur.clicks, prev?.clicks)],
      ['CTR', cur.ctr ? fmtNum(cur.ctr) + '%' : '—', delta(cur.ctr, prev?.ctr)],
    ];
    return `<div class="imp-grid">${items.map(([l, v, d]) => `<div class="imp"><span>${l}</span><strong>${v}</strong>${d || '<span class="delta flat">—</span>'}</div>`).join('')}</div>`;
  }
  const items = [
    ['Seguidores', fmtNum(cur.followers), delta(cur.followers, prev?.followers), prev?.followers && cur.followers ? `${cur.followers - prev.followers >= 0 ? '+' : ''}${fmtNum(cur.followers - prev.followers)}` : ''],
    ['Alcance', fmtNum(cur.reach), delta(cur.reach, prev?.reach)],
    ['Interacciones', fmtNum(cur.interactions), delta(cur.interactions, prev?.interactions)],
    ['Engagement', erOf(cur) != null ? erOf(cur).toFixed(2) + '%' : '—', delta(erOf(cur), erOf(prev))],
    ['Visitas al perfil', fmtNum(cur.profileVisits), delta(cur.profileVisits, prev?.profileVisits)],
    ['Publicaciones', fmtNum(cur.posts), delta(cur.posts, prev?.posts)],
  ];
  return `<div class="imp-grid">${items.map(([l, v, d, extra]) => `<div class="imp"><span>${l}</span><strong>${v}</strong>${d || '<span class="delta flat">—</span>'}${extra ? `<small>${extra}</small>` : ''}</div>`).join('')}</div>`;
}

// ---------- Conectar cuentas de un cliente ----------
export function connectedChips(c) {
  const chip = (on, label) => `<span class="conn ${on ? 'on' : ''}">${on ? '✓' : '○'} ${label}</span>`;
  return chip(c.igId, 'Instagram') + chip(c.fbPageId, 'Facebook') + chip(c.adAccountId, 'Meta Ads');
}

export async function connectAccountsModal(c, after) {
  const m = openModal({
    title: `Conectar cuentas de ${c.name}`, wide: true,
    body: '<p class="loading">Buscando tus páginas, cuentas de Instagram y cuentas publicitarias…</p>',
    footer: '<span class="spacer"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="caSave" disabled>Guardar</button>',
  });
  const body = $('.modal-body', m.el);
  let pages = [], acts = [], err = '';
  try {
    if (!store.settings().metaToken) throw new Error('Primero conectá tu cuenta de Facebook en Métricas o en Ajustes.');
    const { meta } = await import('./integrations.js');
    meta.resetCache();
    [pages, acts] = await Promise.all([meta.pages(), meta.adAccounts().then((r) => r.data || []).catch(() => [])]);
  } catch (e) { err = e.message; }
  const igs = pages.filter((p) => p.instagram_business_account).map((p) => ({ ...p.instagram_business_account, page: p.name }));
  body.innerHTML = `
    ${err ? `<p class="err-text">${esc(err)}</p><p class="small muted">Podés cargar los IDs a mano igual.</p>` : '<p class="small muted">Elegí las cuentas de este cliente. Solo aparecen las que administra tu usuario de Facebook.</p>'}
    <div class="form-grid">
      <div class="field full"><label>Página de Facebook</label>
        <select id="caPage"><option value="">— Sin página —</option>${pages.map((p) => `<option value="${esc(p.id)}" ${p.id === c.fbPageId ? 'selected' : ''}>${esc(p.name)}${p.followers_count != null ? ` (${fmtNum(p.followers_count)} seguidores)` : ''}</option>`).join('')}</select></div>
      <div class="field full"><label>Instagram</label>
        <select id="caIg"><option value="">— Sin Instagram —</option>${igs.map((i) => `<option value="${esc(i.id)}" ${i.id === c.igId ? 'selected' : ''}>@${esc(i.username)} (${fmtNum(i.followers_count)} seguidores)</option>`).join('')}</select></div>
      <div class="field full"><label>Cuenta publicitaria (Meta Ads)</label>
        <select id="caAct"><option value="">— Sin cuenta publicitaria —</option>${acts.map((a) => `<option value="${esc(a.id)}" ${a.id === c.adAccountId || a.id === 'act_' + String(c.adAccountId || '').replace(/^act_/, '') ? 'selected' : ''}>${esc(a.name)} (${esc(a.id)})</option>`).join('')}</select></div>
    </div>
    <details class="mt-s"><summary class="small">Cargar IDs a mano</summary>
      <div class="form-grid">
        <div class="field"><label>ID página de Facebook</label><input id="caPageM" value="${esc(c.fbPageId || '')}"></div>
        <div class="field"><label>ID Instagram Business</label><input id="caIgM" value="${esc(c.igId || '')}"></div>
        <div class="field full"><label>ID cuenta publicitaria</label><input id="caActM" value="${esc(c.adAccountId || '')}" placeholder="act_123…"></div>
      </div></details>`;
  // Al elegir la página, se completa su Instagram vinculado.
  $('#caPage', body).onchange = (e) => {
    const p = pages.find((x) => x.id === e.target.value);
    if (p?.instagram_business_account) $('#caIg', body).value = p.instagram_business_account.id;
  };
  const save = $('#caSave', m.el);
  save.disabled = false;
  save.onclick = () => {
    const pick = (sel, manual) => $(sel, body).value || $(manual, body).value.trim();
    const fbPageId = pick('#caPage', '#caPageM');
    const igId = pick('#caIg', '#caIgM');
    const adAccountId = pick('#caAct', '#caActM');
    const ig = igs.find((i) => i.id === igId);
    store.upsert('clients', { ...c, fbPageId, igId, adAccountId, igUsername: ig?.username || c.igUsername || '' });
    toast('Cuentas conectadas');
    m.close();
    after && after();
  };
}

// ---------- Sincronizar un mes desde Meta ----------
export async function syncClientMonth(c, month) {
  const { meta } = await import('./integrations.js');
  const done = [], failed = [];
  const save = (network, data) => {
    const ex = metricFor(c.id, network, month);
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined && v !== null));
    store.upsert('metrics', { ...(ex || {}), ...clean, clientId: c.id, month, network, synced: Date.now() });
  };
  const jobs = [];
  if (c.igId) jobs.push(meta.igMonth(c.igId, month).then((d) => { save('Instagram', d); done.push('Instagram'); }).catch((e) => failed.push(`Instagram: ${e.message}`)));
  if (c.fbPageId) jobs.push(meta.fbMonth(c.fbPageId, month).then((d) => { save('Facebook', d); done.push('Facebook'); }).catch((e) => failed.push(`Facebook: ${e.message}`)));
  if (c.adAccountId) jobs.push(meta.adsMonth(c.adAccountId, month).then((d) => { save('Meta Ads', d); done.push('Meta Ads'); }).catch((e) => failed.push(`Meta Ads: ${e.message}`)));
  await Promise.all(jobs);
  return { done, failed };
}

export function metaConnectCard(onDone) {
  const s = store.settings();
  const ago = s.metaTokenAt ? Math.round((Date.now() - s.metaTokenAt) / 60000) : null;
  return `<section class="card connect-card">
    <div class="row between wrap gap">
      <div><h2>Conexión con Meta</h2>
        <p class="small muted">${s.metaToken ? `✓ Conectada${ago != null ? ` (hace ${ago < 60 ? ago + ' min' : Math.round(ago / 60) + ' h'})` : ''}. Si algo falla por token vencido, volvé a conectar.` : 'Conectá tu Facebook para traer Instagram, páginas y Meta Ads de tus clientes.'}</p></div>
      <div class="row gap">
        ${s.metaAppId ? '<button class="btn primary" data-fblogin>f Conectar con Facebook</button>' : '<a class="btn primary" href="#/ajustes">Configurar conexión</a>'}
      </div>
    </div></section>`;
}

export function bindMetaConnect(root, onDone) {
  $$('[data-fblogin]', root).forEach((b) => (b.onclick = async () => {
    try {
      const { metaLogin, meta } = await import('./integrations.js');
      await metaLogin();
      meta.resetCache();
      toast('Facebook conectado ✓');
      onDone && onDone();
    } catch (e) { toast(e.message, 'err'); }
  }));
}

// =============== MÉTRICAS (todos los clientes) ===============
export function renderMetricsHub(main) {
  const rerender = () => renderMetricsHub(main);
  const clients = store.all('clients').filter((c) => c.status !== 'finalizado').sort((a, b) => a.name.localeCompare(b.name));
  const month = st.month, pm = prevMonth(month);
  const igCur = (c) => metricFor(c.id, 'Instagram', month), igPrev = (c) => metricFor(c.id, 'Instagram', pm);
  const fbCur = (c) => metricFor(c.id, 'Facebook', month), fbPrev = (c) => metricFor(c.id, 'Facebook', pm);
  const adCur = (c) => metricFor(c.id, 'Meta Ads', month), adPrev = (c) => metricFor(c.id, 'Meta Ads', pm);
  const improved = clients.filter((c) => igCur(c)?.followers && igPrev(c)?.followers && igCur(c).followers > igPrev(c).followers).length;
  const spend = clients.reduce((s, c) => s + (Number(adCur(c)?.spend) || 0), 0);
  const results = clients.reduce((s, c) => s + (Number(adCur(c)?.results) || 0), 0);
  const connected = clients.filter((c) => c.igId || c.fbPageId || c.adAccountId);

  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Resultados</p><h1>Métricas</h1></div>
      <div class="actions">${connected.length ? '<button class="btn primary" id="syncAll">⟳ Actualizar todos desde Meta</button>' : ''}</div></header>
    ${metaConnectCard()}
    <div class="toolbar">${monthNav(month)}<span class="muted small">Comparado con ${monthLabel(pm)}</span></div>
    <section class="kpis">
      <div class="kpi"><span>Clientes con cuentas conectadas</span><strong>${connected.length}/${clients.length}</strong></div>
      <div class="kpi"><span>Crecieron en seguidores (IG)</span><strong>${improved}</strong><small>vs. ${monthLabel(pm)}</small></div>
      <div class="kpi"><span>Inversión en Ads del mes</span><strong>${fmtMoney(spend)}</strong></div>
      <div class="kpi"><span>Resultados de Ads</span><strong>${fmtNum(results)}</strong><small>mensajes, leads y compras</small></div>
    </section>
    ${clients.length ? clients.map((c) => {
      const ig = igCur(c), fb = fbCur(c), ad = adCur(c);
      const s = c.strategy || {};
      return `<section class="card mrow" style="--accent:${esc(c.color || '#E891AA')}">
        <div class="mrow-head">
          <a class="row gap mrow-name" href="#/cliente/${c.id}/metricas">${avatar(c)}<div><strong>${esc(c.name)}</strong><div class="conns">${connectedChips(c)}</div></div></a>
          <div class="row gap wrap">
            <button class="btn ghost sm" data-connect="${c.id}">${c.igId || c.fbPageId || c.adAccountId ? 'Cambiar cuentas' : '🔗 Conectar cuentas'}</button>
            ${c.igId || c.fbPageId || c.adAccountId ? `<button class="btn ghost sm" data-sync="${c.id}">⟳ Actualizar</button>` : ''}
            <button class="btn ghost sm" data-manual="${c.id}">✎ Cargar a mano</button>
            <a class="btn ghost sm" href="#/cliente/${c.id}/metricas">Ver detalle →</a>
          </div>
        </div>
        <div class="mrow-grid">
          <div class="mcell"><h5>Instagram</h5>${ig ? `
            <p><b>${fmtNum(ig.followers)}</b> seguidores ${delta(ig.followers, igPrev(c)?.followers)}</p>
            <p><b>${fmtNum(ig.reach)}</b> alcance ${delta(ig.reach, igPrev(c)?.reach)}</p>
            <p><b>${erOf(ig) != null ? erOf(ig).toFixed(2) + '%' : '—'}</b> engagement ${delta(erOf(ig), erOf(igPrev(c)))}</p>` : '<p class="muted small">Sin datos</p>'}</div>
          <div class="mcell"><h5>Facebook</h5>${fb ? `
            <p><b>${fmtNum(fb.followers)}</b> seguidores ${delta(fb.followers, fbPrev(c)?.followers)}</p>
            <p><b>${fmtNum(fb.reach)}</b> alcance ${delta(fb.reach, fbPrev(c)?.reach)}</p>
            <p><b>${fmtNum(fb.interactions)}</b> interacciones ${delta(fb.interactions, fbPrev(c)?.interactions)}</p>` : '<p class="muted small">Sin datos</p>'}</div>
          <div class="mcell"><h5>Meta Ads</h5>${ad ? `
            <p><b>${fmtMoney(ad.spend)}</b> invertido ${delta(ad.spend, adPrev(c)?.spend)}</p>
            <p><b>${fmtNum(ad.results)}</b> resultados ${delta(ad.results, adPrev(c)?.results)}</p>
            <p><b>${ad.results ? fmtMoney(ad.spend / ad.results) : '—'}</b> por resultado ${delta(ad.results ? ad.spend / ad.results : null, adPrev(c)?.results ? adPrev(c).spend / adPrev(c).results : null, { inverse: true })}</p>` : '<p class="muted small">Sin datos</p>'}</div>
          <div class="mcell strat"><h5>Estrategia</h5>${s.objective ? `<p class="small"><b>Objetivo:</b> ${esc(s.objective)}</p>${s.kpis ? `<p class="small muted clamp"><b>KPIs:</b> ${esc(s.kpis)}</p>` : ''}` : '<p class="muted small">Sin estrategia cargada.</p>'}
            <a class="link small" href="#/cliente/${c.id}/estrategia">Ver estrategia →</a></div>
        </div>
      </section>`;
    }).join('') : emptyState('📊', 'Creá clientes para ver sus métricas acá.')}
    <p class="small muted">▲ verde = mejoró respecto del mes anterior · ▼ rojo = empeoró. En costo por resultado, bajar es mejorar.</p>`;

  bindMetaConnect(main, rerender);
  $$('[data-mnav]', main).forEach((b) => (b.onclick = () => { st.month = shiftMonth(st.month, Number(b.dataset.mnav)); rerender(); }));
  $$('[data-connect]', main).forEach((b) => (b.onclick = () => connectAccountsModal(store.get('clients', b.dataset.connect), rerender)));
  $$('[data-manual]', main).forEach((b) => (b.onclick = () => manualMetricModal(store.get('clients', b.dataset.manual), month, rerender)));
  $$('[data-sync]', main).forEach((b) => (b.onclick = async () => {
    b.disabled = true; b.textContent = 'Actualizando…';
    const r = await syncClientMonth(store.get('clients', b.dataset.sync), month);
    reportSync(r); rerender();
  }));
  $('#syncAll') && ($('#syncAll').onclick = async (e) => {
    const btn = e.target; btn.disabled = true; btn.textContent = 'Actualizando…';
    const all = { done: [], failed: [] };
    for (const c of connected) {
      const r = await syncClientMonth(c, month);
      all.done.push(...r.done.map((x) => `${c.name} ${x}`)); all.failed.push(...r.failed.map((x) => `${c.name} – ${x}`));
    }
    reportSync(all); rerender();
  });
}

function reportSync({ done, failed }) {
  if (failed.length) {
    openModal({
      title: 'Actualización desde Meta',
      body: `${done.length ? `<p class="ok-text">✓ Actualizado: ${esc(done.join(', '))}</p>` : ''}<p class="err-text">No se pudo actualizar:</p><ul class="small">${failed.map((f) => `<li>${esc(f)}</li>`).join('')}</ul><p class="small muted">Si dice que el token venció o es inválido, tocá “Conectar con Facebook” de nuevo.</p>`,
      footer: '<span class="spacer"></span><button class="btn primary" data-close>Entendido</button>',
    });
  } else toast(done.length ? `✓ Actualizado: ${done.join(', ')}` : 'No hay cuentas conectadas');
}

export function manualMetricModal(c, month, after) {
  formModal({
    title: `Cargar métricas de ${c.name}`, wide: true,
    fields: [
      { k: 'month', label: 'Mes', type: 'month', required: true },
      { k: 'network', label: 'Red', type: 'select', allowEmpty: false, options: [...NETWORKS, 'Meta Ads'] },
      { k: 'followers', label: 'Seguidores (fin de mes)', type: 'number' },
      { k: 'reach', label: 'Alcance', type: 'number' },
      { k: 'interactions', label: 'Interacciones', type: 'number' },
      { k: 'profileVisits', label: 'Visitas al perfil', type: 'number' },
      { k: 'posts', label: 'Publicaciones', type: 'number' },
      { k: 'spend', label: 'Inversión en Ads ($)', type: 'number', help: 'Solo para Meta Ads' },
      { k: 'results', label: 'Resultados de Ads', type: 'number', help: 'Solo para Meta Ads' },
      { k: 'notes', label: 'Notas del mes', type: 'textarea', rows: 2 },
    ],
    values: { month, network: 'Instagram', ...(metricFor(c.id, 'Instagram', month) || {}) },
    onSave(v) {
      const ex = metricFor(c.id, v.network, v.month);
      store.upsert('metrics', { ...(ex || {}), ...v, clientId: c.id });
      toast('Métricas guardadas'); after && after();
    },
  });
}

// =============== BANCO DE IDEAS (todos los clientes) ===============
const IDEA_COLS = [['nueva', 'Nuevas'], ['aprobada', 'Aprobadas'], ['usada', 'Usadas']];

export function renderIdeasHub(main) {
  const rerender = () => renderIdeasHub(main);
  const clients = store.all('clients').sort((a, b) => a.name.localeCompare(b.name));
  let ideas = store.all('ideas').filter((i) => i.status !== 'descartada');
  if (st.ideaClient === '_general') ideas = ideas.filter((i) => !i.clientId);
  else if (st.ideaClient) ideas = ideas.filter((i) => i.clientId === st.ideaClient);
  const q = st.ideaQ.toLowerCase();
  if (q) ideas = ideas.filter((i) => [i.title, i.hook, i.desc, i.tags].join(' ').toLowerCase().includes(q));
  const discarded = store.all('ideas').filter((i) => i.status === 'descartada').length;
  const clientOpts = (sel) => `<option value="">💡 General (sin cliente)</option>${clients.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}`;

  main.innerHTML = `
    <header class="page-head"><div><p class="eyebrow">Inspiración</p><h1>Banco de ideas</h1></div>
      <div class="actions"><button class="btn ghost" id="aiHub">✨ Generar ideas con IA</button></div></header>
    <section class="card quick-idea">
      <input id="qiText" placeholder="Anotá una idea rápido… (Enter para guardar)">
      <select id="qiClient">${clientOpts(st.ideaClient && st.ideaClient !== '_general' ? st.ideaClient : '')}</select>
      <select id="qiFormat"><option value="">Formato</option>${FORMATS.map((f) => `<option>${f}</option>`).join('')}</select>
      <button class="btn primary" id="qiAdd">＋ Guardar</button>
    </section>
    <div class="toolbar">
      <select id="ihClient"><option value="">Todos los clientes</option><option value="_general" ${st.ideaClient === '_general' ? 'selected' : ''}>💡 Ideas generales</option>${clients.map((c) => `<option value="${c.id}" ${c.id === st.ideaClient ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
      <input type="search" id="ihQ" placeholder="Buscar ideas…" value="${esc(st.ideaQ)}">
      <span class="muted small">${ideas.length} ideas · ${discarded} descartadas · arrastrá entre columnas</span>
    </div>
    <div class="kanban ideas-board">${IDEA_COLS.map(([k, l]) => {
      const col = ideas.filter((i) => (i.status || 'nueva') === k).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return `<div class="kcol" data-icol="${k}"><div class="kcol-head"><span>${l}</span><b>${col.length}</b></div>
        ${col.map((i) => {
          const c = i.clientId ? store.get('clients', i.clientId) : null;
          return `<div class="kcard" draggable="true" data-hidea="${i.id}">
            <strong class="idea-title">${esc(i.title)}</strong>
            ${i.hook ? `<p class="small"><i>“${esc(i.hook)}”</i></p>` : ''}
            ${i.desc ? `<p class="small muted clamp">${esc(i.desc)}</p>` : ''}
            <div class="kc-meta">${c ? `<span class="chip" style="border-color:${esc(c.color)}">${esc(c.name)}</span>` : '<span class="chip soft">General</span>'}${i.format ? `<span class="chip">${esc(i.format)}</span>` : ''}${i.pillar ? `<span class="chip pink">${esc(i.pillar)}</span>` : ''}</div>
            ${k !== 'usada' ? `<button class="link small mt-s" data-hplan="${i.id}">→ Pasar al calendario</button>` : ''}
          </div>`;
        }).join('') || '<p class="muted small center">Sin ideas</p>'}
      </div>`;
    }).join('')}</div>`;

  const add = () => {
    const title = $('#qiText').value.trim();
    if (!title) return;
    store.upsert('ideas', { title, clientId: $('#qiClient').value, format: $('#qiFormat').value, status: 'nueva', network: 'Instagram' });
    toast('Idea guardada'); rerender();
    $('#qiText').focus();
  };
  $('#qiAdd').onclick = add;
  $('#qiText').onkeydown = (e) => { if (e.key === 'Enter') add(); };
  $('#ihClient').onchange = (e) => { st.ideaClient = e.target.value; rerender(); };
  $('#ihQ').onchange = (e) => { st.ideaQ = e.target.value; rerender(); };
  $('#aiHub').onclick = () => {
    const cid = st.ideaClient && st.ideaClient !== '_general' ? st.ideaClient : '';
    if (cid) return generateIdeas(store.get('clients', cid), rerender);
    if (!clients.length) return toast('Primero creá un cliente', 'err');
    const m = openModal({
      title: '¿Para qué cliente?', body: `<select id="aiPick">${clients.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>`,
      footer: '<span class="spacer"></span><button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="aiPickOk">Continuar</button>',
    });
    $('#aiPickOk', m.el).onclick = () => { const id = $('#aiPick', m.el).value; m.close(); generateIdeas(store.get('clients', id), rerender); };
  };
  $$('[data-hidea]', main).forEach((el) => {
    el.onclick = () => editIdea(store.get('ideas', el.dataset.hidea), rerender);
    el.ondragstart = (e) => { e.dataTransfer.setData('text/plain', el.dataset.hidea); el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
  });
  $$('[data-icol]', main).forEach((col) => {
    col.ondragover = (e) => { e.preventDefault(); col.classList.add('drop'); };
    col.ondragleave = () => col.classList.remove('drop');
    col.ondrop = (e) => {
      e.preventDefault(); col.classList.remove('drop');
      const i = store.get('ideas', e.dataTransfer.getData('text/plain'));
      if (i && i.status !== col.dataset.icol) { store.upsert('ideas', { ...i, status: col.dataset.icol }); rerender(); }
    };
  });
  $$('[data-hplan]', main).forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    const i = store.get('ideas', b.dataset.hplan);
    postModal(null, { clientId: i.clientId, date: todayISO(), title: i.title, hook: i.hook, script: i.desc, format: i.format, network: i.network, pillar: i.pillar, status: 'produccion' }, () => {
      store.upsert('ideas', { ...i, status: 'usada' }); rerender();
    });
  }));
}

function editIdea(i, after) {
  const c = i.clientId ? store.get('clients', i.clientId) : null;
  const fields = [
    { k: 'clientId', label: 'Cliente', type: 'select', options: store.all('clients').map((x) => ({ v: x.id, l: x.name })), help: 'Dejalo vacío para una idea general.' },
    ...ideaFields(c),
    { k: 'tags', label: 'Etiquetas', full: true, placeholder: 'trend, navidad, audio viral…' },
  ];
  formModal({
    title: 'Editar idea', fields, values: i, wide: true,
    onSave(v) { store.upsert('ideas', { ...i, ...v }); toast('Idea guardada'); after(); },
    onDelete: () => { store.remove('ideas', i.id); after(); },
  });
}
