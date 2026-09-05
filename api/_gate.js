// /api/_gate.js — 3분마다 바뀌는 5자리 '문의 비밀번호' (OWNER_KEY 기반, 서버에서만 계산)
import { createHmac } from 'crypto';
const PERIOD = 180; // 초

function secret() { return process.env.GATE_SECRET || process.env.OWNER_KEY || 'story-door'; }
export function gateCode(offset = 0) {
  const w = Math.floor(Date.now() / 1000 / PERIOD) + offset;
  const h = createHmac('sha256', secret()).update(String(w)).digest();
  return String(h.readUInt32BE(0) % 100000).padStart(5, '0');
}
export function gateSecondsLeft() { return PERIOD - (Math.floor(Date.now() / 1000) % PERIOD); }
// 현재 번호 또는 직전 번호(방금 바뀐 직후의 입력 유예)
export function gateValid(code) { const c = String(code || '').trim(); return c === gateCode(0) || c === gateCode(-1); }
