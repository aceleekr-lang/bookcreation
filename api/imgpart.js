// /api/imgpart — 저장된 원본 그림을 조각(3.5MB)으로 전송 (응답 한도 회피)
import { kvOn, kvGetrange } from './_kv.js';
const CHUNK = 3500000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!kvOn) return res.status(500).json({ error: '저장소가 연결되지 않았습니다.' });
  const { recId, slot, offset } = req.body || {};
  if (recId == null || slot == null) return res.status(400).json({ error: '잘못된 요청입니다.' });
  try {
    const off = parseInt(offset) || 0;
    const part = (await kvGetrange('img:' + recId + ':' + slot, off, off + CHUNK - 1)) || '';
    return res.status(200).json({ part, done: part.length < CHUNK });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '그림 조각을 불러오지 못했어요.' });
  }
}
