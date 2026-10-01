import React, { useState } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  X,
  Info,
  Check,
  Download,
  Trash2,
} from 'lucide-react';
import { Worksheet, StudentSubmission } from '../types/worksheet';
import { getGradableItemsList } from '../utils/worksheetHelpers';

interface SubmissionsDashboardModalProps {
  worksheet: Worksheet;
  submissions: StudentSubmission[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onToggleGrade: (
    submissionId: string,
    itemId: string,
    isCorrect: boolean
  ) => Promise<void>;
  onDeleteSubmission: (submissionId: string) => Promise<void>;
}

export const SubmissionsDashboardModal: React.FC<
  SubmissionsDashboardModalProps
> = ({
  worksheet,
  submissions,
  onClose,
  onRefresh,
  onToggleGrade,
  onDeleteSubmission,
}) => {
  // Default expand the first submission if available so teachers can immediately inspect details
  const [expandedSubId, setExpandedSubId] = useState<string | null>(
    submissions.length > 0 ? submissions[0].id : null
  );
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [updatingGradeKey, setUpdatingGradeKey] = useState<string | null>(null);

  const gradableItems = getGradableItemsList(worksheet);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleItemGrade = async (
    submissionId: string,
    itemId: string,
    currentVal: boolean
  ) => {
    const key = `${submissionId}_${itemId}`;
    setUpdatingGradeKey(key);
    try {
      await onToggleGrade(submissionId, itemId, !currentVal);
    } finally {
      setUpdatingGradeKey(null);
    }
  };

  // Dashboard metrics calculation (#5-1)
  const totalSubmissions = submissions.length;
  const avgCompletionRate =
    totalSubmissions > 0
      ? Math.round(
          (submissions.reduce(
            (acc, s) =>
              acc + (s.totalBlanks > 0 ? (s.filledCount / s.totalBlanks) * 100 : 0),
            0
          ) /
            totalSubmissions)
        )
      : 0;

  const avgScore =
    totalSubmissions > 0
      ? (
          submissions.reduce((acc, s) => acc + s.score, 0) / totalSubmissions
        ).toFixed(1)
      : '0.0';

  const avgAccuracyRate =
    totalSubmissions > 0 && gradableItems.length > 0
      ? Math.round(
          (submissions.reduce((acc, s) => acc + s.score, 0) /
            (totalSubmissions * gradableItems.length)) *
            100
        )
      : 0;

  // Find the item with the most incorrect answers
  let hardestItemLabel = '데이터 수집 중';
  if (totalSubmissions > 0 && gradableItems.length > 0) {
    let maxWrong = -1;
    gradableItems.forEach((item, idx) => {
      const wrongCount = submissions.filter((s) => !s.grades?.[item.id]).length;
      if (wrongCount > maxWrong) {
        maxWrong = wrongCount;
        hardestItemLabel = `${item.activityTitle} (문항 ${idx + 1}) · 오답 ${wrongCount}명`;
      }
    });
  }

  // Export CSV for teacher record keeping (#7)
  const handleExportCSV = () => {
    const headers = [
      '제출시각',
      '학번',
      '이름',
      '작성수',
      '총빈칸수',
      '채점점수',
      '총채점문항',
      ...gradableItems.map((it, i) => `문항${i + 1}(${it.expectedAnswer})`),
    ];
    const rows = submissions.map((s) => [
      s.submittedAt,
      s.studentId,
      s.studentName,
      String(s.filledCount),
      String(s.totalBlanks),
      String(s.score),
      String(s.totalGradable),
      ...gradableItems.map((it) => {
        const ans = s.answers?.[it.id] || '(빈칸)';
        const mark = s.grades?.[it.id] ? 'O' : 'X';
        return `"${ans.replace(/"/g, '""')} [${mark}]"`;
      }),
    ]);

    const csvContent =
      '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${worksheet.title}_제출현황.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
      <div className="w-full max-w-6xl max-h-[92vh] bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col overflow-hidden">
        {/* Header (Image 6 & 8) */}
        <header className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">제출 현황</h2>
                <span className="text-sm font-bold text-blue-600 font-mono-tabular">
                  {submissions.length}건
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {worksheet.title} · {worksheet.subject}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {submissions.length > 0 && (
              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>CSV(엑셀) 저장</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-600 ${
                  refreshing ? 'animate-spin' : ''
                }`}
              />
              <span>새로고침</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50/50">
          {/* Dashboard Summary Metrics (#5-1) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">총 제출 인원</p>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono-tabular">
                {totalSubmissions}명
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">평균 빈칸 작성률</p>
              <p className="text-xl font-bold text-blue-600 mt-1 font-mono-tabular">
                {avgCompletionRate}%
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">
                평균 채점 점수 (정답률)
              </p>
              <p className="text-xl font-bold text-slate-900 mt-1 font-mono-tabular">
                {avgScore} / {gradableItems.length}{' '}
                <span className="text-xs font-semibold text-blue-600">
                  ({avgAccuracyRate}%)
                </span>
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200">
              <p className="text-xs text-slate-500 font-medium">
                오답 최다 주의 문항
              </p>
              <p className="text-xs font-semibold text-slate-800 mt-1.5 line-clamp-2">
                {hardestItemLabel}
              </p>
            </div>
          </div>

          {/* Info Notice Banner (Image 6 & 8) */}
          <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50/70 border border-blue-100 px-4 py-3 rounded-xl">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>
              객관식·빈칸은 정답과 비교한 자동 채점이에요. 동의어나 표현 차이로 ×가 나올 수 있어요.{' '}
              <strong className="font-semibold text-slate-900">[결과 보기]</strong>에서{' '}
              <strong className="font-semibold text-blue-700">✓ / ×</strong>를 누르면 선생님이
              채점을 바꿀 수 있어요.
            </span>
          </div>

          {/* Submissions List & Expandable Student Detail Table (Image 6 & 8) */}
          {submissions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
              <p className="text-sm font-bold text-slate-800">
                아직 제출된 학생 답안이 없어요
              </p>
              <p className="text-xs text-slate-500">
                학생들에게 QR 코드나 접속 주소를 안내하면 제출 현황이 실시간으로 이곳에
                표시됩니다.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-6 py-3.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <div className="col-span-3">제출 시각</div>
                <div className="col-span-2">학번</div>
                <div className="col-span-2">이름</div>
                <div className="col-span-2">작성</div>
                <div className="col-span-1">채점</div>
                <div className="col-span-2 text-right">상세 / 관리</div>
              </div>

              {/* Submission Rows */}
              <div className="divide-y divide-slate-200">
                {submissions.map((sub) => {
                  const isExpanded = expandedSubId === sub.id;
                  return (
                    <div key={sub.id} className="bg-white">
                      {/* Summary Row (Image 6) */}
                      <div className="grid grid-cols-12 gap-2 px-6 py-4 items-center text-sm hover:bg-slate-50/60 transition-colors">
                        <div className="col-span-3 text-slate-600 font-mono-tabular text-xs md:text-sm">
                          {sub.submittedAt}
                        </div>
                        <div className="col-span-2 font-medium text-slate-900 font-mono-tabular">
                          {sub.studentId}
                        </div>
                        <div className="col-span-2 font-semibold text-slate-900">
                          {sub.studentName}
                        </div>
                        <div className="col-span-2 text-slate-700 font-mono-tabular">
                          {sub.filledCount}/{sub.totalBlanks}
                        </div>
                        <div className="col-span-1 font-mono-tabular">
                          <strong className="font-bold text-slate-900">
                            {sub.score}
                          </strong>{' '}
                          <span className="text-slate-500">
                            / {sub.totalGradable}
                          </span>
                        </div>
                        <div className="col-span-2 flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSubId(isExpanded ? null : sub.id)
                            }
                            className={`px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                              isExpanded
                                ? 'bg-slate-900 border-slate-900 text-white'
                                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            {isExpanded ? '접기' : '결과 보기'}
                          </button>

                          <button
                            type="button"
                            onClick={() => onDeleteSubmission(sub.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title="제출 기록 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Expanded Student Detail Grading Table (Image 8, #6-1) */}
                      {isExpanded && (
                        <div className="px-6 pb-6 pt-2 bg-slate-50/40 border-t border-slate-100 space-y-4">
                          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <table className="w-full text-xs md:text-sm text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs">
                                  <th className="py-3 px-4 w-52 border-r border-slate-200">
                                    활동
                                  </th>
                                  <th className="py-3 px-4 border-r border-slate-200">
                                    문항
                                  </th>
                                  <th className="py-3 px-4 w-36 border-r border-slate-200">
                                    학생 답
                                  </th>
                                  <th className="py-3 px-4 w-40 border-r border-slate-200">
                                    정답/예시
                                  </th>
                                  <th className="py-3 px-4 w-20 text-center">
                                    채점
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {gradableItems.map((item) => {
                                  const studentAns =
                                    sub.answers?.[item.id]?.trim() || '';
                                  const isCorrect = Boolean(
                                    sub.grades?.[item.id]
                                  );
                                  const isUpdating =
                                    updatingGradeKey === `${sub.id}_${item.id}`;

                                  return (
                                    <tr
                                      key={item.id}
                                      className="hover:bg-slate-50/70 transition-colors"
                                    >
                                      <td className="py-3 px-4 text-slate-600 font-medium border-r border-slate-200 align-middle">
                                        {item.activityTitle}
                                      </td>
                                      <td className="py-3 px-4 text-slate-900 border-r border-slate-200 align-middle">
                                        <p className="line-clamp-2 leading-relaxed">
                                          {item.question}
                                        </p>
                                      </td>
                                      <td className="py-3 px-4 border-r border-slate-200 align-middle">
                                        {studentAns ? (
                                          <span className="font-semibold text-slate-900">
                                            {studentAns}
                                          </span>
                                        ) : (
                                          <span className="text-slate-400">
                                            (빈칸)
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 text-slate-600 border-r border-slate-200 align-middle">
                                        {item.expectedAnswer}
                                      </td>
                                      <td className="py-3 px-4 text-center align-middle">
                                        <button
                                          type="button"
                                          disabled={isUpdating}
                                          onClick={() =>
                                            handleToggleItemGrade(
                                              sub.id,
                                              item.id,
                                              isCorrect
                                            )
                                          }
                                          title="클릭하여 정답(✓) / 오답(×) 변경"
                                          className={`w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-sm transition-colors cursor-pointer ${
                                            isCorrect
                                              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                                              : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                                          }`}
                                        >
                                          {isCorrect ? (
                                            <Check className="w-4 h-4 stroke-[2.5]" />
                                          ) : (
                                            <X className="w-4 h-4 stroke-[2.5]" />
                                          )}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Open-ended Warm-up & Self-reflection responses */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-700">
                                생각 열기 학생 서술 답안:
                              </span>
                              {worksheet.warmUpSection.questions.map((q) => (
                                <p key={q.id} className="text-slate-600">
                                  {sub.answers?.[q.id] || '(미작성)'}
                                </p>
                              ))}
                            </div>
                            <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1">
                              <span className="font-bold text-slate-700">
                                스스로 점검 및 한 줄 성찰:
                              </span>
                              <p className="text-slate-600">
                                {sub.answers?.['self_reflection'] || '(미작성)'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
