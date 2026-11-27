// Integraciones externas: Meta (Graph API / Marketing API) y Claude (IA para copys e ideas).
import { store } from './store.js';

// ---------------- META ----------------
function graphBase() {
  const s = store.settings();
  return `https://graph.facebook.com/${s.graphVersion || 'v23.0'}`;
}

async function graph(path, params = {}) {
  const token = store.settings().metaToken;
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
