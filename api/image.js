// /api/image — OpenAI gpt-image-2로 삽화 생성 (키는 Vercel 환경변수 OPENAI_API_KEY)
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

  const { prompt, master } = req.body || {};
  if (!prompt) return res.status(400).json({ error: '프롬프트가 없습니다.' });
  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  if (!isOwner && limited(ip)) return res.status(429).json({ error: '오늘 그릴 수 있는 그림을 모두 그렸어요.' });

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      },
      body: JSON.stringify({
        model: 'gpt-image-2',
        prompt,
        size: '1024x1536',
        quality: 'medium',
        n: 1,
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'OpenAI API 오류');
    return res.status(200).json({ b64: data.data[0].b64_json });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '그림을 그리는 중 문제가 생겼어요. 다시 시도해 주세요.' });
  }
}
