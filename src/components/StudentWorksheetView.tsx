import React, { useEffect, useState } from 'react';
import {
  FileText,
  GraduationCap,
  CheckCircle2,
  Send,
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react';
import { Worksheet, StudentSubmission } from '../types/worksheet';
import { countWorksheetBlanks } from '../utils/worksheetHelpers';

interface StudentWorksheetViewProps {
  worksheet: Worksheet;
  isTeacherPreview?: boolean;
  onBackToTeacher?: () => void;
  onSubmissionComplete?: (submission: StudentSubmission) => void;
}

export const StudentWorksheetView: React.FC<StudentWorksheetViewProps> = ({
  worksheet,
  isTeacherPreview = false,
  onBackToTeacher,
  onSubmissionComplete,
}) => {
  const storageKey = `student_draft_${worksheet.id}`;

  const [studentId, setStudentId] = useState<string>('');
  const [studentName, setStudentName] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [identityError, setIdentityError] = useState<string | null>(null);
  const [showEmptyConfirmModal, setShowEmptyConfirmModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submittedResult, setSubmittedResult] = useState<StudentSubmission | null>(
    null
  );

  // Restore auto-saved draft from sessionStorage (#4-1)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.studentId) setStudentId(parsed.studentId);
        if (parsed.studentName) setStudentName(parsed.studentName);
        if (parsed.answers) setAnswers(parsed.answers);
      }
    } catch {
      // Ignore storage read errors
    }
  }, [storageKey]);

  // Auto-save to sessionStorage on change
  useEffect(() => {
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ studentId, studentName, answers })
      );
    } catch {
      // Ignore storage write errors
    }
  }, [storageKey, studentId, studentName, answers]);

  const { totalBlanks, allSlotIds } = countWorksheetBlanks(worksheet);

  const unansweredSlots = allSlotIds.filter((slot) => {
    const val = answers[slot.id];
    return !val || val.trim().length === 0;
  });

  const filledCount = totalBlanks - unansweredSlots.length;
  const progressPercent =
    totalBlanks > 0 ? Math.round((filledCount / totalBlanks) * 100) : 0;

  const updateAnswer = (slotId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [slotId]: value,
    }));
  };

  // Validate and check for empty blanks (#4-2)
  const handleAttemptSubmit = () => {
    setIdentityError(null);
    if (!studentId.trim() || !studentName.trim()) {
      setIdentityError('제출하기 전에 상단의 학번과 이름을 모두 입력해 주세요.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (unansweredSlots.length > 0) {
      setShowEmptyConfirmModal(true);
      return;
    }

    executeSubmit();
  };

  const handleRetrySolving = () => {
    setShowEmptyConfirmModal(false);
    if (unansweredSlots.length > 0) {
      const firstEmptyId = unansweredSlots[0].id;
      const el = document.getElementById(`slot_${firstEmptyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
    }
  };

  const executeSubmit = async () => {
    setShowEmptyConfirmModal(false);
    setSubmitting(true);
    try {
      const res = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          worksheetId: worksheet.id,
          studentId: studentId.trim(),
          studentName: studentName.trim(),
          answers,
        }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || '제출 중 오류가 발생했습니다.');
      }
      const data = await res.json();
      sessionStorage.removeItem(storageKey);
      setSubmittedResult(data.submission);
      if (onSubmissionComplete) {
        onSubmissionComplete(data.submission);
      }
    } catch (err) {
      setIdentityError(
        err instanceof Error ? err.message : '답안 제출에 실패했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Render inline fill_blank inputs
  const renderStudentFillBlank = (
    itemId: string,
    questionText: string,
    idx: number
  ) => {
    const val = answers[itemId] || '';
    const parts = questionText.split(/\[\s*빈칸\s*\]/);

    if (parts.length === 1) {
      return (
        <div
          id={`slot_${itemId}`}
          className="flex flex-wrap items-center gap-2 leading-relaxed text-slate-800"
        >
          <span className="font-semibold text-slate-500 mr-1">{idx + 1}.</span>
          <span>{questionText}</span>
          <input
            type="text"
            value={val}
            onChange={(e) => updateAnswer(itemId, e.target.value)}
            placeholder="답 입력"
            className="px-3 py-1.5 w-36 rounded-lg border border-blue-300 bg-white text-slate-900 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      );
    }

    return (
      <div id={`slot_${itemId}`} className="leading-loose text-slate-800">
        <span className="font-semibold text-slate-500 mr-2">{idx + 1}.</span>
        {parts.map((part, pIdx) => (
          <React.Fragment key={pIdx}>
            <span>{part}</span>
            {pIdx < parts.length - 1 && (
              <input
                type="text"
                value={val}
                onChange={(e) => updateAnswer(itemId, e.target.value)}
                placeholder="빈칸 입력"
                className="inline-block mx-1.5 px-3 py-1 w-32 rounded-lg border border-blue-300 bg-white text-blue-900 font-semibold text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-600 align-middle"
              />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  if (submittedResult) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <FileText className="w-5 h-5" />
            </div>
            <span className="text-lg font-bold text-slate-900">AI 학습지 도우미</span>
          </div>
          {isTeacherPreview && onBackToTeacher && (
            <button
              type="button"
              onClick={onBackToTeacher}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>교사 스튜디오로 돌아가기</span>
            </button>
          )}
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200 shadow-sm p-8 text-center space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-slate-900">
                답안 제출이 완료되었어요!
              </h1>
              <p className="text-sm text-slate-600">
                {submittedResult.studentId} {submittedResult.studentName} 학생의 답안이
                선생님께 안전하게 전달되었습니다.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-500 mb-1">작성한 칸</p>
                <p className="text-lg font-bold text-slate-900 font-mono-tabular">
                  {submittedResult.filledCount} / {submittedResult.totalBlanks}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-1">자동 채점 결과</p>
                <p className="text-lg font-bold text-blue-600 font-mono-tabular">
                  {submittedResult.score} / {submittedResult.totalGradable}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setSubmittedResult(null);
                }}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>다시 작성하여 재제출하기</span>
              </button>

              {isTeacherPreview && onBackToTeacher && (
                <button
                  type="button"
                  onClick={onBackToTeacher}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>교사 화면에서 제출 현황 확인하기</span>
                </button>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col pb-24">
      {/* Top Bar (Image 5) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-2xs">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 학습지 도우미
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isTeacherPreview && onBackToTeacher && (
            <button
              type="button"
              onClick={onBackToTeacher}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>교사 스튜디오로 돌아가기</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-3xl w-full mx-auto px-4 py-6 space-y-5 flex-1">
        {/* Student Identity & Progress Card (Image 5, #4-1) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <GraduationCap className="w-4 h-4 text-blue-600" />
              <span>
                {worksheet.grade} · {worksheet.subject}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span>자동 저장 켜짐</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                학번
              </label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="예) 10101"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono-tabular"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                이름
              </label>
              <input
                type="text"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="이름 입력"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {identityError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              {identityError}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              작성 중인 답은 자동 저장돼요 (새로고침해도 유지, 창을 닫으면 지워짐)
            </span>
          </div>

          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">작성한 칸</span>
              <span className="font-bold text-blue-700 font-mono-tabular">
                {filledCount} / {totalBlanks} ({progressPercent}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-transform duration-150 origin-left"
                style={{
                  transform: `scaleX(${Math.min(1, Math.max(0, progressPercent / 100))})`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Worksheet Paper Card (Image 5) */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 md:p-8 space-y-8">
          {/* Decorative Spectrum Bar */}
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
          <div className="border-b-2 border-slate-900 pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold text-slate-900 leading-snug">
                {worksheet.title}
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {worksheet.subject} | {worksheet.grade}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
              <div>
                학번:{' '}
                <span className="inline-block min-w-[64px] border-b border-slate-800 font-semibold text-slate-900 px-1 font-mono-tabular">
                  {studentId}
                </span>
              </div>
              <div>
                이름:{' '}
                <span className="inline-block min-w-[64px] border-b border-slate-800 font-semibold text-slate-900 px-1">
                  {studentName}
                </span>
              </div>
            </div>
          </div>

          {/* Section 1: 개념 이해 */}
          <section className="space-y-3">
            <div className="border-l-4 border-blue-600 bg-slate-50 p-4 rounded-r-xl">
              <p className="text-base font-medium text-slate-800 leading-relaxed">
                {worksheet.conceptSection.summary}
              </p>
            </div>
            <ul className="list-disc list-inside space-y-1.5 text-sm text-slate-700 pl-1">
              {worksheet.conceptSection.objectives.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </section>

          {/* Section 2: 생각 열기 */}
          <section className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-md">
                생각 열기
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {worksheet.warmUpSection.title}
              </h2>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-700 leading-relaxed">
              {worksheet.warmUpSection.scenario}
            </div>

            {worksheet.warmUpSection.questions.map((q, idx) => (
              <div key={q.id} className="space-y-2">
                <label
                  htmlFor={`slot_${q.id}`}
                  className="block text-sm font-semibold text-slate-800"
                >
                  생각 질문 {idx + 1}. {q.prompt}
                </label>
                <textarea
                  id={`slot_${q.id}`}
                  value={answers[q.id] || ''}
                  onChange={(e) => updateAnswer(q.id, e.target.value)}
                  rows={2}
                  placeholder="자신의 생각을 자유롭게 적어 보세요."
                  className="w-full p-3 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            ))}
          </section>

          {/* Section 3: 활동 1..N */}
          <section className="space-y-8 pt-4 border-t border-slate-200">
            {worksheet.activities.map((act, actIdx) => (
              <div
                key={act.id}
                className="space-y-4 pb-6 border-b border-slate-100 last:border-b-0"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-1 bg-blue-600 text-white text-xs font-bold rounded-md">
                      활동 {actIdx + 1}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900">
                      {act.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600">{act.instruction}</p>
                </div>

                {act.type === 'fill_blank' && (
                  <div className="p-5 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3.5">
                    {act.items.map((item, idx) => (
                      <div key={item.id}>
                        {renderStudentFillBlank(item.id, item.question, idx)}
                      </div>
                    ))}
                  </div>
                )}

                {act.type === 'ox_fix' && (
                  <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                    {act.items.map((item, idx) => {
                      const selected = (answers[item.id] || '').toUpperCase();
                      return (
                        <div
                          key={item.id}
                          id={`slot_${item.id}`}
                          className="p-4 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <p className="text-sm font-medium text-slate-800 flex-1">
                            <span className="font-semibold text-slate-500 mr-1.5">
                              {idx + 1}.
                            </span>
                            {item.question}
                          </p>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateAnswer(item.id, 'O')}
                              className={`w-10 h-10 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                                selected === 'O'
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              O
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAnswer(item.id, 'X')}
                              className={`w-10 h-10 rounded-xl border text-sm font-bold transition-colors cursor-pointer ${
                                selected === 'X'
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                                  : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              X
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {act.type === 'table' && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                          <th className="py-2.5 px-4 w-1/3">구분 / 대상</th>
                          <th className="py-2.5 px-4">구해야 할 항목</th>
                          <th className="py-2.5 px-4 w-44">답안 입력</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {act.items.map((item, idx) => (
                          <tr key={item.id} className="bg-white">
                            <td className="py-3 px-4 font-medium text-slate-700 bg-slate-50/60">
                              {item.subPrompt || `항목 ${idx + 1}`}
                            </td>
                            <td className="py-3 px-4 text-slate-800">
                              {item.question}
                            </td>
                            <td className="py-3 px-4">
                              <input
                                id={`slot_${item.id}`}
                                type="text"
                                value={answers[item.id] || ''}
                                onChange={(e) =>
                                  updateAnswer(item.id, e.target.value)
                                }
                                placeholder="답 입력"
                                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {(act.type === 'worked_example' ||
                  act.type === 'short_answer') && (
                  <div className="space-y-3">
                    {act.items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <label
                          htmlFor={`slot_${item.id}`}
                          className="text-sm font-medium text-slate-800 flex-1"
                        >
                          <span className="font-semibold text-blue-600 mr-1.5">
                            문항 {idx + 1}.
                          </span>
                          {item.question}
                        </label>
                        <input
                          id={`slot_${item.id}`}
                          type="text"
                          value={answers[item.id] || ''}
                          onChange={(e) =>
                            updateAnswer(item.id, e.target.value)
                          }
                          placeholder="정답을 입력하세요"
                          className="sm:w-56 px-3.5 py-2 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Section 4: 스스로 점검 */}
          <section className="space-y-4 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2.5">
              <span className="px-2.5 py-1 bg-slate-800 text-white text-xs font-bold rounded-md">
                스스로 점검
              </span>
              <h3 className="text-base font-bold text-slate-900">
                오늘 배운 내용을 스스로 점검해 보세요
              </h3>
            </div>

            <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
              {worksheet.selfCheckSection.items.map((sc) => {
                const currentVal = answers[sc.id] || '';
                return (
                  <div
                    key={sc.id}
                    id={`slot_${sc.id}`}
                    className="p-3.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <span className="text-sm text-slate-800 flex-1">
                      {sc.statement}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(['잘함', '보통', '노력 요함'] as const).map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => updateAnswer(sc.id, level)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            currentVal === level
                              ? 'bg-blue-600 border-blue-600 text-white'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {worksheet.selfCheckSection.reflectionPrompt && (
              <div className="space-y-2 pt-2">
                <label
                  htmlFor="slot_self_reflection"
                  className="block text-sm font-semibold text-slate-800"
                >
                  {worksheet.selfCheckSection.reflectionPrompt}
                </label>
                <input
                  id="slot_self_reflection"
                  type="text"
                  value={answers['self_reflection'] || ''}
                  onChange={(e) =>
                    updateAnswer('self_reflection', e.target.value)
                  }
                  placeholder="오늘 배운 핵심 내용을 한 문장으로 정리해 보세요."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Bottom Sticky Submit Bar (Image 5) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-4 py-3">
        <div className="max-w-xl mx-auto flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-mono-tabular">
              {totalBlanks}칸 중 {filledCount}칸 작성
            </span>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={handleAttemptSubmit}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <span>{submitting ? '제출 처리 중...' : '제출하기'}</span>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Empty Blank Confirmation Popup Modal (#4-2, #4-3) */}
      {showEmptyConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-xl p-6 md:p-7 space-y-5">
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900">
                  아직 작성하지 않은 빈칸이 있어요!
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  전체 <strong className="text-slate-900">{totalBlanks}칸</strong> 중{' '}
                  <strong className="text-red-600 font-bold">
                    {unansweredSlots.length}칸
                  </strong>
                  이 비어 있습니다. 빈칸을 확인하고 마저 풀어볼까요?
                </p>
              </div>
            </div>

            {/* List of unanswered slots */}
            <div className="max-h-44 overflow-y-auto p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <p className="text-xs font-bold text-slate-700 mb-1">
                미작성 문항 목록 ({unansweredSlots.length}개)
              </p>
              {unansweredSlots.slice(0, 12).map((slot) => (
                <div
                  key={slot.id}
                  className="text-xs text-slate-600 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span>{slot.label}</span>
                </div>
              ))}
              {unansweredSlots.length > 12 && (
                <p className="text-xs text-slate-400 pt-1">
                  외 {unansweredSlots.length - 12}개 문항...
                </p>
              )}
            </div>

            {/* Two Choice Buttons (#4-3: 다시 풀기 / 그래도 제출) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={handleRetrySolving}
                className="py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer"
              >
                다시 풀기
              </button>
              <button
                type="button"
                onClick={executeSubmit}
                className="py-3 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                그래도 제출
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
