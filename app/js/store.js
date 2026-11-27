// Persistencia: datos en localStorage, archivos (imágenes / reels) en IndexedDB.
const KEY = 'jetzaboard_v1';

const COLLECTIONS = [
  'clients', 'projects', 'tasks', 'posts', 'ideas', 'competitors',
  'analyses', 'metrics', 'copies', 'hashtagSets', 'media',
];

function emptyData() {
  const d = { settings: { graphVersion: 'v23.0', metaToken: '', metaAppId: '', anthropicKey: '', ownerName: 'Jetza' } };
  COLLECTIONS.forEach((c) => (d[c] = []));
  return d;
}

let data = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    const base = emptyData();
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
  } catch (e) {
    console.error('No se pudieron leer los datos', e);
    return emptyData();
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    alert('No se pudo guardar: el almacenamiento del navegador está lleno. Exportá un respaldo desde Ajustes.');
  }
  listeners.forEach((fn) => fn());
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const store = {
  get data() { return data; },
  settings() { return data.settings; },
  saveSettings(patch) { data.settings = { ...data.settings, ...patch }; persist(); },
  all(col) { return data[col] || []; },
  byClient(col, clientId) { return (data[col] || []).filter((x) => x.clientId === clientId); },
  get(col, id) { return (data[col] || []).find((x) => x.id === id); },
  upsert(col, item) {
    const list = data[col];
    if (item.id) {
      const i = list.findIndex((x) => x.id === item.id);
      if (i >= 0) list[i] = { ...list[i], ...item, updatedAt: Date.now() };
      else list.push({ ...item, createdAt: Date.now() });
    } else {
      item = { ...item, id: uid(), createdAt: Date.now() };
      list.push(item);
    }
    persist();
    return item;
  },
  remove(col, id) {
    data[col] = data[col].filter((x) => x.id !== id);
    persist();
  },
  removeClient(clientId) {
    COLLECTIONS.filter((c) => c !== 'clients').forEach((c) => {
      if (c === 'media') data.media.filter((m) => m.clientId === clientId).forEach((m) => mediaDB.del(m.id));
      data[c] = data[c].filter((x) => x.clientId !== clientId);
    });
    data.clients = data.clients.filter((c) => c.id !== clientId);
    persist();
  },
  exportJSON() { return JSON.stringify(data, null, 2); },
  importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.clients)) throw new Error('El archivo no parece un respaldo de JetzaBoard');
    const base = emptyData();
    data = { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings || {}) } };
    persist();
  },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

// ---------- IndexedDB para archivos ----------
let dbPromise;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('jetzaboard_media', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx(mode, fn) {
  return db().then((d) => new Promise((resolve, reject) => {
    const t = d.transaction('files', mode);
    const r = fn(t.objectStore('files'));
    t.oncomplete = () => resolve(r && r.result);
    t.onerror = () => reject(t.error);
  }));
}

const urlCache = new Map();

export const mediaDB = {
  put(id, blob) { return tx('readwrite', (s) => s.put(blob, id)); },
  get(id) { return tx('readonly', (s) => s.get(id)); },
  del(id) {
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    return tx('readwrite', (s) => s.delete(id));
  },
  async url(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const blob = await this.get(id);
    if (!blob) return '';
    const u = URL.createObjectURL(blob);
    urlCache.set(id, u);
    return u;
  },
};
