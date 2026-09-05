// /api/admin — 관리자 전용: 저장된 동화 목록·상세·삭제 (OWNER_KEY 인증)
import { kvOn, kvGet, kvDel, kvHgetall, kvHdel, kvLrange } from './_kv.js';
import { gateCode, gateSecondsLeft } from './_gate.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { key, action, id } = req.body || {};
  if (!process.env.OWNER_KEY || key !== process.env.OWNER_KEY) {
    return res.status(403).json({ error: '열쇠가 맞지 않습니다.' });
  }
  if (action === 'gate') { // 문의 비밀번호 + 대기 현황 (저장소 없어도 번호는 표시)
    let queue = 0, active = false;
    if (kvOn) { try { queue = ((await kvLrange('q', 0, -1)) || []).length; active = !!(await kvGet('active')); } catch (e) {} }
    return res.status(200).json({ code: gateCode(), left: gateSecondsLeft(), queue, active });
  }
  if (!kvOn) return res.status(500).json({ error: '저장소(Upstash)가 아직 연결되지 않았습니다. README의 저장소 설정을 진행해 주세요.' });

  try {
    if (action === 'list') {
      const flat = (await kvHgetall('idx')) || [];
      const items = [];
      for (let i = 0; i < flat.length; i += 2) {
        try { items.push(JSON.parse(flat[i + 1])); } catch (e) {}
      }
      items.sort((a, b) => b.ts - a.ts);
      return res.status(200).json({ items });
    }
    if (action === 'get') {
      const raw = await kvGet('rec:' + id);
      if (!raw) return res.status(404).json({ error: '기록을 찾을 수 없습니다.' });
      const rec = JSON.parse(raw);
      return res.status(200).json({ rec }); // 그림은 /api/imgpart 로 조각 전송
    }
    if (action === 'delete') {
      await kvDel('rec:' + id, 'img:' + id + ':0', 'img:' + id + ':1', 'img:' + id + ':2', 'img:' + id + ':3');
      await kvHdel('idx', id);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: '알 수 없는 요청입니다.' });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '저장소 작업 중 오류: ' + e.message });
  }
}
