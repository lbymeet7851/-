import React, { useState } from 'react';
import {
  BookOpen,
  Eye,
  Pencil,
  Printer,
  CheckCircle2,
  X,
  Compass,
  Send,
  Trash2,
  RefreshCw,
  Plus,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  Worksheet,
  WorksheetActivity,
  ActivityType,
  ACTIVITY_TYPE_LABELS,
} from '../types/worksheet';
import { countWorksheetBlanks } from '../utils/worksheetHelpers';

interface TeacherWorksheetModalProps {
  worksheet: Worksheet;
  onClose: () => void;
  onSaveWorksheet: (updated: Worksheet) => Promise<void>;
  onDistribute: (updated: Worksheet) => Promise<void>;
}

export const TeacherWorksheetModal: React.FC<TeacherWorksheetModalProps> = ({
  worksheet: initialWorksheet,
  onClose,
  onSaveWorksheet,
  onDistribute,
}) => {
  const [worksheet, setWorksheet] = useState<Worksheet>(initialWorksheet);
  const [showAnswers, setShowAnswers] = useState<boolean>(false);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // State for "+ 새 활동 추가" (#3-5)
  const [newActTitle, setNewActTitle] = useState<string>('');
  const [newActType, setNewActType] = useState<ActivityType>('fill_blank');
  const [newActPrompt, setNewActPrompt] = useState<string>('');

  const { totalBlanks } = countWorksheetBlanks(worksheet);

  const showTemporaryNotice = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => {
      setStatusBanner((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      await onSaveWorksheet(worksheet);
      setIsEditing(false);
      showTemporaryNotice('학습지 수정 내용이 저장되었습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = (withAnswers: boolean) => {
    setShowAnswers(withAnswers);
    setIsEditing(false);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleDistributeClick = async () => {
    setSaving(true);
    try {
      const published: Worksheet = {
        ...worksheet,
        status: 'published',
      };
      setWorksheet(published);
      await onDistribute(published);
    } finally {
      setSaving(false);
    }
  };

  // AI Section Regeneration handler (#3-4)
  const handleRegenerateSection = async (
    sectionType: 'concept' | 'warmUp' | 'activity' | 'selfCheck',
    activityIndex?: number,
    isNewActivity?: boolean
  ) => {
    const key = isNewActivity
      ? 'new_activity'
      : activityIndex !== undefined
      ? `act_${activityIndex}`
      : sectionType;
    setRegeneratingKey(key);

    try {
      const targetAct =
        activityIndex !== undefined ? worksheet.activities[activityIndex] : undefined;

      const res = await fetch('/api/worksheets/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksheetTitle: worksheet.title,
          subject: worksheet.subject,
          grade: worksheet.grade,
          difficulty: worksheet.difficulty,
          topicPrompt: worksheet.topicPrompt,
          sectionType,
          activityType: isNewActivity
            ? newActType
            : targetAct?.type || 'fill_blank',
          currentTitle: isNewActivity ? newActTitle : targetAct?.title,
          customInstruction: isNewActivity ? newActPrompt : undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('AI 재생성 요청에 실패했습니다.');
      }

      const { data } = await res.json();

      if (sectionType === 'concept' && data) {
        setWorksheet((prev) => ({
          ...prev,
          conceptSection: {
            summary: data.summary || prev.conceptSection.summary,
            objectives: Array.isArray(data.objectives)
              ? data.objectives
              : prev.conceptSection.objectives,
          },
        }));
        showTemporaryNotice('개념 이해 섹션이 AI로 새로 생성되었습니다.');
      } else if (sectionType === 'warmUp' && data) {
        setWorksheet((prev) => ({
          ...prev,
          warmUpSection: data,
        }));
        showTemporaryNotice('생각 열기 섹션이 AI로 새로 생성되었습니다.');
      } else if (sectionType === 'selfCheck' && data) {
        setWorksheet((prev) => ({
          ...prev,
          selfCheckSection: data,
        }));
        showTemporaryNotice('스스로 점검 섹션이 AI로 새로 생성되었습니다.');
      } else if (sectionType === 'activity' && data) {
        if (isNewActivity) {
          setWorksheet((prev) => ({
            ...prev,
            activities: [...prev.activities, data],
          }));
          setNewActTitle('');
          setNewActPrompt('');
          showTemporaryNotice('새 활동이 AI로 자동 생성되어 추가되었습니다.');
        } else if (activityIndex !== undefined) {
          setWorksheet((prev) => {
            const next = [...prev.activities];
            next[activityIndex] = {
              ...data,
              id: prev.activities[activityIndex].id,
            };
            return { ...prev, activities: next };
          });
          showTemporaryNotice(
            `'활동 ${activityIndex + 1}' 문항이 AI로 새로 생성되었습니다.`
          );
        }
      }
    } catch (err) {
      showTemporaryNotice(
        err instanceof Error ? err.message : 'AI 재생성 중 오류가 발생했습니다.'
      );
    } finally {
      setRegeneratingKey(null);
    }
  };

  // Manual add empty activity (#3-5)
  const handleAddManualActivity = () => {
    const nowId = Date.now().toString(36);
    const created: WorksheetActivity = {
      id: `act_${nowId}`,
      title: newActTitle.trim() || `새 활동 ${worksheet.activities.length + 1}`,
      type: newActType,
      instruction:
        newActPrompt.trim() || '다음 문제를 읽고 빈칸이나 답란에 알맞은 답을 작성해 보세요.',
      items: [
        {
          id: `item_${nowId}_1`,
          question:
            newActType === 'fill_blank'
              ? '핵심 개념 설명에서 [ 빈칸 ]에 들어갈 알맞은 말을 쓰세요.'
              : '문제를 읽고 알맞은 답을 작성하세요.',
          subPrompt: '',
          answer: newActType === 'ox_fix' ? 'O' : '예시 정답',
          acceptedAnswers: [],
          autoGradable: true,
        },
      ],
    };
    setWorksheet((prev) => ({
      ...prev,
      activities: [...prev.activities, created],
    }));
    setNewActTitle('');
    setNewActPrompt('');
    showTemporaryNotice('새 활동 섹션이 추가되었습니다.');
  };

  // Helper to render fill_blank text with red answer point (#3-2)
  const renderQuestionWithBlank = (questionText: string, answerText: string, idx: number) => {
    const parts = questionText.split(/\[\s*빈칸\s*\]/);
    if (parts.length === 1) {
      return (
        <div className="flex flex-wrap items-center gap-2 leading-relaxed text-slate-800">
          <span className="font-semibold text-slate-500 mr-1">{idx + 1}.</span>
          <span>{questionText}</span>
          {showAnswers ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 border-2 border-red-400 text-red-600 font-bold text-sm shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
              <span>{answerText}</span>
            </span>
          ) : (
            <span className="inline-block min-w-[110px] h-8 px-3 border-b-2 border-slate-400 bg-slate-100/70 rounded-t-md align-middle" />
          )}
        </div>
      );
    }

    return (
      <div className="leading-loose text-slate-800">
        <span className="font-semibold text-slate-500 mr-2">{idx + 1}.</span>
        {parts.map((part, pIdx) => (
          <React.Fragment key={pIdx}>
            <span>{part}</span>
            {pIdx < parts.length - 1 &&
              (showAnswers ? (
                <span className="inline-flex items-center gap-1.5 mx-1.5 px-3 py-0.5 rounded-lg bg-red-50 border-2 border-red-400 text-red-600 font-bold text-sm align-middle">
                  <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                  <span>{answerText}</span>
                </span>
              ) : (
                <span className="inline-flex items-center justify-center mx-1.5 min-w-[100px] h-7 px-3 border-b-2 border-slate-400 bg-slate-100/80 rounded-t-md text-xs text-slate-400 align-middle">
                  빈칸
                </span>
              ))}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex flex-col overflow-hidden">
      <div className="flex-1 bg-slate-100 flex flex-col overflow-hidden">
        {/* Top Toolbar (#3-1) */}
        <header className="no-print bg-white border-b border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-slate-900 truncate">
                  {worksheet.title}
                </h2>
                <span className="text-xs font-medium text-slate-500 shrink-0">
                  · {worksheet.status === 'published' ? '배포 중' : '초안'}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {worksheet.grade} · {worksheet.subject}
              </p>
            </div>
          </div>

          {/* Right Action Controls (#3-1, #3-2) */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* 정답 보기 체크박스 (#3-2) */}
            <label
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors cursor-pointer select-none whitespace-nowrap ${
                showAnswers
                  ? 'bg-red-50 border-red-300 text-red-700'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <input
                type="checkbox"
                checked={showAnswers}
                onChange={(e) => setShowAnswers(e.target.checked)}
                className="w-4 h-4 accent-red-600 rounded cursor-pointer"
              />
              <Eye className={`w-4 h-4 ${showAnswers ? 'text-red-600' : 'text-slate-500'}`} />
              <span>정답 보기</span>
            </label>

            {/* 편집 버튼 (#3-3) */}
            <button
              type="button"
              onClick={() => {
                if (isEditing) {
                  handleSaveChanges();
                } else {
                  setIsEditing(true);
                }
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                isEditing
                  ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>편집 완료</span>
                </>
              ) : (
                <>
                  <Pencil className="w-4 h-4" />
                  <span>편집</span>
                </>
              )}
            </button>

            {/* 학생용 인쇄 (#3-1) */}
            <button
              type="button"
              onClick={() => handlePrint(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-500" />
              <span>학생용 인쇄</span>
            </button>

            {/* 정답 포함 인쇄 (#3-1) */}
            <button
              type="button"
              onClick={() => handlePrint(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <span>정답 포함 인쇄</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {statusBanner && (
          <div className="no-print bg-blue-600 text-white text-xs font-medium px-6 py-2 text-center">
            {statusBanner}
          </div>
        )}

        {/* Scrollable Worksheet Content */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 space-y-6">
          {/* AI의 수업 설계 의도 Box (Image 3) */}
          <div className="no-print max-w-4xl mx-auto bg-blue-50/70 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <Compass className="w-4 h-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">
                    AI의 수업 설계 의도
                  </h3>
                  {showAnswers && (
                    <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-600" />
                      정답 보기 활성화됨 (빨간색 포인트 표시)
                    </span>
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    value={worksheet.aiDesignIntent}
                    onChange={(e) =>
                      setWorksheet({ ...worksheet, aiDesignIntent: e.target.value })
                    }
                    rows={3}
                    className="w-full p-2.5 text-sm bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                ) : (
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {worksheet.aiDesignIntent}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Main Worksheet Sheet (Image 3) */}
          <div className="print-only-sheet max-w-4xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-xs p-6 md:p-10 space-y-8">
            {/* Top Decorative Spectrum Bar */}
            <div className="h-3.5 w-full rounded-md overflow-hidden grid grid-cols-24">
              <div className="bg-blue-900" />
              <div className="bg-blue-800" />
              <div className="bg-blue-700" />
              <div className="bg-blue-700" />
              <div className="bg-blue-600" />
              <div className="bg-blue-600" />
              <div className="bg-blue-500" />
              <div className="bg-blue-500" />
              <div className="bg-sky-500" />
              <div className="bg-sky-400" />
              <div className="bg-sky-300" />
              <div className="bg-slate-200" />
              <div className="bg-slate-100" />
              <div className="bg-orange-100" />
              <div className="bg-orange-200" />
              <div className="bg-orange-300" />
              <div className="bg-orange-400" />
              <div className="bg-amber-500" />
              <div className="bg-orange-500" />
              <div className="bg-orange-600" />
              <div className="bg-red-500" />
              <div className="bg-red-600" />
              <div className="bg-red-700" />
              <div className="bg-red-800" />
            </div>

            {/* Worksheet Header */}
            <div className="border-b-2 border-slate-900 pb-5">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="flex-1 space-y-2">
                  {isEditing ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-blue-700">
                        학습지 제목 수정
                      </label>
                      <input
                        type="text"
                        value={worksheet.title}
                        onChange={(e) =>
                          setWorksheet({ ...worksheet, title: e.target.value })
                        }
                        className="w-full text-2xl font-bold text-slate-900 px-3 py-2 border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600"
                      />
                    </div>
                  ) : (
                    <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-snug">
                      {worksheet.title}
                    </h1>
                  )}
                  <p className="text-sm text-slate-500 font-medium">
                    {worksheet.subject} | {worksheet.grade}
                  </p>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-600 shrink-0">
                  <div className="flex items-end gap-1.5">
                    <span>학번</span>
                    <span className="inline-block w-24 border-b border-slate-800" />
                  </div>
                  <div className="flex items-end gap-1.5">
                    <span>이름</span>
                    <span className="inline-block w-28 border-b border-slate-800" />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 1: 개념 이해 (#3-3, #3-4) */}
            <section className="space-y-4">
              {isEditing && (
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    섹션 1 · 개념 이해 (성취기준 및 학습 목표)
                  </span>
                  <button
                    type="button"
                    disabled={regeneratingKey === 'concept'}
                    onClick={() => handleRegenerateSection('concept')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        regeneratingKey === 'concept' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {regeneratingKey === 'concept'
                        ? 'AI 재생성 중...'
                        : 'AI로 다시 생성'}
                    </span>
                  </button>
                </div>
              )}

              <div className="border-l-4 border-blue-600 bg-slate-50 p-4 rounded-r-xl">
                {isEditing ? (
                  <textarea
                    value={worksheet.conceptSection.summary}
                    onChange={(e) =>
                      setWorksheet({
                        ...worksheet,
                        conceptSection: {
                          ...worksheet.conceptSection,
                          summary: e.target.value,
                        },
                      })
                    }
                    rows={2}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-800"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-800 leading-relaxed">
                    {worksheet.conceptSection.summary}
                  </p>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2 pl-2">
                  <label className="block text-xs font-semibold text-slate-600">
                    학습 목표 목록
                  </label>
                  {worksheet.conceptSection.objectives.map((obj, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={obj}
                        onChange={(e) => {
                          const next = [...worksheet.conceptSection.objectives];
                          next[idx] = e.target.value;
                          setWorksheet({
                            ...worksheet,
                            conceptSection: {
                              ...worksheet.conceptSection,
                              objectives: next,
                            },
                          });
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = worksheet.conceptSection.objectives.filter(
                            (_, i) => i !== idx
                          );
                          setWorksheet({
                            ...worksheet,
                            conceptSection: {
                              ...worksheet.conceptSection,
                              objectives: next,
                            },
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg cursor-pointer"
                        title="목표 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setWorksheet({
                        ...worksheet,
                        conceptSection: {
                          ...worksheet.conceptSection,
                          objectives: [
                            ...worksheet.conceptSection.objectives,
                            '새로운 학습 목표를 설명할 수 있다.',
                          ],
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>학습 목표 추가</span>
                  </button>
                </div>
              ) : (
                <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700 pl-1">
                  {worksheet.conceptSection.objectives.map((obj, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {obj}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* SECTION 2: 생각 열기 (#3-3, #3-4) */}
            <section className="space-y-4 pt-4 border-t border-slate-200">
              {isEditing && (
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    섹션 2 · 생각 열기 (도입 시나리오 및 발문)
                  </span>
                  <button
                    type="button"
                    disabled={regeneratingKey === 'warmUp'}
                    onClick={() => handleRegenerateSection('warmUp')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        regeneratingKey === 'warmUp' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {regeneratingKey === 'warmUp'
                        ? 'AI 재생성 중...'
                        : 'AI로 다시 생성'}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-md">
                  생각 열기
                </span>
                {isEditing ? (
                  <input
                    type="text"
                    value={worksheet.warmUpSection.title}
                    onChange={(e) =>
                      setWorksheet({
                        ...worksheet,
                        warmUpSection: {
                          ...worksheet.warmUpSection,
                          title: e.target.value,
                        },
                      })
                    }
                    className="flex-1 px-3 py-1.5 text-base font-bold border border-slate-300 rounded-lg"
                  />
                ) : (
                  <h3 className="text-lg font-bold text-slate-900">
                    {worksheet.warmUpSection.title}
                  </h3>
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={worksheet.warmUpSection.scenario}
                  onChange={(e) =>
                    setWorksheet({
                      ...worksheet,
                      warmUpSection: {
                        ...worksheet.warmUpSection,
                        scenario: e.target.value,
                      },
                    })
                  }
                  rows={3}
                  className="w-full p-3 text-sm border border-slate-300 rounded-xl"
                />
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
                  {worksheet.warmUpSection.scenario}
                </div>
              )}

              <div className="space-y-3">
                {worksheet.warmUpSection.questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5"
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-500">
                            생각 열기 질문 {qIdx + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = worksheet.warmUpSection.questions.filter(
                                (_, i) => i !== qIdx
                              );
                              setWorksheet({
                                ...worksheet,
                                warmUpSection: {
                                  ...worksheet.warmUpSection,
                                  questions: next,
                                },
                              });
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                            title="질문 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={q.prompt}
                          onChange={(e) => {
                            const next = [...worksheet.warmUpSection.questions];
                            next[qIdx] = { ...q, prompt: e.target.value };
                            setWorksheet({
                              ...worksheet,
                              warmUpSection: {
                                ...worksheet.warmUpSection,
                                questions: next,
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                          placeholder="질문 내용"
                        />
                        <input
                          type="text"
                          value={q.sampleAnswer}
                          onChange={(e) => {
                            const next = [...worksheet.warmUpSection.questions];
                            next[qIdx] = { ...q, sampleAnswer: e.target.value };
                            setWorksheet({
                              ...worksheet,
                              warmUpSection: {
                                ...worksheet.warmUpSection,
                                questions: next,
                              },
                            });
                          }}
                          className="w-full px-3 py-1.5 text-sm border border-red-200 bg-red-50/40 text-red-700 rounded-lg"
                          placeholder="예시 답안"
                        />
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-800">
                          Q{qIdx + 1}. {q.prompt}
                        </p>
                        {showAnswers ? (
                          <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-sm text-red-600 font-semibold flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-600 mt-1.5 shrink-0" />
                            <span>[예시 답안] {q.sampleAnswer}</span>
                          </div>
                        ) : (
                          <div className="h-14 w-full rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2 text-xs text-slate-400">
                            학생 자유 서술란
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* SECTION 3: 활동 (문제풀기 1..N) (#3-3, #3-4) */}
            <section className="space-y-8 pt-4 border-t border-slate-200">
              {worksheet.activities.map((activity, actIdx) => (
                <div
                  key={activity.id}
                  className="space-y-4 pb-6 border-b border-slate-100 last:border-b-0"
                >
                  {isEditing && (
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-blue-50/80 px-4 py-2.5 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-900">
                          활동 {actIdx + 1} 편집
                        </span>
                        <select
                          value={activity.type}
                          onChange={(e) => {
                            const next = [...worksheet.activities];
                            next[actIdx] = {
                              ...activity,
                              type: e.target.value as ActivityType,
                            };
                            setWorksheet({ ...worksheet, activities: next });
                          }}
                          className="text-xs bg-white border border-blue-200 rounded-lg px-2.5 py-1 text-slate-700 font-medium"
                        >
                          {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={regeneratingKey === `act_${actIdx}`}
                          onClick={() =>
                            handleRegenerateSection('activity', actIdx, false)
                          }
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              regeneratingKey === `act_${actIdx}`
                                ? 'animate-spin'
                                : ''
                            }`}
                          />
                          <span>
                            {regeneratingKey === `act_${actIdx}`
                              ? 'AI 재생성 중...'
                              : 'AI로 다시 생성'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const next = worksheet.activities.filter(
                              (_, i) => i !== actIdx
                            );
                            setWorksheet({ ...worksheet, activities: next });
                            showTemporaryNotice(
                              `'${activity.title}' 활동이 삭제되었습니다.`
                            );
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors cursor-pointer"
                          title="이 활동 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>활동 삭제</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Activity Title & Instruction */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-md">
                        활동 {actIdx + 1}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={activity.title}
                          onChange={(e) => {
                            const next = [...worksheet.activities];
                            next[actIdx] = { ...activity, title: e.target.value };
                            setWorksheet({ ...worksheet, activities: next });
                          }}
                          className="flex-1 px-3 py-1.5 text-base font-bold border border-slate-300 rounded-lg"
                        />
                      ) : (
                        <h3 className="text-lg font-bold text-slate-900">
                          {activity.title}
                        </h3>
                      )}
                    </div>

                    {isEditing ? (
                      <input
                        type="text"
                        value={activity.instruction}
                        onChange={(e) => {
                          const next = [...worksheet.activities];
                          next[actIdx] = {
                            ...activity,
                            instruction: e.target.value,
                          };
                          setWorksheet({ ...worksheet, activities: next });
                        }}
                        className="w-full px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg"
                      />
                    ) : (
                      <p className="text-sm text-slate-600">{activity.instruction}</p>
                    )}
                  </div>

                  {/* Activity Items Rendering */}
                  {isEditing ? (
                    <div className="space-y-3 pl-2">
                      {activity.items.map((item, itemIdx) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500">
                              문항 {itemIdx + 1}{' '}
                              {activity.type === 'fill_blank' &&
                                "(문장 안에 '[ 빈칸 ]'을 넣으면 빈칸으로 표시됩니다)"}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const nextActs = [...worksheet.activities];
                                nextActs[actIdx] = {
                                  ...activity,
                                  items: activity.items.filter(
                                    (_, i) => i !== itemIdx
                                  ),
                                };
                                setWorksheet({ ...worksheet, activities: nextActs });
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="문항 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <input
                            type="text"
                            value={item.question}
                            onChange={(e) => {
                              const nextActs = [...worksheet.activities];
                              const nextItems = [...activity.items];
                              nextItems[itemIdx] = {
                                ...item,
                                question: e.target.value,
                              };
                              nextActs[actIdx] = { ...activity, items: nextItems };
                              setWorksheet({ ...worksheet, activities: nextActs });
                            }}
                            placeholder="문항 질문 내용"
                            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                          />

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-red-600 shrink-0">
                                정답:
                              </span>
                              <input
                                type="text"
                                value={item.answer}
                                onChange={(e) => {
                                  const nextActs = [...worksheet.activities];
                                  const nextItems = [...activity.items];
                                  nextItems[itemIdx] = {
                                    ...item,
                                    answer: e.target.value,
                                  };
                                  nextActs[actIdx] = {
                                    ...activity,
                                    items: nextItems,
                                  };
                                  setWorksheet({
                                    ...worksheet,
                                    activities: nextActs,
                                  });
                                }}
                                placeholder="정답 입력"
                                className="flex-1 px-3 py-1.5 text-sm bg-red-50/50 border border-red-300 text-red-700 font-semibold rounded-lg"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-500 shrink-0">
                                보조설명/대상:
                              </span>
                              <input
                                type="text"
                                value={item.subPrompt || ''}
                                onChange={(e) => {
                                  const nextActs = [...worksheet.activities];
                                  const nextItems = [...activity.items];
                                  nextItems[itemIdx] = {
                                    ...item,
                                    subPrompt: e.target.value,
                                  };
                                  nextActs[actIdx] = {
                                    ...activity,
                                    items: nextItems,
                                  };
                                  setWorksheet({
                                    ...worksheet,
                                    activities: nextActs,
                                  });
                                }}
                                placeholder="해설 또는 표의 행 제목 (선택)"
                                className="flex-1 px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg"
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => {
                          const nextActs = [...worksheet.activities];
                          nextActs[actIdx] = {
                            ...activity,
                            items: [
                              ...activity.items,
                              {
                                id: `item_${Date.now()}`,
                                question:
                                  activity.type === 'fill_blank'
                                    ? '새로운 문항의 [ 빈칸 ]을 채워 보세요.'
                                    : '새로운 문항 질문을 입력하세요.',
                                subPrompt: '',
                                answer: activity.type === 'ox_fix' ? 'O' : '정답',
                                acceptedAnswers: [],
                                autoGradable: true,
                              },
                            ],
                          };
                          setWorksheet({ ...worksheet, activities: nextActs });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>이 활동에 문항 추가</span>
                      </button>
                    </div>
                  ) : (
                    /* Teacher Preview Mode for Activity Items (#3-2 Red Answer Highlight) */
                    <div className="space-y-3">
                      {activity.type === 'fill_blank' && (
                        <div className="p-5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                          {activity.items.map((item, idx) => (
                            <div key={item.id}>
                              {renderQuestionWithBlank(
                                item.question,
                                item.answer,
                                idx
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {activity.type === 'ox_fix' && (
                        <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                          {activity.items.map((item, idx) => {
                            const isO =
                              item.answer.trim().toUpperCase() === 'O';
                            return (
                              <div
                                key={item.id}
                                className="p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4"
                              >
                                <div className="space-y-1 flex-1">
                                  <p className="text-sm font-medium text-slate-800">
                                    <span className="font-semibold text-slate-500 mr-1.5">
                                      {idx + 1}.
                                    </span>
                                    {item.question}
                                  </p>
                                  {showAnswers && item.subPrompt && (
                                    <p className="text-xs text-red-600 font-medium flex items-center gap-1.5 pt-0.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
                                      <span>{item.subPrompt}</span>
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-bold ${
                                      showAnswers && isO
                                        ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                                        : 'border-slate-300 text-slate-500 bg-slate-50'
                                    }`}
                                  >
                                    O
                                  </span>
                                  <span
                                    className={`w-9 h-9 rounded-lg border flex items-center justify-center text-sm font-bold ${
                                      showAnswers && !isO
                                        ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                                        : 'border-slate-300 text-slate-500 bg-slate-50'
                                    }`}
                                  >
                                    X
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {activity.type === 'table' && (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-sm text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                                <th className="py-2.5 px-4 w-1/3">구분 / 대상</th>
                                <th className="py-2.5 px-4">문항 및 분석 항목</th>
                                <th className="py-2.5 px-4 w-44">답란</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                              {activity.items.map((item, idx) => (
                                <tr key={item.id} className="bg-white">
                                  <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50/60">
                                    {item.subPrompt || `항목 ${idx + 1}`}
                                  </td>
                                  <td className="py-3 px-4 text-slate-800">
                                    {item.question}
                                  </td>
                                  <td className="py-3 px-4">
                                    {showAnswers ? (
                                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-50 border-2 border-red-400 text-red-600 font-bold text-sm">
                                        <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                                        <span>{item.answer}</span>
                                      </span>
                                    ) : (
                                      <div className="h-8 w-full border border-slate-300 rounded-lg bg-slate-50" />
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {(activity.type === 'worked_example' ||
                        activity.type === 'short_answer') && (
                        <div className="space-y-3">
                          {activity.items.map((item, idx) => (
                            <div
                              key={item.id}
                              className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <p className="text-sm font-medium text-slate-800 flex-1">
                                <span className="font-semibold text-blue-600 mr-1.5">
                                  문항 {idx + 1}.
                                </span>
                                {item.question}
                              </p>
                              <div className="md:w-60 shrink-0">
                                {showAnswers ? (
                                  <div className="px-3.5 py-2 rounded-lg bg-red-50 border-2 border-red-400 text-red-600 font-bold text-sm flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                                    <span>{item.answer}</span>
                                  </div>
                                ) : (
                                  <div className="h-9 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 flex items-center text-xs text-slate-400">
                                    답안 입력란
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* + 새 활동 추가 칸 (#3-5) */}
              {isEditing && (
                <div className="p-5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50/40 space-y-4">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      새 활동 추가하기
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        활동 유형 선택
                      </label>
                      <select
                        value={newActType}
                        onChange={(e) =>
                          setNewActType(e.target.value as ActivityType)
                        }
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                      >
                        {Object.entries(ACTIVITY_TYPE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        새 활동 제목 (선택)
                      </label>
                      <input
                        type="text"
                        value={newActTitle}
                        onChange={(e) => setNewActTitle(e.target.value)}
                        placeholder="예: 심화 그래프 해석하기"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        AI 생성 요청사항 / 지시문
                      </label>
                      <input
                        type="text"
                        value={newActPrompt}
                        onChange={(e) => setNewActPrompt(e.target.value)}
                        placeholder="예: 실생활 응용 문제 3문항 만들어줘"
                        className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      disabled={regeneratingKey === 'new_activity'}
                      onClick={() =>
                        handleRegenerateSection('activity', undefined, true)
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {regeneratingKey === 'new_activity'
                          ? 'AI가 새 활동을 생성 중입니다...'
                          : 'AI로 새 활동 자동 생성'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddManualActivity}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>내가 직접 빈 활동 추가</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* SECTION 4: 스스로 점검 (#3-3, #3-4) */}
            <section className="space-y-4 pt-4 border-t border-slate-200">
              {isEditing && (
                <div className="flex items-center justify-between bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-800">
                    섹션 4 · 스스로 점검 (자기 평가 체크리스트)
                  </span>
                  <button
                    type="button"
                    disabled={regeneratingKey === 'selfCheck'}
                    onClick={() => handleRegenerateSection('selfCheck')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${
                        regeneratingKey === 'selfCheck' ? 'animate-spin' : ''
                      }`}
                    />
                    <span>
                      {regeneratingKey === 'selfCheck'
                        ? 'AI 재생성 중...'
                        : 'AI로 다시 생성'}
                    </span>
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-1 bg-slate-800 text-white text-xs font-bold rounded-md">
                  스스로 점검
                </span>
                <h3 className="text-base font-bold text-slate-900">
                  오늘 배운 내용을 스스로 점검해 봅시다
                </h3>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {worksheet.selfCheckSection.items.map((sc, sIdx) => (
                    <div key={sc.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={sc.statement}
                        onChange={(e) => {
                          const next = [...worksheet.selfCheckSection.items];
                          next[sIdx] = { ...sc, statement: e.target.value };
                          setWorksheet({
                            ...worksheet,
                            selfCheckSection: {
                              ...worksheet.selfCheckSection,
                              items: next,
                            },
                          });
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const next = worksheet.selfCheckSection.items.filter(
                            (_, i) => i !== sIdx
                          );
                          setWorksheet({
                            ...worksheet,
                            selfCheckSection: {
                              ...worksheet.selfCheckSection,
                              items: next,
                            },
                          });
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setWorksheet({
                        ...worksheet,
                        selfCheckSection: {
                          ...worksheet.selfCheckSection,
                          items: [
                            ...worksheet.selfCheckSection.items,
                            {
                              id: `sc_${Date.now()}`,
                              statement: '새로운 자기점검 문항을 입력하세요.',
                            },
                          ],
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>점검 항목 추가</span>
                  </button>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs">
                        <th className="py-2.5 px-4">점검 내용</th>
                        <th className="py-2.5 px-4 w-48 text-center">성취도</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {worksheet.selfCheckSection.items.map((sc) => (
                        <tr key={sc.id}>
                          <td className="py-3 px-4 text-slate-800">
                            {sc.statement}
                          </td>
                          <td className="py-3 px-4 text-center text-xs text-slate-500">
                            □ 잘함 &nbsp; □ 보통 &nbsp; □ 노력 요함
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Bottom Sticky Bar (#3-5 Distribute to Students) */}
        <footer className="no-print bg-white border-t border-slate-200 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 font-mono-tabular">
                활동 {worksheet.activities.length}개 · 학생이 채울 칸 {totalBlanks}개
              </p>
              <p className="text-xs text-slate-500">
                초안은 자동으로 저장돼 있어요. 확인한 뒤 배포해 주세요.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isEditing && (
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveChanges}
                className="px-4 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                {saving ? '저장 중...' : '편집 내용 저장'}
              </button>
            )}

            <button
              type="button"
              disabled={saving}
              onClick={handleDistributeClick}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>이 학습지를 학생들에게 배포</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};
