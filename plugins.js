// plugins.js — API กลางสำหรับปลั๊กอิน (window.AdBoard) และตัวโหลดปลั๊กอินจาก URL
// ปลั๊กอินคือ ES module ที่ export default function install(api) { ... }
// ดูสัญญา API และตัวอย่างใน PLUGINS.md

export const API_VERSION = '1.0';

export function createApi(host) {
  const listeners = new Map();
  const registry = { views: [], exports: [], settings: [], plugins: [] };
  const api = {
    version: API_VERSION,
    // ---- เหตุการณ์ ----
    on(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); return () => api.off(event, fn); },
    off(event, fn) { const s = listeners.get(event); if (s) s.delete(fn); },
    emit(event, payload) { const s = listeners.get(event); if (!s) return; for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error(`[plugin] ${event}`, e); host.toast(`ปลั๊กอินผิดพลาดที่เหตุการณ์ ${event}: ${e.message}`); } } },
    // ---- ลงทะเบียนส่วนขยาย ----
    registerView({ id, title, subtitle = '', render }) { if (!id || !render) throw new Error('registerView ต้องมี id และ render'); registry.views = registry.views.filter(v => v.id !== id); registry.views.push({ id, title, subtitle, render }); host.onRegistryChange(); },
    registerExport({ id, title, desc = '', label = 'ส่งออก', run }) { if (!id || !run) throw new Error('registerExport ต้องมี id และ run'); registry.exports = registry.exports.filter(v => v.id !== id); registry.exports.push({ id, title, desc, label, run }); host.onRegistryChange(); },
    registerSettings({ id, title, render, save }) { if (!id || !render) throw new Error('registerSettings ต้องมี id และ render'); registry.settings = registry.settings.filter(v => v.id !== id); registry.settings.push({ id, title, render, save }); host.onRegistryChange(); },
    // ---- อ่านข้อมูล (สำเนา แก้แล้วไม่กระทบแอป) ----
    getDay(date) { const d = host.getDay(date); return d ? JSON.parse(JSON.stringify(d)) : null; },
    getDates() { return host.getDates(); },
    getPlan() { return JSON.parse(JSON.stringify(host.getPlan())); },
    getSettings() { const s = { ...host.getSettings() }; delete s.apiKey; delete s.tgToken; delete s.logo; return s; }, // ไม่ให้ปลั๊กอินเห็น key/token
    // ---- เขียนข้อมูลผ่านแอป ----
    setOverride(date, campaignName, patch) { return host.setOverride(date, campaignName, patch); },
    setActual(date, actual) { return host.setActual(date, actual); },
    addPlanItem(layer, listKey, item) { return host.addPlanItem(layer, listKey, item); },
    // ---- เครื่องมือ ----
    engine: host.engine,
    renderPngBlob: (date) => host.renderPngBlob(date),
    toast: host.toast,
    showView: host.showView,
    storage: {
      get(pluginId, key, fallback = null) { try { const v = localStorage.getItem(`kad:plugin:${pluginId}:${key}`); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
      set(pluginId, key, val) { try { localStorage.setItem(`kad:plugin:${pluginId}:${key}`, JSON.stringify(val)); return true; } catch { return false; } },
      remove(pluginId, key) { localStorage.removeItem(`kad:plugin:${pluginId}:${key}`); },
    },
    registry,
  };
  return api;
}

/** โหลดปลั๊กอินจากรายการ [{url, enabled}] คืน [{url, ok, error, name}] */
export async function loadPlugins(api, list, cacheBust = '') {
  const results = [];
  for (const p of list || []) {
    if (!p.url || p.enabled === false) continue;
    const url = /^https?:\/\//.test(p.url) || p.url.startsWith('./') || p.url.startsWith('/') ? p.url : './' + p.url;
    try {
      const mod = await import(/* @vite-ignore */ url + (cacheBust ? (url.includes('?') ? '&' : '?') + 'v=' + cacheBust : ''));
      const install = mod.default || mod.install;
      if (typeof install !== 'function') throw new Error('ไม่มี export default function install(api)');
      const meta = (await install(api)) || {};
      api.registry.plugins.push({ url: p.url, name: meta.name || p.url, version: meta.version || '' });
      results.push({ url: p.url, ok: true, name: meta.name || p.url });
    } catch (e) {
      results.push({ url: p.url, ok: false, error: e.message });
    }
  }
  return results;
}
