// /api/image — OpenAI gpt-image-2로 삽화 생성 (키는 Vercel 환경변수 OPENAI_API_KEY)
import { kvOn, kvSet } from './_kv.js';
// 세로 1024x1536, quality: medium (요청 사양)
const DAILY_LIMIT = 25; // 이미지 장/일/IP (동화 1편 = 4장 + 재시도 여유분)
const hits = new Map();

function kstDate() {
  return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
function limited(ip) {
  const today = kstDate();
  const rec = hits.get(ip);
  if (!rec || rec.date !== today) { hits.set(ip, { date: today, count: 1 }); return false; }
  if (rec.count >= DAILY_LIMIT) return true;
  rec.count += 1; return false;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();

  const { prompt, master, recId, slot, refB64, refMime } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });
  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  if (!isOwner && limited(ip)) return res.status(429).json({ error: '오늘 그릴 수 있는 그림을 모두 그렸어요.' });

  async function gen(asJpeg, useRef) {
    const headers = { authorization: 'Bearer ' + process.env.OPENAI_API_KEY };
    let r;
    if (useRef && refB64) { // 표지를 참조 이미지로 넣어 같은 캐릭터로 그리기 (edits API)
      const fd = new FormData();
      fd.append('model', 'gpt-image-2'); fd.append('size', '1024x1536'); fd.append('quality', 'medium'); fd.append('n', '1');
      fd.append('prompt', 'Keep the exact same main character as in the reference image (same species, colors, markings, clothing, proportions), in the same illustration style. New scene: ' + prompt);
      if (asJpeg) { fd.append('output_format', 'jpeg'); fd.append('output_compression', '92'); }
      fd.append('image', new Blob([Buffer.from(refB64, 'base64')], { type: refMime || 'image/jpeg' }), 'ref.jpg');
      r = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers, body: fd });
    } else {
      const body = { model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'medium', n: 1 };
      if (asJpeg) { body.output_format = 'jpeg'; body.output_compression = 92; } // 고화질 JPEG — 해상도 동일
      r = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'OpenAI API 오류');
    return { b64: data.data[0].b64_json, mime: asJpeg ? 'image/jpeg' : 'image/png' };
  }
  try {
    let out;
    try { out = await gen(true, true); }
    catch (e) {
      if (/output_format|output_compression|unknown parameter/i.test(e.message)) out = await gen(false, true);
      else if (refB64) { console.error('ref edit failed, fallback', e.message); out = await gen(true, false); } // 참조 실패 시 일반 생성
      else throw e;
    }
    let stored = false;
    if (kvOn && recId != null && slot != null) {
      try { await kvSet('img:' + recId + ':' + slot, out.mime + '|' + out.b64); stored = true; }
      catch (e) { console.error('img save fail', e); }
    }
    // 응답 한도(4.5MB) 보호: 드물게 큰 그림은 저장소에서 조각으로 받아가게 안내
    if (out.b64.length > 3800000 && stored) return res.status(200).json({ chunked: true });
    return res.status(200).json({ b64: out.b64, mime: out.mime });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '그림을 그리는 중 문제가 생겼어요. 다시 시도해 주세요.' });
  }
}
