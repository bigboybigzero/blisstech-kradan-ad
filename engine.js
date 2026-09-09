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
};
const REQUIRED = ['camp', 'adset', 'ad', 'spend', 'purch', 'rev', 'imp', 'reach'];
const NUM = ['reach', 'imp', 'spend', 'purch', 'rev', 'clicks', 'vplay', 'v50', 'v75', 'v95', 'eng', 'result', 'freq'];

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
    { layer: 4, regex: 'คนซื้อก่อน|คนซื้อทั้งหมด' },
    { layer: 3, regex: 'คุย|INBOX 656' },
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
    for (const k of ['camp', 'adset', 'ad', 'place', 'status', 'rtype']) o[k] = str(o[k]);
    o.dateStart = dateStr(o.dateStart); o.dateEnd = dateStr(o.dateEnd);
    o.noval = (o.purch > 0 && o.rev === null) ? o.purch : 0;
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
  for (const p of settings.layerPatterns) if (rx(p.regex).test(adset)) return p.layer;
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
    noval: sum(rows, 'noval'), eng: sum(rows, 'eng'),
    roas: spend > 0 ? rev / spend : null,
    adpct: rev > 0 ? spend / rev * 100 : null,
    cpp: purch > 0 ? spend / purch : null,
    cpm: imp > 0 ? spend / imp * 1000 : null,
    ctr: imp > 0 ? clicks / imp * 100 : null,
    v50pct: imp > 0 ? v50 / imp * 100 : null,
    freq: reach > 0 ? imp / reach : null,
    rows: rows.length,
    active: rows.filter(r => r.status === 'active').length,
  };
}
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

  // แคมเปญ
  const campaigns = [...groupBy(data, r => r.camp)].map(([name, rs]) => {
    const m = metrics(rs);
    const ads = [...groupBy(rs, r => r.ad)].map(([ad, ars]) => ({ name: ad, stage: ars[0].stage, ...metrics(ars) }));
    const adsets = [...groupBy(rs, r => r.adset)].map(([as, srs]) => ({ name: as, layer: srs[0].layer, ...metrics(srs) }));
    const c = {
      name, product: rs[0].product, budget: rs[0].budget, budgetDate: rs[0].budgetDate,
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

  return { date, totals, campaigns, adsets, ads, places, layers, products, productFunnels, dupClips, dupAdsets, unresolved, plan, rowCount: data.length };
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

/** รวมแผน auto ของวันนี้กับรายการที่ทีมพิมพ์เอง (source 'team') และสถานะที่ทีมติ๊กไว้ */
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
