// advice.js — ขอคำแนะนำจาก Claude จากตัวเลขที่ engine คำนวณแล้ว (Claude ไม่คำนวณเอง)
// ใช้ @anthropic-ai/sdk ผ่าน ESM CDN โหลดเมื่อต้องใช้เท่านั้น
import { shortCamp, actualMetrics } from './engine.js?v=20260909144512';

const SDK_URL = 'https://esm.sh/@anthropic-ai/sdk';
let sdkPromise = null;
async function sdk() { if (!sdkPromise) sdkPromise = import(SDK_URL).then(m => m.default || m.Anthropic || m); return sdkPromise; }
async function client(apiKey) { const Anthropic = await sdk(); return { Anthropic, c: new Anthropic({ apiKey, dangerouslyAllowBrowser: true }) }; }

// หลักการกรวยของทีม (คงที่ เพื่อให้ prompt cache ทำงาน)
const SYSTEM = `คุณเป็นที่ปรึกษาการยิงโฆษณา Meta Ads ของ BLISSTECH (สินค้าในรถ: ที่จับมือถือ D1 654 บาท, D5 797 บาท, หัวชาร์จ MINI CC/CL 494 บาท, Mag1Pro, ที่ปัดน้ำฝน) ทีมยิงแอด 1-3 คน ต้องรายงานเจ้านายและประชุมกับทีมคอนเทนต์ทุกวัน

หลักการที่ทีมยึด (อย่าเสนอสิ่งที่ขัดกับหลักนี้):
1. กรวย 4 ชั้นอ่านจากชื่อชุดโฆษณา: ชั้น 1 หว่าน/คนใหม่ (ตัวเปิด เช่น คลิปเจ๊ศรี คลิปอินฟลูเอนเซอร์) → ชั้น 2 คนดูคลิปจบ 75%/มีส่วนร่วม (ตัวกลาง ต้องได้คลิปคลายกังวล: ของแท้-ของปลอม คืนเงิน เทียบรุ่น) → ชั้น 3 คนทักแชท (ตัวไล่ปิด คนกลุ่มนี้ไม่ดูวิดีโอ ใช้การ์ดคำถามที่ถามบ่อย) → ชั้น 4 ลูกค้าเก่า (ซื้อเพิ่ม ซื้อข้าม)
2. ชั้น 1 ไม่ตัดสินด้วย ROAS แต่ด้วย CPM และต้นทุนต่อคนดูจบ คลิปที่ไม่มียอดอาจเป็นตัวเปิดสำคัญ ห้ามแนะนำปิดคลิป TOFU/MOFU/อินฟู เพราะ ROAS ต่ำ ให้ลดงบและใช้สร้างกลุ่มแทน
3. คลิปเดียวกันยิงต่างกลุ่มให้ผลต่างกันหลายเท่า เวลาคลิปไม่มียอดให้ดูกลุ่มก่อนโทษคลิป
4. ออเดอร์ที่ไม่มีมูลค่า (noval) ต้องตรวจ tracking ก่อนตัดสิน ห้ามถือว่าขายไม่ได้
5. เพิ่มงบทีละไม่เกิน 25% ต่อวัน รายชื่อลูกค้าเก่าชุดเดียวไม่ควรถูกยิงเกิน 3 แคมเปญพร้อมกัน
6. ถ้ามี actual (ยอดขายจริงจากระบบออเดอร์ที่ทีมกรอก) ให้ถือว่า actual คือความจริง ใช้ค่าแอดจริง/ROAS จริงตัดสินภาพรวมและงบ ส่วนตัวเลขจาก Meta ใช้เปรียบเทียบระหว่างแคมเปญเท่านั้น และให้ชี้ว่า Meta จับยอดได้กี่ % ของจริง
7. ตัวเลขทุกตัวมาจากไฟล์ที่ผู้ใช้ส่งมา อ้างเฉพาะตัวเลขที่ให้ ห้ามคำนวณใหม่หรือประมาณเพิ่ม ถ้าข้อมูลไม่พอให้บอกว่าไม่พอ

รูปแบบคำตอบ: ภาษาไทย ทุกข้อความไม่เกิน 2 ประโยค เรียกชื่อแคมเปญด้วยชื่อย่อที่ให้มา ระบุตัวเลขประกอบทุกข้อค้นพบ งานของแต่ละทีมต้องลงมือได้วันนี้/สัปดาห์นี้ ไม่ใช่คำแนะนำทั่วไป`;

export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['headline', 'findings', 'actions', 'contentToMake', 'audiencesToBuild', 'watchNextMeeting'],
  properties: {
    headline: { type: 'string', description: 'สรุปทั้งวันใน 1 ประโยค บอกว่ากำไรหรือไม่และปัญหาหลักคืออะไร' },
    findings: { type: 'array', minItems: 3, maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['title', 'evidence'], properties: { title: { type: 'string' }, evidence: { type: 'string', description: 'ตัวเลขจากข้อมูลที่ให้ที่พิสูจน์ข้อค้นพบนี้' } } } },
    actions: { type: 'object', additionalProperties: false, required: ['ads', 'content', 'boss'], properties: {
      ads: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'ทีมยิงแอด ทำวันนี้ ระบุแคมเปญและงบ' },
      content: { type: 'array', maxItems: 5, items: { type: 'string' }, description: 'ทีมคอนเทนต์ ทำสัปดาห์นี้ ระบุคลิปและชั้นที่ใช้' },
      boss: { type: 'array', maxItems: 3, items: { type: 'string' }, description: 'เรื่องที่เจ้านายต้องตัดสินใจในที่ประชุม' } } },
    contentToMake: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['name', 'layer', 'product', 'why'], properties: { name: { type: 'string' }, layer: { type: 'integer', minimum: 1, maximum: 4 }, product: { type: 'string' }, why: { type: 'string' } } } },
    audiencesToBuild: { type: 'array', maxItems: 5, items: { type: 'object', additionalProperties: false, required: ['name', 'layer', 'why'], properties: { name: { type: 'string' }, layer: { type: 'integer', minimum: 1, maximum: 4 }, why: { type: 'string' } } } },
    watchNextMeeting: { type: 'array', maxItems: 4, items: { type: 'string' }, description: 'ตัววัดที่จะดูในประชุมครั้งหน้า พร้อมเป้าตัวเลข' },
  },
};

const G = { go: 'ไปต่อ', watch: 'ดูภาพรวม', stop: 'ปิด' };
const r0 = v => v === null || v === undefined ? null : Math.round(v);
const r2 = v => v === null || v === undefined ? null : Math.round(v * 100) / 100;
const thDate = iso => { if (!iso) return '-'; const [y, m, d] = iso.split('-').map(Number); const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${M[m - 1]} ${y + 543 - 2500}`; };

/** ย่อข้อมูลวันนี้ให้เล็กพอส่ง (ประมาณ 4-6 พันโทเคน) */
export function buildPayload(D, prev, plan) {
  const T = D.totals, P = prev && prev.totals;
  const eff = c => { const o = (D.overrides || {})[c.name] || {}; return { group: o.group || c.group, budgetNext: o.budgetNext !== undefined ? o.budgetNext : c.budgetNext }; };
  return {
    date: D.date,
    totals: { spend: r0(T.spend), metaRev: r0(T.rev), metaRoas: r2(T.roas), metaAdpct: r2(T.adpct), metaOrders: T.purch, ordersNoValue: T.noval, cpp: r0(T.cpp), aov: r0(T.aov) },
    actual: (() => { const AM = actualMetrics(T, D.products, D.actual); return AM ? { revenue: r0(AM.rev), orders: AM.orders, roas: r2(AM.roas), adpct: r2(AM.adpct), metaCoveragePct: r0(AM.metaCoverage), byProduct: Object.fromEntries(Object.entries(AM.byProduct).map(([k, v]) => [k, { revenue: r0(v.rev), adpct: r2(v.adpct), roas: r2(v.roas) }])), note: D.actual.note || undefined } : null; })(),
    prevDay: P ? { date: prev.date, spend: r0(P.spend), rev: r0(P.rev), roas: r2(P.roas), orders: P.purch } : null,
    layers: D.layers.map(l => ({ layer: l.layer, name: l.name, spend: r0(l.spend), spendSharePct: r0(l.spendShare), reach: l.reach, cpm: r0(l.cpm), ctrPct: r2(l.ctr), orders: l.purch, ordersNoValue: l.noval, rev: r0(l.rev), revSharePct: r0(l.revShare), roas: r2(l.roas) })),
    productFunnels: D.productFunnels.map(p => ({ product: p.product, roas: r2(p.roas), adpct: r2(p.adpct), layers: p.layers.map(l => ({ layer: l.layer, status: l.status, reach: l.reach, spend: r0(l.spend), orders: l.purch, ordersNoValue: l.noval, roas: r2(l.roas), clips: l.clips.slice(0, 3), note: l.note || undefined })) })),
    campaigns: D.campaigns.map(c => ({ name: shortCamp(c.name), product: c.product, stage: c.stageLabel, layer: c.layer, mainClip: (c.ads[0] || {}).name, audience: (c.adsets[0] || {}).name, budget: c.budget, spend: r0(c.spend), orders: c.purch, ordersNoValue: c.noval, rev: r0(c.rev), roas: r2(c.roas), adpct: r2(c.adpct), cpm: r0(c.cpm), ...eff(c), ruleReasons: c.reasons })),
    sameClipDifferentAudience: D.dupClips.slice(0, 5).map(d => ({ clip: d.name, uses: d.uses.map(u => ({ campaign: shortCamp(u.camp), audience: u.adset, layer: u.layer, spend: r0(u.spend), orders: u.purch, roas: r2(u.roas) })) })),
    audienceReuse: D.dupAdsets.map(d => ({ audience: d.name, layer: d.layer, campaigns: d.campaigns.length, reach: d.reach })),
    plan: plan.map(p => ({ layer: p.layer, clipsHave: p.clipsHave.map(x => x.name).slice(0, 6), clipsMissing: p.clipsMissing.map(x => `${x.name} [${x.status || 'todo'}]`), audiencesToBuild: p.audiencesToBuild.map(x => x.name), teamNotes: p.notes || undefined })),
  };
}

function explainError(Anthropic, e) {
  if (Anthropic && e instanceof Anthropic.AuthenticationError) return 'API key ไม่ถูกต้อง หรือถูกยกเลิก (401)';
  if (Anthropic && e instanceof Anthropic.PermissionDeniedError) return 'key นี้ไม่มีสิทธิ์ใช้โมเดลนี้ (403)';
  if (Anthropic && e instanceof Anthropic.RateLimitError) return 'เรียกถี่เกินไป รอ 1 นาทีแล้วลองใหม่ (429)';
  if (Anthropic && e instanceof Anthropic.BadRequestError) return 'คำขอไม่ถูกต้อง: ' + e.message;
  if (Anthropic && e instanceof Anthropic.APIConnectionError) return 'เชื่อมต่อ api.anthropic.com ไม่ได้ ตรวจอินเทอร์เน็ต';
  if (Anthropic && e instanceof Anthropic.APIError) return `Anthropic API ตอบ ${e.status}: ${e.message}`;
  return e && e.message ? e.message : String(e);
}

/** ทดสอบ key: ดึงข้อมูลโมเดล */
export async function testKey(apiKey, model) {
  let Anthropic;
  try { ({ Anthropic } = await client(apiKey)); }
  catch (e) { throw new Error('โหลด SDK ของ Anthropic ไม่ได้ ตรวจอินเทอร์เน็ต'); }
  try { const { c } = await client(apiKey); const m = await c.models.retrieve(model); return `เชื่อมต่อได้ · ${m.display_name || m.id}`; }
  catch (e) { throw new Error(explainError(Anthropic, e)); }
}

/** ขอคำแนะนำ คืน object ตาม SCHEMA + {model, at, source:'claude'} */
export async function getAdvice(D, prev, plan, settings) {
  if (!settings.apiKey) throw new Error('ยังไม่ได้ใส่ API key ในหน้าตั้งค่า');
  let Anthropic, c;
  try { ({ Anthropic, c } = await client(settings.apiKey)); } catch (e) { throw new Error('โหลด SDK ของ Anthropic ไม่ได้ ตรวจอินเทอร์เน็ต'); }
  const payload = buildPayload(D, prev, plan);
  let res;
  try {
    res = await c.messages.create({
      model: settings.model || 'claude-opus-5',
      max_tokens: 16000,
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: `นี่คือกระดานแอดวันที่ ${D.date} ที่แอปคำนวณและจัดกลุ่มแล้ว (group = คำตัดสินตามกฎ อาจถูกพนักงานแก้) ให้เขียนคำแนะนำตามรูปแบบที่กำหนด\n\n${JSON.stringify(payload)}` }],
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    });
  } catch (e) { throw new Error(explainError(Anthropic, e)); }
  if (res.stop_reason === 'refusal') throw new Error('โมเดลปฏิเสธคำขอนี้' + (res.stop_details && res.stop_details.explanation ? ': ' + res.stop_details.explanation : ''));
  if (res.stop_reason === 'max_tokens') throw new Error('คำตอบยาวเกินกำหนด ลองใหม่อีกครั้ง');
  const text = res.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let out;
  try { out = JSON.parse(text); } catch { throw new Error('คำตอบไม่ใช่ JSON ที่อ่านได้ ลองใหม่อีกครั้ง'); }
  return { ...out, model: res.model, at: new Date().toISOString(), source: 'claude', usage: res.usage };
}

/** คำแนะนำตัวอย่าง (สร้างจากกฎ ไม่เรียก API) ใช้ทดสอบหน้าจอและส่งออก */
export function sampleAdvice(D, plan) {
  const T = D.totals, L = k => D.layers.find(l => l.layer === k) || {};
  const eff = c => ((D.overrides || {})[c.name] || {}).group || c.group;
  const go = D.campaigns.filter(c => eff(c) === 'go'), stop = D.campaigns.filter(c => eff(c) === 'stop'), watch = D.campaigns.filter(c => eff(c) === 'watch');
  const worstL2 = D.productFunnels.map(p => ({ p: p.product, l: p.layers[1] })).filter(x => x.l.status === 'gap');
  const f = v => Math.round(v || 0).toLocaleString('en-US');
  const scale = go.filter(c => c.budgetNext && c.budget && c.budgetNext > c.budget);
  const cut = watch.filter(c => c.budgetNext && c.budget && c.budgetNext < c.budget);
  return {
    source: 'sample', at: new Date().toISOString(),
    headline: `แอด ${thDate(D.date)}: ใช้ ${f(T.spend)} ได้ยอด ${f(T.rev)} ROAS ${(T.roas || 0).toFixed(2)} ${L(4).revShare > 50 ? `ยอด ${Math.round(L(4).revShare)}% มาจากลูกค้าเก่า` : ''}${worstL2.length ? ` ส่วนชั้น 2 ของ ${worstL2.map(x => x.p).join(', ')} รั่ว` : ''}`,
    findings: [
      { title: `ลูกค้าเก่า (ชั้น 4) ทำเงินหลัก`, evidence: `ใช้ ${Math.round(L(4).spendShare || 0)}% ของงบ ได้ยอด ${Math.round(L(4).revShare || 0)}% ROAS ${(L(4).roas || 0).toFixed(2)}` },
      ...(worstL2.length ? [{ title: `ชั้น 2 ของ ${worstL2[0].p} ได้แต่คลิปที่ไม่ตอบความกังวล`, evidence: `เข้าถึง ${f(worstL2[0].l.reach)} คน ROAS ${(worstL2[0].l.roas || 0).toFixed(2)} ${worstL2[0].l.note || ''}` }] : []),
      ...(T.noval ? [{ title: `มีออเดอร์ที่ไม่มีมูลค่า ${T.noval} รายการ`, evidence: `ทำให้ ROAS ของคลิปกลุ่มนั้นโชว์ 0 ต้องตรวจ tracking ก่อนปิด` }] : []),
      ...(D.dupAdsets.length ? [{ title: `รายชื่อเดียวถูกยิงหลายแคมเปญ`, evidence: `${D.dupAdsets[0].name} ใช้ใน ${D.dupAdsets[0].campaigns.length} แคมเปญ ความถี่รวมต่อคนสูง` }] : []),
    ].slice(0, 5),
    actions: {
      ads: [
        ...cut.slice(0, 2).map(c => `ลดงบ ${shortCamp(c.name)} ${c.budget} → ${c.budgetNext} (${c.reasons[0]})`),
        ...(stop.length ? [`ปิด ${stop.slice(0, 4).map(c => shortCamp(c.name)).join(', ')}${stop.length > 4 ? ` และอีก ${stop.length - 4} ตัว` : ''}`] : []),
        ...scale.slice(0, 2).map(c => `เพิ่มงบ ${shortCamp(c.name)} ${c.budget} → ${c.budgetNext} (ROAS ${(c.roas || 0).toFixed(2)})`),
      ].slice(0, 5),
      content: plan.flatMap(p => p.clipsMissing.filter(x => x.status !== 'done').slice(0, 2).map(x => `${x.name} (ชั้น ${p.layer})`)).slice(0, 5),
      boss: [`อนุมัติย้ายงบจากตัวค่าแอดสูงไปตัว ROAS เกิน 6`, ...(T.noval ? [`สั่งตรวจ tracking ออเดอร์ที่ไม่มีมูลค่า ${T.noval} รายการ`] : []), `ตกลงตัววัดต่อชั้น: ชั้น 1 วัด CPM/คนดูจบ ชั้น 2-4 วัด ROAS`].slice(0, 3),
    },
    contentToMake: plan.flatMap(p => p.clipsMissing.slice(0, 2).map(x => ({ name: x.name, layer: p.layer, product: x.product || '', why: x.why || '' }))).slice(0, 5),
    audiencesToBuild: plan.flatMap(p => p.audiencesToBuild.slice(0, 2).map(x => ({ name: x.name, layer: p.layer, why: x.why || '' }))).slice(0, 5),
    watchNextMeeting: [
      ...(worstL2.length ? [`ROAS ชั้น 2 ของ ${worstL2[0].p} ต้องเกิน 3 ภายใน 7 วันหลังย้ายคลิป`] : []),
      `ค่าแอดรวมต่ำกว่า 18% (วันนี้ ${(T.adpct || 0).toFixed(1)}%)`,
      `ความถี่รวมของลูกค้าเก่าไม่เกิน 3 ต่อวัน`,
      ...(T.noval ? [`ออเดอร์ไม่มีมูลค่าต้องลดลงหลังแก้ tracking (วันนี้ ${T.noval})`] : []),
    ].slice(0, 4),
  };
}
