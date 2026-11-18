import { useEffect, useMemo, useState } from 'react';
import { isMainLayer } from '../../lib/labels';
import type { LearnStep, Quiz, TourLayer } from '../../content/learnSchema';

// 학습 진도 (localStorage — 실패해도 화면은 동작)

const STORAGE_KEY = 'lse-learn-progress-v1';

export interface Progress {
  completed: TourLayer[];
  /** quizId → 고른 보기 index */
  answers: Record<string, number>;
  lastStep: number;
  /** "투어 완료" 를 누른 시각 (ISO). 퀴즈를 다 풀지 않아도 기록 */
  tourCompletedAt?: string;
}

export interface QuizStats {
  total: number;
  answered: number;
  correct: number;
}

const EMPTY_PROGRESS: Progress = { completed: [], answers: {}, lastStep: 0 };

function loadProgress(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_PROGRESS;
    const p = JSON.parse(raw) as Partial<Progress>;
    const answers =
      p.answers && typeof p.answers === 'object'
        ? Object.fromEntries(Object.entries(p.answers).filter(([, v]) => Number.isInteger(v)))
        : {};
    return {
      completed: Array.isArray(p.completed) ? p.completed.filter((l): l is TourLayer => isMainLayer(String(l))) : [],
      answers,
      lastStep: typeof p.lastStep === 'number' && p.lastStep >= 0 && p.lastStep < 7 ? p.lastStep : 0,
      tourCompletedAt: typeof p.tourCompletedAt === 'string' ? p.tourCompletedAt : undefined,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function saveProgress(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* 저장 불가(사생활 보호 모드 등) — 이번 방문 동안만 유지 */
  }
}

/** 진도 상태 + 갱신 함수 (저장은 자동) */
export function useLearnProgress(steps: LearnStep[]) {
  const [progress, setProgress] = useState<Progress>(loadProgress);

  useEffect(() => saveProgress(progress), [progress]);

  const markDone = (layer: TourLayer) =>
    setProgress((p) => (p.completed.includes(layer) ? p : { ...p, completed: [...p.completed, layer] }));

  const setLastStep = (lastStep: number) => setProgress((p) => (p.lastStep === lastStep ? p : { ...p, lastStep }));

  const answer = (step: LearnStep, quiz: Quiz, choice: number) =>
    setProgress((p) => {
      const answers = { ...p.answers, [quiz.id]: choice };
      const allAnswered = step.quizzes.every((q) => answers[q.id] !== undefined);
      const completed = allAnswered && !p.completed.includes(step.layer) ? [...p.completed, step.layer] : p.completed;
      return { ...p, answers, completed };
    });

  /** 투어 완료: 마지막 단계 완료 + 완료 시각 기록 */
  const finishTour = (lastLayer: TourLayer) =>
    setProgress((p) => ({
      ...p,
      completed: p.completed.includes(lastLayer) ? p.completed : [...p.completed, lastLayer],
      tourCompletedAt: new Date().toISOString(),
    }));

  const quizStats = useMemo<QuizStats>(() => {
    const all = steps.flatMap((s) => s.quizzes);
    const answered = all.filter((q) => progress.answers[q.id] !== undefined);
    const correct = answered.filter((q) => progress.answers[q.id] === q.answerIndex);
    return { total: all.length, answered: answered.length, correct: correct.length };
  }, [steps, progress.answers]);

  return { progress, markDone, setLastStep, answer, finishTour, quizStats };
}
