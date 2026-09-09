// app.js — หน้าจอกระดานแอด BLISSTECH (สถานะ, localStorage, เรนเดอร์ทุกหน้า)
import { analyze, cloneDefaults, mergePlan, diffTotals, campaignsToCsv, MULTI_PRODUCT, LAYER_NAMES, shortCamp, actualMetrics } from './engine.js?v=20260909143141';
import { mainFunnelSvg, productFunnelSvg } from './funnel.js?v=20260909143141';
import { createApi, loadPlugins } from './plugins.js?v=20260909143141';
import * as ENGINE from './engine.js?v=20260909143141';

// ---------- เก็บข้อมูล ----------
const KEYS = { settings: 'kad:settings', days: 'kad:days', plan: 'kad:plan', clips: 'kad:clips', manual: 'kad:manual' };
function load(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { toast('บันทึกไม่ได้: พื้นที่เก็บข้อมูลของเบราว์เซอร์เต็ม ลบวันเก่าในหน้าโหลดไฟล์'); return false; } }

const state = {
  settings: Object.assign(cloneDefaults(), load(KEYS.settings, {})),
  days: load(KEYS.days, {}),
  plan: load(KEYS.plan, null),
  clips: load(KEYS.clips, []),
  manual: load(KEYS.manual, { products: {}, layers: {} }),
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
  renderPngBlob: async (date) => { const D = (date ? state.days[date] : day()); if (!D) throw new Error('ยังไม่ได้โหลดไฟล์'); const m = await import('./sheet.js?v=20260909143141'); return (await m.renderPngBlob(D, currentPlan(), $('#sheetHost'))).blob; },
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
    fileName, uploadedAt: new Date().toISOString(), date: A.date, totals: A.totals, campaigns: A.campaigns, adsets: A.adsets, ads: A.ads, places: A.places,
    layers: A.layers, products: A.products, productFunnels: A.productFunnels, dupClips: A.dupClips, dupAdsets: A.dupAdsets, unresolved: A.unresolved, planAuto: A.plan, rowCount: A.rowCount,
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
  if (q.get('sheet')) import('./sheet.js?v=20260909143141').then(m => { $('#sheetHost').innerHTML = m.sheetHtml(rec, currentPlan()); }).catch(e => { $('#exportMsg').textContent = e.message; });
  if (q.get('png')) import('./sheet.js?v=20260909143141').then(m => m.exportPng(rec, currentPlan(), $('#sheetHost'), true)).then(r => { $('#exportMsg').textContent = 'png ok ' + r; }).catch(e => { $('#exportMsg').textContent = 'png fail ' + e.message; });
  toast(`วิเคราะห์ ${thDate(A.date)} เสร็จ`);
  renderAll(); showView(autoView || 'overview'); autoView = null;
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
  $('#chipDate').textContent = D ? `ข้อมูลวันที่ ${thDate(D.date)}` : 'ยังไม่ได้โหลดไฟล์';
  renderOverview(); renderFunnel(); renderDecisions(); renderPlan(); renderAdvice(); renderSettings();
  for (const id of ['ovProducts', 'ovPlaces', 'funnelMain', 'dupClips', 'dupAdsets', 'decisions', 'plan']) $('#' + id).classList.toggle('empty', !D);
  $('#advice').classList.toggle('empty', !(D && D.advice));
  $('#daysList').classList.toggle('empty', !dates.length);
}
$('#daysList').addEventListener('click', e => {
  const o = e.target.closest('[data-open]'), x = e.target.closest('[data-del]');
  if (o) { state.date = o.dataset.open; renderAll(); showView('overview'); }
  if (x) { if (confirm(`ลบข้อมูลวันที่ ${thDate(x.dataset.del)}?`)) { delete state.days[x.dataset.del]; save(KEYS.days, state.days); if (state.date === x.dataset.del) state.date = Object.keys(state.days).sort().pop() || null; renderAll(); } }
});

// ---------- ภาพรวม ----------
function prevDay() { if (!state.date) return null; const ds = Object.keys(state.days).sort().filter(d => d < state.date); return ds.length ? state.days[ds[ds.length - 1]] : null; }
function renderOverview() {
  const D = day();
  $('#ovDate').textContent = D ? thDate(D.date) : '';
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
  D.actual = act.rev === null ? null : act; save(KEYS.days, state.days); renderOverview(); toast(act.rev === null ? 'ล้างยอดจริงแล้ว' : 'บันทึกยอดจริงแล้ว'); AB.emit('actual:saved', { date: state.date, actual: D.actual });
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
async function adviceModule() { try { return await import('./advice.js?v=20260909143141'); } catch (e) { toast('ยังไม่มีส่วนคำแนะนำ (advice.js)'); return null; } }
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
  let m; try { m = await import('./sheet.js?v=20260909143141'); } catch { $('#exportMsg').textContent = 'ยังไม่มีส่วนสร้างรูป (sheet.js)'; return; }
  $('#exportMsg').textContent = 'กำลังสร้างรูป...'; $('#btnPng').disabled = true;
  try { const name = await m.exportPng(D, currentPlan(), $('#sheetHost')); $('#exportMsg').textContent = `ดาวน์โหลด ${name} แล้ว`; }
  catch (e) { $('#exportMsg').textContent = 'สร้างรูปไม่ได้: ' + e.message; }
  finally { $('#btnPng').disabled = false; }
});

// ---------- Telegram ----------
async function tgModule() { try { return await import('./telegram.js?v=20260909143141'); } catch { toast('ยังไม่มีส่วน Telegram (telegram.js)'); return null; } }
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
  let sheet; try { sheet = await import('./sheet.js?v=20260909143141'); } catch { statusEl.textContent = 'ยังไม่มีส่วนสร้างรูป (sheet.js)'; return false; }
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
const hashView = () => location.hash.replace(/^#\/?/, '');
showView(hashView() || (state.date ? 'overview' : 'load'));
// โหมดพัฒนา: ?auto=<path.xlsx> โหลดไฟล์อัตโนมัติ (ใช้กับ python -m http.server หรือ --allow-file-access-from-files)
let autoView = null;
const auto = new URLSearchParams(location.search).get('auto');
if (auto) autoView = hashView() || null;
if (auto) fetch(auto).then(r => r.arrayBuffer()).then(b => runAnalysis(b, auto.split('/').pop())).catch(e => { $('#loadInfo').innerHTML = `<div class="warnbox">auto โหลดไม่ได้: ${esc(e.message)}</div>`; });
