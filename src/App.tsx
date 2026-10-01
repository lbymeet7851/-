import React, { useCallback, useEffect, useState } from 'react';
import {
  Worksheet,
  StudentSubmission,
  StorageStats,
  DifficultyLevel,
} from './types/worksheet';
import {
  INITIAL_SEED_WORKSHEET,
  INITIAL_SEED_SUBMISSIONS,
} from './utils/worksheetHelpers';
import { InitialSetupScreen } from './components/InitialSetupScreen';
import { MainStudioScreen } from './components/MainStudioScreen';
import { TeacherWorksheetModal } from './components/TeacherWorksheetModal';
import { DistributeModal } from './components/DistributeModal';
import { StudentWorksheetView } from './components/StudentWorksheetView';
import { SubmissionsDashboardModal } from './components/SubmissionsDashboardModal';
import { StorageManagerModal } from './components/StorageManagerModal';

export default function App() {
  const [loading, setLoading] = useState<boolean>(true);
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [schoolName, setSchoolName] = useState<string>('이천고등학교');
  const [hasGeminiKey, setHasGeminiKey] = useState<boolean>(true);

  const [worksheets, setWorksheets] = useState<Worksheet[]>([
    INITIAL_SEED_WORKSHEET,
  ]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>(
    INITIAL_SEED_SUBMISSIONS
  );
  const [storageStats, setStorageStats] = useState<StorageStats>({
    usedBytes: 6420,
    maxBytes: 50 * 1024 * 1024,
    usagePercent: 0.012,
    worksheetCount: 1,
    submissionCount: 2,
    estimatedRemainingWorksheets: 11600,
    estimatedRemainingSubmissions: 116000,
  });

  // Active modals / screens
  const [activeWorksheetModal, setActiveWorksheetModal] =
    useState<Worksheet | null>(null);
  const [activeDistributeModal, setActiveDistributeModal] =
    useState<Worksheet | null>(null);
  const [activeSubmissionsModal, setActiveSubmissionsModal] =
    useState<Worksheet | null>(null);
  const [showStorageModal, setShowStorageModal] = useState<boolean>(false);

  // Student mode state (either via URL ?worksheetId=...&mode=student or teacher preview)
  const [studentViewWorksheet, setStudentViewWorksheet] =
    useState<Worksheet | null>(null);
  const [isTeacherStudentPreview, setIsTeacherStudentPreview] =
    useState<boolean>(false);

  const fetchAppState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) return;
      const data = await res.json();
      if (data.teacherConfig) {
        setIsConfigured(Boolean(data.teacherConfig.isConfigured));
        setSchoolName(data.teacherConfig.schoolName || '이천고등학교');
        setHasGeminiKey(Boolean(data.teacherConfig.hasGeminiKey));
      }
      if (Array.isArray(data.worksheets)) {
        setWorksheets(data.worksheets);
      }
      if (Array.isArray(data.submissions)) {
        setSubmissions(data.submissions);
      }
      if (data.storageStats) {
        setStorageStats(data.storageStats);
      }
    } catch (err) {
      console.error('Failed to load state:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wsId = params.get('worksheetId');
    const mode = params.get('mode');

    if (wsId && mode === 'student') {
      fetch(`/api/worksheets/${encodeURIComponent(wsId)}/public`)
        .then((r) => r.json())
        .then((data) => {
          if (data.worksheet) {
            setStudentViewWorksheet(data.worksheet);
            setIsTeacherStudentPreview(false);
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      fetchAppState();
    }
  }, [fetchAppState]);

  const handleCompleteSetup = async (pin: string, updatedSchool: string) => {
    const res = await fetch('/api/teacher/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, schoolName: updatedSchool }),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || '설정 저장에 실패했습니다.');
    }
    const data = await res.json();
    setIsConfigured(true);
    setSchoolName(data.teacherConfig?.schoolName || updatedSchool);
    setIsAuthenticated(true);
  };

  const handleVerifyPin = async (pin: string): Promise<boolean> => {
    const res = await fetch('/api/teacher/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) return false;
    setIsAuthenticated(true);
    return true;
  };

  const handleGenerateWorksheet = async (params: {
    topicPrompt: string;
    subject: string;
    grade: string;
    difficulty: DifficultyLevel;
    preferences: string;
  }) => {
    const res = await fetch('/api/worksheets/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'AI 학습지 설계 중 오류가 발생했습니다.');
    }
    const data = await res.json();
    if (data.worksheet) {
      setWorksheets((prev) => [data.worksheet, ...prev]);
      if (data.storageStats) setStorageStats(data.storageStats);
      setActiveWorksheetModal(data.worksheet);
    }
  };

  const handleSaveWorksheet = async (updated: Worksheet) => {
    const res = await fetch(`/api/worksheets/${encodeURIComponent(updated.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
    if (res.ok) {
      const data = await res.json();
      setWorksheets((prev) =>
        prev.map((w) => (w.id === updated.id ? data.worksheet : w))
      );
      if (data.storageStats) setStorageStats(data.storageStats);
    }
  };

  const handleDistributeWorksheet = async (updated: Worksheet) => {
    await handleSaveWorksheet(updated);
    setActiveWorksheetModal(null);
    setActiveDistributeModal(updated);
  };

  const handleDeleteWorksheet = async (id: string) => {
    const res = await fetch(`/api/worksheets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      const data = await res.json();
      setWorksheets((prev) => prev.filter((w) => w.id !== id));
      setSubmissions((prev) => prev.filter((s) => s.worksheetId !== id));
      if (data.storageStats) setStorageStats(data.storageStats);
    }
  };

  const handleToggleGrade = async (
    submissionId: string,
    itemId: string,
    isCorrect: boolean
  ) => {
    const res = await fetch(
      `/api/submissions/${encodeURIComponent(submissionId)}/grade`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, isCorrect }),
      }
    );
    if (res.ok) {
      const data = await res.json();
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? data.submission : s))
      );
      if (data.storageStats) setStorageStats(data.storageStats);
    }
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    const res = await fetch(
      `/api/submissions/${encodeURIComponent(submissionId)}`,
      {
        method: 'DELETE',
      }
    );
    if (res.ok) {
      const data = await res.json();
      setSubmissions((prev) => prev.filter((s) => s.id !== submissionId));
      if (data.storageStats) setStorageStats(data.storageStats);
    }
  };

  const handleStorageCleanup = async (
    mode:
      | 'drafts'
      | 'empty_submissions'
      | 'clear_worksheet_submissions'
      | 'optimize'
      | 'import',
    worksheetId?: string,
    importedData?: {
      worksheets?: Worksheet[];
      submissions?: StudentSubmission[];
    }
  ): Promise<string> => {
    const res = await fetch('/api/storage/cleanup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, worksheetId, importedData }),
    });
    if (!res.ok) {
      throw new Error('데이터 정리 중 오류가 발생했습니다.');
    }
    const data = await res.json();
    if (Array.isArray(data.worksheets)) setWorksheets(data.worksheets);
    if (Array.isArray(data.submissions)) setSubmissions(data.submissions);
    if (data.storageStats) setStorageStats(data.storageStats);
    return data.message || '정리가 완료되었습니다.';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center mx-auto animate-pulse font-bold">
            AI
          </div>
          <p className="text-sm font-semibold text-slate-600">
            AI 학습지 도우미를 불러오는 중입니다...
          </p>
        </div>
      </div>
    );
  }

  // #4. Student Worksheet View (either direct student link or teacher preview)
  if (studentViewWorksheet) {
    return (
      <StudentWorksheetView
        worksheet={studentViewWorksheet}
        isTeacherPreview={isTeacherStudentPreview}
        onBackToTeacher={() => {
          setStudentViewWorksheet(null);
          fetchAppState();
        }}
        onSubmissionComplete={(newSub) => {
          setSubmissions((prev) => [newSub, ...prev]);
        }}
      />
    );
  }

  // #1. Initial Setup / PIN Login Screen
  if (!isAuthenticated) {
    return (
      <InitialSetupScreen
        isAlreadyConfigured={isConfigured}
        schoolName={schoolName}
        hasGeminiKey={hasGeminiKey}
        onCompleteSetup={handleCompleteSetup}
        onVerifyPin={handleVerifyPin}
      />
    );
  }

  // #2. Main Studio Screen + Modals (#3, #4 Distribute, #5/#6 Submissions, #7 Storage)
  return (
    <>
      <MainStudioScreen
        worksheets={worksheets}
        submissions={submissions}
        storageStats={storageStats}
        schoolName={schoolName}
        onGenerateWorksheet={handleGenerateWorksheet}
        onOpenWorksheet={(ws) => setActiveWorksheetModal(ws)}
        onOpenDistribute={(ws) => setActiveDistributeModal(ws)}
        onOpenSubmissions={(ws) => setActiveSubmissionsModal(ws)}
        onDeleteWorksheet={handleDeleteWorksheet}
        onOpenStorageManager={() => setShowStorageModal(true)}
        onOpenSetup={() => {
          setIsConfigured(false);
          setIsAuthenticated(false);
        }}
        onLogout={() => setIsAuthenticated(false)}
        onRefresh={fetchAppState}
      />

      {/* #3. 학습지화면 (교사입장 - 정답보기, 편집, 인쇄, 배포) */}
      {activeWorksheetModal && (
        <TeacherWorksheetModal
          worksheet={activeWorksheetModal}
          onClose={() => setActiveWorksheetModal(null)}
          onSaveWorksheet={handleSaveWorksheet}
          onDistribute={handleDistributeWorksheet}
        />
      )}

      {/* #4. 학생 배포 안내화면 (QR 코드, 링크 복사, 학생 화면 열어보기) */}
      {activeDistributeModal && (
        <DistributeModal
          worksheet={activeDistributeModal}
          submissionCount={
            submissions.filter(
              (s) => s.worksheetId === activeDistributeModal.id
            ).length
          }
          onClose={() => setActiveDistributeModal(null)}
          onOpenStudentView={(ws) => {
            setActiveDistributeModal(null);
            setIsTeacherStudentPreview(true);
            setStudentViewWorksheet(ws);
          }}
        />
      )}

      {/* #5 & #6. 제출현황보기 대시보드 및 학생 세부 채점 화면 */}
      {activeSubmissionsModal && (
        <SubmissionsDashboardModal
          worksheet={activeSubmissionsModal}
          submissions={submissions.filter(
            (s) => s.worksheetId === activeSubmissionsModal.id
          )}
          onClose={() => setActiveSubmissionsModal(null)}
          onRefresh={fetchAppState}
          onToggleGrade={handleToggleGrade}
          onDeleteSubmission={handleDeleteSubmission}
        />
      )}

      {/* #7. 데이터 용량 및 아카이브 정리소 모달 */}
      {showStorageModal && (
        <StorageManagerModal
          storageStats={storageStats}
          worksheets={worksheets}
          submissions={submissions}
          onClose={() => setShowStorageModal(false)}
          onCleanup={handleStorageCleanup}
        />
      )}
    </>
  );
}
