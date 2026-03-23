/* ===================================================
   논쟁 심판 - app.js (localStorage 버전)
   =================================================== */

// ===== SVG 캐릭터 시스템 =====

/**
 * 이름을 해시해서 캐릭터 색상 결정
 * @param {string} name
 * @returns {{ hair: string, outfit: string, skin: string }}
 */
function nameToColors(name) {
  let hash = 0;
  for (let c of name) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const hairColors = ['#2D1B00','#8B4513','#FFD700','#1C1C1C','#E8A0BF','#C0392B','#2980B9'];
  const outfitColors = ['#6C63FF','#FF6B6B','#45B7D1','#06D6A0','#FFD166','#E67E22','#E91E63'];
  const skinTones = ['#FDBCB4','#EAA87A','#C68642','#8D5524'];
  const h = Math.abs(hash);
  return {
    hair: hairColors[h % hairColors.length],
    outfit: outfitColors[(h >> 3) % outfitColors.length],
    skin: skinTones[(h >> 6) % skinTones.length],
  };
}

/**
 * SVG 캐릭터 문자열 생성
 * @param {string} name - 캐릭터 이름 (색상 결정에 사용)
 * @param {'male'|'female'} gender - 성별
 * @param {'idle'|'win'|'lose'|'draw'} state - 상태
 * @returns {string} SVG HTML 문자열
 */
function buildCharacterSVG(name, gender, state) {
  const colors = nameToColors(name || 'A');
  const outfit = colors.outfit.replace('#', '');

  // 성별에 따라 seed 분리 → 다른 랜덤 특성이 선택됨
  // open-peeps: 손·발 포함 full-body 일러스트 스타일
  const seed = gender === 'female'
    ? encodeURIComponent((name || 'A') + '_여F')
    : encodeURIComponent((name || 'A') + '_남M');

  // 여성: 긴 머리 계열로 제한 / 남성: 짧은 머리 계열로 제한
  const hairOptions = gender === 'female'
    ? 'hair[]=long&hair[]=bun&hair[]=curly'
    : 'hair[]=short01&hair[]=short02&hair[]=shaved';

  const url = `https://api.dicebear.com/9.x/open-peeps/svg?seed=${seed}&${hairOptions}&clothingColor[]=${outfit}`;

  const overlay = state === 'win'  ? `<div class="char-overlay win-overlay">🎉</div>`
                : state === 'lose' ? `<div class="char-overlay lose-overlay">😭</div>`
                : state === 'draw' ? `<div class="char-overlay draw-overlay">🤝</div>`
                : '';

  // data-dicebear-src 저장 → inlineDiceBearSVGs()가 나중에 img를 inline SVG로 교체
  return `<div class="dicebear-wrap" data-dicebear-src="${url}">
    <img src="${url}" alt="${name}" class="dicebear-img" loading="lazy"/>
    ${overlay}
  </div>`;
}

/**
 * container 안의 .dicebear-wrap[data-dicebear-src] 요소들을
 * 실제 inline SVG로 교체 → 투명 배경이 되어 캐릭터만 애니메이션됨
 */
async function inlineDiceBearSVGs(container) {
  const wraps = container.querySelectorAll('.dicebear-wrap[data-dicebear-src]');
  await Promise.all([...wraps].map(async (wrap) => {
    const url = wrap.dataset.dicebearSrc;
    try {
      const res = await fetch(url);
      const text = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'image/svg+xml');
      const svg = doc.querySelector('svg');
      if (!svg) return;
      // 배경 rect 투명화 → 캐릭터만 보임
      const bgRect = svg.querySelector('rect');
      if (bgRect) bgRect.setAttribute('fill', 'transparent');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.classList.add('dicebear-svg');
      const img = wrap.querySelector('.dicebear-img');
      if (img) wrap.replaceChild(svg, img);
      wrap.removeAttribute('data-dicebear-src');
    } catch (_) { /* img 폴백 유지 */ }
  }));
}

/**
 * 헥스 색상을 밝게/어둡게 조절
 * @param {string} hex - #RRGGBB 형식
 * @param {number} amount - 양수면 밝게, 음수면 어둡게
 * @returns {string}
 */
function shadeColor(hex, amount) {
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  r = Math.max(0, Math.min(255, r + amount));
  g = Math.max(0, Math.min(255, g + amount));
  b = Math.max(0, Math.min(255, b + amount));
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * 캐릭터 프리뷰 업데이트 (이름 입력 실시간 반영)
 */
function updateCharacterPreviews() {
  const nameA = dom.nameA.value.trim() || 'A';
  const nameB = dom.nameB.value.trim() || 'B';
  const isCouple = state.relationType === 'couple';
  const genderA = 'male';
  const genderB = isCouple ? 'female' : 'male';

  const previewA = document.getElementById('charPreviewA');
  const previewB = document.getElementById('charPreviewB');

  function updatePreview(el, name, gender) {
    if (!el) return;
    const old = el.querySelector('.dicebear-wrap');
    const label = el.querySelector('.char-name-label');
    const tmp = document.createElement('div');
    tmp.innerHTML = buildCharacterSVG(name, gender, 'idle');
    if (old) el.replaceChild(tmp.firstElementChild, old);
    else el.insertBefore(tmp.firstElementChild, label);
    if (label) label.textContent = name.length > 6 ? name.slice(0, 6) + '…' : name;
    inlineDiceBearSVGs(el); // 비동기 — img → inline SVG 교체
  }

  updatePreview(previewA, nameA, genderA);
  updatePreview(previewB, nameB, genderB);
}

// ===== 심각도 설정 =====
const SEVERITY_INFO = {
  1: { emoji: '😂', label: '드립', badge: '😂 드립' },
  2: { emoji: '😏', label: '장난', badge: '😏 장난' },
  3: { emoji: '🤔', label: '애매', badge: '🤔 애매' },
  4: { emoji: '😤', label: '진지', badge: '😤 진지' },
  5: { emoji: '🔥', label: '격한', badge: '🔥 격한' },
};

// ===== localStorage 헬퍼 =====
function getVerdicts() {
  return JSON.parse(localStorage.getItem('verdicts') || '[]');
}

function saveVerdicts(verdicts) {
  localStorage.setItem('verdicts', JSON.stringify(verdicts));
}

function addVerdict(verdict) {
  const verdicts = getVerdicts();
  verdicts.unshift(verdict); // 최신 판정을 맨 앞에
  saveVerdicts(verdicts);
  return verdict.id;
}

function updateHeart(id) {
  const verdicts = getVerdicts();
  const idx = verdicts.findIndex((v) => v.id === id);
  if (idx !== -1) {
    verdicts[idx].hearts = (verdicts[idx].hearts || 0) + 1;
    saveVerdicts(verdicts);
    return verdicts[idx].hearts;
  }
  return null;
}

function getSortedVerdicts() {
  const verdicts = getVerdicts();
  return verdicts.sort((a, b) => (b.hearts || 0) - (a.hearts || 0));
}

// ===== 앱 상태 =====
const state = {
  relationType: 'couple',
  severity: 3,
  likedIds: new Set(JSON.parse(localStorage.getItem('likedIds') || '[]')),
  activeTag: '전체',
  activeRelation: '전체',
};

// ===== DOM 참조 =====
const dom = {
  relationBtns: document.querySelectorAll('.relation-btn'),
  severitySlider: document.getElementById('severitySlider'),
  severityBadgePreview: document.getElementById('severityBadgePreview'),
  nameA: document.getElementById('nameA'),
  argumentA: document.getElementById('argumentA'),
  nameB: document.getElementById('nameB'),
  argumentB: document.getElementById('argumentB'),
  submitBtn: document.getElementById('submitBtn'),
  errorMsg: document.getElementById('errorMsg'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  resultSection: document.getElementById('resultSection'),
  situation: document.getElementById('situation'),
  feedList: document.getElementById('feedList'),
  tagFilterBar: document.getElementById('tagFilterBar'),
  toast: document.getElementById('toast'),
};

// ===== 관계 유형 토글 =====
dom.relationBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    dom.relationBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    state.relationType = btn.dataset.value;
    updateCharacterPreviews();
  });
});

// ===== 심각도 슬라이더 =====
dom.severitySlider.addEventListener('input', () => {
  state.severity = parseInt(dom.severitySlider.value, 10);
  updateSeverityUI();
});

function updateSeverityUI() {
  const info = SEVERITY_INFO[state.severity];
  dom.severityBadgePreview.textContent = info.badge;
}

updateSeverityUI();

// ===== 캐릭터 프리뷰 이벤트 =====
dom.nameA.addEventListener('input', updateCharacterPreviews);
dom.nameB.addEventListener('input', updateCharacterPreviews);

// 초기 프리뷰 렌더링 (DOM 준비 후)
setTimeout(updateCharacterPreviews, 0);

// ===== 폼 제출 =====
dom.submitBtn.addEventListener('click', handleSubmit);

async function handleSubmit() {
  clearError();

  const situation = dom.situation.value.trim();
  const nameA = dom.nameA.value.trim();
  const argumentA = dom.argumentA.value.trim();
  const nameB = dom.nameB.value.trim();
  const argumentB = dom.argumentB.value.trim();

  if (!situation) {
    showError('상황을 먼저 입력해주세요!');
    return;
  }
  if (!nameA || !argumentA || !nameB || !argumentB) {
    showError('이름과 주장을 모두 입력해주세요!');
    return;
  }


  showLoading(true);
  dom.submitBtn.disabled = true;

  try {
    const verdict = await requestVerdict({
      situation, nameA, argumentA, nameB, argumentB,
      relationType: state.relationType,
      severity: state.severity,
    });

    // localStorage에 저장
    const newVerdict = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      situation,
      person_a: nameA,
      person_b: nameB,
      argument_a: argumentA,
      argument_b: argumentB,
      relation_type: state.relationType,
      severity: state.severity,
      severity_badge: SEVERITY_INFO[state.severity].badge,
      hearts: 0,
      ...verdict,
    };
    addVerdict(newVerdict);

    // 결과 카드 렌더링
    dom.resultSection.innerHTML = '';
    renderVerdictCard(newVerdict, dom.resultSection, false);

    // 피드 새로고침
    loadFeed();

    dom.resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showToast('⚖️ 판정이 완료됐습니다!');
  } catch (e) {
    showError('판정 중 오류가 발생했습니다: ' + e.message);
  } finally {
    showLoading(false);
    dom.submitBtn.disabled = false;
  }
}

// ===== OpenRouter API 호출 =====
async function requestVerdict({ situation, nameA, argumentA, nameB, argumentB, relationType, severity }) {
  const systemPrompt = buildSystemPrompt(severity, relationType);
  const userPrompt = buildUserPrompt(situation, nameA, argumentA, nameB, argumentB, relationType, severity);

  const schema = {
    type: 'object',
    properties: {
      case_title:        { type: 'string', description: '논쟁 제목 (재밌게)' },
      winner:            { type: 'string', enum: ['A', 'B', '무승부'] },
      score_a:           { type: 'number', description: '0~100 사이 점수' },
      score_b:           { type: 'number', description: '0~100 사이 점수' },
      judge_comment:     { type: 'string', description: '판사 한마디 (심각도 반영)' },
      verdict_reason:    { type: 'string', description: '판결 이유 2-3문장' },
      tag:               { type: 'string', description: '#음식 같은 해시태그' },
      reconciliation_tip:{ type: 'string', description: '화해 미션 또는 팁' },
    },
    required: ['case_title','winner','score_a','score_b','judge_comment','verdict_reason','tag','reconciliation_tip'],
    additionalProperties: false,
  };

  const response = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'verdict', strict: true, schema },
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API 오류 (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('API 응답이 비어있습니다.');
  return JSON.parse(content);
}

function buildSystemPrompt(severity, relationType) {
  const toneMap = {
    1: '당신은 세상에서 가장 개그 넘치는 판사입니다. 판결을 최대한 웃기고 과장되게 내리세요. 말장난, 드립, 유머를 최대한 활용하세요.',
    2: '당신은 유머 감각이 넘치는 친근한 판사입니다. 가볍고 재미있게, 하지만 어느 정도는 납득이 가는 판결을 내리세요.',
    3: '당신은 균형 잡힌 판사입니다. 유머와 진지함을 적절히 섞어서 공정하게 판결을 내리세요.',
    4: '당신은 꼼꼼하고 논리적인 판사입니다. 양쪽의 주장을 면밀히 분석하고 합리적인 근거로 판결을 내리세요.',
    5: '당신은 매우 엄격하고 논리적인 AI 판사입니다. 양쪽 주장을 냉정하게 분석하고 논리적 근거에 따라 판결을 내리세요.',
  };
  const relationDesc = relationType === 'couple' ? '커플(연인) 사이의 논쟁' : '친구 사이의 논쟁';
  return `${toneMap[severity]}\n\n이 논쟁은 ${relationDesc}입니다. 관계 특성에 맞게 판결 톤을 조절하세요. 모든 응답은 반드시 한국어로 작성하세요.`;
}

function buildUserPrompt(situation, nameA, argumentA, nameB, argumentB, relationType, severity) {
  const relationLabel = relationType === 'couple' ? '커플' : '친구';
  const severityLabel = SEVERITY_INFO[severity].badge;
  return `다음 ${relationLabel} 논쟁을 심판해주세요. (심각도: ${severityLabel})

[상황]
${situation}

[A측 - ${nameA}의 주장]
${argumentA}

[B측 - ${nameB}의 주장]
${argumentB}

위 논쟁에 대해 판결을 내려주세요. score_a와 score_b의 합이 반드시 100이 되도록 해주세요.`;
}

// ===== 판정 카드 렌더링 =====
function renderVerdictCard(data, container, prepend = false) {
  const winnerClass =
    data.winner === 'A' ? 'winner-a' : data.winner === 'B' ? 'winner-b' : 'winner-draw';
  const winnerBannerClass =
    data.winner === 'A' ? 'side-a' : data.winner === 'B' ? 'side-b' : 'draw';
  const winnerText =
    data.winner === 'A' ? `🏆 ${escapeHtml(data.person_a)} 승!`
    : data.winner === 'B' ? `🏆 ${escapeHtml(data.person_b)} 승!`
    : '🤝 무승부!';

  const scoreA = Math.max(0, Math.min(100, data.score_a || 0));
  const scoreB = Math.max(0, Math.min(100, data.score_b || 0));
  const relationIcon = data.relation_type === 'couple' ? '💑 커플' : '👫 친구';
  const severityBadge = data.severity_badge || SEVERITY_INFO[data.severity || 3].badge;
  const isLiked = data.id && state.likedIds.has(data.id);

  // 캐릭터 배틀 섹션 구성
  const isCouple = data.relation_type === 'couple';
  const genderA = 'male';
  const genderB = isCouple ? 'female' : 'male';
  const stateA = data.winner === 'A' ? 'win' : data.winner === '무승부' ? 'draw' : 'lose';
  const stateB = data.winner === 'B' ? 'win' : data.winner === '무승부' ? 'draw' : 'lose';
  const charClassA = stateA === 'win' ? 'char-win' : stateA === 'lose' ? 'char-lose' : 'char-draw';
  const charClassB = stateB === 'win' ? 'char-win' : stateB === 'lose' ? 'char-lose' : 'char-draw';
  const svgA = buildCharacterSVG(data.person_a || 'A', genderA, stateA);
  const svgB = buildCharacterSVG(data.person_b || 'B', genderB, stateB);

  const characterBattle = `
    <div class="character-battle">
      <div class="battle-char char-a ${charClassA}">
        ${svgA}
        <div class="battle-name">${escapeHtml(data.person_a)}</div>
      </div>
      <div class="battle-vs">⚖️</div>
      <div class="battle-char char-b ${charClassB}">
        ${svgB}
        <div class="battle-name">${escapeHtml(data.person_b)}</div>
      </div>
    </div>`;

  const card = document.createElement('div');
  card.className = `card verdict-card ${winnerClass}`;
  if (data.id) card.dataset.id = data.id;

  card.innerHTML = `
    ${characterBattle}
    <div class="verdict-header">
      <div class="verdict-badges">
        <span class="badge badge-tag">${escapeHtml(data.tag || '#논쟁')}</span>
        <span class="badge badge-severity">${escapeHtml(severityBadge)}</span>
        <span class="badge badge-relation">${relationIcon}</span>
      </div>
    </div>

    <div class="verdict-title">${escapeHtml(data.case_title || '제목 없음')}</div>

    <div class="scores-section">
      <div class="scores-label">점수</div>
      <div class="score-row">
        <span class="score-name side-a">${escapeHtml(data.person_a)}</span>
        <div class="score-bar-wrap">
          <div class="score-bar side-a" style="width: 0%;" data-target="${scoreA}"></div>
        </div>
        <span class="score-num">${scoreA}</span>
      </div>
      <div class="score-row">
        <span class="score-name side-b">${escapeHtml(data.person_b)}</span>
        <div class="score-bar-wrap">
          <div class="score-bar side-b" style="width: 0%;" data-target="${scoreB}"></div>
        </div>
        <span class="score-num">${scoreB}</span>
      </div>
    </div>

    <div class="winner-banner ${winnerBannerClass}">${winnerText}</div>

    <div class="judge-comment-box">"${escapeHtml(data.judge_comment || '')}"</div>

    <div class="verdict-reason-box">
      <div class="box-title">판결 이유</div>
      <p>${escapeHtml(data.verdict_reason || '')}</p>
    </div>

    <div class="reconciliation-box">
      <span class="rec-icon">💌</span>
      <p>${escapeHtml(data.reconciliation_tip || '')}</p>
    </div>

    <div class="heart-section">
      <button class="heart-btn ${isLiked ? 'liked' : ''}" aria-label="하트">
        <span class="heart-icon">${isLiked ? '❤️' : '🤍'}</span>
        <span class="heart-count">${data.hearts || 0}</span>
      </button>
      <button class="action-btn share-btn" aria-label="판결문 복사">📋 복사</button>
      <button class="action-btn retrial-btn" aria-label="재심 요청">😤 억울해요</button>
      <button class="action-btn save-btn" aria-label="이미지 저장">💾 저장</button>
    </div>
  `;

  // 점수 바 애니메이션
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      card.querySelectorAll('.score-bar').forEach((bar) => {
        bar.style.width = bar.dataset.target + '%';
      });
    });
  });

  // 하트 버튼 이벤트
  card.querySelector('.heart-btn').addEventListener('click', () => handleHeart(card, data));

  // 공유(클립보드 복사) 버튼 이벤트
  card.querySelector('.share-btn').addEventListener('click', () => handleShare(data));

  // 억울해요(재심) 버튼 이벤트
  card.querySelector('.retrial-btn').addEventListener('click', () => toggleRetrialForm(card, data));

  // 저장(이미지) 버튼 이벤트
  card.querySelector('.save-btn').addEventListener('click', () => handleSaveImage(card, data));

  // 재심 폼 동적 생성 및 카드에 추가
  const retrialForm = buildRetrialForm(card, data);
  card.appendChild(retrialForm);

  if (prepend && container.firstChild) {
    container.insertBefore(card, container.firstChild);
  } else {
    container.appendChild(card);
  }

  // img → inline SVG 교체 (투명 배경으로 캐릭터만 애니메이션)
  inlineDiceBearSVGs(card);
}

// ===== 하트 처리 (localStorage) =====
function handleHeart(card, data) {
  if (!data.id) return;

  if (state.likedIds.has(data.id)) {
    showToast('이미 공감했어요! 💕');
    return;
  }

  const heartBtn = card.querySelector('.heart-btn');
  const heartIcon = heartBtn.querySelector('.heart-icon');
  const heartCount = heartBtn.querySelector('.heart-count');

  // localStorage 업데이트
  const newCount = updateHeart(data.id);
  if (newCount === null) return;

  // UI 업데이트
  heartIcon.textContent = '❤️';
  heartCount.textContent = newCount;
  heartBtn.classList.add('liked');

  // 좋아요 목록 저장
  state.likedIds.add(data.id);
  localStorage.setItem('likedIds', JSON.stringify([...state.likedIds]));

  showToast('❤️ 공감했습니다!');
}

// ===== 관계 유형 탭 =====
document.querySelectorAll('.relation-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.relation-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    state.activeRelation = tab.dataset.relation;
    state.activeTag = '전체'; // 탭 바꾸면 태그 필터 초기화
    renderTagFilter();
    renderFeedList();
  });
});

// ===== 태그 필터 렌더링 =====
function renderTagFilter() {
  let verdicts = getVerdicts();
  if (state.activeRelation !== '전체') {
    verdicts = verdicts.filter((v) => v.relation_type === state.activeRelation);
  }
  const tags = ['전체', ...new Set(verdicts.map((v) => v.tag).filter(Boolean))];

  dom.tagFilterBar.innerHTML = '';
  tags.forEach((tag) => {
    const btn = document.createElement('button');
    btn.className = 'tag-filter-btn' + (state.activeTag === tag ? ' active' : '');
    btn.textContent = tag;
    btn.addEventListener('click', () => {
      state.activeTag = tag;
      renderTagFilter();
      renderFeedList();
    });
    dom.tagFilterBar.appendChild(btn);
  });
}

// ===== 피드 목록만 렌더링 (태그 필터 적용) =====
function renderFeedList() {
  dom.feedList.innerHTML = '';

  let verdicts = getSortedVerdicts();
  if (state.activeRelation !== '전체') {
    verdicts = verdicts.filter((v) => v.relation_type === state.activeRelation);
  }
  if (state.activeTag !== '전체') {
    verdicts = verdicts.filter((v) => v.tag === state.activeTag);
  }

  if (verdicts.length === 0) {
    dom.feedList.innerHTML = `
      <div class="feed-empty">
        <div class="empty-icon">📭</div>
        <p>아직 판정 기록이 없어요.<br>첫 번째 논쟁을 심판받아보세요!</p>
      </div>
    `;
    return;
  }

  verdicts.forEach((item) => renderVerdictCard(item, dom.feedList, false));
}

// ===== 피드 로딩 (localStorage) =====
function loadFeed() {
  renderTagFilter();
  renderFeedList();
}

// ===== 유틸리티 =====
function showLoading(visible) {
  dom.loadingOverlay.classList.toggle('visible', visible);
}

function showError(msg) {
  dom.errorMsg.textContent = msg;
  dom.errorMsg.classList.add('visible');
}

function clearError() {
  dom.errorMsg.textContent = '';
  dom.errorMsg.classList.remove('visible');
}

let toastTimer = null;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => dom.toast.classList.remove('show'), 2500);
}

// ===== 1. 판결문 공유 (클립보드 복사) =====
function handleShare(data) {
  const severityBadge = data.severity_badge || SEVERITY_INFO[data.severity || 3].badge;
  const relationIcon = data.relation_type === 'couple' ? '💑 커플' : '👫 친구';
  const winnerText =
    data.winner === 'A' ? `${data.person_a} 승!`
    : data.winner === 'B' ? `${data.person_b} 승!`
    : '무승부';

  const text = [
    `⚖️ ${data.case_title || '제목 없음'}`,
    `${severityBadge} ${relationIcon}`,
    '',
    `🏆 판결: ${winnerText}`,
    `${data.person_a} ${data.score_a}점 vs ${data.person_b} ${data.score_b}점`,
    '',
    `💬 "${data.judge_comment || ''}"`,
    '',
    `📋 판결 이유: ${data.verdict_reason || ''}`,
    '',
    `💌 화해 미션: ${data.reconciliation_tip || ''}`,
    '',
    '— 논쟁 심판 앱에서 판정받음',
  ].join('\n');

  navigator.clipboard.writeText(text).then(() => {
    showToast('📋 판결문이 복사됐어요!');
  }).catch(() => {
    showToast('복사에 실패했어요. 다시 시도해주세요.');
  });
}

// ===== 2. 억울해요 재심 폼 생성 =====
function buildRetrialForm(card, data) {
  const form = document.createElement('div');
  form.className = 'retrial-form';

  const titleEl = document.createElement('div');
  titleEl.className = 'retrial-form-title';
  titleEl.textContent = '재심 신청';
  form.appendChild(titleEl);

  // 누가 억울한가 선택
  const whoLabel = document.createElement('div');
  whoLabel.style.cssText = 'font-size:0.82rem;color:var(--text-sub);margin-bottom:8px;font-weight:600;';
  whoLabel.textContent = '누가 억울한가요?';
  form.appendChild(whoLabel);

  const whoWrap = document.createElement('div');
  whoWrap.className = 'retrial-who';

  const btnA = document.createElement('button');
  btnA.className = 'retrial-who-btn';
  btnA.textContent = `A. ${data.person_a}`;
  btnA.dataset.side = 'A';

  const btnB = document.createElement('button');
  btnB.className = 'retrial-who-btn';
  btnB.textContent = `B. ${data.person_b}`;
  btnB.dataset.side = 'B';

  let selectedSide = null;
  [btnA, btnB].forEach((btn) => {
    btn.addEventListener('click', () => {
      btnA.classList.remove('selected-a', 'selected-b');
      btnB.classList.remove('selected-a', 'selected-b');
      selectedSide = btn.dataset.side;
      btn.classList.add(selectedSide === 'A' ? 'selected-a' : 'selected-b');
    });
  });

  whoWrap.appendChild(btnA);
  whoWrap.appendChild(btnB);
  form.appendChild(whoWrap);

  // 추가 변론 textarea
  const extraLabel = document.createElement('div');
  extraLabel.style.cssText = 'font-size:0.82rem;color:var(--text-sub);margin-bottom:8px;font-weight:600;';
  extraLabel.textContent = '추가 변론을 입력하세요';
  form.appendChild(extraLabel);

  const textarea = document.createElement('textarea');
  textarea.className = 'retrial-textarea';
  textarea.placeholder = '추가로 하고 싶은 말을 입력하세요...';
  textarea.rows = 3;
  textarea.maxLength = 500;
  form.appendChild(textarea);

  // 재심 요청 버튼
  const submitBtn = document.createElement('button');
  submitBtn.className = 'retrial-submit-btn';
  submitBtn.textContent = '재심 요청!';
  submitBtn.addEventListener('click', async () => {
    if (!selectedSide) {
      showToast('억울한 쪽을 먼저 선택해주세요!');
      return;
    }
    const extraArg = textarea.value.trim();
    if (!extraArg) {
      showToast('추가 변론을 입력해주세요!');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '재심 중...';
    showLoading(true);

    try {
      const prevWinner = data.winner;
      const newVerdict = await requestRetrialVerdict(data, selectedSide, extraArg);

      // localStorage 업데이트 (id 유지)
      const verdicts = getVerdicts();
      const idx = verdicts.findIndex((v) => v.id === data.id);
      const updatedData = { ...data, ...newVerdict };
      if (idx !== -1) {
        verdicts[idx] = updatedData;
        saveVerdicts(verdicts);
      }

      // 카드가 resultSection에 있으면 결과도 업데이트
      if (dom.resultSection.contains(card)) {
        dom.resultSection.innerHTML = '';
        renderVerdictCard(updatedData, dom.resultSection, false);
      }

      loadFeed();

      if (prevWinner !== '무승부' && newVerdict.winner !== prevWinner && newVerdict.winner !== '무승부') {
        showToast('🔄 역전! 판결이 뒤집혔어요!');
      } else {
        showToast('⚖️ 재심 판결이 완료됐습니다!');
      }
    } catch (e) {
      showToast('재심 중 오류가 발생했습니다: ' + e.message);
      submitBtn.disabled = false;
      submitBtn.textContent = '재심 요청!';
    } finally {
      showLoading(false);
    }
  });

  form.appendChild(submitBtn);
  return form;
}

// ===== 억울해요 폼 토글 =====
function toggleRetrialForm(card, data) {
  const form = card.querySelector('.retrial-form');
  if (!form) return;
  form.classList.toggle('open');
}

// ===== 재심 API 호출 =====
async function requestRetrialVerdict(data, side, extraArg) {
  const sideName = side === 'A' ? data.person_a : data.person_b;
  const systemPrompt = buildSystemPrompt(data.severity || 3, data.relation_type || 'couple')
    + '\n\n이것은 재심입니다. 추가 변론을 반드시 반영하여 판결을 재고하세요.';

  const userPrompt = `다음 ${data.relation_type === 'couple' ? '커플' : '친구'} 논쟁을 재심해주세요. (심각도: ${data.severity_badge || ''})

[상황]
${data.situation || '(상황 정보 없음)'}

[A측 - ${data.person_a}의 주장]
${data.argument_a || ''}

[B측 - ${data.person_b}의 주장]
${data.argument_b || ''}

[추가 변론 - ${sideName}(${side}측)이 억울하다며 추가 제출]
${extraArg}

위 논쟁에 대해 재심 판결을 내려주세요. score_a와 score_b의 합이 반드시 100이 되도록 해주세요.`;

  const schema = {
    type: 'object',
    properties: {
      case_title:         { type: 'string', description: '논쟁 제목 (재밌게)' },
      winner:             { type: 'string', enum: ['A', 'B', '무승부'] },
      score_a:            { type: 'number', description: '0~100 사이 점수' },
      score_b:            { type: 'number', description: '0~100 사이 점수' },
      judge_comment:      { type: 'string', description: '판사 한마디 (심각도 반영)' },
      verdict_reason:     { type: 'string', description: '판결 이유 2-3문장' },
      tag:                { type: 'string', description: '#음식 같은 해시태그' },
      reconciliation_tip: { type: 'string', description: '화해 미션 또는 팁' },
    },
    required: ['case_title','winner','score_a','score_b','judge_comment','verdict_reason','tag','reconciliation_tip'],
    additionalProperties: false,
  };

  const response = await fetch('/api/judge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'verdict', strict: true, schema },
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API 오류 (${response.status}): ${errBody}`);
  }

  const resData = await response.json();
  const content = resData.choices?.[0]?.message?.content;
  if (!content) throw new Error('API 응답이 비어있습니다.');
  return JSON.parse(content);
}

// ===== 4. 이미지 저장 (html2canvas) =====
async function handleSaveImage(card, data) {
  const saveBtn = card.querySelector('.save-btn');
  if (!saveBtn) return;

  saveBtn.disabled = true;
  saveBtn.textContent = '저장 중...';

  try {
    const canvas = await html2canvas(card, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      ignoreElements: (el) => el.classList.contains('retrial-form'),
    });

    const link = document.createElement('a');
    const titleSlice = (data.case_title || '판결').replace(/[\\/:*?"<>|]/g, '').slice(0, 10);
    link.download = `판결_${titleSlice}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (e) {
    showToast('이미지 저장에 실패했어요.');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = '💾 저장';
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ===== 초기화 =====
loadFeed();
