import React, { useEffect, useState } from 'react';
import {
  FileText,
  Sparkles,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Search,
  RefreshCw,
  FolderOpen,
  Trash2,
  ClipboardCheck,
  QrCode,
  HardDrive,
  LogOut,
  Settings,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Worksheet,
  StudentSubmission,
  StorageStats,
  DifficultyLevel,
  GRADE_OPTIONS,
  EXAMPLE_PROMPTS,
} from '../types/worksheet';

interface MainStudioScreenProps {
  worksheets: Worksheet[];
  submissions: StudentSubmission[];
  storageStats: StorageStats;
  schoolName: string;
  onGenerateWorksheet: (params: {
    topicPrompt: string;
    subject: string;
    grade: string;
    difficulty: DifficultyLevel;
    preferences: string;
  }) => Promise<void>;
  onOpenWorksheet: (ws: Worksheet) => void;
  onOpenDistribute: (ws: Worksheet) => void;
  onOpenSubmissions: (ws: Worksheet) => void;
  onDeleteWorksheet: (id: string) => Promise<void>;
  onOpenStorageManager: () => void;
  onOpenSetup: () => void;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}

export const MainStudioScreen: React.FC<MainStudioScreenProps> = ({
  worksheets,
  submissions,
  storageStats,
  schoolName,
  onGenerateWorksheet,
  onOpenWorksheet,
  onOpenDistribute,
  onOpenSubmissions,
  onDeleteWorksheet,
  onOpenStorageManager,
  onOpenSetup,
  onLogout,
  onRefresh,
}) => {
  const [topicPrompt, setTopicPrompt] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [grade, setGrade] = useState<string>('고등학교 1학년');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('표준');
  const [preferences, setPreferences] = useState<string>('');
  const [exampleIdx, setExampleIdx] = useState<number>(0);

  // Generation timer state (#2-2: 만들어지는 동안 초가 표시되도록 해줘)
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [elapsedTenths, setElapsedTenths] = useState<number>(0);
  const [genError, setGenError] = useState<string | null>(null);

  // Archive filtering & search (#2-3, #7)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>(
    'all'
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);

  useEffect(() => {
    if (!isGenerating) {
      setElapsedTenths(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsedTenths((prev) => prev + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const elapsedSeconds = (elapsedTenths / 10).toFixed(1);
  const elapsedWholeSeconds = Math.floor(elapsedTenths / 10);

  const handleFillExample = () => {
    const sample = EXAMPLE_PROMPTS[exampleIdx % EXAMPLE_PROMPTS.length];
    setTopicPrompt(sample.topicPrompt);
    setSubject(sample.subject);
    setGrade(sample.grade);
    setDifficulty(sample.difficulty);
    setPreferences(sample.preferences);
    setExampleIdx((prev) => prev + 1);
    setGenError(null);
  };

  const handleGenerateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError(null);

    if (!topicPrompt.trim()) {
      setGenError('수업 주제 또는 교과서 지문을 먼저 입력해 주세요.');
      return;
    }

    setIsGenerating(true);
    setElapsedTenths(0);
    try {
      await onGenerateWorksheet({
        topicPrompt,
        subject,
        grade,
        difficulty,
        preferences,
      });
    } catch (err) {
      setGenError(
        err instanceof Error
          ? err.message
          : 'AI 학습지 설계 중 오류가 발생했습니다.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefreshList = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const filteredWorksheets = worksheets.filter((ws) => {
    if (statusFilter !== 'all' && ws.status !== statusFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      ws.title.toLowerCase().includes(q) ||
      ws.subject.toLowerCase().includes(q) ||
      ws.grade.toLowerCase().includes(q)
    );
  });

  const getSubmissionCount = (worksheetId: string) =>
    submissions.filter((s) => s.worksheetId === worksheetId).length;

  const formatKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Bar following strict 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          className="text-lg font-bold tracking-tight text-slate-900"
        >
          AI 학습지 도우미
        </a>

        {/* Zone 2: Clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#studio"
            className="hover:text-blue-600 transition-colors"
          >
            수업 설계 스튜디오
          </a>
          <a
            href="#archive"
            className="hover:text-blue-600 transition-colors"
          >
            아카이브 보관함 ({worksheets.length})
          </a>
          <button
            type="button"
            onClick={onOpenStorageManager}
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            데이터 용량 ({formatKB(storageStats.usedBytes)})
          </button>
          <button
            type="button"
            onClick={onOpenSetup}
            className="hover:text-blue-600 transition-colors cursor-pointer"
          >
            PIN·학교 설정
          </button>
        </nav>

        {/* Zone 3: 1-2 Primary Actions */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSetup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>설정</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-500" />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl w-full mx-auto px-4 md:px-6 py-8 space-y-10 flex-1">
        {/* SECTION 1: 수업 설계 스튜디오 (Image 2, #2-1, #2-2) */}
        <section
          id="studio"
          className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden"
        >
          {/* Top Blue Accent Bar */}
          <div className="h-1.5 w-full bg-blue-600" />

          <form
            onSubmit={handleGenerateSubmit}
            className="p-6 md:p-8 space-y-6"
          >
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600">
                <Sparkles className="w-3.5 h-3.5" />
                <span>수업 설계 스튜디오</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
                무엇을 가르치실 건가요?
              </h1>
              <p className="text-sm text-slate-600">
                교과서 지문이나 수업 주제만 적으면, AI가 내용에 맞는 활동 흐름을 설계해
                학습지로 만들어 드려요.
              </p>
            </div>

            {/* Topic Textarea */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="topic_input"
                  className="text-xs font-bold text-slate-800"
                >
                  수업 주제 또는 교과서 지문{' '}
                  <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleFillExample}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>예시 채우기</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-300 focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-transparent overflow-hidden bg-white">
                <textarea
                  id="topic_input"
                  value={topicPrompt}
                  onChange={(e) => setTopicPrompt(e.target.value.slice(0, 20000))}
                  rows={5}
                  placeholder={`교과서 지문, 핵심 개념, 수업 주제를 자유롭게 입력하세요.\n예) [통합과학] 산업화 이후 대기 중 이산화 탄소 농도가 증가하여 온실 효과가 강화되고 지구의 평균 기온이 상승하고 있다.\n예) [공통수학1] 행렬의 곱셈에서 교환법칙이 성립하지 않는 이유를 예를 들어 설명하기\n예) [통합사회] 시장 실패의 원인과 이를 보완하기 위한 정부의 역할`}
                  className="w-full p-4 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed focus:outline-none resize-y"
                />
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    <span>PDF·한글 문서의 본문을 그대로 붙여넣어도 돼요</span>
                  </span>
                  <span className="font-mono-tabular font-semibold text-slate-600">
                    {topicPrompt.length.toLocaleString()} / 20,000자
                  </span>
                </div>
              </div>
            </div>

            {/* 3-Column Row: 과목 / 대상 학년 / 난이도 (#2-1) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 과목 */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  과목{' '}
                  <span className="font-normal text-slate-500">
                    (비우면 AI가 판단)
                  </span>
                </label>
                <div className="relative">
                  <BookOpen className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="예) 한문 I, 통합사회, 생명과학"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* 대상 학년 */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  대상 학년
                </label>
                <div className="relative">
                  <GraduationCap className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 난이도 */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  난이도
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 border border-slate-200">
                  {(['기초', '표준', '심화'] as DifficultyLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setDifficulty(lvl)}
                      className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                        difficulty === lvl
                          ? 'bg-white text-blue-700 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 희망사항 (선택) (#2-1) */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-600" />
                <span>희망사항</span>
                <span className="font-normal text-slate-500">(선택)</span>
              </label>
              <div className="relative">
                <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="예) 그래프 해석 활동은 꼭 넣어줘 / 토론 활동은 빼줘 / 활동 5개 이내"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            {genError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                {genError}
              </div>
            )}

            {/* Submit CTA & Real-time Elapsed Seconds Display (#2-2) */}
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isGenerating}
                className="w-full py-4 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-xs transition-colors cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>AI 학습지 자동 설계 중...</span>
                    <span className="px-2.5 py-0.5 rounded-md bg-blue-800/80 text-white font-mono-tabular text-xs font-bold">
                      {elapsedSeconds}초 경과
                    </span>
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    <span>AI 학습지 설계하기</span>
                    <span className="text-xs font-normal text-blue-100">
                      · 보통 15~40초
                    </span>
                  </>
                )}
              </button>

              {/* Detailed Live Timer & Progress Stage Banner during Generation (#2-2) */}
              {isGenerating && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-mono-tabular font-bold text-sm shrink-0">
                      {elapsedWholeSeconds}s
                    </div>
                    <div>
                      <p className="text-xs font-bold text-blue-900">
                        {elapsedWholeSeconds < 5
                          ? '1단계: 교과서 지문 및 핵심 성취기준을 분석하고 있어요...'
                          : elapsedWholeSeconds < 12
                          ? '2단계: 생각 열기 도입과 빈칸·OX·표 활동을 설계하고 있어요...'
                          : '3단계: 문항별 모범 정답과 자동 채점 기준을 꼼꼼히 다듬고 있어요...'}
                      </p>
                      <p className="text-xs text-slate-600 mt-0.5">
                        완성되면 곧바로 교사용 학습지 화면이 열리고 아래 아카이브에 자동 저장됩니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm font-bold text-blue-700 font-mono-tabular shrink-0">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>{elapsedSeconds}초</span>
                  </div>
                </div>
              )}
            </div>
          </form>
        </section>

        {/* SECTION 2: 최근 학습지 아카이빙 목록 (Image 2 & Image 6 background, #2-1, #2-3, #7) */}
        <section id="archive" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FolderOpen className="w-5 h-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">최근 학습지</h2>
              <span className="text-sm font-bold text-blue-600 font-mono-tabular">
                {filteredWorksheets.length}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 flex-1 max-w-2xl justify-end">
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px] max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="제목·과목으로 찾기 (예: 이차함수, 통합과학)"
                  className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Interactive Status Filter Buttons */}
              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl">
                {(
                  [
                    { key: 'all', label: '전체' },
                    { key: 'published', label: '배포 중' },
                    { key: 'draft', label: '초안' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setStatusFilter(tab.key)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      statusFilter === tab.key
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Storage Hygiene Button (#7) */}
              <button
                type="button"
                onClick={onOpenStorageManager}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                title="데이터 용량 확인 및 정리"
              >
                <HardDrive className="w-3.5 h-3.5 text-blue-600" />
                <span className="font-mono-tabular">
                  {formatKB(storageStats.usedBytes)} ({storageStats.usagePercent}%)
                </span>
              </button>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleRefreshList}
                className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                title="목록 새로고침"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Archive Table / Empty State */}
          {filteredWorksheets.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-14 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <p className="text-base font-bold text-slate-900">
                {searchQuery
                  ? '검색 조건에 맞는 학습지가 없어요'
                  : '아직 만든 학습지가 없어요'}
              </p>
              <p className="text-xs text-slate-500">
                위에서 첫 학습지를 설계해 보세요! 만든 학습지는 이곳에 자동으로
                아카이빙됩니다.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500">
                <div className="col-span-5">학습지</div>
                <div className="col-span-2">과목</div>
                <div className="col-span-2">만든 날짜</div>
                <div className="col-span-1">상태</div>
                <div className="col-span-2 text-right">관리</div>
              </div>

              <div className="divide-y divide-slate-200">
                {filteredWorksheets.map((ws) => {
                  const subCount = getSubmissionCount(ws.id);
                  return (
                    <div
                      key={ws.id}
                      className="p-4 md:px-6 md:py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-center hover:bg-slate-50/70 transition-colors"
                    >
                      {/* Title & Grade */}
                      <div className="md:col-span-5 flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => onOpenWorksheet(ws)}
                            className="text-sm font-bold text-slate-900 hover:text-blue-600 transition-colors truncate block text-left max-w-full cursor-pointer"
                          >
                            {ws.title}
                          </button>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {ws.grade} · 난이도 {ws.difficulty} · 활동{' '}
                            {ws.activities.length}개
                          </p>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="md:col-span-2 text-xs font-semibold text-slate-700">
                        {ws.subject}
                      </div>

                      {/* Created Date */}
                      <div className="md:col-span-2 text-xs text-slate-500 font-mono-tabular">
                        {ws.createdAt}
                      </div>

                      {/* Status */}
                      <div className="md:col-span-1 text-xs font-semibold">
                        {ws.status === 'published' ? (
                          <span className="text-blue-600 flex items-center gap-1 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                            배포 중
                          </span>
                        ) : (
                          <span className="text-slate-500 whitespace-nowrap">
                            초안
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="md:col-span-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenWorksheet(ws)}
                          className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          열기
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenDistribute(ws)}
                          className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                          title="학생 배포 QR 및 링크 보기"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenSubmissions(ws)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>제출 현황</span>
                          {subCount > 0 && (
                            <span className="font-mono-tabular">
                              ({subCount})
                            </span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => onDeleteWorksheet(ws.id)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="학습지 삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="py-6 text-center text-xs text-slate-500 border-t border-slate-200/60 bg-white mt-12">
        © 2026 {schoolName || '이천고등학교'} · 교내 수업용 AI 학습지 도우미 · 무단 복제·재배포 및 상업적 이용 금지
      </footer>
    </div>
  );
};
