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

// ───────── 0. 출력 언어별 설정 ─────────

const OUTPUT_LANG_CONFIG = {
  ko: {
    label: '한국어',
    systemSuffix: '',
    translationInstruction: `번역 원칙:
- literal_translation은 구조를 최대한 보존한 직역
- idiomatic_translation은 한국어로 자연스럽게 다듬은 의역
- 두 번역 모두 원문 정보를 누락하지 마라`,
    schemaTranslationFields: `    "literal_translation": "",
    "idiomatic_translation": "",`,
    outputCondition: `- 직역과 의역을 모두 포함할 것`,
    fewShotLiteral: '만약 일승에 의거하면, 이 가운데 곧 십불의 체·덕·용을 갖춘다. 앞의 예에 준하여 생각해 포섭하라.',
    fewShotIdiomatic: '일승의 관점에서 보면, 여기에는 곧 십불의 본체와 공덕과 작용이 모두 갖추어져 있으니, 앞서 설명한 방식에 따라 헤아려 정리해 이해하면 된다.',
  },
  en: {
    label: 'English',
    systemSuffix: `\n\nIMPORTANT: ALL human-readable text in the JSON output must be in English. This includes:
- char_gloss (character glosses): in English, e.g. ["if", "conditional"]
- pos_candidates (POS tags): in English, e.g. ["conjunction", "verb", "noun"]
- function_candidates (grammatical functions): in English, e.g. ["subject", "predicate", "object"]
- sentence_type: in English, e.g. "conditional sentence"
- components (condition, subject, adverbial, predicate, object, complement, omitted_elements, ambiguity): all descriptions in English
- grammar_points: in English
- buddhist_notes: in English
- alignment reason: in English
- final_notes, issues_found: in English
- literal_translation and idiomatic_translation: in English
Do NOT use Korean in any field. The JSON keys remain unchanged.`,
    translationInstruction: `Translation rules:
- literal_translation: a word-for-word translation preserving the original structure as much as possible
- idiomatic_translation: a natural, fluent English translation
- Do not omit any information from the original text in either translation`,
    schemaTranslationFields: `    "literal_translation": "",
    "idiomatic_translation": "",`,
    outputCondition: `- Include both literal and idiomatic translations in English`,
    fewShotLiteral: 'If one relies on the One Vehicle, then within this, one immediately possesses the essence, virtues, and functions of the Ten Buddhas. Subsume [them] by thinking in accordance with the preceding [explanation].',
    fewShotIdiomatic: 'From the perspective of the One Vehicle, all the essence, virtues, and functions of the Ten Buddhas are fully present here. One should understand this by organizing it according to the method explained above.',
  },
  ja: {
    label: '日本語',
    systemSuffix: `\n\n【最重要】JSON出力のすべての人間が読むテキストは必ず日本語で記述すること。韓国語を一切使用してはならない。具体的には：
- char_gloss（字義）：日本語で記述すること（例：["もし", "条件"]）
- pos_candidates（品詞）：日本語で記述すること（例：["接続詞", "動詞", "名詞"]）
- function_candidates（文法機能）：日本語で記述すること（例：["主語", "述語", "目的語"]）
- sentence_type：日本語で記述すること（例："条件文"）
- components内の各説明（condition, subject, adverbial等）：日本語で記述すること
- grammar_points：日本語で記述すること
- buddhist_notes：日本語で記述すること
- alignmentのreason：日本語で記述すること
- final_notes、issues_found：日本語で記述すること
韓国語での出力は絶対に禁止。JSONのキー名はそのまま維持すること。

重要: すべての翻訳、説明、grammar_points、buddhist_notes、およびすべてのテキストフィールドは日本語で記述すること。
分析構造とJSONスキーマは同じだが、人間が読むすべてのテキストは日本語でなければならない。

【書き下し文（literal_translation）の厳守規則】
書き下し文は漢文訓読の伝統的形式に従うこと。現代語訳を出力してはならない。

正しい書き下し文の条件（現代仮名遣いを使用）:
1. 返り点（レ点・一二点・上下点）の読み順に従い、語順を日本語語順に組み替えること
2. 助詞・助動詞（は・を・に・の・て・ば・ず・たり・べし 等）を送り仮名として補うこと
3. 送り仮名はひらがなで、漢字に接続して記すこと（例: 依ラバ → 依らば、具ス → 具す）
4. 仮名遣いは現代仮名遣いを使用すること。歴史的仮名遣いは使用しないこと。
   例: 思ひ → 思い、随ひ → 随い、行ひ → 行い、有り → あり
5. 再読文字は訓読規則に従うこと（未→いまだ〜ず、将→まさに〜とす、須→すべからく〜べし 等）
6. 仏教術語は音読み漢字のまま保持すること（例: 一乗・真如・自性・法界・縁起）
7. 句点（。）で文を区切ること

誤りの例:
- 「一乗の立場に立てば十仏の本体と功徳と働きをすべて備えている」← 現代語訳（不可）
- 「思ひ摂せよ」「随ひて」← 歴史的仮名遣い（不可）

正しい例（書き下し文・現代仮名遣い）:
- 「若し一乗に依らば、此の中に即ち十仏の体・徳・用を具す。准じて以て思い摂せよ。」
- 「真如は自性を守らず、縁に随いて万法を成ず。」

idiomatic_translation（現代語訳）は自然な現代日本語で出力すること。
仏教用語は日本語の仏教学で一般的に使用される術語を使うこと。`,
    translationInstruction: `翻訳原則:
- literal_translation は書き下し文（漢文訓読体）で出力すること
- idiomatic_translation は現代日本語による自然な翻訳
- いずれの翻訳でも原文の情報を省略しないこと`,
    schemaTranslationFields: `    "literal_translation": "(書き下し文)",
    "idiomatic_translation": "(現代語訳)",`,
    outputCondition: `- 書き下し文（literal_translation）と現代語訳（idiomatic_translation）の両方を含めること`,
    fewShotLiteral: '若し一乗に依らば、此の中に即ち十仏の体・徳・用を具す。准じて以て思い摂せよ。',
    fewShotIdiomatic: '一乗の立場に依拠すれば、ここにはすなわち十仏の本体・功徳・作用がすべて備わっている。前述の方法に準じて考え、整理して理解すればよい。',
  },
  'zh-CN': {
    label: '中文简体',
    systemSuffix: `\n\n【最重要】JSON输出中所有人类可读的文本必须使用简体中文书写，绝对不能使用韩语。具体包括：
- char_gloss（字义）：用简体中文（例：["如果", "条件"]）
- pos_candidates（词性）：用简体中文（例：["连词", "动词", "名词"]）
- function_candidates（语法功能）：用简体中文（例：["主语", "谓语", "宾语"]）
- sentence_type：用简体中文（例："条件句"）
- components内各项说明：用简体中文
- grammar_points：用简体中文
- buddhist_notes：用简体中文
- alignment的reason：用简体中文
- final_notes、issues_found：用简体中文
JSON键名保持不变。

重要：所有翻译、说明、grammar_points、buddhist_notes以及所有文本字段必须使用简体中文书写。
分析结构和JSON格式保持不变，但所有人类可读的内容必须使用简体中文。

中文翻译特别规则：
- literal_translation（直译）：尽可能保留原文的句法结构，逐字逐句地翻译为现代汉语。
- idiomatic_translation（意译）：用通顺自然的现代汉语表达原文含义。
- 佛教术语应使用中国佛教学界通用的术语。`,
    translationInstruction: `翻译原则：
- literal_translation 是尽量保留原文结构的逐字直译
- idiomatic_translation 是通顺自然的现代汉语意译
- 两种翻译都不得遗漏原文信息`,
    schemaTranslationFields: `    "literal_translation": "(逐字直译)",
    "idiomatic_translation": "(现代汉语意译)",`,
    outputCondition: `- 必须同时包含直译（literal_translation）和意译（idiomatic_translation），使用简体中文`,
    fewShotLiteral: '若依一乘，此中即具十佛之体、德、用。准以思摄。',
    fewShotIdiomatic: '如果依据一乘的立场来看，这其中便已具足十佛的本体、功德与作用。可以按照前面的方法来思考和归纳理解。',
  },
  'zh-TW': {
    label: '中文繁體',
    systemSuffix: `\n\n【最重要】JSON輸出中所有人類可讀的文字必須使用繁體中文書寫，絕對不能使用韓語。具體包括：
- char_gloss（字義）：用繁體中文（例：["如果", "條件"]）
- pos_candidates（詞性）：用繁體中文（例：["連詞", "動詞", "名詞"]）
- function_candidates（語法功能）：用繁體中文（例：["主語", "謂語", "賓語"]）
- sentence_type：用繁體中文（例："條件句"）
- components內各項說明：用繁體中文
- grammar_points：用繁體中文
- buddhist_notes：用繁體中文
- alignment的reason：用繁體中文
- final_notes、issues_found：用繁體中文
JSON鍵名保持不變。

重要：所有翻譯、說明、grammar_points、buddhist_notes以及所有文本欄位必須使用繁體中文書寫。
分析結構和JSON格式保持不變，但所有人類可讀的內容必須使用繁體中文。

中文翻譯特別規則：
- literal_translation（直譯）：盡可能保留原文的句法結構，逐字逐句地翻譯為現代漢語。
- idiomatic_translation（意譯）：用通順自然的現代漢語表達原文含義。
- 佛教術語應使用漢傳佛教學界通用的術語。`,
    translationInstruction: `翻譯原則（臺灣學術慣例）：
- literal_translation 是盡量保留原文結構的逐字直譯，使用臺灣佛學界通行術語。
  ① 術語選擇遵循臺灣佛學學術慣例，例：「緣起」不作「缘起」、「般若」不作「智慧」
  ② 語序盡量貼近漢文原文，以「於…中」「以…故」等文言句式為優先
  ③ 動詞選用文言色彩較重的詞彙，例：「具足」「攝受」「隨順」
- idiomatic_translation 是通順自然的現代漢語意譯，符合臺灣讀者閱讀習慣
- 兩種翻譯都不得遺漏原文資訊`,
    schemaTranslationFields: `    "literal_translation": "(逐字直譯)",
    "idiomatic_translation": "(現代漢語意譯)",`,
    outputCondition: `- 必須同時包含直譯（literal_translation）和意譯（idiomatic_translation），使用繁體中文`,
    fewShotLiteral: '若依一乘，此中即具足十佛之體、德、用。准以思攝受。',
    fewShotIdiomatic: '若依據一乘的立場來看，此中便已具足十佛的本體、功德與作用。可依照前述方法加以思惟攝受，以資理解。',
  }
};

/**
 * 현재 선택된 출력 언어를 반환.
 * @returns {string} 'ko' | 'en' | 'ja'
 */
function getSelectedOutputLang() {
  const select = document.getElementById('output-lang-select');
  return select ? select.value : 'ko';
}


// ───────── 1. SYSTEM_PROMPT (구 상수 → SYSTEM_PROMPTS 객체로 이전 완료) ─────────
// 구 SYSTEM_PROMPT 상수는 삭제됨. 아래 SYSTEM_PROMPTS 객체에서 언어별 완전 독립 프롬프트를 사용.
// buildSystemPrompt(lang) 함수로 접근.


// ───────── 2. USER_PROMPT_TEMPLATE (언어별 동적 생성) ─────────

const USER_PROMPT_TEMPLATES = {
  ko: (inputText, glossaryHints, outputCondition, schemaFields) => `다음 한문 불교 문헌 문장을 분석하라.

원문:
${inputText}

불교 용어 사전 후보:
${glossaryHints}

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
${schemaFields}
    "grammar_points": [],
    "buddhist_notes": [],
    "other_notes": []
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
${outputCondition}
- 문장성분은 condition, subject, adverbial, predicate, object, complement 기준으로 분석할 것
- buddhist_notes는 입력 문장을 이해하는 데 직접 필요한 범위 안에서 해당 용어의 교학적 의미를 간결하게 풀이할 것. 백과사전식 나열(관련 인물·저술·지명 목록 등) 금지. **산스크리트어·팔리어 로마나이즈(IAST 등) 병기 절대 금지**
- other_notes는 입력 문장 이해에 필요한 범위 안에서 불교 교학 이외의 항목(지명·인물·왕조·시기 등 역사적·지리적 정보)을 간결하게 설명할 것. 해당 항목이 없으면 빈 배열([])로 둘 것`,

  en: (inputText, glossaryHints, outputCondition, schemaFields) => `Analyze the following classical Chinese Buddhist text.

Source text:
${inputText}

Buddhist terminology candidates (Korean reading guides — generate all explanations in English):
${glossaryHints}

Output only the following JSON schema.

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
${schemaFields}
    "grammar_points": [],
    "buddhist_notes": [],
    "other_notes": []
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

Output conditions:
- Output only JSON, no other text
- Determine structure before translating
- Leave uncertain items in ambiguity
${outputCondition}
- Analyze sentence components using: condition, subject, adverbial, predicate, object, complement
- buddhist_notes should briefly explain the doctrinal meaning of each term only to the extent needed to understand the input sentence. Avoid encyclopedic lists (figures, works, place names, etc.). Sanskrit romanization (IAST etc.) is permitted sparingly for key terms
- other_notes should briefly explain non-doctrinal items (place names, historical figures, dynasties, periods, etc.) only to the extent needed to understand the input sentence. Leave as an empty array ([]) if there are no such items`,

  ja: (inputText, glossaryHints, outputCondition, schemaFields) => `以下の漢文仏教文献を分析せよ。

原文:
${inputText}

仏教用語辞典候補（韓国語読みの参考のみ — すべての説明は日本語で生成すること）：
${glossaryHints}

以下のJSONスキーマのみを出力せよ。

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
${schemaFields}
    "grammar_points": [],
    "buddhist_notes": [],
    "other_notes": []
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

書き下し文（literal_translation）の必須規則:
- 漢文訓読体（書き下し文）で出力すること。現代語に翻訳しないこと。
- 返り点（レ点・一二点・上下点）の読み順に従って語順を組み替えること。
- 助詞・助動詞（は・を・に・の・て・ば・ず・り・たり 等）を補うこと。
- 送り仮名はひらがなで付けること（例: 依ラバ、具ス、守ラ）。
- 仏教術語は日本漢字音読みで保持すること（例: 一乗、真如、自性）。
- 誤り例: 「一乗に依れば…十仏の体徳用を具える」→ 現代語訳のため不可。
- 正しい例: 「若し一乗に依らば、此の中に即ち十仏の体・徳・用を具す」

出力条件:
- JSON以外のテキストを出力しないこと
- 翻訳より先に構造を判定すること
- 不確かな場合はambiguityに残すこと
${outputCondition}
- 文の成分はcondition、subject、adverbial、predicate、object、complementで分析すること
- buddhist_notesは、入力文を理解するために直接必要な範囲で、各用語の教学的意味を簡潔に説明すること。人名・著作・地名等の百科事典的な列挙は禁止。**サンスクリット語・パーリ語のローマナイズ（IAST等）表記は絶対禁止**
- other_notesは、入力文を理解するために必要な範囲で、仏教教学以外の項目（地名・人物・王朝・時代等の歴史的・地理的情報）を簡潔に説明すること。該当項目がない場合は空の配列（[]）にすること`,

  'zh-CN': (inputText, glossaryHints, outputCondition, schemaFields) => `分析以下汉文佛教文献。

原文：
${inputText}

佛教术语词典候选（韩语读音参考 — 所有说明须用简体中文生成）：
${glossaryHints}

必须只输出以下JSON格式。

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
${schemaFields}
    "grammar_points": [],
    "buddhist_notes": [],
    "other_notes": []
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

输出条件：
- 只输出JSON，不得有其他文字
- 先判定结构，再翻译
- 不确定的内容留在ambiguity中
${outputCondition}
- 使用condition、subject、adverbial、predicate、object、complement分析句子成分
- buddhist_notes须在理解原文所必要的范围内，简洁说明各术语的教学含义。禁止百科全书式列举（人名、著作、地名等）。**梵语·巴利语罗马字转写（IAST等）一律禁止**
- other_notes须在理解原文所必要的范围内，简洁说明佛教教学以外的项目（地名、人物、王朝、时期等历史地理信息）。若无相关项目，留空数组（[]）即可`,

  'zh-TW': (inputText, glossaryHints, outputCondition, schemaFields) => `分析以下漢文佛教文獻。

原文：
${inputText}

佛教術語詞典候選（韓語讀音參考 — 所有說明須用繁體中文生成）：
${glossaryHints}

必須只輸出以下JSON格式。

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
${schemaFields}
    "grammar_points": [],
    "buddhist_notes": [],
    "other_notes": []
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

輸出條件：
- 只輸出JSON，不得有其他文字
- 先判定結構，再翻譯
- 不確定的內容留在ambiguity中
${outputCondition}
- 使用condition、subject、adverbial、predicate、object、complement分析句子成分
- buddhist_notes須在理解原文所必要的範圍內，簡潔說明各術語的教學含義。禁止百科全書式列舉（人名、著作、地名等）。**梵語·巴利語羅馬字轉寫（IAST等）一律禁止**
- other_notes須在理解原文所必要的範圍內，簡潔說明佛教教學以外的項目（地名、人物、王朝、時期等歷史地理資訊）。若無相關項目，留空陣列（[]）即可`,
};

// 하위 호환: USER_PROMPT_TEMPLATE (한국어 기본)
const USER_PROMPT_TEMPLATE = USER_PROMPT_TEMPLATES.ko('{{INPUT_TEXT}}', '{{GLOSSARY_HINTS}}',
  '- 직역과 의역을 모두 포함할 것',
  '    "literal_translation": "",\n    "idiomatic_translation": "",');

// buildUserPrompt()는 parser.js에서 정의 (few-shot 예시 포함 버전)


// ───────── 3. VERIFICATION_PROMPT_TEMPLATE (언어별 동적 생성) ─────────

const VERIFICATION_PROMPT_TEMPLATES = {

  ko: (inputText, firstPassJson) => `너는 한문 불교 문장 분석 JSON을 정밀 검증하는 전문 검증기다.

원문:
${inputText}

1차 분석 JSON:
${firstPassJson}

【검증 항목 — 모두 점검할 것】

1. 원문 완전성
   - 원문의 모든 글자(한자)가 token으로 분절되었는가
   - 원문의 모든 절(句)이 clauses에 포함되었는가
   - 번역(직역·의역)에서 원문 성분이 누락되지 않았는가
   - alignment에서 원문의 모든 span이 커버되는가

2. 문장성분 정합성
   - condition/subject/predicate/object/complement가 서로 충돌하지 않는가
   - 동일 어구가 두 개 이상의 성분으로 중복 분류되지 않았는가
   - 문장 유형(sentence_type)이 실제 성분 구조와 일치하는가

3. 불교 용어 정확성
   - 교학 용어(體·德·用·性·相·理·事·一乘·真如·法界 등)가 일반어로 처리되지 않았는가
   - is_buddhist_term=true인 용어의 term_id가 적절한가
   - buddhist_notes가 해당 용어의 의미를 입력 문장 맥락에서 간결하게 설명하는가
   - 백과사전식 나열(인물·저술·지명 목록)이 포함되어 있으면 삭제하고 문장 이해에 필요한 핵심만 남길 것
   - 산스크리트어·팔리어 로마나이즈(Skt. …, Pāli …, IAST 등)가 포함되어 있으면 즉시 삭제할 것
   - other_notes에 지명·인물·왕조·시기 등 역사적·지리적 항목이 누락되지 않았는가. buddhist_notes에 섞여 있으면 other_notes로 이동할 것
   - 단순 사전적 풀이만 제시하고 원문 문맥에서의 역할 설명이 누락되지 않았는가
   - 고유명사(인물·지명)에 대한 해설이 충실한가

4. 번역 품질
   - literal_translation이 원문 구조를 충실히 반영하는가
   - idiomatic_translation이 자연스러운 한국어인가
   - 두 번역이 서로 모순되지 않는가
   - 과잉 의역(원문에 없는 내용 추가) 여부

5. confidence·ambiguity 타당성
   - 실제로 불확실한 항목에 적절히 ambiguity가 표시되었는가
   - confidence 수준이 분석의 실제 확실성과 일치하는가

6. token.surface 필드 검증
   - surface에 한자 이외의 문자(한글·영어 등)가 混入되지 않았는가
   - 이상 발견 시 반드시 수정하라

수정 규칙:
- 오류가 있는 부분만 최소한으로 수정
- 확실하지 않으면 삭제하지 말고 confidence를 낮추거나 ambiguity에 추가
- revised_literal_translation / revised_idiomatic_translation에 수정된 번역을 반드시 기재
- issues_found에 발견한 문제를 구체적으로 기술
- final_notes에 종합 평가 및 주요 수정 사항 요약
- 수정된 JSON만 반환하라`,

  en: (inputText, firstPassJson) => `You are a precision verifier for classical Chinese Buddhist text analysis JSON.

Source text:
${inputText}

First-pass analysis JSON:
${firstPassJson}

【Verification checklist — check ALL items】

1. Source completeness
   - Are all characters in the source text tokenized?
   - Are all clauses (句) included in the clauses array?
   - Does each translation (literal & idiomatic) cover all source elements without omission?
   - Does the alignment cover all source spans?

2. Sentence component consistency
   - Do condition/subject/predicate/object/complement avoid mutual conflicts?
   - Is any phrase double-assigned to more than one component?
   - Does sentence_type match the actual component structure?

3. Buddhist terminology accuracy
   - Were doctrinal terms (體·德·用·性·相·理·事·一乘·真如·法界 etc.) correctly identified and NOT treated as ordinary words?
   - Are term_id values appropriate for is_buddhist_term=true tokens?
   - Do buddhist_notes briefly explain each term's meaning within the context of the input sentence only?
   - Remove any encyclopedic lists (figures, works, place names) — keep only what is needed to understand the sentence.
   - Check that other_notes covers historical/geographical items (place names, figures, dynasties, periods) relevant to understanding the sentence. Move any such items out of buddhist_notes into other_notes if misplaced.
   - Are the notes more than simple dictionary definitions — do they explain each term's specific role in the context of the source text?
   - Are proper nouns (persons, places) annotated with sufficient historical detail?

4. Translation quality
   - Does literal_translation faithfully preserve source structure?
   - Is idiomatic_translation natural, fluent English?
   - Are the two translations free of mutual contradiction?
   - Is there over-translation (content added not present in source)?

5. Confidence & ambiguity validity
   - Are genuinely uncertain items marked in ambiguity?
   - Do confidence levels reflect the actual certainty of analysis?

6. token.surface field verification
   - Does surface contain ONLY original Chinese characters (漢字)?
   - If non-Chinese text found in surface, correct it immediately.

ALL verification output text (issues_found, final_notes, reason fields) must be in English. No Korean.

Correction rules:
- Make only minimal corrections to identified errors
- If uncertain, lower confidence or add to ambiguity — do not delete
- Record corrected translations in revised_literal_translation / revised_idiomatic_translation
- Describe each problem specifically in issues_found
- Summarize key corrections in final_notes
- Return ONLY the corrected JSON`,

  ja: (inputText, firstPassJson) => `あなたは漢文仏教文献の分析JSONを精密検証する専門検証器です。

原文:
${inputText}

第1段階分析JSON:
${firstPassJson}

【検証項目 — 全項目を点検すること】

1. 原文の完全性
   - 原文のすべての漢字がtokenとして分節されているか
   - 原文のすべての句（節）がclausesに含まれているか
   - 翻訳（書き下し文・現代語訳）で原文成分が脱落していないか
   - alignmentで原文のすべてのspanがカバーされているか

2. 文成分の整合性
   - condition/subject/predicate/object/complementが互いに矛盾していないか
   - 同一語句が複数の成分に重複分類されていないか
   - sentence_typeが実際の成分構造と一致しているか

3. 仏教用語の正確性
   - 教学用語（體・德・用・性・相・理・事・一乗・真如・法界等）が一般語として処理されていないか
   - is_buddhist_term=trueのトークンのterm_idが適切か
   - buddhist_notesが入力文の理解に必要な範囲で各用語の意味を簡潔に説明しているか
   - 百科事典的な列挙（人名・著作・地名等）が含まれていれば削除し、文意把握に必要な核心のみ残すこと
   - サンスクリット語・パーリ語のローマナイズ（Skt. …、Pāli …、IAST等）が含まれていれば即時削除すること
   - other_notesに地名・人物・王朝・時代等の歴史的・地理的項目が漏れていないか確認すること。buddhist_notesに混在している場合はother_notesへ移動すること
   - 単なる辞書的語義ではなく、原文の文脈における具体的役割が説明されているか
   - 固有名詞（人物・地名）に対する解説が十分か

4. 書き下し文の検証（最重要）
   - literal_translationが漢文訓読体（書き下し文）になっているか。現代語訳になっていたら必ず修正すること。
   - 返り点の読み順に従い、語順が日本語語順に組み替えられているか
   - 助詞・助動詞（は・を・に・の・て・ば・ず・り・たり・べし等）が送り仮名として補われているか
   - 仏教術語が漢字音読みのまま保持されているか（一乗・真如・自性等）
   - 誤り例：「一乗の立場に立てば…」（現代語訳）→ 「若し一乗に依らば…」（書き下し文）に修正すること

5. 現代語訳の品質
   - idiomatic_translationが自然な現代日本語か
   - 過剰意訳（原文にない内容の追加）がないか

6. confidence・ambiguityの妥当性
   - 実際に不確かな項目に適切にambiguityが表示されているか
   - confidence水準が分析の実際の確実性と一致しているか

7. token.surfaceフィールドの検証
   - surfaceに漢字以外の文字（韓国語・英語・ひらがな等）が混入していないか
   - 異常が見つかった場合は必ず修正すること

すべての検証出力テキスト（issues_found・final_notes・reasonフィールド）は必ず日本語で記述すること。

修正規則:
- 誤りのある部分のみ最小限の修正
- 不確かな場合は削除せず、confidenceを下げるかambiguityに追加
- 修正された翻訳をrevised_literal_translation / revised_idiomatic_translationに必ず記載
- issues_foundに各問題を具体的に記述
- final_notesに総合評価と主要修正事項を要約
- 修正済みJSONのみを返すこと`,

  'zh-CN': (inputText, firstPassJson) => `你是汉文佛教文献分析JSON的精密验证器。

原文：
${inputText}

第一次分析JSON：
${firstPassJson}

【验证项目 — 全部检查】

1. 原文完整性
   - 原文所有汉字是否均已分节为token？
   - 原文所有句（节）是否均包含在clauses中？
   - 翻译（直译·意译）是否覆盖原文所有成分，无遗漏？
   - alignment是否覆盖原文所有span？

2. 句子成分一致性
   - condition/subject/predicate/object/complement之间是否相互矛盾？
   - 同一语句是否被重复分类到两个以上成分？
   - sentence_type是否与实际成分结构一致？

3. 佛教术语准确性
   - 教学术语（体·德·用·性·相·理·事·一乗·真如·法界等）是否被正确识别，未被作为普通词处理？
   - is_buddhist_term=true的token的term_id是否适当？
   - buddhist_notes是否在理解原文所必要的范围内，简洁说明了各术语的含义？
   - 若含有百科全书式列举（人名、著作、地名等），须删除，仅保留理解文意所需的核心内容
   - 若含有梵语·巴利语罗马字转写（Skt. …、Pāli …、IAST等），须立即删除
   - 确认other_notes是否涵盖理解原文所需的历史地理项目（地名、人物、王朝、时期等）。若相关内容混入buddhist_notes，须移至other_notes
   - 是否仅为简单词典释义而缺少原文语境中的具体角色说明？
   - 固有名词（人物·地名）的解说是否充分？

4. 翻译质量
   - literal_translation是否忠实保留原文句法结构？
   - idiomatic_translation是否自然流畅的现代汉语？
   - 两种翻译是否相互矛盾？
   - 是否存在过度意译（添加原文没有的内容）？

5. confidence·ambiguity的合理性
   - 真正不确定的项目是否标注了ambiguity？
   - confidence水平是否与分析的实际确定性一致？

6. token.surface字段验证
   - surface中是否只有汉字（漢字），无韩语·英语等其他文字混入？
   - 发现异常时必须修正。

所有验证输出文字（issues_found、final_notes、reason字段）必须使用简体中文。

修正规则：
- 只对有误的部分进行最小限度的修正
- 不确定时降低confidence或添加到ambiguity，不要删除
- 在revised_literal_translation / revised_idiomatic_translation中记录修正后的翻译
- 在issues_found中具体描述各问题
- 在final_notes中总结综合评价与主要修正事项
- 只返回修正后的JSON`,

  'zh-TW': (inputText, firstPassJson) => `你是漢文佛教文獻分析JSON的精密驗證器。

原文：
${inputText}

第一次分析JSON：
${firstPassJson}

【驗證項目 — 全部檢查】

1. 原文完整性
   - 原文所有漢字是否均已分節為token？
   - 原文所有句（節）是否均包含在clauses中？
   - 翻譯（直譯·意譯）是否覆蓋原文所有成分，無遺漏？
   - alignment是否覆蓋原文所有span？

2. 句子成分一致性
   - condition/subject/predicate/object/complement之間是否相互矛盾？
   - 同一語句是否被重複分類到兩個以上成分？
   - sentence_type是否與實際成分結構一致？

3. 佛教術語準確性
   - 教學術語（體·德·用·性·相·理·事·一乘·真如·法界等）是否被正確識別，未被作為普通詞處理？
   - is_buddhist_term=true的token的term_id是否適當？
   - buddhist_notes是否在理解原文所必要的範圍內，簡潔說明了各術語的含義？
   - 若含有百科全書式列舉（人名、著作、地名等），須刪除，僅保留理解文意所需的核心內容
   - 若含有梵語·巴利語羅馬字轉寫（Skt. …、Pāli …、IAST等），須立即刪除
   - 確認other_notes是否涵蓋理解原文所需的歷史地理項目（地名、人物、王朝、時期等）。若相關內容混入buddhist_notes，須移至other_notes
   - 是否僅為簡單詞典釋義而缺少原文語境中的具體角色說明？
   - 固有名詞（人物·地名）的解說是否充分？

4. 翻譯品質
   - literal_translation是否忠實保留原文句法結構？
   - idiomatic_translation是否自然流暢的現代漢語？
   - 兩種翻譯是否相互矛盾？
   - 是否存在過度意譯（添加原文沒有的內容）？

5. confidence·ambiguity的合理性
   - 真正不確定的項目是否標注了ambiguity？
   - confidence水平是否與分析的實際確定性一致？

6. token.surface欄位驗證
   - surface中是否只有漢字（漢字），無韓語·英語等其他文字混入？
   - 發現異常時必須修正。

所有驗證輸出文字（issues_found、final_notes、reason欄位）必須使用繁體中文。

修正規則：
- 只對有誤的部分進行最小限度的修正
- 不確定時降低confidence或添加到ambiguity，不要刪除
- 在revised_literal_translation / revised_idiomatic_translation中記錄修正後的翻譯
- 在issues_found中具體描述各問題
- 在final_notes中總結綜合評價與主要修正事項
- 只返回修正後的JSON`,
};

// 하위 호환: VERIFICATION_PROMPT_TEMPLATE (한국어 기본)
const VERIFICATION_PROMPT_TEMPLATE = VERIFICATION_PROMPT_TEMPLATES.ko('{{INPUT_TEXT}}', '{{FIRST_PASS_JSON}}');

/**
 * 언어에 맞는 검증 프롬프트 생성.
 * @param {string} inputText
 * @param {object} firstPassJson
 * @param {string} lang
 * @returns {string}
 */
function buildVerificationPrompt(inputText, firstPassJson, lang) {
  lang = lang || 'ko';
  const builder = VERIFICATION_PROMPT_TEMPLATES[lang] || VERIFICATION_PROMPT_TEMPLATES.ko;
  return builder(inputText, JSON.stringify(firstPassJson, null, 2));
}


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
          '一乘(일승): 삼승(聲聞·緣覺·菩薩)을 넘어 모든 중생을 하나의 깨달음으로 이끄는 가르침. 이 문장에서는 일승의 관점을 전제로 십불의 체·덕·용이 갖추어진다는 논지를 여는 조건어이다.',
          '十佛(십불): 화엄경에서 설하는 열 가지 부처의 양상. 이 문장에서 일승에 의거할 때 그 체·덕·용이 모두 갖추어진다는 서술의 주어이다.',
          '體德用(체덕용): 존재를 본체(體)·공덕(德)·작용(用)의 세 측면으로 분析하는 화엄의 분析 틀. 이 문장의 목적어로서, 십불의 세 측면이 일승 안에 온전히 갖추어짐을 나타낸다.'
        ],
        other_notes: []
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
          '일즉다(一即多)·다즉일(多即一): 하나가 곧 전체이고 전체가 곧 하나라는 화엄의 상즉상입(相即相入) 원리. 이 문장의 핵심 명제로, "以一攝多"와 "以多攝一"이 이 원리를 직접 표현한다.',
          '攝(섭): 거두어 포섭하다. 이 문장에서 "以一攝多(하나로 많은 것을 포섭함)"와 "以多攝一(많은 것으로 하나를 포섭함)"에 반복 등장하며 상즉상입의 관계를 나타내는 핵심 동사이다.'
        ],
        other_notes: []
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
          '真如(진여): 있는 그대로의 궁극적 실재. 이 문장의 주어로, 고정된 자성에 머물지 않고 인연을 따라 만법을 이룬다는 서술의 주체이다.',
          '不守自性(부수자성): 진여가 고정된 자기 성품에 머물지 않는다는 뜻. 이 문장에서 진여가 수연(隨緣)하여 만법을 이루는 이유를 설명하는 전제 구절이다.',
          '隨緣(수연): 인연을 따른다는 뜻. 이 문장에서 진여가 만법을 이루는 방식을 서술하는 핵심 동사로, 不守自性과 짝을 이루어 진여의 동태적 측면을 나타낸다.',
          '萬法(만법): 모든 존재와 현상의 총칭. 이 문장에서 진여가 수연하여 이루어내는 결과, 즉 현상계 전체를 가리키는 목적어이다.'
        ],
        other_notes: []
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
 * 출력 언어에 맞게 번역 예시를 조정한다.
 * @param {string} lang - 'ko' | 'en' | 'ja'
 */
// ───────── 언어별 완전 번역 Few-shot 데이터 ─────────

const FEW_SHOT_TRANSLATED = {
  ko: null, // ko는 FEW_SHOT_EXAMPLES 원본 사용

  en: [
    {
      input: '若依一乘此中即具十佛體德用。准以思攝。',
      expected: {
        input_text: '若依一乘此中即具十佛體德用。准以思攝。',
        segmentation: {
          clauses: ['若依一乘', '此中即具十佛體德用', '准以思攝'],
          tokens: [
            { surface: '若', char_gloss: ['if', 'supposing'], pos_candidates: ['conjunction'], function_candidates: ['conditional marker'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '依', char_gloss: ['rely on', 'according to'], pos_candidates: ['verb', 'preposition'], function_candidates: ['preposition-object introducer'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '一乘', char_gloss: ['One Vehicle'], pos_candidates: ['noun'], function_candidates: ['prepositional object'], is_buddhist_term: true, term_id: 'one_vehicle', confidence: 'high', ambiguity: [] },
            { surface: '此中', char_gloss: ['within this', 'herein'], pos_candidates: ['pronoun+locative'], function_candidates: ['adverbial-scope'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '即', char_gloss: ['immediately', 'then'], pos_candidates: ['adverb'], function_candidates: ['emphasis/immediacy'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '具', char_gloss: ['possess', 'be complete with'], pos_candidates: ['verb'], function_candidates: ['predicate'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '十佛', char_gloss: ['Ten Buddhas'], pos_candidates: ['noun'], function_candidates: ['object modifier'], is_buddhist_term: true, term_id: 'ten_buddhas', confidence: 'high', ambiguity: [] },
            { surface: '體', char_gloss: ['essence', 'body'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'ti_essence', confidence: 'high', ambiguity: [] },
            { surface: '德', char_gloss: ['virtue', 'merit'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'virtue', confidence: 'high', ambiguity: [] },
            { surface: '用', char_gloss: ['function', 'activity'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'function', confidence: 'high', ambiguity: [] },
            { surface: '准', char_gloss: ['follow', 'in accordance with'], pos_candidates: ['verb'], function_candidates: ['predicate'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '以', char_gloss: ['by means of', 'and'], pos_candidates: ['preposition', 'conjunction'], function_candidates: ['means/method'], is_buddhist_term: false, term_id: null, confidence: 'medium', ambiguity: ['may function as conjunction'] },
            { surface: '思', char_gloss: ['think', 'contemplate'], pos_candidates: ['verb'], function_candidates: ['adverbial verb'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '攝', char_gloss: ['subsume', 'encompass'], pos_candidates: ['verb'], function_candidates: ['predicate'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: 'conditional sentence + declarative + meta-directive',
          components: {
            condition: '若依一乘 (if one relies on the One Vehicle)',
            subject: '此中 (within this) — functions as both subject and scope adverbial',
            adverbial: ['即 (immediately, then)'],
            predicate: '具 (possesses)',
            object: ['十佛體德用 (essence, virtues, and functions of the Ten Buddhas)'],
            complement: [],
            omitted_elements: ['subject of 准以思攝: reader/practitioner (omitted)'],
            ambiguity: ['此中 may be closer to a scope adverbial than a subject']
          },
          literal_translation: 'If one relies on the One Vehicle, then within this, one immediately possesses the essence, virtues, and functions of the Ten Buddhas. Subsume [them] by thinking in accordance with the preceding [explanation].',
          idiomatic_translation: 'From the perspective of the One Vehicle, all the essence, virtues, and functions of the Ten Buddhas are fully present here. One should understand this by organizing it according to the method explained above.',
          grammar_points: [
            '若…即… pattern: classical Chinese conditional structure expressing "if… then…"',
            '准以思攝: meta-directive expression typical of commentary style'
          ],
          buddhist_notes: [
            '一乘 (One Vehicle, Skt. ekayāna): The single path that leads all beings to Buddhahood, transcending the three vehicles. In this sentence, it sets the doctrinal premise under which the Ten Buddhas are said to possess essence, virtue, and function.',
            '十佛 (Ten Buddhas): The ten modes of Buddhahood in the Avataṃsaka Sūtra. Subject of this sentence, whose essence-virtue-function is said to be fully present when the One Vehicle is the standpoint.',
            '體德用 (Essence-Virtue-Function, Skt. svabhāva-guṇa-kriyā): Huayan tripartite framework analyzing existence as essence (體), virtue (德), and function (用). Object of this sentence, stating that all three aspects of the Ten Buddhas are present within the One Vehicle.'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '若依一乘', target_span: 'If one relies on the One Vehicle', relation: '1:1', confidence: 'high', reason: 'direct translation of conditional clause' },
          { source_span: '此中', target_span: 'within this', relation: '1:1', confidence: 'high', reason: 'scope adverbial' },
          { source_span: '即具', target_span: 'immediately possesses', relation: '1:1', confidence: 'high', reason: 'predicate' },
          { source_span: '十佛體德用', target_span: 'essence, virtues, and functions of the Ten Buddhas', relation: '1:N', confidence: 'high', reason: 'expanded object' },
          { source_span: '准以思攝', target_span: 'Subsume [them] by thinking in accordance with the preceding [explanation]', relation: '1:N', confidence: 'high', reason: 'meta-directive expanded' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['No omissions or errors found in first-pass analysis']
        }
      }
    },
    {
      input: '真如不守自性隨緣成萬法。',
      expected: {
        input_text: '真如不守自性隨緣成萬法。',
        segmentation: {
          clauses: ['真如不守自性', '隨緣成萬法'],
          tokens: [
            { surface: '真如', char_gloss: ['suchness', 'thusness'], pos_candidates: ['noun'], function_candidates: ['subject'], is_buddhist_term: true, term_id: 'tathata', confidence: 'high', ambiguity: [] },
            { surface: '不', char_gloss: ['not', 'does not'], pos_candidates: ['negative adverb'], function_candidates: ['negation'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '守', char_gloss: ['guard', 'abide in'], pos_candidates: ['verb'], function_candidates: ['predicate'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '自性', char_gloss: ['own nature', 'self-nature'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'svabhava', confidence: 'high', ambiguity: [] },
            { surface: '隨', char_gloss: ['follow', 'accord with'], pos_candidates: ['verb'], function_candidates: ['adverbial verb'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '緣', char_gloss: ['condition', 'dependent condition'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'pratyaya', confidence: 'high', ambiguity: [] },
            { surface: '成', char_gloss: ['become', 'produce'], pos_candidates: ['verb'], function_candidates: ['predicate'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '萬法', char_gloss: ['ten thousand dharmas', 'all phenomena'], pos_candidates: ['noun'], function_candidates: ['object'], is_buddhist_term: true, term_id: 'all_dharmas', confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: 'declarative (serial verb construction)',
          components: {
            condition: '',
            subject: '真如 (suchness/tathata)',
            adverbial: ['隨緣 (according to conditions)'],
            predicate: '不守 (does not abide in) → 成 (produces)',
            object: ['自性 (own nature)', '萬法 (all phenomena)'],
            complement: [],
            omitted_elements: [],
            ambiguity: ['隨緣 may be analyzed as a separate predicate clause rather than adverbial']
          },
          literal_translation: 'Suchness does not abide in its own nature; according to conditions, it produces all phenomena.',
          idiomatic_translation: 'True suchness is not confined to a fixed self-nature; responding to dependent conditions, it manifests as all the phenomena of the world.',
          grammar_points: [
            '不守自性: negative adverb + verb + object structure',
            '隨緣成萬法: serial verb construction — following (隨) conditions (緣), producing (成) all phenomena (萬法)'
          ],
          buddhist_notes: [
            '真如 (Suchness, Skt. tathatā): Ultimate reality as-it-is in Mahāyāna Buddhism. Subject of this sentence: it does not cling to a fixed nature but follows conditions to produce all phenomena.',
            '不守自性 ("does not abide in its own nature"): Suchness is not fixed or static; this phrase explains why it can follow conditions and generate phenomena. Functions as the first predicate clause of the sentence.',
            '隨緣 ("following conditions", Skt. pratyaya-anusāra): Suchness responds to conditions rather than remaining inert. Paired with 不守自性 to describe the dynamic side of tathatā; key verb leading to 成萬法.',
            '萬法 ("all phenomena", Skt. sarva-dharma): The totality of conditioned existence. Object of 成, denoting what suchness produces by following conditions.'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '真如', target_span: 'Suchness', relation: '1:1', confidence: 'high', reason: 'subject' },
          { source_span: '不守自性', target_span: 'does not abide in its own nature', relation: '1:N', confidence: 'high', reason: 'predicate expanded' },
          { source_span: '隨緣', target_span: 'according to conditions', relation: '1:N', confidence: 'high', reason: 'adverbial expanded' },
          { source_span: '成萬法', target_span: 'produces all phenomena', relation: '1:N', confidence: 'high', reason: 'predicate + object' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['Ambiguity of 隨緣 noted; analysis is sound']
        }
      }
    }
  ],

  ja: [
    {
      input: '若依一乘此中即具十佛體德用。准以思攝。',
      expected: {
        input_text: '若依一乘此中即具十佛體德用。准以思攝。',
        segmentation: {
          clauses: ['若依一乘', '此中即具十佛體德用', '准以思攝'],
          tokens: [
            { surface: '若', char_gloss: ['もし', '仮に'], pos_candidates: ['接続詞'], function_candidates: ['条件標識'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '依', char_gloss: ['よる', 'したがう'], pos_candidates: ['動詞', '前置詞'], function_candidates: ['前置詞・対象導入'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '一乘', char_gloss: ['一乗'], pos_candidates: ['名詞'], function_candidates: ['前置詞の目的語'], is_buddhist_term: true, term_id: 'one_vehicle', confidence: 'high', ambiguity: [] },
            { surface: '此中', char_gloss: ['この中に', 'ここに'], pos_candidates: ['代名詞＋位置詞'], function_candidates: ['副詞語・範囲'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '即', char_gloss: ['すなわち', 'ただちに'], pos_candidates: ['副詞'], function_candidates: ['強調・即時'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '具', char_gloss: ['具える', '備わる'], pos_candidates: ['動詞'], function_candidates: ['述語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '十佛', char_gloss: ['十仏'], pos_candidates: ['名詞'], function_candidates: ['目的語修飾'], is_buddhist_term: true, term_id: 'ten_buddhas', confidence: 'high', ambiguity: [] },
            { surface: '體', char_gloss: ['体', '本体'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'ti_essence', confidence: 'high', ambiguity: [] },
            { surface: '德', char_gloss: ['徳', '功徳'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'virtue', confidence: 'high', ambiguity: [] },
            { surface: '用', char_gloss: ['用', '作用'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'function', confidence: 'high', ambiguity: [] },
            { surface: '准', char_gloss: ['准じる', 'ならう'], pos_candidates: ['動詞'], function_candidates: ['述語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '以', char_gloss: ['もって', 'により'], pos_candidates: ['前置詞', '接続詞'], function_candidates: ['手段・方法'], is_buddhist_term: false, term_id: null, confidence: 'medium', ambiguity: ['接続詞の可能性あり'] },
            { surface: '思', char_gloss: ['思う', '考える'], pos_candidates: ['動詞'], function_candidates: ['副詞的動詞'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '攝', char_gloss: ['摂する', '包摂する'], pos_candidates: ['動詞'], function_candidates: ['述語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '条件文＋叙述文＋メタ指示文',
          components: {
            condition: '若依一乘（もし一乗に依らば）',
            subject: '此中（この中に）— 主語兼範囲副詞語',
            adverbial: ['即（すなわち）'],
            predicate: '具（具す）',
            object: ['十佛體德用（十仏の体・徳・用）'],
            complement: [],
            omitted_elements: ['准以思攝の主語：読者・修行者（省略）'],
            ambiguity: ['此中は主語より範囲副詞語に近い可能性あり']
          },
          literal_translation: '若し一乗に依らば、此の中に即ち十仏の体・徳・用を具す。准じて以て思い摂せよ。',
          idiomatic_translation: '一乗の立場に依拠すれば、ここにはすなわち十仏の本体・功徳・作用がすべて備わっている。前述の方法に準じて考え、整理して理解すればよい。',
          grammar_points: [
            '若…即…構文：条件と結果を示す漢文の典型的構造',
            '准以思攝：注釈書に頻出するメタ指示表現'
          ],
          buddhist_notes: [
            '一乗（いちじょう）：三乗を超えてすべての衆生を一つの悟りへ導く教え。この文では「若し一乗に依らば」という条件節として、十仏の体・徳・用が具わるという論旨の前提を示す。',
            '十仏（じゅうぶつ）：『華厳経』が説く仏の十の様相。この文の主語にあたり、一乗に依るときその体・徳・用がすべて具わると述べられる対象である。',
            '体徳用（たいとくゆう）：存在を本体（体）・功徳（徳）・作用（用）の三側面から捉える華厳の分析枠組み。この文の目的語として、一乗において十仏の三側面がすべて具わることを表す。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '若依一乘', target_span: '若し一乗に依らば', relation: '1:1', confidence: 'high', reason: '条件節の書き下し' },
          { source_span: '此中', target_span: '此の中に', relation: '1:1', confidence: 'high', reason: '範囲副詞語' },
          { source_span: '即具', target_span: '即ち具す', relation: '1:1', confidence: 'high', reason: '述語' },
          { source_span: '十佛體德用', target_span: '十仏の体・徳・用を', relation: '1:N', confidence: 'high', reason: '目的語展開' },
          { source_span: '准以思攝', target_span: '准じて以て思い摂せよ', relation: '1:N', confidence: 'high', reason: 'メタ指示文の書き下し' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['初回分析に脱落・誤りなし']
        }
      }
    },
    {
      input: '真如不守自性隨緣成萬法。',
      expected: {
        input_text: '真如不守自性隨緣成萬法。',
        segmentation: {
          clauses: ['真如不守自性', '隨緣成萬法'],
          tokens: [
            { surface: '真如', char_gloss: ['真如', 'あるがまま'], pos_candidates: ['名詞'], function_candidates: ['主語'], is_buddhist_term: true, term_id: 'tathata', confidence: 'high', ambiguity: [] },
            { surface: '不', char_gloss: ['ず', 'あらず'], pos_candidates: ['否定副詞'], function_candidates: ['否定'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '守', char_gloss: ['守る', 'とどまる'], pos_candidates: ['動詞'], function_candidates: ['述語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '自性', char_gloss: ['自性', '自らの性質'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'svabhava', confidence: 'high', ambiguity: [] },
            { surface: '隨', char_gloss: ['随う', 'したがう'], pos_candidates: ['動詞'], function_candidates: ['副詞的動詞'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '緣', char_gloss: ['縁', '条件'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'pratyaya', confidence: 'high', ambiguity: [] },
            { surface: '成', char_gloss: ['成る', '生じる'], pos_candidates: ['動詞'], function_candidates: ['述語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '萬法', char_gloss: ['万法', 'あらゆる現象'], pos_candidates: ['名詞'], function_candidates: ['目的語'], is_buddhist_term: true, term_id: 'all_dharmas', confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '叙述文（連続動詞構造）',
          components: {
            condition: '',
            subject: '真如（真如）',
            adverbial: ['隨緣（縁に随いて）'],
            predicate: '不守（守らず）→ 成（成ず）',
            object: ['自性（自性）', '萬法（万法）'],
            complement: [],
            omitted_elements: [],
            ambiguity: ['隨緣を副詞語と見るか別の述語節と見るか解釈の余地あり']
          },
          literal_translation: '真如は自性を守らず、縁に随いて万法を成ず。',
          idiomatic_translation: '真如は固定した自性にとどまることなく、縁に従ってあらゆる現象として展開する。',
          grammar_points: [
            '不守自性：否定副詞＋動詞＋目的語の構造',
            '隨緣成萬法：連続動詞構造 — 縁に随い（隨）て万法を成ず（成）'
          ],
          buddhist_notes: [
            '真如（しんにょ）：あるがままの究極の実在。この文の主語として、固定した自性に止まらず縁に随って万法を成すという動態的な働きの主体として描かれる。',
            '不守自性（ふしゅじしょう）：真如が固定した自性に止まらないこと。この文で真如が随縁して万法を成すことができる理由を示す第一の述部節である。',
            '隨緣（ずいえん）：縁に随うこと。不守自性と対をなして真如の動態的側面を表し、「成万法」へ続く核心動詞として機能する。',
            '萬法（まんぽう）：すべての存在・現象の総称。「成万法」の目的語として、真如が随縁することで生み出される現象界全体を指す。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '真如', target_span: '真如は', relation: '1:1', confidence: 'high', reason: '主語' },
          { source_span: '不守自性', target_span: '自性を守らずして', relation: '1:N', confidence: 'high', reason: '述部展開' },
          { source_span: '隨緣', target_span: '縁に随いて', relation: '1:N', confidence: 'high', reason: '副詞語展開' },
          { source_span: '成萬法', target_span: '万法を成ず', relation: '1:N', confidence: 'high', reason: '述語＋目的語' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['隨緣の文の成分分類についてambiguity表記済み。分析は妥当']
        }
      }
    }
  ],

  'zh-CN': [
    {
      input: '若依一乘此中即具十佛體德用。准以思攝。',
      expected: {
        input_text: '若依一乘此中即具十佛體德用。准以思攝。',
        segmentation: {
          clauses: ['若依一乘', '此中即具十佛體德用', '准以思攝'],
          tokens: [
            { surface: '若', char_gloss: ['如果', '倘若'], pos_candidates: ['连词'], function_candidates: ['条件标记'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '依', char_gloss: ['依据', '依照'], pos_candidates: ['动词', '介词'], function_candidates: ['介词・引入对象'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '一乘', char_gloss: ['一乘'], pos_candidates: ['名词'], function_candidates: ['介词宾语'], is_buddhist_term: true, term_id: 'one_vehicle', confidence: 'high', ambiguity: [] },
            { surface: '此中', char_gloss: ['此中', '其中'], pos_candidates: ['代词＋位置词'], function_candidates: ['状语・范围'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '即', char_gloss: ['即', '便'], pos_candidates: ['副词'], function_candidates: ['强调・即时'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '具', char_gloss: ['具有', '具备'], pos_candidates: ['动词'], function_candidates: ['谓语'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '十佛', char_gloss: ['十佛'], pos_candidates: ['名词'], function_candidates: ['宾语修饰'], is_buddhist_term: true, term_id: 'ten_buddhas', confidence: 'high', ambiguity: [] },
            { surface: '體', char_gloss: ['体', '本体'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'ti_essence', confidence: 'high', ambiguity: [] },
            { surface: '德', char_gloss: ['德', '功德'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'virtue', confidence: 'high', ambiguity: [] },
            { surface: '用', char_gloss: ['用', '作用'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'function', confidence: 'high', ambiguity: [] },
            { surface: '准', char_gloss: ['准照', '依照'], pos_candidates: ['动词'], function_candidates: ['谓语'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '以', char_gloss: ['以', '用'], pos_candidates: ['介词', '连词'], function_candidates: ['手段・方法'], is_buddhist_term: false, term_id: null, confidence: 'medium', ambiguity: ['可能作连词'] },
            { surface: '思', char_gloss: ['思考', '思惟'], pos_candidates: ['动词'], function_candidates: ['状语性动词'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '攝', char_gloss: ['摄取', '统摄'], pos_candidates: ['动词'], function_candidates: ['谓语'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '条件句＋陈述句＋元指示句',
          components: {
            condition: '若依一乘（若依一乘）',
            subject: '此中（此中）— 兼主语与范围状语',
            adverbial: ['即（即）'],
            predicate: '具（具）',
            object: ['十佛體德用（十佛之体、德、用）'],
            complement: [],
            omitted_elements: ['准以思攝的主语：读者／修行者（省略）'],
            ambiguity: ['此中更接近范围状语而非主语']
          },
          literal_translation: '若依一乘，此中即具十佛之体、德、用。准以思摄。',
          idiomatic_translation: '如果依据一乘的立场来看，这其中便已具足十佛的本体、功德与作用。可以按照前面的方法来思考和归纳理解。',
          grammar_points: [
            '若…即…句式：表达条件与结果的古汉语典型结构',
            '准以思攝：注疏文体中常见的元指示表达'
          ],
          buddhist_notes: [
            '一乘：超越三乘、引导一切众生趋向唯一觉悟的教理。在本句中作条件语，奠定「此中即具十佛体德用」这一论旨的前提立场。',
            '十佛：《华严经》所说佛的十种面相。本句的主语，谓依一乘之立场，其体、德、用皆得具足。',
            '体德用：从本体（体）、功德（德）、作用（用）三个层面把握存在的华严分析框架。本句的宾语，表明十佛的三个层面在一乘之中圆满具足。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '若依一乘', target_span: '若依一乘', relation: '1:1', confidence: 'high', reason: '条件节直译' },
          { source_span: '此中', target_span: '此中', relation: '1:1', confidence: 'high', reason: '范围状语' },
          { source_span: '即具', target_span: '即具', relation: '1:1', confidence: 'high', reason: '谓语' },
          { source_span: '十佛體德用', target_span: '十佛之体、德、用', relation: '1:N', confidence: 'high', reason: '宾语展开' },
          { source_span: '准以思攝', target_span: '准以思摄', relation: '1:1', confidence: 'high', reason: '元指示句直译' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['初次分析无遗漏或错误']
        }
      }
    },
    {
      input: '真如不守自性隨緣成萬法。',
      expected: {
        input_text: '真如不守自性隨緣成萬法。',
        segmentation: {
          clauses: ['真如不守自性', '隨緣成萬法'],
          tokens: [
            { surface: '真如', char_gloss: ['真如', '如实'], pos_candidates: ['名词'], function_candidates: ['主语'], is_buddhist_term: true, term_id: 'tathata', confidence: 'high', ambiguity: [] },
            { surface: '不', char_gloss: ['不', '非'], pos_candidates: ['否定副词'], function_candidates: ['否定'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '守', char_gloss: ['守', '固守'], pos_candidates: ['动词'], function_candidates: ['谓语'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '自性', char_gloss: ['自性', '本性'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'svabhava', confidence: 'high', ambiguity: [] },
            { surface: '隨', char_gloss: ['随', '顺随'], pos_candidates: ['动词'], function_candidates: ['状语性动词'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '緣', char_gloss: ['缘', '条件'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'pratyaya', confidence: 'high', ambiguity: [] },
            { surface: '成', char_gloss: ['成', '生成'], pos_candidates: ['动词'], function_candidates: ['谓语'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '萬法', char_gloss: ['万法', '一切现象'], pos_candidates: ['名词'], function_candidates: ['宾语'], is_buddhist_term: true, term_id: 'all_dharmas', confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '陈述句（连续动词结构）',
          components: {
            condition: '',
            subject: '真如（真如）',
            adverbial: ['隨緣（随缘）'],
            predicate: '不守（不守）→ 成（成）',
            object: ['自性（自性）', '萬法（万法）'],
            complement: [],
            omitted_elements: [],
            ambiguity: ['隨緣可视为状语，也可视为独立述语节']
          },
          literal_translation: '真如不守自性，随缘成万法。',
          idiomatic_translation: '真如并非固守一成不变的自性，而是随顺因缘，化现为一切现象。',
          grammar_points: [
            '不守自性：否定副词＋动词＋宾语结构',
            '隨緣成萬法：连续动词结构——随（隨）缘（緣）而成（成）万法（萬法）'
          ],
          buddhist_notes: [
            '真如：如实而在的终极实在。本句的主语，描述其不执守自性、随缘成就万法的动态特性。',
            '不守自性：真如不执守固定自性。本句第一谓语节，说明真如得以随缘成就万法的根本原因。',
            '随缘：随顺因缘而运作。与「不守自性」相对，表达真如的动态面向，是连接主语真如与结果「成万法」的核心动词。',
            '万法：一切存在与现象的总称。「成万法」的宾语，指真如随缘所成就的现象界全体。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '真如', target_span: '真如', relation: '1:1', confidence: 'high', reason: '主语' },
          { source_span: '不守自性', target_span: '不守自性', relation: '1:1', confidence: 'high', reason: '谓语展开' },
          { source_span: '隨緣', target_span: '随缘', relation: '1:1', confidence: 'high', reason: '状语' },
          { source_span: '成萬法', target_span: '成万法', relation: '1:N', confidence: 'high', reason: '谓语＋宾语' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['隨緣的句法分析已标注歧义，整体分析合理']
        }
      }
    }
  ],

  'zh-TW': [
    {
      input: '若依一乘此中即具十佛體德用。准以思攝。',
      expected: {
        input_text: '若依一乘此中即具十佛體德用。准以思攝。',
        segmentation: {
          clauses: ['若依一乘', '此中即具十佛體德用', '准以思攝'],
          tokens: [
            { surface: '若', char_gloss: ['如果', '倘若'], pos_candidates: ['連詞'], function_candidates: ['條件標記'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '依', char_gloss: ['依據', '依照'], pos_candidates: ['動詞', '介詞'], function_candidates: ['介詞・引入對象'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '一乘', char_gloss: ['一乘'], pos_candidates: ['名詞'], function_candidates: ['介詞賓語'], is_buddhist_term: true, term_id: 'one_vehicle', confidence: 'high', ambiguity: [] },
            { surface: '此中', char_gloss: ['此中', '其中'], pos_candidates: ['代詞＋位置詞'], function_candidates: ['狀語・範圍'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '即', char_gloss: ['即', '便'], pos_candidates: ['副詞'], function_candidates: ['強調・即時'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '具', char_gloss: ['具有', '具備'], pos_candidates: ['動詞'], function_candidates: ['謂語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '十佛', char_gloss: ['十佛'], pos_candidates: ['名詞'], function_candidates: ['賓語修飾'], is_buddhist_term: true, term_id: 'ten_buddhas', confidence: 'high', ambiguity: [] },
            { surface: '體', char_gloss: ['體', '本體'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'ti_essence', confidence: 'high', ambiguity: [] },
            { surface: '德', char_gloss: ['德', '功德'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'virtue', confidence: 'high', ambiguity: [] },
            { surface: '用', char_gloss: ['用', '作用'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'function', confidence: 'high', ambiguity: [] },
            { surface: '准', char_gloss: ['准照', '依照'], pos_candidates: ['動詞'], function_candidates: ['謂語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '以', char_gloss: ['以', '用'], pos_candidates: ['介詞', '連詞'], function_candidates: ['手段・方法'], is_buddhist_term: false, term_id: null, confidence: 'medium', ambiguity: ['可能作連詞'] },
            { surface: '思', char_gloss: ['思考', '思惟'], pos_candidates: ['動詞'], function_candidates: ['狀語性動詞'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '攝', char_gloss: ['攝取', '統攝'], pos_candidates: ['動詞'], function_candidates: ['謂語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '條件句＋陳述句＋元指示句',
          components: {
            condition: '若依一乘（若依一乘）',
            subject: '此中（此中）— 兼主語與範圍狀語',
            adverbial: ['即（即）'],
            predicate: '具（具）',
            object: ['十佛體德用（十佛之體、德、用）'],
            complement: [],
            omitted_elements: ['准以思攝的主語：讀者／修行者（省略）'],
            ambiguity: ['此中更接近範圍狀語而非主語']
          },
          literal_translation: '若依一乘，此中即具十佛之體、德、用。准以思攝。',
          idiomatic_translation: '若依據一乘的立場來看，此中便已具足十佛的本體、功德與作用。可依照前述方法加以思惟攝受，以資理解。',
          grammar_points: [
            '若…即…句式：表達條件與結果的古漢語典型結構',
            '准以思攝：注疏文體中常見的元指示表達'
          ],
          buddhist_notes: [
            '一乘：超越三乘、引導一切眾生趨向唯一覺悟的教理。本句中作條件語，奠定「此中即具十佛體德用」此一論旨的前提立場。',
            '十佛：《華嚴經》所說佛的十種面相。本句的主語，謂依一乘之立場，其體、德、用皆得具足。',
            '體德用：從本體（體）、功德（德）、作用（用）三個層面把握存在的華嚴分析框架。本句的賓語，表明十佛的三個層面在一乘之中圓滿具足。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '若依一乘', target_span: '若依一乘', relation: '1:1', confidence: 'high', reason: '條件節直譯' },
          { source_span: '此中', target_span: '此中', relation: '1:1', confidence: 'high', reason: '範圍狀語' },
          { source_span: '即具', target_span: '即具', relation: '1:1', confidence: 'high', reason: '謂語' },
          { source_span: '十佛體德用', target_span: '十佛之體、德、用', relation: '1:N', confidence: 'high', reason: '賓語展開' },
          { source_span: '准以思攝', target_span: '准以思攝', relation: '1:1', confidence: 'high', reason: '元指示句直譯' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['初次分析無遺漏或錯誤']
        }
      }
    },
    {
      input: '真如不守自性隨緣成萬法。',
      expected: {
        input_text: '真如不守自性隨緣成萬法。',
        segmentation: {
          clauses: ['真如不守自性', '隨緣成萬法'],
          tokens: [
            { surface: '真如', char_gloss: ['真如', '如實'], pos_candidates: ['名詞'], function_candidates: ['主語'], is_buddhist_term: true, term_id: 'tathata', confidence: 'high', ambiguity: [] },
            { surface: '不', char_gloss: ['不', '非'], pos_candidates: ['否定副詞'], function_candidates: ['否定'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '守', char_gloss: ['守', '固守'], pos_candidates: ['動詞'], function_candidates: ['謂語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '自性', char_gloss: ['自性', '本性'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'svabhava', confidence: 'high', ambiguity: [] },
            { surface: '隨', char_gloss: ['隨', '順隨'], pos_candidates: ['動詞'], function_candidates: ['狀語性動詞'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '緣', char_gloss: ['緣', '條件'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'pratyaya', confidence: 'high', ambiguity: [] },
            { surface: '成', char_gloss: ['成', '生成'], pos_candidates: ['動詞'], function_candidates: ['謂語'], is_buddhist_term: false, term_id: null, confidence: 'high', ambiguity: [] },
            { surface: '萬法', char_gloss: ['萬法', '一切現象'], pos_candidates: ['名詞'], function_candidates: ['賓語'], is_buddhist_term: true, term_id: 'all_dharmas', confidence: 'high', ambiguity: [] }
          ]
        },
        parsing: {
          sentence_type: '陳述句（連續動詞結構）',
          components: {
            condition: '',
            subject: '真如（真如）',
            adverbial: ['隨緣（隨緣）'],
            predicate: '不守（不守）→ 成（成）',
            object: ['自性（自性）', '萬法（萬法）'],
            complement: [],
            omitted_elements: [],
            ambiguity: ['隨緣可視為狀語，亦可視為獨立述語節']
          },
          literal_translation: '真如不守自性，隨緣成萬法。',
          idiomatic_translation: '真如並非固守一成不變的自性，而是隨順因緣，化現為一切現象。',
          grammar_points: [
            '不守自性：否定副詞＋動詞＋賓語結構',
            '隨緣成萬法：連續動詞結構——隨（隨）緣（緣）而成（成）萬法（萬法）'
          ],
          buddhist_notes: [
            '真如：如實而在的終極實在。本句的主語，描述其不執守自性、隨緣成就萬法的動態特性。',
            '不守自性：真如不執守固定自性。本句第一謂語節，說明真如得以隨緣成就萬法的根本原因。',
            '隨緣：隨順因緣而運作。與「不守自性」相對，表達真如的動態面向，是連接主語真如與結果「成萬法」的核心動詞。',
            '萬法：一切存在與現象的總稱。「成萬法」的賓語，指真如隨緣所成就的現象界全體。'
          ],
          other_notes: []
        },
        alignment: [
          { source_span: '真如', target_span: '真如', relation: '1:1', confidence: 'high', reason: '主語' },
          { source_span: '不守自性', target_span: '不守自性', relation: '1:1', confidence: 'high', reason: '謂語展開' },
          { source_span: '隨緣', target_span: '隨緣', relation: '1:1', confidence: 'high', reason: '狀語' },
          { source_span: '成萬法', target_span: '成萬法', relation: '1:N', confidence: 'high', reason: '謂語＋賓語' }
        ],
        verification: {
          issues_found: [],
          revised_literal_translation: '',
          revised_idiomatic_translation: '',
          revised_components: { condition: '', subject: '', adverbial: [], predicate: '', object: [], complement: [], omitted_elements: [], ambiguity: [] },
          final_notes: ['隨緣的句法分析已標注歧義，整體分析合理']
        }
      }
    }
  ]
};

/**
 * 언어별 완전 번역 few-shot 문자열 생성.
 * 비한국어는 해당 언어로 완전히 번역된 예시를 사용.
 */
function buildFewShotString(lang) {
  lang = lang || 'ko';

  const HEADER = {
    ko: '\n\n참고 예시 (분석 품질 기준):\n',
    en: '\n\nReference examples (quality standard):\n',
    ja: '\n\n参考例示（分析品質の基準）：\n',
    'zh-CN': '\n\n参考示例（分析质量标准）：\n',
    'zh-TW': '\n\n參考示例（分析品質標準）：\n',
  };
  const EX_LABEL = {
    ko: (i) => `\n--- 예시 ${i} ---\n`,
    en: (i) => `\n--- Example ${i} ---\n`,
    ja: (i) => `\n--- 例示 ${i} ---\n`,
    'zh-CN': (i) => `\n--- 示例 ${i} ---\n`,
    'zh-TW': (i) => `\n--- 示例 ${i} ---\n`,
  };
  const INPUT_LABEL = {
    ko: '입력: ', en: 'Input: ', ja: '入力：', 'zh-CN': '输入：', 'zh-TW': '輸入：',
  };
  const OUTPUT_LABEL = {
    ko: '기대 출력:\n', en: 'Expected output:\n', ja: '期待される出力：\n', 'zh-CN': '期望输出：\n', 'zh-TW': '期望輸出：\n',
  };

  let result = HEADER[lang] || HEADER.ko;
  const labelFn = EX_LABEL[lang] || EX_LABEL.ko;
  const inLabel = INPUT_LABEL[lang] || INPUT_LABEL.ko;
  const outLabel = OUTPUT_LABEL[lang] || OUTPUT_LABEL.ko;

  // 비한국어: 완전 번역 예시 사용
  if (lang !== 'ko' && FEW_SHOT_TRANSLATED[lang]) {
    FEW_SHOT_TRANSLATED[lang].forEach((ex, i) => {
      result += labelFn(i + 1);
      result += `${inLabel}${ex.input}\n`;
      result += `${outLabel}${JSON.stringify(ex.expected, null, 2)}\n`;
    });
    return result;
  }

  // 한국어: 원본 FEW_SHOT_EXAMPLES 사용
  const config = OUTPUT_LANG_CONFIG['ko'];
  FEW_SHOT_EXAMPLES.forEach((ex, i) => {
    const adjusted = JSON.parse(JSON.stringify(ex.expected));
    if (i === 0) {
      adjusted.parsing.literal_translation = config.fewShotLiteral;
      adjusted.parsing.idiomatic_translation = config.fewShotIdiomatic;
    }
    result += labelFn(i + 1);
    result += `${inLabel}${ex.input}\n`;
    result += `${outLabel}${JSON.stringify(adjusted, null, 2)}\n`;
  });
  return result;
}


/**
 * 출력 언어를 반영한 SYSTEM_PROMPT를 생성.
 * @param {string} lang - 'ko' | 'en' | 'ja'
 * @returns {string}
 */
// ───────── 언어별 완전 독립 시스템 프롬프트 ─────────

const SYSTEM_PROMPTS = {

  ko: `너는 고전 한문 불교 문헌 전문 분석기다.
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
- 각 토큰의 surface에는 한자 부분만 넣되, 해당 토큰 뒤에 붙은 현토가 있다면 "hyeonto" 필드에 기록하라.
- 현토 정보는 문법 구조 판정의 보조 단서로 활용하되, 현토 자체를 번역하지 마라.
- 현토가 없는 순수 한문인 경우 hyeonto 필드는 빈 문자열("")로 두라.

분석 우선순위:
1. 절(句) 단위 분리
2. 어절 단위 분절 — 의미·문법적으로 하나의 단위를 이루는 어구는 하나의 토큰으로 묶어라.
   예: 「十佛」「自性」「萬法」「真如」「一乘」은 각각 단일 토큰. 「准以」처럼 허사+동사 결합도 가능.
   단, 두 글자 이상이라도 각각 독립 기능을 가질 때는 분리.
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

출력 언어 규칙 (매우 중요):
- char_gloss: 한국어로만 작성. 예: ["만약", "조건"] — 중국어 병음 절대 금지.
- pos_candidates: 한국어로만. 예: ["동사", "명사", "접속사"]
- function_candidates: 한국어로만. 예: ["주어", "서술어", "목적어"]
- sentence_type: 한국어로만. 예: "조건문 + 진술문"
- components 내 설명: 한국어로만.
- grammar_points: 한국어로만.
- buddhist_notes: 한국어로만 작성하되, 발음 표기 규칙을 반드시 따를 것:
  ① 표기 형식: 한자(한국 한자음)만 사용. 예: 一乘(일승), 真如(진여)
  ② 중국어 병음·영어 번역어·산스크리트어 병기 절대 금지.
  ③ 발음 병기는 문장당 최대 3개 주요 용어에만 사용. 모든 명사에 병기하지 말 것.
  ④ buddhist_notes는 간결하게 작성하되, 해당 용어가 이 문맥에서 갖는 핵심 의미를 반드시 전달할 것.
     불필요한 개설적 설명 나열 금지. 이 문장 이해에 꼭 필요한 내용만 기술.
- alignment reason: 한국어로만.
- final_notes, issues_found: 한국어로만.

token.surface 및 alignment.source_span 규칙 (매우 중요):
- surface 필드에는 반드시 원문 한자(漢字)만 넣어라.
- alignment의 source_span 필드에도 반드시 원문 한자(漢字)만 넣어라. 한글 번역어를 넣지 마라.
  예: source_span은 '즉지' ❌ → '即知' ✓, '即之' ✓
- 한글, 영어, 일본어 등 다른 언어 문자를 surface나 source_span에 넣지 마라.
- 구두점(。，、；：！？「」)은 그대로 유지한다.

문헌 성격 판단 원칙:
- 입력 문헌이 불교 문헌인지 먼저 판단하라.
- 불교 문헌이 아닌 경우(유교·도교·사학·문학 등 일반 한문): is_buddhist_term을 남용하지 말고, buddhist_notes는 해당 문헌의 사상·문체 전통에 맞게 작성하라.
- 일반 한문에서 불교 용어와 형태가 같은 글자라도 맥락이 불교적이지 않으면 불교식으로 풀이하지 마라.
- 예: 유교 문헌의 「性」은 불교 自性이 아닌 性善·本性의 의미로 해석해야 한다.

최종 출력은 반드시 JSON만 반환하라.`,

  en: `You are an expert analyzer of classical Chinese Buddhist texts.
Your task is to process the input classical Chinese sentence strictly in the following order.

Mandatory rules:
1. Determine segmentation and grammatical structure BEFORE translating.
2. Do not add content not present in the original text.
3. Distinguish between the ordinary meaning and the doctrinal Buddhist meaning of terms.
4. If uncertain, do not assert — leave candidates in the ambiguity field.
5. Output only the specified JSON schema, without any prose explanation.
6. Before outputting, self-check for: omitted source elements, over-translation, conflicting components.

Hyeonto (懸吐) handling:
- The source may contain Korean grammatical particles attached to Chinese characters (e.g. "居卑而後에").
- These are Korean particles added by Joseon/modern Korean monks to aid reading.
- Preserve them in input_text; record them in the hyeonto field per token; do NOT translate them.
- If no hyeonto: leave hyeonto as empty string "".

Analysis priority order:
1. Clause (句) segmentation
2. Word-level tokenization — group characters that form a single semantic/grammatical unit into one token.
   Example: 十佛, 自性, 萬法, 真如, 一乘 each as a single token. 准以 (preposition+verb) may also be grouped.
   However, separate characters that each carry independent grammatical function.
3. Buddhist term candidate tagging
4. Function word and connective analysis
5. Overall sentence structure determination
6. Literal translation
7. Idiomatic translation
8. Source-translation alignment
9. Self-verification and revision

Classical Chinese processing principles:
- 若, 則, 即, 故, 謂, 亦, 但, 乃, 皆, 并, 准, 以 — determine logical function first.
- 體, 德, 用, 性, 相, 理, 事 — check Buddhist doctrinal term possibility first.
- In commentary style, check for meta-directives like "follow the preceding meaning" or "subsume as above".
- Do not arbitrarily assign omitted subjects/objects; list as candidates in omitted_elements only.

Translation rules:
- literal_translation: word-for-word translation preserving source structure as closely as possible.
- idiomatic_translation: natural, fluent English conveying the full meaning.
- Neither translation may omit any element of the source.

ALL output text (char_gloss, pos_candidates, function_candidates, sentence_type, components descriptions, grammar_points, buddhist_notes, alignment reasons, final_notes) MUST be in English. No Korean, no Chinese pinyin, no Japanese readings.

Pronunciation notation rules for buddhist_notes:
- Primary format: 漢字 (English term). Sanskrit romanization with diacritics is permitted for major doctrinal terms.
  Example: 涅槃 (Nirvana, Skt. Nirvāṇa), 般若 (Prajna, Skt. Prajñā), 一乘 (One Vehicle, Skt. Ekayāna)
- Sanskrit romanization should be used SPARINGLY — maximum 3 terms per response, only for key doctrinal concepts.
- buddhist_notes must be concise but deliver the essential meaning IN THIS CONTEXT.
  Avoid generic encyclopedic descriptions. Write only what is essential for understanding this specific passage.
- Do NOT add Chinese pinyin (no "nièpán", "bōrě").
- Do NOT add Korean readings (no "열반", "반야").
- Do NOT add Japanese readings (no "ねはん", "はんにゃ").
- Format: 漢字 (English term, Skt. romanization) — English and Sanskrit only.

CRITICAL — token.surface AND alignment.source_span fields:
- surface must contain ONLY the original Chinese characters (漢字) from the source text.
- alignment source_span must ALSO contain ONLY original Chinese characters. Never put English translations in source_span.
  Example: source_span '即知' ✓, 'immediately knows' ❌
- Never put English, Korean, or Japanese text in surface or source_span.
- Punctuation (。，、；：！？) may be retained as-is.

Text type identification principle:
- First determine whether the input text is Buddhist or non-Buddhist (Confucian, Daoist, historical, literary, etc.).
- For non-Buddhist texts: do not force Buddhist interpretations. Interpret terms according to their actual intellectual tradition.
- A character that appears in Buddhist vocabulary may have a different meaning in a Confucian or literary context. Use contextual judgment.
- Example: 性 in a Confucian text means "human nature" (xìng), not the Buddhist svabhāva/self-nature.

Output ONLY valid JSON. No prose, no code fences, no explanation outside JSON.`,

  ja: `あなたは漢文仏教文献の専門分析器です。
入力された漢文を以下の順序で厳密に処理することが任務です。

厳守すべき規則：
1. 翻訳より先に、分節と文法構造を判定すること。
2. 原文にない内容を補って翻訳しないこと。
3. 仏教用語は一般漢語の意味と教学的意味を区別して検討すること。
4. 不確かな場合は断定せず、ambiguityフィールドに候補を残すこと。
5. 説明文を書かず、指定されたJSONスキーマのみを出力すること。
6. 出力前に、原文の脱落・過剰意訳・文成分の矛盾を自己点検すること。

懸吐（ヒョント）処理規則：
- 原文には韓国語の助詞（懸吐）が付いている場合がある（例：「居卑而後에」）。
- 懸吐は朝鮮・近代の学僧が漢文読解のために付けた韓国語の助詞・語尾である。
- 懸吐はinput_textにそのまま保存し、各トークンのhyeontoフィールドに記録すること。
- 懸吐自体は翻訳しないこと。懸吐がない場合はhyeontoを空文字列""とする。

分析優先順位：
1. 句単位の分節
2. 語節単位の分節 — 意味的・文法的に一つの単位を成す語句は一つのトークンとしてまとめること。
   例：十佛・自性・萬法・真如・一乗はそれぞれ単一トークン。准以（前置詞＋動詞）も一括可。
   ただし、各々が独立した文法機能を持つ場合は分割すること。
3. 仏教用語候補のタグ付け
4. 虚詞・接続語の機能判定
5. 文全体の構造判定
6. 書き下し文（literal_translation）の生成
7. 現代語訳（idiomatic_translation）の生成
8. 原文・訳文対応整列
9. 自己検証と修正版の生成

漢文処理原則：
- 若・則・即・故・謂・亦・但・乃・皆・并・准・以 → 文の論理的機能を優先判定。
- 體・德・用・性・相・理・事 → 仏教教学用語の可能性を優先検討。
- 注釈書体の場合、「前の意に准ず」「例に従い摂す」などのメタ指示表現の可能性を確認。
- 省略された主語・目的語を安易に確定せず、必要な場合のみomitted_elementsに候補として示す。

【書き下し文（literal_translation）必須規則】：
- 漢文訓読体（書き下し文）で出力すること。現代語訳にしないこと。
- 返り点の読み順に従い、語順を日本語語順に組み替えること。
- 助詞・助動詞（は・を・に・の・て・ば・ず・り・たり・べし等）を送り仮名として補うこと。
- 送り仮名はひらがなで、漢字に接続して記すこと。
- 再読文字は訓読規則に従うこと（未→いまダ〜ず、将→まさニ〜とす等）。
- 仏教術語は音読み漢字のまま保持すること（一乗・真如・自性・法界等）。
- 誤り例：「一乗の立場に立てば…」（現代語訳） → 不可。
- 正しい例：「若し一乗に依らば、此の中に即ち十仏の体・徳・用を具す」（書き下し文）。

現代語訳（idiomatic_translation）は自然な現代日本語で出力すること。

すべての出力テキスト（char_gloss・pos_candidates・function_candidates・sentence_type・components説明・grammar_points・buddhist_notes・alignmentのreason・final_notes）は必ず日本語で記述すること。韓国語・中国語拼音を一切使用しないこと。

buddhist_notesの発音表記規則：
- 表記形式：漢字（日本語音読み）のみ使用。例：一乗（いちじょう）、真如（しんにょ）
- 中国語拼音・韓国語読み・英語訳語・サンスクリット語表記は絶対禁止。
- 読み仮名の併記は1回の応答につき最大3語の主要術語のみ。すべての名詞に付けないこと。
- buddhist_notesは簡潔に記述し、この文脈におけるその術語の核心的意味を必ず伝えること。
  一般的な概説的説明の羅列は禁止。この文章の理解に不可欠な内容のみ記述すること。

【最重要】token.surfaceおよびalignment.source_spanフィールド：
- surfaceには必ず原文の漢字（漢字）のみを入れること。
- alignment の source_span にも必ず原文の漢字のみを入れること。日本語訳をsource_spanに入れないこと。
  例：source_span「即知」✓、「すぐに知る」❌
- 日本語のひらがな・カタカナ、韓国語、英語などをsurfaceやsource_spanに入れないこと。
- 句読点（。，、；：！？「」）はそのまま保持してよい。

文献の性格判断原則：
- 入力文献が仏教文献か否かをまず判断すること。
- 仏教文献でない場合（儒教・道教・史書・文学等）：is_buddhist_termを多用せず、buddhist_notesは当該文献の思想・文体的伝統に即して記述すること。
- 一般漢文で仏教用語と形が同じ字でも、文脈が仏教的でなければ仏教的に解釈しないこと。
- 例：儒家文献の「性」は仏教の自性ではなく、性善・本性の意味で解釈すること。

出力はJSONのみ。説明文・コードフェンス・その他テキストを一切含めないこと。`,

  'zh-CN': `你是汉文佛教文献的专业分析器。
你的任务是按照以下顺序严格处理输入的汉文。

必须遵守的规则：
1. 先判定分节与语法结构，再进行翻译。
2. 不得在翻译中补充原文没有的内容。
3. 佛教术语须区分普通汉语含义与教学含义，分别检讨。
4. 不确定时不要断言，将候选项留在ambiguity字段中。
5. 不写说明文字，只输出指定的JSON格式。
6. 输出前自查：原文成分是否遗漏、是否过度意译、句子成分是否冲突。

懸吐处理规则：
- 原文中可能附有韩语助词（懸吐），例如"居卑而後에"。
- 懸吐是朝鲜/近代学僧为辅助汉文阅读而附加的韩语助词/词尾。
- 须在input_text中原样保留，并在各token的hyeonto字段中记录；不翻译懸吐本身。
- 无懸吐时，hyeonto置为空字符串""。

分析优先顺序：
1. 句单位分节
2. 词节单位分节 — 在意义或语法上构成一个整体的词组，应作为一个token合并处理。
   例：十佛・自性・万法・真如・一乘各为单一token。准以（介词+动词）也可合并。
   但各自承担独立语法功能时须分开。
3. 佛教术语候选标注
4. 虚词与连接词功能判定
5. 整体句子结构判定
6. 直译生成
7. 意译生成
8. 原文-译文对应整列
9. 自我验证与修订

汉文处理原则：
- 若、则、即、故、谓、亦、但、乃、皆、并、准、以 → 优先判定其句法功能。
- 体、德、用、性、相、理、事 → 优先检讨佛教教学术语的可能性。
- 注疏文体中，检查"准前义"、"例以思摄"等元指示表达。
- 不随意确定省略的主语或宾语；仅在必要时以候选形式列于omitted_elements。

翻译原则：
- literal_translation：尽量保留原文句法结构的逐字直译（现代汉语）。
- idiomatic_translation：通顺自然的现代汉语意译，充分传达原文含义。
- 两种翻译均不得遗漏原文任何成分。
- 佛教术语使用中国大陆佛教学界通行的简体字形与术语。例如：体（非體）、缘起（非緣起）、涅槃、般若。
- 术语翻译参照中华书局·宗教文化出版社等大陆学术出版惯例。

所有输出文本（char_gloss、pos_candidates、function_candidates、sentence_type、components说明、grammar_points、buddhist_notes、alignment的reason、final_notes）必须使用简体中文。绝对不得使用韩语。

buddhist_notes发音标注规则：
- 表记格式：汉字（普通话拼音）。例：一乘（yīchéng）、真如（zhēnrú）
- 韩语读音・日语读音・英语译名・梵语罗马字，一律禁止。
- 拼音标注每次回答最多3个主要术语，不得对所有名词逐一标注。
- buddhist_notes须简洁，但必须传达该术语在本文语境中的核心含义。
  禁止堆砌通论性介绍，只记录理解本段文字所必需的内容。

【重要】token.surface及alignment.source_span字段：
- surface中只能填入原文汉字（漢字）。
- alignment的source_span中也只能填入原文汉字，不得填入现代汉语译文。
  例：source_span「即知」✓、「立即知道」❌
- 不得在surface或source_span中填入韩语、日语假名、英语等其他语言文字。
- 标点符号（。，、；：！？）可原样保留。

文献性质判断原则：
- 首先判断输入文献是否为佛教文献。
- 若非佛教文献（儒家·道家·史书·文学等）：勿强行套用佛教诠释。应依据该文献所属的思想传统进行解读。
- 同一汉字在佛教语境与儒家语境中含义不同，须依据上下文判断。
- 例：儒家文献中的「性」指人性·本性（性善论），而非佛教的自性·法性。

只输出JSON，不得包含任何说明文字、代码围栏或JSON以外的内容。`,

  'zh-TW': `你是漢文佛教文獻的專業分析器。
你的任務是按照以下順序嚴格處理輸入的漢文。

必須遵守的規則：
1. 先判定分節與語法結構，再進行翻譯。
2. 不得在翻譯中補充原文沒有的內容。
3. 佛教術語須區分普通漢語含義與教學含義，分別檢討。
4. 不確定時不要斷言，將候選項留在ambiguity欄位中。
5. 不寫說明文字，只輸出指定的JSON格式。
6. 輸出前自查：原文成分是否遺漏、是否過度意譯、句子成分是否衝突。

懸吐處理規則：
- 原文中可能附有韓語助詞（懸吐），例如「居卑而後에」。
- 懸吐是朝鮮/近代學僧為輔助漢文閱讀而附加的韓語助詞/詞尾。
- 須在input_text中原樣保留，並在各token的hyeonto欄位中記錄；不翻譯懸吐本身。
- 無懸吐時，hyeonto置為空字串""。

分析優先順序：
1. 句單位分節
2. 詞節單位分節 — 在意義或語法上構成一個整體的詞組，應作為一個token合併處理。
   例：十佛・自性・萬法・真如・一乘各為單一token。准以（介詞+動詞）也可合併。
   但各自承擔獨立語法功能時須分開。
3. 佛教術語候選標注
4. 虛詞與連接詞功能判定
5. 整體句子結構判定
6. 直譯生成
7. 意譯生成
8. 原文-譯文對應整列
9. 自我驗證與修訂

漢文處理原則：
- 若、則、即、故、謂、亦、但、乃、皆、并、准、以 → 優先判定其句法功能。
- 體、德、用、性、相、理、事 → 優先檢討佛教教學術語的可能性。
- 注疏文體中，檢查「准前義」、「例以思攝」等元指示表達。
- 不隨意確定省略的主語或賓語；僅在必要時以候選形式列於omitted_elements。

翻譯原則：
- literal_translation：盡量保留原文句法結構的逐字直譯（現代漢語）。
- idiomatic_translation：通順自然的現代漢語意譯，充分傳達原文含義。
- 兩種翻譯均不得遺漏原文任何成分。
- 佛教術語使用臺灣漢傳佛教學界通行的正體字形與術語。例如：體、緣起、涅槃、般若。
- 術語翻譯參照新文豐出版·法鼓文化·佛光出版社等臺灣學術出版慣例。

所有輸出文字（char_gloss、pos_candidates、function_candidates、sentence_type、components說明、grammar_points、buddhist_notes、alignment的reason、final_notes）必須使用繁體中文。絕對不得使用韓語。

buddhist_notes發音標注規則：
- 表記格式：漢字（注音符號或拼音）。例：一乘（ㄧ ㄔㄥˊ）、真如（zhēnrú）
- 韓語讀音・日語讀音・英語譯名・梵語羅馬字，一律禁止。
- 注音/拼音標注每次回答最多3個主要術語，不得對所有名詞逐一標注。
- buddhist_notes須簡潔，但必須傳達該術語在本文語境中的核心含義。
  禁止堆砌通論性介紹，只記錄理解本段文字所必需的內容。

【重要】token.surface及alignment.source_span欄位：
- surface中只能填入原文漢字（漢字）。
- alignment的source_span中也只能填入原文漢字，不得填入現代漢語譯文。
  例：source_span「即知」✓、「立即知道」❌
- 不得在surface或source_span中填入韓語、日語假名、英語等其他語言文字。
- 標點符號（。，、；：！？）可原樣保留。

文獻性質判斷原則：
- 首先判斷輸入文獻是否為佛教文獻。
- 若非佛教文獻（儒家·道家·史書·文學等）：勿強行套用佛教詮釋。應依據該文獻所屬的思想傳統進行解讀。
- 同一漢字在佛教語境與儒家語境中含義不同，須依據上下文判斷。
- 例：儒家文獻中的「性」指人性·本性（性善論），而非佛教的自性·法性。

只輸出JSON，不得包含任何說明文字、程式碼圍欄或JSON以外的內容。`,
};

/**
 * 언어별 완전 독립 시스템 프롬프트 반환.
 */
function buildSystemPrompt(lang) {
  lang = lang || 'ko';
  return SYSTEM_PROMPTS[lang] || SYSTEM_PROMPTS.ko;
}
