// /api/queue — 문의 비밀번호 확인 + 한 번에 한 사람씩 진행하는 대기열
import { kvOn, kvGet, kvDel, kvSet, kvSetNX, kvExpire, kvRpush, kvLrange, kvLrem, kvPipeline } from './_kv.js';
import { gateValid } from './_gate.js';
const ACTIVE_TTL = 90; // 진행자가 30초마다 ping — 끊기면 90초 뒤 자동 해제
const WAIT_TTL = 40;   // 대기자가 4초마다 상태 확인 — 떠나면 40초 뒤 대기열에서 제거

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const { action, code, ticket, master } = req.body || {};
  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  try {
    if (action === 'join') {
      if (isOwner) return res.status(200).json({ ticket: 'master', active: true });
      if (!gateValid(code)) return res.status(403).json({ error: '문의 비밀번호가 맞지 않아요. 진행자에게 지금 번호를 확인해 주세요.' });
      if (!kvOn) return res.status(200).json({ ticket: 'nokv', active: true });
      const t = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      await kvSet('w:' + t, '1'); await kvExpire('w:' + t, WAIT_TTL);
      await kvRpush('q', t);
      return res.status(200).json({ ticket: t });
    }
    if (!kvOn || ticket === 'master' || ticket === 'nokv') return res.status(200).json({ active: true, ok: true });
    if (action === 'status') {
      await kvSet('w:' + ticket, '1'); await kvExpire('w:' + ticket, WAIT_TTL);
      const active = await kvGet('active');
      if (active === ticket) return res.status(200).json({ active: true });
      let list = (await kvLrange('q', 0, -1)) || [];
      if (list.length) { // 떠난 대기자 정리
        const ex = await kvPipeline(list.map(x => ['EXISTS', 'w:' + x]));
        for (let i = 0; i < list.length; i++) if (!ex[i]) await kvLrem('q', list[i]);
        list = list.filter((x, i) => ex[i]);
      }
      let pos = list.indexOf(ticket);
      if (pos < 0) { await kvRpush('q', ticket); pos = list.length; }
      if (pos === 0 && !active) {
        const ok = await kvSetNX('active', ticket, ACTIVE_TTL);
        if (ok) { await kvLrem('q', ticket); return res.status(200).json({ active: true }); }
      }
      return res.status(200).json({ active: false, ahead: pos + (active ? 1 : 0) });
    }
    if (action === 'ping') {
      if ((await kvGet('active')) === ticket) await kvExpire('active', ACTIVE_TTL);
      return res.status(200).json({ ok: true });
    }
    if (action === 'done') {
      if ((await kvGet('active')) === ticket) await kvDel('active');
      await kvLrem('q', ticket);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ error: '알 수 없는 요청입니다.' });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '대기열 처리 중 문제가 생겼어요.' });
  }
}
