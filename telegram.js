// telegram.js — ส่งรูปสรุปเข้ากลุ่ม Telegram ผ่าน Bot API โดยตรงจากเบราว์เซอร์ (api.telegram.org เปิด CORS)
const API = t => `https://api.telegram.org/bot${t}`;

function explain(json, status) {
  if (json && json.description) {
    const d = json.description;
    if (status === 401 || /Unauthorized/i.test(d)) return 'bot token ไม่ถูกต้อง (401) ตรวจจาก @BotFather';
    if (/chat not found/i.test(d)) return 'ไม่พบกลุ่ม: ตรวจ chat id หรือดึงบอทเข้ากลุ่มก่อน';
    if (/bot was kicked|bot is not a member/i.test(d)) return 'บอทไม่ได้อยู่ในกลุ่มนี้ ดึงบอทเข้ากลุ่มก่อน';
    if (/not enough rights|have no rights/i.test(d)) return 'บอทไม่มีสิทธิ์ส่งข้อความในกลุ่มนี้';
    if (status === 429) return 'ส่งถี่เกินไป รอสักครู่';
    return `Telegram ตอบ ${status}: ${d}`;
  }
  return `Telegram ตอบ ${status}`;
}

async function call(token, method, body) {
  let res;
  try { res = await fetch(`${API(token)}/${method}`, body ? { method: 'POST', body } : undefined); }
  catch { throw new Error('เชื่อมต่อ api.telegram.org ไม่ได้ ตรวจอินเทอร์เน็ต'); }
  let json = null; try { json = await res.json(); } catch {}
  if (!res.ok || !json || !json.ok) throw new Error(explain(json, res.status));
  return json.result;
}

/** ตรวจ token: คืนชื่อบอท */
export async function getMe(token) {
  const me = await call(token.trim(), 'getMe');
  return `@${me.username}`;
}

/** หากลุ่มที่บอทเห็น (ต้องมีคนพิมพ์ในกลุ่มหลังดึงบอทเข้าแล้ว) คืน [{id, title, type}] */
export async function findChats(token) {
  const updates = await call(token.trim(), 'getUpdates?limit=100');
  const seen = new Map();
  for (const u of updates) {
    const m = u.message || u.channel_post || u.my_chat_member || u.edited_message;
    const c = m && m.chat; if (!c) continue;
    seen.set(c.id, { id: c.id, title: c.title || [c.first_name, c.last_name].filter(Boolean).join(' ') || String(c.id), type: c.type });
  }
  return [...seen.values()];
}

/** ส่งรูป (Blob PNG) พร้อมข้อความ คืน message id */
export async function sendPhoto(token, chatId, blob, caption, fileName = 'summary.png') {
  const fd = new FormData();
  fd.append('chat_id', String(chatId).trim());
  fd.append('photo', blob, fileName);
  if (caption) fd.append('caption', caption.slice(0, 1000));
  const r = await call(token.trim(), 'sendPhoto', fd);
  return r.message_id;
}

/** ส่งไฟล์เอกสาร (เช่น PNG เต็มความละเอียด หรือ CSV) */
export async function sendDocument(token, chatId, blob, fileName, caption) {
  const fd = new FormData();
  fd.append('chat_id', String(chatId).trim());
  fd.append('document', blob, fileName);
  if (caption) fd.append('caption', caption.slice(0, 1000));
  const r = await call(token.trim(), 'sendDocument', fd);
  return r.message_id;
}
