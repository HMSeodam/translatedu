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
const GLOSSARY_RAW = [
  // ── 다자어(3자 이상) ──
  {
    surface: '不守自性',
    reading: '부수자성',
    meaning: '자기 성품에 머물지 않음',
    buddhist_meaning: '진여가 고정된 자성에 머무르지 않고 연기적으로 전개됨을 나타내는 표현',
    pos: '동사구',
    category: '교리'
  },
  {
    surface: '隨緣',
    reading: '수연',
    meaning: '인연을 따름',
    buddhist_meaning: '진여가 조건(연)에 따라 현상 세계로 전개되는 것. 수연진여(隨緣眞如)의 핵심 개념',
    pos: '동사',
    category: '교리'
  },
  {
    surface: '准以思攝',
    reading: '준이사섭',
    meaning: '앞의 예에 준하여 생각해 포섭하라',
    buddhist_meaning: '주석서에서 사용하는 메타 지시 구문. 독자에게 앞선 분석 방식을 적용해 이해하라는 뜻',
    pos: '구문',
    category: '주석용어'
  },
  {
    surface: '一乘',
    reading: '일승',
    meaning: '하나의 수레(가르침)',
    buddhist_meaning: '모든 중생을 성불에 이르게 하는 유일한 가르침. 화엄·법화에서 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '十佛',
    reading: '십불',
    meaning: '열 부처',
    buddhist_meaning: '화엄경에서 설하는 열 가지 불(佛)의 양상. 성불(成佛)·원불(願佛)·업보불(業報佛) 등',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '真如',
    reading: '진여',
    meaning: '참다운 그러함',
    buddhist_meaning: '있는 그대로의 궁극적 실재. 여실(如實)한 존재 양태. 대승기신론의 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '緣起',
    reading: '연기',
    meaning: '인연에 의해 일어남',
    buddhist_meaning: '모든 존재와 현상은 원인(因)과 조건(緣)의 화합으로 생겨남. 불교의 핵심 원리',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '法界',
    reading: '법계',
    meaning: '법의 세계',
    buddhist_meaning: '존재의 총체적 영역. 화엄에서는 사사무애법계(事事無礙法界) 등 네 법계 설정',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '菩薩',
    reading: '보살',
    meaning: '깨달음의 존재',
    buddhist_meaning: '보리살타(bodhisattva)의 약칭. 자리이타(自利利他)를 실천하여 성불을 구하는 수행자',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '如來',
    reading: '여래',
    meaning: '이와 같이 온 자',
    buddhist_meaning: '부처의 십호(十號) 중 하나. 진여에서 와서 진여로 간다는 뜻(tathāgata)',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '萬法',
    reading: '만법',
    meaning: '온갖 현상/법',
    buddhist_meaning: '세간과 출세간의 모든 존재·현상을 총칭',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '自性',
    reading: '자성',
    meaning: '자기의 성품',
    buddhist_meaning: '스스로의 본성. 고유한 실체. 중관학에서는 공(空)으로 부정되는 대상',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '體德用',
    reading: '체덕용',
    meaning: '본체·공덕·작용',
    buddhist_meaning: '존재를 체(본질)·덕(속성/공덕)·용(기능/작용) 세 측면으로 분석하는 틀',
    pos: '명사구',
    category: '교리'
  },

  // ── 2자어 ──
  {
    surface: '攝多',
    reading: '섭다',
    meaning: '많은 것을 포섭함',
    buddhist_meaning: '하나가 다수를 거두어 포함함. 화엄의 일즉다(一即多) 사상과 관련',
    pos: '동사구',
    category: '교리'
  },

  // ── 단자어(1자) ── 핵심 불교 용어 ──
  {
    surface: '體',
    reading: '체',
    meaning: '몸, 본체',
    buddhist_meaning: '존재의 본질·본체. 체상용(體相用) 삼대(三大)에서 근본 실체를 가리킴',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '德',
    reading: '덕',
    meaning: '덕, 공덕',
    buddhist_meaning: '부처나 법의 공덕·속성. 체(體)에 갖추어진 수승한 성질',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '用',
    reading: '용',
    meaning: '작용, 쓰임',
    buddhist_meaning: '기능과 작용. 체(體)로부터 드러나는 실제적 활동',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '性',
    reading: '성',
    meaning: '성품, 본성',
    buddhist_meaning: '사물의 본성·본질. 불성(佛性)·법성(法性) 등에서 핵심 요소',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '相',
    reading: '상',
    meaning: '모양, 양상',
    buddhist_meaning: '현상적 측면·모습. 체(體)의 드러남. 성(性)과 대비되는 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '理',
    reading: '리',
    meaning: '이치, 원리',
    buddhist_meaning: '궁극적 원리·진리. 사(事)와 대비. 화엄의 이사무애(理事無礙) 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '事',
    reading: '사',
    meaning: '일, 현상',
    buddhist_meaning: '현상적 사태·구체적 존재. 이(理)와 대비. 사사무애(事事無礙)의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '佛',
    reading: '불',
    meaning: '부처',
    buddhist_meaning: '깨달은 자(Buddha). 자각(自覺)·각타(覺他)·각행원만(覺行圓滿)의 존재',
    pos: '명사',
    category: '불보살'
  },
  {
    surface: '法',
    reading: '법',
    meaning: '법, 가르침',
    buddhist_meaning: '진리·가르침(dharma). 또한 모든 존재·현상을 가리키기도 함',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '空',
    reading: '공',
    meaning: '비어 있음',
    buddhist_meaning: '자성이 없음(śūnyatā). 실체가 없다는 중관학의 핵심 개념',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '心',
    reading: '심',
    meaning: '마음',
    buddhist_meaning: '정신 작용의 총체. 유식학에서는 제8 아뢰야식을 특히 심(心)이라 함',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '道',
    reading: '도',
    meaning: '길, 도리',
    buddhist_meaning: '수행의 길·깨달음에 이르는 방법. 팔정도(八正道) 등',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '因',
    reading: '인',
    meaning: '원인',
    buddhist_meaning: '결과를 일으키는 직접적 원인. 연(緣)과 함께 인연(因緣)을 구성',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '果',
    reading: '과',
    meaning: '결과',
    buddhist_meaning: '인(因)과 연(緣)에 의해 생기는 결과',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '業',
    reading: '업',
    meaning: '행위',
    buddhist_meaning: '의도적 행위(karma)와 그 잠재적 영향력',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '定',
    reading: '정',
    meaning: '안정, 선정',
    buddhist_meaning: '마음을 한곳에 집중하는 수행(samādhi). 삼학(三學)의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '慧',
    reading: '혜',
    meaning: '지혜',
    buddhist_meaning: '사물의 참된 모습을 꿰뚫어 아는 힘(prajñā). 삼학의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '戒',
    reading: '계',
    meaning: '계율',
    buddhist_meaning: '행위의 규범(śīla). 삼학의 하나',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '觀',
    reading: '관',
    meaning: '관찰',
    buddhist_meaning: '지혜로운 관찰(vipaśyanā). 지관(止觀) 수행에서 핵심',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '識',
    reading: '식',
    meaning: '의식, 인식',
    buddhist_meaning: '인식 작용(vijñāna). 유식학에서 8식 체계의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '苦',
    reading: '고',
    meaning: '괴로움',
    buddhist_meaning: '존재의 근본적 괴로움(duḥkha). 사성제의 첫째',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '滅',
    reading: '멸',
    meaning: '소멸',
    buddhist_meaning: '괴로움의 소멸(nirodha). 사성제의 셋째. 열반을 가리킴',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '涅槃',
    reading: '열반',
    meaning: '불어 끔, 적멸',
    buddhist_meaning: '번뇌의 불이 꺼진 궁극적 평화(nirvāṇa)',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '般若',
    reading: '반야',
    meaning: '지혜',
    buddhist_meaning: '제법의 실상을 꿰뚫는 최고의 지혜(prajñā). 바라밀의 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '波羅蜜',
    reading: '바라밀',
    meaning: '피안에 이름',
    buddhist_meaning: '완성·도달(pāramitā). 보살 수행의 완성 단계',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '三昧',
    reading: '삼매',
    meaning: '선정, 삼매',
    buddhist_meaning: '마음이 한곳에 안정된 상태(samādhi)',
    pos: '명사',
    category: '수행'
  },
  {
    surface: '無明',
    reading: '무명',
    meaning: '밝지 못함',
    buddhist_meaning: '근본적 무지(avidyā). 십이연기의 첫째',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '煩惱',
    reading: '번뇌',
    meaning: '번거롭고 괴로움',
    buddhist_meaning: '마음을 혼란스럽게 하는 정신적 오염(kleśa)',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '解脫',
    reading: '해탈',
    meaning: '벗어남',
    buddhist_meaning: '속박에서 벗어남(vimokṣa/mukti). 열반과 관련',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '輪迴',
    reading: '윤회',
    meaning: '돌고 돎',
    buddhist_meaning: '생사의 순환(saṃsāra). 육도(六道)를 돌아다님',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '中道',
    reading: '중도',
    meaning: '중간의 길',
    buddhist_meaning: '양극단을 떠난 바른 입장. 용수의 중관학 핵심',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '唯識',
    reading: '유식',
    meaning: '오직 의식',
    buddhist_meaning: '모든 존재는 식(識)의 변현이라는 유식학의 핵심 주장',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '阿賴耶識',
    reading: '아뢰야식',
    meaning: '저장하는 의식',
    buddhist_meaning: '제8식(ālayavijñāna). 모든 종자를 저장하는 근본 의식',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '圓融',
    reading: '원융',
    meaning: '둥글게 융합함',
    buddhist_meaning: '화엄·천태에서 모든 법이 서로 걸림 없이 융합하는 것',
    pos: '명사',
    category: '교리'
  },
  {
    surface: '無礙',
    reading: '무애',
    meaning: '걸림 없음',
    buddhist_meaning: '화엄의 핵심 용어. 이사무애(理事無礙)·사사무애(事事無礙)',
    pos: '형용사',
    category: '교리'
  }
];

// ───────── 허사·기능어 사전 (로컬 폴백용) ─────────
const FUNCTION_WORDS = [
  { surface: '若', reading: '약', meaning: '만약 ~라면', pos: '접속사/조건', category: '허사' },
  { surface: '則', reading: '즉', meaning: '곧, ~이면', pos: '접속사/결과', category: '허사' },
  { surface: '即', reading: '즉', meaning: '곧, 바로', pos: '부사/접속사', category: '허사' },
  { surface: '故', reading: '고', meaning: '그러므로', pos: '접속사/인과', category: '허사' },
  { surface: '謂', reading: '위', meaning: '이르다, 말하다', pos: '동사', category: '허사' },
  { surface: '亦', reading: '역', meaning: '또한', pos: '부사', category: '허사' },
  { surface: '但', reading: '단', meaning: '다만', pos: '부사', category: '허사' },
  { surface: '乃', reading: '내', meaning: '이에, 곧', pos: '부사/접속사', category: '허사' },
  { surface: '皆', reading: '개', meaning: '모두', pos: '부사', category: '허사' },
  { surface: '并', reading: '병', meaning: '아울러, 함께', pos: '부사/접속사', category: '허사' },
  { surface: '准', reading: '준', meaning: '준하다, 따르다', pos: '동사', category: '허사' },
  { surface: '以', reading: '이', meaning: '~으로써, ~을', pos: '전치사/접속사', category: '허사' },
  { surface: '依', reading: '의', meaning: '~에 의거하다', pos: '동사/전치사', category: '허사' },
  { surface: '於', reading: '어', meaning: '~에, ~에서', pos: '전치사', category: '허사' },
  { surface: '而', reading: '이', meaning: '그리하여, ~하고', pos: '접속사', category: '허사' },
  { surface: '之', reading: '지', meaning: '~의, 그것', pos: '대명사/조사', category: '허사' },
  { surface: '者', reading: '자', meaning: '~하는 것/자', pos: '조사', category: '허사' },
  { surface: '也', reading: '야', meaning: '~이다(판단)', pos: '어기사', category: '허사' },
  { surface: '不', reading: '불', meaning: '~아니다', pos: '부정부사', category: '허사' },
  { surface: '無', reading: '무', meaning: '없다', pos: '부정/형용사', category: '허사' },
  { surface: '有', reading: '유', meaning: '있다', pos: '동사', category: '허사' },
  { surface: '非', reading: '비', meaning: '~이 아니다', pos: '부정부사', category: '허사' },
  { surface: '所', reading: '소', meaning: '~하는 바', pos: '조사', category: '허사' },
  { surface: '為', reading: '위', meaning: '~을 위하다, ~이 되다', pos: '동사/전치사', category: '허사' },
  { surface: '能', reading: '능', meaning: '능히 ~하다', pos: '조동사', category: '허사' },
  { surface: '可', reading: '가', meaning: '~할 수 있다', pos: '조동사', category: '허사' },
  { surface: '當', reading: '당', meaning: '마땅히 ~해야 한다', pos: '조동사', category: '허사' },
  { surface: '此', reading: '차', meaning: '이, 이것', pos: '대명사', category: '허사' },
  { surface: '其', reading: '기', meaning: '그, 그것', pos: '대명사', category: '허사' },
  { surface: '是', reading: '시', meaning: '이, ~이다', pos: '대명사/판단사', category: '허사' },
  { surface: '中', reading: '중', meaning: '가운데', pos: '명사/위치사', category: '허사' },
  { surface: '具', reading: '구', meaning: '갖추다', pos: '동사', category: '허사' },
  { surface: '成', reading: '성', meaning: '이루다', pos: '동사', category: '허사' },
  { surface: '攝', reading: '섭', meaning: '포섭하다, 거두다', pos: '동사', category: '허사' },
  { surface: '思', reading: '사', meaning: '생각하다', pos: '동사', category: '허사' },
  { surface: '多', reading: '다', meaning: '많다, 많은 것', pos: '형용사/명사', category: '허사' },
  { surface: '一', reading: '일', meaning: '하나', pos: '수사', category: '허사' }
];

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
