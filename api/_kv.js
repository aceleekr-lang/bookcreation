// /api/_kv.js — Upstash Redis REST 헬퍼 (언더스코어 파일은 라우트로 노출되지 않음)
const U = process.env.UPSTASH_REDIS_REST_URL;
const T = process.env.UPSTASH_REDIS_REST_TOKEN;
export const kvOn = !!(U && T);

async function call(path, body) {
  const r = await fetch(U + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + T },
    body,
  });
  const d = await r.json();
  if (d.error) throw new Error(d.error);
  return d.result;
}
export const kvSet = (k, v) => call('/set/' + encodeURIComponent(k), v);
export const kvGet = (k) => call('/get/' + encodeURIComponent(k));
export const kvDel = (...ks) => call('/del/' + ks.map(encodeURIComponent).join('/'));
export const kvIncr = (k) => call('/incr/' + encodeURIComponent(k));
export const kvHset = (k, f, v) => call('/hset/' + encodeURIComponent(k) + '/' + encodeURIComponent(f), v);
export const kvHdel = (k, f) => call('/hdel/' + encodeURIComponent(k) + '/' + encodeURIComponent(f));
export const kvHgetall = (k) => call('/hgetall/' + encodeURIComponent(k));
export const kvGetrange = (k, s, e) => call('/getrange/' + encodeURIComponent(k) + '/' + s + '/' + e);
