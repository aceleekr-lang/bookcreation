// /api/stress-record.js — 결과·기록 저장 / 관리자 조회
// bookcreation 프로젝트의 Upstash 환경변수를 그대로 씁니다.
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, OWNER_KEY
// 키 공간은 stress:* 로 분리되어 동화 데이터와 섞이지 않습니다.

const URL_ = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const LIST = 'stress:index';
const MAX = 2000; // 보관 건수 상한

async function redis(cmd) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd)
  });
  if (!r.ok) throw new Error('upstash ' + r.status);
  return (await r.json()).result;
}

export default async function handler(req, res) {
  if (!URL_ || !TOKEN) return res.status(500).json({ error: '저장소 설정 없음' });

  // 관리자 조회
  if (req.method === 'GET') {
    const key = req.query.master;
    const owner = process.env.STRESS_OWNER_KEY || '7009'; // 책앱의 OWNER_KEY와 별개
    if (!key || String(key) !== String(owner)) return res.status(403).json({ error: '권한 없음' });
    const raw = await redis(['LRANGE', LIST, 0, 499]);
    const items = (raw || []).map(s => { try { return JSON.parse(s) } catch { return null } }).filter(Boolean);
    return res.status(200).json({ items });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  try {
    const b = req.body || {};
    const rec = {
      kind: b.kind === 'log' ? 'log' : 'result',
      uid: String(b.uid || '').slice(0, 40),
      name: String(b.name || '').slice(0, 40),
      contact: String(b.contact || '').slice(0, 60),
      consent: !!b.consent,
      at: b.at || new Date().toISOString()
    };
    if (rec.kind === 'log') {
      rec.mood = Number(b.mood) || 0;
      rec.note = String(b.note || '').slice(0, 500);
    } else {
      rec.mode = b.mode === 'kid' ? 'kid' : 'adult';
      rec.score = Number(b.score) || 0;
      rec.type = String(b.type || '').slice(0, 20);
      rec.e = Number(b.e) || 0;
      rec.d = Number(b.d) || 0;
    }
    await redis(['LPUSH', LIST, JSON.stringify(rec)]);
    await redis(['LTRIM', LIST, 0, MAX - 1]);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '저장 실패' });
  }
}
