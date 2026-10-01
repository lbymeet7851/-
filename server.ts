import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import {
  Worksheet,
  StudentSubmission,
  TeacherConfig,
  StorageStats,
  DifficultyLevel,
  ActivityType,
} from './src/types/worksheet.ts';
import {
  INITIAL_SEED_WORKSHEET,
  INITIAL_SEED_SUBMISSIONS,
  evaluateSubmission,
} from './src/utils/worksheetHelpers.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '.data');
const DB_FILE = path.join(DATA_DIR, 'studio_store.json');
// 50 MB logical free-tier budget for transparent capacity monitoring (#7)
const MAX_STORAGE_BYTES = 50 * 1024 * 1024;

interface DatabaseSchema {
  teacherConfig: TeacherConfig;
  worksheets: Worksheet[];
  submissions: StudentSubmission[];
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getInitialDb(): DatabaseSchema {
  return {
    teacherConfig: {
      isConfigured: false,
      pinHash: '1234',
      schoolName: '이천고등학교',
      teacherName: '선생님',
      updatedAt: '2026-10-01 09:00',
    },
    worksheets: [INITIAL_SEED_WORKSHEET],
    submissions: [...INITIAL_SEED_SUBMISSIONS],
  };
}

function loadDb(): DatabaseSchema {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialDb();
    saveDb(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as DatabaseSchema;
    if (!parsed.worksheets) parsed.worksheets = [INITIAL_SEED_WORKSHEET];
    if (!parsed.submissions) parsed.submissions = [...INITIAL_SEED_SUBMISSIONS];
    if (!parsed.teacherConfig) {
      parsed.teacherConfig = getInitialDb().teacherConfig;
    }
    return parsed;
  } catch {
    const fallback = getInitialDb();
    saveDb(fallback);
    return fallback;
  }
}

function saveDb(db: DatabaseSchema): void {
  ensureDataDir();
  // Write compact JSON without whitespace bloat to minimize storage footprint (#7)
  fs.writeFileSync(DB_FILE, JSON.stringify(db), 'utf-8');
}

function computeStorageStats(db: DatabaseSchema): StorageStats {
  const serialized = JSON.stringify(db);
  const usedBytes = Buffer.byteLength(serialized, 'utf-8');
  const usagePercent = Math.min(100, Number(((usedBytes / MAX_STORAGE_BYTES) * 100).toFixed(3)));
  const remainingBytes = Math.max(0, MAX_STORAGE_BYTES - usedBytes);
  // Average compressed worksheet ~ 4.5KB, average normalized student submission ~ 450 bytes
  const estimatedRemainingWorksheets = Math.floor(remainingBytes / 4500);
  const estimatedRemainingSubmissions = Math.floor(remainingBytes / 450);

  return {
    usedBytes,
    maxBytes: MAX_STORAGE_BYTES,
    usagePercent,
    worksheetCount: db.worksheets.length,
    submissionCount: db.submissions.length,
    estimatedRemainingWorksheets,
    estimatedRemainingSubmissions,
  };
}

function formatNowKST(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function getGenAIClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // 1. Get full application state + storage stats
  app.get('/api/state', (_req, res) => {
    const db = loadDb();
    res.json({
      teacherConfig: {
        isConfigured: db.teacherConfig.isConfigured,
        schoolName: db.teacherConfig.schoolName,
        teacherName: db.teacherConfig.teacherName,
        updatedAt: db.teacherConfig.updatedAt,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      },
      worksheets: db.worksheets,
      submissions: db.submissions,
      storageStats: computeStorageStats(db),
    });
  });

  // 2. Teacher initial setup / PIN update
  app.post('/api/teacher/setup', (req, res) => {
    const { pin, schoolName, teacherName } = req.body as {
      pin?: string;
      schoolName?: string;
      teacherName?: string;
    };

    if (!pin || !/^\d{4,8}$/.test(pin.trim())) {
      res.status(400).json({ error: 'PIN 번호는 숫자 4~8자리로 입력해 주세요.' });
      return;
    }

    const db = loadDb();
    db.teacherConfig = {
      isConfigured: true,
      pinHash: pin.trim(),
      schoolName: (schoolName || db.teacherConfig.schoolName || '이천고등학교').trim(),
      teacherName: (teacherName || db.teacherConfig.teacherName || '선생님').trim(),
      updatedAt: formatNowKST(),
    };
    saveDb(db);

    res.json({
      success: true,
      teacherConfig: {
        isConfigured: db.teacherConfig.isConfigured,
        schoolName: db.teacherConfig.schoolName,
        teacherName: db.teacherConfig.teacherName,
        updatedAt: db.teacherConfig.updatedAt,
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      },
    });
  });

  // 3. Verify Teacher PIN
  app.post('/api/teacher/verify-pin', (req, res) => {
    const { pin } = req.body as { pin?: string };
    const db = loadDb();
    if (!pin || pin.trim() !== db.teacherConfig.pinHash) {
      res.status(401).json({ valid: false, error: 'PIN 번호가 일치하지 않습니다.' });
      return;
    }
    res.json({ valid: true });
  });

  // 4. Generate a new AI Worksheet via Gemini
  app.post('/api/worksheets/generate', async (req, res) => {
    const { topicPrompt, subject, grade, difficulty, preferences } = req.body as {
      topicPrompt: string;
      subject?: string;
      grade?: string;
      difficulty?: DifficultyLevel;
      preferences?: string;
    };

    if (!topicPrompt || !topicPrompt.trim()) {
      res.status(400).json({ error: '수업 주제 또는 교과서 지문을 입력해 주세요.' });
      return;
    }

    try {
      const ai = getGenAIClient();
      const targetGrade = grade || '고등학교 1학년';
      const targetDifficulty = difficulty || '표준';
      const targetSubject = subject?.trim() || '';

      const systemInstruction = `당신은 대한민국 초·중·고등학교 수업을 설계하는 수석 교육과정 전문가이자 AI 학습지 설계 도우미입니다.
교사가 입력한 수업 주제 또는 교과서 지문을 분석하여 학생들의 사고력을 단계적으로 확장하는 체계적인 수업 학습지를 JSON 형식으로 설계하세요.

반드시 다음 구조를 포함해야 합니다:
1. title: 학생들의 흥미를 끄는 매력적이고 교육적인 학습지 제목
2. inferredSubject: 과목명 (교사가 비워둔 경우 지문을 분석해 '통합과학', '수학 공통', '통합사회', '국어', '생명과학I' 등 정확한 과목명 부여)
3. aiDesignIntent: 교사에게 설명하는 'AI의 수업 설계 의도' (핵심 개념, 학생들이 자주 겪는 오개념, 도입-빈칸-OX-예제/표-서술형-스스로점검으로 이어지는 설계 흐름을 3~4문장으로 친절하고 전문적으로 서술)
4. conceptSection:
   - summary: 핵심 성취기준 및 개념 요약 (1~2문장)
   - objectives: 구체적인 학습 목표 3가지 ('~할 수 있다.' 형태)
5. warmUpSection (생각 열기):
   - title: 생각 열기 소제목
   - scenario: 실생활 사례나 호기심을 자극하는 도입 지문 (3~4문장)
   - questions: 학생이 자신의 생각을 적어보는 도입 질문 1~2개 및 예시 답안(sampleAnswer)
6. activities (본 활동 4~5개):
   반드시 다음 유형(type)들을 골고루 조합하여 4~5개의 활동을 구성하세요:
   - 'fill_blank': 기본 정의와 핵심 성질을 정리하는 빈칸 채우기 문항 (4~6문항). question 문장 안에 반드시 '[ 빈칸 ]' 표기를 포함하고 answer에는 짧은 단답형 정답을 넣으세요.
   - 'ox_fix': 학생들이 자주 범하는 오개념을 바로잡는 OX 퀴즈 (3~4문항). answer는 반드시 'O' 또는 'X'여야 하며, subPrompt에 핵심 판단 기준이나 오개념 해설을 넣으세요.
   - 'worked_example': 단계별로 따라하며 원리를 익히는 예제 분석 (3~4문항).
   - 'table': 개념이나 성질을 비교·분류하는 표 채우기 문항 (3~5문항). subPrompt에 비교 대상(행/열 정보)을 명시하세요.
   - 'short_answer': 개념 적용 및 단답·서술형 확인 문항 (2~3문항).
   각 문항(items)의 acceptedAnswers에는 동의어나 띄어쓰기 다른 정답 표현을 2~3개 포함하여 자동 채점 정확도를 높이세요.
7. selfCheckSection (스스로 점검):
   - items: 학습 목표 도달 여부를 스스로 점검하는 질문 3개
   - reflectionPrompt: 오늘 배운 핵심 내용을 한 문장으로 정리하는 성찰 질문`;

      const userPrompt = `[수업 주제 / 교과서 지문]
${topicPrompt.trim().slice(0, 20000)}

[설계 조건]
- 과목: ${targetSubject || '지문 내용에 맞게 자동 판단'}
- 대상 학년: ${targetGrade}
- 난이도: ${targetDifficulty}
- 교사 희망사항: ${preferences?.trim() || '핵심 개념 빈칸 채우기, 오개념 OX 퀴즈, 비교 표, 적용 문제를 균형 있게 구성'}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              inferredSubject: { type: Type.STRING },
              aiDesignIntent: { type: Type.STRING },
              conceptSection: {
                type: Type.OBJECT,
                properties: {
                  summary: { type: Type.STRING },
                  objectives: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                },
                required: ['summary', 'objectives'],
              },
              warmUpSection: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  scenario: { type: Type.STRING },
                  questions: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        prompt: { type: Type.STRING },
                        sampleAnswer: { type: Type.STRING },
                      },
                      required: ['prompt', 'sampleAnswer'],
                    },
                  },
                },
                required: ['title', 'scenario', 'questions'],
              },
              activities: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    type: {
                      type: Type.STRING,
                      description: "One of: 'fill_blank', 'ox_fix', 'worked_example', 'table', 'short_answer'",
                    },
                    instruction: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          question: { type: Type.STRING },
                          subPrompt: { type: Type.STRING },
                          answer: { type: Type.STRING },
                          acceptedAnswers: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                          },
                          explanation: { type: Type.STRING },
                        },
                        required: ['question', 'answer'],
                      },
                    },
                  },
                  required: ['title', 'type', 'instruction', 'items'],
                },
              },
              selfCheckSection: {
                type: Type.OBJECT,
                properties: {
                  statements: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  reflectionPrompt: { type: Type.STRING },
                },
                required: ['statements', 'reflectionPrompt'],
              },
            },
            required: [
              'title',
              'inferredSubject',
              'aiDesignIntent',
              'conceptSection',
              'warmUpSection',
              'activities',
              'selfCheckSection',
            ],
          },
        },
      });

      const rawText = response.text || '{}';
      const generated = JSON.parse(rawText);
      const nowStr = formatNowKST();
      const wsId = `ws_${Date.now()}`;

      let itemCounter = 1;
      const validTypes: ActivityType[] = [
        'fill_blank',
        'ox_fix',
        'worked_example',
        'table',
        'short_answer',
      ];

      const newWorksheet: Worksheet = {
        id: wsId,
        title: generated.title || '맞춤형 AI 수업 학습지',
        subject: targetSubject || generated.inferredSubject || '통합교과',
        grade: targetGrade,
        difficulty: targetDifficulty,
        topicPrompt: topicPrompt.trim().slice(0, 2000),
        preferences: preferences?.trim() || '',
        status: 'draft',
        createdAt: nowStr,
        updatedAt: nowStr,
        aiDesignIntent:
          generated.aiDesignIntent ||
          '핵심 성취기준을 바탕으로 도입 시나리오부터 개념 빈칸 채우기, 오개념 교정, 심화 적용까지 단계적으로 학습하도록 설계했습니다.',
        conceptSection: {
          summary: generated.conceptSection?.summary || '',
          objectives: Array.isArray(generated.conceptSection?.objectives)
            ? generated.conceptSection.objectives
            : [],
        },
        warmUpSection: {
          title: generated.warmUpSection?.title || '생각 열기',
          scenario: generated.warmUpSection?.scenario || '',
          questions: (generated.warmUpSection?.questions || []).map(
            (q: { prompt: string; sampleAnswer: string }, idx: number) => ({
              id: `wu_${ idx + 1}`,
              prompt: q.prompt,
              sampleAnswer: q.sampleAnswer,
            })
          ),
        },
        activities: (generated.activities || []).map(
          (
            act: {
              title: string;
              type: string;
              instruction: string;
              items: Array<{
                question: string;
                subPrompt?: string;
                answer: string;
                acceptedAnswers?: string[];
                explanation?: string;
              }>;
            },
            aIdx: number
          ) => {
            const normalizedType: ActivityType = validTypes.includes(act.type as ActivityType)
              ? (act.type as ActivityType)
              : 'fill_blank';

            return {
              id: `act_${aIdx + 1}_${Date.now().toString(36)}`,
              title: act.title || `활동 ${aIdx + 1}`,
              type: normalizedType,
              instruction: act.instruction || '문제를 읽고 알맞은 답을 작성해 보세요.',
              items: (act.items || []).map((it) => {
                const currentId = `item_${itemCounter++}`;
                return {
                  id: currentId,
                  question: it.question,
                  subPrompt: it.subPrompt || '',
                  answer: it.answer,
                  acceptedAnswers: Array.isArray(it.acceptedAnswers) ? it.acceptedAnswers : [it.answer],
                  explanation: it.explanation || '',
                  autoGradable: true,
                };
              }),
            };
          }
        ),
        selfCheckSection: {
          items: (generated.selfCheckSection?.statements || []).map(
            (st: string, sIdx: number) => ({
              id: `sc_${sIdx + 1}`,
              statement: st,
            })
          ),
          reflectionPrompt:
            generated.selfCheckSection?.reflectionPrompt ||
            '오늘 수업에서 배운 가장 중요한 핵심 개념을 한 문장으로 정리해 보세요.',
        },
      };

      const db = loadDb();
      db.worksheets.unshift(newWorksheet);
      saveDb(db);

      res.json({
        worksheet: newWorksheet,
        storageStats: computeStorageStats(db),
      });
    } catch (error) {
      console.error('Gemini Worksheet Generation Error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? `AI 학습지 생성 중 오류가 발생했습니다: ${error.message}`
            : 'AI 학습지 생성에 실패했습니다.',
      });
    }
  });

  // 5. Regenerate a specific section or create a new AI activity (#3-4, #3-5)
  app.post('/api/worksheets/regenerate-section', async (req, res) => {
    const {
      worksheetTitle,
      subject,
      grade,
      difficulty,
      topicPrompt,
      sectionType,
      activityType,
      currentTitle,
      customInstruction,
    } = req.body as {
      worksheetTitle: string;
      subject: string;
      grade: string;
      difficulty: string;
      topicPrompt: string;
      sectionType: 'concept' | 'warmUp' | 'activity' | 'selfCheck';
      activityType?: ActivityType;
      currentTitle?: string;
      customInstruction?: string;
    };

    try {
      const ai = getGenAIClient();

      if (sectionType === 'concept') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `학습지 제목: ${worksheetTitle} (${grade} ${subject}, 난이도: ${difficulty})
주제: ${topicPrompt}
추가 요청: ${customInstruction || '더 명확하고 이해하기 쉬운 성취기준 요약과 학습목표 3개로 개선해 주세요.'}
이 학습지의 '개념 이해' 섹션(핵심 요약 summary와 학습 목표 objectives 3개)을 새로 작성해 주세요.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                objectives: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ['summary', 'objectives'],
            },
          },
        });
        res.json({ data: JSON.parse(response.text || '{}') });
        return;
      }

      if (sectionType === 'warmUp') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `학습지 제목: ${worksheetTitle} (${grade} ${subject})
주제: ${topicPrompt}
추가 요청: ${customInstruction || '학생들의 호기심을 자극하는 새로운 실생활 사례와 생각 열기 질문으로 재구성해 주세요.'}
'생각 열기' 섹션을 새로 생성하세요.`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                scenario: { type: Type.STRING },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      prompt: { type: Type.STRING },
                      sampleAnswer: { type: Type.STRING },
                    },
                    required: ['prompt', 'sampleAnswer'],
                  },
                },
              },
              required: ['title', 'scenario', 'questions'],
            },
          },
        });
        const parsed = JSON.parse(response.text || '{}');
        res.json({
          data: {
            title: parsed.title || '생각 열기',
            scenario: parsed.scenario || '',
            questions: (parsed.questions || []).map(
              (q: { prompt: string; sampleAnswer: string }, i: number) => ({
                id: `wu_${Date.now()}_${i}`,
                prompt: q.prompt,
                sampleAnswer: q.sampleAnswer,
              })
            ),
          },
        });
        return;
      }

      if (sectionType === 'selfCheck') {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `학습지 제목: ${worksheetTitle} (${grade} ${subject})
주제: ${topicPrompt}
추가 요청: ${customInstruction || '학생 스스로 핵심 개념 이해도를 점검할 수 있는 자기평가 문항 3개와 성찰 질문을 만들어 주세요.'}`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                statements: { type: Type.ARRAY, items: { type: Type.STRING } },
                reflectionPrompt: { type: Type.STRING },
              },
              required: ['statements', 'reflectionPrompt'],
            },
          },
        });
        const parsed = JSON.parse(response.text || '{}');
        res.json({
          data: {
            items: (parsed.statements || []).map((s: string, i: number) => ({
              id: `sc_${Date.now()}_${i}`,
              statement: s,
            })),
            reflectionPrompt:
              parsed.reflectionPrompt || '오늘 배운 핵심 개념을 한 줄로 요약해 보세요.',
          },
        });
        return;
      }

      // Default: 'activity' regeneration or new activity creation
      const targetActType: ActivityType = activityType || 'fill_blank';
      const typeGuide: Record<ActivityType, string> = {
        fill_blank:
          "빈칸 채우기 유형: 문장 내에 반드시 '[ 빈칸 ]'을 포함하고, answer에는 정확한 핵심 용어나 수식을 넣으세요 (4~5문항).",
        ox_fix:
          "OX 오개념 교정 유형: 학생들이 헷갈리기 쉬운 진술을 제시하고 answer는 반드시 'O' 또는 'X'로 설정하며, subPrompt에 해설을 넣으세요 (4문항).",
        worked_example:
          '예제 따라하기 유형: 구체적인 예제 문제를 제시하고 1단계, 2단계, 3단계, 4단계로 나누어 빈칸 답을 구하게 하세요 (4문항).',
        table:
          '비교·분류 표 채우기 유형: subPrompt에 비교 대상이나 식을 적고, question에 구해야 할 항목을 명시하세요 (4문항).',
        short_answer:
          '단답·서술형 탐구 유형: 개념을 적용해 식이나 값을 구하는 문항을 출제하세요 (3문항).',
      };

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `학습지 제목: ${worksheetTitle} (${grade} ${subject}, 난이도: ${difficulty})
주제: ${topicPrompt}
활동 제목(참고): ${currentTitle || '새로운 심화·적용 활동'}
활동 유형: ${targetActType} (${typeGuide[targetActType]})
교사 요청사항: ${customInstruction || '수업 주제에 꼭 맞는 알찬 문항들로 새롭게 구성해 주세요.'}`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              instruction: { type: Type.STRING },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    subPrompt: { type: Type.STRING },
                    answer: { type: Type.STRING },
                    acceptedAnswers: { type: Type.ARRAY, items: { type: Type.STRING } },
                    explanation: { type: Type.STRING },
                  },
                  required: ['question', 'answer'],
                },
              },
            },
            required: ['title', 'instruction', 'items'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      const nowSuffix = Date.now().toString(36);
      res.json({
        data: {
          id: `act_${nowSuffix}`,
          title: parsed.title || currentTitle || '새로운 탐구 활동',
          type: targetActType,
          instruction: parsed.instruction || '문제를 읽고 알맞은 답을 작성해 보세요.',
          items: (parsed.items || []).map(
            (
              it: {
                question: string;
                subPrompt?: string;
                answer: string;
                acceptedAnswers?: string[];
                explanation?: string;
              },
              idx: number
            ) => ({
              id: `item_${nowSuffix}_${idx + 1}`,
              question: it.question,
              subPrompt: it.subPrompt || '',
              answer: it.answer,
              acceptedAnswers: Array.isArray(it.acceptedAnswers) ? it.acceptedAnswers : [it.answer],
              explanation: it.explanation || '',
              autoGradable: true,
            })
          ),
        },
      });
    } catch (error) {
      console.error('Section Regeneration Error:', error);
      res.status(500).json({
        error:
          error instanceof Error
            ? `AI 재생성 중 오류가 발생했습니다: ${error.message}`
            : 'AI 재생성에 실패했습니다.',
      });
    }
  });

  // 6. Save / Update a Worksheet (Edit mode save or Publish status update)
  app.put('/api/worksheets/:id', (req, res) => {
    const { id } = req.params;
    const updatedWorksheet = req.body as Worksheet;
    const db = loadDb();
    const idx = db.worksheets.findIndex((w) => w.id === id);
    if (idx === -1) {
      res.status(404).json({ error: '학습지를 찾을 수 없습니다.' });
      return;
    }
    updatedWorksheet.updatedAt = formatNowKST();
    db.worksheets[idx] = updatedWorksheet;
    saveDb(db);
    res.json({
      worksheet: updatedWorksheet,
      storageStats: computeStorageStats(db),
    });
  });

  // 7. Delete a Worksheet and its submissions
  app.delete('/api/worksheets/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDb();
    db.worksheets = db.worksheets.filter((w) => w.id !== id);
    db.submissions = db.submissions.filter((s) => s.worksheetId !== id);
    saveDb(db);
    res.json({
      success: true,
      storageStats: computeStorageStats(db),
    });
  });

  // 8. Get public worksheet for student view
  app.get('/api/worksheets/:id/public', (req, res) => {
    const { id } = req.params;
    const db = loadDb();
    const worksheet = db.worksheets.find((w) => w.id === id);
    if (!worksheet) {
      res.status(404).json({ error: '배포된 학습지를 찾을 수 없습니다.' });
      return;
    }
    res.json({ worksheet });
  });

  // 9. Student submits worksheet answers
  app.post('/api/submissions', (req, res) => {
    const { worksheetId, studentId, studentName, answers } = req.body as {
      worksheetId: string;
      studentId: string;
      studentName: string;
      answers: Record<string, string>;
    };

    if (!worksheetId || !studentId?.trim() || !studentName?.trim()) {
      res.status(400).json({ error: '학번과 이름을 정확히 입력해 주세요.' });
      return;
    }

    const db = loadDb();
    const worksheet = db.worksheets.find((w) => w.id === worksheetId);
    if (!worksheet) {
      res.status(404).json({ error: '대상 학습지를 찾을 수 없습니다.' });
      return;
    }

    // Normalize answers to strip empty strings and save storage space (#7)
    const compactAnswers: Record<string, string> = {};
    Object.entries(answers || {}).forEach(([k, v]) => {
      if (typeof v === 'string' && v.trim().length > 0) {
        compactAnswers[k] = v.trim().slice(0, 1000);
      }
    });

    const evalResult = evaluateSubmission(worksheet, compactAnswers);

    const newSubmission: StudentSubmission = {
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      worksheetId,
      studentId: studentId.trim().slice(0, 30),
      studentName: studentName.trim().slice(0, 40),
      submittedAt: formatNowKST(),
      filledCount: evalResult.filledCount,
      totalBlanks: evalResult.totalBlanks,
      score: evalResult.score,
      totalGradable: evalResult.totalGradable,
      answers: compactAnswers,
      grades: evalResult.grades,
    };

    db.submissions.unshift(newSubmission);
    saveDb(db);

    res.json({
      submission: newSubmission,
      storageStats: computeStorageStats(db),
    });
  });

  // 10. Teacher overrides a single item's grade (✓ / × toggle in Submission Detail #6-1)
  app.patch('/api/submissions/:id/grade', (req, res) => {
    const { id } = req.params;
    const { itemId, isCorrect } = req.body as { itemId: string; isCorrect: boolean };

    const db = loadDb();
    const sub = db.submissions.find((s) => s.id === id);
    if (!sub) {
      res.status(404).json({ error: '제출 내역을 찾을 수 없습니다.' });
      return;
    }

    sub.grades[itemId] = Boolean(isCorrect);
    sub.score = Object.values(sub.grades).filter(Boolean).length;
    saveDb(db);

    res.json({
      submission: sub,
      storageStats: computeStorageStats(db),
    });
  });

  // 11. Delete a single submission
  app.delete('/api/submissions/:id', (req, res) => {
    const { id } = req.params;
    const db = loadDb();
    db.submissions = db.submissions.filter((s) => s.id !== id);
    saveDb(db);
    res.json({
      success: true,
      storageStats: computeStorageStats(db),
    });
  });

  // 12. Storage cleanup & data management (#7)
  app.post('/api/storage/cleanup', (req, res) => {
    const { mode, worksheetId, importedData } = req.body as {
      mode:
        | 'drafts'
        | 'empty_submissions'
        | 'clear_worksheet_submissions'
        | 'optimize'
        | 'import';
      worksheetId?: string;
      importedData?: { worksheets?: Worksheet[]; submissions?: StudentSubmission[] };
    };

    const db = loadDb();
    let message = '데이터 정리가 완료되었습니다.';

    if (mode === 'drafts') {
      const before = db.worksheets.length;
      const draftIds = new Set(
        db.worksheets.filter((w) => w.status === 'draft').map((w) => w.id)
      );
      db.worksheets = db.worksheets.filter((w) => w.status !== 'draft');
      db.submissions = db.submissions.filter((s) => !draftIds.has(s.worksheetId));
      message = `미배포 초안 학습지 ${before - db.worksheets.length}개를 정리했습니다.`;
    } else if (mode === 'empty_submissions') {
      const before = db.submissions.length;
      db.submissions = db.submissions.filter((s) => s.filledCount > 0);
      message = `빈칸으로 제출된 답안 ${before - db.submissions.length}건을 정리했습니다.`;
    } else if (mode === 'clear_worksheet_submissions' && worksheetId) {
      const before = db.submissions.length;
      db.submissions = db.submissions.filter((s) => s.worksheetId !== worksheetId);
      message = `선택한 학습지의 제출 답안 ${before - db.submissions.length}건을 비웠습니다.`;
    } else if (mode === 'optimize') {
      const validWsIds = new Set(db.worksheets.map((w) => w.id));
      db.submissions = db.submissions.filter((s) => validWsIds.has(s.worksheetId));
      // Compact answers by removing blank keys
      db.submissions.forEach((s) => {
        const cleaned: Record<string, string> = {};
        Object.entries(s.answers || {}).forEach(([k, v]) => {
          if (v && v.trim()) cleaned[k] = v.trim();
        });
        s.answers = cleaned;
      });
      message = '고아 데이터 제거 및 답안 데이터 압축 최적화를 완료했습니다.';
    } else if (mode === 'import' && importedData) {
      if (Array.isArray(importedData.worksheets)) {
        db.worksheets = importedData.worksheets;
      }
      if (Array.isArray(importedData.submissions)) {
        db.submissions = importedData.submissions;
      }
      message = '백업 데이터를 성공적으로 복원했습니다.';
    }

    saveDb(db);
    res.json({
      message,
      worksheets: db.worksheets,
      submissions: db.submissions,
      storageStats: computeStorageStats(db),
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AI Worksheet Studio Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
