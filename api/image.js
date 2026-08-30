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

  const { prompt, master, recId, slot } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });
  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  if (!isOwner && limited(ip)) return res.status(429).json({ error: '오늘 그릴 수 있는 그림을 모두 그렸어요.' });

  async function gen(asJpeg) {
    const body = { model: 'gpt-image-2', prompt, size: '1024x1536', quality: 'medium', n: 1 };
    if (asJpeg) { body.output_format = 'jpeg'; body.output_compression = 92; } // 고화질 JPEG — 해상도 동일, 인쇄 체감 차이 없음
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'OpenAI API 오류');
    return { b64: data.data[0].b64_json, mime: asJpeg ? 'image/jpeg' : 'image/png' };
  }
  try {
    let out;
    try { out = await gen(true); }
    catch (e) { // 만약의 JPEG 옵션 미지원 시 PNG 원본으로 자동 우회
      if (/output_format|output_compression|unknown parameter/i.test(e.message)) out = await gen(false);
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
