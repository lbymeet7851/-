import React, { useState } from 'react';
import { FileText, Lock, ShieldCheck, ArrowRight, KeyRound } from 'lucide-react';

interface InitialSetupScreenProps {
  isAlreadyConfigured: boolean;
  schoolName: string;
  hasGeminiKey: boolean;
  onCompleteSetup: (pin: string, schoolName: string) => Promise<void>;
  onVerifyPin: (pin: string) => Promise<boolean>;
}

export const InitialSetupScreen: React.FC<InitialSetupScreenProps> = ({
  isAlreadyConfigured,
  schoolName: initialSchoolName,
  hasGeminiKey,
  onCompleteSetup,
  onVerifyPin,
}) => {
  const [mode, setMode] = useState<'setup' | 'login'>(
    isAlreadyConfigured ? 'login' : 'setup'
  );
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [schoolName, setSchoolName] = useState(initialSchoolName || '이천고등학교');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!/^\d{4,8}$/.test(pin.trim())) {
      setError('교사 PIN은 숫자 4~8자리로 입력해 주세요.');
      return;
    }
    if (pin.trim() !== pinConfirm.trim()) {
      setError('입력하신 PIN과 PIN 확인 번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    try {
      await onCompleteSetup(pin.trim(), schoolName.trim() || '이천고등학교');
    } catch (err) {
      setError(err instanceof Error ? err.message : '설정 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!pin.trim()) {
      setError('교사 PIN 번호를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await onVerifyPin(pin.trim());
      if (!ok) {
        setError('PIN 번호가 일치하지 않습니다. (초기 기본값: 1234)');
      }
    } catch {
      setError('PIN 확인 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickDemoStart = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await onCompleteSetup('1234', schoolName.trim() || '이천고등학교');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar following 3-Zone Contract */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <FileText className="w-5 h-5" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 학습지 도우미
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => {
              setMode('setup');
              setError(null);
            }}
            className={`hover:text-slate-900 transition-colors cursor-pointer ${
              mode === 'setup' ? 'text-blue-600 font-semibold' : ''
            }`}
          >
            초기 설정
          </button>
          {isAlreadyConfigured && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`hover:text-slate-900 transition-colors cursor-pointer ${
                mode === 'login' ? 'text-blue-600 font-semibold' : ''
              }`}
            >
              PIN 로그인
            </button>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleQuickDemoStart}
            disabled={submitting}
            className="px-3.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            기본 PIN(1234)으로 빠른 시작
          </button>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white mb-5 shadow-xs">
            {mode === 'setup' ? (
              <FileText className="w-6 h-6" />
            ) : (
              <KeyRound className="w-6 h-6" />
            )}
          </div>

          {mode === 'setup' ? (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                처음 오셨네요! 초기 설정
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                이 설정은 한 번만 하면 됩니다. PIN은 이 스튜디오에 들어올 때 쓰는
                선생님 전용 비밀번호예요.
              </p>

              <form onSubmit={handleSetupSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    교사 PIN (숫자 4~8자리)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="예: 1234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    PIN 확인
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pinConfirm}
                    onChange={(e) =>
                      setPinConfirm(e.target.value.replace(/[^\d]/g, ''))
                    }
                    placeholder="동일한 PIN 번호 다시 입력"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono-tabular"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    학교 또는 수업 소속명{' '}
                    <span className="font-normal text-slate-500">(선택)</span>
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="예: 이천고등학교"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-100 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-blue-800">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>
                      AI 엔진 보안 연결됨{' '}
                      {hasGeminiKey ? '(Gemini 서버 키 활성)' : '(서버 보안 모드)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    AI 학습지 생성 키는 서버 환경에 안전하게 내장되어 작동하며, 학생
                    화면에는 절대 전달되지 않아요.
                  </p>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <span>
                    {submitting ? '설정 저장 중...' : '설정 완료하고 시작하기'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-slate-900 mb-2">
                교사 스튜디오 로그인
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                설정한 교사 PIN 번호를 입력하면 수업 설계 스튜디오와 학생 제출
                현황을 관리할 수 있습니다.
              </p>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                    교사 PIN 번호
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={8}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/[^\d]/g, ''))}
                    placeholder="PIN 번호 입력 (기본: 1234)"
                    autoFocus
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent font-mono-tabular"
                  />
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{submitting ? '확인 중...' : '스튜디오 입장하기'}</span>
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('setup');
                      setPin('');
                      setPinConfirm('');
                      setError(null);
                    }}
                    className="text-xs text-slate-500 hover:text-blue-600 underline cursor-pointer"
                  >
                    처음 설정 화면으로 전환 / PIN 번호 새로 설정하기
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="py-5 text-center text-xs text-slate-500">
        © 2026 {schoolName || '이천고등학교'} · 교내 수업용 AI 학습지 도우미 · 무단 복제·재배포 및 상업적 이용 금지
      </footer>
    </div>
  );
};
