// /api/story — Claude API로 치유 동화 생성 (키는 Vercel 환경변수 ANTHROPIC_API_KEY)
import { kvOn, kvGet, kvSet, kvHset, kvIncr } from './_kv.js';
// 잠금: 운영자(OWNER_KEY 일치)는 무제한, 그 외에는 평생 2편 (쿠키 + IP 메모리 기반 간이 잠금)
const LIFETIME_LIMIT = 2;
const ipLife = new Map(); // 배포/휴면 시 초기화되는 보조 장치 — 주 잠금은 쿠키

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();

  const { mode, picks, analysis, master, user } = req.body || {};
  if (!mode || !picks || !analysis) return res.status(400).json({ error: '잘못된 요청입니다.' });

  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  const ck = (req.headers.cookie || '').match(/(?:^|; )sdlc=(\d+)/);
  let redisUsed = 0;
  if (kvOn) { try { redisUsed = parseInt(await kvGet('life:' + ip)) || 0; } catch (e) {} }
  const used = Math.max(ck ? parseInt(ck[1]) : 0, ipLife.get(ip) || 0, redisUsed);
  if (!isOwner && used >= LIFETIME_LIMIT) {
    return res.status(429).json({ error: '이야기의 문은 한 사람에게 평생 두 번 열립니다. 당신의 두 이야기는 이미 지어졌어요.' });
  }

  const isKid = mode === 'kid';
  const sentence = isKid ? '각 장은 4~6문장, 짧고 리듬감 있는 쉬운 문장' : '각 장은 5~8문장, 현대 한국 문학과 어른을 위한 동화의 문장으로';
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
- ${sentence} 쓰세요.${isKid ? `
- (아이 문체 규칙) 세계적으로 사랑받는 그림책·아동문학의 작법을 따르세요:
  · 리듬과 반복: 핵심 구절이 조금씩 변주되며 두세 번 돌아오게 할 것 (아이가 따라 말하고 싶어지게)
  · 의성어·의태어를 아끼지 말 것
  · 각 장의 장면 전환이 그림 한 장처럼 선명할 것 — 세 장이 서로 다른 그림이 되도록
  · 아이 눈높이의 유머를 한 스푼 넣을 것
  · 짧은 문장, 쉬운 우리말, 살아있는 대화문
  · 감정의 곡선을 분명하게: 공감 → 두근두근 → 안도와 포근함
  · 마지막은 포근하고 안전하게 닫을 것` : `
- (어른 문체 규칙) 표현은 풍부하게, 짜임새는 긴밀하게:
  · 빛·냄새·소리·촉감 같은 구체적 감각으로 정서를 전할 것 (감정 단어로 설명하지 말 것)
  · 비유와 은유는 신선하게, 한 장에 하나쯤만 깊게 — 장식적 수사의 나열 금지
  · 모든 문장이 이야기의 인과나 정서의 흐름에 기여할 것, 군더더기 문장 금지
  · 긴 문장과 짧은 문장을 섞어 리듬을 만들 것
  · 교훈적 어조와 감상적 과잉 금지, 마지막 문장은 여운을 남길 것`}
- 변주 원칙(절대 규칙): 독자가 고른 단어·은유·기억은 단 하나도 그대로 등장시키지 마세요. 모든 선택은 심리적·인지적·미학적으로 재해석해 같은 정서와 상징을 지닌 '전혀 다른' 소재로 표현합니다. (예: 은유가 '등불을 켜 두는 사람'이면 등불 대신 '어둠 속에서 길 잃은 이의 이름을 부르는 목소리'처럼) imagePrompt에서도 동일하게 적용하세요.
- [기억의 결]이 주어지면 그 정서를 이야기의 밑색으로만 쓰고, 기억 속 상황 자체를 재현하지 마세요.
- [들이지 말 것]이 주어지면 그 요소는 어떤 형태(장면·비유·언급)로도 등장시키지 마세요. imagePrompt에서도 제외하세요.
- 무섭거나 잔인한 장면 금지. 슬픔은 다뤄도 되지만 반드시 회복으로 끝납니다.
- imagePrompt는 영어로, 수상작 그림책 수준의 장면 연출(구도, 빛, 인물의 감정과 몸짓, 시점)을 담아 구체적으로 묘사하세요. 주인공의 외형 묘사를 모든 imagePrompt에 동일하게 반복해 그림 간 일관성을 유지하세요. 그림 속에 글자가 들어가지 않도록 "no text"를 전제하세요.
- 반드시 아래 JSON만 출력하세요. 마크다운 백틱, 설명, 인사말 금지.

{"title":"동화 제목","protagonist":"주인공 소개 한 문장","coverImagePrompt":"영어 표지 프롬프트(주인공+분위기)","scenes":[{"text":"1장 본문","imagePrompt":"영어"},{"text":"2장 본문","imagePrompt":"영어"},{"text":"3장 본문","imagePrompt":"영어"}],"closing":"독자에게 직접 건네는 다정한 말 2~3문장"}`;

  const userMsg = `[모드] ${isKid ? '아이' : '어른'}
[독자가 고른 감정 단어] ${picks.emotions.join(', ')}
[독자가 고른 바람 단어] ${picks.desires.join(', ')}
[독자의 자기 은유] ${(picks.metaphors||picks.scenes||[]).join(', ')} → 주인공의 기질·성정·상징으로 녹여내되, 은유의 대상 자체는 등장시키지 마세요.
[독자가 고른 감각 취향] ${analysis.senseKo || ''} → 이야기의 배경 분위기와 감각 묘사(색·형태·공간·소리)에 자연스럽게 반영하세요.
[기억의 결] ${analysis.memoryKo || '정보 없음'}
[들이지 말 것] ${analysis.avoidKo || '없음'}
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
        messages: [{ role: 'user', content: userMsg }],
      }),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data?.error?.message || 'Anthropic API 오류');
    const text = (data.content || []).map(b => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const story = JSON.parse(clean.slice(clean.indexOf('{'), clean.lastIndexOf('}') + 1));
    // 결과물을 서버 저장소(Upstash Redis)에 보관 — 관리자 페이지에서 열람·다운로드·삭제
    let recId = null;
    if (kvOn) {
      try {
        recId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const rec = { id: recId, ts: Date.now(),
          name: (user && user.name) || '', contact: (user && user.contact) || '',
          mode: mode === 'kid' ? '아이' : '어른', title: story.title,
          analysis, story };
        await kvSet('rec:' + recId, JSON.stringify(rec));
        await kvHset('idx', recId, JSON.stringify({ id: recId, ts: rec.ts, name: rec.name,
          contact: rec.contact, mode: rec.mode, title: rec.title }));
      } catch (e) { console.error('kv save fail', e); recId = null; }
    }
    if (!isOwner) {
      ipLife.set(ip, used + 1);
      if (kvOn) { try { await kvIncr('life:' + ip); } catch (e) {} }
      res.setHeader('Set-Cookie', 'sdlc=' + (used + 1) + '; Max-Age=315360000; Path=/; SameSite=Lax');
    }
    return res.status(200).json({ story, recId });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '이야기를 짓는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
}
