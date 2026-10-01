import React, { useState } from 'react';
import {
  HardDrive,
  Sparkles,
  Trash2,
  Download,
  Upload,
  CheckCircle2,
  X,
  FileArchive,
} from 'lucide-react';
import { StorageStats, Worksheet, StudentSubmission } from '../types/worksheet';

interface StorageManagerModalProps {
  storageStats: StorageStats;
  worksheets: Worksheet[];
  submissions: StudentSubmission[];
  onClose: () => void;
  onCleanup: (
    mode:
      | 'drafts'
      | 'empty_submissions'
      | 'clear_worksheet_submissions'
      | 'optimize'
      | 'import',
    worksheetId?: string,
    importedData?: { worksheets?: Worksheet[]; submissions?: StudentSubmission[] }
  ) => Promise<string>;
}

export const StorageManagerModal: React.FC<StorageManagerModalProps> = ({
  storageStats,
  worksheets,
  submissions,
  onClose,
  onCleanup,
}) => {
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAction = async (
    mode:
      | 'drafts'
      | 'empty_submissions'
      | 'clear_worksheet_submissions'
      | 'optimize',
    worksheetId?: string
  ) => {
    setBusy(true);
    setNotice(null);
    try {
      const msg = await onCleanup(mode, worksheetId);
      setNotice(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      worksheets,
      submissions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI학습지_아카이브_백업_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice('전체 학습지 및 제출 답안 백업 파일(JSON)을 다운로드했습니다.');
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        setBusy(true);
        const msg = await onCleanup('import', undefined, parsed);
        setNotice(msg);
      } catch {
        setNotice('올바른 백업 JSON 파일이 아닙니다.');
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  const draftCount = worksheets.filter((w) => w.status === 'draft').length;
  const emptySubCount = submissions.filter((s) => s.filledCount === 0).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                데이터 용량 및 아카이브 정리소
              </h2>
              <p className="text-xs text-slate-500">
                무료 저장 용량을 초과하지 않도록 데이터를 압축 보관하고 정리합니다
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Capacity Meter */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-800">
                현재 데이터 저장소 사용량
              </span>
              <span className="text-sm font-bold text-blue-700 font-mono-tabular">
                {formatBytes(storageStats.usedBytes)} /{' '}
                {formatBytes(storageStats.maxBytes)} ({storageStats.usagePercent}%)
              </span>
            </div>

            <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-transform duration-200 origin-left"
                style={{
                  transform: `scaleX(${Math.max(
                    0.01,
                    Math.min(1, storageStats.usagePercent / 100)
                  )})`,
                }}
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <p className="text-xs text-slate-500">보관 중인 학습지</p>
                <p className="text-base font-bold text-slate-900 font-mono-tabular mt-0.5">
                  {storageStats.worksheetCount}개
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <p className="text-xs text-slate-500">누적 학생 답안</p>
                <p className="text-base font-bold text-slate-900 font-mono-tabular mt-0.5">
                  {storageStats.submissionCount}건
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <p className="text-xs text-slate-500">추가 생성 가능 학습지</p>
                <p className="text-base font-bold text-blue-600 font-mono-tabular mt-0.5">
                  약 {storageStats.estimatedRemainingWorksheets.toLocaleString()}개
                </p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200/80">
                <p className="text-xs text-slate-500">추가 수집 가능 답안</p>
                <p className="text-base font-bold text-blue-600 font-mono-tabular mt-0.5">
                  약 {storageStats.estimatedRemainingSubmissions.toLocaleString()}건
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed pt-1">
              • <strong>용량 절약 설계 적용됨:</strong> 학생이 답안을 제출할 때 학습지
              문항 전체를 중복 저장하지 않고 문항 ID와 핵심 답안 텍스트만 정규화하여
              일반 저장 방식 대비 <strong>약 92%의 용량을 절약</strong>합니다.
            </p>
          </div>

          {notice && (
            <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {/* Cleanup Actions */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              원클릭 데이터 정리 도구
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => handleAction('optimize')}
                className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left space-y-1.5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-blue-600">추천</span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  데이터 압축 최적화
                </p>
                <p className="text-xs text-slate-500">
                  불필요한 공백 및 연결 끊긴 답안 데이터를 정리합니다.
                </p>
              </button>

              <button
                type="button"
                disabled={busy || emptySubCount === 0}
                onClick={() => handleAction('empty_submissions')}
                className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50 text-left space-y-1.5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <Trash2 className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                    {emptySubCount}건
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  백지(0칸) 제출 정리
                </p>
                <p className="text-xs text-slate-500">
                  실수로 빈칸만 제출한 학생 기록을 일괄 삭제합니다.
                </p>
              </button>

              <button
                type="button"
                disabled={busy || draftCount === 0}
                onClick={() => handleAction('drafts')}
                className="p-4 rounded-2xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 disabled:opacity-50 text-left space-y-1.5 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <FileArchive className="w-4 h-4 text-slate-600" />
                  <span className="text-xs font-mono-tabular font-semibold text-slate-600">
                    {draftCount}개
                  </span>
                </div>
                <p className="text-sm font-bold text-slate-900">
                  미배포 초안 정리
                </p>
                <p className="text-xs text-slate-500">
                  배포하지 않고 남아있는 초안 학습지를 정리합니다.
                </p>
              </button>
            </div>
          </div>

          {/* Backup & Restore */}
          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h4 className="text-sm font-bold text-slate-900">
                전체 데이터 내 컴퓨터로 백업 및 복원
              </h4>
              <p className="text-xs text-slate-500">
                학기가 끝난 학습지는 JSON 파일로 PC에 보관하고 서버 용량을 비울 수 있어요.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>백업 다운로드</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>백업 복원</span>
                <input
                  type="file"
                  accept="application/json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
