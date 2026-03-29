/**
 * renderer.js
 * ──────────────────────────────────────────────
 * 분석 결과 JSON을 화면에 렌더링하는 함수들.
 *
 * - 상태 메시지
 * - 원문 구조 분석 (토큰 박스)
 * - 번역문 구조 분석
 * - 원문-번역 대응 시각화
 * - 문장 구조 해설
 * - 핵심 어휘 카드
 * - 폴백 안내 문구
 */

// ───────── 상태 메시지 ─────────

/**
 * 상태 메시지를 화면에 표시.
 * @param {string} message
 * @param {'info'|'success'|'warning'|'error'} type
 */
function renderStatus(message, type) {
  const el = document.getElementById('status-area');
  if (!el) return;

  const typeClass = {
    info: 'status-info',
    success: 'status-success',
    warning: 'status-warning',
    error: 'status-error'
  }[type] || 'status-info';

  // 메시지를 추가 (기존 메시지 유지)
  const line = document.createElement('div');
  line.className = `status-line ${typeClass}`;
  line.textContent = `[${new Date().toLocaleTimeString('ko-KR')}] ${message}`;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

/**
 * 상태 영역 초기화.
 */
function clearStatus() {
  const el = document.getElementById('status-area');
  if (el) el.innerHTML = '';
}


// ───────── 원문 구조 분석 ─────────

/**
 * segmentation 데이터를 토큰 박스 형태로 렌더링.
 * - 불교 용어는 강조 색상
 * - confidence에 따라 배지 표시
 * @param {object} data - 전체 분석 JSON
 */
function renderOriginalStructure(data) {
  const container = document.getElementById('original-structure');
  if (!container) return;
  container.innerHTML = '';

  const seg = data.segmentation;
  if (!seg) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_segmentation') + '</p>';
    return;
  }

  // 절(句) 분리 표시
  if (seg.clauses && seg.clauses.length > 0) {
    const clauseSection = document.createElement('div');
    clauseSection.className = 'clause-section';
    const clauseTitle = document.createElement('h4');
    clauseTitle.textContent = t('r_clause_split');
    clauseSection.appendChild(clauseTitle);

    const clauseList = document.createElement('div');
    clauseList.className = 'clause-list';
    seg.clauses.forEach((clause, idx) => {
      const tag = document.createElement('span');
      tag.className = 'clause-tag';
      tag.textContent = `${idx + 1}. ${fixBrokenUnicode(clause || '')}`;
      clauseList.appendChild(tag);
    });
    clauseSection.appendChild(clauseList);
    container.appendChild(clauseSection);
  }

  // 토큰 박스 표시
  if (seg.tokens && seg.tokens.length > 0) {
    const tokenSection = document.createElement('div');
    tokenSection.className = 'token-section';
    const tokenTitle = document.createElement('h4');
    tokenTitle.textContent = t('r_token_analysis');
    tokenSection.appendChild(tokenTitle);

    const tokenGrid = document.createElement('div');
    tokenGrid.className = 'token-grid';

    seg.tokens.forEach(token => {
      const box = document.createElement('div');
      box.className = 'token-box';

      // 불교 용어 강조
      if (token.is_buddhist_term) {
        box.classList.add('buddhist-term');
      }

      // 표면형 (한자만 표시, 현토는 절 분리에서 확인)
      const surface = document.createElement('div');
      surface.className = 'token-surface';
      surface.textContent = sanitizeSurface(fixBrokenUnicode(token.surface));
      box.appendChild(surface);

      // 글자별 뜻
      if (token.char_gloss && token.char_gloss.length > 0) {
        const gloss = document.createElement('div');
        gloss.className = 'token-gloss';
        gloss.textContent = fixBrokenUnicode(token.char_gloss.join(', '));
        box.appendChild(gloss);
      }

      // 품사 후보
      if (token.pos_candidates && token.pos_candidates.length > 0) {
        const pos = document.createElement('div');
        pos.className = 'token-pos';
        token.pos_candidates.forEach(p => {
          const tag = document.createElement('span');
          tag.className = 'pos-tag';
          tag.textContent = p;
          pos.appendChild(tag);
        });
        box.appendChild(pos);
      }

      // 기능 후보
      if (token.function_candidates && token.function_candidates.length > 0) {
        const func = document.createElement('div');
        func.className = 'token-func';
        token.function_candidates.forEach(f => {
          const tag = document.createElement('span');
          tag.className = 'func-tag';
          tag.textContent = f;
          func.appendChild(tag);
        });
        box.appendChild(func);
      }

      // confidence 배지
      const conf = token.confidence || 'unknown';
      const badge = document.createElement('span');
      badge.className = `conf-badge ${confidenceClass(conf)}`;
      badge.textContent = confidenceLabel(conf);
      box.appendChild(badge);

      // 불교 용어 마크
      if (token.is_buddhist_term) {
        const mark = document.createElement('span');
        mark.className = 'buddhist-mark';
        mark.textContent = '佛';
        box.appendChild(mark);
      }

      // ambiguity 표시
      if (token.ambiguity && token.ambiguity.length > 0) {
        const amb = document.createElement('div');
        amb.className = 'token-ambiguity';
        amb.textContent = '⚠ ' + token.ambiguity.map(a => fixBrokenUnicode(typeof a === 'object' && a ? Object.values(a).filter(Boolean).join(': ') : String(a||''))).join('; ');
        box.appendChild(amb);
      }

      tokenGrid.appendChild(box);
    });

    tokenSection.appendChild(tokenGrid);
    container.appendChild(tokenSection);
  }
}


// ───────── 번역문 구조 분석 ─────────

/**
 * parsing 데이터의 번역 결과를 렌더링.
 * @param {object} data - 전체 분석 JSON
 */
function renderTranslatedStructure(data) {
  const container = document.getElementById('translated-structure');
  if (!container) return;
  container.innerHTML = '';

  const parsing = data.parsing;
  if (!parsing) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_translation') + '</p>';
    return;
  }

  // 문장 유형
  if (parsing.sentence_type) {
    const typeDiv = document.createElement('div');
    typeDiv.className = 'sentence-type';
    typeDiv.innerHTML = `<strong>${t('r_sentence_type')}</strong> ${escapeHtml(fixBrokenUnicode(parsing.sentence_type || ''))}`;
    container.appendChild(typeDiv);
  }

  // 직역
  if (parsing.literal_translation) {
    const litDiv = document.createElement('div');
    litDiv.className = 'translation-block literal';
    litDiv.innerHTML = `<h4>${t('r_literal')}</h4><p>${escapeHtml(fixBrokenUnicode(parsing.literal_translation || ''))}</p>`;
    container.appendChild(litDiv);
  }

  // 의역
  if (parsing.idiomatic_translation) {
    const idioDiv = document.createElement('div');
    idioDiv.className = 'translation-block idiomatic';
    idioDiv.innerHTML = `<h4>${t('r_idiomatic')}</h4><p>${escapeHtml(fixBrokenUnicode(parsing.idiomatic_translation || ''))}</p>`;
    container.appendChild(idioDiv);
  }

  // 검증에서 수정된 번역이 있으면 표시
  const ver = data.verification;
  if (ver) {
    if (ver.revised_literal_translation) {
      const revLit = document.createElement('div');
      revLit.className = 'translation-block revised';
      revLit.innerHTML = `<h4>${t('r_revised_literal')}</h4><p>${escapeHtml(fixBrokenUnicode(ver.revised_literal_translation || ''))}</p>`;
      container.appendChild(revLit);
    }
    if (ver.revised_idiomatic_translation) {
      const revIdio = document.createElement('div');
      revIdio.className = 'translation-block revised';
      revIdio.innerHTML = `<h4>${t('r_revised_idiomatic')}</h4><p>${escapeHtml(fixBrokenUnicode(ver.revised_idiomatic_translation || ''))}</p>`;
      container.appendChild(revIdio);
    }
  }

  // 문법 포인트
  if (parsing.grammar_points && parsing.grammar_points.length > 0) {
    const gpDiv = document.createElement('div');
    gpDiv.className = 'grammar-points';
    gpDiv.innerHTML = '<h4>' + t('r_grammar_points') + '</h4>';
    const ul = document.createElement('ul');
    parsing.grammar_points.forEach(gp => {
      const li = document.createElement('li');
      if (typeof gp === 'object' && gp !== null) {
        li.textContent = fixBrokenUnicode(Object.values(gp).filter(Boolean).join(': '));
      } else {
        li.textContent = fixBrokenUnicode(String(gp || ''));
      }
      ul.appendChild(li);
    });
    gpDiv.appendChild(ul);
    container.appendChild(gpDiv);
  }

  // 불교학 참고
  if (parsing.buddhist_notes && parsing.buddhist_notes.length > 0) {
    const bnDiv = document.createElement('div');
    bnDiv.className = 'buddhist-notes';
    bnDiv.innerHTML = '<h4>' + t('r_buddhist_notes') + '</h4>';
    const ul = document.createElement('ul');
    parsing.buddhist_notes.forEach(bn => {
      const li = document.createElement('li');
      if (typeof bn === 'object' && bn !== null) {
        li.textContent = fixBrokenUnicode(Object.values(bn).filter(Boolean).join(': '));
      } else {
        li.textContent = fixBrokenUnicode(String(bn || ''));
      }
      ul.appendChild(li);
    });
    bnDiv.appendChild(ul);
    container.appendChild(bnDiv);
  }

  // 그 외 참고 (지명·인물·왕조·시기 등)
  if (parsing.other_notes && parsing.other_notes.length > 0) {
    const onDiv = document.createElement('div');
    onDiv.className = 'other-notes';
    onDiv.innerHTML = '<h4>' + t('r_other_notes') + '</h4>';
    const ul = document.createElement('ul');
    parsing.other_notes.forEach(on => {
      const li = document.createElement('li');
      if (typeof on === 'object' && on !== null) {
        li.textContent = fixBrokenUnicode(Object.values(on).filter(Boolean).join(': '));
      } else {
        li.textContent = fixBrokenUnicode(String(on || ''));
      }
      ul.appendChild(li);
    });
    onDiv.appendChild(ul);
    container.appendChild(onDiv);
  }
}


// ───────── 원문-번역 대응 시각화 ─────────

/**
 * alignment 데이터를 source_span → target_span 형태로 렌더링.
 * relation과 confidence를 함께 표시.
 * @param {object} data - 전체 분석 JSON
 */
function renderAlignment(data) {
  const container = document.getElementById('alignment-view');
  if (!container) return;
  container.innerHTML = '';

  const alignment = data.alignment;
  if (!alignment || alignment.length === 0) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_alignment') + '</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'alignment-table';

  // 헤더
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr>
      <th>${t('r_th_source')}</th>
      <th></th>
      <th>${t('r_th_target')}</th>
      <th>${t('r_th_relation')}</th>
      <th>${t('r_th_confidence')}</th>
      <th>${t('r_th_reason')}</th>
    </tr>
  `;
  table.appendChild(thead);

  // 본문
  const tbody = document.createElement('tbody');
  alignment.forEach(item => {
    const tr = document.createElement('tr');

    const conf = item.confidence || 'unknown';
    tr.innerHTML = `
      <td class="align-source">${escapeHtml(sanitizeSurface(fixBrokenUnicode(item.source_span || '')))}</td>
      <td class="align-arrow">→</td>
      <td class="align-target">${escapeHtml(fixBrokenUnicode(item.target_span || ''))}</td>
      <td><span class="relation-badge relation-${(item.relation || '').replace(/:/g, '-')}">${escapeHtml(item.relation || '')}</span></td>
      <td><span class="conf-badge ${confidenceClass(conf)}">${confidenceLabel(conf)}</span></td>
      <td class="align-reason">${escapeHtml(fixBrokenUnicode(item.reason || ''))}</td>
    `;
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}


// ───────── 문장 구조 해설 ─────────

/**
 * 문장 성분을 카드 형태로 렌더링.
 * condition → subject → adverbial → predicate → object → complement → omitted_elements 순서.
 * @param {object} data - 전체 분석 JSON
 */
function renderExplanation(data) {
  const container = document.getElementById('explanation-view');
  if (!container) return;
  container.innerHTML = '';

  const comp = data.parsing?.components;
  if (!comp) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_structure') + '</p>';
    return;
  }

  const components = [
    { label: t('r_condition'), value: comp.condition, icon: '⟨C⟩' },
    { label: t('r_subject'), value: comp.subject, icon: '⟨S⟩' },
    { label: t('r_adverbial'), value: comp.adverbial, icon: '⟨A⟩' },
    { label: t('r_predicate'), value: comp.predicate, icon: '⟨P⟩' },
    { label: t('r_object'), value: comp.object, icon: '⟨O⟩' },
    { label: t('r_complement'), value: comp.complement, icon: '⟨Co⟩' },
    { label: t('r_omitted'), value: comp.omitted_elements, icon: '⟨…⟩' },
    { label: t('r_ambiguity'), value: comp.ambiguity, icon: '⟨?⟩' }
  ];

  const grid = document.createElement('div');
  grid.className = 'component-grid';

  components.forEach(c => {
    // 값이 비어있으면 건너뜀
    const val = formatComponentValue(c.value);
    if (!val) return;

    const card = document.createElement('div');
    card.className = 'component-card';

    const header = document.createElement('div');
    header.className = 'component-header';
    header.textContent = c.label;

    const body = document.createElement('div');
    body.className = 'component-body';
    body.textContent = fixBrokenUnicode(typeof val === 'string' ? val : String(val||''));

    card.appendChild(header);
    card.appendChild(body);
    grid.appendChild(card);
  });

  container.appendChild(grid);

  // 검증 이슈 표시
  const ver = data.verification;
  if (ver && ver.issues_found && ver.issues_found.length > 0) {
    const issueDiv = document.createElement('div');
    issueDiv.className = 'verification-issues';
    issueDiv.innerHTML = '<h4>' + t('r_verification_result') + '</h4>';
    const ul = document.createElement('ul');
    ver.issues_found.forEach(issue => {
      const li = document.createElement('li');
      li.textContent = fixBrokenUnicode(String(issue||''));
      ul.appendChild(li);
    });
    issueDiv.appendChild(ul);
    container.appendChild(issueDiv);
  }

  // final_notes 표시
  if (ver && ver.final_notes && ver.final_notes.length > 0) {
    const notesDiv = document.createElement('div');
    notesDiv.className = 'final-notes';
    notesDiv.innerHTML = '<h4>' + t('r_final_notes') + '</h4>';
    const ul = document.createElement('ul');
    ver.final_notes.forEach(note => {
      const li = document.createElement('li');
      li.textContent = fixBrokenUnicode(String(note||''));
      ul.appendChild(li);
    });
    notesDiv.appendChild(ul);
    container.appendChild(notesDiv);
  }
}

/**
 * 문장 성분 값을 문자열로 포맷.
 * @param {string|string[]} value
 * @returns {string}
 */
function formatComponentValue(value) {
  if (!value) return '';
  if (Array.isArray(value)) {
    const filtered = value.map(v => {
      if (!v) return '';
      if (typeof v === 'object') {
        return fixBrokenUnicode(Object.values(v).filter(Boolean).join(': '));
      }
      return fixBrokenUnicode(String(v));
    }).filter(s => s.trim());
    return filtered.length > 0 ? filtered.join(', ') : '';
  }
  if (typeof value === 'object') {
    return fixBrokenUnicode(Object.values(value).filter(Boolean).join(': '));
  }
  return fixBrokenUnicode(String(value).trim());
}


// ───────── 핵심 어휘 카드 ─────────

/**
 * 토큰 중 불교 용어를 핵심 어휘 카드로 렌더링.
 * 용어, 기본 뜻, 불교학적 의미를 함께 표시.
 * @param {object} data - 전체 분석 JSON
 */
function renderVocabularyCards(data) {
  const container = document.getElementById('vocabulary-cards');
  if (!container) return;
  container.innerHTML = '';

  const tokens = data.segmentation?.tokens;
  if (!tokens || tokens.length === 0) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_vocabulary') + '</p>';
    return;
  }

  // 불교 용어 + 주요 허사/동사 필터링 (중복 제거)
  const seen = new Set();
  const vocabTokens = tokens.filter(t => {
    if (seen.has(t.surface)) return false;
    seen.add(t.surface);
    return t.is_buddhist_term || (t.char_gloss && t.char_gloss.length > 0);
  });

  if (vocabTokens.length === 0) {
    container.innerHTML = '<p class="empty-msg">' + t('r_no_vocab_display') + '</p>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'vocab-grid';

  vocabTokens.forEach(token => {
    const card = document.createElement('div');
    card.className = 'vocab-card';
    if (token.is_buddhist_term) {
      card.classList.add('vocab-buddhist');
    }

    // 한자 (한자만 표시, 현토 제외)
    const charDiv = document.createElement('div');
    charDiv.className = 'vocab-char';
    charDiv.textContent = sanitizeSurface(fixBrokenUnicode(token.surface));
    card.appendChild(charDiv);

    // 독음 (폴백에서 제공하는 경우)
    if (token.reading) {
      const readingDiv = document.createElement('div');
      readingDiv.className = 'vocab-reading';
      readingDiv.textContent = fixBrokenUnicode(token.reading || '');
      card.appendChild(readingDiv);
    }

    // 기본 뜻
    if (token.char_gloss && token.char_gloss.length > 0) {
      const glossDiv = document.createElement('div');
      glossDiv.className = 'vocab-gloss';
      glossDiv.textContent = fixBrokenUnicode(token.char_gloss.join(', '));
      card.appendChild(glossDiv);
    }

    // 불교학적 의미
    if (token.buddhist_meaning) {
      const bmDiv = document.createElement('div');
      bmDiv.className = 'vocab-buddhist-meaning';
      bmDiv.textContent = fixBrokenUnicode(token.buddhist_meaning || '');
      card.appendChild(bmDiv);
    }

    // 품사
    if (token.pos_candidates && token.pos_candidates.length > 0) {
      const posDiv = document.createElement('div');
      posDiv.className = 'vocab-pos';
      token.pos_candidates.forEach(p => {
        const tag = document.createElement('span');
        tag.className = 'pos-tag';
        tag.textContent = p;
        posDiv.appendChild(tag);
      });
      card.appendChild(posDiv);
    }

    // 불교 용어 배지
    if (token.is_buddhist_term) {
      const badge = document.createElement('div');
      badge.className = 'vocab-badge';
      badge.textContent = t('r_buddhist_term');
      card.appendChild(badge);
    }

    grid.appendChild(card);
  });

  container.appendChild(grid);
}


// ───────── 폴백 안내 ─────────

/**
 * 폴백 분석임을 사용자에게 안내하는 배너 표시.
 * @param {boolean} isFallback
 */
function renderFallbackNotice(isFallback) {
  const existing = document.getElementById('fallback-notice');
  if (existing) existing.remove();

  if (!isFallback) return;

  const resultsSection = document.getElementById('results-section');
  if (!resultsSection) return;

  const notice = document.createElement('div');
  notice.id = 'fallback-notice';
  notice.className = 'fallback-notice';
  notice.innerHTML = `
    <strong>${t('r_fallback_title')}</strong>
    <p>${t('r_fallback_msg1')}</p>
    <p>${t('r_fallback_msg2')}</p>
  `;
  resultsSection.insertBefore(notice, resultsSection.firstChild);
}


// ───────── 전체 렌더링 ─────────

/**
 * 모든 결과 영역을 한꺼번에 렌더링.
 * @param {object} data - 최종 분석 JSON
 */
function renderAll(data) {
  if (!data) return;

  // 결과 영역 표시
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    resultsSection.style.display = 'block';
  }

  // 폴백 안내
  renderFallbackNotice(!!data._is_fallback);

  // 각 섹션 렌더링
  renderOriginalStructure(data);
  renderTranslatedStructure(data);
  renderAlignment(data);
  renderExplanation(data);
  renderVocabularyCards(data);

  // 다운로드 버튼 렌더링
  renderDownloadButton(data);

  debugLog('전체 렌더링 완료');
}


// ───────── HTML 다운로드 ─────────

/**
 * 다운로드 버튼을 결과 영역 하단에 렌더링.
 * @param {object} data - 분석 JSON
 */
function renderDownloadButton(data) {
  // 기존 다운로드 버튼 제거
  const existing = document.getElementById('download-area');
  if (existing) existing.remove();

  const resultsSection = document.getElementById('results-section');
  if (!resultsSection) return;

  const area = document.createElement('div');
  area.id = 'download-area';
  area.className = 'download-area';

  const btn = document.createElement('button');
  btn.className = 'btn-primary';
  btn.textContent = t('r_btn_download_html');
  btn.style.marginRight = '0.75rem';
  btn.addEventListener('click', () => downloadAnalysisHtml(data));

  const jsonBtn = document.createElement('button');
  jsonBtn.className = 'btn-secondary';
  jsonBtn.textContent = t('r_btn_download_json');
  jsonBtn.addEventListener('click', () => downloadAnalysisJson(data));

  area.appendChild(btn);
  area.appendChild(jsonBtn);
  resultsSection.appendChild(area);
}

/**
 * 분석 결과 JSON을 다운로드.
 */
function downloadAnalysisJson(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  a.download = `TranslateDu_${timestamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 입력 텍스트에서 원문(한자+현토)을 하이라이트 HTML로 변환.
 * 한자는 그대로, 한글(현토)은 <span class="ht"> 로 감싸기.
 * @param {string} text
 * @returns {string} HTML 문자열
 */
function renderOriginalTextWithHyeonto(text) {
  if (!text) return '';
  // 한글 블록: AC00-D7AF (완성형 음절), 한글 자모: 3131-318E
  return escapeHtml(text).replace(
    /([\uAC00-\uD7AF\u3131-\u318E]+)/g,
    '<span class="ht">$1</span>'
  );
}

/**
 * 분석 결과를 자체 완결형 HTML 파일로 생성하여 다운로드.
 * @param {object} data - 분석 JSON
 */
function downloadAnalysisHtml(data) {
  const inputText = data.input_text || '';
  const seg = data.segmentation || {};
  const parsing = data.parsing || {};
  const alignment = data.alignment || [];
  const verification = data.verification || {};
  const isFallback = !!data._is_fallback;

  // ── 출력 언어 감지 ──
  const lang = typeof getSelectedOutputLang === 'function' ? getSelectedOutputLang() : 'ko';
  const HTML_LANG_MAP = { ko: 'ko', en: 'en', ja: 'ja', 'zh-CN': 'zh-Hans', 'zh-TW': 'zh-Hant' };
  const htmlLang = HTML_LANG_MAP[lang] || 'ko';

  // ── 언어별 font-stack 동적 생성 ──
  const FONT_STACKS = {
    ko: "'Pretendard', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    en: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans KR', sans-serif",
    ja: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', 'Meiryo', -apple-system, sans-serif",
    'zh-CN': "'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', 'Source Han Sans SC', sans-serif",
    'zh-TW': "'Microsoft JhengHei', 'PingFang TC', 'Noto Sans TC', 'Source Han Sans TC', sans-serif",
  };
  const FONT_HANJA_STACKS = {
    ko: "'Noto Serif KR', 'Noto Serif JP', 'Noto Serif SC', 'Noto Serif TC', 'Batang', serif",
    en: "'Noto Serif SC', 'Noto Serif KR', 'Noto Serif JP', 'Noto Serif TC', 'SimSun', serif",
    ja: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif SC', serif",
    'zh-CN': "'Noto Serif SC', 'SimSun', 'FangSong', 'Noto Serif TC', serif",
    'zh-TW': "'Noto Serif TC', 'PMingLiU', 'Noto Serif SC', 'MingLiU', serif",
  };
  const fontStack = FONT_STACKS[lang] || FONT_STACKS.ko;
  const fontHanja = FONT_HANJA_STACKS[lang] || FONT_HANJA_STACKS.ko;

  // ── 원문 표시 (현토 하이라이트) ──
  const originalHtml = renderOriginalTextWithHyeonto(inputText);

  // ── 절 분리 ──
  const clausesHtml = (seg.clauses || []).map((c, i) =>
    `<span class="clause-tag">${i + 1}. ${escapeHtml(fixBrokenUnicode(c || ''))}</span>`
  ).join(' ');

  // ── 토큰 박스 ──
  const tokensHtml = (seg.tokens || []).map(t => {
    const isBuddh = t.is_buddhist_term;
    const cls = isBuddh ? 'token-box buddhist-term' : 'token-box';
    const surfaceDisplay = escapeHtml(sanitizeSurface(fixBrokenUnicode(t.surface)));
    const gloss = fixBrokenUnicode((t.char_gloss || []).join(', '));
    const posTags = (t.pos_candidates || []).map(p => `<span class="pos-tag">${escapeHtml(fixBrokenUnicode(String(p||'')))}</span>`).join(' ');
    const funcTags = (t.function_candidates || []).map(f => `<span class="func-tag">${escapeHtml(fixBrokenUnicode(String(f||'')))}</span>`).join(' ');
    const conf = t.confidence || 'unknown';
    const confCls = ({ high: 'conf-high', medium: 'conf-medium', low: 'conf-low' })[conf] || 'conf-unknown';
    const confLbl = confidenceLabel(conf);
    const buddhMark = isBuddh ? '<span class="buddhist-mark">佛</span>' : '';
    const ambiguity = (t.ambiguity || []).length > 0
      ? `<div class="token-ambiguity">⚠ ${escapeHtml(fixBrokenUnicode(t.ambiguity.map(a => typeof a === 'object' && a ? Object.values(a).filter(Boolean).join(': ') : String(a||'')).join('; ')))}</div>` : '';

    return `<div class="${cls}">
      ${buddhMark}
      <div class="token-surface">${surfaceDisplay}</div>
      <div class="token-gloss">${escapeHtml(gloss)}</div>
      <div class="token-pos">${posTags}</div>
      <div class="token-func">${funcTags}</div>
      <span class="conf-badge ${confCls}">${confLbl}</span>
      ${ambiguity}
    </div>`;
  }).join('\n');

  // ── 번역 ──
  const litTrans = parsing.literal_translation || '';
  const idioTrans = parsing.idiomatic_translation || '';
  const revLit = verification.revised_literal_translation || '';
  const revIdio = verification.revised_idiomatic_translation || '';
  const sentenceType = parsing.sentence_type || '';

  // ── 문법 포인트 ──
  const grammarHtml = (parsing.grammar_points || []).map(g => { const s = fixBrokenUnicode(typeof g === 'object' && g ? Object.values(g).filter(Boolean).join(': ') : String(g||'')); return `<li>${escapeHtml(s)}</li>`; }).join('\n');

  // ── 불교학 참고 ──
  const buddhistNotesHtml = (parsing.buddhist_notes || []).map(n => { const s = fixBrokenUnicode(typeof n === 'object' && n ? Object.values(n).filter(Boolean).join(': ') : String(n||'')); return `<li>${escapeHtml(s)}</li>`; }).join('\n');
  const otherNotesHtml = (parsing.other_notes || []).map(n => { const s = fixBrokenUnicode(typeof n === 'object' && n ? Object.values(n).filter(Boolean).join(': ') : String(n||'')); return `<li>${escapeHtml(s)}</li>`; }).join('\n');

  // ── Alignment ──
  const alignRows = alignment.map(a => {
    const conf = a.confidence || 'unknown';
    const confCls = ({ high: 'conf-high', medium: 'conf-medium', low: 'conf-low' })[conf] || 'conf-unknown';
    const confLbl = confidenceLabel(conf);
    const relCls = 'relation-' + (a.relation || '').replace(/:/g, '-');
    return `<tr>
      <td class="align-source">${escapeHtml(sanitizeSurface(fixBrokenUnicode(a.source_span || '')))}</td>
      <td class="align-arrow">→</td>
      <td class="align-target">${escapeHtml(fixBrokenUnicode(a.target_span || ''))}</td>
      <td><span class="relation-badge ${relCls}">${escapeHtml(a.relation || '')}</span></td>
      <td><span class="conf-badge ${confCls}">${confLbl}</span></td>
      <td class="align-reason">${escapeHtml(fixBrokenUnicode(a.reason || ''))}</td>
    </tr>`;
  }).join('\n');

  // ── 문장 구조 ──
  const comp = parsing.components || {};
  const compEntries = [
    [t('r_condition'), comp.condition],
    [t('r_subject'), comp.subject],
    [t('r_adverbial'), comp.adverbial],
    [t('r_predicate'), comp.predicate],
    [t('r_object'), comp.object],
    [t('r_complement'), comp.complement],
    [t('r_omitted'), comp.omitted_elements],
    [t('r_ambiguity'), comp.ambiguity],
  ];
  const compHtml = compEntries
    .filter(([, val]) => {
      if (!val) return false;
      if (Array.isArray(val)) return val.filter(v => v && v.toString().trim()).length > 0;
      return val.toString().trim() !== '';
    })
    .map(([label, val]) => {
      const display = Array.isArray(val) ? val.filter(v => v && v.toString().trim()).join(', ') : val;
      return `<div class="component-card"><div class="component-header">${escapeHtml(label)}</div><div class="component-body">${escapeHtml(display.toString())}</div></div>`;
    }).join('\n');

  // ── 검증 ──
  const issuesHtml = (verification.issues_found || []).map(i => `<li>${escapeHtml(i)}</li>`).join('\n');
  const finalNotesHtml = (verification.final_notes || []).map(n => `<li>${escapeHtml(n)}</li>`).join('\n');

  // ── 어휘 카드 ──
  const seen = new Set();
  const vocabTokens = (seg.tokens || []).filter(t => {
    if (seen.has(t.surface)) return false;
    seen.add(t.surface);
    return t.is_buddhist_term || (t.char_gloss && t.char_gloss.length > 0);
  });
  const vocabHtml = vocabTokens.map(t => {
    const isBuddh = t.is_buddhist_term;
    const cls = isBuddh ? 'vocab-card vocab-buddhist' : 'vocab-card';
    const surfaceDisplay = escapeHtml(sanitizeSurface(fixBrokenUnicode(t.surface)));
    const reading = t.reading ? `<div class="vocab-reading">${escapeHtml(t.reading)}</div>` : '';
    const gloss = (t.char_gloss || []).length > 0
      ? `<div class="vocab-gloss">${escapeHtml(t.char_gloss.join(', '))}</div>` : '';
    const bm = t.buddhist_meaning
      ? `<div class="vocab-buddhist-meaning">${escapeHtml(t.buddhist_meaning)}</div>` : '';
    const posTags = (t.pos_candidates || []).map(p => `<span class="pos-tag">${escapeHtml(p)}</span>`).join(' ');
    const badge = isBuddh ? `<div class="vocab-badge">${t('r_buddhist_term')}</div>` : '';
    return `<div class="${cls}">
      <div class="vocab-char">${surfaceDisplay}</div>
      ${reading}${gloss}${bm}
      <div class="vocab-pos">${posTags}</div>
      ${badge}
    </div>`;
  }).join('\n');

  const timestamp = new Date().toLocaleString('ko-KR');

  // ── 최종 HTML 조립 ──
  const html = `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700&family=Noto+Serif+KR:wght@400;700&family=Noto+Sans+JP:wght@400;500;600;700&family=Noto+Serif+JP:wght@400;700&family=Noto+Sans+SC:wght@400;500;600;700&family=Noto+Serif+SC:wght@400;700&family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@400;700&display=swap" rel="stylesheet">
<title>${t('r_html_title')}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--color-bg:#f8f9fa;--color-surface:#fff;--color-text:#212529;--color-text-secondary:#6c757d;--color-border:#dee2e6;--color-primary:#2c5282;--color-primary-light:#ebf4ff;--color-accent:#c05621;--color-accent-light:#fefcbf;--color-success:#276749;--color-success-bg:#f0fff4;--color-warning:#975a16;--color-warning-bg:#fffff0;--color-error:#c53030;--color-error-bg:#fff5f5;--color-info:#2b6cb0;--color-info-bg:#ebf8ff;--color-buddhist:#805ad5;--color-buddhist-bg:#faf5ff;--font-stack:${fontStack};--font-hanja:${fontHanja};--radius:6px;--shadow-sm:0 1px 2px rgba(0,0,0,0.06)}
html{font-size:16px;line-height:1.6}
body{font-family:var(--font-stack);color:var(--color-text);background:var(--color-bg);min-height:100vh}
.container{max-width:960px;margin:0 auto;padding:2rem 1.5rem}
header{text-align:center;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:2px solid var(--color-border)}
header h1{font-size:1.5rem;font-weight:700;color:var(--color-primary);margin-bottom:0.25rem}
header .subtitle{font-size:0.875rem;color:var(--color-text-secondary)}
.section{background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);padding:1.25rem;margin-bottom:1.25rem;box-shadow:var(--shadow-sm)}
.section h3{font-size:1rem;font-weight:700;color:var(--color-primary);margin-bottom:1rem;padding-bottom:0.5rem;border-bottom:1px solid var(--color-border)}
.original-text{font-family:var(--font-hanja);font-size:1.2rem;line-height:2;padding:0.75rem;background:var(--color-primary-light);border-radius:var(--radius);margin-bottom:1rem}
.ht{color:var(--color-accent);font-family:var(--font-stack);font-size:0.8em;font-weight:600;vertical-align:baseline}
.clause-tag{display:inline-block;padding:0.35rem 0.75rem;background:var(--color-primary-light);color:var(--color-primary);border-radius:var(--radius);font-size:0.9rem;font-family:var(--font-hanja);margin:0.2rem}
.token-grid{display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:0.75rem}
.token-box{position:relative;min-width:80px;padding:0.6rem 0.75rem;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius);text-align:center;box-shadow:var(--shadow-sm)}
.token-box.buddhist-term{border-color:var(--color-buddhist);background:var(--color-buddhist-bg)}
.token-surface{font-family:var(--font-hanja);font-size:1.3rem;font-weight:700;color:var(--color-text);margin-bottom:0.3rem}
.token-box.buddhist-term .token-surface{color:var(--color-buddhist)}
.token-gloss{font-size:0.75rem;color:var(--color-text-secondary);margin-bottom:0.3rem}
.token-pos,.token-func{display:flex;flex-wrap:wrap;gap:0.2rem;justify-content:center;margin-bottom:0.2rem}
.pos-tag{display:inline-block;padding:0.1rem 0.4rem;font-size:0.65rem;background:#e2e8f0;color:#4a5568;border-radius:3px}
.func-tag{display:inline-block;padding:0.1rem 0.4rem;font-size:0.65rem;background:#fefcbf;color:#975a16;border-radius:3px}
.conf-badge{display:inline-block;padding:0.1rem 0.4rem;font-size:0.6rem;font-weight:600;border-radius:3px;margin-top:0.2rem}
.conf-high{background:#c6f6d5;color:var(--color-success)}
.conf-medium{background:#fefcbf;color:var(--color-warning)}
.conf-low{background:#fed7d7;color:var(--color-error)}
.conf-unknown{background:#e2e8f0;color:var(--color-text-secondary)}
.buddhist-mark{position:absolute;top:2px;right:4px;font-size:0.55rem;color:var(--color-buddhist);font-weight:700}
.token-ambiguity{font-size:0.65rem;color:var(--color-accent);margin-top:0.2rem;text-align:left}
.sentence-type{margin-bottom:0.75rem;font-size:0.875rem;color:var(--color-text-secondary)}
.translation-block{padding:0.75rem 1rem;border-radius:var(--radius);margin-bottom:0.75rem}
.translation-block h4{font-size:0.8rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:0.4rem}
.translation-block p{font-size:0.95rem;line-height:1.7}
.translation-block.literal{background:var(--color-info-bg);border-left:3px solid var(--color-info)}
.translation-block.idiomatic{background:var(--color-success-bg);border-left:3px solid var(--color-success)}
.translation-block.revised{background:var(--color-accent-light);border-left:3px solid var(--color-accent)}
.grammar-points h4,.buddhist-notes h4,.other-notes h4{font-size:0.8rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:0.4rem;margin-top:0.75rem}
.grammar-points ul,.buddhist-notes ul,.other-notes ul{padding-left:1.25rem;font-size:0.85rem}
.grammar-points li,.buddhist-notes li,.other-notes li{margin-bottom:0.3rem}
.alignment-table{width:100%;border-collapse:collapse;font-size:0.85rem}
.alignment-table th{background:var(--color-bg);padding:0.5rem 0.6rem;text-align:left;font-weight:600;font-size:0.75rem;color:var(--color-text-secondary);border-bottom:2px solid var(--color-border)}
.alignment-table td{padding:0.5rem 0.6rem;border-bottom:1px solid var(--color-border);vertical-align:middle}
.align-source{font-family:var(--font-hanja);font-weight:600;color:var(--color-primary)}
.align-arrow{text-align:center;color:var(--color-text-secondary)}
.align-target{color:var(--color-text)}
.align-reason{color:var(--color-text-secondary);font-size:0.8rem}
.relation-badge{display:inline-block;padding:0.1rem 0.4rem;font-size:0.7rem;font-weight:600;border-radius:3px;background:#e2e8f0;color:#4a5568}
.relation-1-1{background:#c6f6d5;color:var(--color-success)}
.relation-1-N{background:#bee3f8;color:var(--color-info)}
.relation-N-1{background:#fefcbf;color:var(--color-warning)}
.component-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:0.75rem;margin-bottom:1rem}
.component-card{border:1px solid var(--color-border);border-radius:var(--radius);overflow:hidden}
.component-header{background:var(--color-bg);padding:0.4rem 0.75rem;font-size:0.75rem;font-weight:600;color:var(--color-primary)}
.component-body{padding:0.5rem 0.75rem;font-size:0.85rem;line-height:1.5}
.verification-issues h4,.final-notes h4{font-size:0.8rem;font-weight:600;color:var(--color-text-secondary);margin-bottom:0.4rem;margin-top:0.75rem}
.verification-issues ul,.final-notes ul{padding-left:1.25rem;font-size:0.85rem}
.verification-issues li{color:var(--color-accent);margin-bottom:0.2rem}
.vocab-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.75rem}
.vocab-card{border:1px solid var(--color-border);border-radius:var(--radius);padding:0.75rem;text-align:center;box-shadow:var(--shadow-sm);background:var(--color-surface)}
.vocab-card.vocab-buddhist{border-color:var(--color-buddhist);background:var(--color-buddhist-bg)}
.vocab-char{font-family:var(--font-hanja);font-size:1.8rem;font-weight:700;color:var(--color-text);margin-bottom:0.3rem}
.vocab-card.vocab-buddhist .vocab-char{color:var(--color-buddhist)}
.vocab-reading{font-size:0.8rem;color:var(--color-text-secondary);margin-bottom:0.3rem}
.vocab-gloss{font-size:0.8rem;color:var(--color-text);margin-bottom:0.3rem;font-weight:600}
.vocab-buddhist-meaning{font-size:0.7rem;color:var(--color-buddhist);line-height:1.4;margin-bottom:0.3rem}
.vocab-badge{display:inline-block;padding:0.15rem 0.5rem;font-size:0.6rem;font-weight:700;background:var(--color-buddhist);color:#fff;border-radius:3px}
.fallback-notice{background:var(--color-warning-bg);border:1px solid #f6e05e;border-left:4px solid var(--color-warning);border-radius:var(--radius);padding:1rem 1.25rem;margin-bottom:1.25rem;font-size:0.875rem}
.fallback-notice strong{color:var(--color-warning)}
.fallback-notice p{margin-top:0.5rem;color:var(--color-text-secondary)}
footer{text-align:center;padding:1.5rem 0;font-size:0.75rem;color:var(--color-text-secondary);border-top:1px solid var(--color-border);margin-top:2rem}
@media print{body{background:#fff}.section{box-shadow:none;break-inside:avoid}}
@media (max-width:768px){.container{padding:1rem}.component-grid{grid-template-columns:1fr}.vocab-grid{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>${t('r_html_title')}</h1>
    <p class="subtitle">${t('r_html_timestamp')}: ${escapeHtml(timestamp)}</p>
  </header>

  ${isFallback ? `<div class="fallback-notice"><strong>${t('r_html_fallback_title')}</strong><p>${t('r_html_fallback_msg')}</p></div>` : ''}

  <div class="section">
    <h3>${t('r_html_source_label')}</h3>
    <div class="original-text">${originalHtml}</div>
  </div>

  <div class="section">
    <h3>${t('result_original')}</h3>
    ${clausesHtml ? `<h4 style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:0.5rem">${t('r_clause_split')}</h4><div style="margin-bottom:1rem">${clausesHtml}</div>` : ''}
    ${tokensHtml ? `<h4 style="font-size:0.85rem;color:var(--color-text-secondary);margin-bottom:0.5rem">${t('r_token_analysis')}</h4><div class="token-grid">${tokensHtml}</div>` : ''}
  </div>

  <div class="section">
    <h3>${t('result_translated')}</h3>
    ${sentenceType ? `<div class="sentence-type"><strong>${t('r_sentence_type')}</strong> ${escapeHtml(sentenceType)}</div>` : ''}
    ${litTrans ? `<div class="translation-block literal"><h4>${t('r_literal')}</h4><p>${escapeHtml(litTrans)}</p></div>` : ''}
    ${idioTrans ? `<div class="translation-block idiomatic"><h4>${t('r_idiomatic')}</h4><p>${escapeHtml(idioTrans)}</p></div>` : ''}
    ${revLit ? `<div class="translation-block revised"><h4>${t('r_revised_literal')}</h4><p>${escapeHtml(revLit)}</p></div>` : ''}
    ${revIdio ? `<div class="translation-block revised"><h4>${t('r_revised_idiomatic')}</h4><p>${escapeHtml(revIdio)}</p></div>` : ''}
    ${grammarHtml ? `<div class="grammar-points"><h4>${t('r_grammar_points')}</h4><ul>${grammarHtml}</ul></div>` : ''}
    ${buddhistNotesHtml ? `<div class="buddhist-notes"><h4>${t('r_buddhist_notes')}</h4><ul>${buddhistNotesHtml}</ul></div>` : ''}
    ${otherNotesHtml ? `<div class="other-notes"><h4>${t('r_other_notes')}</h4><ul>${otherNotesHtml}</ul></div>` : ''}
  </div>

  ${alignRows ? `<div class="section">
    <h3>${t('result_alignment')}</h3>
    <table class="alignment-table">
      <thead><tr><th>${t('r_th_source')}</th><th></th><th>${t('r_th_target')}</th><th>${t('r_th_relation')}</th><th>${t('r_th_confidence')}</th><th>${t('r_th_reason')}</th></tr></thead>
      <tbody>${alignRows}</tbody>
    </table>
  </div>` : ''}

  ${compHtml ? `<div class="section">
    <h3>${t('result_explanation')}</h3>
    <div class="component-grid">${compHtml}</div>
    ${issuesHtml ? `<div class="verification-issues"><h4>${t('r_verification_result')}</h4><ul>${issuesHtml}</ul></div>` : ''}
    ${finalNotesHtml ? `<div class="final-notes"><h4>${t('r_final_notes')}</h4><ul>${finalNotesHtml}</ul></div>` : ''}
  </div>` : ''}

  ${vocabHtml ? `<div class="section">
    <h3>${t('result_vocabulary')}</h3>
    <div class="vocab-grid">${vocabHtml}</div>
  </div>` : ''}

  <footer>${t('footer')}</footer>
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html; charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  a.download = `TranslateDu_${ts}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 결과 영역 초기화.
 */
function clearResults() {
  const ids = [
    'original-structure',
    'translated-structure',
    'alignment-view',
    'explanation-view',
    'vocabulary-cards'
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  const notice = document.getElementById('fallback-notice');
  if (notice) notice.remove();

  const resultsSection = document.getElementById('results-section');
  if (resultsSection) resultsSection.style.display = 'none';
}
