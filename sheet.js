// sheet.js — สร้างแผ่นสรุป 1 หน้า (โครงเดียวกับ ../รายงาน/สรุปประชุมแอด-7กย69.html) แล้วส่งออกเป็น PNG 2 เท่า
import { stageCardsHtml } from './funnel.js';
import { shortCamp } from './engine.js';

const H2I = 'https://cdnjs.cloudflare.com/ajax/libs/html-to-image/1.11.11/html-to-image.js';
function loadScript(src) { return new Promise((ok, no) => { if (window.htmlToImage) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('โหลดตัวสร้างรูป (html-to-image) ไม่ได้ ตรวจอินเทอร์เน็ต')); document.head.appendChild(s); }); }
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n0 = v => v === null || v === undefined ? '-' : Math.round(v).toLocaleString('en-US');
const n2 = v => v === null || v === undefined ? '-' : Number(v).toFixed(2);
const thDate = iso => { if (!iso) return '-'; const [y, m, d] = iso.split('-').map(Number); const M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']; return `${d} ${M[m - 1]} ${y + 543 - 2500}`; };

const CSS = `
.sheet{width:1400px;background:#fff;color:#172033;font-family:"Anuphan",system-ui,sans-serif;font-size:15px;line-height:1.5;padding:36px 44px 32px;display:flex;flex-direction:column;gap:22px;box-sizing:border-box}
.sheet *{box-sizing:border-box}
.sheet h1,.sheet h2,.sheet h3{font-family:"Bai Jamjuree",sans-serif;font-weight:600;margin:0;line-height:1.2}
.sheet h1{font-size:30px}.sheet h2{font-size:18px}.sheet h3{font-size:15px}
.sheet p{margin:0}.sheet .num{font-variant-numeric:tabular-nums}
.sheet .eyebrow{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#5d687a;font-weight:600}
.sheet header{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;padding-bottom:16px;border-bottom:2px solid #172033}
.sheet header .title{display:flex;flex-direction:column;gap:4px}
.sheet header .one{font-size:16px;color:#5d687a;max-width:70ch}
.sheet .kpis{display:flex;gap:1px;background:#d8dee4;border:1px solid #d8dee4}
.sheet .kpis>div{background:#fff;padding:10px 18px;display:flex;flex-direction:column;min-width:130px}
.sheet .kpis .v{font-family:"Bai Jamjuree";font-size:26px;font-weight:600;line-height:1.1}
.sheet .kpis .l{font-size:12px;color:#5d687a}
.sheet .blk{display:flex;flex-direction:column;gap:10px}
.sheet .blk-head{display:flex;align-items:baseline;gap:10px}
.sheet .blk-head .n{font-family:"Bai Jamjuree";font-weight:700;font-size:13px;color:#fff;background:#172033;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center}
.sheet .blk-head .hint{font-size:13px;color:#5d687a}
.sheet .fun{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
.sheet .stage{border-radius:6px;padding:14px 16px 12px;display:flex;flex-direction:column;gap:6px;border:1px solid #d8dee4;min-height:210px}
.sheet .stage .who{font-family:"Bai Jamjuree";font-weight:600;font-size:16px;display:flex;align-items:center;gap:8px}
.sheet .stage .dot{width:12px;height:12px;border-radius:50%;display:inline-block}
.sheet .stage .size{font-size:12px;color:#5d687a}
.sheet .stage .clip{font-size:13px;display:flex;flex-direction:column;gap:2px;margin-top:2px}
.sheet .stage .clip b{font-weight:600;font-size:12px;color:#5d687a;letter-spacing:.04em;text-transform:uppercase}
.sheet .stage .res{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px dashed #d8dee4}
.sheet .stage .roas{font-family:"Bai Jamjuree";font-size:22px;font-weight:600}
.sheet .stage .st{font-size:12px;font-weight:600;padding:2px 9px;border-radius:3px}
.sheet .s1{background:#e6ebf4}.sheet .s2{background:#dcebf4}.sheet .s3{background:#fbebd5}.sheet .s4{background:#ddf2e8}
.sheet .d1{background:#7a8cb0}.sheet .d2{background:#4c89b5}.sheet .d3{background:#c2781f}.sheet .d4{background:#1b7f5a}
.sheet .ok{background:#ddf2e8;color:#1b7f5a}.sheet .warn{background:#fbeed6;color:#b8741a}.sheet .gap{background:#f8e1de;color:#b3362b}.sheet .none{background:#eef0f2;color:#5d687a}
.sheet .finding{display:grid;grid-template-columns:auto 1fr;gap:14px;align-items:center;background:#e4ecfb;border-left:4px solid #2457c5;padding:12px 16px;border-radius:0 6px 6px 0}
.sheet .finding .k{font-family:"Bai Jamjuree";font-weight:600;font-size:16px;color:#2457c5;white-space:nowrap}
.sheet .finding p{font-size:14px}
.sheet .teams{display:grid;grid-template-columns:1.1fr 1.3fr .9fr;gap:14px}
.sheet .team{border:1px solid #d8dee4;border-radius:6px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
.sheet .team h3{display:flex;align-items:center;justify-content:space-between}
.sheet .team h3 span{font-size:12px;font-weight:600;color:#5d687a;letter-spacing:.04em;text-transform:uppercase}
.sheet .team ol{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:14px}
.sheet .team ol li::marker{font-family:"Bai Jamjuree";font-weight:600;color:#2457c5}
.sheet footer{display:flex;justify-content:space-between;gap:20px;padding-top:12px;border-top:1px solid #d8dee4;font-size:12.5px;color:#5d687a}
.sheet footer b{color:#172033;font-weight:600}`;

export function sheetHtml(D, plan) {
  const T = D.totals, A = D.advice, L4 = D.layers.find(l => l.layer === 4) || {};
  const eff = c => { const o = (D.overrides || {})[c.name] || {}; return { group: o.group || c.group, budgetNext: o.budgetNext !== undefined ? o.budgetNext : c.budgetNext }; };
  const go = D.campaigns.filter(c => eff(c).group === 'go'), stop = D.campaigns.filter(c => eff(c).group === 'stop'), watch = D.campaigns.filter(c => eff(c).group === 'watch');
  const gapL2 = D.productFunnels.filter(p => p.layers[1].status === 'gap').map(p => p.product);
  const headline = (A && A.headline) || `แอดวันที่ ${thDate(D.date)}: ROAS ${n2(T.roas)} ${gapL2.length ? `แต่ชั้น 2 ของ ${gapL2.join(', ')} รั่ว` : ''}`;
  const one = (A && A.findings && A.findings[0]) ? `${A.findings[0].title} ${A.findings[0].evidence}` : `ยอด ${n0(L4.revShare)}% มาจากลูกค้าเก่า ไปต่อ ${go.length} · ดูภาพรวม ${watch.length} · ปิด ${stop.length} แคมเปญ`;
  const finding = (A && A.findings && A.findings[1]) ? `${A.findings[1].title} ${A.findings[1].evidence}` : (gapL2.length ? `ชั้น 2 (คนดูคลิปจบ) ของ ${gapL2.join(', ')} ได้แต่คลิปโปร ไม่มีคลิปคลายกังวล ย้ายคลิป MOFU ที่มีอยู่มายิงชั้นนี้ได้ทันทีโดยไม่ต้องทำใหม่` : 'ทุกชั้นทำงานได้ ดูค่าแอดต่อสินค้าและความถี่ของลูกค้าเก่า');
  const adsList = (A && A.actions && A.actions.ads && A.actions.ads.length) ? A.actions.ads : [
    ...watch.filter(c => c.budget && eff(c).budgetNext !== null && eff(c).budgetNext < c.budget).slice(0, 2).map(c => `ลดงบ ${shortCamp(c.name)} ${c.budget} → ${eff(c).budgetNext}`),
    ...(stop.length ? [`ปิด ${stop.slice(0, 4).map(c => shortCamp(c.name)).join(' · ')}`] : []),
    ...go.filter(c => c.budget && eff(c).budgetNext > c.budget).slice(0, 2).map(c => `เพิ่มงบ ${shortCamp(c.name)} ${c.budget} → ${eff(c).budgetNext}`)];
  const contentList = (A && A.actions && A.actions.content && A.actions.content.length) ? A.actions.content : plan.flatMap(p => p.clipsMissing.filter(x => x.status !== 'done').slice(0, 2).map(x => `${x.name} (ชั้น ${p.layer})`)).slice(0, 5);
  const bossList = (A && A.actions && A.actions.boss && A.actions.boss.length) ? A.actions.boss : ['อนุมัติย้ายงบจากตัวค่าแอดสูงไปตัว ROAS เกิน 6', ...(T.noval ? [`สั่งตรวจ tracking ออเดอร์ที่ไม่มีมูลค่า ${T.noval} รายการ`] : []), 'ตกลงตัววัดต่อชั้น: ชั้น 1 วัด CPM/คนดูจบ ชั้น 2-4 วัด ROAS'];
  const watchList = (A && A.watchNextMeeting && A.watchNextMeeting.length) ? A.watchNextMeeting : [`ค่าแอดรวมต่ำกว่า 18% (วันนี้ ${(T.adpct || 0).toFixed(1)}%)`, 'ความถี่รวมของลูกค้าเก่าไม่เกิน 3 ต่อวัน'];
  return `<style>${CSS}</style><div class="sheet" id="sheet">
  <header><div class="title"><span class="eyebrow">BLISSTECH · Meta Ads · สรุปประชุม</span><h1>${esc(headline)}</h1><p class="one">${esc(one)}</p></div>
    <div class="kpis"><div><span class="v num">${n0(T.spend)}</span><span class="l">ใช้จ่าย (บาท)</span></div><div><span class="v num">${n0(T.rev)}</span><span class="l">ยอดขาย (บาท)</span></div><div><span class="v num">${n2(T.roas)}</span><span class="l">ROAS · ค่าแอด ${(T.adpct || 0).toFixed(0)}%</span></div><div><span class="v num">${n0(T.purch)}</span><span class="l">ออเดอร์ · ${n0(T.noval)} ไม่มีมูลค่า</span></div></div></header>
  <div class="blk"><div class="blk-head"><span class="n">1</span><h2>คนเดินทางมาซื้อผ่าน 4 ด่าน ด่านไหนทำงาน ด่านไหนรั่ว</h2><span class="hint">ตัวเลขคือ ROAS ของด่านนั้นวันนี้</span></div>
    <div class="fun">${stageCardsHtml(D.layers, D.productFunnels)}</div>
    <div class="finding"><span class="k">สิ่งที่ต้องแก้ก่อน</span><p>${esc(finding)}</p></div></div>
  <div class="blk"><div class="blk-head"><span class="n">2</span><h2>ใครทำอะไร หลังประชุม</h2><span class="hint">เรียงตามผลกระทบ</span></div>
    <div class="teams">
      <div class="team"><h3>ทีมยิงแอด <span>ทำวันนี้</span></h3><ol>${adsList.slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('') || '<li>-</li>'}</ol></div>
      <div class="team"><h3>ทีมคอนเทนต์ <span>ทำสัปดาห์นี้</span></h3><ol>${contentList.slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('') || '<li>-</li>'}</ol></div>
      <div class="team"><h3>เจ้านายตัดสินใจ <span>ในที่ประชุม</span></h3><ol>${bossList.slice(0, 3).map(x => `<li>${esc(x)}</li>`).join('') || '<li>-</li>'}</ol></div>
    </div></div>
  <footer><span><b>ดูผลประชุมหน้า:</b> ${esc(watchList.join(' · '))}</span><span>ที่มา: Creative Reporting ${thDate(D.date)}${A && A.source === 'claude' ? ' · คำแนะนำโดย Claude' : ''}</span></footer>
</div>`;
}

/** สร้างรูปเป็น Blob PNG (ใช้ทั้งดาวน์โหลดและส่ง Telegram) */
export async function renderPngBlob(D, plan, host, pixelRatio = 2) {
  await loadScript(H2I);
  // วาดในกล่องนอกจอที่มองเห็นได้เสมอ (ไม่ใช่ display:none) เพื่อให้สร้างรูปได้จากทุกหน้า
  let stage = document.getElementById('sheetRender');
  if (!stage) { stage = document.createElement('div'); stage.id = 'sheetRender'; stage.style.cssText = 'position:fixed;left:-20000px;top:0;width:1400px;z-index:-1;pointer-events:none'; document.body.appendChild(stage); }
  stage.innerHTML = sheetHtml(D, plan);
  if (host && host !== stage) host.innerHTML = sheetHtml(D, plan);
  const node = stage.querySelector('#sheet');
  await new Promise(r => setTimeout(r, 300)); // รอฟอนต์
  const blob = await window.htmlToImage.toBlob(node, { pixelRatio, backgroundColor: '#ffffff', width: 1400, style: { margin: '0' } });
  if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
  return { blob, name: `สรุปประชุมแอด-${D.date}.png` };
}

/** สร้าง PNG แล้วดาวน์โหลด คืนชื่อไฟล์ */
export async function exportPng(D, plan, host, probe = false) {
  const { blob, name } = await renderPngBlob(D, plan, host);
  if (probe) return `${name} ${Math.round(blob.size / 1024)}KB`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return name;
}
