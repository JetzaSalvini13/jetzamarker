// Integraciones externas: Meta (Graph API / Marketing API) y Claude (IA para copys e ideas).
import { store } from './store.js';

// ---------------- META ----------------
function graphBase() {
  const s = store.settings();
  return `https://graph.facebook.com/${s.graphVersion || 'v23.0'}`;
}

async function graph(path, params = {}, tokenOverride) {
  const token = tokenOverride || store.settings().metaToken;
  if (!token) throw new Error('Falta el token de acceso de Meta. Cargalo en Ajustes → Meta.');
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${graphBase()}/${path}?${qs}`);
  const json = await res.json();
  if (json.error) throw new Error(`Meta: ${json.error.message}`);
  return json;
}

const cleanAct = (id) => String(id || '').replace(/^act_/, '').trim();

export const meta = {
  me: () => graph('me', { fields: 'id,name' }),
  adAccounts: () => graph('me/adaccounts', { fields: 'id,name,account_status,currency', limit: 100 }),
  igAccounts: () => graph('me/accounts', { fields: 'name,instagram_business_account{id,username,followers_count}', limit: 100 }),

  async accountInsights(actId, datePreset = 'last_30d') {
    const r = await graph(`act_${cleanAct(actId)}/insights`, {
      fields: 'spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,actions,cost_per_action_type',
      date_preset: datePreset,
    });
    return r.data?.[0] || null;
  },

  async dailyInsights(actId, datePreset = 'last_30d') {
    const r = await graph(`act_${cleanAct(actId)}/insights`, {
      fields: 'spend,impressions,clicks,reach', date_preset: datePreset, time_increment: 1, limit: 100,
    });
    return r.data || [];
  },

  async campaigns(actId, datePreset = 'last_30d') {
    const r = await graph(`act_${cleanAct(actId)}/campaigns`, {
      fields: `name,status,objective,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){spend,impressions,reach,clicks,ctr,cpc,actions}`,
      limit: 100,
    });
    return r.data || [];
  },

  async igProfile(igId) {
    return graph(igId, { fields: 'username,followers_count,follows_count,media_count' });
  },

  // Últimas publicaciones de Instagram con métricas básicas + insights cuando estén disponibles.
  async igMedia(igId, limit = 25) {
    const r = await graph(`${igId}/media`, {
      fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count',
      limit,
    });
    const items = r.data || [];
    await Promise.all(items.map(async (m) => {
      try {
        const metric = m.media_product_type === 'REELS' ? 'reach,saved,shares,views' : 'reach,saved,shares';
        const ins = await graph(`${m.id}/insights`, { metric });
        (ins.data || []).forEach((d) => { m[d.name] = d.values?.[0]?.value ?? d.total_value?.value; });
      } catch { /* algunas publicaciones no exponen insights */ }
    }));
    return items;
  },
};

// ---------- Inicio de sesión con Facebook (requiere App ID de Meta en Ajustes) ----------
const SCOPES = 'ads_read,instagram_basic,instagram_manage_insights,pages_show_list,pages_read_engagement,read_insights,business_management';
let sdkPromise;
function loadSDK(appId) {
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      window.fbAsyncInit = () => {
        window.FB.init({ appId, cookie: false, xfbml: false, version: store.settings().graphVersion || 'v23.0' });
        resolve(window.FB);
      };
      const sc = document.createElement('script');
      sc.src = 'https://connect.facebook.net/es_LA/sdk.js';
      sc.async = true;
      sc.onerror = () => { sdkPromise = null; reject(new Error('No se pudo cargar el inicio de sesión de Facebook (¿bloqueador de anuncios?).')); };
      document.head.appendChild(sc);
    });
  }
  return sdkPromise;
}

export async function metaLogin() {
  const appId = store.settings().metaAppId;
  if (!appId) throw new Error('Falta el App ID de Meta. Cargalo en Ajustes → Meta.');
  const FB = await loadSDK(appId);
  return new Promise((resolve, reject) => {
    FB.login((resp) => {
      if (resp.authResponse?.accessToken) {
        store.saveSettings({ metaToken: resp.authResponse.accessToken, metaTokenAt: Date.now() });
        resolve(resp.authResponse.accessToken);
      } else reject(new Error('No se completó la conexión con Facebook.'));
    }, { scope: SCOPES });
  });
}

// ---------- Datos mensuales ----------
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);
  let until = `${month}-${String(last).padStart(2, '0')}`;
  if (until > today) until = today;
  return { since: `${month}-01`, until };
}
const unix = (iso, end) => Math.floor(new Date(iso + (end ? 'T23:59:59' : 'T00:00:00')).getTime() / 1000);

// Divide el mes en tramos de hasta 30 días (límite de la API) y suma los valores.
function chunks(since, until) {
  const out = [];
  let a = new Date(since + 'T00:00:00');
  const end = new Date(until + 'T00:00:00');
  while (a <= end) {
    const b = new Date(Math.min(a.getTime() + 29 * 864e5, end.getTime()));
    out.push([a.toISOString().slice(0, 10), b.toISOString().slice(0, 10)]);
    a = new Date(b.getTime() + 864e5);
  }
  return out;
}

let pagesCache = null;
async function pagesWithTokens() {
  if (!pagesCache) {
    const r = await graph('me/accounts', { fields: 'id,name,access_token,followers_count,fan_count,instagram_business_account{id,username,followers_count}', limit: 100 });
    pagesCache = r.data || [];
    setTimeout(() => (pagesCache = null), 10 * 60 * 1000);
  }
  return pagesCache;
}

Object.assign(meta, {
  pages: pagesWithTokens,
  resetCache() { pagesCache = null; },

  // Métricas de Instagram del mes. Cada métrica se pide por separado: si Meta cambia o retira una, las demás siguen funcionando.
  async igMonth(igId, month) {
    const { since, until } = monthRange(month);
    const out = {};
    const profile = await graph(igId, { fields: 'username,followers_count,media_count' });
    out.followers = profile.followers_count;
    const map = { reach: 'reach', total_interactions: 'interactions', profile_views: 'profileVisits', website_clicks: 'linkClicks', views: 'impressions' };
    await Promise.all(Object.entries(map).map(async ([metric, key]) => {
      try {
        let total = 0;
        for (const [a, b] of chunks(since, until)) {
          const r = await graph(`${igId}/insights`, { metric, period: 'day', metric_type: 'total_value', since: unix(a), until: unix(b, true) });
          total += Number(r.data?.[0]?.total_value?.value || 0);
        }
        out[key] = total;
      } catch { /* métrica no disponible para esta cuenta */ }
    }));
    try {
      const media = await graph(`${igId}/media`, { fields: 'timestamp', since: unix(since), until: unix(until, true), limit: 100 });
      out.posts = (media.data || []).length;
    } catch { /* sin permiso */ }
    return out;
  },

  // Métricas de la página de Facebook del mes (usa el token de la página).
  async fbMonth(pageId, month) {
    const pages = await pagesWithTokens();
    const page = pages.find((p) => p.id === String(pageId));
    if (!page) throw new Error('La página de Facebook no aparece entre las que administra tu usuario.');
    const { since, until } = monthRange(month);
    const out = { followers: page.followers_count ?? page.fan_count };
    const map = { page_impressions_unique: 'reach', page_post_engagements: 'interactions', page_views_total: 'profileVisits', page_impressions: 'impressions' };
    await Promise.all(Object.entries(map).map(async ([metric, key]) => {
      try {
        let total = 0;
        for (const [a, b] of chunks(since, until)) {
          const r = await graph(`${pageId}/insights`, { metric, period: 'day', since: unix(a), until: unix(b, true) }, page.access_token);
          total += (r.data?.[0]?.values || []).reduce((s, v) => s + (Number(v.value) || 0), 0);
        }
        out[key] = total;
      } catch { /* métrica no disponible */ }
    }));
    return out;
  },

  // Resumen de Meta Ads del mes.
  async adsMonth(actId, month) {
    const { since, until } = monthRange(month);
    const r = await graph(`act_${cleanAct(actId)}/insights`, {
      fields: 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions', time_range: JSON.stringify({ since, until }),
    });
    const i = r.data?.[0];
    if (!i) return { spend: 0 };
    const results = actionValue(i.actions, ['onsite_conversion.messaging_conversation_started_7d', 'lead', 'onsite_conversion.lead_grouped', 'purchase', 'omni_purchase']);
    return { spend: Number(i.spend) || 0, impressions: Number(i.impressions) || 0, reach: Number(i.reach) || 0, clicks: Number(i.clicks) || 0, ctr: Number(i.ctr) || 0, cpc: Number(i.cpc) || 0, cpm: Number(i.cpm) || 0, results };
  },
});

export function actionValue(actions, types) {
  if (!Array.isArray(actions)) return 0;
  return actions.filter((a) => types.includes(a.action_type)).reduce((s, a) => s + Number(a.value || 0), 0);
}

// ---------------- CLAUDE (IA) ----------------
// Se carga el SDK oficial de Anthropic bajo demanda, sólo cuando se usa la IA.
let clientPromise;
async function claudeClient() {
  const apiKey = store.settings().anthropicKey;
  if (!apiKey) throw new Error('Falta la API key de Claude. Cargala en Ajustes → IA.');
  if (!clientPromise || clientPromise.key !== apiKey) {
    const p = import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.8.0/+esm').then(
      ({ default: Anthropic }) => new Anthropic({ apiKey, dangerouslyAllowBrowser: true }),
    );
    p.key = apiKey;
    clientPromise = p;
  }
  return clientPromise;
}

export function brandContext(client) {
  if (!client) return '';
  const b = client.brand || {};
  const s = client.strategy || {};
  const lines = [
    `Marca: ${client.name}`,
    client.industry && `Rubro: ${client.industry}`,
    b.audience && `Público objetivo: ${b.audience}`,
    b.tone && `Tono de voz: ${b.tone}`,
    b.values && `Valores / propuesta de valor: ${b.values}`,
    b.dosDonts && `Qué sí / qué no decir: ${b.dosDonts}`,
    s.objective && `Objetivo de la estrategia: ${s.objective}`,
    s.pillars && `Pilares de contenido: ${s.pillars}`,
    s.persona && `Buyer persona: ${s.persona}`,
  ].filter(Boolean);
  return lines.join('\n');
}

const SYSTEM = `Sos una estratega de contenido y copywriter senior para redes sociales en Latinoamérica (español rioplatense neutro salvo que la marca indique otro tono).
Escribís copys claros, con gancho en la primera línea, sin relleno, adaptados a la red social y al formato pedido. Respetás estrictamente el tono de voz de la marca.
No inventes datos, precios ni promociones que no te hayan dado. Devolvé solo el contenido pedido, sin explicaciones previas.`;

export const assistantClient = () => claudeClient();

export async function askClaude(prompt, { maxTokens = 4000 } = {}) {
  const client = await claudeClient();
  const response = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: maxTokens,
    output_config: { effort: 'low' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });
  if (response.stop_reason === 'refusal') {
    throw new Error('La IA no pudo responder a este pedido. Probá reformularlo.');
  }
  return response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
}
