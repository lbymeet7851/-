export type DifficultyLevel = '기초' | '표준' | '심화';

export type ActivityType =
  | 'fill_blank'
  | 'ox_fix'
  | 'worked_example'
  | 'table'
  | 'short_answer';

export interface WarmUpQuestion {
  id: string;
  prompt: string;
  sampleAnswer: string;
}

export interface ActivityItem {
  id: string;
  question: string;
  subPrompt?: string;
  answer: string;
  acceptedAnswers?: string[];
  explanation?: string;
  autoGradable: boolean;
}

export interface WorksheetActivity {
  id: string;
  title: string;
  type: ActivityType;
  instruction: string;
  items: ActivityItem[];
}

export interface SelfCheckItem {
  id: string;
  statement: string;
}

export interface Worksheet {
  id: string;
  title: string;
  subject: string;
  grade: string;
  difficulty: DifficultyLevel;
  topicPrompt: string;
  preferences?: string;
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
  aiDesignIntent: string;
  conceptSection: {
    summary: string;
    objectives: string[];
  };
  warmUpSection: {
    title: string;
    scenario: string;
    questions: WarmUpQuestion[];
  };
  activities: WorksheetActivity[];
  selfCheckSection: {
    items: SelfCheckItem[];
    reflectionPrompt: string;
  };
}

export interface StudentSubmission {
  id: string;
  worksheetId: string;
  studentId: string;
  studentName: string;
  submittedAt: string;
  filledCount: number;
  totalBlanks: number;
  score: number;
  totalGradable: number;
  answers: Record<string, string>;
  grades: Record<string, boolean>;
}

export interface TeacherConfig {
  isConfigured: boolean;
  pinHash: string;
  schoolName: string;
  teacherName: string;
  updatedAt: string;
}

export interface StorageStats {
  usedBytes: number;
  maxBytes: number;
  usagePercent: number;
  worksheetCount: number;
  submissionCount: number;
  estimatedRemainingWorksheets: number;
  estimatedRemainingSubmissions: number;
}

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  fill_blank: '빈칸 채우기 (핵심 개념)',
  ox_fix: 'OX 퀴즈 (오개념 바로잡기)',
  worked_example: '예제 따라하기 (단계별 풀이)',
  table: '비교·분류 표 채우기',
  short_answer: '단답·서술형 탐구',
};

export const GRADE_OPTIONS = [
  '초등학교 3학년',
  '초등학교 4학년',
  '초등학교 5학년',
  '초등학교 6학년',
  '중학교 1학년',
  '중학교 2학년',
  '중학교 3학년',
  '고등학교 1학년',
  '고등학교 2학년',
  '고등학교 3학년',
];

export const EXAMPLE_PROMPTS = [
  {
    subject: '수학 공통',
    grade: '고등학교 1학년',
    difficulty: '표준' as DifficultyLevel,
    topicPrompt:
      '[공통수학] 이차함수 y = ax²의 그래프의 기본 성질(꼭짓점, 대칭축, 볼록 방향, a의 절댓값에 따른 폭의 변화)을 이해하고, 이를 x축 방향으로 p만큼, y축 방향으로 q만큼 평행이동한 표준형 y = a(x - p)² + q의 그래프 성질을 분석하기',
    preferences: '실생활 포물선 도입, 빈칸 채우기, 오개념 OX 퀴즈, 성질 비교 표 포함',
  },
  {
    subject: '통합과학',
    grade: '고등학교 1학년',
    difficulty: '표준' as DifficultyLevel,
    topicPrompt:
      '[통합과학] 산업화 이후 화석 연료 사용 증가로 대기 중 이산화 탄소(CO₂) 농도가 증가하여 온실 효과가 강화되고, 이에 따라 지구의 평균 기온이 상승하는 지구 온난화의 메커니즘과 기후 변화 대응 방안 탐구하기',
    preferences: '그래프 해석 및 인과관계 빈칸 채우기, 오개념 OX 퀴즈 포함 / 활동 4개 이내',
  },
  {
    subject: '통합사회',
    grade: '고등학교 1학년',
    difficulty: '표준' as DifficultyLevel,
    topicPrompt:
      '[통합사회] 시장 경제 체제에서 독과점, 공공재 부족, 외부 효과(외부 경제·외부 불경제) 등 시장 실패가 나타나는 원인을 분석하고, 이를 보완하기 위한 정부의 합리적 개입과 역할 설명하기',
    preferences: '사례 분류 표 채우기와 서술형 적용 문항을 꼭 넣어줘',
  },
  {
    subject: '공통수학1',
    grade: '고등학교 1학년',
    difficulty: '심화' as DifficultyLevel,
    topicPrompt:
      '[공통수학1] 두 행렬 A, B의 곱셈 AB가 정의되기 위한 조건을 이해하고, 실수의 곱셈과 달리 행렬의 곱셈에서 교환법칙(AB = BA)이 성립하지 않는 이유를 구체적인 반례를 들어 설명하기',
    preferences: '단계별 예제 풀이와 오개념 바로잡기 OX 문항 포함',
  },
];
