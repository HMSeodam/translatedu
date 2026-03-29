/**
 * glossary.js
 * ──────────────────────────────────────────────
 * 불교 용어 사전 및 로컬 분석용 기본 데이터.
 *
 * - 다자어(多字語)를 먼저 매칭하기 위해 surface 길이 역순으로 정렬된 배열 제공
 * - 각 항목에는 surface(한문 표기), reading(한국어 독음), meaning(기본 뜻),
 *   buddhist_meaning(불교학적 의미), pos(기본 품사), category(분류) 포함
 * - 로컬 폴백 분석 시에도 이 사전 데이터를 활용
 */

// ───────── 용어 사전 원본 (정렬 전) ─────────
// readings: { ko, ja, 'zh-CN', 'zh-TW', en } — 다국어 독음
// reading: 한국어 독음 (하위 호환용 — getReading() 함수로 언어별 접근)

const GLOSSARY_RAW = [
  // ── 다자어(3자 이상) ──
  {
    surface: '不守自性',
    readings: { ko: '부수자성', ja: 'ふしゅじしょう', 'zh-CN': 'bùshǒu zìxìng', 'zh-TW': 'bùshǒu zìxìng', en: 'bushu jaseong' },
    reading: '부수자성',
    meaning: '자기 성품에 머물지 않음',
    buddhist_meaning: '진여가 고정된 자성에 머무르지 않고 연기적으로 전개됨을 나타내는 표현',
    pos: '동사구',
    category: '교리'
  },
  {
    surface: '隨緣',
    readings: { ko: '수연', ja: 'ずいえん', 'zh-CN': 'suíyuán', 'zh-TW': 'suíyuán', en: 'suyeon' },
    reading: '수연',
    meaning: '인연을 따름',
    buddhist_meaning: '진여가 조건(연)에 따라 현상 세계로 전개되는 것. 수연진여(隨緣眞如)의 핵심 개념',
    pos: '동사',
    category: '교리'
  },
  {
    surface: '准以思攝',
    readings: { ko: '준이사섭', ja: 'じゅんいししょう', 'zh-CN': 'zhǔn yǐ sī shè', 'zh-TW': 'zhǔn yǐ sī shè', en: 'junisaseop' },
    reading: '준이사섭',
    meaning: '앞의 예에 준하여 생각해 포섭하라',
    buddhist_meaning: '주석서에서 사용하는 메타 지시 구문. 독자에게 앞선 분석 방식을 적용해 이해하라는 뜻',
    pos: '구문',
    category: '주석용어'
  },
  {
    surface: '一乘',
    readings: { ko: '일승', ja: 'いちじょう', 'zh-CN': 'yīchéng', 'zh-TW': 'yīchéng', en: 'ilseung' },
    reading: '일승',
    meaning: '하나의 수레(가르침)',
    buddhist_meaning: '모든 중생을 성불에 이르게 하는 유일한 가르침. 화엄·법화에서 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '十佛',
    readings: { ko: '십불', ja: 'じゅうぶつ', 'zh-CN': 'shífó', 'zh-TW': 'shífó', en: 'sipbul' },
    reading: '십불',
    meaning: '열 부처',
    buddhist_meaning: '화엄경에서 설하는 열 가지 불(佛)의 양상. 성불(成佛)·원불(願佛)·업보불(業報佛) 등',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '真如',
    readings: { ko: '진여', ja: 'しんにょ', 'zh-CN': 'zhēnrú', 'zh-TW': 'zhēnrú', en: 'jinyeo' },
    reading: '진여',
    meaning: '참다운 그러함',
    buddhist_meaning: '있는 그대로의 궁극적 실재. 여실(如實)한 존재 양태. 대승기신론의 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '緣起',
    readings: { ko: '연기', ja: 'えんぎ', 'zh-CN': 'yuánqǐ', 'zh-TW': 'yuánqǐ', en: 'yeongi' },
    reading: '연기',
    meaning: '인연에 의해 일어남',
    buddhist_meaning: '모든 존재와 현상은 원인(因)과 조건(緣)의 화합으로 생겨남. 불교의 핵심 원리',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '法界',
    readings: { ko: '법계', ja: 'ほっかい', 'zh-CN': 'fǎjiè', 'zh-TW': 'fǎjiè', en: 'beopgye' },
    reading: '법계',
    meaning: '법의 세계',
    buddhist_meaning: '존재의 총체적 영역. 화엄에서는 사사무애법계(事事無礙法界) 등 네 법계 설정',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '菩薩',
    readings: { ko: '보살', ja: 'ぼさつ', 'zh-CN': 'púsà', 'zh-TW': 'púsà', en: 'bosal' },
    reading: '보살',
    meaning: '깨달음의 존재',
    buddhist_meaning: '보리살타(bodhisattva)의 약칭. 자리이타(自利利他)를 실천하여 성불을 구하는 수행자',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '如來',
    readings: { ko: '여래', ja: 'にょらい', 'zh-CN': 'rúlái', 'zh-TW': 'rúlái', en: 'yeorae' },
    reading: '여래',
    meaning: '이와 같이 온 자',
    buddhist_meaning: '부처의 십호(十號) 중 하나. 진여에서 와서 진여로 간다는 뜻(tathāgata)',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '萬法',
    readings: { ko: '만법', ja: 'まんぽう', 'zh-CN': 'wànfǎ', 'zh-TW': 'wànfǎ', en: 'manbeop' },
    reading: '만법',
    meaning: '온갖 현상/법',
    buddhist_meaning: '세간과 출세간의 모든 존재·현상을 총칭',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '自性',
    readings: { ko: '자성', ja: 'じしょう', 'zh-CN': 'zìxìng', 'zh-TW': 'zìxìng', en: 'jaseong' },
    reading: '자성',
    meaning: '자기의 성품',
    buddhist_meaning: '스스로의 본성. 고유한 실체. 중관학에서는 공(空)으로 부정되는 대상',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '體德用',
    readings: { ko: '체덕용', ja: 'たいとくゆう', 'zh-CN': 'tǐdéyòng', 'zh-TW': 'tǐdéyòng', en: 'chedeokyong' },
    reading: '체덕용',
    meaning: '본체·공덕·작용',
    buddhist_meaning: '존재를 체(본질)·덕(속성/공덕)·용(기능/작용) 세 측면으로 분석하는 틀',
    pos: '명사구',
    category: '교리'
  },

  // ── 2자어 ──
  {
    surface: '攝多',
    readings: { ko: '섭다', ja: 'しょうた', 'zh-CN': 'shèduō', 'zh-TW': 'shèduō', en: 'seopda' },
    reading: '섭다',
    meaning: '많은 것을 포섭함',
    buddhist_meaning: '하나가 다수를 거두어 포함함. 화엄의 일즉다(一即多) 사상과 관련',
    pos: '동사구',
    category: '교리'
  },

  // ── 단자어(1자) ── 핵심 불교 용어 ──
  {
    surface: '體',
    readings: { ko: '체', ja: 'たい', 'zh-CN': 'tǐ', 'zh-TW': 'tǐ', en: 'che' },
    reading: '체',
    meaning: '몸, 본체',
    buddhist_meaning: '존재의 본질·본체. 체상용(體相用) 삼대(三大)에서 근본 실체를 가리킴',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '德',
    readings: { ko: '덕', ja: 'とく', 'zh-CN': 'dé', 'zh-TW': 'dé', en: 'deok' },
    reading: '덕',
    meaning: '덕, 공덕',
    buddhist_meaning: '부처나 법의 공덕·속성. 체(體)에 갖추어진 수승한 성질',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '用',
    readings: { ko: '용', ja: 'ゆう', 'zh-CN': 'yòng', 'zh-TW': 'yòng', en: 'yong' },
    reading: '용',
    meaning: '작용, 쓰임',
    buddhist_meaning: '기능과 작용. 체(體)로부터 드러나는 실제적 활동',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '性',
    readings: { ko: '성', ja: 'しょう', 'zh-CN': 'xìng', 'zh-TW': 'xìng', en: 'seong' },
    reading: '성',
    meaning: '성품, 본성',
    buddhist_meaning: '사물의 본성·본질. 불성(佛性)·법성(法性) 등에서 핵심 요소',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '相',
    readings: { ko: '상', ja: 'そう', 'zh-CN': 'xiàng', 'zh-TW': 'xiàng', en: 'sang' },
    reading: '상',
    meaning: '모양, 양상',
    buddhist_meaning: '현상적 측면·모습. 체(體)의 드러남. 성(性)과 대비되는 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '理',
    readings: { ko: '리', ja: 'り', 'zh-CN': 'lǐ', 'zh-TW': 'lǐ', en: 'ri' },
    reading: '리',
    meaning: '이치, 원리',
    buddhist_meaning: '궁극적 원리·진리. 사(事)와 대비. 화엄의 이사무애(理事無礙) 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '事',
    readings: { ko: '사', ja: 'じ', 'zh-CN': 'shì', 'zh-TW': 'shì', en: 'sa' },
    reading: '사',
    meaning: '일, 현상',
    buddhist_meaning: '현상적 사태·구체적 존재. 이(理)와 대비. 사사무애(事事無礙)의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '佛',
    readings: { ko: '불', ja: 'ぶつ', 'zh-CN': 'fó', 'zh-TW': 'fó', en: 'bul' },
    reading: '불',
    meaning: '부처',
    buddhist_meaning: '깨달은 자(Buddha). 자각(自覺)·각타(覺他)·각행원만(覺行圓滿)의 존재',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '法',
    readings: { ko: '법', ja: 'ほう', 'zh-CN': 'fǎ', 'zh-TW': 'fǎ', en: 'beop' },
    reading: '법',
    meaning: '법, 가르침',
    buddhist_meaning: '진리·가르침(dharma). 또한 모든 존재·현상을 가리키기도 함',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '空',
    readings: { ko: '공', ja: 'くう', 'zh-CN': 'kōng', 'zh-TW': 'kōng', en: 'gong' },
    reading: '공',
    meaning: '비어 있음',
    buddhist_meaning: '자성이 없음(śūnyatā). 실체가 없다는 중관학의 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '心',
    readings: { ko: '심', ja: 'しん', 'zh-CN': 'xīn', 'zh-TW': 'xīn', en: 'sim' },
    reading: '심',
    meaning: '마음',
    buddhist_meaning: '정신 작용의 총체. 유식학에서는 제8 아뢰야식을 특히 심(心)이라 함',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '道',
    readings: { ko: '도', ja: 'どう', 'zh-CN': 'dào', 'zh-TW': 'dào', en: 'do' },
    reading: '도',
    meaning: '길, 도리',
    buddhist_meaning: '수행의 길·깨달음에 이르는 방법. 팔정도(八正道) 등',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '因',
    readings: { ko: '인', ja: 'いん', 'zh-CN': 'yīn', 'zh-TW': 'yīn', en: 'in' },
    reading: '인',
    meaning: '원인',
    buddhist_meaning: '결과를 일으키는 직접적 원인. 연(緣)과 함께 인연(因緣)을 구성',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '果',
    readings: { ko: '과', ja: 'か', 'zh-CN': 'guǒ', 'zh-TW': 'guǒ', en: 'gwa' },
    reading: '과',
    meaning: '결과',
    buddhist_meaning: '인(因)과 연(緣)에 의해 생기는 결과',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '業',
    readings: { ko: '업', ja: 'ごう', 'zh-CN': 'yè', 'zh-TW': 'yè', en: 'eop' },
    reading: '업',
    meaning: '행위',
    buddhist_meaning: '의도적 행위(karma)와 그 잠재적 영향력',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '定',
    readings: { ko: '정', ja: 'じょう', 'zh-CN': 'dìng', 'zh-TW': 'dìng', en: 'jeong' },
    reading: '정',
    meaning: '안정, 선정',
    buddhist_meaning: '마음을 한곳에 집중하는 수행(samādhi). 삼학(三學)의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '慧',
    readings: { ko: '혜', ja: 'え', 'zh-CN': 'huì', 'zh-TW': 'huì', en: 'hye' },
    reading: '혜',
    meaning: '지혜',
    buddhist_meaning: '사물의 참된 모습을 꿰뚫어 아는 힘(prajñā). 삼학의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '戒',
    readings: { ko: '계', ja: 'かい', 'zh-CN': 'jiè', 'zh-TW': 'jiè', en: 'gye' },
    reading: '계',
    meaning: '계율',
    buddhist_meaning: '행위의 규범(śīla). 삼학의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '觀',
    readings: { ko: '관', ja: 'かん', 'zh-CN': 'guān', 'zh-TW': 'guān', en: 'gwan' },
    reading: '관',
    meaning: '관찰',
    buddhist_meaning: '지혜로운 관찰(vipaśyanā). 지관(止觀) 수행에서 핵심',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '識',
    readings: { ko: '식', ja: 'しき', 'zh-CN': 'shí', 'zh-TW': 'shí', en: 'sik' },
    reading: '식',
    meaning: '의식, 인식',
    buddhist_meaning: '인식 작용(vijñāna). 유식학에서 8식 체계의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '苦',
    readings: { ko: '고', ja: 'く', 'zh-CN': 'kǔ', 'zh-TW': 'kǔ', en: 'go' },
    reading: '고',
    meaning: '괴로움',
    buddhist_meaning: '존재의 근본적 괴로움(duḥkha). 사성제의 첫째',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '滅',
    readings: { ko: '멸', ja: 'めつ', 'zh-CN': 'miè', 'zh-TW': 'miè', en: 'myeol' },
    reading: '멸',
    meaning: '소멸',
    buddhist_meaning: '괴로움의 소멸(nirodha). 사성제의 셋째. 열반을 가리킴',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '涅槃',
    readings: { ko: '열반', ja: 'ねはん', 'zh-CN': 'nièpán', 'zh-TW': 'nièpán', en: 'yeolban' },
    reading: '열반',
    meaning: '불어 끔, 적멸',
    buddhist_meaning: '번뇌의 불이 꺼진 궁극적 평화(nirvāṇa)',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '般若',
    readings: { ko: '반야', ja: 'はんにゃ', 'zh-CN': 'bōrě', 'zh-TW': 'bōrě', en: 'banya' },
    reading: '반야',
    meaning: '지혜',
    buddhist_meaning: '제법의 실상을 꿰뚫는 최고의 지혜(prajñā). 바라밀의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '波羅蜜',
    readings: { ko: '바라밀', ja: 'はらみつ', 'zh-CN': 'bōluómì', 'zh-TW': 'bōluómì', en: 'baramil' },
    reading: '바라밀',
    meaning: '피안에 이름',
    buddhist_meaning: '완성·도달(pāramitā). 보살 수행의 완성 단계',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '三昧',
    readings: { ko: '삼매', ja: 'さんまい', 'zh-CN': 'sānmèi', 'zh-TW': 'sānmèi', en: 'sammae' },
    reading: '삼매',
    meaning: '선정, 삼매',
    buddhist_meaning: '마음이 한곳에 안정된 상태(samādhi)',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '無明',
    readings: { ko: '무명', ja: 'むみょう', 'zh-CN': 'wúmíng', 'zh-TW': 'wúmíng', en: 'mumyeong' },
    reading: '무명',
    meaning: '밝지 못함',
    buddhist_meaning: '근본적 무지(avidyā). 십이연기의 첫째',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '煩惱',
    readings: { ko: '번뇌', ja: 'ぼんのう', 'zh-CN': 'fánnǎo', 'zh-TW': 'fánnǎo', en: 'beonnoe' },
    reading: '번뇌',
    meaning: '번거롭고 괴로움',
    buddhist_meaning: '마음을 혼란스럽게 하는 정신적 오염(kleśa)',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '解脫',
    readings: { ko: '해탈', ja: 'げだつ', 'zh-CN': 'jiětuō', 'zh-TW': 'jiětuō', en: 'haetal' },
    reading: '해탈',
    meaning: '벗어남',
    buddhist_meaning: '속박에서 벗어남(vimokṣa/mukti). 열반과 관련',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '輪迴',
    readings: { ko: '윤회', ja: 'りんね', 'zh-CN': 'lúnhuí', 'zh-TW': 'lúnhuí', en: 'yunhoe' },
    reading: '윤회',
    meaning: '돌고 돎',
    buddhist_meaning: '생사의 순환(saṃsāra). 육도(六道)를 돌아다님',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '中道',
    readings: { ko: '중도', ja: 'ちゅうどう', 'zh-CN': 'zhōngdào', 'zh-TW': 'zhōngdào', en: 'jungdo' },
    reading: '중도',
    meaning: '중간의 길',
    buddhist_meaning: '양극단을 떠난 바른 입장. 용수의 중관학 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '唯識',
    readings: { ko: '유식', ja: 'ゆいしき', 'zh-CN': 'wéishí', 'zh-TW': 'wéishí', en: 'yusik' },
    reading: '유식',
    meaning: '오직 의식',
    buddhist_meaning: '모든 존재는 식(識)의 변현이라는 유식학의 핵심 주장',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '阿賴耶識',
    readings: { ko: '아뢰야식', ja: 'あらやしき', 'zh-CN': 'āláiyēshí', 'zh-TW': 'āláiyēshí', en: 'aroe-yasik' },
    reading: '아뢰야식',
    meaning: '저장하는 의식',
    buddhist_meaning: '제8식(ālayavijñāna). 모든 종자를 저장하는 근본 의식',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '圓融',
    readings: { ko: '원융', ja: 'えんゆう', 'zh-CN': 'yuánróng', 'zh-TW': 'yuánróng', en: 'wonyung' },
    reading: '원융',
    meaning: '둥글게 융합함',
    buddhist_meaning: '화엄·천태에서 모든 법이 서로 걸림 없이 융합하는 것',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '無礙',
    readings: { ko: '무애', ja: 'むげ', 'zh-CN': 'wúài', 'zh-TW': 'wúài', en: 'muae' },
    reading: '무애',
    meaning: '걸림 없음',
    buddhist_meaning: '화엄의 핵심 용어. 이사무애(理事無礙)·사사무애(事事無礙)',
    pos: '형용사',
    category: '교리'
  }
];

// ───────── 허사·기능어 사전 (로컬 폴백용) ─────────
const FUNCTION_WORDS = [
  { surface: '若', readings: { ko: '약', ja: 'じゃく', 'zh-CN': 'ruò', 'zh-TW': 'ruò', en: 'yak' }, reading: '약', meaning: '만약 ~라면', pos: '접속사/조건', category: '허사' },
  { surface: '則', readings: { ko: '즉', ja: 'そく', 'zh-CN': 'zé', 'zh-TW': 'zé', en: 'jeuk' }, reading: '즉', meaning: '곧, ~이면', pos: '접속사/결과', category: '허사' },
  { surface: '即', readings: { ko: '즉', ja: 'そく', 'zh-CN': 'jí', 'zh-TW': 'jí', en: 'jeuk' }, reading: '즉', meaning: '곧, 바로', pos: '부사/접속사', category: '허사' },
  { surface: '故', readings: { ko: '고', ja: 'こ', 'zh-CN': 'gù', 'zh-TW': 'gù', en: 'go' }, reading: '고', meaning: '그러므로', pos: '접속사/인과', category: '허사' },
  { surface: '謂', readings: { ko: '위', ja: 'い', 'zh-CN': 'wèi', 'zh-TW': 'wèi', en: 'wi' }, reading: '위', meaning: '이르다, 말하다', pos: '동사', category: '허사' },
  { surface: '亦', readings: { ko: '역', ja: 'えき', 'zh-CN': 'yì', 'zh-TW': 'yì', en: 'yeok' }, reading: '역', meaning: '또한', pos: '부사', category: '허사' },
  { surface: '但', readings: { ko: '단', ja: 'たん', 'zh-CN': 'dàn', 'zh-TW': 'dàn', en: 'dan' }, reading: '단', meaning: '다만', pos: '부사', category: '허사' },
  { surface: '乃', readings: { ko: '내', ja: 'ない', 'zh-CN': 'nǎi', 'zh-TW': 'nǎi', en: 'nae' }, reading: '내', meaning: '이에, 곧', pos: '부사/접속사', category: '허사' },
  { surface: '皆', readings: { ko: '개', ja: 'かい', 'zh-CN': 'jiē', 'zh-TW': 'jiē', en: 'gae' }, reading: '개', meaning: '모두', pos: '부사', category: '허사' },
  { surface: '并', readings: { ko: '병', ja: 'へい', 'zh-CN': 'bìng', 'zh-TW': 'bìng', en: 'byeong' }, reading: '병', meaning: '아울러, 함께', pos: '부사/접속사', category: '허사' },
  { surface: '准', readings: { ko: '준', ja: 'じゅん', 'zh-CN': 'zhǔn', 'zh-TW': 'zhǔn', en: 'jun' }, reading: '준', meaning: '준하다, 따르다', pos: '동사', category: '허사' },
  { surface: '以', readings: { ko: '이', ja: 'い', 'zh-CN': 'yǐ', 'zh-TW': 'yǐ', en: 'i' }, reading: '이', meaning: '~으로써, ~을', pos: '전치사/접속사', category: '허사' },
  { surface: '依', readings: { ko: '의', ja: 'え', 'zh-CN': 'yī', 'zh-TW': 'yī', en: 'ui' }, reading: '의', meaning: '~에 의거하다', pos: '동사/전치사', category: '허사' },
  { surface: '於', readings: { ko: '어', ja: 'お', 'zh-CN': 'yú', 'zh-TW': 'yú', en: 'eo' }, reading: '어', meaning: '~에, ~에서', pos: '전치사', category: '허사' },
  { surface: '而', readings: { ko: '이', ja: 'じ', 'zh-CN': 'ér', 'zh-TW': 'ér', en: 'i' }, reading: '이', meaning: '그리하여, ~하고', pos: '접속사', category: '허사' },
  { surface: '之', readings: { ko: '지', ja: 'し', 'zh-CN': 'zhī', 'zh-TW': 'zhī', en: 'ji' }, reading: '지', meaning: '~의, 그것', pos: '대명사/조사', category: '허사' },
  { surface: '者', readings: { ko: '자', ja: 'しゃ', 'zh-CN': 'zhě', 'zh-TW': 'zhě', en: 'ja' }, reading: '자', meaning: '~하는 것/자', pos: '조사', category: '허사' },
  { surface: '也', readings: { ko: '야', ja: 'や', 'zh-CN': 'yě', 'zh-TW': 'yě', en: 'ya' }, reading: '야', meaning: '~이다(판단)', pos: '어기사', category: '허사' },
  { surface: '不', readings: { ko: '불', ja: 'ふ', 'zh-CN': 'bù', 'zh-TW': 'bù', en: 'bul' }, reading: '불', meaning: '~아니다', pos: '부정부사', category: '허사' },
  { surface: '無', readings: { ko: '무', ja: 'む', 'zh-CN': 'wú', 'zh-TW': 'wú', en: 'mu' }, reading: '무', meaning: '없다', pos: '부정/형용사', category: '허사' },
  { surface: '有', readings: { ko: '유', ja: 'う', 'zh-CN': 'yǒu', 'zh-TW': 'yǒu', en: 'yu' }, reading: '유', meaning: '있다', pos: '동사', category: '허사' },
  { surface: '非', readings: { ko: '비', ja: 'ひ', 'zh-CN': 'fēi', 'zh-TW': 'fēi', en: 'bi' }, reading: '비', meaning: '~이 아니다', pos: '부정부사', category: '허사' },
  { surface: '所', readings: { ko: '소', ja: 'しょ', 'zh-CN': 'suǒ', 'zh-TW': 'suǒ', en: 'so' }, reading: '소', meaning: '~하는 바', pos: '조사', category: '허사' },
  { surface: '為', readings: { ko: '위', ja: 'い', 'zh-CN': 'wéi', 'zh-TW': 'wéi', en: 'wi' }, reading: '위', meaning: '~을 위하다, ~이 되다', pos: '동사/전치사', category: '허사' },
  { surface: '能', readings: { ko: '능', ja: 'のう', 'zh-CN': 'néng', 'zh-TW': 'néng', en: 'neung' }, reading: '능', meaning: '능히 ~하다', pos: '조동사', category: '허사' },
  { surface: '可', readings: { ko: '가', ja: 'か', 'zh-CN': 'kě', 'zh-TW': 'kě', en: 'ga' }, reading: '가', meaning: '~할 수 있다', pos: '조동사', category: '허사' },
  { surface: '當', readings: { ko: '당', ja: 'とう', 'zh-CN': 'dāng', 'zh-TW': 'dāng', en: 'dang' }, reading: '당', meaning: '마땅히 ~해야 한다', pos: '조동사', category: '허사' },
  { surface: '此', readings: { ko: '차', ja: 'し', 'zh-CN': 'cǐ', 'zh-TW': 'cǐ', en: 'cha' }, reading: '차', meaning: '이, 이것', pos: '대명사', category: '허사' },
  { surface: '其', readings: { ko: '기', ja: 'き', 'zh-CN': 'qí', 'zh-TW': 'qí', en: 'gi' }, reading: '기', meaning: '그, 그것', pos: '대명사', category: '허사' },
  { surface: '是', readings: { ko: '시', ja: 'ぜ', 'zh-CN': 'shì', 'zh-TW': 'shì', en: 'si' }, reading: '시', meaning: '이, ~이다', pos: '대명사/판단사', category: '허사' },
  { surface: '中', readings: { ko: '중', ja: 'ちゅう', 'zh-CN': 'zhōng', 'zh-TW': 'zhōng', en: 'jung' }, reading: '중', meaning: '가운데', pos: '명사/위치사', category: '허사' },
  { surface: '具', readings: { ko: '구', ja: 'ぐ', 'zh-CN': 'jù', 'zh-TW': 'jù', en: 'gu' }, reading: '구', meaning: '갖추다', pos: '동사', category: '허사' },
  { surface: '成', readings: { ko: '성', ja: 'じょう', 'zh-CN': 'chéng', 'zh-TW': 'chéng', en: 'seong' }, reading: '성', meaning: '이루다', pos: '동사', category: '허사' },
  { surface: '攝', readings: { ko: '섭', ja: 'しょう', 'zh-CN': 'shè', 'zh-TW': 'shè', en: 'seop' }, reading: '섭', meaning: '포섭하다, 거두다', pos: '동사', category: '허사' },
  { surface: '思', readings: { ko: '사', ja: 'し', 'zh-CN': 'sī', 'zh-TW': 'sī', en: 'sa' }, reading: '사', meaning: '생각하다', pos: '동사', category: '허사' },
  { surface: '多', readings: { ko: '다', ja: 'た', 'zh-CN': 'duō', 'zh-TW': 'duō', en: 'da' }, reading: '다', meaning: '많다, 많은 것', pos: '형용사/명사', category: '허사' },
  { surface: '一', readings: { ko: '일', ja: 'いち', 'zh-CN': 'yī', 'zh-TW': 'yī', en: 'il' }, reading: '일', meaning: '하나', pos: '수사', category: '허사' }
];

/**
 * 언어별 독음(reading)을 반환하는 유틸리티 함수.
 * entry.readings 객체가 있으면 언어별 값을, 없으면 entry.reading(한국어) 폴백.
 * @param {object} entry - GLOSSARY 항목
 * @param {string} lang - 'ko' | 'en' | 'ja' | 'zh-CN' | 'zh-TW'
 * @returns {string}
 */
function getReading(entry, lang) {
  if (!entry) return '';
  if (entry.readings && entry.readings[lang]) {
    return entry.readings[lang];
  }
  return entry.reading || '';
}

/**
 * 다자어 우선 매칭을 위해 surface 길이 역순으로 정렬된 용어 사전.
 * GLOSSARY_RAW + FUNCTION_WORDS 를 합친 뒤 surface 길이 내림차순 정렬.
 */
const GLOSSARY = [...GLOSSARY_RAW, ...FUNCTION_WORDS]
  .sort((a, b) => b.surface.length - a.surface.length);

/**
 * 불교 용어만(허사 제외) 추출한 배열 — glossary_hints 생성용
 */
const BUDDHIST_TERMS_ONLY = GLOSSARY_RAW
  .sort((a, b) => b.surface.length - a.surface.length);
