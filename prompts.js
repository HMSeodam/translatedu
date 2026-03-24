/**
 * prompts.js
 * ──────────────────────────────────────────────
 * Gemini API에 전달할 시스템 프롬프트, 사용자 프롬프트 템플릿,
 * 검증 프롬프트 템플릿, 그리고 few-shot 예시를 상수로 관리한다.
 *
 * - 자유 서술형이 아닌 구조화된 JSON만 모델에게 요구
 * - 번역 전 분절과 문장구조 판정을 먼저 하도록 지시
 * - 불확실성은 ambiguity / confidence 필드에 반영하도록 지시
 */

// ───────── 1. SYSTEM_PROMPT ─────────
const SYSTEM_PROMPT = `너는 고전 한문 불교 문헌 전문 분석기다.
너의 임무는 입력된 한문 문장을 다음 순서대로 엄격하게 처리하는 것이다.

반드시 지킬 규칙:
1. 먼저 번역하지 말고, 먼저 분절과 문법 구조를 판정하라.
2. 원문에 없는 내용을 보충해서 번역하지 마라.
3. 불교 용어는 일반 한문 뜻과 교학적 뜻을 구분해서 검토하라.
4. 확실하지 않은 경우 단정하지 말고 ambiguity에 후보를 남겨라.
5. 설명문을 길게 쓰지 말고 지정된 JSON 스키마만 출력하라.
6. 출력 전 마지막으로 원문 누락, 과잉 의역, 문장성분 충돌 여부를 자체 점검하라.

현토(懸吐) 처리 규칙:
- 원문에 한글 토씨(현토)가 붙어 있을 수 있다. 예: "居卑而後에", "知登高之爲危하고"
- 현토는 조선·근대 학승이 한문 독해를 위해 붙인 한국어 조사·어미이다.
- 현토가 있으면 반드시 input_text에 그대로 보존하고 삭제하지 마라.
- 각 토큰의 surface에는 한자 부분만 넣되, 해당 토큰 뒤에 붙은 현토가 있다면 "hyeonto" 필드에 기록하라. 예: { "surface": "居卑", "hyeonto": "" }, { "surface": "而後", "hyeonto": "에" }
- 현토 정보는 문법 구조 판정의 보조 단서로 활용하되, 현토 자체를 번역하지 마라.
- 현토가 없는 순수 한문인 경우 hyeonto 필드는 빈 문자열("")로 두라.

분석 우선순위:
1. 절(句) 단위 분리
2. 어절 단위 분절
3. 불교 용어 후보 태깅
4. 허사와 연결어 기능 판정
5. 문장 전체 구조 판정
6. 직역 생성
7. 의역 생성
8. 원문-번역 대응 정렬
9. 자기검토 후 수정본 생성

한문 처리 원칙:
- 若, 則, 即, 故, 謂, 亦, 但, 乃, 皆, 并, 准, 以 등은 문장 논리상 기능을 우선 판정하라.
- 體, 德, 用, 性, 相, 理, 事 등은 불교 교학 용어 가능성을 우선 검토하라.
- 주석서 문체일 경우 "앞의 뜻에 준함", "예에 따라 포섭함" 같은 메타 지시 표현 가능성을 점검하라.
- 생략된 주어나 목적어를 함부로 확정하지 말고, 필요한 경우 omitted_elements에 후보로만 제시하라.

번역 원칙:
- literal_translation은 구조를 최대한 보존한 직역
- idiomatic_translation은 한국어로 자연스럽게 다듬은 의역
- 두 번역 모두 원문 정보를 누락하지 마라

최종 출력은 반드시 JSON만 반환하라.`;


// ───────── 2. USER_PROMPT_TEMPLATE ─────────
// {{INPUT_TEXT}} 와 {{GLOSSARY_HINTS}} 를 런타임에 치환
const USER_PROMPT_TEMPLATE = `다음 한문 불교 문헌 문장을 분석하라.

원문:
{{INPUT_TEXT}}

불교 용어 사전 후보:
{{GLOSSARY_HINTS}}

반드시 아래 JSON 스키마만 출력하라.

{
  "input_text": "",
  "segmentation": {
    "clauses": [],
    "tokens": [
      {
        "surface": "",
        "hyeonto": "",
        "char_gloss": [],
        "pos_candidates": [],
        "function_candidates": [],
        "is_buddhist_term": false,
        "term_id": null,
        "confidence": "high|medium|low",
        "ambiguity": []
      }
    ]
  },
  "parsing": {
    "sentence_type": "",
    "components": {
      "condition": "",
      "subject": "",
      "adverbial": [],
      "predicate": "",
      "object": [],
      "complement": [],
      "omitted_elements": [],
      "ambiguity": []
    },
    "literal_translation": "",
    "idiomatic_translation": "",
    "grammar_points": [],
    "buddhist_notes": []
  },
  "alignment": [
    {
      "source_span": "",
      "target_span": "",
      "relation": "1:1|1:N|N:1|omitted|expanded",
      "confidence": "high|medium|low",
      "reason": ""
    }
  ],
  "verification": {
    "issues_found": [],
    "revised_literal_translation": "",
    "revised_idiomatic_translation": "",
    "revised_components": {
      "condition": "",
      "subject": "",
      "adverbial": [],
      "predicate": "",
      "object": [],
      "complement": [],
      "omitted_elements": [],
      "ambiguity": []
    },
    "final_notes": []
  }
}

출력 조건:
- JSON 외의 다른 문장을 쓰지 말 것
- 번역보다 먼저 구조를 판정할 것
- 확실하지 않으면 ambiguity에 남길 것
- 직역과 의역을 모두 포함할 것
- 문장성분은 condition, subject, adverbial, predicate, object, complement 기준으로 분석할 것`;


// ───────── 3. VERIFICATION_PROMPT_TEMPLATE ─────────
// {{INPUT_TEXT}} 와 {{FIRST_PASS_JSON}} 을 런타임에 치환
const VERIFICATION_PROMPT_TEMPLATE = `너는 직전의 한문 불교 문장 분석 JSON을 검토하는 검증기다.

원문:
{{INPUT_TEXT}}

1차 분석 JSON:
{{FIRST_PASS_JSON}}

검토 항목:
- 원문 각 성분이 번역에서 누락되었는가
- 문장성분 분석이 서로 충돌하는가
- 불교 용어가 일반어로 잘못 처리되었는가
- alignment가 억지 정렬인가
- 직역과 의역이 서로 모순되는가

수정 규칙:
- 틀린 부분만 최소 수정
- 확실치 않으면 삭제하지 말고 confidence를 낮추거나 ambiguity에 남겨라
- 최종 출력은 수정된 JSON만 반환하라`;


// ───────── 4. FEW-SHOT EXAMPLES ─────────
// 모델에게 분석 품질 기준을 보여주기 위한 예시 3개
const FEW_SHOT_EXAMPLES = [
  // ── 예시 1 ──
  {
    input: '若依一乘此中即具十佛體德用。准以思攝。',
    expected: {
      input_text: '若依一乘此中即具十佛體德用。准以思攝。',
      segmentation: {
        clauses: ['若依一乘', '此中即具十佛體德用', '准以思攝'],
        tokens: [
          { surface: '若', char_gloss: ['만약'], pos_candidates: ['접속사'], function_candidates: ['조건'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '依', char_gloss: ['의거하다'], pos_candidates: ['동사', '전치사'], function_candidates: ['전치사-대상도입'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '一乘', char_gloss: ['하나의 수레'], pos_candidates: ['명사'], function_candidates: ['전치사 목적어'], is_buddhist_term: true, term_id: 'one_vehicle', confidence: 'high', ambiguity: [] },
          { surface: '此中', char_gloss: ['이 가운데'], pos_candidates: ['대명사+위치사'], function_candidates: ['부사어-범위'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '即', char_gloss: ['곧'], pos_candidates: ['부사'], function_candidates: ['강조/즉시'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '具', char_gloss: ['갖추다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '十佛', char_gloss: ['열 부처'], pos_candidates: ['명사'], function_candidates: ['목적어 수식'], is_buddhist_term: true, term_id: 'ten_buddhas', confidence: 'high', ambiguity: [] },
          { surface: '體', char_gloss: ['본체'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'ti_essence', confidence: 'high', ambiguity: [] },
          { surface: '德', char_gloss: ['공덕'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'virtue', confidence: 'high', ambiguity: [] },
          { surface: '用', char_gloss: ['작용'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'function', confidence: 'high', ambiguity: [] },
          { surface: '准', char_gloss: ['준하다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '以', char_gloss: ['~으로써'], pos_candidates: ['전치사', '접속사'], function_candidates: ['수단/방법'], is_buddhist_term: false, term_id: null, confidence: 'medium', ambiguity: ['접속사 가능'] },
          { surface: '思', char_gloss: ['생각하다'], pos_candidates: ['동사'], function_candidates: ['부사어적 동사'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '攝', char_gloss: ['포섭하다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
        ]
      },
      parsing: {
        sentence_type: '조건문 + 진술문 + 메타지시문',
        components: {
          condition: '若依一乘 (만약 일승에 의거하면)',
          subject: '此中 (이 가운데) — 주어 겸 범위 부사어',
          adverbial: ['即 (곧)'],
          predicate: '具 (갖추다)',
          object: ['十佛體德用 (십불의 체·덕·용)'],
          complement: [],
          omitted_elements: ['准以思攝의 주어: 독자/수행자(생략)'],
          ambiguity: ['此中은 주어보다 범위 부사어에 가까울 수 있음']
        },
        literal_translation: '만약 일승에 의거하면, 이 가운데 곧 십불의 체·덕·용을 갖춘다. 앞의 예에 준하여 생각해 포섭하라.',
        idiomatic_translation: '일승의 관점에서 보면, 여기에는 곧 십불의 본체와 공덕과 작용이 모두 갖추어져 있으니, 앞서 설명한 방식에 따라 헤아려 정리해 이해하면 된다.',
        grammar_points: [
          '若…即… 구문: 조건-결과를 나타내는 고전 한문의 전형적 구조',
          '准以思攝: 주석서에서 흔히 보이는 메타 지시 표현'
        ],
        buddhist_notes: [
          '一乘(일승): 화엄·법화에서 모든 중생을 성불로 이끄는 유일한 가르침',
          '十佛: 화엄경의 열 가지 불(佛) 양상',
          '體德用: 존재를 본체·공덕·작용으로 분석하는 삼분 체계'
        ]
      },
      alignment: [
        { source_span: '若依一乘', target_span: '만약 일승에 의거하면', relation: '1:1', confidence: 'high', reason: '조건절 직역' },
        { source_span: '此中', target_span: '이 가운데', relation: '1:1', confidence: 'high', reason: '범위 부사어' },
        { source_span: '即具', target_span: '곧 갖춘다', relation: '1:1', confidence: 'high', reason: '서술어' },
        { source_span: '十佛體德用', target_span: '십불의 체·덕·용을', relation: '1:N', confidence: 'high', reason: '목적어 확장' },
        { source_span: '准以思攝', target_span: '앞의 예에 준하여 생각해 포섭하라', relation: '1:N', confidence: 'high', reason: '메타 지시문 풀어쓰기' }
      ],
      verification: {
        issues_found: [],
        revised_literal_translation: '',
        revised_idiomatic_translation: '',
        revised_components: {
          condition: '',
          subject: '',
          adverbial: [],
          predicate: '',
          object: [],
          complement: [],
          omitted_elements: [],
          ambiguity: []
        },
        final_notes: ['1차 분석에서 누락 또는 오류 없음']
      }
    }
  },

  // ── 예시 2 ──
  {
    input: '以一攝多多即一。',
    expected: {
      input_text: '以一攝多多即一。',
      segmentation: {
        clauses: ['以一攝多', '多即一'],
        tokens: [
          { surface: '以', char_gloss: ['~으로써'], pos_candidates: ['전치사'], function_candidates: ['수단/도구'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '一', char_gloss: ['하나'], pos_candidates: ['수사/명사'], function_candidates: ['전치사 목적어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '攝', char_gloss: ['포섭하다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '多', char_gloss: ['많은 것'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '多', char_gloss: ['많은 것'], pos_candidates: ['명사'], function_candidates: ['주어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '即', char_gloss: ['곧'], pos_candidates: ['부사/판단사'], function_candidates: ['판단/등치'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '一', char_gloss: ['하나'], pos_candidates: ['수사/명사'], function_candidates: ['술어 보어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
        ]
      },
      parsing: {
        sentence_type: '진술문(병렬 구조)',
        components: {
          condition: '',
          subject: '一 (하나) / 多 (많은 것)',
          adverbial: ['以一 (하나로써)'],
          predicate: '攝 (포섭하다) / 即 (곧 ~이다)',
          object: ['多 (많은 것)'],
          complement: ['一 (하나)'],
          omitted_elements: [],
          ambiguity: []
        },
        literal_translation: '하나로써 많은 것을 포섭하니, 많은 것이 곧 하나이다.',
        idiomatic_translation: '하나가 많은 것을 거두어들이며, 그렇게 포섭된 많은 것은 결국 하나와 다르지 않다.',
        grammar_points: [
          '以A攝B: A로써 B를 포섭하는 도구/수단 구문',
          'A即B: A가 곧 B이다 — 화엄 특유의 등치/상즉(相即) 표현'
        ],
        buddhist_notes: [
          '일즉다(一即多)·다즉일(多即一): 화엄 법계연기의 핵심 명제',
          '攝(섭): 포섭. 화엄에서 상입(相入)·상즉(相即)의 관계를 나타낼 때 핵심 동사'
        ]
      },
      alignment: [
        { source_span: '以一', target_span: '하나로써', relation: '1:1', confidence: 'high', reason: '수단 구문' },
        { source_span: '攝多', target_span: '많은 것을 포섭하니', relation: '1:N', confidence: 'high', reason: '서술어+목적어 확장' },
        { source_span: '多即一', target_span: '많은 것이 곧 하나이다', relation: '1:N', confidence: 'high', reason: '판단문 확장' }
      ],
      verification: {
        issues_found: [],
        revised_literal_translation: '',
        revised_idiomatic_translation: '',
        revised_components: {
          condition: '',
          subject: '',
          adverbial: [],
          predicate: '',
          object: [],
          complement: [],
          omitted_elements: [],
          ambiguity: []
        },
        final_notes: ['1차 분석 결과 문제 없음']
      }
    }
  },

  // ── 예시 3 ──
  {
    input: '真如不守自性隨緣成萬法。',
    expected: {
      input_text: '真如不守自性隨緣成萬法。',
      segmentation: {
        clauses: ['真如不守自性', '隨緣成萬法'],
        tokens: [
          { surface: '真如', char_gloss: ['참다운 그러함'], pos_candidates: ['명사'], function_candidates: ['주어'], is_buddhist_term: true, term_id: 'tathata', confidence: 'high', ambiguity: [] },
          { surface: '不', char_gloss: ['아니'], pos_candidates: ['부정부사'], function_candidates: ['부정'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '守', char_gloss: ['지키다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '自性', char_gloss: ['자기 성품'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'svabhava', confidence: 'high', ambiguity: [] },
          { surface: '隨', char_gloss: ['따르다'], pos_candidates: ['동사'], function_candidates: ['부사어적 동사'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '緣', char_gloss: ['인연, 조건'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'pratyaya', confidence: 'high', ambiguity: [] },
          { surface: '成', char_gloss: ['이루다'], pos_candidates: ['동사'], function_candidates: ['서술어'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
          { surface: '萬法', char_gloss: ['온갖 법'], pos_candidates: ['명사'], function_candidates: ['목적어'], is_buddhist_term: true, term_id: 'all_dharmas', confidence: 'high', ambiguity: [] }
        ]
      },
      parsing: {
        sentence_type: '진술문(연쇄 서술)',
        components: {
          condition: '',
          subject: '真如 (진여)',
          adverbial: ['隨緣 (인연을 따라)'],
          predicate: '不守 (지키지 않다) → 成 (이루다)',
          object: ['自性 (자기 성품)', '萬法 (만법)'],
          complement: [],
          omitted_elements: [],
          ambiguity: ['隨緣을 부사어로 볼지 별도 서술부로 볼지 해석 여지 있음']
        },
        literal_translation: '진여는 자기 성품에 머물지 않고, 인연을 따라 만법을 이룬다.',
        idiomatic_translation: '진여는 고정된 자성에 갇혀 있지 않으며, 인연에 따라 온갖 현상으로 전개된다.',
        grammar_points: [
          '不守自性: 부정부사+동사+목적어 구조',
          '隨緣成萬法: 연쇄 동사 구조 — 緣을 따라(隨) 萬法을 이룸(成)'
        ],
        buddhist_notes: [
          '真如(진여): 궁극적 실재. 대승기신론의 핵심 개념',
          '不守自性: 진여가 고정 불변이 아니라 역동적임을 나타냄',
          '隨緣(수연): 진여수연(眞如隨緣) — 진여가 인연에 따라 현상으로 전개되는 원리',
          '萬法(만법): 모든 존재·현상의 총칭'
        ]
      },
      alignment: [
        { source_span: '真如', target_span: '진여는', relation: '1:1', confidence: 'high', reason: '주어' },
        { source_span: '不守自性', target_span: '자기 성품에 머물지 않고', relation: '1:N', confidence: 'high', reason: '서술부 확장' },
        { source_span: '隨緣', target_span: '인연을 따라', relation: '1:N', confidence: 'high', reason: '부사어 확장' },
        { source_span: '成萬法', target_span: '만법을 이룬다', relation: '1:N', confidence: 'high', reason: '서술어+목적어' }
      ],
      verification: {
        issues_found: [],
        revised_literal_translation: '',
        revised_idiomatic_translation: '',
        revised_components: {
          condition: '',
          subject: '',
          adverbial: [],
          predicate: '',
          object: [],
          complement: [],
          omitted_elements: [],
          ambiguity: []
        },
        final_notes: ['隨緣의 문장성분 분류에 대해 ambiguity 표기 완료']
      }
    }
  }
];

/**
 * few-shot 예시를 프롬프트 문자열로 변환.
 * 모델에게 분석 품질 기준을 보여주기 위해 user prompt 뒤에 첨부한다.
 */
function buildFewShotString() {
  let result = '\n\n참고 예시 (분석 품질 기준):\n';
  FEW_SHOT_EXAMPLES.forEach((ex, i) => {
    result += `\n--- 예시 ${i + 1} ---\n`;
    result += `입력: ${ex.input}\n`;
    result += `기대 출력:\n${JSON.stringify(ex.expected, null, 2)}\n`;
  });
  return result;
}
