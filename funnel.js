// funnel.js — วาดกรวยเป็น SVG (string) จากผลของ engine.js
const n0 = v => v === null || v === undefined ? '-' : Math.round(v).toLocaleString('en-US');
const n2 = v => v === null || v === undefined ? '-' : Number(v).toFixed(2);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** กรวยหลัก 4 ชั้น: layers จาก analysis.layers, list ~13,000 คือรายชื่อลูกค้าเก่าโดยประมาณ */
export function mainFunnelSvg(layers, opts = {}) {
  const L = k => layers.find(l => l.layer === k) || {};
  const l1 = L(1), l2 = L(2), l3 = L(3), l4 = L(4);
  const roasCls = (r, ok, warn) => r === null || r === undefined ? 'm' : r >= ok ? 'good' : r >= warn ? 'mid' : 'bad';
  const fill = { good: 'var(--go)', mid: 'var(--watch)', bad: 'var(--stop)', m: 'rgb(var(--muted))' };
  const R = (r, ok, warn) => `fill="${fill[roasCls(r, ok, warn)]}"`;
  const pct = v => v === null || v === undefined ? '-' : v.toFixed(0) + '%';
  return `<svg class="funnel" viewBox="0 0 440 690" role="img" aria-label="กรวย 4 ชั้น">
  <defs><marker id="fa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="rgb(var(--muted))"/></marker></defs>
  <polygon class="f1" points="8,44 432,44 388,196 52,196" stroke-width="2"/>
  <text x="220" y="76" text-anchor="middle" class="t h" font-size="17">1 ตัวเปิด · คนใหม่</text>
  <text x="220" y="99" text-anchor="middle" class="t" font-size="13">เข้าถึง ${n0(l1.reach)} คน · ใช้ ${pct(l1.spendShare)} ของงบ</text>
  <text x="220" y="118" text-anchor="middle" class="m" font-size="12">CPM ${n0(l1.cpm)} · ดูครึ่งคลิป ${l1.v50pct == null ? '-' : l1.v50pct.toFixed(1) + '%'} · ${n0(l1.purch)} ออเดอร์${l1.noval ? ` (${n0(l1.noval)} ไม่มีมูลค่า)` : ''}</text>
  <text x="220" y="158" text-anchor="middle" class="h" font-size="26" ${R(l1.roas, 3, 1.5)}>ROAS ${n2(l1.roas)}</text>
  <text x="220" y="181" text-anchor="middle" class="m" font-size="11">ชั้นนี้วัดที่ CPM และต้นทุนต่อคนดูจบ ไม่ใช่ ROAS</text>
  <line x1="220" y1="198" x2="220" y2="220" stroke="rgb(var(--muted))" stroke-width="1.5" marker-end="url(#fa)"/>
  <text x="234" y="214" class="m" font-size="11">ดูจบ 75% หรือมีส่วนร่วม → ชั้น 2</text>
  <polygon class="f2" points="52,224 388,224 344,356 96,356" stroke-width="2"/>
  <text x="220" y="256" text-anchor="middle" class="t h" font-size="17">2 ตัวกลาง · คนดูคลิปจบ</text>
  <text x="220" y="278" text-anchor="middle" class="t" font-size="13">เข้าถึง ${n0(l2.reach)} คน · ใช้ ${pct(l2.spendShare)}</text>
  <text x="220" y="296" text-anchor="middle" class="m" font-size="12">CTR ${l2.ctr == null ? '-' : l2.ctr.toFixed(2) + '%'} · ${n0(l2.purch)} ออเดอร์ · ${l2.adsets || 0} ชุด</text>
  <text x="220" y="332" text-anchor="middle" class="h" font-size="26" ${R(l2.roas, 4, 1.5)}>ROAS ${n2(l2.roas)}</text>
  <line x1="220" y1="358" x2="220" y2="380" stroke="rgb(var(--muted))" stroke-width="1.5" marker-end="url(#fa)"/>
  <text x="234" y="374" class="m" font-size="11">ทักแชท → ชั้น 3</text>
  <polygon class="f3" points="96,384 344,384 310,500 130,500" stroke-width="2"/>
  <text x="220" y="412" text-anchor="middle" class="t h" font-size="16">3 ตัวไล่ปิด · คนทักแชท</text>
  <text x="220" y="432" text-anchor="middle" class="t" font-size="12.5">เข้าถึง ${n0(l3.reach)} คน · ใช้ ${pct(l3.spendShare)}</text>
  <text x="220" y="449" text-anchor="middle" class="m" font-size="11.5">ดูคลิป ${l3.v50pct == null ? '-' : l3.v50pct.toFixed(1) + '%'} · ${n0(l3.purch)} ออเดอร์</text>
  <text x="220" y="482" text-anchor="middle" class="h" font-size="24" ${R(l3.roas, 3, 1.5)}>ROAS ${n2(l3.roas)}</text>
  <line x1="220" y1="502" x2="220" y2="536" stroke="rgb(var(--muted))" stroke-width="1.5" marker-end="url(#fa)"/>
  <text x="234" y="520" class="m" font-size="11">ซื้อ → ตัดออกทุกชั้น 30 วัน</text>
  <text x="234" y="533" class="m" font-size="11">แล้วเข้ารายชื่อลูกค้าเก่า</text>
  <rect class="f4" x="30" y="540" width="380" height="136" rx="8" stroke-width="2"/>
  <text x="220" y="570" text-anchor="middle" class="t h" font-size="17">4 ลูกค้าเก่า · ซื้อเพิ่ม ซื้อข้าม</text>
  <text x="220" y="592" text-anchor="middle" class="t" font-size="13">เข้าถึง ${n0(l4.reach)} ครั้ง · ใช้ ${pct(l4.spendShare)} ของงบ</text>
  <text x="220" y="610" text-anchor="middle" class="m" font-size="12">${n0(l4.purch)} ออเดอร์ · ทำยอด ${pct(l4.revShare)} ของวัน</text>
  <text x="220" y="646" text-anchor="middle" class="h" font-size="26" ${R(l4.roas, 6, 3)}>ROAS ${n2(l4.roas)}</text>
  <text x="220" y="666" text-anchor="middle" class="m" font-size="11">${esc(opts.l4note || '')}</text>
</svg>`;
}

/** กรวยแยกสินค้า: pf จาก analysis.productFunnels */
export function productFunnelSvg(pf) {
  const l = k => pf.layers.find(x => x.layer === k);
  const shape = [
    { pts: '6,6 294,6 262,80 38,80', y: [30, 48, 68] },
    { pts: '38,86 262,86 234,160 66,160', y: [110, 128, 148] },
    { pts: '66,166 234,166 212,240 88,240', y: [190, 208, 228] },
    null,
  ];
  const label = { 1: 'ตัวเปิด', 2: 'ตัวกลาง', 3: 'ไล่ปิด', 4: 'ลูกค้าเก่า' };
  const maxLen = { 1: 24, 2: 20, 3: 15, 4: 22 };
  const short = (s, k) => { const t = String(s).replace(/^\d+\.\d+\.\d+\s*/, '').replace(/^\d+\.\s*/, '').replace(/\((TOFU|MOFU|BOFU|9\.9\.?|ขอฟรี)\)\s*/i, '').replace(/\s*\(คลิปฟรี\)/, '').trim(); const m = maxLen[k] || 20; return t.length > m ? t.slice(0, m - 1) + '…' : t; };
  let out = `<svg class="funnel" viewBox="0 0 300 330" role="img" aria-label="กรวย ${esc(pf.product)}">`;
  for (let k = 1; k <= 4; k++) {
    const x = l(k), st = x.status, cls = `s-${st}`, cc = `c-${st}`;
    const title = x.rows === 0 ? `${k} ${label[k]}: ไม่มีชุดโฆษณา` : `${k} ${label[k]}: ${short(x.clips[0] || '', k)}${x.clips.length > 1 ? ` +${x.clips.length - 1}` : ''}`;
    const line2 = x.rows === 0 ? '' : `${n0(x.reach)} คน · ${n0(x.purch)} ออเดอร์${x.noval ? ` (${n0(x.noval)} ไม่มีมูลค่า)` : ''}`;
    const l2short = k === 3 && line2.length > 22 ? line2.replace(' ไม่มีมูลค่า', '') : line2;
    const line3 = x.rows === 0 ? '' : k === 1 && x.roas !== null && x.roas < 1 && x.noval > 0 ? `ต่อออเดอร์ ${n0(x.cpp)} บาท วัดมูลค่าไม่ได้` : `ROAS ${n2(x.roas)}`;
    if (k < 4) {
      const s = shape[k - 1];
      out += `<polygon class="${cls}" points="${s.pts}" stroke-width="1.4"/>
      <text x="150" y="${s.y[0]}" text-anchor="middle" class="t h" font-size="12.5">${esc(title)}</text>
      <text x="150" y="${s.y[1]}" text-anchor="middle" class="m" font-size="11">${esc(l2short)}</text>
      <text x="150" y="${s.y[2]}" text-anchor="middle" class="h ${cc}" font-size="13.5">${esc(line3)}</text>`;
    } else {
      out += `<rect class="${cls}" x="40" y="248" width="220" height="74" rx="6" stroke-width="1.4"/>
      <text x="150" y="272" text-anchor="middle" class="t h" font-size="12.5">${esc(title)}</text>
      <text x="150" y="290" text-anchor="middle" class="m" font-size="11">${esc(line2)}</text>
      <text x="150" y="310" text-anchor="middle" class="h ${cc}" font-size="13.5">${esc(line3)}</text>`;
    }
  }
  return out + '</svg>';
}

/** กรวย 4 ด่านแบบย่อสำหรับแผ่นสรุป PNG (4 กล่องเรียงแนวนอน) */
export function stageCardsHtml(layers, productFunnels) {
  const L = k => layers.find(l => l.layer === k) || {};
  const status = (k) => {
    const sts = productFunnels.map(p => p.layers.find(x => x.layer === k).status).filter(s => s !== 'none');
    if (!sts.length) return ['none', 'ไม่มีชุดโฆษณา'];
    if (sts.includes('gap')) return ['gap', productFunnels.filter(p => p.layers.find(x => x.layer === k).status === 'gap').map(p => p.product.split(' ')[0]).join(' · ') + ' รั่ว'];
    if (sts.includes('warn')) return ['warn', 'มีแต่ผิดรูปแบบ'];
    return ['ok', 'ทำหน้าที่ได้'];
  };
  const names = { 1: 'ตัวเปิด · คนใหม่', 2: 'ตัวกลาง · คนดูคลิปจบ', 3: 'ตัวไล่ปิด · คนทักแชท', 4: 'ลูกค้าเก่า · ซื้อเพิ่ม' };
  return [1, 2, 3, 4].map(k => {
    const l = L(k), [st, txt] = status(k);
    const clips = [...new Set(productFunnels.flatMap(p => p.layers.find(x => x.layer === k).clips))].slice(0, 3);
    return `<div class="stage s${k}"><div class="who"><span class="dot d${k}"></span>${names[k]}</div>
      <div class="size">เข้าถึง ${n0(l.reach)} คน · ใช้ ${l.spendShare == null ? '-' : l.spendShare.toFixed(0)}%</div>
      <div class="clip"><b>คลิปที่ใช้</b>${clips.map(c => `<span>${esc(c.replace(/^\d+\.\d+\.\d+\s*/, '').slice(0, 42))}</span>`).join('') || '<span>-</span>'}</div>
      <div class="res"><span class="roas num">${n2(l.roas)}</span><span class="st ${st}">${esc(txt)}</span></div></div>`;
  }).join('');
}
