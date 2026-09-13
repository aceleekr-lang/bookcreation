// /api/stress-interpret.js — 결과 해석 문단만 AI로 생성 (Vercel Serverless, Node)
// 필요한 환경변수: ANTHROPIC_API_KEY  (선택: CLAUDE_MODEL)

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { mode, score, band, type, axes, picks } = req.body || {};
  if (typeof score !== 'number') return res.status(400).json({ error: 'score 누락' });

  const isKid = mode === 'kid';

  const system = `너는 한국어로 마음 상태를 짧게 읽어주는 조력자다. 다음 규칙을 반드시 지킨다.

1. 진단하지 않는다. 병명, 장애명, 임상 용어를 쓰지 않는다.
2. 사용자가 고른 색·모양·장소·소리를 결과 문장에 그대로 등장시키지 않는다.
   고른 것들은 심리적 경향을 추정하는 재료일 뿐이며, 해석은 재해석된 언어로만 표현한다.
   ("빨강을 골랐으니 열정적" 같은 직역식 해석은 절대 금지)
3. 위로만 하지 않는다. 지금 상태가 어떤 방식으로 작동하고 있는지 한 가지를 짚어준다.
4. ${isKid ? '초등학생이 읽는다. 쉬운 낱말, 짧은 문장, 다정하지만 어린애 취급하지 않는 말투.' : '성인이 읽는다. 담담하고 군더더기 없는 문장. 과장된 공감 표현을 쓰지 않는다.'}
5. 3~4문장. 줄바꿈 최대 1회. 제목·목록·따옴표·이모지 없이 문단만 출력한다.
6. 점수가 30 이상이면 마지막 문장에서 혼자 버티지 말라는 뜻을 담되, 겁주지 않는다.`;

  const user = `점수 ${score}/40 (${band}), 유형 "${type}"
내부 지표: 에너지축 ${axes?.energy}, 방향축 ${axes?.direction} (양수=밖으로, 음수=안으로)
선택 재료(출력 금지): ${Array.isArray(picks) ? picks.join(', ') : '없음'}

이 사람의 지금 상태를 읽어줘.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('anthropic error', r.status, detail.slice(0, 300));
      return res.status(502).json({ error: '해석 생성 실패' });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    if (!text) return res.status(502).json({ error: '빈 응답' });
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '서버 오류' });
  }
}
