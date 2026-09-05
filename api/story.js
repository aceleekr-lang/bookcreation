// /api/story — Claude API로 치유 동화 생성 (키는 Vercel 환경변수 ANTHROPIC_API_KEY)
import { kvOn, kvGet, kvSet, kvHset, kvIncr, kvExpire } from './_kv.js';
// 참여 통제는 문의 비밀번호 + 순번 대기열(/api/queue)이 담당합니다 (횟수 잠금 없음)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();

  const { mode, picks, analysis, master, user, ticket, edit, draft, layout } = req.body || {};
  const print46 = layout === 'print46'; // 4×6 인화 버전: 글 분량 제한
  if (!mode || !picks || !analysis) return res.status(400).json({ error: '잘못된 요청입니다.' });

  const isOwner = !!process.env.OWNER_KEY && master === process.env.OWNER_KEY;
  if (!isOwner && kvOn) { // 대기열에서 차례를 받은 사람만 생성 가능 (한 번에 한 사람)
    const act = await kvGet('active');
    if (!ticket || act !== ticket) return res.status(409).json({ error: '아직 차례가 아니에요. 순번 안내 화면에서 기다려 주세요.' });
  }


  const isKid = mode === 'kid';
  // 주인공 동물 다양화: 매번 무작위 후보 3종 추첨 (AI가 '토끼'로 수렴하는 것 방지)
  const ANIMALS = ['다람쥐','고슴도치','수달', '펭귄','부엉이','너구리','사슴','두더지','거북이','문어','고래','물범',
    '반딧불이','제비','까치','오소리','족제비','산양','올빼미','개구리','달팽이','북극여우','판다','알파카',
    '두루미','청설모','도롱뇽','바다표범','돌고래','오리너구리'];
  const pick3 = [...ANIMALS].sort(() => Math.random() - .5).slice(0, 3);
  // 어른 모드 다양화: 이름·살아가는 자리·이야기의 씨앗(사물)을 매번 추첨
  const NAMES = ['도영','하람','시온','재이','문주','선우','예솔','태오','윤슬','가온','해준','서월','다원','은호','채운','솔뫼','정우','미르','노을','산들'];
  const LIVES = ['새벽 첫차를 모는 버스 기사','피아노 조율사','수선집을 지키는 사람','시장 골목의 국숫집 주인','필름 현상소의 마지막 직원',
    '간판 글씨를 그리는 사람','요양원의 밤 당직자','산속 기상관측소 근무자','폐업 정리를 돕는 사람','악기 수리공',
    '새벽 빵 반죽을 시작하는 제빵사','오래된 극장의 영사기사','철길 건널목 관리원','종이를 뜨는 한지 장인','이삿짐을 싸 주는 사람',
    '등산로 입구 매점 주인','시계 수리공','야간 응급실 접수 담당','도자기 가마를 지키는 사람','섬을 도는 이동 도서관 운전사'],
    SEEDS = ['한쪽 바퀴가 굽은 자전거','반쯤 감다 만 털실 뭉치','태엽이 풀린 오르골','금이 갔지만 버리지 못한 찻잔','철 지난 달력',
    '단추 한 개가 다른 외투','소리가 나지 않는 호루라기','물때가 앉은 주전자','한 짝만 남은 장갑','더 이상 나오지 않는 필름 카메라',
    '녹이 슨 열쇠 꾸러미','바람 빠진 축구공','귀퉁이가 닳은 목침','줄이 늘어난 손목시계','씨앗이 담긴 유리병',
    '반으로 접힌 버스표','틀어진 문짝','다 쓴 성냥갑','한 번도 펴지 않은 우산','목이 쉰 풍경(風磬)'];
  // 2장 전환 사건 다양화: '갈림길 선택' 클리셰로의 수렴 방지
  const TURNS = ['뜻밖의 작은 존재가 먼저 다가온다','누군가에게 뜻밖의 부탁을 받아 제 쓸모를 발견한다','고장 난 것을 다른 이와 함께 고치게 된다',
    '갑작스러운 비바람을 낯선 이와 함께 피하게 된다','낯선 이에게 길을 알려주다가 제 길을 발견한다','오래 미뤄 두었던 것을 마침내 마주한다',
    '똑같이 반복되던 하루에 딱 한 가지가 달라져 있다','작은 생명(씨앗·불씨·새끼)을 맡아 돌보게 된다','장날 또는 잔치 준비를 얼떨결에 거들게 된다',
    '소중했던 것을 스스로 놓아 보낸다','처음으로 제 목소리를 내어 본다(노래하거나, 이름을 말하거나)','길을 잃었는데 헤매던 그 자리가 바로 도착할 곳이었음을 안다',
    '하룻밤 불침번을 서며 어둠과 나란히 앉아 본다','자기 것 하나를 남의 것 하나와 맞바꾼다','오래된 약속 하나를 지키러 나선다',
    '누군가가 남긴 흔적(발자국·콧노래·온기)을 따라간다'];
  const pickTurns = [...TURNS].sort(() => Math.random() - .5).slice(0, 3);
  const pickNames = [...NAMES].sort(() => Math.random() - .5).slice(0, 3);
  const pickLives = [...LIVES].sort(() => Math.random() - .5).slice(0, 3);
  const pickSeeds = [...SEEDS].sort(() => Math.random() - .5).slice(0, 3);
  const sentence = isKid ? '각 장은 4~6문장, 짧고 리듬감 있는 쉬운 문장' : '각 장은 5~8문장, 현대 한국 문학과 어른을 위한 동화의 문장으로';
  const protagonistRule = isKid
    ? `주인공은 독자가 자신을 겹쳐볼 수 있는 귀엽고 사랑스러운 동물 캐릭터로 정하세요(아동은 동물 주인공에게 더 쉽게 동일시합니다). 오늘의 동물 후보는 [${pick3.join(', ')}]입니다 — 독자의 자기 은유가 지닌 기질과 가장 어울리는 하나를 고르거나, 그 기질에 더 꼭 맞는 다른 동물이 있으면 그것으로 하세요. 단, 토끼·고양이·강아지·곰처럼 동화에서 아주 흔한 동물은 후보에 없으면 피하세요.`
    : `주인공은 독자가 자신을 투사할 수 있는 인물로 하세요.
  · 이름: [${pickNames.join(', ')}] 중 하나를 쓰거나, 끝까지 이름 없이 "그"/"그녀"로 두세요 (지안·서연처럼 소설에 흔한 이름 금지)
  · 살아가는 자리: [${pickLives.join(' / ')}] 중 독자의 자기 은유 기질에 가장 어울리는 하나 — 또는 그 기질에 더 꼭 맞는 다른 자리
  · 이야기의 씨앗: [${pickSeeds.join(' / ')}] 중 하나의 사물을 골라 이야기의 구체적 매개로 삼으세요. 사물을 반복해서 들이밀지 말고, 결정적인 순간에만 조용히 놓으세요
  · 별·등대·바다·정원·편지·찻집처럼 치유 동화에서 상투적인 소재는 중심에 두지 마세요.`;

  const system = `당신은 독서치료(bibliotherapy) 원리에 정통한 한국어 동화 작가입니다.
독자의 심리 분석 결과를 받아, 마음을 치유하고 결핍된 욕구를 상징적으로 채워주는 3장짜리 동화를 씁니다.

[독서치료 3단계 구조 — 반드시 지킬 것]
- 1장 (동일시): 주인공이 독자의 현재 감정과 같은 상태에 놓여 있습니다. 독자가 "이건 내 이야기다"라고 느끼게 하세요.
- 2장 (전환·카타르시스): 독자의 결핍 욕구가 '상징적 사건'으로 채워지기 시작합니다. 전환 사건은 다음 후보 중 결핍 욕구와 가장 어울리는 하나를 골라(또는 그 결을 살려 변주해) 쓰세요: [${pickTurns.join(' / ')}]
- 금지되는 클리셰: 갈림길·두 갈래 길·두 개의 문 같은 양자택일 선택 구조, "모두 꿈이었다"는 결말, 마지막에 교훈을 요약해 주는 화자.
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
- 무섭거나 잔인한 장면 금지. 슬픔은 다뤄도 되지만 반드시 회복으로 끝납니다.${print46 ? `
- (인화 버전) 각 장의 본문은 ${isKid ? '200자' : '360자'} 이내로, 맺음말은 90자 이내로 쓰세요 — 4×6 인화지 한 장에 담겨야 합니다.` : ''}
- characterSheet: 주인공의 외형을 영어로 아주 구체적으로 고정하세요 (종/나이 인상, 몸 색과 무늬, 눈, 옷·소품, 특징 두세 가지). 이 설정표가 네 장의 그림 전체에 그대로 쓰입니다.
- imagePrompt는 영어로, 수상작 그림책 수준의 장면 연출(구도, 빛, 인물의 감정과 몸짓, 시점)만 묘사하세요. 외형은 characterSheet가 따로 붙으니 반복하지 말고 장면에 집중하세요. 그림 속에 글자가 들어가지 않도록 "no text"를 전제하세요.
- 네 장의 그림은 서로 확연히 달라야 합니다: coverImagePrompt는 주인공의 '상징적 초상'(정면 또는 반측면, 상반신 중심, 상징 소품 하나, 배경은 단순하고 분위기 위주)으로 하고, 세 장면은 각각 다른 장소·시간대·시점(예: 1장 원경 부감, 2장 눈높이 클로즈업, 3장 로우앵글)으로 구성하세요. 특히 1장 장면은 표지와 다른 장소·구도여야 합니다.
- 반드시 아래 JSON만 출력하세요. 마크다운 백틱, 설명, 인사말 금지.

{"title":"동화 제목","protagonist":"주인공 소개 한 문장","characterSheet":"영어 외형 설정표","coverImagePrompt":"영어 표지 프롬프트(장면·분위기)","scenes":[{"text":"1장 본문","imagePrompt":"영어"},{"text":"2장 본문","imagePrompt":"영어"},{"text":"3장 본문","imagePrompt":"영어"}],"closing":"독자에게 직접 건네는 다정한 말 2~3문장"}`;

  const userMsg = `[모드] ${isKid ? '아이' : '어른'}
[독자가 고른 감정 단어] ${picks.emotions.join(', ')}
[독자가 고른 바람 단어] ${picks.desires.join(', ')}
[독자의 자기 은유] ${(picks.metaphors||picks.scenes||[]).join(', ')} → 주인공의 기질·성정·상징으로 녹여내되, 은유의 대상 자체는 등장시키지 마세요.
[독자가 고른 감각 취향] ${analysis.senseKo || ''} → 이야기의 배경 분위기와 감각 묘사(색·형태·공간·소리)에 자연스럽게 반영하세요.
[숨은 신호] ${analysis.implicitKo || '없음'} → 이야기에 직접 언급하지 말고, 인물의 결과 사건의 온도를 정할 때만 참고하세요.
[기억의 결] ${analysis.memoryKo || '정보 없음'}
[들이지 말 것] ${analysis.avoidKo || '없음'}
[심리 분석]
- 정서: ${analysis.moodKo}
- 결핍 욕구: ${analysis.needKo} → 이 욕구가 2장에서 상징적으로 채워져야 합니다.
- 그림 방향: ${analysis.styleKo}
이 분석에 맞는 치유 동화를 JSON으로 작성하세요.`;

  // 편집자 퇴고 — 성공 시 퇴고본, 실패 시 null
  async function editPass(story) {
    try {
      const editSystem = `당신은 엄격하고 따뜻한 문학 편집자입니다. 아래 동화 초고를 같은 JSON 구조로 퇴고해 돌려주세요. 반드시 JSON만 출력하세요.
[점검 항목]
1. 독자가 고른 단어·은유·기억이 그대로 등장하면 전혀 다른 소재로 바꿀 것 (재해석 원칙)
2. 갈림길·두 개의 문 선택, "모두 꿈이었다", 교훈을 요약하는 화자 — 있으면 걷어낼 것
3. ${isKid
  ? '아이 문체: 짧은 문장, 살아있는 대화, 의성어·의태어, 변주되며 돌아오는 핵심 구절, 유머 한 스푼. 어려운 낱말은 쉬운 말로'
  : '어른 문체: 감정 단어로 설명한 문장은 감각과 행동으로 바꿀 것, 장식적 수사 나열은 하나만 남기고 덜어낼 것, 흐름에 기여하지 않는 문장 삭제, 긴 문장과 짧은 문장의 리듬, 마지막 문장은 여운으로'}
4. 3장 구조(동일시→전환→회복)가 살아 있는지, 결핍 욕구가 2장에서 상징적으로 채워지는지
5. 상투적 표현·같은 표현의 반복·번역투 제거. 제목이 진부하면 더 나은 제목으로
6. characterSheet와 imagePrompt는 영어로 유지하고, 장면 묘사가 본문과 어긋나면 맞출 것
좋은 초고는 과하게 손대지 말고, 분량은 초고와 비슷하게 유지하세요.`;
      const r2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 3000, system: editSystem,
          messages: [{ role: 'user', content: '[독자가 고른 것들]\n' + userMsg + '\n\n[초고 JSON]\n' + JSON.stringify(story) }] }),
      });
      const d2 = await r2.json();
      if (!r2.ok) return null;
      const t2 = (d2.content || []).map(b => b.text || '').join('').replace(/```json|```/g, '').trim();
      const s2 = JSON.parse(t2.slice(t2.indexOf('{'), t2.lastIndexOf('}') + 1));
      return (s2 && s2.title && Array.isArray(s2.scenes) && s2.scenes.length === 3) ? s2 : null;
    } catch (e) { console.error('edit pass fail', e); return null; }
  }
  // 최종본 저장 (Upstash) — recId 반환
  async function saveRecord(story) {
    let recId = null, seq = null;
    if (kvOn) {
      try {
        // 하루 순번 (한국시간 자정 리셋) — 인화 파일명·보관함 대조용
        const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
        seq = await kvIncr('seq:' + day); await kvExpire('seq:' + day, 172800);
        recId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const rec = { id: recId, ts: Date.now(), seq,
          name: (user && user.name) || '', contact: (user && user.contact) || '',
          mode: mode === 'kid' ? '아이' : '어른', title: story.title, analysis, story };
        await kvSet('rec:' + recId, JSON.stringify(rec));
        await kvHset('idx', recId, JSON.stringify({ id: recId, ts: rec.ts, seq, name: rec.name,
          contact: rec.contact, mode: rec.mode, title: rec.title }));
      } catch (e) { console.error('kv save fail', e); recId = null; }
    }
    return { recId, seq };
  }

  // 퇴고만 다시 요청된 경우 (초고는 있고 퇴고가 실패했던 경우)
  if (edit && draft) {
    const edited = await editPass(draft);
    if (!edited) return res.status(502).json({ error: '퇴고 단계에서 다시 멈췄어요. 계속하기를 눌러 한 번 더 시도해 주세요.' });
    const { recId, seq } = await saveRecord(edited);
    return res.status(200).json({ story: edited, edited: true, recId, seq });
  }

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
    const edited = await editPass(story);
    if (!edited) return res.status(200).json({ story, edited: false, recId: null }); // 클라이언트가 '계속하기'로 퇴고 재요청
    const { recId, seq } = await saveRecord(edited);
    return res.status(200).json({ story: edited, edited: true, recId, seq });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: '이야기를 짓는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' });
  }
}
