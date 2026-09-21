// app.js — หน้าจอกระดานแอด BLISSTECH (สถานะ, localStorage, เรนเดอร์ทุกหน้า)
import { analyze, cloneDefaults, mergePlan, diffTotals, campaignsToCsv, MULTI_PRODUCT, LAYER_NAMES, shortCamp, actualMetrics, buildJourney, buildBehaviour, buildBrief, buildDaily, buildBoss, buildWeekly, rangeDays } from './engine.js?v=20260921230353';
import { mainFunnelSvg, productFunnelSvg } from './funnel.js?v=20260921230353';
import { createApi, loadPlugins } from './plugins.js?v=20260921230353';
import * as ENGINE from './engine.js?v=20260921230353';

// ---------- เก็บข้อมูล ----------
const KEYS = { settings: 'kad:settings', days: 'kad:days', plan: 'kad:plan', clips: 'kad:clips', manual: 'kad:manual', weeks: 'kad:weeks' };
function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { toast('บันทึกไม่ได้: พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม ลบวันเก่าในหน้าโหลดไฟล์'); return false; } }

const state = {
  settings: Object.assign(cloneDefaults(), load(KEYS.settings, {})),
  days: load(KEYS.days, {}),
  plan: load(KEYS.plan, null),
  clips: load(KEYS.clips, []),
  manual: load(KEYS.manual, { products: {}, layers: {} }),
  weeks: load(KEYS.weeks, {}), week: null,
  date: null, pending: null, advice: null,
};
// รวม rules ที่อาจเพิ่มใหม่ในเวอร์ชันหลัง
state.settings.rules = Object.assign(cloneDefaults().rules, state.settings.rules || {});
state.date = Object.keys(state.days).sort().pop() || null;

// ---------- ปลั๊กอิน: API กลาง window.AdBoard ----------
const BUILD = (document.querySelector('script[src*="app.js"]') || {}).src?.split('v=')[1] || 'dev';
const PLUGIN_BASE = location.protocol === 'file:' ? 'https://bigboybigzero.github.io/blisstech-kradan-ad/' : '';
const AB = createApi({
  toast: (m) => toast(m),
  showView: (v) => showView(v),
  getDay: (date) => (date ? state.days[date] : day()) || null,
  getDates: () => Object.keys(state.days).sort(),
  getPlan: () => currentPlan(),
  getSettings: () => state.settings,
  engine: ENGINE,
  setOverride: (date, name, patch) => { const D = state.days[date]; if (!D || !D.campaigns.some(c => c.name === name)) return false; D.overrides[name] = { ...(D.overrides[name] || {}), ...patch }; save(KEYS.days, state.days); renderDecisions(); return true; },
  setActual: (date, actual) => { const D = state.days[date]; if (!D) return false; D.actual = actual && actual.rev > 0 ? { ...actual, updatedAt: new Date().toISOString() } : null; save(KEYS.days, state.days); renderOverview(); return true; },
  addPlanItem: (layer, key, item) => { const layers = currentPlan(), p = layers.find(x => x.layer === layer); if (!p || !p[key]) return false; p[key].push({ ...item, source: 'team' }); savePlanFrom(layers); renderPlan(); renderFunnel(); return true; },
  renderPngBlob: async (date) => { const D = (date ? state.days[date] : day()); if (!D) throw new Error('ยังไม่ได้โหลดไฟล์'); const m = await import('./sheet.js?v=20260921230353'); return (await m.renderPngBlob(D, currentPlan(), $('#sheetHost'))).blob; },
  onRegistryChange: () => { if (typeof renderPluginUi === 'function') renderPluginUi(); },
});
window.AdBoard = AB;
let pluginLoadResults = [];

// ---------- ตัวช่วย ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n0 = v => v === null || v === undefined || isNaN(v) ? '-' : Math.round(v).toLocaleString('en-US');
const n1 = v => v === null || v === undefined || isNaN(v) ? '-' : Number(v).toFixed(1);
const n2 = v => v === null || v === undefined || isNaN(v) ? '-' : Number(v).toFixed(2);
const G = { go: 'ไปต่อ', watch: 'ดูภาพรวม', stop: 'ปิด' };
const thDate = iso => { if (!iso) return '-'; const [y, m, d] = iso.split('-').map(Number); const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${M[m - 1]} ${y + 543 - 2500}`; };
const roasCls = (r, ok = 4, warn = 1.5) => r === null || r === undefined ? '' : r >= ok ? 'good' : r >= warn ? 'mid' : 'bad';
let toastT; function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const day = () => state.date ? state.days[state.date] : null;

// ---------- แบรนด์ (ชื่อแอป/โลโก้ เปลี่ยนได้ในหน้าตั้งค่า) ----------
const DEFAULT_BRAND = { appName: 'BLISSTECH AdBoard', tagline: 'Ads Intelligence', logo: '' };
function applyBrand() {
  const S = state.settings, name = S.appName || DEFAULT_BRAND.appName, tag = S.tagline ?? DEFAULT_BRAND.tagline;
  $('#brandName').textContent = name; $('#brandTag').textContent = tag; $('#brandTag').hidden = !tag;
  document.title = name;
  const mark = $('#brandMark');
  const logo = S.logo || 'logo.png'; // ถ้าไม่ได้อัปโหลด ใช้ logo.png ในโฟลเดอร์แอป (ถ้ามี) ไม่มีก็ใช้ตัวอักษร
  mark.innerHTML = `<img src="${esc(logo)}" alt="">`;
  mark.classList.add('has-logo');
  mark.querySelector('img').onerror = () => { mark.classList.remove('has-logo'); mark.textContent = name.trim().charAt(0).toUpperCase() || 'B'; };
}
async function fileToLogoDataUrl(file, size = 128) {
  if (!/^image\//.test(file.type)) throw new Error('ต้องเป็นไฟล์รูป (PNG/JPG/SVG)');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('อ่านรูปไม่ได้')); i.src = url; });
    const c = document.createElement('canvas'); c.width = size; c.height = size; const g = c.getContext('2d');
    const r = Math.min(size / img.width, size / img.height), w = img.width * r, h = img.height * r;
    g.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
    return c.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}

// ---------- นำทาง ----------
function showView(v) {
  if (!document.querySelector(`.view[data-view="${CSS.escape(v)}"]`)) v = 'load';
  document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.dataset.view !== v));
  document.querySelectorAll('.opnav-item').forEach(b => b.classList.toggle('on', b.dataset.view === v));
  const pv = AB.registry.views.find(x => 'p:' + x.id === v);
  if (pv) { const el = document.querySelector(`.view[data-view="${CSS.escape(v)}"] .pv-body`); try { pv.render(el, AB); } catch (e) { el.innerHTML = `<div class="warnbox">ปลั๊กอินแสดงผลไม่ได้: ${esc(e.message)}</div>`; } }
  AB.emit('view:shown', { view: v });
  try { history.replaceState(null, '', '#/' + v); } catch {}
}
$('#nav').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) showView(b.dataset.view); });
$('#daySelect').addEventListener('change', e => { state.date = e.target.value || null; renderAll(); AB.emit('day:changed', { date: state.date }); });

// ---------- โหลดไฟล์ ----------
const drop = $('#drop'), fileInput = $('#fileInput');
drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readFile(f); });
fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) readFile(f); fileInput.value = ''; });

async function readFile(file) {
  $('#dropMsg').textContent = `กำลังอ่าน ${file.name} ...`;
  try {
    if (!/\.xlsx?$/i.test(file.name)) throw new Error('ต้องเป็นไฟล์ .xlsx จาก Meta Ads');
    const buf = await file.arrayBuffer();
    await runAnalysis(buf, file.name);
  } catch (e) { $('#dropMsg').textContent = ''; $('#loadInfo').innerHTML = `<div class="warnbox">อ่านไฟล์ไม่ได้: ${esc(e.message)}</div>`; }
}
async function runAnalysis(buf, fileName) {
  if (typeof XLSX === 'undefined') throw new Error('โหลดตัวอ่าน Excel (SheetJS) ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วรีเฟรช');
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames.find(n => /creative/i.test(n)) || wb.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  const A = analyze(rows, state.settings, state.clips, state.manual);
  if (rangeDays(A.date, A.dateEnd) > 1) { $('#dropMsg').textContent = ''; $('#loadInfo').innerHTML = `<div class="warnbox">ไฟล์นี้เป็นช่วง ${thDate(A.date)} ถึง ${thDate(A.dateEnd)} (${rangeDays(A.date, A.dateEnd)} วัน) จึงเก็บไว้ที่หน้า <b>สรุปรายสัปดาห์</b> ไม่ปนกับรายวัน</div>`; commitWeek(A, fileName); return; }
  state.pending = { rows, fileName, A };
  $('#dropMsg').textContent = '';
  renderLoadInfo();
  const pick = new URLSearchParams(location.search).get('pick'); // โหมดพัฒนา: เลือกสินค้าให้ทุกชื่อที่จับไม่ได้อัตโนมัติ
  if (pick && A.unresolved.products.length) { for (const n of A.unresolved.products) state.manual.products[n] = pick; state.pending.A = analyze(rows, state.settings, state.clips, state.manual); }
  if (state.pending.A.unresolved.products.length || (!pick && state.pending.A.unresolved.stages.length)) renderResolve(state.pending.A);
  else { $('#resolvePanel').innerHTML = ''; commitPending(); }
}
function renderLoadInfo() {
  const { A, fileName } = state.pending;
  $('#loadInfo').innerHTML = `<div class="card"><h3>ไฟล์ที่อ่านได้</h3>
    <div class="kpi"><span>ไฟล์</span><b>${esc(fileName)}</b></div>
    <div class="kpi"><span>วันที่ข้อมูล</span><b>${thDate(A.date)}${state.days[A.date] ? ' <span class="zone warn">มีอยู่แล้ว จะแทนที่</span>' : ''}</b></div>
    <div class="kpi"><span>แถวข้อมูล · แคมเปญ · ชุดโฆษณา · คลิป</span><b class="num">${A.rowCount} · ${A.campaigns.length} · ${new Set(A.adsets.map(a => a.name)).size} · ${new Set(A.ads.map(a => a.name)).size}</b></div>
    <div class="kpi"><span>ยอดรวม${A.totals.fromTotalRow ? ' (จากแถวรวมของ Meta)' : ' (คำนวณเอง ไม่พบแถวรวม)'}</span><b class="num">ใช้ ${n0(A.totals.spend)} · ${n0(A.totals.purch)} ออเดอร์ · ขาย ${n0(A.totals.rev)}</b></div></div>`;
}
function renderResolve(A) {
  const prodOpts = [...state.settings.productPatterns.map(p => p.name), MULTI_PRODUCT];
  const stageOpts = ['TOFU', 'MOFU', 'BOFU', 'โปร', 'อินฟู', 'ภาพนิ่ง', 'อื่นๆ'];
  const sel = (name, opts, cur) => `<select data-name="${esc(name)}"><option value="">เลือก...</option>${opts.map(o => `<option${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  $('#resolvePanel').innerHTML = `<div class="resolve">
    ${A.unresolved.products.length ? `<h3>ชื่อแคมเปญที่จับสินค้าไม่ได้ ${A.unresolved.products.length} ตัว (ต้องเลือกก่อน)</h3><div id="rsProd">${A.unresolved.products.map(n => `<div class="rowsel"><span>${esc(n)}</span>${sel(n, prodOpts, state.manual.products[n])}</div>`).join('')}</div>` : ''}
    ${A.unresolved.stages.length ? `<h3 style="margin-top:12px">คลิปที่ไม่มีป้ายขั้น ${A.unresolved.stages.length} ตัว (เลือกได้ หรือปล่อยเป็นอื่นๆ)</h3><div id="rsStage">${A.unresolved.stages.map(n => `<div class="rowsel"><span>${esc(n)}</span>${sel(n, stageOpts, '')}</div>`).join('')}</div>` : ''}
    <div class="row-btns" style="margin:12px 0 0"><button class="btn" id="btnResolve">ยืนยันและวิเคราะห์</button><span class="small muted">ตัวเลือกจะจำไว้ ครั้งหน้าไม่ถามซ้ำ</span></div></div>`;
  $('#btnResolve').addEventListener('click', () => {
    const missing = [...document.querySelectorAll('#rsProd select')].filter(s => !s.value);
    if (missing.length) { toast('เลือกสินค้าให้ครบก่อน'); return; }
    document.querySelectorAll('#rsProd select').forEach(s => { state.manual.products[s.dataset.name] = s.value; });
    document.querySelectorAll('#rsStage select').forEach(s => { if (s.value) { state.clips = state.clips.filter(c => c.name !== s.dataset.name); state.clips.push({ name: s.dataset.name, stage: s.value }); } });
    save(KEYS.manual, state.manual); save(KEYS.clips, state.clips);
    state.pending.A = analyze(state.pending.rows, state.settings, state.clips, state.manual);
    $('#resolvePanel').innerHTML = '';
    commitPending();
  });
}
function commitPending() {
  const { A, fileName } = state.pending;
  const prev = state.days[A.date] || {};
  const rec = {
    fileName, uploadedAt: new Date().toISOString(), date: A.date, dateEnd: A.dateEnd, totals: A.totals, campaigns: A.campaigns, adsets: A.adsets, ads: A.ads, places: A.places,
    layers: A.layers, products: A.products, productFunnels: A.productFunnels, dupClips: A.dupClips, dupAdsets: A.dupAdsets, unresolved: A.unresolved, planAuto: A.plan, journey: A.journey, behaviour: A.behaviour, brief: A.brief, daily: A.daily, rowCount: A.rowCount,
    overrides: prev.overrides || {}, advice: prev.advice || null,
  };
  state.days[A.date] = rec;
  // เก็บไม่เกิน 30 วัน
  const dates = Object.keys(state.days).sort();
  while (dates.length > 30) delete state.days[dates.shift()];
  if (!save(KEYS.days, state.days)) { const old = Object.keys(state.days).sort().filter(d => d !== A.date); if (old.length) { delete state.days[old[0]]; save(KEYS.days, state.days); } }
  state.date = A.date; state.pending = null;
  const q = new URLSearchParams(location.search); // โหมดพัฒนา
  if (q.get('sample')) adviceModule().then(m => { if (m) { rec.advice = m.sampleAdvice(rec, currentPlan()); save(KEYS.days, state.days); renderAdvice(); renderOverview(); } });
  if (q.get('sheet')) import('./sheet.js?v=20260921230353').then(m => { $('#sheetHost').innerHTML = m.sheetHtml(rec, currentPlan()); }).catch(e => { $('#exportMsg').textContent = e.message; });
  if (q.get('actual') && (!q.get('actualfor') || q.get('actualfor') === A.date)) { const [r, o] = q.get('actual').split(',').map(Number); const bpd = {}; for (const kv of (q.get('actualp') || '').split(',').filter(Boolean)) { const [n, v] = kv.split(':'); bpd[n] = { rev: Number(v) }; } rec.actual = { rev: r, orders: o || null, note: 'dev', byProduct: bpd, updatedAt: new Date().toISOString() }; save(KEYS.days, state.days); }   // โหมดพัฒนา: ใส่ยอดจริงให้วันล่าสุด
  for (const kv of (q.get('actuals') || '').split(',').filter(Boolean)) { const [d, v] = kv.split(':'); if (d === A.date) { rec.actual = { rev: Number(v), orders: null, note: 'dev', byProduct: {}, updatedAt: new Date().toISOString() }; save(KEYS.days, state.days); } }
  if (q.get('vpng')) viewPngBlob('#' + q.get('vpng'), q.get('vpng'), 'test').then(r => { $('#' + q.get('vpng') + 'Msg').textContent = 'vpng ok ' + Math.round(r.blob.size / 1024) + 'KB'; }).catch(e => { $('#' + q.get('vpng') + 'Msg').textContent = 'vpng fail ' + e.message; });
  if (q.get('bpng')) briefPngBlob().then(r => { $('#briefMsg').textContent = 'bpng ok ' + Math.round(r.blob.size / 1024) + 'KB'; }).catch(e => { $('#briefMsg').textContent = 'bpng fail ' + e.message; });
  if (q.get('jpng')) journeyPngBlob('').then(r => { $('#journeyMsg').textContent = 'jpng ok ' + Math.round(r.blob.size / 1024) + 'KB'; }).catch(e => { $('#journeyMsg').textContent = 'jpng fail ' + e.message; });
  if (q.get('png')) import('./sheet.js?v=20260921230353').then(m => m.exportPng(rec, currentPlan(), $('#sheetHost'), true)).then(r => { $('#exportMsg').textContent = 'png ok ' + r; }).catch(e => { $('#exportMsg').textContent = 'png fail ' + e.message; });
  toast(`วิเคราะห์ ${thDate(A.date)} เสร็จ`);
  renderAll(); showView(autoView || 'daily');
  AB.emit('day:loaded', { date: A.date, fileName });
  if (state.settings.tgAuto && tgReady()) { $('#tgHint').textContent = 'กำลังส่งอัตโนมัติ...'; sendToTelegram(rec, $('#exportMsg')).then(ok => { $('#tgHint').textContent = ok ? `ส่งอัตโนมัติแล้ว ${new Date().toLocaleTimeString('th-TH')}` : 'ส่งอัตโนมัติไม่สำเร็จ ดูข้อความในหน้าส่งออก'; }); }
}

// ---------- เรนเดอร์รวม ----------
function renderAll() {
  const dates = Object.keys(state.days).sort().reverse();
  $('#daySelect').innerHTML = dates.length ? dates.map(d => `<option value="${d}"${d === state.date ? ' selected' : ''}>${thDate(d)}</option>`).join('') : '<option value="">-</option>';
  $('#daysList').innerHTML = dates.length ? dates.map(d => `<div class="dayrow"><span><b>${thDate(d)}</b> <span class="muted small">${esc(state.days[d].fileName)} · ${state.days[d].campaigns.length} แคมเปญ</span></span><span><button class="mini" data-open="${d}">เปิด</button> <button class="mini danger" data-del="${d}">ลบ</button></span></div>`).join('') : 'ยังไม่มี';
  applyBrand();
  const D = day();
  const rangeTxt = d => d.dateEnd && d.dateEnd !== d.date ? `${thDate(d.date)} ถึง ${thDate(d.dateEnd)}` : thDate(d.date);
  $('#chipDate').textContent = D ? `ข้อมูล ${rangeTxt(D)}` : 'ยังไม่ได้โหลดไฟล์';
  renderDaily(); renderBoss(); renderWeekly(); renderBrief(); renderOverview(); renderFunnel(); renderJourney(); renderBehaviour(); renderDecisions(); renderPlan(); renderAdvice(); renderSettings();
  for (const id of ['ovProducts', 'ovPlaces', 'funnelMain', 'dupClips', 'dupAdsets', 'decisions', 'plan', 'journey', 'behaviour']) $('#' + id).classList.toggle('empty', !D);
  $('#advice').classList.toggle('empty', !(D && D.advice));
  $('#daysList').classList.toggle('empty', !dates.length);
}
$('#daysList').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), x = e.target.closest('[data-del]');
  if (o) { state.date = o.dataset.open; renderAll(); showView('daily'); }
  if (x) { if (confirm(`ลบข้อมูลวันที่ ${thDate(x.dataset.del)}?`)) { delete state.days[x.dataset.del]; save(KEYS.days, state.days); if (state.date === x.dataset.del) state.date = Object.keys(state.days).sort().pop() || null; renderAll(); } }
});

// ---------- ภาพรวม ----------
function prevDay() { if (!state.date) return null; const ds = Object.keys(state.days).sort().filter(d => d < state.date); return ds.length ? state.days[ds[ds.length - 1]] : null; }
function renderOverview() {
  const D = day();
  $('#ovDate').textContent = D ? (D.dateEnd && D.dateEnd !== D.date ? `${thDate(D.date)} ถึง ${thDate(D.dateEnd)} (รวม ${Math.round((new Date(D.dateEnd) - new Date(D.date)) / 86400000) + 1} วัน)` : thDate(D.date)) : '';
  $('#ovHeadline').classList.toggle('hidden', !(D && D.advice && D.advice.headline));
  if (D && D.advice && D.advice.headline) $('#ovHeadline').textContent = D.advice.headline;
  if (!D) { $('#ovCards').innerHTML = ''; $('#ovNote').innerHTML = ''; $('#ovActual').innerHTML = ''; $('#ovProducts').textContent = 'ยังไม่ได้โหลดไฟล์'; $('#ovPlaces').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  const P = prevDay(), df = P ? diffTotals(D.totals, P.totals) : null;
  const delta = (k, fmt, goodUp = true, suffix = '') => {
    if (!df || df[k] === null || df[k] === undefined) return P ? '' : '<div class="sub">ยังไม่มีวันก่อนหน้าให้เทียบ</div>';
    const v = df[k], up = v > 0, cls = v === 0 ? '' : (up === goodUp ? 'up' : 'down');
    return `<div class="d ${cls}">${up ? '▲' : v < 0 ? '▼' : '='} ${fmt(Math.abs(v))}${suffix} เทียบ ${thDate(df.date)}</div>`;
  };
  const T = D.totals;
  $('#ovCards').innerHTML = `
    <div class="stat"><div class="t">ใช้จ่าย (บาท)</div><div class="v num">${n0(T.spend)}</div>${delta('spend', n0, false)}</div>
    <div class="stat"><div class="t">ยอดขายที่จับได้ (บาท)</div><div class="v num">${n0(T.rev)}</div>${delta('rev', n0, true)}</div>
    <div class="stat"><div class="t">ROAS · ค่าแอด</div><div class="v num">${n2(T.roas)} <span class="sub">· ${n1(T.adpct)}%</span></div>${delta('roas', n2, true)}</div>
    <div class="stat"><div class="t">ออเดอร์ · ไม่มีมูลค่า</div><div class="v num">${n0(T.purch)} <span class="sub">· ${n0(T.noval)}</span></div>${delta('purch', n0, true)}</div>
    <div class="stat"><div class="t">ต่อออเดอร์ (บาท)</div><div class="v num">${n0(T.cpp)}</div>${delta('cpp', n0, false)}</div>
    <div class="stat"><div class="t">AOV (บาท)</div><div class="v num">${n0(T.aov)}</div><div class="sub">เฉพาะออเดอร์ที่มีมูลค่า</div></div>`;
  const AM = actualMetrics(T, D.products, D.actual);
  const PA = P && actualMetrics(P.totals, P.products, P.actual);
  const dAct = (k, fmt, goodUp, suffix = '') => { if (!AM || !PA || AM[k] === null || PA[k] === null) return ''; const v = AM[k] - PA[k], up = v > 0, cls = v === 0 ? '' : (up === goodUp ? 'up' : 'down'); return `<div class="d ${cls}">${up ? '▲' : v < 0 ? '▼' : '='} ${fmt(Math.abs(v))}${suffix} เทียบ ${thDate(P.date)}</div>`; };
  if (AM) $('#ovCards').innerHTML += `
    <div class="stat actual"><div class="t">ยอดขายจริง (บาท)</div><div class="v num">${n0(AM.rev)}</div>${dAct('rev', n0, true)}<div class="sub">กระดาน Meta จับได้ ${n0(AM.metaCoverage)}% ของจริง</div></div>
    <div class="stat actual"><div class="t">ROAS จริง · ค่าแอดจริง</div><div class="v num">${n2(AM.roas)} <span class="sub">· ${n1(AM.adpct)}%</span></div>${dAct('adpct', n1, false, '%')}</div>
    ${AM.orders ? `<div class="stat actual"><div class="t">ออเดอร์จริง · ต่อออเดอร์จริง</div><div class="v num">${n0(AM.orders)} <span class="sub">· ${n0(AM.cpp)} บาท</span></div><div class="sub">AOV จริง ${n0(AM.aov)}</div></div>` : ''}`;
  const act = D.actual || {}, bp = act.byProduct || {};
  const prodNames = D.products.map(p => p.name).filter(n => n !== 'ไม่ระบุ');
  $('#ovActual').innerHTML = `<div class="card actual-card"><h3>ยอดขายจริงของวันนี้ (จากออเดอร์จริง)</h3>
    <p class="small muted">กรอกยอดที่ปิดได้จริงจากระบบออเดอร์ เพื่อคำนวณค่าแอดจริง เพราะกระดาน Meta จับยอดได้ไม่ครบ (ออเดอร์ทางแชท ออเดอร์ที่ไม่มีมูลค่า) ตัวเลขนี้จะไปอยู่ในภาพรวม รูปสรุป Telegram และคำแนะนำจาก Claude</p>
    <div class="setgrid">
      <div><label>ยอดขายจริงรวม (บาท)</label><input type="number" min="0" step="1" data-actual="rev" value="${act.rev ?? ''}" placeholder="เช่น 92500"></div>
      <div><label>จำนวนออเดอร์จริง</label><input type="number" min="0" step="1" data-actual="orders" value="${act.orders ?? ''}" placeholder="เช่น 120"></div>
      <div><label>หมายเหตุ (ที่มาของยอด / โปรวันนี้)</label><input type="text" data-actual="note" value="${esc(act.note || '')}" placeholder="เช่น จาก Pancake + Shopee"></div>
    </div>
    <details style="margin-top:10px"${Object.keys(bp).length ? ' open' : ''}><summary class="small muted" style="cursor:pointer">แยกตามสินค้า (ไม่บังคับ ใส่แล้วจะได้ค่าแอดจริงต่อสินค้า)</summary>
      <div class="setgrid" style="margin-top:8px">${prodNames.map(n => `<div><label>${esc(n)} ยอดจริง (บาท) · ออเดอร์</label><div class="row-btns" style="margin:0"><input type="number" min="0" step="1" data-actual-prod="${esc(n)}" data-field="rev" value="${(bp[n] || {}).rev ?? ''}" placeholder="บาท" style="max-width:140px"><input type="number" min="0" step="1" data-actual-prod="${esc(n)}" data-field="orders" value="${(bp[n] || {}).orders ?? ''}" placeholder="ออเดอร์" style="max-width:100px"></div></div>`).join('')}</div>
    </details>
    <div class="row-btns" style="margin-top:12px"><button class="btn" id="btnActualSave">บันทึกยอดจริง</button><span class="small muted" id="actualMsg">${act.updatedAt ? 'บันทึกล่าสุด ' + new Date(act.updatedAt).toLocaleString('th-TH') : 'ยังไม่ได้กรอก'}</span></div>
  </div>`;
  const notes = [];
  if (AM) {
    if (AM.metaCoverage < 80) notes.push(`กระดาน Meta จับยอดได้ ${n0(AM.metaCoverage)}% ของยอดจริง (หายไป ${n0(AM.metaGap)} บาท) ค่าแอดจริงคือ ${n1(AM.adpct)}% ไม่ใช่ ${n1(T.adpct)}% ให้ใช้ค่าแอดจริงตัดสินภาพรวม ส่วน ROAS รายแคมเปญยังใช้เปรียบเทียบกันเองได้`);
    else if (AM.metaCoverage > 110) notes.push(`กระดาน Meta รายงานยอดสูงกว่ายอดจริง ${n0(AM.metaCoverage - 100)}% (นับซ้ำหรือคืนสินค้า) ให้เชื่อยอดจริง`);
  }
  if (T.noval > 0) notes.push(`ออเดอร์ ${T.noval} รายการถูกนับเป็นการซื้อแต่ไม่มีมูลค่าส่งมา ถ้าคิดที่ AOV เดียวกัน ยอดจริงน่าจะราว ${n0(T.rev + T.noval * (T.aov || 0))} บาท ตรวจ tracking ก่อนตัดสินแคมเปญกลุ่มนี้`);
  const l4 = D.layers.find(l => l.layer === 4); if (l4 && l4.revShare > 50) notes.push(`ยอด ${n0(l4.revShare)}% มาจากลูกค้าเก่า (ชั้น 4) ยอดจากคนใหม่ยังน้อย`);
  if (D.unresolved.products.length) notes.push(`มีแคมเปญที่เลือกสินค้าเป็น "${MULTI_PRODUCT}" หรือยังไม่ระบุ ${D.unresolved.products.length} ตัว`);
  $('#ovNote').innerHTML = notes.map(n => `<div class="hint">${esc(n)}</div>`).join('');
  const hasBP = AM && Object.keys(AM.byProduct).length > 0;
  $('#ovProducts').innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>สินค้า</th><th class="r">ใช้จ่าย</th><th class="r">งบ%</th><th class="r">ออเดอร์</th><th class="r">ยอดขาย</th><th class="r">ROAS</th><th class="r">ค่าแอด%</th>${hasBP ? '<th class="r">ยอดจริง</th><th class="r">ค่าแอดจริง%</th>' : ''}</tr></thead><tbody>
    ${D.products.map(p => { const a = hasBP && AM.byProduct[p.name]; return `<tr><td>${esc(p.name)}</td><td class="r num">${n0(p.spend)}</td><td class="r num">${n0(p.spendShare)}%</td><td class="r num">${n0(p.purch)}${p.noval ? `<span class="muted small"> (${p.noval})</span>` : ''}</td><td class="r num">${n0(p.rev)}</td><td class="r num ${roasCls(p.roas)}">${n2(p.roas)}</td><td class="r num">${n1(p.adpct)}</td>${hasBP ? `<td class="r num">${a ? n0(a.rev) : '-'}</td><td class="r num ${a ? (a.adpct <= 20 ? 'good' : a.adpct <= 35 ? 'mid' : 'bad') : ''}">${a ? n1(a.adpct) : '-'}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>`;
  const noPlace = D.places.length === 1 && !D.places[0].name;
  $('#ovPlaces').innerHTML = noPlace ? '<div class="hint">ไฟล์นี้ไม่ได้แยกตำแหน่งโฆษณา (export ระดับชุดโฆษณา) ถ้าอยากเห็น Reels เทียบฟีด ให้ export แบบมี breakdown ตำแหน่ง</div>' : `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>ตำแหน่ง</th><th class="r">ใช้จ่าย</th><th class="r">ยอดขาย</th><th class="r">ROAS</th><th class="r">CPM</th><th class="r">CTR%</th></tr></thead><tbody>
    ${D.places.slice(0, 6).map(p => `<tr><td>${esc(p.name)}</td><td class="r num">${n0(p.spend)}</td><td class="r num">${n0(p.rev)}</td><td class="r num ${roasCls(p.roas)}">${n2(p.roas)}</td><td class="r num">${n0(p.cpm)}</td><td class="r num">${n2(p.ctr)}</td></tr>`).join('')}</tbody></table></div>`;
}

$('#ovActual').addEventListener('click', e => {
  if (!e.target.matches('#btnActualSave')) return; const D = day(); if (!D) return;
  const num = v => v === '' ? null : Math.max(0, Number(v));
  const act = { rev: num($('[data-actual="rev"]').value), orders: num($('[data-actual="orders"]').value), note: $('[data-actual="note"]').value.trim(), byProduct: {}, updatedAt: new Date().toISOString() };
  document.querySelectorAll('[data-actual-prod]').forEach(i => { const n = i.dataset.actualProd; act.byProduct[n] = act.byProduct[n] || {}; act.byProduct[n][i.dataset.field] = num(i.value); });
  for (const n of Object.keys(act.byProduct)) if (!(act.byProduct[n].rev > 0)) delete act.byProduct[n];
  const sumBP = Object.values(act.byProduct).reduce((s, x) => s + (x.rev || 0), 0);
  if (act.rev === null && sumBP > 0) act.rev = sumBP;
  if (act.rev !== null && sumBP > act.rev * 1.02) { toast(`ยอดแยกสินค้ารวม ${n0(sumBP)} มากกว่ายอดรวม ${n0(act.rev)} ตรวจตัวเลขก่อน`); return; }
  D.actual = act.rev === null ? null : act; save(KEYS.days, state.days); renderOverview(); renderDaily(); renderBoss(); renderWeekly(); toast(act.rev === null ? 'ล้างยอดจริงแล้ว' : 'บันทึกยอดจริงแล้ว'); AB.emit('actual:saved', { date: state.date, actual: D.actual });
});

// ---------- กรวย ----------
function currentPlan() { const D = day(); return D ? mergePlan(D.planAuto, state.plan).layers : []; }
function renderFunnel() {
  const D = day();
  if (!D) { $('#funnelMain').textContent = 'ยังไม่ได้โหลดไฟล์'; $('#funnelProducts').innerHTML = ''; $('#dupClips').textContent = '-'; $('#dupAdsets').textContent = '-'; return; }
  const plan = currentPlan();
  const dupNote = D.dupAdsets.length ? `${D.dupAdsets[0].name} ถูกยิง ${D.dupAdsets[0].campaigns.length} แคมเปญ` : '';
  const clipShort = n => String(n).replace(/^\d+\.\d+\.\d+\s*/, '').replace(/^\d+\.\s*/, '').slice(0, 34);
  const li = (arr, cls = '') => arr.length ? arr.slice(0, 3).map(x => `<span class="${cls}">${esc(clipShort(x.name))}</span>`).join(' · ') + (arr.length > 3 ? ` <span class="muted">+${arr.length - 3}</span>` : '') : '<span class="muted">-</span>';
  $('#funnelMain').innerHTML = `<div class="fwrap">
    <div class="fcol content"><h4>ทีมคอนเทนต์ · คลิปในชั้นนี้</h4><div class="frows">${plan.map(p => `<div class="frow l${p.layer}"><span class="k">${esc(p.role)}</span><div><span class="k">มีแล้ว</span> ${li(p.clipsHave)}</div><div><span class="k">ขาด</span> ${li(p.clipsMissing, 'miss')}</div></div>`).join('')}</div></div>
    <div>${mainFunnelSvg(D.layers, { l4note: dupNote })}</div>
    <div class="fcol ads"><h4>ทีมยิงแอด · กลุ่มเป้าหมาย งบ ตัววัด</h4><div class="frows">${plan.map(p => { const l = D.layers.find(x => x.layer === p.layer); return `<div class="frow l${p.layer}"><div><span class="k">กลุ่มที่ใช้</span> ${li(p.audiences)}</div><div><span class="k">ควรสร้าง</span> ${li(p.audiencesToBuild, 'new')}</div><div><span class="k">งบ</span> เป้า ${p.budgetShare}% (วันนี้ ${n0(l.spendShare)}%) · <span class="k">วัด</span> ${esc(p.metric)}</div></div>`; }).join('')}</div></div>
  </div>`;
  $('#funnelProducts').innerHTML = D.productFunnels.map(pf => {
    const notes = pf.layers.filter(l => l.note).map(l => `<div><b>ชั้น ${l.layer}</b> ${esc(l.note)}</div>`).join('');
    return `<div class="prod"><h4>${esc(pf.product)}<span>ค่าแอด ${n1(pf.adpct)}% · ROAS ${n2(pf.roas)}</span></h4>${productFunnelSvg(pf)}${notes ? `<div class="notes">${notes}</div>` : ''}</div>`;
  }).join('') || '<div class="empty">ไม่มีสินค้าที่ระบุได้</div>';
  $('#dupClips').innerHTML = D.dupClips.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>คลิป</th><th>แคมเปญ / กลุ่มเป้าหมาย</th><th class="r">ใช้จ่าย</th><th class="r">ออเดอร์</th><th class="r">ROAS</th></tr></thead><tbody>
    ${D.dupClips.slice(0, 8).flatMap(d => d.uses.map((u, i) => `<tr>${i === 0 ? `<td rowspan="${d.uses.length}"><b>${esc(d.name)}</b><div class="dupuse">${d.uses.length} แคมเปญ</div></td>` : ''}<td><span class="ltag l${u.layer}">${u.layer}</span> ${esc(shortCamp(u.camp))}<div class="dupuse">${esc(u.adset)}</div></td><td class="r num">${n0(u.spend)}</td><td class="r num">${n0(u.purch)}</td><td class="r num ${roasCls(u.roas)}">${n2(u.roas)}</td></tr>`)).join('')}</tbody></table></div><p class="small muted" style="margin-top:6px">คลิปเดียวกันต่างกลุ่มให้ผลต่างกันมาก เวลาคลิปไม่มียอด ให้ดูกลุ่มก่อนโทษคลิป</p>` : 'ไม่มีคลิปที่ใช้ซ้ำหลายแคมเปญ';
  $('#dupAdsets').innerHTML = D.dupAdsets.length ? D.dupAdsets.map(d => `<div class="warnbox"><b>${esc(d.name)}</b> <span class="ltag l${d.layer}">ชั้น ${d.layer}</span> ถูกยิงพร้อมกัน ${d.campaigns.length} แคมเปญ เข้าถึงรวม ${n0(d.reach)} ครั้ง คนเดียวกันอาจเห็นโฆษณาหลายตัวต่อวัน ถ้าเพิ่มงบให้เพิ่มที่ตัวเดียวและดู ROAS ของตัวอื่นว่าตกหรือไม่<div class="small muted">${d.campaigns.map(shortCamp).map(esc).join(' · ')}</div></div>`).join('') : 'ไม่มี';
}

// ---------- พฤติกรรมคนดู ----------
function renderBehaviour() {
  const D = day(); if (!D) { $('#behaviour').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  if (!D.behaviour && D.ads && D.adsets) { D.behaviour = buildBehaviour(D.ads, D.adsets); save(KEYS.days, state.days); }
  const B = D.behaviour; if (!B) { $('#behaviour').textContent = 'ไม่มีข้อมูล'; return; }
  const clipShort = n => String(n).replace(/^\d+\.\d+\.\d+\s*/, '').replace(/\s*\(คลิปฟรี\)/, '').trim();
  const tags = t => t.map(x => `<span class="btag ${x}">${x}</span>`).join(' ');
  const pct = v => v === null || v === undefined ? '-' : v.toFixed(1) + '%';
  const sec = v => v === null || v === undefined ? '-' : v.toFixed(1) + ' วิ';
  const money = v => v === null || v === undefined ? '-' : Math.round(v).toLocaleString('en-US');
  const cls = (v, ok, warn, lowerBetter = false) => v === null || v === undefined ? '' : lowerBetter ? (v <= ok ? 'good' : v <= warn ? 'mid' : 'bad') : (v >= ok ? 'good' : v >= warn ? 'mid' : 'bad');
  const R = B.rules;
  const clipRow = c => `<tr><td class="name"><b>${esc(clipShort(c.name))}</b><small><span class="tag tag-${esc(c.stage)}">${esc(c.stage)}</span> ${esc(c.product || '')} · ชั้น ${c.layers.join(',')} ${c.role ? `· <i>${esc(c.role)}</i>` : ''}</small></td><td>${tags(c.tags)}</td><td class="r num">${money(c.spend)}</td><td class="r num ${cls(c.thruPct, R.watchThru, 5)}">${pct(c.thruPct)}</td><td class="r num ${cls(c.avgWatch, R.watchSec, 4)}">${sec(c.avgWatch)}</td><td class="r num ${cls(c.ctr, 1.5, 1)}">${c.ctr === null ? '-' : c.ctr.toFixed(2)}</td><td class="r num">${money(c.msgs)}</td><td class="r num ${cls(c.costPerMsg, R.chatCost, R.chatCostOk, true)}">${money(c.costPerMsg)}</td><td class="r num ${cls(c.costPerThru, R.thruCostOk, 3, true)}">${c.costPerThru === null ? '-' : c.costPerThru.toFixed(2)}</td><td class="r num">${money(c.purch)}${c.noval ? `<span class="muted small"> (${c.noval})</span>` : ''}</td><td class="r num ${roasCls(c.roas)}">${n2(c.roas)}</td></tr>`;
  const head = `<thead><tr><th>คลิป</th><th>พฤติกรรม</th><th class="r">ใช้จ่าย</th><th class="r">ThruPlay</th><th class="r">เวลาดู</th><th class="r">CTR%</th><th class="r">แชท</th><th class="r">ต่อแชท</th><th class="r">ต่อThruPlay</th><th class="r">ออเดอร์</th><th class="r">ROAS</th></tr></thead>`;
  const table = rows => `<div class="tbl-wrap"><table class="tbl">${head}<tbody>${rows.map(clipRow).join('') || '<tr><td colspan="11" class="muted">-</td></tr>'}</tbody></table></div>`;
  const byWatch = [...B.clips].filter(c => c.thruPct !== null).sort((a, b) => b.thruPct - a.thruPct).slice(0, 10);
  const byChat = [...B.clips].filter(c => c.costPerMsg !== null).sort((a, b) => a.costPerMsg - b.costPerMsg).slice(0, 10);
  const bySell = [...B.clips].filter(c => c.roas !== null && c.roas >= R.buyRoas).sort((a, b) => b.roas - a.roas).slice(0, 10);
  const audRow = a => `<tr><td><span class="ltag l${a.layer}">${a.layer}</span> <b>${esc(a.name)}</b><div class="small muted">${a.campaigns} แคมเปญ</div></td><td>${tags(a.tags)}</td><td class="r num">${money(a.spend)}</td><td class="r num ${cls(a.thruPct, R.watchThru, 5)}">${pct(a.thruPct)}</td><td class="r num ${cls(a.avgWatch, R.watchSec, 4)}">${sec(a.avgWatch)}</td><td class="r num ${cls(a.ctr, 1.5, 1)}">${a.ctr === null ? '-' : a.ctr.toFixed(2)}</td><td class="r num ${cls(a.costPerMsg, R.chatCost, R.chatCostOk, true)}">${money(a.costPerMsg)}</td><td class="r num ${roasCls(a.roas)}">${n2(a.roas)}</td><td class="reason">${esc(a.read)}</td></tr>`;
  $('#behaviour').innerHTML = `
    ${!B.hasVideoStats ? '<div class="warnbox">ไฟล์นี้ไม่มีคอลัมน์ ThruPlay / เวลาเล่นวิดีโอเฉลี่ย (export แบบเก่า) แสดงได้เฉพาะ CTR แชท และยอด ถ้าอยากเห็นพฤติกรรมการดู ให้ export ใหม่โดยเพิ่มคอลัมน์ "ThruPlay" "เวลาเล่นวิดีโอเฉลี่ย" "การเล่นวิดีโอที่ 100%" "ยอดดู"</div>' : ''}
    <h3 class="sec-h">1. คลิปที่ดึงคนดูได้ดีที่สุด (เรียงตาม ThruPlay)</h3>${table(byWatch)}
    <p class="note">คลิปให้ความรู้/แฉ/เทียบ มักอยู่บนสุด: ดูนาน ต่อ ThruPlay ถูก เหมาะสร้างกลุ่ม "คนดูจบ" ไม่ใช่ตัวปิดการขาย</p>
    <h3 class="sec-h">2. คลิปที่ทำให้คนทักแชทถูกที่สุด (เรียงตามต่อแชท)</h3>${table(byChat)}
    <p class="note">แชทที่เริ่มคำนวณจาก ใช้จ่าย ÷ ต้นทุนต่อแชท ที่ Meta รายงาน ส่วนแชทเหล่านี้ปิดการขายได้กี่ % ต้องดูจากระบบแชท (Pancake) ไม่ใช่จาก Meta</p>
    <h3 class="sec-h">3. คลิปที่ขาย (ROAS ≥ ${R.buyRoas})</h3>${table(bySell)}
    <h3 class="sec-h">4. กลุ่มเป้าหมายไหน ดู · ทัก · ซื้อ</h3>
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>กลุ่ม (ชั้น · ส่วนแรกของชื่อชุด)</th><th>พฤติกรรม</th><th class="r">ใช้จ่าย</th><th class="r">ThruPlay</th><th class="r">เวลาดู</th><th class="r">CTR%</th><th class="r">ต่อแชท</th><th class="r">ROAS</th><th>อ่านว่า</th></tr></thead><tbody>${B.audiences.map(audRow).join('')}</tbody></table></div>
    <p class="note">ยิ่งกลุ่มใกล้การซื้อยิ่งไม่ดูวิดีโอ คลิปยาวให้ความรู้ทำงานได้เฉพาะชั้น 1-2 ชั้นที่ใกล้ซื้อต้องการข้อเสนอที่จบใน 3 วินาทีแรก</p>
    <h3 class="sec-h">5. กลยุทธ์: กลุ่มไหนควรเห็นคอนเทนต์แบบไหน (คลิปแนะนำเลือกจากข้อมูลวันนี้)</h3>
    <div class="strat">${B.strategy.map(S => `<div class="scard s${S.key}"><h4>${esc(S.name)} <span>งบ ${S.share}%</span></h4>
      <div class="sb"><span class="k">ใครเห็น</span>${esc(S.who)}</div><div class="sb"><span class="k">ตัดออก</span>${esc(S.exclude)}</div><div class="sb"><span class="k">คอนเทนต์</span>${esc(S.content)}</div>
      <div class="sb"><span class="k">คลิปที่มีและเข้าเกณฑ์</span>${S.clips.length ? `<ul>${S.clips.map(c => `<li>${esc(clipShort(c))}</li>`).join('')}</ul>` : '<span class="bad">ยังไม่มีคลิปที่เข้าเกณฑ์ ต้องทำใหม่</span>'}</div>
      <div class="sb"><span class="k">กลุ่มที่ใช้อยู่ตอนนี้</span>${S.audiencesNow.length ? esc(S.audiencesNow.join(' · ')) : '<span class="bad">ยังไม่มีชุดโฆษณาในชั้นนี้</span>'}</div>
      <div class="sb"><span class="k">วัดด้วย</span>${esc(S.metric)}</div></div>`).join('')}</div>
    <p class="note">วิธีตั้งกลุ่มเป้าหมายและแคมเปญตามตารางนี้ทีละขั้น อยู่ในไฟล์ คู่มือตั้งกรวย-4-กลุ่ม.md ในโฟลเดอร์งาน</p>`;
}

// ---------- รายงานรายวัน + สรุปเจ้านาย ----------
function ensureDaily(D) { if (!D.daily && D.campaigns) { D.daily = buildDaily(D.campaigns, [], D.totals, D.date); save(KEYS.days, state.days); } return D.daily; }
function actualBoxHtml(D, where) {
  const act = D.actual || {}, bp = act.byProduct || {}, names = (D.products || []).filter(p => p.spend > 0 && p.name !== 'ไม่ระบุ').map(p => p.name);
  return `<div class="actbox" data-where="${where}"><div class="actbox-h"><b>ยอดขายจริงจากออเดอร์ของวันนี้</b><span class="small muted">${act.rev > 0 ? 'กรอกแล้ว รายงานใช้ยอดจริง · แก้ได้' : 'ยังไม่ได้กรอก รายงานใช้ยอดจาก Meta ไปก่อน'}</span></div>
    <div class="actbox-g"><label>ยอดขายจริงรวม (บาท)<input type="number" min="0" data-ab="rev" value="${act.rev ?? ''}" placeholder="เช่น 45000"></label><label>จำนวนออเดอร์จริง<input type="number" min="0" data-ab="orders" value="${act.orders ?? ''}" placeholder="เช่น 60"></label>
    ${names.map(n => `<label>${esc(n)} (บาท)<input type="number" min="0" data-ab-prod="${esc(n)}" value="${(bp[n] || {}).rev ?? ''}" placeholder="ไม่กรอกก็ได้"></label>`).join('')}
    <button class="btn" data-ab-save>บันทึกยอดจริง</button></div></div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ab-save]'); if (!b) return; const D = day(); if (!D) return;
  const box = b.closest('.actbox'), num = v => { const n = parseFloat(v); return isNaN(n) || n < 0 ? null : n; };
  const old = D.actual || {}, act = { rev: num(box.querySelector('[data-ab="rev"]').value), orders: num(box.querySelector('[data-ab="orders"]').value), note: old.note || '', byProduct: { ...(old.byProduct || {}) }, updatedAt: new Date().toISOString() };
  box.querySelectorAll('[data-ab-prod]').forEach(i => { const n = i.dataset.abProd; act.byProduct[n] = { ...(act.byProduct[n] || {}), rev: num(i.value) }; });
  const sumProd = Object.values(act.byProduct).reduce((t, x) => t + (x.rev || 0), 0);
  if (act.rev === null && sumProd > 0) act.rev = sumProd;                       // กรอกแยกสินค้าอย่างเดียว → รวมให้
  if (act.rev !== null && sumProd > act.rev * 1.01) { toast('ยอดแยกสินค้ารวมกันเกินยอดรวม ตรวจอีกครั้ง'); return; }
  D.actual = act.rev === null ? null : act; save(KEYS.days, state.days); renderOverview(); renderDaily(); renderBoss(); renderWeekly();
  toast(D.actual ? 'บันทึกยอดจริงแล้ว รายงานใช้ยอดจริง' : 'ล้างยอดจริงแล้ว'); AB.emit('actual:saved', { date: state.date, actual: D.actual });
});
function deltaHtml(v, base, lowerBetter, label, fmt = n0) {
  if (v === null || v === undefined || !base) return ''; const d = (v - base) / base * 100, good = (d < 0) === lowerBetter;
  return `<div class="d ${good ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(0)}% จาก ${label} (${fmt(base)})</div>`;
}
function renderDaily() {
  const D = day(); if (!D) { $('#daily').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  const Y = ensureDaily(D); if (!Y) { $('#daily').textContent = 'ไม่มีข้อมูล'; return; }
  const P = prevDay(), PK = P && ensureDaily(P) ? P.daily.kpis : null, pl = P ? thDate(P.date) : '';
  const K = Y.kpis, R = Y.rules, AM = actualMetrics(D.totals, D.products, D.actual), over = (AM ? AM.adpct : K.adpct) > R.target, hasBud = Y.budget.has, sx = { male: 'ชาย', female: 'หญิง' };
  const rowsHtml = (rs, old) => rs.map(r => `<tr><td class="name">${esc(r.name)}${r.isNew ? ' <span class="newtag">ใหม่</span>' : ''}</td><td class="r num">${n0(r.spend)}</td>${hasBud ? `<td class="r num ${r.use >= R.fullUse ? 'fulluse' : ''}">${r.use === null ? '-' : Math.round(r.use) + '%'}</td>` : ''}<td class="r num">${n0(r.msgs)}</td><td class="r num b">${r.cp === null ? '-' : Math.round(r.cp)}</td><td class="r num">${n0(r.purch)}${r.noval ? ` <span class="muted small">(${n0(r.noval)} ไม่มียอด)</span>` : ''}</td><td class="r num">${n0(r.rev)}</td>${old ? `<td class="r num b">${n1(r.roas)}</td>` : ''}</tr>`).join('');
  const block = (k, title, rule, old) => { const g = Y.groups[k]; const sum = f => g.reduce((t, r) => t + r[f], 0);
    return `<div class="dl-grp ${k}"><h4><i class="dot ${k}"></i>${title} <em>${g.length} ตัว · ใช้ ${n0(sum('spend'))} · ทัก ${n0(sum('msgs'))} · ยอด ${n0(sum('rev'))}</em></h4><p class="note">${rule}</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>แคมเปญ</th><th class="r">ใช้</th>${hasBud ? '<th class="r">ใช้งบ</th>' : ''}<th class="r">ทัก</th><th class="r">บาท/ทัก</th><th class="r">ออเดอร์</th><th class="r">ยอด</th>${old ? '<th class="r">ROAS</th>' : ''}</tr></thead><tbody>${rowsHtml(g, old) || `<tr><td colspan="8" class="muted">ไม่มี</td></tr>`}</tbody></table></div></div>`; };
  const ag = Y.ageGender, best = ag.length ? [...ag].sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0))[0] : null, cheap = ag.length ? [...ag].filter(a => a.cp).sort((a, b) => a.cp - b.cp)[0] : null;
  const PAM = P ? actualMetrics(P.totals, P.products, P.actual) : null, bpA = AM ? Object.entries(AM.byProduct) : [];
  const realStrip = AM ? `<div class="realbar ${AM.adpct > R.target ? 'over' : 'pass'}"><div class="rb-main"><span>ค่าแอดจากยอดขายจริง</span><b>${n1(AM.adpct)}%</b><em>${AM.adpct > R.target ? `เกินเป้า ${R.target}% อยู่ ${n1(AM.adpct - R.target)} จุด` : `ผ่านเป้า ${R.target}% เหลืออีก ${n1(R.target - AM.adpct)} จุด`}</em></div>
      <div class="rb-calc"><div>ใช้เงิน <b>${n0(K.spend)}</b> ÷ ยอดขายจริง <b>${n0(AM.rev)}</b>${AM.orders ? ` (${n0(AM.orders)} ออเดอร์ · ออเดอร์ละ ${n0(AM.aov)} บาท · ค่าแอดต่อออเดอร์ ${n0(AM.cpp)} บาท)` : ''}</div>
        <div>ตาม Meta ค่าแอด ${n0(K.adpct)}% เพราะ Meta เห็นยอดแค่ ${n0(K.rev)} บาท (${n0(AM.metaCoverage)}% ของยอดจริง)${PAM ? ` · ${thDate(P.date)} ค่าแอดจริง ${n1(PAM.adpct)}% ${AM.adpct < PAM.adpct ? '▼ ดีขึ้น' : '▲ แย่ลง'}` : ''}</div>
        ${bpA.length ? `<div class="rb-prod">${bpA.map(([n, x]) => `<span class="${x.adpct > R.target ? 'over' : 'pass'}"><b>${esc(n)}</b> ${n0(x.adpct)}%<small>ยอดจริง ${n0(x.rev)}</small></span>`).join('')}</div>` : '<div class="muted small">กรอกยอดจริงแยกสินค้าด้านบน จะเห็นค่าแอดจริงของแต่ละสินค้า</div>'}</div></div>`
    : `<div class="realbar none"><div class="rb-main"><span>ค่าแอดจากยอดขายจริง</span><b>?</b><em>ยังไม่ได้กรอก</em></div><div class="rb-calc"><div>กรอก <b>ยอดขายจริงจากออเดอร์</b> ในกล่องด้านบน แล้วกดบันทึก ตัวเลขนี้จะขึ้นทันที</div><div>ตอนนี้รู้แค่ค่าแอดตาม Meta ${n0(K.adpct)}% ซึ่ง Meta มักเห็นยอดไม่ครบ${K.noval ? ` และวันนี้มี ${n0(K.noval)} ออเดอร์ที่ Meta นับแต่ไม่มียอดเงิน` : ''}</div></div></div>`;
  $('#daily').classList.remove('empty');
  $('#daily').innerHTML = `
    ${actualBoxHtml(D, 'daily')}
    <div class="brief-head"><span class="small muted">วันที่ ${thDate(Y.date)}</span><h3>${esc(AM ? `ค่าแอดจริง ${n0(AM.adpct)}% ${AM.adpct > R.target ? 'เกินเป้า' : 'ผ่านเป้า'} (Meta ${n0(K.adpct)}%) · ` + Y.headline.split(' · ').slice(1).join(' · ') : Y.headline)}</h3></div>
    ${realStrip}
    <div class="cards">
      <div class="stat"><div class="t">ใช้เงินไป</div><div class="v num">${n0(K.spend)}</div>${deltaHtml(K.spend, PK && PK.spend, true, pl)}</div>
      <div class="stat ${AM ? 'actual' : ''}"><div class="t">${AM ? 'ยอดขายจริง' : 'ได้ยอด (Meta)'} · ออเดอร์${AM ? (AM.orders ? 'จริง ' + n0(AM.orders) : '') : 'มีมูลค่า ' + n0(K.valued)}</div><div class="v num">${n0(AM ? AM.rev : K.rev)}</div>${AM ? `<div class="sub">Meta เห็น ${n0(K.rev)} (${n0(AM.metaCoverage)}% ของจริง)</div>` : (K.noval ? `<div class="sub">อีก ${n0(K.noval)} ออเดอร์ Meta นับแต่ไม่มีมูลค่า อย่าเชื่อ</div>` : '')}</div>
      <div class="stat ${over ? 'br-over' : 'br-pass'}"><div class="t">ค่าแอด${AM ? 'จริง' : ''} · เป้าไม่เกิน ${R.target}%</div><div class="v num">${n0(AM ? AM.adpct : K.adpct)}%</div>${AM ? `<div class="sub">ตาม Meta ${n0(K.adpct)}%</div>` : deltaHtml(K.adpct, PK && PK.adpct, true, pl, v => n0(v) + '%')}</div>
      <div class="stat"><div class="t">คนทัก · คนละ ${n0(K.cp)} บาท</div><div class="v num">${n0(K.msgs)}</div>${deltaHtml(K.cp, PK && PK.cp, true, pl, v => n0(v) + ' บาท/ทัก')}</div>
    </div>
    <h3 class="sec-h">1. ช่วงเวลาและงบ</h3>
    <div class="dl-two"><div>
      <div class="dl-nohour"><b>ยังดูช่วงเวลาไม่ได้</b> ไฟล์ Meta ปกติไม่แยกชั่วโมง วิธีดึง: Ads Manager → รายงาน → Breakdown → ตามเวลา → <b>ช่วงเวลาของวัน (เขตเวลาของบัญชีโฆษณา)</b> ระดับแคมเปญ หรือดูเวลาคนกดโฆษณาจากไฟล์แชท Pancake ของวันเดียวกัน<br>ข้อมูลที่มี (15 ก.ย.): คนกดโฆษณา 78% เข้ามาก่อนเที่ยง หลัง 17:00 เหลือ 6% แต่ตอบต่อ 65% เทียบกลางวัน 27%</div>
      ${hasBud ? `<div class="brief-top blue"><b>งบหมด ${Y.budget.full} จาก ${Y.budget.count} แคมเปญ (ใช้งบ ${R.fullUse}% ขึ้นไป)</b><p>ใช้จริง ${n0(Y.budget.used)} จากงบที่ตั้ง ${n0(Y.budget.set)} บาท (${n0(Y.budget.used / Y.budget.set * 100)}%) ตัวที่งบหมดจะหยุดวิ่งเอง ถ้าหมดก่อนเย็นจะพลาดช่วง 17:00-22:00</p></div>` : '<p class="note">ไฟล์นี้ไม่มีคอลัมน์ "งบประมาณของแคมเปญ" เพิ่มคอลัมน์นี้ตอน export จะเห็นว่าตัวไหนงบหมด</p>'}
    </div><div>${ag.length ? `<p class="dl-cap">ใครทัก ใครซื้อ (อายุ × เพศ ที่ใช้เงินเกิน ${R.ageMinSpend} บาท)</p><div class="tbl-wrap"><table class="tbl"><thead><tr><th>กลุ่ม</th><th class="r">ใช้</th><th class="r">ทัก</th><th class="r">บาท/ทัก</th><th class="r">ยอด</th><th class="r">ROAS</th></tr></thead><tbody>${ag.map(a => `<tr><td><b>${sx[a.gender] || esc(a.gender)} ${esc(a.age)}</b></td><td class="r num">${n0(a.spend)}</td><td class="r num">${n0(a.msgs)}</td><td class="r num b">${n0(a.cp)}</td><td class="r num">${n0(a.rev)}</td><td class="r num b">${n1(a.roas)}</td></tr>`).join('')}</tbody></table></div><p class="note">ซื้อดีสุด: ${sx[best.gender]} ${esc(best.age)} (ROAS ${n1(best.roas)})${cheap ? ` · ทักถูกสุด: ${sx[cheap.gender]} ${esc(cheap.age)} (${n0(cheap.cp)} บาท)` : ''} กลุ่มที่ทักถูกอาจไม่ใช่กลุ่มที่ซื้อ</p>` : '<p class="note">ไฟล์นี้ไม่ได้แยกอายุและเพศ</p>'}</div></div>
    <h3 class="sec-h">2. กติกาคุมแอดด้วย "บาทต่อคนทัก" <span class="small muted">ดู 2 รอบต่อวัน 13:00 และ 21:30 · ห้ามปิดแอดช่วง 17:00-22:00</span></h3>
    <div class="dl-rules">
      <div class="dl-rl green"><b><i class="dot green"></i>ทักไม่เกิน ${R.green} บาท</b>ห้ามปิด แม้ยังไม่มียอด คนทักวันนี้ครึ่งหนึ่งไปซื้อวันถัดไป ตัดสินเรื่องยอดหลังวิ่งครบ 3 วัน</div>
      <div class="dl-rl yellow"><b><i class="dot yellow"></i>ทัก ${R.green + 1}-${R.yellow} บาท หรือเพิ่งเริ่ม</b>คงงบเดิม ห้ามเพิ่ม ดูอีก 1 วัน ถ้าเป็นแดง 2 วันติดค่อยปิด</div>
      <div class="dl-rl red"><b><i class="dot red"></i>ทักเกิน ${R.yellow} บาท หรือไม่มีคนทัก</b>ใช้เงินเกิน ${R.minSpend} บาทแล้ว ลดงบครึ่งหนึ่ง วันที่ 2 ยังแดง = ปิด</div>
      <div class="dl-rl old"><b><i class="dot old"></i>ยิงหาคนที่รู้จักเราแล้ว</b>ลูกค้าเก่า คนดูคลิป คนเคยทัก ไม่ดูบาทต่อทัก ดูยอด ROAS 4 ขึ้นไปเพิ่มงบได้ ต่ำกว่า 2 สามวันติด = ปิด</div>
    </div>
    <h3 class="sec-h">3. แคมเปญวันนี้ แยกตามไฟ <span class="small muted">หาคนใหม่เรียงจากทักถูกไปแพง${hasBud ? ' · ตัวแดงในช่อง "ใช้งบ" = งบหมด' : ''}</span></h3>
    <div class="dl-grid">${block('green', 'หาคนใหม่ · ห้ามปิด', `มี ${Y.gnobuy} ตัวที่ทักถูกแต่ยังไม่มียอดที่มีมูลค่า ตัวพวกนี้คือตัวที่มักโดนปิดผิด`)}${block('old', 'คนที่รู้จักเราแล้ว', 'ลูกค้าเก่า + คนดูคลิป + คนเคยทัก ดูยอดอย่างเดียว เรียงจาก ROAS สูงไปต่ำ', true)}${block('yellow', 'หาคนใหม่ · คงไว้ ดูอีกวัน', 'ห้ามเพิ่มงบ')}${block('red', 'หาคนใหม่ · ลดงบครึ่ง / ปิด', `ทักแพงหรือไม่มีคนทัก และใช้เงินเกิน ${R.minSpend} บาทแล้ว`)}</div>
    <h3 class="sec-h">4. ทำพรุ่งนี้ 3 ข้อ</h3>
    <div class="brief-3">${Y.todo.map(t => `<div class="brief-box"><h4>${esc(t.t)}</h4>${esc(t.d)}</div>`).join('')}</div>`;
}
function renderBoss() {
  const D = day(); if (!D) { $('#boss').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  const Y = ensureDaily(D); if (!Y) { $('#boss').textContent = 'ไม่มีข้อมูล'; return; }
  const P = prevDay(), B = buildBoss(Y, D.layers, D.products, D.actual, P ? ensureDaily(P) : null), K = B.kpis, over = K.adpct !== null && K.adpct > B.target, MAX = Math.max(450, ...B.groups.map(g => g.ret), ...B.prods.map(g => g.ret)) * 1.05;
  const bar = g => { const ok = g.ret >= B.need, w = g.ret / MAX * 100, col = ok ? '#2f9e6b' : g.ret >= B.need * 0.75 ? '#d97706' : '#c2410c', inside = w >= 72;
    return `<div class="boss-br"><div class="boss-bl"><b>${esc(g.label)}</b><small>ใช้ ${n0(g.spend)} · ${n0(g.share)}% ของงบ${g.real ? ' · ยอดจริง' : ''}</small></div><div class="boss-bt"><i style="width:${w.toFixed(1)}%;background:${col}"></i><span class="boss-ref" style="left:${(B.need / MAX * 100).toFixed(1)}%"></span><em style="${inside ? `left:calc(${w.toFixed(1)}% - 54px);color:#fff` : `left:calc(${w.toFixed(1)}% + 8px)`}">${n0(g.ret)}</em></div><div class="boss-bn ${ok ? 'ok' : 'no'}">${ok ? '✓ คืนทุน' : g.ret >= B.need * 0.75 ? '✗ เกือบผ่าน' : '✗ ยังไม่คืนทุน'}</div></div>`; };
  $('#boss').classList.remove('empty');
  $('#boss').innerHTML = `
    ${actualBoxHtml(D, 'boss')}
    <div class="boss-sheet"><span class="boss-eyebrow">${esc(state.settings.appName || 'BLISSTECH AdBoard')} · สรุปแอดสำหรับผู้บริหาร · ${thDate(B.date)}</span>
    <h3 class="boss-h1">${esc(B.headline)}</h3><p class="boss-lead">${esc(B.lead)}</p>
    <div class="cards boss-kpis">
      <div class="stat"><div class="t">ใช้เงินไป</div><div class="v num">${n0(K.spend)}</div>${K.prevSpend ? `<div class="sub">${thDate(P.date)} ใช้ ${n0(K.prevSpend)}</div>` : ''}</div>
      <div class="stat ${B.real ? 'actual' : ''}"><div class="t">${B.real ? 'ยอดขายจริงจากออเดอร์' : 'ยอดขาย (Meta)'}</div><div class="v num">${n0(K.rev)}</div><div class="sub">${B.real ? `Meta เห็น ${n0(K.metaRev)}${K.orders ? ' · ' + n0(K.orders) + ' ออเดอร์จริง' : ''}` : `ออเดอร์ที่มียอดเงินจริง ${n0(K.valued)}`}</div></div>
      <div class="stat ${over ? 'br-over' : 'br-pass'}"><div class="t">ค่าแอด${B.real ? 'จริง' : ''} · เป้าไม่เกิน ${B.target}%</div><div class="v num">${n0(K.adpct)}%</div><div class="sub">ขาย 100 บาท จ่ายค่าแอด ${n0(K.adpct)} บาท${B.real ? ` · ตาม Meta ${n0(K.metaAdpct)}%` : ''}</div></div>
      <div class="stat"><div class="t">คนทักแชท</div><div class="v num">${n0(K.msgs)}</div><div class="sub">คนละ ${n0(K.cp)} บาท${K.prevCp ? (K.cp < K.prevCp ? ' ถูกลงจาก ' : ' แพงขึ้นจาก ') + n0(K.prevCp) : ''}</div></div>
    </div>
    <h3 class="sec-h">ลงทุนค่าแอด 100 บาท ได้ยอดขายกลับมากี่บาท <span class="small muted">เส้นประ = ${B.need} บาท คือจุดที่ค่าแอดเท่ากับเป้า ${B.target}% พอดี</span></h3>
    <div class="boss-cols"><div><p class="dl-cap">แยกตามคนที่เรายิงหา (ยอดจาก Meta)</p>${B.groups.map(bar).join('')}</div><div><p class="dl-cap">แยกตามสินค้า</p>${B.prods.map(bar).join('')}</div></div>
    ${B.problems.length ? `<h3 class="sec-h">${B.problems.length} เรื่องที่ทำให้ค่าแอด${over ? 'เกิน' : 'ยังลดได้อีก'} และวิธีแก้</h3><div class="boss-cards">${B.problems.map((p, i) => `<div class="boss-c"><div class="p"><span>ปัญหา ${i + 1}</span><b>${esc(p.title)}</b><small>${esc(p.detail)}</small></div><div class="f"><span>วิธีแก้</span><p>${esc(p.fix)}</p></div>${p.result ? `<div class="r">${esc(p.result)}</div>` : ''}</div>`).join('')}</div>` : ''}
    <h3 class="sec-h">ผลที่คาด และสิ่งที่ขอให้ตัดสินใจ</h3>
    <div class="boss-bottom"><div class="brief-box"><h4>ขอให้เจ้านายตัดสิน ${B.decisions.length} ข้อ</h4><ol>${B.decisions.map(d => `<li><b>${esc(d.t)}</b><small>${esc(d.d)}</small></li>`).join('') || '<li>ไม่มีเรื่องต้องตัดสิน ทำต่อแบบเดิม</li>'}</ol></div>
      <div class="boss-result"><h4>ค่าแอดที่คาดหลังย้ายงบ</h4><div class="rr"><div><b>${n0(B.expect.now)}%</b><span>วันนี้</span></div><div class="ar">→</div><div><b>${n0(B.expect.next)}%</b><span>ภายใน 3-5 วัน</span></div></div><p>${B.expect.move ? `คิดจาก: ย้ายเงิน ${n0(B.expect.move)} บาทจากจุดที่ไม่คืนทุนไปจุดที่คืนทุนอยู่แล้ว ยอดขายจะเพิ่มจาก ${n0(B.expect.revNow)} เป็นราว ${n0(B.expect.revNext)} ด้วยเงินเท่าเดิม เป็นค่าประมาณแบบระวัง` : 'ไม่ต้องย้ายงบ'}${B.real ? '' : ' · ยอดยังเป็นของ Meta กรอกยอดจริงด้านบนเพื่อให้ตัวเลขนี้ตรงขึ้น'}</p></div></div>
    ${B.good.length ? `<div class="boss-good"><b>สิ่งที่ทีมทำดีแล้ว:</b> ${esc(B.good.join(' · '))}</div>` : ''}</div>`;
}
async function viewPngBlob(elSel, prefix, title) {
  const D = prefix === 'weekly' ? (curWeek() && { date: curWeek().start + '_' + curWeek().end }) : day(); if (!D) throw new Error('โหลดไฟล์ก่อน');
  if (!window.htmlToImage) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js'; sc.onload = ok; sc.onerror = () => no(new Error('โหลดตัวสร้างรูปไม่ได้ ตรวจอินเทอร์เน็ต')); document.head.appendChild(sc); });
  let stage = document.getElementById('viewRender'); if (!stage) { stage = document.createElement('div'); stage.id = 'viewRender'; stage.style.cssText = 'position:fixed;left:-30000px;top:0;width:1400px;z-index:-1;pointer-events:none'; document.body.appendChild(stage); }
  stage.innerHTML = `<div id="viewSheet" style="width:1400px;background:#F2F9FD;padding:24px;box-sizing:border-box"><div style="font-size:13px;color:#33475e;margin-bottom:6px">${esc(state.settings.appName || 'BLISSTECH AdBoard')} · ${esc(title)}</div>${$(elSel).innerHTML}</div>`;
  stage.querySelectorAll('.actbox').forEach(n => n.remove());                      // ช่องกรอกไม่ต้องอยู่ในรูป
  await new Promise(r => setTimeout(r, 250));
  const blob = await window.htmlToImage.toBlob(stage.querySelector('#viewSheet'), { pixelRatio: 1.5, backgroundColor: '#F2F9FD' }); if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
  return { blob, name: `${prefix}-${D.date}.png` };
}
function wireExport(view, elSel, prefix, title, captionFn) {
  const msg = $(`#${view}Msg`), bPng = $(`#btn${view[0].toUpperCase() + view.slice(1)}Png`), bTg = $(`#btn${view[0].toUpperCase() + view.slice(1)}Tg`);
  bPng.addEventListener('click', async () => { bPng.disabled = true; msg.textContent = 'กำลังสร้างรูป...';
    try { const { blob, name } = await viewPngBlob(elSel, prefix, title); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); msg.textContent = `ดาวน์โหลด ${name} แล้ว (${Math.round(blob.size / 1024)} KB)`; } catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { bPng.disabled = false; } });
  bTg.addEventListener('click', async () => { const D = view === 'weekly' ? (curWeek() && { date: curWeek().start }) : day(); if (!D) { msg.textContent = 'โหลดไฟล์ก่อน'; return; }
    if (!tgReady()) { msg.textContent = 'ตั้งค่า Telegram ในหน้าตั้งค่าก่อน'; showView('settings'); return; }
    bTg.disabled = true; msg.textContent = 'กำลังสร้างรูปและส่ง...';
    try { const tg = await tgModule(), S = state.settings, { blob, name } = await viewPngBlob(elSel, prefix, title), caption = captionFn(D) + `\n${location.origin}${location.pathname}#/${view}`; let id;
      try { id = S.tgAsFile ? await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption) : await tg.sendPhoto(S.tgToken, S.tgChat, blob, caption, name); } catch (e) { if (/dimension|too big|PHOTO/i.test(e.message)) id = await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption); else throw e; }
      msg.textContent = `ส่งเข้ากลุ่มแล้ว (ข้อความ #${id})`; toast('ส่งเข้า Telegram แล้ว'); AB.emit('export:sent', { target: 'telegram-' + view, date: D.date, messageId: id });
    } catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { bTg.disabled = false; } });
}
wireExport('daily', '#daily', 'daily', 'รายงานรายวัน', D => { const am = actualMetrics(D.totals, D.products, D.actual); return `รายงานรายวัน ${thDate(D.date)}: ${D.daily ? D.daily.headline : ''}` + (am ? `\nค่าแอดจากยอดขายจริง ${am.adpct.toFixed(1)}% (ยอดจริง ${Math.round(am.rev).toLocaleString('en-US')} บาท)` : '\nยังไม่ได้กรอกยอดขายจริง'); });
wireExport('boss', '#boss', 'boss', 'สรุปผู้บริหาร', D => { const B = buildBoss(ensureDaily(D), D.layers, D.products, D.actual, prevDay() ? ensureDaily(prevDay()) : null); return `สรุปผู้บริหาร ${thDate(D.date)}: ${B.headline}\n${B.lead}`; });

// ---------- สรุปรายสัปดาห์ ----------
const weekKey = (a, b) => `${a}_${b}`;
const curWeek = () => state.week ? state.weeks[state.week] : null;
function prevWeekOf(W) { const ks = Object.keys(state.weeks).filter(k => state.weeks[k].end < W.start).sort(); return ks.length ? state.weeks[ks[ks.length - 1]] : null; }
function commitWeek(A, fileName) {
  const key = weekKey(A.date, A.dateEnd), old = state.weeks[key] || {}, stub = { start: A.date, end: A.dateEnd }, P = prevWeekOf(stub);
  const weekly = buildWeekly(A, A._rows, P ? P.weekly : null, old.actual || null);
  state.weeks[key] = { fileName, uploadedAt: new Date().toISOString(), start: A.date, end: A.dateEnd, weekly, actual: old.actual || null,
    src: { date: A.date, dateEnd: A.dateEnd, totals: A.totals, campaigns: A.campaigns.map(c => ({ name: c.name, product: c.product, layer: c.layer, spend: c.spend, msgs: c.msgs, noval: c.noval, purch: c.purch, rev: c.rev, bud: c.bud, budget: c.budget })), layers: A.layers.map(l => ({ layer: l.layer, spend: l.spend, rev: l.rev })), products: A.products.map(p => ({ name: p.name, spend: p.spend, rev: p.rev, spendShare: p.spendShare })) },
    unresolved: A.unresolved.products.length };
  const ks = Object.keys(state.weeks).sort(); while (ks.length > 12) delete state.weeks[ks.shift()];
  save(KEYS.weeks, state.weeks); state.week = key; renderWeekly(); showView('weekly'); toast(`สรุปสัปดาห์ ${thDate(A.date)} - ${thDate(A.dateEnd)} เสร็จ`);
}
function rebuildWeek(W, useActual) { const P = prevWeekOf(W); const rows = W.weekly.trendRows || []; const keepTrend = W.weekly.trend, keepAge = null;
  const A = { date: W.src.date, dateEnd: W.src.dateEnd, totals: W.src.totals, campaigns: W.src.campaigns, layers: W.src.layers, products: W.src.products };
  const nw = buildWeekly(A, [], P ? P.weekly : null, useActual === undefined ? W.actual : useActual); nw.trend = keepTrend; nw.bestDay = W.weekly.bestDay; nw.worstDay = W.weekly.worstDay; W.weekly = nw; }
/** รวมยอดขายจริงจากไฟล์รายวันที่อยู่ในช่วงของสัปดาห์ (อัตโนมัติ) */
function weekActualFromDays(W) {
  const rows = [], bp = {}; let rev = 0, orders = 0, spendEntered = 0, metaEntered = 0, entered = 0, hasOrders = true;
  for (let t = new Date(W.start + 'T00:00:00Z'), e = new Date(W.end + 'T00:00:00Z'); t <= e; t.setUTCDate(t.getUTCDate() + 1)) {
    const d = t.toISOString().slice(0, 10), D = state.days[d], a = D && D.actual && D.actual.rev > 0 ? D.actual : null;
    rows.push({ date: d, hasFile: !!D, spend: D ? D.totals.spend : null, metaRev: D ? D.totals.rev : null, rev: a ? a.rev : null, orders: a && a.orders > 0 ? a.orders : null, adpct: a ? D.totals.spend / a.rev * 100 : null });
    if (!a) continue; entered++; rev += a.rev; spendEntered += D.totals.spend || 0; metaEntered += D.totals.rev || 0; if (a.orders > 0) orders += a.orders; else hasOrders = false;
    for (const pr of D.products || []) { const x = (a.byProduct || {})[pr.name]; if (x && x.rev > 0) { const o = bp[pr.name] || { rev: 0, spend: 0 }; o.rev += x.rev; o.spend += pr.spend || 0; bp[pr.name] = o; } }
  }
  return { rows, days: rows.length, entered, complete: entered === rows.length && entered > 0, rev, orders: hasOrders && orders > 0 ? orders : null, spendEntered, metaEntered, byProduct: bp, adpctEntered: rev > 0 ? spendEntered / rev * 100 : null };
}
async function readWeekFile(file) {
  const msg = $('#wkDropMsg'); msg.textContent = `กำลังอ่าน ${file.name} ...`;
  try {
    if (!/\.xlsx?$/i.test(file.name)) throw new Error('ต้องเป็นไฟล์ .xlsx จาก Meta Ads');
    if (typeof XLSX === 'undefined') throw new Error('โหลดตัวอ่าน Excel ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วรีเฟรช');
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: true }), sn = wb.SheetNames.find(n => /creative/i.test(n)) || wb.SheetNames[0];
    const A = analyze(XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: null }), state.settings, state.clips, state.manual);
    if (rangeDays(A.date, A.dateEnd) < 2) throw new Error(`ไฟล์นี้เป็นวันเดียว (${thDate(A.date)}) ให้โหลดที่หน้า "โหลดไฟล์" ของรายวัน ช่องนี้รับไฟล์ที่ดึงช่วง 7 วัน`);
    msg.textContent = ''; commitWeek(A, file.name);
  } catch (e) { msg.textContent = ''; $('#wkInfo').innerHTML = `<div class="warnbox">อ่านไฟล์ไม่ได้: ${esc(e.message)}</div>`; }
}
{ const d = $('#wkDrop'), fi = $('#wkFile');
  d.addEventListener('dragover', e => { e.preventDefault(); d.classList.add('over'); }); d.addEventListener('dragleave', () => d.classList.remove('over'));
  d.addEventListener('drop', e => { e.preventDefault(); d.classList.remove('over'); const f = e.dataTransfer.files[0]; if (f) readWeekFile(f); });
  fi.addEventListener('change', e => { const f = e.target.files[0]; if (f) readWeekFile(f); fi.value = ''; });
  $('#wkSelect').addEventListener('change', e => { state.week = e.target.value || null; renderWeekly(); }); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-wk-save]'); if (!b) return; const W = curWeek(); if (!W) return; const box = b.closest('.actbox'), num = v => { const n = parseFloat(v); return isNaN(n) || n < 0 ? null : n; };
  const rev = num(box.querySelector('[data-wk="rev"]').value), orders = num(box.querySelector('[data-wk="orders"]').value);
  W.actual = rev === null ? null : { rev, orders, byProduct: {}, updatedAt: new Date().toISOString() }; save(KEYS.weeks, state.weeks); renderWeekly(); toast(W.actual ? 'บันทึกยอดจริงของสัปดาห์แล้ว' : 'ล้างยอดจริงแล้ว');
});
function trendSvg(T, key, color, fmt, refVal, refLabel) {
  const W = 640, H = 150, L = 34, Rr = 8, Tp = 18, B = 26, vals = T.map(t => t[key] ?? 0), mx = Math.max(...vals, refVal || 0, 1) * 1.12, pw = (W - L - Rr) / T.length, ph = H - Tp - B, peak = vals.indexOf(Math.max(...vals));
  let o = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">`;
  for (const f of [0.5, 1]) { const y = Tp + ph - ph * f; o += `<line x1="${L}" x2="${W - Rr}" y1="${y}" y2="${y}" stroke="#e5eaf2"/><text x="${L - 5}" y="${y + 4}" font-size="10.5" text-anchor="end" fill="#8a94a6">${fmt(mx * f)}</text>`; }
  o += `<line x1="${L}" x2="${W - Rr}" y1="${Tp + ph}" y2="${Tp + ph}" stroke="#c9d2e0"/>`;
  T.forEach((t, i) => { const v = t[key] ?? 0, bh = ph * v / mx, bw = Math.min(pw - 10, 46), x = L + i * pw + (pw - bw) / 2, col = refVal && key === 'adpct' ? (v > refVal ? '#c2410c' : '#2f9e6b') : color;
    if (v > 0) o += `<path d="M${x},${Tp + ph} v${-Math.max(bh - 4, 0)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(bh - 4, 0)} z" fill="${col}"><title>${thDate(t.day)} · ${fmt(v)}</title></path>`;
    if (v > 0 && (T.length <= 8 || i === peak)) o += `<text x="${x + bw / 2}" y="${Tp + ph - bh - 4}" font-size="11" font-weight="700" text-anchor="middle" fill="#14213d">${fmt(v)}</text>`;
    if (T.length <= 10 || i % 2 === 0) o += `<text x="${x + bw / 2}" y="${H - 8}" font-size="10.5" text-anchor="middle" fill="#5b6478">${+t.day.slice(8, 10)}/${+t.day.slice(5, 7)}</text>`; });
  if (refVal) { const y = Tp + ph - ph * refVal / mx; o += `<line x1="${L}" x2="${W - Rr}" y1="${y}" y2="${y}" stroke="#14213d" stroke-dasharray="5 4" opacity=".6"/><text x="${W - Rr}" y="${y - 4}" font-size="10.5" text-anchor="end" fill="#14213d">${refLabel}</text>`; }
  return o + '</svg>';
}
function renderWeekly() {
  const ks = Object.keys(state.weeks).sort().reverse(); if (!state.week || !state.weeks[state.week]) state.week = ks[0] || null;
  $('#wkSelect').innerHTML = ks.length ? ks.map(k => `<option value="${k}"${k === state.week ? ' selected' : ''}>${thDate(state.weeks[k].start)} - ${thDate(state.weeks[k].end)}</option>`).join('') : '<option value="">ยังไม่มี</option>';
  const W = curWeek(), el = $('#weekly'); $('#wkInfo').innerHTML = '';
  if (!W) { el.classList.add('empty'); el.textContent = 'ยังไม่ได้โหลดไฟล์รายสัปดาห์'; return; }
  const AU = weekActualFromDays(W), manual = W.actual && W.actual.rev > 0 ? W.actual : null;
  const autoFull = AU.complete ? { rev: AU.rev, orders: AU.orders, byProduct: Object.fromEntries(Object.entries(AU.byProduct).map(([n, x]) => [n, { rev: x.rev }])) } : null;
  const eff = manual || autoFull, src = manual ? 'manual' : autoFull ? 'auto' : AU.entered ? 'partial' : 'none';
  rebuildWeek(W, eff || null);
  el.classList.remove('empty'); const Y = W.weekly, K = Y.kpis, P = Y.prev, B = Y.boss, over = K.adpct !== null && K.adpct > Y.rules.target, act = W.actual || {};
  const MAX = Math.max(450, ...Y.layers.map(l => l.ret), ...Y.prods.map(p => p.ret)) * 1.05;
  const bar = (label, sub, retv) => { const ok = retv >= Y.need, w = retv / MAX * 100, col = ok ? '#2f9e6b' : retv >= Y.need * 0.75 ? '#d97706' : '#c2410c', inside = w >= 72;
    return `<div class="boss-br"><div class="boss-bl"><b>${esc(label)}</b><small>${sub}</small></div><div class="boss-bt"><i style="width:${w.toFixed(1)}%;background:${col}"></i><span class="boss-ref" style="left:${(Y.need / MAX * 100).toFixed(1)}%"></span><em style="${inside ? `left:calc(${w.toFixed(1)}% - 54px);color:#fff` : `left:calc(${w.toFixed(1)}% + 8px)`}">${n0(retv)}</em></div><div class="boss-bn ${ok ? 'ok' : 'no'}">${ok ? '✓ คืนทุน' : '✗ ยังไม่คืนทุน'}</div></div>`; };
  const list = (rs, f) => rs.length ? `<ol>${rs.map(r => `<li><b>${esc(r.name)}</b><small>${f(r)}</small></li>`).join('')}</ol>` : '<p class="note">ไม่มีตัวที่เข้าเกณฑ์</p>';
  el.innerHTML = `
    <div class="actbox"><div class="actbox-h"><b>กรอกยอดจริงทั้งสัปดาห์เอง (ไม่บังคับ)</b><span class="small muted">${act.rev > 0 ? 'ใช้ยอดที่กรอกเองนี้แทนยอดรวมจากรายวัน · ลบตัวเลขแล้วบันทึกเพื่อกลับไปใช้ยอดรวมอัตโนมัติ' : 'ไม่ต้องกรอกก็ได้ แอปรวมยอดจริงจากรายวันให้เอง · กรอกเฉพาะเมื่อไม่ได้กรอกรายวัน'}</span></div>
      <div class="actbox-g"><label>ยอดขายจริงรวม 7 วัน (บาท)<input type="number" min="0" data-wk="rev" value="${act.rev ?? ''}" placeholder="เช่น 320000"></label><label>จำนวนออเดอร์จริง<input type="number" min="0" data-wk="orders" value="${act.orders ?? ''}" placeholder="เช่น 410"></label><button class="btn" data-wk-save>บันทึกยอดจริง</button></div></div>
    <div class="boss-sheet"><span class="boss-eyebrow">${esc(state.settings.appName || 'BLISSTECH AdBoard')} · สรุปรายสัปดาห์ · ${thDate(Y.start)} - ${thDate(Y.end)} (${Y.days} วัน)</span>
    <h3 class="boss-h1">${esc(Y.headline)}</h3><p class="boss-lead">${esc(B.lead)}</p>
    ${W.unresolved ? `<div class="warnbox">มี ${W.unresolved} แคมเปญที่จับสินค้าไม่ได้ จึงอยู่ในกลุ่ม "ไม่ระบุ" โหลดไฟล์รายวันสักวันแล้วเลือกสินค้าให้ชื่อเหล่านั้น แอปจะจำไว้ใช้กับรายสัปดาห์ด้วย</div>` : ''}
    ${(() => { const T = Y.rules.target, pct = src === 'partial' ? AU.adpctEntered : (eff ? K.spend / eff.rev * 100 : null), cls = pct === null ? 'none' : pct > T ? 'over' : 'pass';
      const dayTbl = `<div class="tbl-wrap"><table class="tbl wk-days"><thead><tr><th>วัน</th>${AU.rows.map(r => `<th class="r">${+r.date.slice(8, 10)}/${+r.date.slice(5, 7)}</th>`).join('')}</tr></thead><tbody>
        <tr><td>ยอดขายจริง</td>${AU.rows.map(r => `<td class="r num">${r.rev !== null ? n0(r.rev) : `<span class="bad small">${r.hasFile ? 'ยังไม่กรอก' : 'ไม่มีไฟล์'}</span>`}</td>`).join('')}</tr>
        <tr><td>ค่าแอดจริง</td>${AU.rows.map(r => `<td class="r num b ${r.adpct === null ? '' : r.adpct > T ? 'bad' : 'good'}">${r.adpct === null ? '-' : n0(r.adpct) + '%'}</td>`).join('')}</tr></tbody></table></div>`;
      const prodChips = src === 'manual' ? '' : Object.entries(AU.byProduct).map(([n, x]) => { const a = x.spend / x.rev * 100; return `<span class="${a > T ? 'over' : 'pass'}"><b>${esc(n)}</b> ${n0(a)}%<small>ยอดจริง ${n0(x.rev)}</small></span>`; }).join('');
      const head = src === 'auto' ? `รวมจากไฟล์รายวันครบ ${AU.days} วัน อัตโนมัติ` : src === 'partial' ? `รวมจากรายวันได้ ${AU.entered} จาก ${AU.days} วัน · ตัวเลขนี้คิดเฉพาะวันที่กรอกแล้ว` : src === 'manual' ? `ใช้ยอดที่กรอกเองด้านบน${AU.entered ? ` (ยอดรวมจากรายวัน ${AU.entered} วัน = ${n0(AU.rev)})` : ''}` : 'ยังไม่มียอดขายจริงของสัปดาห์นี้';
      return `<div class="realbar ${cls}"><div class="rb-main"><span>ค่าแอดจากยอดขายจริง ทั้งสัปดาห์</span><b>${pct === null ? '?' : n1(pct) + '%'}</b><em>${pct === null ? 'ยังไม่มีข้อมูล' : pct > T ? `เกินเป้า ${T}% อยู่ ${n1(pct - T)} จุด` : `ผ่านเป้า ${T}% เหลืออีก ${n1(T - pct)} จุด`}</em></div>
        <div class="rb-calc"><div><b>${head}</b></div>
        ${pct === null ? '<div>กรอกยอดขายจริงในหน้า "รายงานรายวัน" ของแต่ละวัน แอปจะรวมมาให้ที่นี่เอง หรือกรอกยอดรวมทั้งสัปดาห์ในกล่องด้านบน</div>' : `<div>ใช้เงิน <b>${n0(src === 'partial' ? AU.spendEntered : K.spend)}</b> ÷ ยอดขายจริง <b>${n0(src === 'partial' ? AU.rev : eff.rev)}</b>${(src === 'partial' ? AU.orders : eff.orders) ? ` (${n0(src === 'partial' ? AU.orders : eff.orders)} ออเดอร์)` : ''} · ตาม Meta ${n0(src === 'partial' ? (AU.metaEntered > 0 ? AU.spendEntered / AU.metaEntered * 100 : null) : K.metaAdpct)}%</div>`}
        ${AU.rows.length <= 14 ? dayTbl : ''}${prodChips ? `<div class="rb-prod">${prodChips}</div>` : ''}</div></div>`; })()}
    <div class="cards boss-kpis">
      <div class="stat"><div class="t">ใช้เงินทั้งสัปดาห์</div><div class="v num">${n0(K.spend)}</div><div class="sub">เฉลี่ยวันละ ${n0(K.spendPerDay)}</div>${deltaHtml(K.spend, P && P.spend, true, 'สัปดาห์ก่อน')}</div>
      <div class="stat ${Y.real ? 'actual' : ''}"><div class="t">${Y.real ? 'ยอดขายจริงจากออเดอร์' : 'ยอดขาย (Meta)'}</div><div class="v num">${n0(K.rev)}</div><div class="sub">${Y.real ? `Meta เห็น ${n0(K.metaRev)}${K.orders ? ' · ' + n0(K.orders) + ' ออเดอร์จริง' : ''}` : `ออเดอร์มียอดเงิน ${n0(K.valued)}${K.noval ? ' · ไม่มียอด ' + n0(K.noval) : ''}`}</div>${deltaHtml(K.rev, P && P.rev, false, 'สัปดาห์ก่อน')}</div>
      <div class="stat ${over ? 'br-over' : 'br-pass'}"><div class="t">ค่าแอด${Y.real ? 'จริง' : ''} · เป้าไม่เกิน ${Y.rules.target}%</div><div class="v num">${n0(K.adpct)}%</div><div class="sub">${Y.real ? `ตาม Meta ${n0(K.metaAdpct)}%` : `ขาย 100 บาท จ่ายค่าแอด ${n0(K.adpct)} บาท`}</div>${deltaHtml(K.adpct, P && P.adpct, true, 'สัปดาห์ก่อน', v => n0(v) + '%')}</div>
      <div class="stat"><div class="t">คนทักแชท</div><div class="v num">${n0(K.msgs)}</div><div class="sub">วันละ ${n0(K.msgsPerDay)} คน · คนละ ${n0(K.cp)} บาท</div>${deltaHtml(K.cp, P && P.cp, true, 'สัปดาห์ก่อน', v => n0(v) + ' บาท/ทัก')}</div>
    </div>
    <h3 class="sec-h">1. แนวโน้มรายวันในสัปดาห์</h3>
    ${Y.trend.length >= 2 ? `<div class="boss-cols"><div><p class="dl-cap">ค่าแอดแต่ละวัน (%) · แท่งแดง = เกินเป้า</p>${trendSvg(Y.trend, 'adpct', '#3b82c4', v => Math.round(v) + '%', Y.rules.target, 'เป้า ' + Y.rules.target + '%')}</div><div><p class="dl-cap">คนทักแต่ละวัน (คน)</p>${trendSvg(Y.trend, 'msgs', '#3b82c4', v => n0(v))}</div></div>
      <p class="note">${Y.bestDay ? `วันที่ดีที่สุด ${thDate(Y.bestDay.day)} ค่าแอด ${n0(Y.bestDay.adpct)}%` : ''}${Y.worstDay ? ` · วันที่แย่ที่สุด ${thDate(Y.worstDay.day)} ค่าแอด ${n0(Y.worstDay.adpct)}% ให้ย้อนดูว่าวันนั้นเปิดหรือปิดแคมเปญอะไร` : ''}</p>` : `<div class="dl-nohour"><b>ไฟล์นี้ไม่ได้แยกรายวัน</b> จึงเห็นแต่ยอดรวมทั้งสัปดาห์ ถ้าอยากเห็นว่าวันไหนดีวันไหนแย่ ตอน export ให้เพิ่ม Breakdown → ตามเวลา → <b>วัน</b> (ได้คอลัมน์ "วัน" เพิ่มมา) แล้วโหลดใหม่</div>`}
    <h3 class="sec-h">2. เงินทั้งสัปดาห์ไปไหน เทียบกับแผน <span class="small muted">แผน: หาคนใหม่ 30 · คนดูคลิป 25 · คนทัก 10 · ลูกค้าเก่า 35</span></h3>
    <div class="tbl-wrap"><table class="tbl wk-tbl"><thead><tr><th>กลุ่มที่ยิงหา</th><th class="r">ใช้ทั้งสัปดาห์</th><th class="r">วันละ</th><th class="r">สัดส่วนจริง</th><th class="r">แผน</th><th class="r">ต่างจากแผน</th><th class="r">ลงทุน 100 ได้กลับ</th><th>สัปดาห์หน้าควรเป็นวันละ</th></tr></thead><tbody>${Y.layers.map(l => `<tr><td><span class="ltag l${l.layer}">${l.layer}</span> <b>${l.name}</b></td><td class="r num">${n0(l.spend)}</td><td class="r num">${n0(l.perDay)}</td><td class="r num b">${n0(l.share)}%</td><td class="r num">${l.plan}%</td><td class="r num ${Math.abs(l.gap) >= 10 ? 'bad' : ''}">${l.gap > 0 ? '+' : ''}${n0(l.gap)}</td><td class="r num b ${l.spend ? (l.ret >= Y.need ? 'good' : 'bad') : ''}">${l.spend ? n0(l.ret) : '-'}</td><td><b>${n0(Math.round(l.planPerDay / 100) * 100)}</b> <span class="muted small">${l.planPerDay > l.perDay * 1.15 ? '▲ เพิ่ม' : l.planPerDay < l.perDay * 0.85 ? '▼ ลด' : 'คงเดิม'}</span></td></tr>`).join('')}</tbody></table></div>
    <h3 class="sec-h">3. ลงทุนค่าแอด 100 บาท ได้ยอดขายกลับมากี่บาท (ทั้งสัปดาห์) <span class="small muted">เส้นประ = ${Y.need} บาท คือจุดที่ผ่านเป้า</span></h3>
    <div class="boss-cols"><div><p class="dl-cap">แยกตามคนที่เรายิงหา</p>${B.groups.map(g => bar(g.label, `ใช้ ${n0(g.spend)} · ${n0(g.share)}% ของงบ`, g.ret)).join('')}</div><div><p class="dl-cap">แยกตามสินค้า</p>${Y.prods.map(g => bar(g.label, `ใช้ ${n0(g.spend)} · ${n0(g.share)}% ของงบ`, g.ret)).join('')}</div></div>
    <h3 class="sec-h">4. ตัวเด่นและตัวถ่วงของสัปดาห์</h3>
    <div class="brief-3">
      <div class="brief-box wk-good"><h4>ตัวทำเงิน 5 อันดับ</h4>${list(Y.winners, r => `ใช้ ${n0(r.spend)} ได้ ${n0(r.rev)} · ได้กลับ ${n0(r.roas * 100)} ต่อ 100`)}</div>
      <div class="brief-box wk-bad"><h4>ตัวเผาเงิน 5 อันดับ</h4>${list(Y.burners, r => `ใช้ ${n0(r.spend)} ได้ ${n0(r.rev)} · ทัก ${r.cp === null ? '-' : n0(r.cp) + ' บาท/คน'}`)}</div>
      <div class="brief-box"><h4>ตัวเปิดที่คนทักเยอะและถูก</h4>${list(Y.openers, r => `ทัก ${n0(r.msgs)} คน คนละ ${n0(r.cp)} บาท · ใช้ ${n0(r.spend)}`)}</div>
    </div>
    ${B.problems.length ? `<h3 class="sec-h">5. ${B.problems.length} เรื่องที่ต้องแก้สัปดาห์หน้า</h3><div class="boss-cards">${B.problems.map((p, i) => `<div class="boss-c"><div class="p"><span>ปัญหา ${i + 1}</span><b>${esc(p.title)}</b><small>${esc(p.detail)}</small></div><div class="f"><span>วิธีแก้</span><p>${esc(p.fix)}</p></div>${p.result ? `<div class="r">${esc(p.result)}</div>` : ''}</div>`).join('')}</div>` : ''}
    <h3 class="sec-h">${B.problems.length ? 6 : 5}. แผนสัปดาห์หน้า และผลที่คาด</h3>
    <div class="boss-bottom"><div class="brief-box"><h4>ขอให้ตัดสิน ${B.decisions.length} ข้อ</h4><ol>${B.decisions.map(d => `<li><b>${esc(d.t)}</b><small>${esc(d.d)}</small></li>`).join('') || '<li>ไม่มีเรื่องต้องตัดสิน ทำต่อแบบเดิม</li>'}</ol></div>
      <div class="boss-result"><h4>ค่าแอดที่คาดสัปดาห์หน้า</h4><div class="rr"><div><b>${n0(B.expect.now)}%</b><span>สัปดาห์นี้</span></div><div class="ar">→</div><div><b>${n0(B.expect.next)}%</b><span>สัปดาห์หน้า</span></div></div><p>${B.expect.move ? `ย้ายเงินสัปดาห์ละ ${n0(B.expect.move)} บาทจากจุดที่ไม่คืนทุนไปจุดที่คืนทุน ยอดขายจากราว ${n0(B.expect.revNow)} เป็น ${n0(B.expect.revNext)} ด้วยเงินเท่าเดิม เป็นค่าประมาณแบบระวัง` : 'ไม่ต้องย้ายงบ'}</p><p>ไฟสัปดาห์นี้: เขียว ${Y.lights.green} · เหลือง ${Y.lights.yellow} · แดง ${Y.lights.red} · คนที่รู้จักเราแล้ว ${Y.lights.old} แคมเปญ</p></div></div>
    ${B.good.length ? `<div class="boss-good"><b>สิ่งที่ทำได้ดีสัปดาห์นี้:</b> ${esc(B.good.join(' · '))}</div>` : ''}</div>`;
}
wireExport('weekly', '#weekly', 'weekly', 'สรุปรายสัปดาห์', () => { const W = curWeek(); return W ? `สรุปรายสัปดาห์ ${thDate(W.start)} - ${thDate(W.end)}: ${W.weekly.headline}\n${W.weekly.boss.lead}` : 'สรุปรายสัปดาห์'; });
renderWeekly();

// ---------- สรุปวันนี้ (ภาษาง่าย) ----------
function renderBrief() {
  const D = day(); $('#brief').classList.toggle('empty', !D); if (!D) { $('#brief').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  if (!D.brief && D.campaigns) { D.brief = buildBrief(D.campaigns, D.totals, D.layers, D.date); save(KEYS.days, state.days); }
  const B = D.brief; if (!B) { $('#brief').textContent = 'ไม่มีข้อมูล'; return; }
  const K = B.kpis, over = K.adpct !== null && K.adpct > B.target;
  const n1 = v => v.toFixed(1);
  const layerName = { 1: 'คนใหม่', 2: 'คนดูคลิป', 3: 'คนทัก', 4: 'ลูกค้าเก่า' };
  const row = r => `<tr class="br-${r.cls}"><td class="name"><b>${esc(r.name)}</b><small>ใช้ ${n0(r.spend)} บาท · ${layerName[r.layer] || ''}</small></td>
    <td class="c num">${r.layer === 4 ? '-' : r.isStatic ? 'รูป' : Math.round(r.watch)}</td><td class="c num">${n1(r.ask)}</td><td class="c num">${n1(r.buy)}</td>
    <td><span class="btag2 ${r.cls}">${esc(r.tag)}</span></td><td class="say">${esc(r.say)}</td></tr>`;
  $('#brief').classList.remove('empty');
  $('#brief').innerHTML = `
    <div class="brief-head"><span class="small muted">วันที่ ${thDate(B.date)}</span><h3>${esc(B.top.title)}</h3></div>
    <div class="cards">
      <div class="stat"><div class="t">ใช้เงินไป (บาท)</div><div class="v num">${n0(K.spend)}</div></div>
      <div class="stat"><div class="t">ได้ยอด (บาท)</div><div class="v num">${n0(K.rev)}</div><div class="sub">${n0(K.purch)} ออเดอร์</div></div>
      <div class="stat ${over ? 'br-over' : 'br-pass'}"><div class="t">ค่าแอด</div><div class="v num">${K.adpct === null ? '-' : K.adpct.toFixed(0) + '%'}</div><div class="sub">เป้าไม่เกิน ${B.target}% ${K.adpct === null ? '' : over ? '→ เกินเป้า' : '→ ผ่าน'}</div></div>
      <div class="stat"><div class="t">คนทักแชท</div><div class="v num">${n0(K.msgs)}</div><div class="sub">${K.costPerMsg ? 'คนละ ' + Math.round(K.costPerMsg) + ' บาท' : ''}</div></div>
    </div>
    <div class="brief-top"><b>เรื่องเดียวที่ต้องแก้ก่อน: ${esc(B.top.title)}</b><p>${esc(B.top.detail)}</p><p><b>ทำอะไร:</b> ${esc(B.top.action)}</p></div>
    <h3 class="sec-h">ใครทำอะไรวันนี้</h3>
    <div class="brief-3">
      <div class="brief-box"><h4>ทีมแอด</h4><ol>${B.adTasks.map(t => `<li><b>${esc(t.t)}</b> ${esc(t.d)}</li>`).join('') || '<li>ไม่มีงานเร่ง</li>'}</ol></div>
      <div class="brief-box"><h4>บอกทีมคอนเทนต์</h4><ol>${B.content.map(c => `<li><b>${esc(c.name)}</b>: คน 1,000 คน หยุดดู ${Math.round(c.watch)} ถาม ${n1(c.ask)} → ${esc(c.say)}</li>`).join('')}${B.openers.length ? `<li><b>อย่าแก้ ทำแนวนี้เพิ่ม:</b> ${esc(B.openers.join(' · '))}<small>คนถาม ${B.rules.askGood}+ ต่อ 1,000 คน = ตัวเปิดชั้นดี ที่ยังไม่มียอดเพราะไม่มีแอดตามคนถาม</small></li>` : ''}${!B.content.length && !B.openers.length ? '<li>วันนี้ไม่มีคลิปที่ต้องแก้</li>' : ''}</ol></div>
      <div class="brief-box"><h4>ห้ามแตะ (ทำงานดีอยู่)</h4><ul>${B.keep.map(r => `<li><b>${esc(r.name)}</b><small>คน 1,000 คน ถาม ${n1(r.ask)} · ซื้อ ${n1(r.buy)} · ROAS ${n2(r.roas)}</small></li>`).join('') || '<li>ยังไม่มีตัวที่เข้าเกณฑ์</li>'}</ul></div>
    </div>
    <h3 class="sec-h">ทุกแคมเปญ อ่านเป็น "คน 1,000 คนเห็นโฆษณา"</h3>
    <div class="hint">3 คำถาม: <b>หยุดดู</b>กี่คน (ดูถึง 15 วิ) → <b>ถาม</b>กี่คน (ทักแชท) → <b>ซื้อ</b>กี่คน · ดี = หยุดดู ${B.rules.watchGood}+ · ถาม ${B.rules.askGood}+ · ตกข้อ 1 = แก้คลิป · ตกข้อ 2 = แก้ราคา/คำชวนท้ายคลิป · ตกข้อ 3 = แอดมิน + แอดตามคนทัก ไม่ใช่คลิป · ลูกค้าเก่าไม่ดูคลิป ดูแค่ซื้อ</div>
    <div class="tbl-wrap"><table class="tbl brief-tbl"><thead><tr><th>แคมเปญ</th><th class="c">หยุดดู</th><th class="c">ถาม</th><th class="c">ซื้อ</th><th>ป้าย</th><th>ทำอะไร</th></tr></thead><tbody>${B.rows.map(row).join('')}</tbody></table></div>
    <p class="note">ตัวเลขทั้งหมดต่อคน 1,000 คนที่เห็นโฆษณา · "เพิ่งเริ่มวันนี้" ยังไม่ตัดสิน · ตารางนี้ยังไม่แทนหน้า "คำตัดสิน" ซึ่งดูงบและ ROAS ละเอียดกว่า</p>`;
}

async function briefPngBlob() {
  const D = day(); if (!D || !D.brief) throw new Error('โหลดไฟล์ก่อน');
  if (!window.htmlToImage) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js'; sc.onload = ok; sc.onerror = () => no(new Error('โหลดตัวสร้างรูปไม่ได้ ตรวจอินเทอร์เน็ต')); document.head.appendChild(sc); });
  let stage = document.getElementById('briefRender');
  if (!stage) { stage = document.createElement('div'); stage.id = 'briefRender'; stage.style.cssText = 'position:fixed;left:-30000px;top:0;width:1400px;z-index:-1;pointer-events:none'; document.body.appendChild(stage); }
  const AMname = state.settings.appName || 'BLISSTECH AdBoard';
  stage.innerHTML = `<div id="briefSheet" style="width:1400px;background:#F2F9FD;padding:24px;box-sizing:border-box"><div style="font-size:13px;color:#33475e;margin-bottom:6px">${esc(AMname)} · สรุปวันนี้</div>${$('#brief').innerHTML}</div>`;
  await new Promise(r => setTimeout(r, 250));
  const blob = await window.htmlToImage.toBlob(stage.querySelector('#briefSheet'), { pixelRatio: 1.5, backgroundColor: '#F2F9FD' });
  if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
  return { blob, name: `brief-${D.date}.png` };
}
$('#btnBriefPng').addEventListener('click', async () => {
  const msg = $('#briefMsg'); $('#btnBriefPng').disabled = true; msg.textContent = 'กำลังสร้างรูป...';
  try { const { blob, name } = await briefPngBlob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); msg.textContent = `ดาวน์โหลด ${name} แล้ว (${Math.round(blob.size / 1024)} KB)`; }
  catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { $('#btnBriefPng').disabled = false; }
});
$('#btnBriefTg').addEventListener('click', async () => {
  const msg = $('#briefMsg'); const D = day(); if (!D || !D.brief) { msg.textContent = 'โหลดไฟล์ก่อน'; return; }
  if (!tgReady()) { msg.textContent = 'ตั้งค่า Telegram ในหน้าตั้งค่าก่อน'; showView('settings'); return; }
  $('#btnBriefTg').disabled = true; msg.textContent = 'กำลังสร้างรูปและส่ง...';
  try {
    const tg = await tgModule(); const S = state.settings; const B = D.brief, K = B.kpis;
    const { blob, name } = await briefPngBlob();
    const caption = `สรุปวันนี้ ${thDate(D.date)}: ${B.top.title}\nใช้ ${n0(K.spend)} · ยอด ${n0(K.rev)} · ค่าแอด ${K.adpct === null ? '-' : K.adpct.toFixed(0) + '%'} · คนทัก ${n0(K.msgs)}\nทำอะไร: ${B.top.action}\n${location.origin}${location.pathname}#/brief`;
    let id;
    try { id = S.tgAsFile ? await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption) : await tg.sendPhoto(S.tgToken, S.tgChat, blob, caption, name); }
    catch (e) { if (/dimension|too big|PHOTO/i.test(e.message)) id = await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption); else throw e; }
    msg.textContent = `ส่งเข้ากลุ่มแล้ว (ข้อความ #${id})`; toast('ส่งสรุปวันนี้เข้า Telegram แล้ว'); AB.emit('export:sent', { target: 'telegram-brief', date: D.date, messageId: id });
  } catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { $('#btnBriefTg').disabled = false; }
});

// ---------- ผังคอนเทนต์ ----------
function renderJourney() {
  const D = day(); if (!D) { $('#journey').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  if (!D.journey && D.ads && D.adsets) { D.journey = buildJourney(D.ads, D.adsets, (D.productFunnels || []).map(p => p.product)); save(KEYS.days, state.days); } // ข้อมูลที่โหลดไว้ก่อนมีฟีเจอร์นี้
  const J = D.journey || [];
  const pick = $('#journeyPick'), cur = pick.value; pick.innerHTML = '<option value="">ทั้งหมด</option>' + J.map(j => `<option value="${esc(j.product)}"${j.product === cur ? ' selected' : ''}>${esc(j.product)}</option>`).join('');
  const stCls = { ok: 'ok', warn: 'warn', gap: 'gap', none: 'none' };
  const stTxt = { ok: 'ทำงานได้', warn: 'มีคลิปผิดขั้นปนอยู่', gap: 'ยังไม่มีคลิปที่ตรงขั้นนี้', none: 'ยังไม่มีกลุ่มและคลิป' };
  const clipShort = n => String(n).replace(/^\d+\.\d+\.\d+\s*/, '').replace(/\((TOFU|MOFU|BOFU|9\.9\.?|ขอฟรี)\)\s*/i, '').replace(/\s*\(คลิปฟรี\)/, '').trim();
  $('#journey').innerHTML = J.map(pj => `<div class="jcard"><h3 class="jtitle">${esc(pj.product)}</h3><div class="jflow">${pj.steps.map((S, i) => `
    <div class="jstep s${S.step} ${stCls[S.status]}">
      <div class="jhead"><span class="jn">${S.step}</span><div><b>${esc(S.name)}</b><small>${esc(S.goal)}</small></div></div><span class="jst ${stCls[S.status]}">${esc(stTxt[S.status])}</span>
      <div class="jblock"><span class="k">ใครเห็น</span><div>${esc(S.who)}</div>${S.audiences.length ? `<div class="jaud">${S.audiences.slice(0, 3).map(a => `<span>${esc(a)}</span>`).join('')}${S.audiences.length > 3 ? `<span class="muted">+${S.audiences.length - 3}</span>` : ''}</div>` : '<div class="muted small">ยังไม่มีชุดโฆษณาของสินค้านี้ในขั้นนี้</div>'}</div>
      <div class="jblock"><span class="k">คลิปที่ยิงอยู่</span>${S.clips.length ? `<ul class="jclips">${S.clips.slice(0, 4).map(c => `<li class="${c.fits ? '' : 'misfit'}"><span class="tag tag-${esc(c.stage)}">${esc(c.stage)}</span> ${esc(clipShort(c.name))}<small>ใช้ ${n0(c.spend)} · ${n0(c.purch)} ออเดอร์${c.noval ? ` (${c.noval} ไม่มีมูลค่า)` : ''} · ROAS ${n2(c.roas)}${c.fits ? '' : ' · <b>ไม่ใช่แนวของขั้นนี้</b>'}</small></li>`).join('')}${S.clips.length > 4 ? `<li class="muted small">+${S.clips.length - 4} คลิป</li>` : ''}</ul>` : '<div class="muted small">ไม่มี</div>'}</div>
      ${S.misplaced.length ? `<div class="jblock move"><span class="k">ควรย้ายมาขั้นนี้</span><ul class="jclips">${S.misplaced.slice(0, 3).map(m => `<li>${esc(clipShort(m.name))}<small>ตอนนี้ยิงอยู่ชั้น ${m.fromLayer} · ROAS ${n2(m.roas)} ใช้คลิปเดิมได้เลย</small></li>`).join('')}</ul></div>` : ''}
      <div class="jblock"><span class="k">แนวคลิปของขั้นนี้</span><ul class="jgenre">${S.genres.map(g => `<li>${esc(g)}</li>`).join('')}</ul><div class="small muted">${esc(S.metric)}</div></div>
      ${S.recommendations.length ? `<div class="jblock rec"><span class="k">ต้องทำต่อ</span><ul class="jrec">${S.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : ''}
    </div>${S.next ? `<div class="jarrow"><i></i><span>${esc(S.next)}</span></div>` : ''}`).join('')}</div></div>`).join('') || '<div class="empty">ไม่มีสินค้าที่ระบุได้</div>';
}

// ผัง → รูป
async function journeyPngBlob(product) {
  const D = day(); if (!D) throw new Error('โหลดไฟล์ก่อน');
  if (!window.htmlToImage) await new Promise((ok, no) => { const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js'; sc.onload = ok; sc.onerror = () => no(new Error('โหลดตัวสร้างรูปไม่ได้ ตรวจอินเทอร์เน็ต')); document.head.appendChild(sc); });
  // วาดในกล่องนอกจอ ความกว้างคงที่ เพื่อให้รูปเหมือนกันทุกเครื่องและไม่ขึ้นกับหน้าที่เปิดอยู่
  let stage = document.getElementById('journeyRender');
  if (!stage) { stage = document.createElement('div'); stage.id = 'journeyRender'; stage.style.cssText = 'position:fixed;left:-30000px;top:0;width:1400px;z-index:-1;pointer-events:none'; document.body.appendChild(stage); }
  const cards = [...document.querySelectorAll('#journey .jcard')].filter(c => !product || c.querySelector('.jtitle').textContent === product);
  if (!cards.length) throw new Error('ไม่มีผังของสินค้านี้');
  const AMname = state.settings.appName || 'BLISSTECH AdBoard';
  // จับรูปจากกล่องข้างใน (ไม่ใช่ stage ที่ position:fixed นอกจอ) ไม่งั้น clone จะถูกวางนอกจอแล้วได้รูปว่าง
  stage.innerHTML = `<div id="journeySheet" style="width:1400px;background:#F2F9FD;padding:24px;box-sizing:border-box"><div style="font-family:'Bai Jamjuree',sans-serif;font-weight:600;font-size:22px;color:#0b2540;margin:0 0 4px">ผังคอนเทนต์${product ? ' · ' + esc(product) : ''} · ${thDate(D.date)}</div><div style="font-size:13px;color:#33475e;margin-bottom:14px">${esc(AMname)} · คลิปเปิด → คลิปคลายกังวล → คลิปราคาพิเศษ → ลูกค้าเก่า · เหลือง = คลิปอยู่ผิดขั้น · ฟ้า = ควรย้ายมา · แดง = ต้องทำใหม่</div>${cards.map(c => c.outerHTML).join('')}</div>`;
  await new Promise(r => setTimeout(r, 250));
  const blob = await window.htmlToImage.toBlob(stage.querySelector('#journeySheet'), { pixelRatio: 1.6, backgroundColor: '#F2F9FD' });
  if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
  const slug = product ? product.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product' : 'all';
  return { blob, name: `journey-${slug}-${D.date}.png`, product };
}
$('#btnJourneyPng').addEventListener('click', async () => {
  const msg = $('#journeyMsg'); $('#btnJourneyPng').disabled = true; msg.textContent = 'กำลังสร้างรูป...';
  try { const { blob, name } = await journeyPngBlob($('#journeyPick').value); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000); msg.textContent = `ดาวน์โหลด ${name} แล้ว (${Math.round(blob.size / 1024)} KB)`; }
  catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { $('#btnJourneyPng').disabled = false; }
});
$('#btnJourneyTg').addEventListener('click', async () => {
  const msg = $('#journeyMsg'); const D = day(); if (!D) { msg.textContent = 'โหลดไฟล์ก่อน'; return; }
  if (!tgReady()) { msg.textContent = 'ตั้งค่า Telegram ในหน้าตั้งค่าก่อน'; showView('settings'); return; }
  $('#btnJourneyTg').disabled = true; msg.textContent = 'กำลังสร้างรูปและส่ง...';
  try {
    const pick = $('#journeyPick').value; const tg = await tgModule();
    // ส่งทีละสินค้าเป็นรูปในแชท (เปิดดูได้ทันที) รูปรวมทุกสินค้าสูงเกินที่ Telegram ทำภาพตัวอย่างได้
    const products = pick ? [pick] : (D.journey || []).map(j => j.product);
    const S = state.settings; let sent = 0, lastId = null;
    for (const [i, product] of products.entries()) {
      msg.textContent = `กำลังส่ง ${i + 1}/${products.length}: ${product}...`;
      const { blob, name } = await journeyPngBlob(product);
      const caption = `ผังคอนเทนต์ ${product} · ${thDate(D.date)}${i === 0 ? `\nเหลือง = คลิปอยู่ผิดขั้น · ฟ้า = ควรย้ายมา · แดง = ต้องทำใหม่\n${location.origin}${location.pathname}#/journey` : ''}`;
      try { lastId = S.tgAsFile ? await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption) : await tg.sendPhoto(S.tgToken, S.tgChat, blob, caption, name); }
      catch (e) { if (/dimension|too big|PHOTO/i.test(e.message)) lastId = await tg.sendDocument(S.tgToken, S.tgChat, blob, name, caption); else throw e; } // รูปใหญ่เกินสำหรับรูปในแชท → ส่งเป็นไฟล์แทน
      sent++;
    }
    msg.textContent = `ส่งเข้ากลุ่มแล้ว ${sent} รูป (ข้อความล่าสุด #${lastId})`; toast('ส่งผังเข้า Telegram แล้ว'); AB.emit('export:sent', { target: 'telegram-journey', date: D.date, messageId: lastId, count: sent });
  } catch (e) { msg.textContent = 'ไม่สำเร็จ: ' + e.message; } finally { $('#btnJourneyTg').disabled = false; }
});

// ---------- คำตัดสิน ----------
function effective(c, D) { const o = (D.overrides || {})[c.name] || {}; return { group: o.group || c.group, budgetNext: o.budgetNext !== undefined ? o.budgetNext : c.budgetNext, edited: !!(o.group || o.budgetNext !== undefined) }; }
function renderDecisions() {
  const D = day(); if (!D) { $('#decisions').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  const rows = D.campaigns.map(c => ({ c, e: effective(c, D) }));
  const grp = (g, zone, title, desc) => {
    const rs = rows.filter(r => r.e.group === g);
    const sp = rs.reduce((s, r) => s + r.c.spend, 0), rv = rs.reduce((s, r) => s + r.c.rev, 0);
    return `<div class="grp"><h3><span class="zone ${zone}">${title}</span> ${rs.length} แคมเปญ <span class="sum">ใช้ ${n0(sp)} · ขาย ${n0(rv)} · ROAS ${sp ? n2(rv / sp) : '-'}</span></h3><p class="small muted" style="margin-bottom:8px">${desc}</p>
      ${rs.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>แคมเปญ · คลิปหลัก · กลุ่มเป้าหมาย</th><th>ขั้น</th><th class="r">ใช้จ่าย</th><th class="r">ออเดอร์</th><th class="r">ยอดขาย</th><th class="r">ROAS</th><th class="r">ค่าแอด%</th><th>งบ → เสนอ</th><th>กลุ่ม</th><th>เหตุผล</th></tr></thead><tbody>
      ${rs.map(({ c, e }) => `<tr data-camp="${esc(c.name)}"><td class="name" title="${esc(c.name)}"><b>${esc(shortCamp(c.name))}</b><small>${esc((c.ads[0] || {}).name || '')}</small><small><span class="ltag l${c.layer}">${c.layer}</span> ${esc((c.adsets[0] || {}).name || '')}</small></td>
        <td><span class="tag tag-${esc(c.stageLabel)}">${esc(c.stageLabel)}</span><div class="small muted">${esc(c.product || 'ไม่ระบุ')}</div></td>
        <td class="r num">${n0(c.spend)}</td><td class="r num">${n0(c.purch)}${c.noval ? `<div class="small muted">ไม่มีมูลค่า ${c.noval}</div>` : ''}</td><td class="r num">${n0(c.rev)}</td><td class="r num ${roasCls(c.roas)}">${n2(c.roas)}</td><td class="r num">${n1(c.adpct)}</td>
        <td class="num">${c.budget ?? '-'} → <input type="number" min="0" step="50" data-budget value="${e.budgetNext ?? ''}"></td>
        <td><select data-group class="g-${e.group}"><option value="go"${e.group === 'go' ? ' selected' : ''}>ไปต่อ</option><option value="watch"${e.group === 'watch' ? ' selected' : ''}>ดูภาพรวม</option><option value="stop"${e.group === 'stop' ? ' selected' : ''}>ปิด</option></select>${e.edited ? '<div class="edited">แก้เอง</div>' : ''}</td>
        <td class="reason">${esc(c.reasons.join(' · '))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">ไม่มี</div>'}</div>`;
  };
  $('#decisions').innerHTML = grp('go', 'safe', 'ไปต่อ', 'ตัวที่ทำเงิน คงงบหรือเพิ่มทีละไม่เกิน 25%') + grp('watch', 'warn', 'ดูภาพรวม', 'ไม่มียอดหรือยอดต่ำ แต่เป็นคลิปเปิด/คลิปกลาง หรือข้อมูลยังน้อย หรือมีออเดอร์ที่ไม่มีมูลค่า อย่าเพิ่งปิด คุมงบไว้') + grp('stop', 'danger', 'ปิด', 'คลิปปิดการขายที่ขาดทุน ส่วนใหญ่เป็นคลิปดีที่ยิงผิดกลุ่ม ดูตาราง "คลิปเดียวกัน กลุ่มต่างกัน" ในหน้ากรวย');
}
$('#decisions').addEventListener('change', e => {
  const tr = e.target.closest('tr[data-camp]'); const D = day(); if (!tr || !D) return;
  const name = tr.dataset.camp; D.overrides[name] = D.overrides[name] || {};
  if (e.target.matches('[data-group]')) D.overrides[name].group = e.target.value;
  if (e.target.matches('[data-budget]')) D.overrides[name].budgetNext = e.target.value === '' ? null : Number(e.target.value);
  save(KEYS.days, state.days); renderDecisions(); AB.emit('decision:changed', { date: state.date, campaign: name, override: D.overrides[name] });
});

// ---------- แผน ----------
function savePlanFrom(layers) { state.plan = { layers, updatedAt: new Date().toISOString() }; save(KEYS.plan, state.plan); AB.emit('plan:changed', { date: state.date }); }
function renderPlan() {
  const D = day(); if (!D) { $('#plan').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  const layers = currentPlan();
  const list = (p, key, title, withStatus) => `<div class="plist" data-key="${key}"><h5>${title}</h5><ul>${p[key].map((x, i) => `<li class="${x.source === 'team' ? 'team' : ''}" data-i="${i}"><span class="txt">${esc(x.name)}${x.product ? ` <span class="muted small">(${esc(x.product)})</span>` : ''}${x.why ? `<span class="why">${esc(x.why)}</span>` : ''}</span>${withStatus ? `<select data-status class="st-${x.status || 'todo'}"><option value="todo"${(x.status || 'todo') === 'todo' ? ' selected' : ''}>ยังไม่ทำ</option><option value="doing"${x.status === 'doing' ? ' selected' : ''}>กำลังทำ</option><option value="done"${x.status === 'done' ? ' selected' : ''}>เสร็จ</option></select>` : ''}${x.source === 'team' ? '<button class="x" data-del title="ลบ">×</button>' : ''}</li>`).join('') || '<li class="muted small">-</li>'}</ul><form data-add><input placeholder="เพิ่มรายการของทีม..." required><button class="mini" type="submit">เพิ่ม</button></form></div>`;
  $('#plan').innerHTML = `<div class="planwrap">${layers.map(p => `<div class="pcard l${p.layer}" data-layer="${p.layer}"><h4><span class="ltag l${p.layer}">${p.layer}</span> ${esc(p.name)}</h4><div class="role">${esc(p.role)}</div><div class="meta"><span>งบเป้า ${p.budgetShare}%</span><span>วัดด้วย ${esc(p.metric)}</span></div>
    ${list(p, 'clipsHave', 'คลิปที่มีและใช้ได้', false)}${list(p, 'clipsMissing', 'คลิปที่ขาด ต้องทำ', true)}${list(p, 'audiences', 'กลุ่มเป้าหมายที่ใช้อยู่', false)}${list(p, 'audiencesToBuild', 'กลุ่มที่ควรสร้าง', true)}
    <textarea data-notes placeholder="บันทึกของทีมสำหรับชั้นนี้...">${esc(p.notes || '')}</textarea></div>`).join('')}</div>`;
}
$('#plan').addEventListener('change', e => {
  const card = e.target.closest('[data-layer]'); if (!card) return;
  const layers = currentPlan(), p = layers.find(x => x.layer === Number(card.dataset.layer));
  if (e.target.matches('[data-status]')) { const key = e.target.closest('[data-key]').dataset.key, i = Number(e.target.closest('li').dataset.i); p[key][i].status = e.target.value; }
  if (e.target.matches('[data-notes]')) p.notes = e.target.value;
  savePlanFrom(layers); renderPlan(); renderFunnel();
});
$('#plan').addEventListener('submit', e => {
  if (!e.target.matches('[data-add]')) return; e.preventDefault();
  const card = e.target.closest('[data-layer]'), key = e.target.closest('[data-key]').dataset.key, v = e.target.querySelector('input').value.trim(); if (!v) return;
  const layers = currentPlan(), p = layers.find(x => x.layer === Number(card.dataset.layer));
  p[key].push({ name: v, source: 'team', status: 'todo' }); savePlanFrom(layers); renderPlan(); renderFunnel();
});
$('#plan').addEventListener('click', e => {
  if (!e.target.matches('[data-del]')) return;
  const card = e.target.closest('[data-layer]'), key = e.target.closest('[data-key]').dataset.key, i = Number(e.target.closest('li').dataset.i);
  const layers = currentPlan(), p = layers.find(x => x.layer === Number(card.dataset.layer));
  p[key].splice(i, 1); savePlanFrom(layers); renderPlan(); renderFunnel();
});

// ---------- คำแนะนำ ----------
function renderAdvice() {
  const D = day(); const A = D && D.advice;
  $('#advice').classList.toggle('empty', !A);
  if (!D) { $('#advice').textContent = 'ยังไม่ได้โหลดไฟล์'; return; }
  if (!A) { $('#advice').innerHTML = '<div class="empty">ยังไม่มีคำแนะนำสำหรับวันนี้ กด "ขอคำแนะนำ" (ต้องมี API key ในหน้าตั้งค่า) หรือ "ใช้คำแนะนำตัวอย่าง"</div>'; return; }
  const ed = (path, text) => `<span contenteditable="true" data-path="${path}">${esc(text)}</span>`;
  const ul = (arr, path) => `<ul>${(arr || []).map((x, i) => `<li>${typeof x === 'string' ? ed(`${path}.${i}`, x) : `<b>${ed(`${path}.${i}.title`, x.title)}</b><div class="ev">${ed(`${path}.${i}.evidence`, x.evidence || '')}</div>`}</li>`).join('') || '<li class="muted">-</li>'}</ul>`;
  $('#advice').innerHTML = `<div class="adv">
    <div class="card"><h3>หัวข้อสรุป ${A.source === 'sample' ? '<span class="zone gray">ตัวอย่าง ไม่ได้มาจาก Claude</span>' : `<span class="zone info">${esc(A.model || 'Claude')} · ${A.at ? new Date(A.at).toLocaleString('th-TH') : ''}</span>`}</h3><div class="headline">${ed('headline', A.headline)}</div></div>
    <div class="card half"><h3>ข้อค้นพบ</h3>${ul(A.findings, 'findings')}</div>
    <div class="card half"><h3>ดูในประชุมครั้งหน้า</h3>${ul(A.watchNextMeeting, 'watchNextMeeting')}</div>
    <div class="card half"><h3>ทีมยิงแอด ทำวันนี้</h3>${ul(A.actions?.ads, 'actions.ads')}</div>
    <div class="card half"><h3>ทีมคอนเทนต์ ทำสัปดาห์นี้</h3>${ul(A.actions?.content, 'actions.content')}</div>
    <div class="card half"><h3>เจ้านายตัดสินใจ</h3>${ul(A.actions?.boss, 'actions.boss')}</div>
    <div class="card half"><h3>คอนเทนต์ที่ต้องทำ</h3><ul>${(A.contentToMake || []).map(x => `<li><b>${esc(x.name)}</b> <span class="ltag l${x.layer}">ชั้น ${x.layer}</span> ${x.product ? `<span class="muted small">${esc(x.product)}</span>` : ''}<div class="ev">${esc(x.why || '')}</div></li>`).join('') || '<li class="muted">-</li>'}</ul></div>
    <div class="card"><h3>กลุ่มเป้าหมายที่ควรสร้าง</h3><ul>${(A.audiencesToBuild || []).map(x => `<li><b>${esc(x.name)}</b> <span class="ltag l${x.layer}">ชั้น ${x.layer}</span><div class="ev">${esc(x.why || '')}</div></li>`).join('') || '<li class="muted">-</li>'}</ul></div>
  </div><p class="small muted" style="margin-top:8px">แก้ข้อความได้โดยคลิกแล้วพิมพ์ ระบบจะจำที่แก้ไว้กับวันนี้</p>`;
}
$('#advice').addEventListener('input', e => {
  const el = e.target.closest('[data-path]'); const D = day(); if (!el || !D || !D.advice) return;
  const parts = el.dataset.path.split('.'); let o = D.advice;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = el.textContent; D.advice.editedAt = new Date().toISOString();
  save(KEYS.days, state.days); if (parts[0] === 'headline') renderOverview();
});
async function adviceModule() { try { return await import('./advice.js?v=20260921230353'); } catch (e) { toast('ยังไม่มีส่วนคำแนะนำ (advice.js)'); return null; } }
$('#btnAdvice').addEventListener('click', async () => {
  const D = day(); if (!D) { toast('โหลดไฟล์ก่อน'); return; }
  if (!state.settings.apiKey) { toast('ใส่ API key ในหน้าตั้งค่าก่อน'); showView('settings'); return; }
  const m = await adviceModule(); if (!m) return;
  $('#adviceStatus').textContent = 'กำลังขอคำแนะนำจาก Claude...'; $('#btnAdvice').disabled = true;
  try { D.advice = await m.getAdvice(D, prevDay(), currentPlan(), state.settings); save(KEYS.days, state.days); renderAdvice(); renderOverview(); $('#adviceStatus').textContent = 'ได้คำแนะนำแล้ว'; AB.emit('advice:ready', { date: state.date, advice: D.advice }); }
  catch (e) { $('#adviceStatus').textContent = e.message; }
  finally { $('#btnAdvice').disabled = false; }
});
$('#btnAdviceSample').addEventListener('click', async () => {
  const D = day(); if (!D) { toast('โหลดไฟล์ก่อน'); return; }
  const m = await adviceModule(); if (!m) return;
  D.advice = m.sampleAdvice(D, currentPlan()); save(KEYS.days, state.days); renderAdvice(); renderOverview(); $('#adviceStatus').textContent = 'ใช้คำแนะนำตัวอย่าง';
});

// ---------- ส่งออก ----------
$('#btnCsv').addEventListener('click', () => {
  const D = day(); if (!D) { toast('โหลดไฟล์ก่อน'); return; }
  const csv = '\uFEFF' + campaignsToCsv(D.campaigns, D.overrides);
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = `กระดานแอด-${D.date}.csv`; a.click();
  $('#exportMsg').textContent = `ดาวน์โหลด ${a.download} แล้ว (${D.campaigns.length} แคมเปญ)`;
});
$('#btnPng').addEventListener('click', async () => {
  const D = day(); if (!D) { toast('โหลดไฟล์ก่อน'); return; }
  let m; try { m = await import('./sheet.js?v=20260921230353'); } catch { $('#exportMsg').textContent = 'ยังไม่มีส่วนสร้างรูป (sheet.js)'; return; }
  $('#exportMsg').textContent = 'กำลังสร้างรูป...'; $('#btnPng').disabled = true;
  try { const name = await m.exportPng(D, currentPlan(), $('#sheetHost')); $('#exportMsg').textContent = `ดาวน์โหลด ${name} แล้ว`; }
  catch (e) { $('#exportMsg').textContent = 'สร้างรูปไม่ได้: ' + e.message; }
  finally { $('#btnPng').disabled = false; }
});

// ---------- Telegram ----------
async function tgModule() { try { return await import('./telegram.js?v=20260921230353'); } catch { toast('ยังไม่มีส่วน Telegram (telegram.js)'); return null; } }
function tgReady() { const S = state.settings; return !!(S.tgToken && S.tgChat); }
function tgCaption(D) {
  const T = D.totals, A = D.advice;
  const head = (A && A.headline) || `กระดานแอด ${thDate(D.date)}`;
  const AM = actualMetrics(T, D.products, D.actual);
  const actLine = AM ? `\nยอดจริง ${n0(AM.rev)} · ค่าแอดจริง ${n1(AM.adpct)}% · ROAS จริง ${n2(AM.roas)} (Meta จับได้ ${n0(AM.metaCoverage)}%)` : '';
  return `${head}\nใช้ ${n0(T.spend)} · Meta ขาย ${n0(T.rev)} · ROAS ${n2(T.roas)} · ค่าแอด ${n1(T.adpct)}% · ${n0(T.purch)} ออเดอร์${T.noval ? ` (ไม่มีมูลค่า ${T.noval})` : ''}${actLine}\nรายละเอียด: ${location.origin}${location.pathname}`;
}
async function sendToTelegram(D, statusEl) {
  if (!tgReady()) { statusEl.textContent = 'ตั้งค่า bot token และกลุ่มในหน้าตั้งค่าก่อน'; showView('settings'); return false; }
  const tg = await tgModule(); if (!tg) return false;
  let sheet; try { sheet = await import('./sheet.js?v=20260921230353'); } catch { statusEl.textContent = 'ยังไม่มีส่วนสร้างรูป (sheet.js)'; return false; }
  statusEl.textContent = 'กำลังสร้างรูปและส่ง...';
  try {
    const { blob, name } = await sheet.renderPngBlob(D, currentPlan(), $('#sheetHost'), 2);
    const S = state.settings;
    // sendPhoto ย่อรูปให้ดูในแชท ถ้าเลือก "ส่งเป็นไฟล์" จะได้ความละเอียดเต็ม
    const id = S.tgAsFile ? await tg.sendDocument(S.tgToken, S.tgChat, blob, name, tgCaption(D)) : await tg.sendPhoto(S.tgToken, S.tgChat, blob, tgCaption(D), name);
    D.tgSentAt = new Date().toISOString(); save(KEYS.days, state.days);
    statusEl.textContent = `ส่งเข้ากลุ่มแล้ว (ข้อความ #${id}) ${new Date().toLocaleTimeString('th-TH')}`;
    toast('ส่งเข้า Telegram แล้ว'); AB.emit('export:sent', { target: 'telegram', date: D.date, messageId: id }); return true;
  } catch (e) { statusEl.textContent = 'ส่งไม่สำเร็จ: ' + e.message; return false; }
}
$('#btnTg').addEventListener('click', async () => {
  const D = day(); if (!D) { toast('โหลดไฟล์ก่อน'); return; }
  $('#btnTg').disabled = true; try { await sendToTelegram(D, $('#exportMsg')); } finally { $('#btnTg').disabled = false; }
});

// ---------- ปลั๊กอิน: UI ----------
function renderPluginUi() {
  // เมนู + หน้า
  $('#navPlugins').innerHTML = AB.registry.views.map(v => `<button class="opnav-item" data-view="p:${esc(v.id)}"><span><b>${esc(v.title)}</b><small>${esc(v.subtitle || 'ปลั๊กอิน')}</small></span></button>`).join('');
  const host = $('#pluginViews');
  for (const v of AB.registry.views) if (!host.querySelector(`[data-view="p:${CSS.escape(v.id)}"]`)) { const sec = document.createElement('section'); sec.className = 'view hidden'; sec.dataset.view = 'p:' + v.id; sec.innerHTML = `<h2 class="sec-h">${esc(v.title)}</h2><div class="pv-body"></div>`; host.appendChild(sec); }
  // ปุ่มส่งออก
  $('#exportPlugins').innerHTML = AB.registry.exports.map(x => `<div class="stat"><div class="t">${esc(x.title)}</div><p class="small muted">${esc(x.desc || '')}</p><button class="btn" data-pexport="${esc(x.id)}">${esc(x.label || 'ส่งออก')}</button><div class="small muted" data-pmsg="${esc(x.id)}"></div></div>`).join('');
}
$('#exportPlugins').addEventListener('click', async e => {
  const b = e.target.closest('[data-pexport]'); if (!b) return; const x = AB.registry.exports.find(v => v.id === b.dataset.pexport); const D = day();
  const msg = $(`[data-pmsg="${CSS.escape(b.dataset.pexport)}"]`); if (!D) { msg.textContent = 'โหลดไฟล์ก่อน'; return; }
  b.disabled = true; msg.textContent = 'กำลังทำ...';
  try { msg.textContent = (await x.run(AB.getDay(D.date), AB)) || 'เสร็จแล้ว'; AB.emit('export:sent', { target: x.id, date: D.date }); } catch (err) { msg.textContent = 'ไม่สำเร็จ: ' + err.message; } finally { b.disabled = false; }
});
function pluginListText() { return (state.settings.plugins || []).map(p => (p.enabled === false ? '#' : '') + p.url).join('\n'); }
function parsePluginList(txt) { return txt.split('\n').map(l => l.trim()).filter(Boolean).map(l => ({ url: l.replace(/^#\s*/, ''), enabled: !l.startsWith('#') })); }

// ---------- ตั้งค่า ----------
const RULE_LABELS = {
  minSpend: 'ใช้จ่ายต่ำกว่านี้ = ข้อมูลยังน้อย (บาท)', stopRoas: 'ปิดเมื่อ ROAS ต่ำกว่า (คลิปปิดการขาย)', stopSpend: 'ปิดเมื่อใช้จ่ายถึง (บาท)', stopZeroRevSpend: 'ปิดเมื่อไม่มียอดและใช้จ่ายถึง (บาท)',
  goRoas: 'ไปต่อเมื่อ ROAS ถึง', scaleRoas: 'เพิ่มงบเมื่อ ROAS ถึง', scaleSpend: 'เพิ่มงบเมื่อใช้จ่ายถึง (บาท)', scaleFactor: 'ตัวคูณเพิ่มงบ (1.25 = +25%)',
  watchRoas: 'ดูภาพรวมเมื่อ ROAS ถึง', cutBudgetMin: 'ลดงบคลิปเปิดเมื่องบตั้งแต่ (บาท)', cutAdpct: 'ลดงบเมื่อค่าแอดเกิน (%)', cutTo: 'ลดงบเหลือ (บาท)', watchCutBudgetMin: 'กำไรบาง: ลดงบเมื่องบตั้งแต่ (บาท)',
  l1CpmOk: 'ชั้น 1 ดีเมื่อ CPM ไม่เกิน', l1CpmWarn: 'ชั้น 1 พอใช้เมื่อ CPM ไม่เกิน', l23RoasOk: 'ชั้น 2-3 ดีเมื่อ ROAS ถึง', l23RoasWarn: 'ชั้น 2-3 พอใช้เมื่อ ROAS ถึง', l4RoasOk: 'ชั้น 4 ดีเมื่อ ROAS ถึง', l4RoasWarn: 'ชั้น 4 พอใช้เมื่อ ROAS ถึง',
  openerReach: 'คลิปเปิดที่ควรสร้างกลุ่มคนดู เมื่อเข้าถึงเกิน (คน)', l3V50pct: 'ชั้น 3 ไม่ดูคลิป เมื่อดูครึ่งคลิปต่ำกว่า (%)', dupAdsetCampaigns: 'เตือนรายชื่อซ้ำเมื่อใช้ตั้งแต่ (แคมเปญ)',
};
function renderSettings() {
  const S = state.settings;
  $('#settings').innerHTML = `
    <div class="card"><h3>ชื่อแอปและโลโก้ (แถบหัว)</h3>
      <div class="row-btns" style="align-items:flex-end;gap:16px">
        <div class="logo-preview" id="logoPreview">${S.logo ? `<img src="${esc(S.logo)}" alt="">` : `<img src="logo.png" alt="" onerror="this.replaceWith(Object.assign(document.createElement('b'),{textContent:'${esc((S.appName || 'BLISSTECH AdBoard').charAt(0))}',className:'disp'}))">`}</div>
        <div><label>ชื่อแอป (ภาษาอังกฤษดูเป็นมืออาชีพ เช่น BLISSTECH AdBoard, AdPulse, Ad Command Center)</label><input type="text" id="setAppName" value="${esc(S.appName || 'BLISSTECH AdBoard')}" style="max-width:360px"></div>
        <div><label>คำโปรยใต้ชื่อ (เว้นว่างได้)</label><input type="text" id="setTagline" value="${esc(S.tagline ?? 'Ads Intelligence')}" style="max-width:260px"></div>
      </div>
      <div class="row-btns" style="margin-top:10px"><label class="mini" style="cursor:pointer">อัปโหลดโลโก้ <input type="file" id="setLogo" accept="image/*" hidden></label><button class="mini" id="btnLogoClear">ใช้ค่าเริ่มต้น</button><span class="small muted">รูปสี่เหลี่ยมจัตุรัสพื้นโปร่ง/ขาว จะย่อเป็น 128px เก็บในเครื่องนี้ ถ้าอยากให้ทุกเครื่องเห็นโลโก้เดียวกัน ส่งไฟล์ให้ผู้ดูแลใส่เป็น logo.png ในตัวเว็บ</span></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Claude API</h3>
      <label>API key (เก็บในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ส่งไปที่อื่นนอกจาก api.anthropic.com)</label>
      <div class="row-btns"><input type="password" id="setKey" value="${esc(S.apiKey)}" placeholder="sk-ant-..." style="max-width:420px"><button class="mini" id="btnTestKey">ทดสอบการเชื่อมต่อ</button><span class="small muted" id="keyMsg"></span></div>
      <label>โมเดล</label><select id="setModel"><option${S.model === 'claude-opus-5' ? ' selected' : ''}>claude-opus-5</option><option${S.model === 'claude-sonnet-5' ? ' selected' : ''}>claude-sonnet-5</option></select>
    </div>
    <div class="card" style="margin-top:14px"><h3>Telegram (ส่งรูปสรุปเข้ากลุ่ม)</h3>
      <p class="small muted">ขั้นตอนครั้งเดียว: (1) ใน Telegram คุยกับ @BotFather พิมพ์ /newbot ตั้งชื่อ แล้วคัดลอก token มาวางด้านล่าง (2) สร้างกลุ่มแล้วดึงบอทเข้ากลุ่ม (3) พิมพ์ข้อความอะไรก็ได้ในกลุ่ม 1 ครั้ง แล้วกด "ค้นหากลุ่ม" (4) เลือกกลุ่ม กดบันทึก แล้วกด "ทดสอบส่ง"</p>
      <label>bot token (เก็บในเครื่องนี้เท่านั้น)</label>
      <div class="row-btns"><input type="password" id="setTgToken" value="${esc(S.tgToken || '')}" placeholder="123456789:AAxxxxxxxx..." style="max-width:420px"><button class="mini" id="btnTgCheck">ตรวจ token</button><button class="mini" id="btnTgFind">ค้นหากลุ่ม</button><span class="small muted" id="tgMsg"></span></div>
      <label>กลุ่ม (chat id) เลือกจากผลค้นหา หรือพิมพ์เอง เช่น -1001234567890</label>
      <div class="row-btns"><select id="setTgPick" class="hidden"></select><input type="text" id="setTgChat" value="${esc(S.tgChat || '')}" placeholder="-100..." style="max-width:260px"><button class="mini" id="btnTgTest">ทดสอบส่ง</button></div>
      <label class="row-btns" style="font-size:13.5px;color:rgb(var(--ink))"><input type="checkbox" id="setTgAuto" style="width:auto"${S.tgAuto ? ' checked' : ''}> ส่งรูปเข้ากลุ่มอัตโนมัติทุกครั้งที่วิเคราะห์ไฟล์เสร็จ</label>
      <label class="row-btns" style="font-size:13.5px;color:rgb(var(--ink))"><input type="checkbox" id="setTgAsFile" style="width:auto"${S.tgAsFile ? ' checked' : ''}> ส่งเป็นไฟล์แนบ (ความละเอียดเต็ม) แทนรูปในแชท</label>
    </div>
    <div class="card" style="margin-top:14px"><h3>เกณฑ์ตัดสิน</h3><div class="setgrid">${Object.keys(RULE_LABELS).map(k => `<div><label>${esc(RULE_LABELS[k])}</label><input type="number" step="any" data-rule="${k}" value="${S.rules[k]}"></div>`).join('')}</div></div>
    <div class="card" style="margin-top:14px"><h3>รูปแบบชื่อ (regex ไม่สนตัวพิมพ์ ลำดับบนก่อน)</h3>
      <label>สินค้าจากชื่อแคมเปญ [{name, regex}]</label><textarea id="setProd">${esc(JSON.stringify(S.productPatterns, null, 1))}</textarea>
      <label>ขั้นคลิปจากชื่อคลิป [{stage, regex}]</label><textarea id="setStage">${esc(JSON.stringify(S.stagePatterns, null, 1))}</textarea>
      <label>ชั้นกรวยจากชื่อชุดโฆษณา [{layer, regex}] (ไม่ตรงเลย = ชั้น 1)</label><textarea id="setLayer">${esc(JSON.stringify(S.layerPatterns, null, 1))}</textarea>
    </div>
    <div class="card" style="margin-top:14px"><h3>ปลั๊กอิน (ต่อกับแอปอื่น)</h3>
      <p class="small muted">ใส่ URL ของปลั๊กอินบรรทัดละ 1 ตัว (ไฟล์ .js แบบ ES module ที่ export default function install(api)) ขึ้นต้นด้วย # เพื่อปิดชั่วคราว ปลั๊กอินในตัว: <code>plugins/webhook.js</code> ส่ง JSON ไป Google Sheet / Make / Zapier · วิธีเขียนปลั๊กอินดู PLUGINS.md · API เวอร์ชัน ${esc(AB.version)}</p>
      <textarea id="setPlugins" placeholder="plugins/webhook.js">${esc(pluginListText())}</textarea>
      <div class="small muted" style="margin-top:6px">${pluginLoadResults.length ? pluginLoadResults.map(r => r.ok ? `<span class="zone safe">โหลดแล้ว</span> ${esc(r.name)}` : `<span class="zone danger">ผิดพลาด</span> ${esc(r.url)}: ${esc(r.error)}`).join('<br>') : 'ยังไม่มีปลั๊กอินที่โหลด'} · เปลี่ยนรายการแล้วกดบันทึก จากนั้นรีเฟรชหน้า</div>
      <div id="pluginSettings">${AB.registry.settings.map(ps => `<div class="pset" data-pset="${esc(ps.id)}" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--sky-line)"><h3>${esc(ps.title)}</h3><div class="pset-body"></div><div class="row-btns" style="margin-top:8px"><button class="mini" data-psave="${esc(ps.id)}">บันทึกส่วนนี้</button><span class="small muted" data-psmsg="${esc(ps.id)}"></span></div></div>`).join('')}</div>
    </div>
    <div class="row-btns" style="margin-top:14px"><button class="btn" id="btnSaveSet">บันทึกการตั้งค่า</button><button class="btn" id="btnResetRules">คืนค่าเกณฑ์เริ่มต้น</button><button class="btn danger" id="btnClearAll">ล้างข้อมูลทั้งหมดในเครื่องนี้</button></div>
    <p class="small muted" style="margin-top:8px">การตั้งค่าใหม่จะมีผลกับไฟล์ที่โหลดครั้งถัดไป วันที่เก็บไว้แล้วยังใช้ผลเดิม · ทะเบียนที่พนักงานเลือกเอง: สินค้า ${Object.keys(state.manual.products).length} แคมเปญ · ขั้นคลิป ${state.clips.length} คลิป</p>`;
  for (const ps of AB.registry.settings) { const body = $(`[data-pset="${CSS.escape(ps.id)}"] .pset-body`); try { ps.render(body, AB); } catch (e) { body.innerHTML = `<div class="warnbox">${esc(e.message)}</div>`; } }
  $('#pluginSettings').addEventListener('click', e => {
    const b = e.target.closest('[data-psave]'); if (!b) return; const ps = AB.registry.settings.find(x => x.id === b.dataset.psave); const body = $(`[data-pset="${CSS.escape(ps.id)}"] .pset-body`);
    try { if (ps.save) ps.save(body, AB); $(`[data-psmsg="${CSS.escape(ps.id)}"]`).textContent = 'บันทึกแล้ว'; } catch (err) { $(`[data-psmsg="${CSS.escape(ps.id)}"]`).textContent = err.message; }
  });
  $('#btnSaveSet').addEventListener('click', () => {
    try {
      const S2 = { ...state.settings, apiKey: $('#setKey').value.trim(), model: $('#setModel').value, rules: { ...state.settings.rules }, tgToken: $('#setTgToken').value.trim(), tgChat: $('#setTgChat').value.trim(), tgAuto: $('#setTgAuto').checked, tgAsFile: $('#setTgAsFile').checked, appName: $('#setAppName').value.trim() || DEFAULT_BRAND.appName, tagline: $('#setTagline').value.trim(), plugins: parsePluginList($('#setPlugins').value) };
      document.querySelectorAll('[data-rule]').forEach(i => { const v = Number(i.value); if (!isNaN(v)) S2.rules[i.dataset.rule] = v; });
      const pp = JSON.parse($('#setProd').value), sp = JSON.parse($('#setStage').value), lp = JSON.parse($('#setLayer').value);
      for (const p of [...pp, ...sp, ...lp]) new RegExp(p.regex, 'i');
      S2.productPatterns = pp; S2.stagePatterns = sp; S2.layerPatterns = lp;
      state.settings = S2; save(KEYS.settings, S2); toast('บันทึกการตั้งค่าแล้ว'); applyBrand(); renderSettings();
    } catch (e) { toast('รูปแบบ JSON/regex ไม่ถูกต้อง: ' + e.message); }
  });
  $('#btnResetRules').addEventListener('click', () => { const d = cloneDefaults(); state.settings = { ...state.settings, rules: d.rules, productPatterns: d.productPatterns, stagePatterns: d.stagePatterns, layerPatterns: d.layerPatterns }; save(KEYS.settings, state.settings); renderSettings(); toast('คืนค่าเริ่มต้นแล้ว (ยังเก็บ API key ไว้)'); });
  $('#btnClearAll').addEventListener('click', () => { if (!confirm('ลบวันที่เก็บไว้ แผน ทะเบียน และการตั้งค่าทั้งหมด (รวม API key) ในเครื่องนี้?')) return; Object.values(KEYS).forEach(k => localStorage.removeItem(k)); location.reload(); });
  $('#setLogo').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { state.settings.logo = await fileToLogoDataUrl(f); save(KEYS.settings, state.settings); applyBrand(); renderSettings(); toast('เปลี่ยนโลโก้แล้ว'); }
    catch (err) { toast(err.message); }
  });
  $('#btnLogoClear').addEventListener('click', () => { state.settings.logo = ''; save(KEYS.settings, state.settings); applyBrand(); renderSettings(); toast('ใช้โลโก้เริ่มต้น'); });
  const tgSaveDraft = () => { state.settings.tgToken = $('#setTgToken').value.trim(); state.settings.tgChat = $('#setTgChat').value.trim(); state.settings.tgAuto = $('#setTgAuto').checked; state.settings.tgAsFile = $('#setTgAsFile').checked; save(KEYS.settings, state.settings); };
  $('#btnTgCheck').addEventListener('click', async () => {
    const t = $('#setTgToken').value.trim(); if (!t) { $('#tgMsg').textContent = 'วาง token ก่อน'; return; }
    const tg = await tgModule(); if (!tg) return; $('#tgMsg').textContent = 'กำลังตรวจ...';
    try { $('#tgMsg').textContent = 'บอทใช้ได้: ' + await tg.getMe(t); tgSaveDraft(); } catch (e) { $('#tgMsg').textContent = e.message; }
  });
  $('#btnTgFind').addEventListener('click', async () => {
    const t = $('#setTgToken').value.trim(); if (!t) { $('#tgMsg').textContent = 'วาง token ก่อน'; return; }
    const tg = await tgModule(); if (!tg) return; $('#tgMsg').textContent = 'กำลังค้นหา...';
    try {
      const chats = await tg.findChats(t);
      if (!chats.length) { $('#tgMsg').textContent = 'ยังไม่เจอกลุ่ม: ดึงบอทเข้ากลุ่มแล้วพิมพ์ข้อความในกลุ่ม 1 ครั้ง แล้วกดค้นหาใหม่'; return; }
      const sel = $('#setTgPick'); sel.classList.remove('hidden');
      sel.innerHTML = chats.map(c => `<option value="${esc(c.id)}">${esc(c.title)} (${esc(c.type)} ${esc(c.id)})</option>`).join('');
      $('#setTgChat').value = chats[0].id; sel.addEventListener('change', () => { $('#setTgChat').value = sel.value; });
      $('#tgMsg').textContent = `พบ ${chats.length} กลุ่ม เลือกแล้วกดบันทึก`; tgSaveDraft();
    } catch (e) { $('#tgMsg').textContent = e.message; }
  });
  $('#btnTgTest').addEventListener('click', async () => {
    tgSaveDraft(); const D = day();
    if (!D) { $('#tgMsg').textContent = 'โหลดไฟล์ก่อน จึงจะมีรูปให้ทดสอบส่ง'; return; }
    $('#btnTgTest').disabled = true; try { await sendToTelegram(D, $('#tgMsg')); } finally { $('#btnTgTest').disabled = false; }
  });
  $('#btnTestKey').addEventListener('click', async () => {
    const key = $('#setKey').value.trim(); if (!key) { $('#keyMsg').textContent = 'ใส่ key ก่อน'; return; }
    const m = await adviceModule(); if (!m) return;
    $('#keyMsg').textContent = 'กำลังทดสอบ...';
    try { const r = await m.testKey(key, $('#setModel').value); $('#keyMsg').textContent = r; } catch (e) { $('#keyMsg').textContent = e.message; }
  });
}

// ---------- เริ่ม ----------
renderAll();
// โหลดปลั๊กอินตามรายการในตั้งค่า (dev: ?plugin=<url> เพิ่มชั่วคราว)
{ const list = [...(state.settings.plugins || [])]; const q = new URLSearchParams(location.search).get('plugin'); if (q) list.push({ url: q, enabled: true });
  loadPlugins(AB, list.map(p => ({ ...p, url: PLUGIN_BASE && !/^https?:/.test(p.url) ? PLUGIN_BASE + p.url : p.url })), BUILD).then(r => { pluginLoadResults = r; renderPluginUi(); renderSettings(); for (const x of r) if (!x.ok) toast(`โหลดปลั๊กอินไม่ได้: ${x.url} (${x.error})`); AB.emit('plugins:ready', { results: r }); if (state.date) AB.emit('day:changed', { date: state.date }); }); }
// โหมดพัฒนา: ?keytest=<key> ทดสอบเส้นทาง SDK + ข้อความ error โดยไม่ต้องกดปุ่ม
{ const kt = new URLSearchParams(location.search).get('keytest'); if (kt) adviceModule().then(m => m && m.testKey(kt, state.settings.model)).then(r => { $('#exportMsg').textContent = 'keytest ok: ' + r; }).catch(e => { $('#exportMsg').textContent = 'keytest err: ' + e.message; }); }
{ const tt = new URLSearchParams(location.search).get('tgtest'); if (tt) tgModule().then(m => m && m.getMe(tt)).then(r => { $('#exportMsg').textContent = 'tgtest ok: ' + r; }).catch(e => { $('#exportMsg').textContent = 'tgtest err: ' + e.message; }); }
{ const st = new URLSearchParams(location.search).get('scrollto'); if (st) setTimeout(() => { const el = document.querySelector('.' + st); if (el) el.scrollIntoView(); }, 1500); }
const hashView = () => location.hash.replace(/^#\/?/, '');
showView(hashView() || (state.date ? 'overview' : 'load'));
// โหมดพัฒนา: ?auto=<path.xlsx> โหลดไฟล์อัตโนมัติ (ใช้กับ python -m http.server หรือ --allow-file-access-from-files)
let autoView = null;
{ const wa = new URLSearchParams(location.search).get('wauto'); if (wa) wa.split('|').reduce((ch, f) => ch.then(() => fetch(f)).then(r => r.blob()).then(b => readWeekFile(new File([b], f.split('/').pop()))), Promise.resolve()); }
const auto = new URLSearchParams(location.search).get('auto');
if (auto) autoView = hashView() || null;
if (auto) auto.split('|').reduce((chain, f) => chain.then(() => fetch(f)).then(r => r.arrayBuffer()).then(b => runAnalysis(b, f.split('/').pop())), Promise.resolve()).catch(e => { $('#loadInfo').innerHTML = `<div class="warnbox">auto โหลดไม่ได้: ${esc(e.message)}</div>`; });
