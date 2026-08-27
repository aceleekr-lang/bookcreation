// /api/story — Claude API로 치유 동화 생성 (키는 Vercel 환경변수 ANTHROPIC_API_KEY)
const DAILY_LIMIT = 3; // 편/일/IP (필요시 숫자만 바꾸세요)
const hits = new Map(); // 인스턴스 메모리 기반 간이 제한

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
  if (limited(ip)) {
    return res.status(429).json({ error: '오늘의 이야기 문은 모두 닫혔어요. 내일 다시 열려요. (하루 ' + DAILY_LIMIT + '편)' });
  }

  const { mode, picks, analysis } = req.body || {};
  if (!mode || !picks || !analysis) return res.status(400).json({ error: '잘못된 요청입니다.' });

  const isKid = mode === 'kid';
  const sentence = isKid ? '각 장은 4~6문장, 짧고 리듬감 있는 쉬운 문장' : '각 장은 7~10문장, 문학적이고 은유가 살아있는 문장';
  const protagonistRule = isKid
    ? '주인공은 독자가 자신을 겹쳐볼 수 있는 귀엽고 사랑스러운 동물 캐릭터로 정하세요(아동은 동물 주인공에게 더 쉽게 동일시합니다).'
    : '주인공은 독자가 자신을 투사할 수 있는 인물로 하되, 이름은 부드러운 한국어 이름 또는 "그" / "그녀" / "한 사람"처럼 열어두세요.';

  const system = `당신은 독서치료(bibliotherapy) 원리에 정통한 한국어 동화 작가입니다.
독자의 심리 분석 결과를 받아, 마음을 치유하고 결핍된 욕구를 상징적으로 채워주는 3장짜리 동화를 씁니다.

[독서치료 3단계 구조 — 반드시 지킬 것]
- 1장 (동일시): 주인공이 독자의 현재 감정과 같은 상태에 놓여 있습니다. 독자가 "이건 내 이야기다"라고 느끼게 하세요.
- 2장 (전환·카타르시스): 여정이나 만남을 통해 독자의 결핍 욕구가 '상징적 사건'으로 채워지기 시작합니다.
- 3장 (통찰·회복): 따뜻한 결말. 교훈을 직접 설파하지 말고 은유와 장면으로 스며들게 하세요.

[규칙]
- ${protagonistRule}
- ${sentence}으로 쓰세요.
- 독자가 고른 장면 단어들을 이야기의 배경·소재로 자연스럽게 녹이세요.
- 무섭거나 잔인한 장면 금지. 슬픔은 다뤄도 되지만 반드시 회복으로 끝납니다.
- imagePrompt는 영어로, 각 장의 핵심 장면을 구체적으로 묘사하세요. 주인공의 외형 묘사를 모든 imagePrompt에 동일하게 반복해 그림 간 일관성을 유지하세요. 그림 속에 글자가 들어가지 않도록 "no text"를 전제하세요.
- 반드시 아래 JSON만 출력하세요. 마크다운 백틱, 설명, 인사말 금지.

{"title":"동화 제목","protagonist":"주인공 소개 한 문장","coverImagePrompt":"영어 표지 프롬프트(주인공+분위기)","scenes":[{"text":"1장 본문","imagePrompt":"영어"},{"text":"2장 본문","imagePrompt":"영어"},{"text":"3장 본문","imagePrompt":"영어"}],"closing":"독자에게 직접 건네는 다정한 말 2~3문장"}`;

  const user = `[모드] ${isKid ? '아이' : '어른'}
[독자가 고른 감정 단어] ${picks.emotions.join(', ')}
[독자가 고른 바람 단어] ${picks.desires.join(', ')}
[독자가 고른 장면 단어] ${picks.scenes.join(', ')}
[독자가 고른 감각 취향] ${analysis.senseKo || ''} → 이야기의 배경 분위기와 감각 묘사(색·형태·공간·소리)에 자연스럽게 반영하세요.
[심리 분석]
- 정서: ${analysis.moodKo}
- 결핍 욕구: ${analysis.needKo} → 이 욕구가 2장에서 상징적으로 채워져야 합니다.
- 그림 방향: ${analysis.styleKo}
이 분석에 맞는 치유 동화를 JSON으로 작성하세요.`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Anthropic API 오류');
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const story = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
    return res.status(200).json({ story });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '이야기를 짓는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
}
