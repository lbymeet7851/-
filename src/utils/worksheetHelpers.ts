import { Worksheet, StudentSubmission } from '../types/worksheet';

export interface FlattenedGradableItem {
  id: string;
  activityId: string;
  activityTitle: string;
  activityType: string;
  question: string;
  subPrompt?: string;
  expectedAnswer: string;
  acceptedAnswers: string[];
  autoGradable: boolean;
}

/**
 * Counts all interactive input slots that a student can fill out in the worksheet:
 * - Warm-up questions
 * - All activity items
 * - Self-check items + reflection
 */
export function countWorksheetBlanks(worksheet: Worksheet): {
  totalBlanks: number;
  totalGradable: number;
  allSlotIds: { id: string; label: string; sectionTitle: string }[];
} {
  const allSlotIds: { id: string; label: string; sectionTitle: string }[] = [];

  worksheet.warmUpSection.questions.forEach((q, idx) => {
    allSlotIds.push({
      id: q.id,
      label: `생각 열기 ${idx + 1}번`,
      sectionTitle: `생각 열기: ${worksheet.warmUpSection.title}`,
    });
  });

  let totalGradable = 0;
  worksheet.activities.forEach((act) => {
    act.items.forEach((item, idx) => {
      allSlotIds.push({
        id: item.id,
        label: `${act.title} - 문항 ${idx + 1}`,
        sectionTitle: act.title,
      });
      if (item.autoGradable !== false) {
        totalGradable += 1;
      }
    });
  });

  worksheet.selfCheckSection.items.forEach((item, idx) => {
    allSlotIds.push({
      id: item.id,
      label: `스스로 점검 ${idx + 1}번`,
      sectionTitle: '스스로 점검',
    });
  });

  if (worksheet.selfCheckSection.reflectionPrompt) {
    allSlotIds.push({
      id: 'self_reflection',
      label: '오늘의 핵심 배움 한 줄 정리',
      sectionTitle: '스스로 점검',
    });
  }

  return {
    totalBlanks: allSlotIds.length,
    totalGradable,
    allSlotIds,
  };
}

/**
 * Flattens all activity items for the Teacher Submission Detail Grading table (Screenshot 7)
 */
export function getGradableItemsList(worksheet: Worksheet): FlattenedGradableItem[] {
  const list: FlattenedGradableItem[] = [];
  worksheet.activities.forEach((act) => {
    act.items.forEach((item) => {
      list.push({
        id: item.id,
        activityId: act.id,
        activityTitle: act.title,
        activityType: act.type,
        question: item.question,
        subPrompt: item.subPrompt,
        expectedAnswer: item.answer,
        acceptedAnswers: item.acceptedAnswers || [],
        autoGradable: item.autoGradable !== false,
      });
    });
  });
  return list;
}

function normalizeAnswer(str: string): string {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[.,?!]/g, '');
}

export function isAnswerCorrect(
  studentAnswer: string,
  expectedAnswer: string,
  acceptedAnswers: string[] = []
): boolean {
  const normStudent = normalizeAnswer(studentAnswer);
  if (!normStudent) return false;

  const candidates = [
    expectedAnswer,
    ...acceptedAnswers,
    // Split on '또는' or ',' if expectedAnswer contains alternatives like 'y 또는 y축'
    ...expectedAnswer.split(/\s*또는\s*|\s*,\s*|\s*\/\s*/),
  ]
    .map(normalizeAnswer)
    .filter(Boolean);

  return candidates.some((cand) => cand === normStudent);
}

export function evaluateSubmission(
  worksheet: Worksheet,
  answers: Record<string, string>,
  existingGrades?: Record<string, boolean>
): {
  filledCount: number;
  totalBlanks: number;
  score: number;
  totalGradable: number;
  grades: Record<string, boolean>;
} {
  const { totalBlanks, allSlotIds } = countWorksheetBlanks(worksheet);
  const gradableItems = getGradableItemsList(worksheet);

  let filledCount = 0;
  allSlotIds.forEach((slot) => {
    const val = answers[slot.id];
    if (val && val.trim().length > 0) {
      filledCount += 1;
    }
  });

  const grades: Record<string, boolean> = {};
  let score = 0;

  gradableItems.forEach((item) => {
    if (existingGrades && typeof existingGrades[item.id] === 'boolean') {
      grades[item.id] = existingGrades[item.id];
    } else {
      const studentAns = answers[item.id] || '';
      grades[item.id] = isAnswerCorrect(
        studentAns,
        item.expectedAnswer,
        item.acceptedAnswers
      );
    }
    if (grades[item.id]) {
      score += 1;
    }
  });

  return {
    filledCount,
    totalBlanks,
    score,
    totalGradable: gradableItems.length,
    grades,
  };
}

export const INITIAL_SEED_WORKSHEET: Worksheet = {
  id: 'ws_quadratic_parabola_01',
  title: '곡선 속에 숨겨진 비밀, 이차함수의 기본과 평행이동',
  subject: '수학 공통',
  grade: '고등학교 1학년',
  difficulty: '표준',
  topicPrompt:
    '이차함수 y = ax²의 그래프를 평행이동하여 모든 이차함수 y = a(x - p)² + q의 성질을 설명하기',
  preferences: '빈칸 채우기, 오개념 OX 퀴즈, 예제 및 성질 비교 표 포함',
  status: 'published',
  createdAt: '2026-10-01 13:04',
  updatedAt: '2026-10-01 13:10',
  aiDesignIntent:
    '이차함수의 기본 개념인 y=ax²의 그래프 성질을 명확히 하고, 표준형 y=a(x-p)²+q로의 평행이동을 이해하는 것이 핵심입니다. 학생들은 주로 x축 평행이동 시 부호를 반대로 적용하는 실수와, a의 절댓값 크기와 그래프 폭의 관계를 반대로 생각하는 오개념을 가집니다. 도입부에서 실생활의 포물선을 통해 흥미를 유발하고(scenario), 빈칸 채우기(fill_blank)로 기본 정의와 성질을 정리합니다. 이어서 자주 발생하는 오개념을 OX 퀴즈(ox_fix)로 짚어낸 뒤, 구체적인 예제(worked_example)와 성질 분류 표(table)를 통해 식의 변화를 체계적으로 훈련합니다. 마지막으로 서술형 및 격자 좌표 입력 문항(short_answer)으로 적용력을 확인하고 스스로 점검(self_check)하도록 설계했습니다.',
  conceptSection: {
    summary:
      '이차함수 y = ax²의 그래프를 평행이동하여 모든 이차함수 y = a(x - p)² + q의 성질을 설명할 수 있습니다.',
    objectives: [
      '이차함수의 정의와 y = ax² 그래프의 특징을 설명할 수 있다.',
      '이차함수 그래프의 평행이동을 이해하고 꼭짓점과 축의 방정식을 구할 수 있다.',
      '이차함수의 식을 보고 그래프의 개형을 예측하여 성질을 분석할 수 있다.',
    ],
  },
  warmUpSection: {
    title: '우리가 만드는 아름다운 곡선, 포물선',
    scenario:
      '농구 선수가 자유투 라인에서 던진 농구공의 궤적, 공원 분수대에서 뿜어져 나오는 물줄기, 그리고 밤하늘을 수놓는 불꽃놀이의 궤적에는 공통점이 있습니다. 바로 중력의 영향을 받아 대칭적인 곡선 모양인 "포물선(Parabola)"을 그린다는 점입니다. 만약 분수대의 위치를 오른쪽으로 2m 옮기고 물줄기가 시작되는 높이를 3m 높인다면, 물줄기 곡선의 모양(폭)은 변할까요, 아니면 위치만 이동할까요?',
    questions: [
      {
        id: 'wu_1',
        prompt:
          '분수대의 위치만 가로·세로로 옮겼을 때, 물줄기가 그리는 곡선의 폭(모양)과 가장 높은 지점(꼭짓점)의 위치 중 변하는 것과 변하지 않는 것은 무엇인지 자신의 생각을 적어 보세요.',
        sampleAnswer:
          '물줄기 곡선의 폭(모양)은 변하지 않고 그대로 유지되며, 가장 높은 지점(꼭짓점)의 위치만 이동한 만큼 함께 바뀐다.',
      },
    ],
  },
  activities: [
    {
      id: 'act_1',
      title: '이차함수의 뜻과 기본 그래프의 성질',
      type: 'fill_blank',
      instruction:
        '다음 설명에서 빈칸에 들어갈 알맞은 수나 용어를 채워 이차함수 y = ax²의 기본 성질을 완성해 보세요.',
      items: [
        {
          id: 'item_1',
          question:
            '함수 y = f(x)에서 y가 x에 대한 이차식 y = ax² + bx + c (단, a, b, c는 상수, a ≠ [ 빈칸 ])로 나타날 때, 이 함수를 이차함수라고 한다.',
          answer: '0',
          acceptedAnswers: ['0', '영'],
          explanation: '이차항의 계수 a가 0이면 이차식이 아니므로 a ≠ 0이어야 합니다.',
          autoGradable: true,
        },
        {
          id: 'item_2',
          question:
            '이차함수 y = ax²의 그래프와 같은 모양의 대칭 곡선을 수학에서 [ 빈칸 ](이)라고 부른다.',
          answer: '포물선',
          acceptedAnswers: ['포물선'],
          explanation: '이차함수의 그래프가 그리는 곡선을 포물선이라고 합니다.',
          autoGradable: true,
        },
        {
          id: 'item_3',
          question:
            '이차함수 y = ax²의 그래프는 [ 빈칸 ]을(를) 대칭축으로 하는 선대칭 도형이며, 축의 방정식은 x = 0이다.',
          answer: 'y 또는 y축',
          acceptedAnswers: ['y', 'y축', 'x=0'],
          explanation: 'y = ax²의 그래프는 y축(직선 x = 0)에 대하여 대칭입니다.',
          autoGradable: true,
        },
        {
          id: 'item_4',
          question:
            '포물선과 대칭축이 만나는 점을 포물선의 [ 빈칸 ](이)라고 하며, y = ax²의 경우 그 좌표는 원점 (0, 0)이다.',
          answer: '꼭짓점',
          acceptedAnswers: ['꼭짓점', '꼭지점'],
          explanation: '포물선과 축의 교점을 꼭짓점이라고 합니다.',
          autoGradable: true,
        },
        {
          id: 'item_5',
          question:
            '계수 a의 부호가 그래프의 모양을 결정하는데, a > 0이면 그래프는 [ 빈칸 ](으)로 볼록한 모양이다.',
          answer: '아래',
          acceptedAnswers: ['아래', '아래쪽'],
          explanation: 'a > 0일 때 포물선은 아래로 볼록합니다.',
          autoGradable: true,
        },
        {
          id: 'item_6',
          question:
            '반대로 a < 0이면 이차함수 y = ax²의 그래프는 [ 빈칸 ](으)로 볼록한 모양이다.',
          answer: '위',
          acceptedAnswers: ['위', '위쪽'],
          explanation: 'a < 0일 때 포물선은 위로 볼록합니다.',
          autoGradable: true,
        },
        {
          id: 'item_7',
          question:
            '이차항의 계수 a의 [ 빈칸 ]이(가) 클수록 그래프의 폭은 더 좁아지고 y축에 가까워진다.',
          answer: '절댓값',
          acceptedAnswers: ['절댓값', '절대값', '|a|'],
          explanation: '부호와 관계없이 |a|가 클수록 그래프의 폭이 좁아집니다.',
          autoGradable: true,
        },
      ],
    },
    {
      id: 'act_2',
      title: '내가 가진 오개념 바로잡기',
      type: 'ox_fix',
      instruction:
        '이차함수에서 자주 헷갈리는 진술입니다. 옳으면 O, 틀리면 X를 선택해 보세요.',
      items: [
        {
          id: 'item_8',
          question: '함수 y = 1/x² 은 분모에 이차식이 있으므로 x에 대한 이차함수이다.',
          subPrompt: '판단 이유: 분모에 미지수가 있는 분수식은 다항식(이차식)이 아닙니다.',
          answer: 'X',
          acceptedAnswers: ['X', 'x', '아니오'],
          autoGradable: true,
        },
        {
          id: 'item_9',
          question: '이차함수 y = -3x²의 그래프는 y = 2x²의 그래프보다 폭이 좁다.',
          subPrompt: '판단 기준: |-3| = 3 > |2| = 2 이므로 절댓값이 더 큰 y = -3x²의 폭이 좁습니다.',
          answer: 'O',
          acceptedAnswers: ['O', 'o', '예'],
          autoGradable: true,
        },
        {
          id: 'item_10',
          question:
            '이차함수 y = 2x²의 그래프를 x축 방향으로 3만큼 평행이동하면 식은 y = 2(x + 3)²이 된다.',
          subPrompt: '주의할 점: x축 방향으로 p만큼 평행이동할 때는 x 대신 (x - p)를 대입합니다.',
          answer: 'X',
          acceptedAnswers: ['X', 'x', '아니오'],
          autoGradable: true,
        },
        {
          id: 'item_11',
          question:
            '이차함수 y = a(x - p)² + q의 그래프를 평행이동해도 이차항의 계수 a의 값은 변하지 않는다.',
          subPrompt: '핵심 원리: 평행이동은 위치만 바꾸고 그래프의 폭과 볼록 방향(a)은 바꾸지 않습니다.',
          answer: 'O',
          acceptedAnswers: ['O', 'o', '예'],
          autoGradable: true,
        },
      ],
    },
    {
      id: 'act_3',
      title: '예제로 익히는 평행이동 단계별 분석',
      type: 'worked_example',
      instruction:
        '[예제] 이차함수 y = -2x²의 그래프를 x축 방향으로 3만큼, y축 방향으로 -1만큼 평행이동한 그래프를 단계별로 구해 봅시다.',
      items: [
        {
          id: 'item_12',
          question: '1단계 (식 세우기): 평행이동한 이차함수의 표준형 식 y = a(x - p)² + q에서 p의 값은?',
          answer: '3',
          acceptedAnswers: ['3', '+3'],
          autoGradable: true,
        },
        {
          id: 'item_13',
          question: '2단계 (식 세우기): 같은 표준형 식에서 q의 값은?',
          answer: '-1',
          acceptedAnswers: ['-1'],
          autoGradable: true,
        },
        {
          id: 'item_14',
          question: '3단계 (꼭짓점 구하기): 평행이동한 그래프의 꼭짓점의 좌표 (p, q)를 쓰세요.',
          answer: '(3, -1)',
          acceptedAnswers: ['(3,-1)', '3,-1', '(3, -1)'],
          autoGradable: true,
        },
        {
          id: 'item_15',
          question: '4단계 (축의 방정식): 평행이동한 그래프의 대칭축의 방정식 x = p를 쓰세요.',
          answer: 'x=3',
          acceptedAnswers: ['x=3', 'x = 3', '3'],
          autoGradable: true,
        },
      ],
    },
    {
      id: 'act_4',
      title: '이차함수 표준형 그래프의 성질 비교표',
      type: 'table',
      instruction:
        '다음 이차함수의 식을 보고 빈칸에 알맞은 꼭짓점의 좌표, 축의 방정식, 볼록 방향을 채워 표를 완성하세요.',
      items: [
        {
          id: 'item_16',
          question: '함수 y = (x - 2)² + 4 의 꼭짓점의 좌표',
          subPrompt: '함수식: y = (x - 2)² + 4',
          answer: '(2, 4)',
          acceptedAnswers: ['(2,4)', '2,4', '(2, 4)'],
          autoGradable: true,
        },
        {
          id: 'item_17',
          question: '함수 y = (x - 2)² + 4 의 축의 방정식',
          subPrompt: '함수식: y = (x - 2)² + 4',
          answer: 'x=2',
          acceptedAnswers: ['x=2', 'x = 2', '2'],
          autoGradable: true,
        },
        {
          id: 'item_18',
          question: '함수 y = -1/2(x + 1)² - 3 의 꼭짓점의 좌표',
          subPrompt: '함수식: y = -1/2(x + 1)² - 3',
          answer: '(-1, -3)',
          acceptedAnswers: ['(-1,-3)', '-1,-3', '(-1, -3)'],
          autoGradable: true,
        },
        {
          id: 'item_19',
          question: '함수 y = -1/2(x + 1)² - 3 의 축의 방정식',
          subPrompt: '함수식: y = -1/2(x + 1)² - 3',
          answer: 'x=-1',
          acceptedAnswers: ['x=-1', 'x = -1', '-1'],
          autoGradable: true,
        },
        {
          id: 'item_20',
          question: '함수 y = -1/2(x + 1)² - 3 의 볼록 방향 (위 / 아래)',
          subPrompt: '함수식: y = -1/2(x + 1)² - 3',
          answer: '위',
          acceptedAnswers: ['위', '위로 볼록', '위로볼록'],
          autoGradable: true,
        },
      ],
    },
    {
      id: 'act_5',
      title: '개념 적용 및 서술형 탐구',
      type: 'short_answer',
      instruction: '배운 평행이동의 성질을 활용하여 다음 문제를 해결해 보세요.',
      items: [
        {
          id: 'item_21',
          question:
            '이차함수 y = 3x²의 그래프와 모양(폭과 볼록 방향)이 같고, 꼭짓점의 좌표가 (-2, 5)인 이차함수의 식을 표준형으로 나타내세요.',
          answer: 'y = 3(x + 2)² + 5',
          acceptedAnswers: ['y=3(x+2)²+5', 'y=3(x+2)^2+5', '3(x+2)^2+5'],
          autoGradable: true,
        },
        {
          id: 'item_22',
          question:
            '이차함수 y = a(x - 1)² + 2의 그래프가 점 (3, 10)을 지날 때, 상수 a의 값을 구하세요.',
          answer: '2',
          acceptedAnswers: ['2', 'a=2'],
          autoGradable: true,
        },
        {
          id: 'item_23',
          question:
            '위 문제에서 구한 이차함수의 그래프는 x > 1인 범위에서 x의 값이 증가할 때 y의 값은 (증가 / 감소) 중 어떻게 변하는지 쓰세요.',
          answer: '증가',
          acceptedAnswers: ['증가', '증가한다'],
          autoGradable: true,
        },
      ],
    },
  ],
  selfCheckSection: {
    items: [
      {
        id: 'sc_1',
        statement: '이차함수 y = ax²의 그래프에서 a의 부호와 절댓값에 따른 그래프 모양 변화를 설명할 수 있나요?',
      },
      {
        id: 'sc_2',
        statement: '평행이동한 식 y = a(x - p)² + q에서 꼭짓점 (p, q)와 축의 방정식 x = p를 부호 실수 없이 찾을 수 있나요?',
      },
      {
        id: 'sc_3',
        statement: '그래프의 꼭짓점과 한 점의 조건이 주어졌을 때 이차함수의 식을 구할 수 있나요?',
      },
    ],
    reflectionPrompt: '오늘 수업에서 가장 중요하다고 생각한 핵심 개념이나 주의할 점을 한 문장으로 정리해 보세요.',
  },
};

export const INITIAL_SEED_SUBMISSIONS: StudentSubmission[] = [
  {
    id: 'sub_seed_01',
    worksheetId: 'ws_quadratic_parabola_01',
    studentId: '10101',
    studentName: '홍길동',
    submittedAt: '2026-10-01 13:15',
    filledCount: 0,
    totalBlanks: 28,
    score: 0,
    totalGradable: 23,
    answers: {},
    grades: {
      item_1: false,
      item_2: false,
      item_3: false,
      item_4: false,
      item_5: false,
      item_6: false,
      item_7: false,
      item_8: false,
      item_9: false,
      item_10: false,
      item_11: false,
      item_12: false,
      item_13: false,
      item_14: false,
      item_15: false,
      item_16: false,
      item_17: false,
      item_18: false,
      item_19: false,
      item_20: false,
      item_21: false,
      item_22: false,
      item_23: false,
    },
  },
  {
    id: 'sub_seed_02',
    worksheetId: 'ws_quadratic_parabola_01',
    studentId: '10102',
    studentName: '김서연',
    submittedAt: '2026-10-01 13:22',
    filledCount: 28,
    totalBlanks: 28,
    score: 21,
    totalGradable: 23,
    answers: {
      wu_1: '물줄기 폭은 그대로이고 꼭짓점 위치만 오른쪽으로 2m, 위로 3m 이동합니다.',
      item_1: '0',
      item_2: '포물선',
      item_3: 'y축',
      item_4: '꼭짓점',
      item_5: '아래',
      item_6: '위',
      item_7: '절댓값',
      item_8: 'X',
      item_9: 'O',
      item_10: 'X',
      item_11: 'O',
      item_12: '3',
      item_13: '-1',
      item_14: '(3, -1)',
      item_15: 'x=3',
      item_16: '(2, 4)',
      item_17: 'x=2',
      item_18: '(1, -3)', // Intentional common sign mistake for teacher review
      item_19: 'x=-1',
      item_20: '위',
      item_21: 'y=3(x+2)^2+5',
      item_22: '2',
      item_23: '감소', // Intentional mistake
      sc_1: '잘함',
      sc_2: '잘함',
      sc_3: '보통',
      self_reflection: 'x축 평행이동할 때 부호가 반대로 들어가는 점(x-p)을 꼭 주의해야겠다.',
    },
    grades: {
      item_1: true,
      item_2: true,
      item_3: true,
      item_4: true,
      item_5: true,
      item_6: true,
      item_7: true,
      item_8: true,
      item_9: true,
      item_10: true,
      item_11: true,
      item_12: true,
      item_13: true,
      item_14: true,
      item_15: true,
      item_16: true,
      item_17: true,
      item_18: false,
      item_19: true,
      item_20: true,
      item_21: true,
      item_22: true,
      item_23: false,
    },
  },
];
