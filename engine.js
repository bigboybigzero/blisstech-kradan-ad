// engine.js — เครื่องคำนวณกระดานแอด BLISSTECH (ไม่แตะ DOM ไม่แตะ network)
// ต้องให้ผลตรงกับ ../สคริปต์/วิเคราะห์กระดานแอด.py
// ใช้ได้ทั้งในเบราว์เซอร์ (ES module) และในหน้าทดสอบ

export const COLS = {
  'ชื่อแคมเปญ': 'camp', 'ชื่อชุดโฆษณา': 'adset', 'โฆษณา': 'ad', 'ตำแหน่งโฆษณา': 'place',
  'สถานะการแสดงโฆษณา': 'status', 'การเข้าถึง': 'reach', 'อิมเพรสชัน': 'imp',
  'จำนวนเงินที่ใช้จ่ายไป (THB)': 'spend', 'การซื้อ': 'purch', 'ค่าคอนเวอร์ชั่นการซื้อ': 'rev',
  'การคลิกลิงก์': 'clicks', 'การเล่นวิดีโอ': 'vplay', 'การเล่นวิดีโอที่ 50%': 'v50',
  'การเล่นวิดีโอที่ 75%': 'v75', 'การเล่นวิดีโอที่ 95%': 'v95', 'การมีส่วนร่วมกับโพสต์': 'eng',
  'ประเภทผลลัพธ์': 'rtype', 'ผลลัพธ์': 'result', 'ความถี่': 'freq',
  'เริ่มการรายงาน': 'dateStart', 'สิ้นสุดการรายงาน': 'dateEnd',
  'ThruPlay': 'thru', 'การเล่นวิดีโอที่ 100%': 'v100', 'เวลาเล่นวิดีโอเฉลี่ย': 'avgt', 'ยอดดู': 'views',
  'งบประมาณของแคมเปญ': 'bud', 'อายุ': 'age', 'เพศ': 'gender', 'วัน': 'day',
  'ความคิดเห็นต่อโพสต์': 'comments', 'จำนวนการแชร์โพสต์': 'shares', 'ต้นทุนต่อการเริ่มการสนทนาผ่านการส่งข้อความ': 'cpmsg',
};
const REQUIRED = ['camp', 'adset', 'ad', 'spend', 'purch', 'rev', 'imp', 'reach'];
const NUM = ['reach', 'imp', 'spend', 'purch', 'rev', 'clicks', 'vplay', 'v50', 'v75', 'v95', 'eng', 'result', 'freq', 'thru', 'v100', 'avgt', 'views', 'comments', 'shares', 'cpmsg', 'bud'];

export const LAYER_NAMES = { 1: 'หว่าน/คนใหม่', 2: 'คนดูคลิป/มีส่วนร่วม', 3: 'คนคุย', 4: 'ลูกค้าเก่า' };
export const LAYER_ROLES = {
  1: 'ตัวเปิด: หยุดนิ้ว ให้ดูจบ สร้างกลุ่มให้ชั้น 2',
  2: 'ตัวกลาง: ตอบความกังวลของคนที่ดูจบแล้วไม่ซื้อ',
  3: 'ตัวไล่ปิด: ตอบสิ่งที่ค้างในแชท ให้เหตุผลซื้อวันนี้',
  4: 'ลูกค้าเก่า: ซื้อเพิ่ม ซื้อซ้ำ ซื้อข้ามสินค้า',
};
export const LAYER_BUDGET_SHARE = { 1: 30, 2: 25, 3: 10, 4: 35 };
export const LAYER_METRIC = {
  1: 'ต้นทุนต่อคนดูจบ 75% · CPM ต่ำกว่า 80',
  2: 'ROAS เกิน 4 · CTR เกิน 1.5%',
  3: 'ต้นทุนต่อออเดอร์ต่ำกว่า 100 (MINI) 200 (D5/D1)',
  4: 'ROAS เกิน 6 · ความถี่รวมไม่เกิน 3/วัน',
};
export const OPENER_STAGES = ['TOFU', 'MOFU', 'อินฟู', 'ภาพนิ่ง'];
export const MULTI_PRODUCT = 'หลายสินค้า'; // ตัวเลือกสำหรับแคมเปญรวมทุกสินค้า เช่น RE โปร 9.9

export const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'claude-opus-5',
  rules: {
    minSpend: 100,          // ต่ำกว่านี้ยังตัดสินไม่ได้
    stopRoas: 1.5, stopSpend: 150, stopZeroRevSpend: 300,
    goRoas: 4, scaleRoas: 6, scaleSpend: 500, scaleFactor: 1.25,
    watchRoas: 1.5,
    cutBudgetMin: 1000, cutAdpct: 50, cutTo: 300, watchCutBudgetMin: 500,
    l1CpmOk: 100, l1CpmWarn: 150, l23RoasOk: 3, l23RoasWarn: 1.5, l4RoasOk: 5, l4RoasWarn: 3,
    openerReach: 5000, l3V50pct: 2, dupAdsetCampaigns: 3,
  },
  productPatterns: [
    { name: 'Mag1Pro', regex: 'MAG1PRO' },
    { name: 'MINI (CC/CL)', regex: 'MINI|656' },
    { name: 'ที่ปัดน้ำฝน', regex: 'ปัดน้ำฝน' },
    { name: 'D5', regex: 'D5' },
    { name: 'D1', regex: 'D1' },
    { name: 'Premium Drive Set', regex: 'ลดหนัก' },
  ],
  stagePatterns: [
    { stage: 'TOFU', regex: 'TOFU' },
    { stage: 'MOFU', regex: 'MOFU' },
    { stage: 'BOFU', regex: 'BOFU' },
    { stage: 'อินฟู', regex: 'ขอฟรี' },
    { stage: 'โปร', regex: '\\d+\\.\\d+\\.?\\)|9\\.9' },
    { stage: 'BOFU', regex: 'ลูกค้าเก่า|RE ซื้อ' },
    { stage: 'ภาพนิ่ง', regex: '^\\s*(รุป|รูป|ภาพ)' },
  ],
  layerPatterns: [
    { layer: 4, regex: 'คนซื้อ' },
    { layer: 3, regex: 'คุย|INBOX 656|RE/Inbox|Pancake' },
    { layer: 2, regex: 'คนดู|VDO View|ENG\\+INBOX' },
  ],
  lookalikeRegex: 'LAL|LOOKALIKE|คล้าย',
  linkClickRegex: 'คลิก|CLICK',
};

/** ชื่อแคมเปญแบบย่อสำหรับแสดงผล: ตัด *ป้าย* รหัสบัญชี CBO/ABO วันที่ตั้ง งบตั้งต้น และ {O} ออก คงงบและวันที่ท้ายชื่อไว้ */
export function shortCamp(name) {
  return String(name || '')
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/\b(254|656|C0\d\d|CBO|ABO|VDO|VDo|รูป)\b\/?/g, ' ')
    .replace(/\b\d\d-\d\d\b\/?/g, ' ')
    .replace(/\b(150|300|500|1000)\/(?=\S)/g, ' ')
    .replace(/\{O\}/g, ' ')
    .replace(/(?<!\d)\/|\/(?!\d)/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function cloneDefaults() { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }

// ---------- อ่านแถว ----------
function num(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isNaN(v) ? null : v;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? null : n;
}
function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function dateStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = str(v);
  return s.slice(0, 10);
}

/** rows: array ของ object ที่คีย์เป็นหัวคอลัมน์ภาษาไทย (จาก SheetJS sheet_to_json) */
export function normalizeRows(rows) {
  if (!rows || !rows.length) throw new Error('ไฟล์ไม่มีข้อมูล');
  const header = Object.keys(rows[0]);
  const map = {};
  for (const h of header) { const k = COLS[h.trim()]; if (k) map[h] = k; }
  const missing = REQUIRED.filter(k => !Object.values(map).includes(k));
  if (missing.length) {
    const thai = missing.map(k => Object.keys(COLS).find(t => COLS[t] === k));
    throw new Error('ไฟล์ขาดคอลัมน์: ' + thai.join(', '));
  }
  const out = rows.map(r => {
    const o = {};
    for (const h in map) o[map[h]] = r[h];
    for (const k of NUM) o[k] = num(o[k]);
    for (const k of ['camp', 'adset', 'ad', 'place', 'status', 'rtype', 'age', 'gender']) o[k] = str(o[k]);
    o.dateStart = dateStr(o.dateStart); o.dateEnd = dateStr(o.dateEnd);
    o.day = o.day === undefined || o.day === null || o.day === '' ? '' : dateStr(o.day);
    o.noval = (o.purch > 0 && o.rev === null) ? o.purch : 0;
    o.msgs = (o.cpmsg > 0 && o.spend > 0) ? o.spend / o.cpmsg : 0;   // จำนวนแชทที่เริ่ม = ใช้จ่าย ÷ ต้นทุนต่อแชท
    if (o.v95 === null && o.v100 !== null) o.v95 = o.v100;            // ไฟล์แบบใหม่ไม่มี 95% ใช้ 100% แทน
    return o;
  });
  const totalRow = out.find(r => !r.camp && !r.adset && !r.ad && r.spend !== null);
  const data = out.filter(r => r.camp);
  if (!data.length) throw new Error('ไม่พบแถวข้อมูลแคมเปญ');
  return { totalRow, data };
}

// ---------- จัดหมวด ----------
const rx = (p) => new RegExp(p, 'i');
export function classifyProduct(camp, settings) {
  for (const p of settings.productPatterns) if (rx(p.regex).test(camp)) return p.name;
  return null;
}
export function classifyStage(ad, settings, clips) {
  const reg = (clips || []).find(c => c.name === ad);
  if (reg && reg.stage) return reg.stage;
  for (const p of settings.stagePatterns) if (rx(p.regex).test(ad)) return p.stage;
  return null;
}
export function classifyLayer(adset, settings) {
  // ตัดส่วน "Ex คนซื้อ..." (กลุ่มที่ยกเว้น) ออกก่อน ไม่งั้นชุดรีทาร์เก็ตคนดูที่ยกเว้นคนซื้อจะกลายเป็นชั้น 4
  const a = String(adset || '').replace(/\/?\s*ex\s*คนซื้อ[^/]*/gi, '');
  for (const p of settings.layerPatterns) if (rx(p.regex).test(a)) return p.layer;
  return 1;
}
export function parseBudget(camp) {
  const m = /-\s*(\d{3,4})\s*(\d\d\/\d\d)?\s*(\{O\})?\s*$/.exec(camp);
  return m ? { budget: parseInt(m[1], 10), budgetDate: m[2] || null } : { budget: null, budgetDate: null };
}

// ---------- รวมยอด ----------
function sum(rows, k) { let s = 0; for (const r of rows) if (r[k] !== null && r[k] !== undefined) s += r[k]; return s; }
function metrics(rows) {
  const spend = sum(rows, 'spend'), rev = sum(rows, 'rev'), purch = sum(rows, 'purch'), imp = sum(rows, 'imp');
  const reach = sum(rows, 'reach'), clicks = sum(rows, 'clicks'), v50 = sum(rows, 'v50'), v95 = sum(rows, 'v95');
  return {
    spend, rev, purch, imp, reach, clicks, v50, v95,
    noval: sum(rows, 'noval'), eng: sum(rows, 'eng'), vplay: sum(rows, 'vplay'),
    roas: spend > 0 ? rev / spend : null,
    adpct: rev > 0 ? spend / rev * 100 : null,
    cpp: purch > 0 ? spend / purch : null,
    cpm: imp > 0 ? spend / imp * 1000 : null,
    ctr: imp > 0 ? clicks / imp * 100 : null,
    v50pct: imp > 0 ? v50 / imp * 100 : null,
    freq: reach > 0 ? imp / reach : null,
    // พฤติกรรมคนดู (ไฟล์เก่าไม่มีคอลัมน์เหล่านี้ → null)
    thru: sum(rows, 'thru'), v100: sum(rows, 'v100'), views: sum(rows, 'views'), comments: sum(rows, 'comments'), shares: sum(rows, 'shares'), msgs: sum(rows, 'msgs'),
    thruPct: hasAny(rows, 'thru') && vplaySum(rows) >= 100 ? sum(rows, 'thru') / vplaySum(rows) * 100 : null,   // ภาพนิ่งเล่นวิดีโอไม่ถึง 100 ครั้ง ไม่คิด
    v100Pct: hasAny(rows, 'v100') && vplaySum(rows) >= 100 ? sum(rows, 'v100') / vplaySum(rows) * 100 : null,
    avgWatch: hasAny(rows, 'avgt') && vplaySum(rows) >= 100 ? rows.reduce((t, r) => t + (r.avgt || 0) * (r.vplay || 0), 0) / vplaySum(rows) : null,
    costPerMsg: sum(rows, 'msgs') > 0 ? spend / sum(rows, 'msgs') : null,
    costPerThru: sum(rows, 'thru') >= 10 ? spend / sum(rows, 'thru') : null,   // ภาพนิ่งมี ThruPlay 0-2 ครั้ง ไม่คิด
    rows: rows.length,
    active: rows.filter(r => r.status === 'active').length,
  };
}
function hasAny(rows, k) { return rows.some(r => r[k] !== null && r[k] !== undefined); }
function vplaySum(rows) { return sum(rows, 'vplay'); }
function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}
const topBy = (arr, k) => arr.reduce((a, b) => (b[k] > (a ? a[k] : -1) ? b : a), null);

// ---------- ตัดสิน ----------
function round100(x) { return Math.round(x / 100) * 100; }
export function decide(c, rules) {
  const R = rules, r = c.roas === null ? 0 : c.roas, reasons = [];
  let group, budgetNext = c.budget;
  const opener = OPENER_STAGES.includes(c.stage);
  if (c.spend < R.minSpend) { group = 'watch'; reasons.push('ข้อมูลยังน้อย ปล่อยให้ CBO จัดสรร'); }
  else if (c.rev === 0 && c.purch > 0) { group = 'watch'; reasons.push(`มี ${c.purch} ออเดอร์แต่ไม่มีมูลค่า ตรวจ tracking ก่อนตัดสิน`); }
  else if (opener && r < R.l23RoasOk) {
    group = 'watch'; reasons.push('คลิปเปิด/คลิปกลาง วัดที่ CPM และคนดูจบ ไม่ใช่ ROAS');
    if (c.budget >= R.cutBudgetMin && (c.rev === 0 || (c.adpct !== null && c.adpct > R.cutAdpct))) { budgetNext = R.cutTo; reasons.push(`ลดงบเหลือ ${R.cutTo} ไม่ปิด`); }
  }
  else if (!opener && c.spend >= R.stopSpend && r < R.stopRoas) { group = 'stop'; budgetNext = 0; reasons.push(`ROAS ${r.toFixed(2)} ต่ำกว่า ${R.stopRoas} ทั้งที่เป็นคลิปปิดการขาย`); }
  else if (!opener && c.spend >= R.stopZeroRevSpend && c.rev === 0) { group = 'stop'; budgetNext = 0; reasons.push(`ใช้ ${Math.round(c.spend)} บาท ไม่มียอดเลย`); }
  else if (r >= R.scaleRoas && c.spend >= R.scaleSpend) { group = 'go'; if (c.budget) budgetNext = round100(c.budget * R.scaleFactor); reasons.push(`ROAS ${r.toFixed(2)} เพิ่มงบ ${Math.round((R.scaleFactor - 1) * 100)}%`); }
  else if (r >= R.goRoas) { group = 'go'; reasons.push(`ROAS ${r.toFixed(2)} คงงบ`); }
  else if (r >= R.watchRoas) { group = 'watch'; reasons.push(`กำไรบาง ROAS ${r.toFixed(2)} ดูอีก 1-2 วัน`); if (c.budget >= R.watchCutBudgetMin) { budgetNext = R.cutTo; reasons.push(`ลดงบเหลือ ${R.cutTo}`); } }
  else { group = 'stop'; budgetNext = 0; reasons.push(`ROAS ${r.toFixed(2)} ไม่คุ้ม`); }
  return { group, budgetNext, reasons };
}

function layerStatus(layer, m, rules, hasMofu) {
  if (!m || m.rows === 0) return 'none';
  const r = m.roas === null ? 0 : m.roas;
  let s;
  if (layer === 1) s = m.cpm === null ? 'warn' : m.cpm <= rules.l1CpmOk ? 'ok' : m.cpm <= rules.l1CpmWarn ? 'warn' : 'gap';
  else if (layer === 4) s = r >= rules.l4RoasOk ? 'ok' : r >= rules.l4RoasWarn ? 'warn' : 'gap';
  else s = r >= rules.l23RoasOk ? 'ok' : r >= rules.l23RoasWarn ? 'warn' : 'gap';
  if (layer === 2 && !hasMofu && s === 'ok') s = 'warn';
  return s;
}

// ---------- วิเคราะห์ทั้งหมด ----------
/**
 * @param rows แถวจาก sheet_to_json
 * @param settings DEFAULT_SETTINGS หรือที่ผู้ใช้แก้
 * @param clips ทะเบียนคลิป [{name, stage, product}]
 * @param manual { products: {campName: product}, layers: {adsetName: layer} } ที่พนักงานเลือกให้ชื่อที่จับกฎไม่ได้
 */
export function analyze(rows, settings = DEFAULT_SETTINGS, clips = [], manual = {}) {
  const S = settings, R = S.rules;
  const { totalRow, data } = normalizeRows(rows);
  const mp = manual.products || {}, ml = manual.layers || {};
  for (const r of data) {
    r.product = mp[r.camp] || classifyProduct(r.camp, S);
    r.stage = classifyStage(r.ad, S, clips);
    r.layer = ml[r.adset] || classifyLayer(r.adset, S);
    Object.assign(r, parseBudget(r.camp));
  }
  const date = (data[0] && data[0].dateStart) || (totalRow && totalRow.dateStart) || '';
  const dateEnd = (data[0] && data[0].dateEnd) || (totalRow && totalRow.dateEnd) || date;

  // แคมเปญ
  const campaigns = [...groupBy(data, r => r.camp)].map(([name, rs]) => {
    const m = metrics(rs);
    const ads = [...groupBy(rs, r => r.ad)].map(([ad, ars]) => ({ name: ad, stage: ars[0].stage, ...metrics(ars) }));
    const adsets = [...groupBy(rs, r => r.adset)].map(([as, srs]) => ({ name: as, layer: srs[0].layer, ...metrics(srs) }));
    const c = {
      name, product: rs[0].product, budget: rs[0].budget, budgetDate: rs[0].budgetDate,
      bud: rs.reduce((m, r) => (r.bud !== null && r.bud !== undefined && r.bud > (m ?? 0) ? r.bud : m), null),
      ads: ads.sort((a, b) => b.spend - a.spend), adsets: adsets.sort((a, b) => b.spend - a.spend),
      stage: (topBy(ads, 'spend') || {}).stage || null,
      layer: (topBy(adsets, 'spend') || {}).layer || 1,
      ...m,
    };
    c.stageLabel = c.stage || 'ไม่ระบุ';
    Object.assign(c, decide({ ...c, stage: c.stage || 'อื่นๆ' }, R));
    return c;
  }).sort((a, b) => b.spend - a.spend);

  const unresolved = {
    products: campaigns.filter(c => !c.product).map(c => c.name),
    stages: [...new Set(data.filter(r => !r.stage).map(r => r.ad))],
  };

  // ชุดโฆษณา / คลิป / ตำแหน่ง
  const adsets = [...groupBy(data, r => r.adset + '\u0001' + r.camp)].map(([k, rs]) => {
    const [name, camp] = k.split('\u0001');
    return { name, camp, layer: rs[0].layer, product: rs[0].product, ...metrics(rs) };
  }).sort((a, b) => b.spend - a.spend);
  const ads = [...groupBy(data, r => r.ad + '\u0001' + r.camp)].map(([k, rs]) => {
    const [name, camp] = k.split('\u0001');
    return { name, camp, stage: rs[0].stage, product: rs[0].product, layer: rs[0].layer, adset: rs[0].adset, ...metrics(rs) };
  }).sort((a, b) => b.spend - a.spend);
  const places = [...groupBy(data, r => r.place)].map(([name, rs]) => ({ name, ...metrics(rs) })).sort((a, b) => b.spend - a.spend);

  // ยอดรวม
  const computed = metrics(data);
  const totals = totalRow
    ? { ...computed, spend: totalRow.spend ?? computed.spend, rev: totalRow.rev ?? computed.rev, purch: totalRow.purch ?? computed.purch, reach: totalRow.reach ?? computed.reach, imp: totalRow.imp ?? computed.imp }
    : computed;
  totals.roas = totals.spend > 0 ? totals.rev / totals.spend : null;
  totals.adpct = totals.rev > 0 ? totals.spend / totals.rev * 100 : null;
  totals.cpp = totals.purch > 0 ? totals.spend / totals.purch : null;
  totals.aov = (totals.purch - totals.noval) > 0 ? totals.rev / (totals.purch - totals.noval) : null;
  totals.fromTotalRow = !!totalRow;
  totals.date = date;

  // ชั้นกรวย
  const layers = [1, 2, 3, 4].map(L => {
    const rs = data.filter(r => r.layer === L), m = metrics(rs);
    return { layer: L, name: LAYER_NAMES[L], ...m, spendShare: totals.spend ? m.spend / totals.spend * 100 : 0, revShare: totals.rev ? m.rev / totals.rev * 100 : 0, adsets: new Set(rs.map(r => r.adset)).size };
  });

  // สินค้า
  const productNames = [...new Set(data.map(r => r.product || 'ไม่ระบุ'))];
  const products = productNames.map(p => {
    const rs = data.filter(r => (r.product || 'ไม่ระบุ') === p), m = metrics(rs);
    return { name: p, ...m, spendShare: totals.spend ? m.spend / totals.spend * 100 : 0, revShare: totals.rev ? m.rev / totals.rev * 100 : 0 };
  }).sort((a, b) => b.spend - a.spend);

  // กรวยแยกสินค้า
  const productFunnels = products.filter(p => p.name !== 'ไม่ระบุ' && p.name !== MULTI_PRODUCT).map(p => {
    const prs = data.filter(r => r.product === p.name);
    const ls = [1, 2, 3, 4].map(L => {
      const rs = prs.filter(r => r.layer === L), m = metrics(rs);
      const clipNames = [...new Set(rs.map(r => r.ad))];
      const stages = [...new Set(rs.map(r => r.stage))];
      const hasMofu = stages.includes('MOFU');
      const onlyPromo = rs.length > 0 && stages.every(s => s === 'โปร');
      const status = layerStatus(L, m, R, hasMofu);
      const note = rs.length === 0 ? 'ไม่มีชุดโฆษณาในชั้นนี้'
        : L === 2 && onlyPromo ? 'ได้แต่คลิปโปร ไม่มีคลิปคลายกังวล'
        : L === 3 && m.v50pct !== null && m.v50pct < R.l3V50pct ? 'คนกลุ่มนี้แทบไม่ดูคลิป ใช้การ์ด/ข้อความแทน'
        : '';
      return { layer: L, name: LAYER_NAMES[L], ...m, status, clips: clipNames, stages, note };
    });
    return { product: p.name, spend: p.spend, rev: p.rev, roas: p.roas, adpct: p.adpct, layers: ls };
  });

  // คลิปเดียวกันหลายแคมเปญ
  const dupClips = [...groupBy(ads, a => a.name)].filter(([, arr]) => arr.length >= 2)
    .map(([name, arr]) => ({ name, uses: arr.sort((a, b) => (b.roas || 0) - (a.roas || 0)).map(a => ({ camp: a.camp, adset: a.adset, layer: a.layer, spend: a.spend, purch: a.purch, rev: a.rev, roas: a.roas })) }))
    .sort((a, b) => b.uses.length - a.uses.length);
  // ชุดโฆษณาเดียวกันหลายแคมเปญ
  // ชุดโฆษณาเดียวกันหลายแคมเปญ: จับจากส่วนแรกของชื่อ (ก่อน "/") เพราะทีมตั้งชื่อรายชื่อเดียวกันต่างท้ายเล็กน้อย
  const adsetCore = n => n.split('/')[0].trim();
  const dupAdsets = [...groupBy(adsets, a => adsetCore(a.name))].filter(([, arr]) => new Set(arr.map(a => a.camp)).size >= R.dupAdsetCampaigns)
    .map(([name, arr]) => ({ name, layer: arr[0].layer, campaigns: [...new Set(arr.map(a => a.camp))], reach: sum(arr, 'reach'), spend: sum(arr, 'spend') }))
    .sort((a, b) => b.campaigns.length - a.campaigns.length);

  const plan = buildPlan({ data, layers, productFunnels, adsets, campaigns }, S);
  const brief = buildBrief(campaigns, totals, layers, date);
  const daily = buildDaily(campaigns, data, totals, date);
  const journey = buildJourney(ads, adsets, productFunnels.map(p => p.product));
  const behaviour = buildBehaviour(ads, adsets);

  return { date, dateEnd, totals, campaigns, adsets, ads, places, layers, products, productFunnels, dupClips, dupAdsets, unresolved, plan, journey, behaviour, brief, daily, rowCount: data.length, _rows: data };
}

// ---------- แผนคอนเทนต์และกลุ่มเป้าหมาย (auto) ----------
export function buildPlan(ctx, S) {
  const R = S.rules;
  const { data, productFunnels, adsets } = ctx;
  const plan = [1, 2, 3, 4].map(L => ({
    layer: L, name: LAYER_NAMES[L], role: LAYER_ROLES[L], budgetShare: LAYER_BUDGET_SHARE[L], metric: LAYER_METRIC[L],
    clipsHave: [], clipsMissing: [], audiences: [], audiencesToBuild: [],
  }));
  const P = L => plan[L - 1];
  for (const pf of productFunnels) {
    for (const l of pf.layers) {
      if (l.status === 'ok' || l.status === 'warn') for (const c of l.clips) P(l.layer).clipsHave.push({ name: c, product: pf.product, source: 'auto' });
    }
    const l1 = pf.layers[0], l2 = pf.layers[1], l3 = pf.layers[2], l4 = pf.layers[3];
    if (l2.rows > 0 && !l2.stages.includes('MOFU')) P(2).clipsMissing.push({ name: `คลิปคลายกังวลสำหรับ ${pf.product} (ของแท้-ของปลอม / คืนเงิน / เทียบรุ่น)`, product: pf.product, why: 'ชั้น 2 มีแต่คลิปโปร', source: 'auto', status: 'todo' });
    if (l2.rows === 0 && l1.rows > 0) P(2).clipsMissing.push({ name: `คลิปคลายกังวลสำหรับ ${pf.product}`, product: pf.product, why: 'ยังไม่มีชั้น 2 เลย', source: 'auto', status: 'todo' });
    if (l3.rows > 0 && l3.v50pct !== null && l3.v50pct < R.l3V50pct) P(3).clipsMissing.push({ name: `การ์ดคำถามที่ถามบ่อย ${pf.product}`, product: pf.product, why: `คนคุยดูครึ่งคลิปแค่ ${l3.v50pct.toFixed(1)}%`, source: 'auto', status: 'todo' });
    if (l1.rows > 0 && l1.cpm !== null && l1.cpm > R.l1CpmOk) P(1).clipsMissing.push({ name: `ตัวเปิดแนวรีวิว/ตลกสำหรับ ${pf.product}`, product: pf.product, why: `CPM ชั้น 1 อยู่ที่ ${Math.round(l1.cpm)}`, source: 'auto', status: 'todo' });
  }
  // ขายข้าม: สินค้าที่มีชั้น 4 แต่ไม่มีแคมเปญที่ชื่อบ่งว่าขายข้าม
  const prods = productFunnels.map(p => p.product);
  for (const pf of productFunnels) {
    const others = prods.filter(p => p !== pf.product);
    if (pf.layers[3].rows > 0 && others.length) P(4).clipsMissing.push({ name: `ขายข้าม ลูกค้า ${pf.product} → ${others[0]}`, product: pf.product, why: 'ลูกค้าเก่าถูกยิงด้วยสินค้าเดิมซ้ำ', source: 'auto', status: 'todo' });
  }
  // กลุ่มที่ใช้อยู่
  for (const a of [...new Map(adsets.map(a => [a.name, a])).values()]) P(a.layer).audiences.push({ name: a.name, source: 'auto' });
  // กลุ่มที่ควรสร้าง
  const allAdsetNames = adsets.map(a => a.name).join(' | ');
  const openers = ctx.campaigns.filter(c => c.layer === 1 && c.reach > R.openerReach);
  for (const c of openers) {
    const clip = (c.ads[0] || {}).name || c.name;
    const short = clip.replace(/^\d+\.\s*/, '').slice(0, 30);
    if (!new RegExp('คนดู.*75%').test(allAdsetNames) || !allAdsetNames.includes(short.slice(0, 8)))
      P(2).audiencesToBuild.push({ name: `คนดู "${short}" จบ 75% 7-14 วัน`, why: `คลิปเปิดเข้าถึง ${Math.round(c.reach).toLocaleString()} คน ยังไม่มีกลุ่มคนดูจบ`, source: 'auto' });
  }
  for (const pf of productFunnels) {
    if (!new RegExp(`ENG\\+INBOX.*(${pf.product.split(' ')[0]})`, 'i').test(allAdsetNames)) P(2).audiencesToBuild.push({ name: `ENG+INBOX 14 วัน ${pf.product}`, why: 'ยังไม่มีกลุ่มมีส่วนร่วมแยกสินค้า', source: 'auto' });
    if (pf.layers[2].rows === 0 && (pf.layers[0].rows > 0 || pf.layers[1].rows > 0)) P(3).audiencesToBuild.push({ name: `คนทักแชท 7-30 วัน ${pf.product}`, why: 'มีชั้น 1-2 แต่ไม่มีชั้นไล่ปิด', source: 'auto' });
  }
  if (!new RegExp(S.lookalikeRegex, 'i').test(allAdsetNames)) P(1).audiencesToBuild.push({ name: 'Lookalike 1-2% ของคนซื้อ 90 วัน', why: 'ยังไม่มี Lookalike ในบัญชี', source: 'auto' });
  if (!new RegExp(S.linkClickRegex, 'i').test(allAdsetNames)) P(2).audiencesToBuild.push({ name: 'คนคลิกลิงก์ 7 วัน', why: `มีคลิกลิงก์ ${Math.round(sum(data, 'clicks')).toLocaleString()} ครั้ง ไม่มีชุดยิงกลับ`, source: 'auto' });
  // ตัดซ้ำ
  for (const p of plan) for (const k of ['clipsHave', 'clipsMissing', 'audiences', 'audiencesToBuild']) {
    const seen = new Set(); p[k] = p[k].filter(x => (seen.has(x.name) ? false : seen.add(x.name)));
  }
  return plan;
}

// ---------- ผังคอนเทนต์ต่อสินค้า (เส้นทางคลิป 4 ขั้น) ----------
export const JOURNEY_STEPS = [
  { step: 1, key: 'open', name: 'คลิปเปิด', goal: 'สร้างการรับรู้ หยุดนิ้ว ให้ดูจบ', who: 'คนใหม่ที่ยังไม่รู้จักเรา (หว่าน / ความสนใจ / Lookalike)', layers: [1],
    genres: ['ตลก-ไวรัล (แนวเจ๊ศรี)', 'รีวิวจากคนใช้จริง / อินฟลูเอนเซอร์', 'ปัญหาที่คนมีทุกวัน แล้วโชว์วิธีแก้'], metric: 'วัดที่ CPM และต้นทุนต่อคนดูจบ 75% ไม่วัด ROAS',
    next: 'คนที่ดูจบ 75% / กดไลก์คอมเมนต์ / ทักแชท แต่ยังไม่ซื้อ' },
  { step: 2, key: 'concern', name: 'คลิปคลายกังวล', goal: 'ตอบข้อกังวลที่ทำให้ยังไม่กดซื้อ', who: 'คนที่เห็นคลิปเปิดจบแล้วยังไม่ซื้อ (คนดู 75% / มีส่วนร่วม / ทักแชท 3-7 วัน)', layers: [2],
    genres: ['ของแท้ vs ของปลอม / เช็คยังไงไม่โดนหลอก', 'คืนเงินได้ใน 7 วัน / รับประกัน', 'เทียบรุ่น เลือกรุ่นไหนดี', 'ใช้กับมือถือ/รถรุ่นไหนได้', 'ทดสอบให้ดูจริง (ชาร์จเร็ว แม่เหล็กแน่น)'], metric: 'ROAS เกิน 4 · CTR เกิน 1.5%',
    next: 'คนที่ดูคลิปคลายกังวลแล้วยังไม่ซื้อ / ทักแชทแล้วเงียบ' },
  { step: 3, key: 'offer', name: 'คลิปราคาพิเศษ', goal: 'ให้เหตุผลซื้อวันนี้ด้วยโปรจำกัดเวลา', who: 'คนที่ผ่านคลิปคลายกังวลแล้วยังไม่ซื้อ และคนทักแชทที่ยังไม่ปิด', layers: [3],
    genres: ['โปรราคาพิเศษ นับถอยหลัง / จำนวนจำกัด', 'ราคาพิเศษเฉพาะคนที่ทักแชท', 'การ์ด 5 คำถามที่ถามบ่อย + ปุ่มทักแชท (คนกลุ่มนี้ไม่ดูคลิปยาว)'], metric: 'ต้นทุนต่อออเดอร์ต่ำกว่า 100 (MINI) / 200 (D5, D1)',
    next: 'ซื้อแล้ว → ตัดออกจากทุกขั้น 30 วัน แล้วเข้ารายชื่อลูกค้าเก่า' },
  { step: 4, key: 'repeat', name: 'ลูกค้าเก่า', goal: 'ซื้อเพิ่ม ซื้อซ้ำ ซื้อข้ามสินค้า', who: 'คนที่เคยซื้อ (ตัดคนที่เพิ่งซื้อ 30 วัน)', layers: [4],
    genres: ['ซื้อเพิ่มให้รถอีกคัน / ซื้อตัวที่สอง', 'ขายข้ามสินค้า (มีที่จับแล้วต้องมีหัวชาร์จ)', 'ของใหม่เปิดตัวให้ลูกค้าเก่าก่อน', 'โปรเฉพาะลูกค้าเก่า'], metric: 'ROAS เกิน 6 · ความถี่รวมไม่เกิน 3/วัน',
    next: '' },
];
const GENRE_KEYS = [
  ['ของแท้ vs ของปลอม', /ปลอม|หลอก|ของแท้|แฉ|เช็ค/],
  ['คืนเงิน / รับประกัน', /คืนเงิน|ประกัน|กล้ารับ|ไม่ใช่/],
  ['เทียบรุ่น', /เทียบ|รุ่นใหม่|รุ่นเก่า|ต่าง|เลือก/],
  ['ใช้กับรุ่นไหน', /ใช้กับ|รองรับ|รุ่นไหน|iphone|android|type-c|lightning/i],
  ['ทดสอบให้ดู', /ทดสอบ|ลอง|จริงไหม|แม่เหล็ก/],
  ['โปร / ราคาพิเศษ', /โปร|ลด|ราคา|9\.9|หั่น|ประหยัด|บาท/],
  ['คำถามที่ถามบ่อย', /คำถาม|faq|ถามบ่อย/i],
  ['ตลก-ไวรัล', /เจ้ศรี|เจ๊ศรี|ปากอ้า|ตลก/],
  ['รีวิว / อินฟู', /ขอฟรี|รีวิว|review|_/],
  ['ปัญหาที่คนมี', /รำคาญ|เคยไหม|ปัญหา|เลิกทน|ถึงเวลา|มองไม่ชัด/],
  ['ซื้อเพิ่ม / เลิกย้าย', /หลายคัน|ติดรถ|เลิกย้าย|ตัวที่สอง|มากกว่า/],
  ['ขายข้าม', /ขายข้าม|ต้องมี|คู่กัน/],
  ['ลูกค้าเก่า', /ลูกค้าเก่า|RE ซื้อ/],
];
export function clipGenres(name) { const out = []; for (const [g, rx] of GENRE_KEYS) if (rx.test(name)) out.push(g); return out; }
function stepOfStage(stage, layer) {
  if (stage === 'MOFU') return 2;
  if (stage === 'โปร') return 3;
  if (stage === 'BOFU') return layer === 4 ? 4 : 3;
  if (['TOFU', 'อินฟู', 'ภาพนิ่ง'].includes(stage)) return 1;
  return layer >= 4 ? 4 : layer === 3 ? 3 : layer === 2 ? 2 : 1; // ไม่มีป้าย: ใช้ชั้นที่ยิงอยู่
}

/** ผังคอนเทนต์ต่อสินค้า: ใครเห็นคลิปอะไร ขั้นถัดไปควรเป็นอะไร */
export function buildJourney(ads, adsets, productNames) {
  return productNames.map(product => {
    const pads = ads.filter(a => a.product === product && a.spend > 0);
    const padsets = adsets.filter(a => a.product === product);
    const steps = JOURNEY_STEPS.map(S => {
      const audiences = [...new Set(padsets.filter(a => S.layers.includes(a.layer)).map(a => a.name))];
      const here = pads.filter(a => S.layers.includes(a.layer)).map(a => ({ name: a.name, stage: a.stage || 'ไม่ระบุ', spend: a.spend, purch: a.purch, noval: a.noval, rev: a.rev, roas: a.roas, v95: a.v95, fits: stepOfStage(a.stage, a.layer) === S.step, genres: clipGenres(a.name) }));
      // คลิปที่ "เข้าขั้นนี้" ตามป้าย แต่กำลังยิงอยู่ที่ชั้นอื่น → ควรย้ายมา
      const misplaced = pads.filter(a => !S.layers.includes(a.layer) && stepOfStage(a.stage, a.layer) === S.step && S.step !== 1 && a.stage)
        .map(a => ({ name: a.name, fromLayer: a.layer, stage: a.stage, roas: a.roas, spend: a.spend }));
      const genresHave = new Set([...here.filter(h => h.fits).flatMap(h => h.genres), ...misplaced.flatMap(m => clipGenres(m.name))]); // นับคลิปที่มีอยู่แต่ยิงผิดชั้นด้วย (แค่ย้าย ไม่ต้องทำใหม่)
      const rec = [];
      if (S.step === 2) {
        for (const g of ['ของแท้ vs ของปลอม', 'คืนเงิน / รับประกัน', 'เทียบรุ่น']) if (!genresHave.has(g)) rec.push(`ทำคลิป "${g}" สำหรับ ${product}`);
        if (here.length && !here.some(h => h.fits)) rec.unshift(misplaced.length ? `ขั้นนี้ยังไม่มีคลิปคลายกังวล แต่มีอยู่แล้ว ${misplaced.length} คลิปที่ยิงผิดชั้น ย้ายมาก่อน ไม่ต้องทำใหม่` : 'ขั้นนี้ได้แต่คลิปโปร/ปิดการขาย คนยังไม่หายกังวลจึงไม่ซื้อ');
      }
      if (S.step === 3) {
        if (!genresHave.has('โปร / ราคาพิเศษ')) rec.push(`ทำคลิปโปรจำกัดเวลาสำหรับ ${product}`);
        if (!genresHave.has('คำถามที่ถามบ่อย')) rec.push(`ทำการ์ด "5 คำถามที่ถามบ่อย" ${product} สำหรับคนทักแชท`);
      }
      if (S.step === 1 && !here.length) rec.push(`ยังไม่มีคลิปเปิดของ ${product} เลย คนใหม่ไม่รู้จักสินค้านี้`);
      if (S.step === 4 && here.length && !genresHave.has('ขายข้าม')) rec.push(`ทำคลิปขายข้ามให้ลูกค้า ${product} ซื้อสินค้าอื่นเพิ่ม`);
      const status = here.length === 0 ? (audiences.length ? 'gap' : 'none') : here.some(h => h.fits) ? (here.every(h => h.fits) ? 'ok' : 'warn') : 'gap';
      return { ...S, audiences, clips: here.sort((a, b) => b.spend - a.spend), misplaced, recommendations: rec, status };
    });
    return { product, steps };
  });
}

// ---------- พฤติกรรมคนดู: คลิป × กลุ่ม (ใช้เมื่อยอดซื้อจาก Meta เชื่อไม่ได้) ----------
export const BEHAVIOUR_RULES = { minSpend: 300, watchThru: 8, watchSec: 6, chatCost: 20, chatCostOk: 40, buyRoas: 4, thruCostOk: 1 };
export const STRATEGY = [
  { key: 'A', name: 'A คนใหม่ (ตัวเปิด)', who: 'หว่าน · ความสนใจ "โทรศัพท์" · Lookalike คนซื้อ', exclude: 'ซื้อแล้ว 30 วัน · ทักแชท 3 วัน · คนดูคลิปเปิดจบ (ThruPlay) 14 วัน', content: 'ตัวเปิด ตลก-รีวิว-ปัญหาที่คนมี และคลิปแฉที่คนดูนาน', metric: 'ต่อ ThruPlay ≤ 1 บาท · ต่อแชท ≤ 20 · ThruPlay ≥ 8% · ไม่วัด ROAS', share: 30 },
  { key: 'B', name: 'B ดูจบแล้วยังไม่ซื้อ (คลายกังวล)', who: 'ThruPlay ของคลิปเปิด 14 วัน · ENG+INBOX 14 วัน (แยกสินค้า)', exclude: 'ซื้อแล้ว 30 วัน · ทักแชท 3 วัน', content: 'ของแท้-ปลอม · เทียบรุ่น · คืนเงิน · ใช้กับรุ่นไหน · ทดสอบให้ดู', metric: 'CTR ≥ 1.5% · ต่อแชท ≤ 40 · ROAS ≥ 3', share: 25 },
  { key: 'C', name: 'C ทักแล้วเงียบ (ไล่ปิด)', who: 'ทักแชท 7-30 วัน', exclude: 'ซื้อแล้ว 30 วัน · ทักแชท 3 วัน', content: 'ไม่ใช่วิดีโอยาว: การ์ดคำถามที่ถามบ่อย · โปรเฉพาะคนทัก · แอดมินตามแชท', metric: 'ต้นทุนต่อออเดอร์จริง ≤ 100 (MINI) / 200 (D5, D1)', share: 10 },
  { key: 'D', name: 'D ลูกค้าเก่า (ซื้อเพิ่ม/ขายข้าม)', who: 'รายชื่อคนซื้อ แยกตามสินค้าที่ซื้อ', exclude: 'ซื้อแล้ว 30 วัน · ไม่เกิน 2 แคมเปญต่อรายชื่อ', content: 'ข้อเสนอที่จบใน 3 วินาที: ซื้อเพิ่ม · เลิกย้าย · ขายข้าม · โปรลูกค้าเก่า', metric: 'ROAS ≥ 5 · ความถี่ ≤ 3/วัน', share: 35 },
];
const behTags = (m, R) => {
  const t = [];
  if ((m.thruPct !== null && m.thruPct >= R.watchThru) || (m.avgWatch !== null && m.avgWatch >= R.watchSec)) t.push('ดู');
  if (m.costPerMsg !== null && m.costPerMsg <= R.chatCost) t.push('ทัก');
  if (m.roas !== null && m.roas >= R.buyRoas) t.push('ซื้อ');
  return t;
};
/** คืน { hasVideoStats, clips:[...], audiences:[...], strategy:[...] } */
export function buildBehaviour(ads, adsets, rules = BEHAVIOUR_RULES) {
  const R = rules;
  const hasVideoStats = ads.some(a => a.thruPct !== null || a.avgWatch !== null);
  const hasMsgStats = ads.some(a => a.msgs > 0);
  // รวมคลิปชื่อเดียวกันข้ามแคมเปญ (แต่เก็บกลุ่มที่ยิง)
  const byClip = new Map();
  for (const a of ads) {
    if (!byClip.has(a.name)) byClip.set(a.name, { name: a.name, stage: a.stage, product: a.product, rows: [], layers: new Set() });
    const c = byClip.get(a.name); c.rows.push(a); c.layers.add(a.layer);
  }
  const clips = [...byClip.values()].map(c => {
    const sp = c.rows.reduce((t, r) => t + r.spend, 0);
    const w = k => c.rows.reduce((t, r) => t + (r[k] || 0), 0);
    const vp = w('vplay'), thru = w('thru'), msgs = w('msgs'), rev = w('rev'), purch = w('purch'), imp = w('imp');
    const m = { name: c.name, stage: c.stage || 'ไม่ระบุ', product: c.product, layers: [...c.layers].sort(), spend: sp, reach: w('reach'), views: w('views'),
      thruPct: thru > 0 && vp >= 100 ? thru / vp * 100 : null, v100Pct: w('v100') > 0 && vp >= 100 ? w('v100') / vp * 100 : null,
      avgWatch: vp >= 100 && c.rows.some(r => r.avgWatch !== null) ? c.rows.reduce((t, r) => t + (r.avgWatch || 0) * (r.vplay || 0), 0) / vp : null,
      ctr: imp > 0 ? w('clicks') / imp * 100 : null, msgs, costPerMsg: msgs > 0 ? sp / msgs : null, costPerThru: thru >= 10 ? sp / thru : null,
      comments: w('comments'), shares: w('shares'), purch, noval: w('noval'), rev, roas: sp > 0 ? rev / sp : null, cpp: purch > 0 ? sp / purch : null };
    m.tags = behTags(m, R);
    m.role = (m.tags.includes('ดู') && (m.costPerThru === null || m.costPerThru <= R.thruCostOk)) ? 'ตัวเปิด/ให้ความรู้' : m.tags.includes('ซื้อ') ? 'ตัวปิด' : m.tags.includes('ทัก') ? 'ตัวเรียกแชท' : '';
    return m;
  }).filter(c => c.spend >= R.minSpend).sort((a, b) => b.spend - a.spend);
  // กลุ่มเป้าหมาย: ส่วนแรกของชื่อชุด × ชั้น
  const core = n => String(n).split('/')[0].trim();
  const byAud = new Map();
  for (const a of adsets) { const k = a.layer + '|' + core(a.name); if (!byAud.has(k)) byAud.set(k, { layer: a.layer, name: core(a.name), rows: [], camps: new Set() }); byAud.get(k).rows.push(a); byAud.get(k).camps.add(a.camp); }
  const audiences = [...byAud.values()].map(g => {
    const w = k => g.rows.reduce((t, r) => t + (r[k] || 0), 0);
    const sp = w('spend'), vp = w('vplay'), thru = w('thru'), msgs = w('msgs'), rev = w('rev'), imp = w('imp'), purch = w('purch');
    const m = { layer: g.layer, name: g.name, campaigns: g.camps.size, spend: sp, reach: w('reach'),
      thruPct: thru > 0 && vp >= 100 ? thru / vp * 100 : null, avgWatch: vp >= 100 && g.rows.some(r => r.avgWatch !== null) ? g.rows.reduce((t, r) => t + (r.avgWatch || 0) * (r.vplay || 0), 0) / vp : null,
      ctr: imp > 0 ? w('clicks') / imp * 100 : null, msgs, costPerMsg: msgs > 0 ? sp / msgs : null, purch, rev, roas: sp > 0 ? rev / sp : null };
    m.tags = behTags(m, R);
    m.read = m.tags.includes('ซื้อ') && !m.tags.includes('ดู') ? 'ไม่ดูคลิป แต่ซื้อ → ให้ข้อเสนอสั้น' : m.tags.includes('ดู') && m.tags.includes('ทัก') && !m.tags.includes('ซื้อ') ? 'ดูและทัก แต่ยังไม่ซื้อ → ป้อนต่อด้วยคลิปคลายกังวล' : m.tags.includes('ดู') && m.tags.includes('ซื้อ') ? 'ดูและซื้อ → กลุ่มที่ดีที่สุด เพิ่มงบได้' : m.tags.length === 0 ? 'ไม่ดู ไม่ทัก ไม่ซื้อ → คอนเทนต์ไม่ตรงกลุ่ม หรือกลุ่มล้า' : m.tags.join(' ');
    return m;
  }).filter(a => a.spend >= R.minSpend).sort((a, b) => b.spend - a.spend);
  // กลยุทธ์ A-D พร้อมคลิปที่แนะนำจากข้อมูล
  const pick = (f, n = 6) => clips.filter(f).sort((a, b) => b.spend - a.spend).slice(0, n).map(c => c.name);
  const openerOk = c => c.tags.includes('ดู') || (c.costPerMsg !== null && c.costPerMsg <= R.chatCost);
  const strategy = STRATEGY.map(S => ({ ...S,
    clips: S.key === 'A' ? pick(c => openerOk(c) && ['TOFU', 'อินฟู', 'MOFU', 'ไม่ระบุ', 'ภาพนิ่ง'].includes(c.stage) && c.layers.includes(1))
      : S.key === 'B' ? pick(c => c.stage === 'MOFU' || /เทียบ|คืนเงิน|ของแท้|ปลอม|หลอก|รุ่นไหน|ต่างกัน/.test(c.name))
      : S.key === 'C' ? pick(c => c.layers.includes(3) || /ไม่มีอะไรให้รอ|เฉพาะคนทัก|คำถาม/.test(c.name), 4)
      : pick(c => c.layers.includes(4) && c.roas !== null && c.roas >= R.buyRoas),
    audiencesNow: audiences.filter(a => (S.key === 'A' && a.layer === 1) || (S.key === 'B' && a.layer === 2) || (S.key === 'C' && a.layer === 3) || (S.key === 'D' && a.layer === 4)).map(a => a.name).slice(0, 5),
  }));
  return { hasVideoStats, hasMsgStats, clips, audiences, strategy, rules: R };
}

/** รวมแผน auto ของวันนี้กับรายการที่ทีมพิมพ์เอง (source 'team') และสถานะที่ทีมติ๊กไว้ */
// ---------- สรุปวันนี้ (ภาษาง่าย: คน 1,000 คน หยุดดู → ถาม → ซื้อ) ----------
export const BRIEF_RULES = { watchGood: 60, watchBad: 35, askGood: 8, askRateBad: 2, roasGood: 4, minSpend: 150, cpmHighNew: 120, cpmHighRe: 220, target: 30 };
function briefName(camp) {
  let c = String(camp || '').replace(/\s*-\s*\d{3,4}.*$/, '').replace(/\{O\}/g, '');
  const parts = c.split('/').map(x => x.trim()).filter(Boolean); if (!parts.length) return camp;
  const prod = parts[0]; let last = parts[parts.length - 1].replace(/^(VDO|VDo|รูป)\s*/, '');
  if (last.startsWith(prod)) last = last.slice(prod.length).trim();
  const mid = parts.slice(1, -1).find(x => ['หาคนใหม่', 'เพิ่มมูลค่า', 'ขาย', 'ABO'].includes(x));
  return (prod + ' · ' + last + (mid ? ` (${mid})` : '')).slice(0, 52);
}
/** ตัดสิน 1 แคมเปญ ตามลำดับ 3 คำถาม: หยุดดูไหม → ถามไหม → ซื้อไหม (ลูกค้าเก่าข้ามข้อ 1) */
export function briefJudge(r, R = BRIEF_RULES) {
  const { watch, ask, askRate, cpm, layer: L, roas, spend, purch, isStatic, isNew } = r;
  if (isNew && purch === 0 && ask < R.askGood && (L === 4 || !(watch >= R.watchGood && askRate < 1))) return { tag: 'เพิ่งเริ่มวันนี้', cls: 'wait', say: 'ยังตัดสินไม่ได้ ดูอีก 2 วัน', who: '' };
  if (L === 4) {
    if (roas !== null && roas >= R.roasGood) return { tag: 'ลูกค้าเก่า ขายได้', cls: 'good', say: 'ทำเงินอยู่ คุมไม่ให้คนเดิมเห็นเกิน 3 ครั้ง/วัน', who: 'แอด' };
    if (spend >= R.minSpend && purch === 0) return { tag: 'ลูกค้าเก่า ไม่ซื้อ', cls: 'bad', say: 'ยิงรายชื่อเดิมซ้ำกับตัวที่ขายได้ ปิดตัวนี้', who: 'แอด' };
    return { tag: 'ลูกค้าเก่า พอใช้', cls: 'ok', say: 'ดูแค่ยอด ไม่ต้องดูว่าคนดูคลิปไหม', who: 'แอด' };
  }
  if (ask >= R.askGood || (roas !== null && roas >= R.roasGood)) {
    if (L === 1 && purch === 0) return { tag: 'ดีมาก ห้ามแตะ', cls: 'good', say: 'คนถามเยอะแต่ยังไม่ซื้อ ปัญหาอยู่หลังแชท ต้องมีแอดตามคนที่ถามแล้วเงียบ', who: 'แอด' };
    return { tag: 'ดีมาก ห้ามแตะ', cls: 'good', say: 'ทำงานครบทุกข้อ เพิ่มงบได้', who: 'แอด' };
  }
  if (isStatic) {
    if (ask >= 4) return { tag: 'รูปนิ่ง ทำงานได้', cls: 'ok', say: 'คนถามพอใช้ คงงบเดิม', who: '' };
    return { tag: 'รูปนิ่ง ถามน้อย', cls: 'fix', say: 'ขอรูปใหม่ที่เห็นราคาและสินค้าชัดใน 1 วิ', who: 'คอนเทนต์' };
  }
  if (watch >= R.watchGood && askRate < R.askRateBad) return { tag: 'แก้ท้ายคลิป', cls: 'fix', say: 'คนดูนานแต่ไม่ถาม ขอเพิ่มท้ายคลิป 3 วิ: ราคา + ทักมาได้เลย', who: 'คอนเทนต์' };
  if (cpm > (L === 1 ? R.cpmHighNew : R.cpmHighRe) && watch >= R.watchGood) return { tag: 'คลิปดี แต่กลุ่มแพง', cls: 'ok', say: 'เรื่องของทีมแอด ขยายกลุ่มให้กว้างขึ้น คลิปไม่ต้องแก้', who: 'แอด' };
  if (watch < R.watchBad && spend >= R.minSpend) return { tag: 'ปิดได้', cls: 'bad', say: 'คนไม่หยุดดูและไม่ถาม ทำใหม่ถูกกว่าแก้', who: 'แอด' };
  if (watch < R.watchGood && askRate < R.askRateBad && spend >= R.minSpend) return { tag: 'ปิดได้', cls: 'bad', say: 'หยุดดูน้อย ถามน้อย ปิดแล้วเอางบไปให้ตัวที่ดี', who: 'แอด' };
  if (watch < R.watchBad) return { tag: 'แก้ 3 วิแรก', cls: 'fix', say: 'คนเลื่อนผ่าน ขอเปลี่ยนภาพเปิดและประโยคแรกอย่างเดียว', who: 'คอนเทนต์' };
  return { tag: 'พอใช้', cls: 'ok', say: 'ทำงานได้แต่ไม่เด่น คงงบเดิม', who: '' };
}
export function buildBrief(campaigns, totals, layers, date, R = BRIEF_RULES) {
  const dm = date ? `${date.slice(8, 10)}-${date.slice(5, 7)}` : '';
  const rows = campaigns.map(c => {
    const imp = c.imp || 0, thru = c.thru || 0, msgs = c.msgs || 0, purch = c.purch || 0;
    const r = {
      name: briefName(c.name), camp: c.name, layer: c.layer, product: c.product, spend: c.spend, rev: c.rev, purch, msgs, imp, roas: c.roas,
      isStatic: (c.vplay || 0) < 100 && imp > 500, isNew: !!dm && c.name.includes(dm),
      watch: imp ? thru / imp * 1000 : 0, ask: imp ? msgs / imp * 1000 : 0, buy: imp ? purch / imp * 1000 : 0,
      askRate: thru ? msgs / thru * 100 : 0, buyRate: msgs ? purch / msgs * 100 : 0, cpm: imp ? c.spend / imp * 1000 : 0,
    };
    return { ...r, ...briefJudge(r, R) };
  }).sort((a, b) => b.spend - a.spend);
  const spend = totals.spend || 0, rev = totals.rev || 0, purch = totals.purch || 0;
  const msgs = rows.reduce((t, r) => t + r.msgs, 0);
  const adpct = rev > 0 ? spend / rev * 100 : null;
  const L = {}; for (const l of layers || []) L[l.layer] = l.spend || 0;
  const keep = rows.filter(r => r.cls === 'good'), close = rows.filter(r => r.cls === 'bad'), fix = rows.filter(r => r.cls === 'fix');
  const openers = keep.filter(r => r.layer === 1 && r.ask >= R.askGood);
  const fm = v => Math.round(v).toLocaleString('en-US');
  let top;
  if (!(L[3] > 0) && msgs >= 100) top = { key: 'no-layer3', title: 'ไม่มีแอดตามคนที่ถามแล้วเงียบ', detail: `วันนี้มีคนถาม ${fm(msgs)} คน แต่ไม่มีแอดตัวไหนยิงตามคนที่ถามแล้วยังไม่ซื้อเลย เงินที่ใช้ซื้อคนถาม ${fm(L[1] || 0)} บาท จึงไม่กลายเป็นยอด`, action: 'ทีมแอด: สร้างชุด "คนทักแชท 7 วัน ยกเว้นคนซื้อ" แยกสินค้า ใช้คลิปราคาพิเศษที่มีอยู่ วันนี้เลย' };
  else if (adpct !== null && adpct > R.target) top = { key: 'adpct', title: 'ค่าแอดเกินเป้า', detail: `ค่าแอด ${adpct.toFixed(0)}% เป้าไม่เกิน ${R.target}%`, action: close.length ? `ปิด ${close.length} ตัวที่ขึ้น "ปิดได้" แล้วเอางบไปให้ตัวที่ "ห้ามแตะ"` : 'ลดงบตัวที่ "พอใช้" แล้วเพิ่มให้ตัวที่ "ห้ามแตะ"' };
  else if (fix.length) top = { key: 'fix', title: 'คลิปที่คนดูแต่ไม่ถาม', detail: `${fix.length} คลิปคนหยุดดูเยอะแต่ไม่ทัก`, action: 'บอกทีมคอนเทนต์เพิ่มราคาและคำชวนท้ายคลิป' };
  else top = { key: 'ok', title: 'วันนี้ผ่านเป้า', detail: adpct === null ? 'ยังไม่มียอด' : `ค่าแอด ${adpct.toFixed(0)}%`, action: 'ทำต่อแบบเดิม เพิ่มงบตัวที่ "ห้ามแตะ" ทีละ 20%' };
  const adTasks = [];
  if (top.key === 'no-layer3') adTasks.push({ t: 'สร้างแอดตามคนทัก', d: '"คนทักแชท 7 วัน ยกเว้นคนซื้อ" แยกสินค้า ชุดละ 400 บาท งบมาจากตัวที่ปิด' });
  if (close.length) adTasks.push({ t: `ปิด ${close.length} ตัว`, d: `ที่ขึ้นป้าย "ปิดได้" (รวม ${fm(close.reduce((t, r) => t + r.spend, 0))} บาท/วัน ได้ ${close.reduce((t, r) => t + r.purch, 0)} ออเดอร์)` });
  const expensive = rows.filter(r => r.tag === 'คลิปดี แต่กลุ่มแพง');
  if (expensive.length) adTasks.push({ t: 'ขยายกลุ่ม', d: expensive.map(r => r.name).join(' · ') + ' คลิปดีแต่ค่าแสดงแพง' });
  if (keep.length) adTasks.push({ t: 'เพิ่มงบตัวที่ "ห้ามแตะ"', d: keep.slice(0, 5).map(r => r.name).join(' · ') });
  const content = fix.slice(0, 5).map(r => ({ name: r.name, watch: r.watch, ask: r.ask, say: r.say }));
  return { date, target: R.target, kpis: { spend, rev, purch, adpct, msgs, costPerMsg: msgs ? spend / msgs : null }, top, adTasks, content, openers: openers.map(r => r.name), keep: keep.slice(0, 6), close, rows, rules: R };
}

// ---------- รายงานรายวัน (ทีมแอด) + สรุปเจ้านาย ----------
export const DAILY_RULES = { green: 25, yellow: 40, minSpend: 150, target: 30, fullUse: 95, ageMinSpend: 300 };
const r100 = x => Math.round(x / 100) * 100;
export function dailyLight(r, R = DAILY_RULES) {
  if (r.layer >= 2) return 'old';                                   // ยิงหาคนที่รู้จักเราแล้ว ตัดสินด้วยยอด ไม่ใช่บาทต่อทัก
  if (r.cp === null) return (r.spend >= R.minSpend && !r.isNew) ? 'red' : 'yellow';
  if (r.cp <= R.green) return 'green';
  if (r.cp <= R.yellow || r.isNew || r.spend < R.minSpend) return 'yellow';
  return 'red';
}
export function buildDaily(campaigns, data, totals, date, R = DAILY_RULES) {
  const dm = date ? `${date.slice(8, 10)}-${date.slice(5, 7)}` : '';
  const rows = campaigns.filter(c => c.spend > 0).map(c => {
    const msgs = c.msgs || 0, noval = c.noval || 0;
    const r = { name: briefName(c.name), camp: c.name, product: c.product, layer: c.layer, spend: c.spend, msgs, cp: msgs >= 0.5 ? c.spend / msgs : null, purch: c.purch || 0, noval, valued: (c.purch || 0) - noval,
      rev: c.rev || 0, roas: c.spend > 0 ? (c.rev || 0) / c.spend : null, bud: c.bud ?? c.budget ?? null, isNew: !!dm && c.name.includes(dm) };
    r.use = r.bud ? r.spend / r.bud * 100 : null; r.light = dailyLight(r, R); return r;
  });
  const groups = {}; for (const k of ['green', 'yellow', 'red', 'old']) groups[k] = rows.filter(r => r.light === k).sort((a, b) => k === 'old' ? (b.roas ?? 0) - (a.roas ?? 0) : (a.cp ?? 1e9) - (b.cp ?? 1e9));
  const msgs = rows.reduce((t, r) => t + r.msgs, 0), spend = totals.spend || 0, rev = totals.rev || 0, noval = totals.noval || 0;
  const kpis = { spend, rev, purch: totals.purch || 0, noval, valued: (totals.purch || 0) - noval, msgs, cp: msgs ? spend / msgs : null, adpct: rev > 0 ? spend / rev * 100 : null };
  const withBud = rows.filter(r => r.bud), full = withBud.filter(r => r.use >= R.fullUse);
  const budget = { has: withBud.length > 0, count: withBud.length, full: full.length, used: withBud.reduce((t, r) => t + r.spend, 0), set: withBud.reduce((t, r) => t + r.bud, 0) };
  const agm = new Map();
  for (const r of data) { if (!r.age || !r.gender || /unknown/i.test(r.gender)) continue; const k = r.gender + '|' + r.age; const o = agm.get(k) || { gender: r.gender, age: r.age, spend: 0, msgs: 0, rev: 0 }; o.spend += r.spend || 0; o.msgs += r.msgs || 0; o.rev += r.rev || 0; agm.set(k, o); }
  const ageGender = [...agm.values()].filter(o => o.spend >= R.ageMinSpend).map(o => ({ ...o, cp: o.msgs ? o.spend / o.msgs : null, roas: o.spend ? o.rev / o.spend : null })).sort((a, b) => b.spend - a.spend);
  const gnobuy = groups.green.filter(r => r.valued <= 0);
  const boost = rows.filter(r => r.use !== null && r.use >= R.fullUse && r.rev >= 1500 && ((r.light === 'old' && r.roas >= 4) || (r.light === 'green' && r.roas >= 3)));
  const todo = [{ t: `ห้ามปิดตัวเขียว ${groups.green.length} ตัว`, d: `มี ${gnobuy.length} ตัวที่ทักถูกแต่ยังไม่มียอดที่มีมูลค่า ปล่อยวิ่งให้ครบ 3 วัน และให้วิ่งถึง 22:00` },
    groups.red.length ? { t: `ลดงบตัวแดง ${groups.red.length} ตัว`, d: `รวม ${Math.round(groups.red.reduce((t, r) => t + r.spend, 0)).toLocaleString('en-US')} บาท/วัน ได้ยอด ${Math.round(groups.red.reduce((t, r) => t + r.rev, 0)).toLocaleString('en-US')} ลดครึ่งวันนี้ ถ้าพรุ่งนี้ยังแดงให้ปิด` } : { t: 'ไม่มีตัวแดง', d: 'ไม่ต้องปิดอะไรวันนี้' },
    boost.length ? { t: `เพิ่มงบ 20% ให้ ${boost.length} ตัวที่ขายได้และงบหมด`, d: boost.map(r => r.name).join(' · ') } : { t: 'ดึงไฟล์ Meta แยกชั่วโมง', d: 'Breakdown → ตามเวลา → ช่วงเวลาของวัน เพื่อรู้ว่างบหมดกี่โมง' }];
  const over = kpis.adpct !== null && kpis.adpct > R.target;
  const headline = (kpis.adpct === null ? 'ยังไม่มียอด' : `ค่าแอด ${kpis.adpct.toFixed(0)}% ${over ? 'เกินเป้า' : 'ผ่านเป้า'}`) + ` · คนทัก ${Math.round(msgs).toLocaleString('en-US')} คน` + (kpis.cp ? ` คนละ ${Math.round(kpis.cp)} บาท` : '') + (budget.has ? ` · งบหมด ${budget.full} ตัว` : '');
  return { date, rules: R, headline, kpis, budget, ageGender, groups, gnobuy: gnobuy.length, todo, rows };
}
/** สรุปเจ้านาย: ลงทุน 100 ได้กลับเท่าไร + ปัญหาไม่เกิน 3 เรื่องพร้อมวิธีแก้ + ผลที่คาด · actual = ยอดขายจริงที่กรอก (ถ้ามี) · prev = daily ของวันก่อน (ถ้ามี) */
export function buildBoss(daily, layers, products, actual = null, prev = null, R = DAILY_RULES, days = 1) {
  const unit = days > 1 ? 'สัปดาห์ละ' : 'วันละ';
  const K = daily.kpis, f = n => Math.round(n).toLocaleString('en-US'), ret = (rev, sp) => sp > 0 ? rev / sp * 100 : 0, need = Math.round(10000 / R.target);
  const L = k => layers.find(l => l.layer === k) || { spend: 0, rev: 0 };
  const grp = (label, ls) => { const sp = ls.reduce((t, l) => t + (l.spend || 0), 0), rv = ls.reduce((t, l) => t + (l.rev || 0), 0); return { label, spend: sp, share: K.spend ? sp / K.spend * 100 : 0, ret: ret(rv, sp), rev: rv }; };
  const groups = [grp('หาคนใหม่', [L(1)]), grp('คนที่ดูคลิป/เคยทัก', [L(2), L(3)]), grp('ลูกค้าเก่า', [L(4)])].filter(g => g.spend > 0);
  const bp = (actual && actual.byProduct) || {};
  const prods = products.filter(p => p.spend > 0 && p.spendShare >= 3).map(p => { const a = bp[p.name]; const real = a && a.rev > 0; return { label: p.name, spend: p.spend, share: p.spendShare, ret: ret(real ? a.rev : p.rev, p.spend), real }; });
  const realRev = actual && actual.rev > 0 ? actual.rev : null, factor = realRev && K.rev > 0 ? realRev / K.rev : 1;
  const adNow = realRev ? K.spend / realRev * 100 : K.adpct;
  // ---- ปัญหา
  const problems = []; let saved = 0, lostRev = 0;
  const worst = prods.filter(p => p.share >= 15 && p.ret < 200).sort((a, b) => a.ret - b.ret)[0];
  if (worst) {
    const l1 = daily.rows.filter(r => r.product === worst.label && r.layer === 1), bad = l1.filter(r => r.light === 'red' || (r.cp !== null && r.cp > R.green && !r.isNew && r.valued <= 0));
    const sp = l1.reduce((t, r) => t + r.spend, 0), rv = l1.reduce((t, r) => t + r.rev, 0), ms = l1.reduce((t, r) => t + r.msgs, 0);
    saved = bad.reduce((t, r) => t + r.spend, 0); lostRev = bad.reduce((t, r) => t + r.rev, 0); const bm = bad.reduce((t, r) => t + r.msgs, 0);
    problems.push({ title: `${worst.label} หาคนใหม่ ${l1.length} แคมเปญ ใช้ ${f(sp)} บาท ยอดขาย ${f(rv)}`, detail: `มีคนทัก ${f(ms)} คน แต่ยังไม่มีโฆษณาตามไปปิดการขาย ${worst.label} ลงทุน 100 ได้กลับแค่ ${Math.round(worst.ret)} บาท`,
      fix: bad.length ? `ปิด ${bad.length} ตัวที่คนทักแพง (ใช้ ${f(saved)} บาท ได้คนทัก ${f(bm)} คน) เก็บตัวที่ทักถูก และทำโฆษณาโปร ${worst.label} ยิงหาคนที่ทักแล้วยังไม่ซื้อ` : `คงตัวที่ทักถูกไว้ และทำโฆษณาโปร ${worst.label} ยิงหาคนที่ทักแล้วยังไม่ซื้อ`,
      result: bad.length ? `ประหยัด${unit} ${f(saved)} บาท คนทักหายแค่ ${f(bm)} จาก ${f(K.msgs)}` : 'ยอดของสินค้านี้ขึ้นโดยไม่เพิ่มงบหาคนใหม่' });
  }
  const g4 = groups.find(g => g.label === 'ลูกค้าเก่า'), g23 = groups.find(g => g.label === 'คนที่ดูคลิป/เคยทัก');
  const winners = daily.rows.filter(r => r.layer === 4 && r.roas >= 4 && r.rev >= 1500).sort((a, b) => b.roas - a.roas);
  const cut = prev ? winners.map(w => { const p = prev.rows.find(x => x.name.replace(' 🆕', '') === w.name.replace(' 🆕', '')); return p && p.bud && w.bud && w.bud <= p.bud * 0.6 ? { ...w, was: p.bud } : null; }).filter(Boolean) : [];
  if (g4 && g4.ret >= need && g4.share < 25 && winners.length) {
    const w = cut[0] || winners[0];
    problems.push({ title: cut.length ? 'ตัวทำเงินที่ดีที่สุดถูกลดงบ' : 'ลูกค้าเก่าทำเงินดีที่สุด แต่ได้งบน้อย', detail: `"${w.name}" ได้กลับ ${Math.round(w.roas * 100)} บาทต่อ 100` + (cut.length ? ` แต่งบถูกลดจาก ${f(w.was)} เหลือ ${f(w.bud)}` : '') + ` งบลูกค้าเก่ารวมแค่ ${Math.round(g4.share)}% ของทั้งหมด`,
      fix: `เพิ่มงบ ${winners.slice(0, 2).map(x => `"${x.name}"`).join(' และ ')}` + (winners.some(x => x.use >= 85) ? ' ซึ่งงบหมดทุกวันอยู่แล้ว แปลว่ายังรับเงินเพิ่มได้' : ''), result: '' });
  }
  if (K.msgs >= 100 && (!g23 || g23.share < 20)) {
    problems.push({ title: `คนทัก ${f(K.msgs)} คน แต่ใช้เงินตามคนทักแค่ ${f(g23 ? g23.spend : 0)} บาท`, detail: g23 && g23.ret >= 250 ? `โฆษณาตามคนที่ดูคลิป/เคยทัก ได้กลับ ${Math.round(g23.ret)} บาทต่อ 100 แต่ได้งบแค่ ${Math.round(g23.share)}%` : 'คนที่ทักแล้วยังไม่ซื้อ ไม่มีโฆษณาตามไปเตือน',
      fix: 'เพิ่มงบโฆษณาตามคนทัก แยกสินค้า ใช้คลิปราคาพิเศษและภาพรีวิวที่มีอยู่ ไม่ต้องทำคลิปใหม่', result: '' });
  }
  // ---- ย้ายงบ + ผลที่คาด
  let move = r100(Math.min(Math.max(saved, K.spend * 0.1), K.spend * 0.2)); if (!problems.length) move = 0;
  const r4 = Math.min(g4 ? g4.ret / 100 : 3, 4), r2 = Math.min(g23 && g23.ret > 0 ? g23.ret / 100 : 2.5, 3), half = move / 2;
  const hasOld = problems.some(p => /ลูกค้าเก่า|ตัวทำเงิน/.test(p.title)), hasChat = problems.some(p => /ตามคนทัก/.test(p.title));
  const toOld = hasOld ? (hasChat ? half : move) : 0, toChat = hasChat ? (hasOld ? half : move) : 0;
  for (const p of problems) { if (/ลูกค้าเก่า|ตัวทำเงิน/.test(p.title)) p.result = `เพิ่ม ${f(toOld)} บาท คาดยอดเพิ่มราว ${f(r100(toOld * r4))} บาท`; if (/ตามคนทัก/.test(p.title)) p.result = `เพิ่ม ${f(toChat)} บาท คาดยอดเพิ่มราว ${f(r100(toChat * r2))} บาท`; }
  const revNext = (K.rev - lostRev * Math.min(1, move && saved ? 1 : 0) + toOld * r4 + toChat * r2) * factor;
  const adNext = revNext > 0 && move ? K.spend / revNext * 100 : adNow;
  const over = adNow !== null && adNow > R.target;
  const decisions = [];
  if (move) decisions.push({ t: `อนุมัติย้ายงบวันละ ${f(r100(move / days) || Math.round(move / days))} บาท` + (days > 1 ? ` (สัปดาห์ละ ${f(move)})` : ''), d: `จากจุดที่ไม่คืนทุน` + (toOld ? ` ไปลูกค้าเก่า ${f(toOld)}` : '') + (toChat ? ` ไปโฆษณาตามคนทัก ${f(toChat)}` : '') + ` · งบรวมเท่าเดิม ${unit} ${f(r100(K.spend))} บาท` });
  if (winners.length) decisions.push({ t: 'ตั้งกฎ: ห้ามลดงบหรือปิดโฆษณาที่ได้กลับเกิน 400 บาทต่อ 100 โดยไม่แจ้ง', d: cut.length ? `กันไม่ให้เกิดแบบ "${cut[0].name}" อีก` : 'ตัวทำเงินต้องถูกปกป้องก่อน' });
  if (!realRev) decisions.push({ t: 'ให้กรอกยอดขายจริงทุกวัน', d: K.noval > 0 ? `Meta บอกว่ามี ${f(K.purch)} ออเดอร์ แต่มียอดเงินจริง ${f(K.valued)} อีก ${f(K.noval)} เป็นยอดลม ตัดสินจาก Meta อย่างเดียวไม่ได้` : 'จะได้ค่าแอดจริง ไม่ใช่ค่าประมาณจาก Meta' });
  const good = [];
  if (prev && prev.kpis.cp && K.cp && K.cp < prev.kpis.cp) good.push(`คนทักถูกลงจาก ${Math.round(prev.kpis.cp)} เหลือ ${Math.round(K.cp)} บาท`);
  for (const p of prods.filter(p => p.ret >= need).slice(0, 2)) good.push(`${p.label} ค่าแอด ${Math.round(10000 / p.ret)}% ผ่านเป้า`);
  if (g23 && g23.ret >= need) good.push('โฆษณาตามคนที่ดูคลิป/เคยทัก คืนทุนแล้ว');
  const spendUp = prev && prev.kpis.spend ? (K.spend - prev.kpis.spend) / prev.kpis.spend * 100 : null, g1 = groups[0];
  const headline = !over ? `ค่าแอด ${adNow === null ? '-' : adNow.toFixed(0)}% ผ่านเป้า ${R.target}%` : (spendUp !== null && spendUp >= 20 && g1 && g1.ret < need ? `ใช้เงินเพิ่ม ${spendUp.toFixed(0)}% แต่เงินส่วนใหญ่ไปลงที่ "หาคนใหม่"${worst ? ' กับ ' + worst.label : ''} ซึ่งยังไม่คืนทุน` : `ค่าแอด ${adNow.toFixed(0)}% เกินเป้า เพราะเงิน ${g1 ? Math.round(g1.share) : 0}% ไปอยู่กับ "หาคนใหม่" ที่ยังไม่คืนทุน`);
  const lead = over && move ? `แก้ได้โดยไม่เพิ่มงบ: ย้ายเงินวันละ ${f(r100(move / days) || Math.round(move / days))} บาท จากจุดที่ไม่คืนทุน ไปจุดที่คืนทุนอยู่แล้ว` : (over ? 'ต้องลดงบส่วนที่ไม่คืนทุน' : 'ทำต่อแบบเดิม เพิ่มงบตัวที่คืนทุนทีละ 20%');
  return { date: daily.date, target: R.target, need, headline, lead, real: !!realRev, kpis: { spend: K.spend, rev: realRev || K.rev, metaRev: K.rev, adpct: adNow, metaAdpct: K.adpct, msgs: K.msgs, cp: K.cp, valued: K.valued, noval: K.noval, orders: actual && actual.orders > 0 ? actual.orders : null, prevSpend: prev ? prev.kpis.spend : null, prevCp: prev ? prev.kpis.cp : null },
    groups, prods, problems: problems.slice(0, 3), decisions, good, expect: { now: adNow, next: adNext, move, revNow: realRev || K.rev, revNext } };
}

// ---------- สรุปรายสัปดาห์ (ไฟล์ช่วงหลายวัน) ----------
export function rangeDays(start, end) { const a = new Date(start + 'T00:00:00Z'), b = new Date((end || start) + 'T00:00:00Z'); const n = Math.round((b - a) / 86400000) + 1; return isNaN(n) || n < 1 ? 1 : n; }
/** A = ผลจาก analyze() ของไฟล์ช่วงหลายวัน · prevWeek = weekly ของสัปดาห์ก่อน (ถ้ามี) · actual = {rev, orders} ทั้งสัปดาห์ */
export function buildWeekly(A, data, prevWeek = null, actual = null) {
  const days = rangeDays(A.date, A.dateEnd), R = { ...DAILY_RULES, minSpend: DAILY_RULES.minSpend * days, ageMinSpend: DAILY_RULES.ageMinSpend * days };
  const daily = buildDaily(A.campaigns, data || [], A.totals, '', R), K = daily.kpis;
  const boss = buildBoss(daily, A.layers, A.products, actual, prevWeek ? prevWeek.daily : null, R, days);
  // แนวโน้มรายวัน (มีเมื่อไฟล์แยกคอลัมน์ "วัน")
  const dm = new Map();
  for (const r of data || []) { if (!r.day) continue; const o = dm.get(r.day) || { day: r.day, spend: 0, rev: 0, msgs: 0, purch: 0, noval: 0 }; o.spend += r.spend || 0; o.rev += r.rev || 0; o.msgs += r.msgs || 0; o.purch += r.purch || 0; o.noval += r.noval || 0; dm.set(r.day, o); }
  const trend = [...dm.values()].sort((a, b) => a.day.localeCompare(b.day)).map(o => ({ ...o, adpct: o.rev > 0 ? o.spend / o.rev * 100 : null, cp: o.msgs > 0 ? o.spend / o.msgs : null }));
  // เงินไปไหน เทียบสัดส่วนที่ควรเป็น
  const layers = [1, 2, 3, 4].map(L => { const l = A.layers.find(x => x.layer === L) || { spend: 0, rev: 0 }; const share = K.spend ? l.spend / K.spend * 100 : 0;
    return { layer: L, name: { 1: 'หาคนใหม่', 2: 'คนดูคลิป', 3: 'คนทัก', 4: 'ลูกค้าเก่า' }[L], spend: l.spend, rev: l.rev, share, plan: LAYER_BUDGET_SHARE[L], gap: share - LAYER_BUDGET_SHARE[L], ret: l.spend > 0 ? l.rev / l.spend * 100 : 0, perDay: l.spend / days, planPerDay: K.spend / days * LAYER_BUDGET_SHARE[L] / 100 }; });
  const rows = daily.rows, by = (f, n = 5) => [...rows].sort(f).slice(0, n);
  const winners = by((a, b) => b.rev - a.rev).filter(r => r.roas >= 3 && r.rev > 0);
  const burners = [...rows].filter(r => r.light !== 'green' && r.spend >= R.minSpend && (r.roas ?? 0) < 1.5).sort((a, b) => (b.spend - b.rev) - (a.spend - a.rev)).slice(0, 5);
  const openers = [...daily.groups.green].sort((a, b) => b.msgs - a.msgs).slice(0, 5);
  const realRev = actual && actual.rev > 0 ? actual.rev : null, adpct = realRev ? K.spend / realRev * 100 : K.adpct, over = adpct !== null && adpct > R.target;
  const pk = prevWeek ? prevWeek.kpis : null;
  const best = trend.length ? [...trend].filter(t => t.adpct !== null).sort((a, b) => a.adpct - b.adpct)[0] : null, worst = trend.length ? [...trend].filter(t => t.adpct !== null).sort((a, b) => b.adpct - a.adpct)[0] : null;
  const offPlan = [...layers].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap))[0];
  const headline = (adpct === null ? 'ยังไม่มียอด' : `ค่าแอดทั้งสัปดาห์ ${adpct.toFixed(0)}% ${over ? 'เกินเป้า' : 'ผ่านเป้า'} ${R.target}%`) + (offPlan && Math.abs(offPlan.gap) >= 10 ? ` · งบ "${offPlan.name}" ${offPlan.gap > 0 ? 'มากกว่า' : 'น้อยกว่า'}แผน ${Math.abs(offPlan.gap).toFixed(0)} จุด` : '');
  return { start: A.date, end: A.dateEnd, days, rules: R, headline, real: !!realRev,
    kpis: { spend: K.spend, rev: realRev || K.rev, metaRev: K.rev, adpct, metaAdpct: K.adpct, msgs: K.msgs, cp: K.cp, valued: K.valued, noval: K.noval, purch: K.purch, orders: actual && actual.orders > 0 ? actual.orders : null, spendPerDay: K.spend / days, msgsPerDay: K.msgs / days, revPerDay: (realRev || K.rev) / days },
    prev: pk ? { spend: pk.spend, rev: pk.rev, adpct: pk.adpct, cp: pk.cp, msgs: pk.msgs } : null,
    trend, bestDay: best, worstDay: worst, layers, prods: boss.prods, need: boss.need, winners, burners, openers,
    lights: { green: daily.groups.green.length, yellow: daily.groups.yellow.length, red: daily.groups.red.length, old: daily.groups.old.length },
    boss, daily: { kpis: daily.kpis, rows: daily.rows.map(r => ({ name: r.name, bud: r.bud, layer: r.layer })) } };
}

export function mergePlan(autoPlan, savedPlan) {
  if (!savedPlan || !savedPlan.layers) return { layers: autoPlan, updatedAt: null };
  const layers = autoPlan.map(al => {
    const sl = savedPlan.layers.find(x => x.layer === al.layer) || {};
    const out = { ...al };
    for (const k of ['clipsHave', 'clipsMissing', 'audiences', 'audiencesToBuild']) {
      const saved = sl[k] || [];
      const team = saved.filter(x => x.source === 'team');
      const merged = al[k].map(x => { const prev = saved.find(y => y.name === x.name); return prev ? { ...x, status: prev.status || x.status, note: prev.note } : x; });
      out[k] = [...merged, ...team.filter(t => !merged.some(m => m.name === t.name))];
    }
    if (sl.notes) out.notes = sl.notes;
    return out;
  });
  return { layers, updatedAt: savedPlan.updatedAt || null };
}

/** คำนวณตัวชี้วัดจากยอดขายจริงที่ทีมกรอก
 * actual = { rev, orders, byProduct: { [product]: { rev, orders } }, note }
 * คืน null ถ้ายังไม่กรอกยอดจริง */
export function actualMetrics(totals, products, actual) {
  if (!actual || !(actual.rev > 0)) return null;
  const spend = totals.spend, rev = actual.rev, orders = actual.orders > 0 ? actual.orders : null;
  const out = {
    rev, orders,
    roas: spend > 0 ? rev / spend : null,
    adpct: spend / rev * 100,
    cpp: orders ? spend / orders : null,
    aov: orders ? rev / orders : null,
    metaCoverage: totals.rev / rev * 100,            // Meta จับยอดได้กี่ % ของจริง
    metaGap: rev - totals.rev,                        // ยอดที่กระดานไม่เห็น
    byProduct: {},
  };
  const bp = actual.byProduct || {};
  for (const p of products || []) {
    const a = bp[p.name]; if (!a || !(a.rev > 0)) continue;
    out.byProduct[p.name] = { rev: a.rev, orders: a.orders || null, adpct: p.spend / a.rev * 100, roas: p.spend > 0 ? a.rev / p.spend : null, metaCoverage: p.rev / a.rev * 100 };
  }
  return out;
}

/** ส่วนต่างเทียบวันก่อน */
export function diffTotals(today, prev) {
  if (!prev) return null;
  const d = {};
  for (const k of ['spend', 'rev', 'purch', 'noval', 'roas', 'adpct', 'cpp']) {
    const a = today[k], b = prev[k];
    d[k] = (a === null || b === null || a === undefined || b === undefined) ? null : a - b;
  }
  d.date = prev.date;
  return d;
}

/** CSV รายแคมเปญ (UTF-8 BOM ใส่ตอนดาวน์โหลด) */
export function campaignsToCsv(campaigns, overrides = {}) {
  const H = ['แคมเปญ', 'สินค้า', 'ขั้นคลิปหลัก', 'ชั้นกรวยหลัก', 'งบ/วัน', 'ตั้งงบเมื่อ', 'ใช้จ่าย', 'เข้าถึง', 'CPM', 'CTR%', 'ออเดอร์', 'ออเดอร์ไม่มีมูลค่า', 'ยอดขาย', 'ROAS', 'ค่าแอด%', 'ต่อออเดอร์', 'กลุ่ม', 'งบเสนอ', 'เหตุผล', 'คลิปหลัก', 'ชุดโฆษณา'];
  const G = { go: 'ไปต่อ', watch: 'ดูภาพรวม', stop: 'ปิด' };
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const f = (v, d = 0) => v === null || v === undefined ? '' : Number(v).toFixed(d);
  const lines = [H.map(q).join(',')];
  for (const c of campaigns) {
    const o = overrides[c.name] || {};
    lines.push([c.name, c.product || 'ไม่ระบุ', c.stageLabel, c.layer, c.budget ?? '', c.budgetDate ?? '', f(c.spend), f(c.reach), f(c.cpm), f(c.ctr, 2), f(c.purch), f(c.noval), f(c.rev), f(c.roas, 2), f(c.adpct, 1), f(c.cpp), G[o.group || c.group], o.budgetNext ?? c.budgetNext ?? '', c.reasons.join(' · '), (c.ads[0] || {}).name || '', c.adsets.map(a => a.name).join(' | ')].map(q).join(','));
  }
  return lines.join('\r\n');
}
