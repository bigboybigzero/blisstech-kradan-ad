// ปลั๊กอินตัวอย่าง: Webhook — ส่งสรุปของวันเป็น JSON ไปยัง URL ใดก็ได้
// ใช้ต่อกับ Google Apps Script (เขียนลง Google Sheet), Make.com, Zapier, n8n, LINE Messaging API ผ่านตัวกลาง ฯลฯ
// ติดตั้ง: หน้าตั้งค่า → ปลั๊กอิน → เพิ่มบรรทัด  plugins/webhook.js  → บันทึก → รีเฟรช
const ID = 'webhook';

function buildPayload(api, day) {
  const T = day.totals, AM = api.engine.actualMetrics(T, day.products, day.actual);
  const eff = c => { const o = (day.overrides || {})[c.name] || {}; return { group: o.group || c.group, budgetNext: o.budgetNext !== undefined ? o.budgetNext : c.budgetNext }; };
  return {
    source: 'BLISSTECH AdBoard', apiVersion: api.version, sentAt: new Date().toISOString(),
    date: day.date, file: day.fileName,
    totals: { spend: T.spend, metaRevenue: T.rev, metaRoas: T.roas, metaAdpct: T.adpct, orders: T.purch, ordersNoValue: T.noval },
    actual: AM ? { revenue: AM.rev, orders: AM.orders, roas: AM.roas, adpct: AM.adpct, metaCoveragePct: AM.metaCoverage } : null,
    layers: day.layers.map(l => ({ layer: l.layer, name: l.name, spend: l.spend, reach: l.reach, orders: l.purch, revenue: l.rev, roas: l.roas })),
    products: day.products.map(p => ({ name: p.name, spend: p.spend, orders: p.purch, revenue: p.rev, roas: p.roas, adpct: p.adpct })),
    campaigns: day.campaigns.map(c => ({ name: c.name, product: c.product, stage: c.stageLabel, layer: c.layer, budget: c.budget, spend: c.spend, orders: c.purch, ordersNoValue: c.noval, revenue: c.rev, roas: c.roas, adpct: c.adpct, ...eff(c), reasons: c.reasons })),
    advice: day.advice ? { headline: day.advice.headline, findings: day.advice.findings, actions: day.advice.actions, source: day.advice.source } : null,
  };
}

async function send(api, day, cfg) {
  if (!cfg.url) throw new Error('ยังไม่ได้ตั้ง URL ของ webhook ในหน้าตั้งค่า');
  const body = JSON.stringify(buildPayload(api, day));
  // ใช้ text/plain เพื่อเลี่ยง CORS preflight (Google Apps Script รับได้) ปลายทางอ่านเป็น JSON เอง
  const res = await fetch(cfg.url, { method: 'POST', headers: { 'Content-Type': cfg.json ? 'application/json' : 'text/plain;charset=utf-8', ...(cfg.secret ? { 'X-AdBoard-Secret': cfg.secret } : {}) }, body, mode: cfg.noCors ? 'no-cors' : 'cors' });
  if (cfg.noCors) return 'ส่งแล้ว (โหมด no-cors ตรวจผลไม่ได้ ดูที่ปลายทาง)';
  if (!res.ok) throw new Error(`ปลายทางตอบ ${res.status}`);
  const txt = await res.text().catch(() => '');
  return `ส่งแล้ว ปลายทางตอบ ${res.status} ${txt.slice(0, 80)}`;
}

export default function install(api) {
  const cfg = () => api.storage.get(ID, 'config', { url: '', secret: '', json: false, noCors: false, auto: false });

  api.registerSettings({
    id: ID, title: 'Webhook (ส่งข้อมูลวันไปแอปอื่น)',
    render(el) {
      const c = cfg();
      el.innerHTML = `<p class="small muted">POST JSON สรุปของวัน (ยอดรวม ยอดจริง ชั้นกรวย สินค้า รายแคมเปญ คำแนะนำ) ไปยัง URL เช่น Google Apps Script → Google Sheet, Make, Zapier, n8n</p>
        <label>URL ปลายทาง</label><input type="text" data-k="url" value="${c.url || ''}" placeholder="https://script.google.com/macros/s/.../exec">
        <label>รหัสลับ (ส่งในหัว X-AdBoard-Secret ถ้าปลายทางต้องการ เว้นว่างได้)</label><input type="text" data-k="secret" value="${c.secret || ''}" style="max-width:320px">
        <label class="row-btns" style="font-size:13.5px"><input type="checkbox" data-k="json" style="width:auto"${c.json ? ' checked' : ''}> ส่งเป็น application/json (ปลายทางต้องรองรับ CORS preflight)</label>
        <label class="row-btns" style="font-size:13.5px"><input type="checkbox" data-k="noCors" style="width:auto"${c.noCors ? ' checked' : ''}> โหมด no-cors (ส่งได้แม้ปลายทางไม่เปิด CORS แต่ตรวจผลไม่ได้)</label>
        <label class="row-btns" style="font-size:13.5px"><input type="checkbox" data-k="auto" style="width:auto"${c.auto ? ' checked' : ''}> ส่งอัตโนมัติทุกครั้งที่วิเคราะห์ไฟล์เสร็จ</label>`;
    },
    save(el) {
      const c = {}; el.querySelectorAll('[data-k]').forEach(i => { c[i.dataset.k] = i.type === 'checkbox' ? i.checked : i.value.trim(); });
      api.storage.set(ID, 'config', c);
    },
  });

  api.registerExport({
    id: ID, title: 'ส่งไป Webhook', desc: 'JSON สรุปของวันไป Google Sheet / Make / Zapier ตาม URL ในตั้งค่า', label: 'ส่งข้อมูล',
    async run(day) { return send(api, day, cfg()); },
  });

  api.on('day:loaded', async ({ date }) => {
    const c = cfg(); if (!c.auto || !c.url) return;
    try { const r = await send(api, api.getDay(date), c); api.toast('Webhook: ' + r); } catch (e) { api.toast('Webhook ไม่สำเร็จ: ' + e.message); }
  });

  return { name: 'Webhook', version: '1.0' };
}
