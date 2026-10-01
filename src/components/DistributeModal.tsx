import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  CheckCircle2,
  Link2,
  Copy,
  Check,
  Monitor,
  ExternalLink,
  Lightbulb,
  Camera,
  X,
} from 'lucide-react';
import { Worksheet } from '../types/worksheet';

interface DistributeModalProps {
  worksheet: Worksheet;
  submissionCount: number;
  onClose: () => void;
  onOpenStudentView: (worksheet: Worksheet) => void;
}

export const DistributeModal: React.FC<DistributeModalProps> = ({
  worksheet,
  submissionCount,
  onClose,
  onOpenStudentView,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [fullScreenQr, setFullScreenQr] = useState<boolean>(false);

  const studentUrl = `${window.location.origin}${window.location.pathname}?worksheetId=${encodeURIComponent(
    worksheet.id
  )}&mode=student`;

  useEffect(() => {
    QRCode.toDataURL(studentUrl, {
      width: 360,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('QR generation error:', err));
  }, [studentUrl]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(studentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (fullScreenQr) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col items-center justify-center p-8 text-white">
        <div className="max-w-2xl w-full bg-white text-slate-900 rounded-3xl p-10 flex flex-col items-center text-center space-y-6 shadow-xl">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-blue-600">
              {worksheet.grade} · {worksheet.subject}
            </p>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
              {worksheet.title}
            </h2>
          </div>

          <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="학생 접속 QR 코드"
                referrerPolicy="no-referrer"
                className="w-72 h-72 md:w-80 md:h-80 object-contain"
              />
            ) : (
              <div className="w-72 h-72 flex items-center justify-center text-slate-400">
                QR 생성 중...
              </div>
            )}
          </div>

          <p className="text-base font-semibold text-slate-700">
            스마트폰·태블릿 카메라로 QR을 스캔한 뒤 학번과 이름을 입력해 시작하세요!
          </p>

          <button
            type="button"
            onClick={() => setFullScreenQr(false)}
            className="px-6 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            원래 안내창으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-lg overflow-hidden">
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full bg-blue-600" />

        <div className="p-6 md:p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  배포 완료! 학생들을 초대하세요
                </h2>
                <p className="text-sm text-slate-600 mt-0.5">
                  <span>{worksheet.grade} · {worksheet.subject}</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span className="font-semibold text-slate-900">
                    {worksheet.title}
                  </span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 2-Column Content (Image 4) */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
            {/* Left QR Card */}
            <div className="md:col-span-5 bg-slate-50 border border-slate-200/80 rounded-2xl p-5 flex flex-col items-center justify-center space-y-3">
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="학생 접속 QR 코드"
                    referrerPolicy="no-referrer"
                    className="w-44 h-44 object-contain"
                  />
                ) : (
                  <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-400">
                    QR 생성 중...
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <Camera className="w-3.5 h-3.5 text-slate-500" />
                <span>스마트폰·태블릿 카메라로 스캔</span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-3.5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Link2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>학생 접속 주소</span>
                </div>
                <div className="flex items-center gap-2 p-1.5 pl-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs font-mono-tabular text-slate-600 truncate flex-1">
                    {studentUrl}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors shrink-0 cursor-pointer shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-600">복사됨</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>복사</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setFullScreenQr(true)}
                className="w-full py-3.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Monitor className="w-4 h-4" />
                <span>QR 크게 띄우기 (교실 TV·빔프로젝터용)</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenStudentView(worksheet)}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-4 h-4 text-slate-600" />
                <span>학생 화면 열어보기</span>
              </button>

              <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-100 space-y-2">
                <div className="flex items-start gap-2 text-xs text-slate-700 leading-relaxed">
                  <Lightbulb className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <p>
                    <strong className="font-bold text-slate-900">활용 팁:</strong>{' '}
                    교실 TV나 빔프로젝터에 QR을 띄우면 학생들이 자리에서 바로
                    스캔해 들어와요. 로그인 없이 학번과 이름만 쓰면 시작돼요.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pl-6 text-xs font-bold text-blue-700">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  <span className="font-mono-tabular">
                    지금까지 받은 제출: {submissionCount}건
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Close Button */}
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
