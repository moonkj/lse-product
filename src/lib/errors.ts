import { z } from 'zod';

/**
 * 데이터 파일 검증 오류 — 어느 파일의 어느 필드가 틀렸는지 담는다. RootErrorBoundary·PageErrorBoundary 가 한국어 화면으로 보여 준다.
 * (load.ts·learnSchema.ts 공용. 데이터 로더에 대한 역의존을 끊기 위해 별도 모듈 — 리뷰 R9/R6)
 */
export class DataValidationError extends Error {
  readonly file: string;
  readonly issues: { path: string; message: string }[];
  constructor(file: string, error: z.ZodError) {
    super(`[data] ${file} 스키마 검증 실패:\n${z.prettifyError(error)}`);
    this.name = 'DataValidationError';
    this.file = file;
    this.issues = error.issues.map((i) => ({
      path: i.path.length > 0 ? i.path.map(String).join('.') : '(최상위)',
      message: i.message,
    }));
  }
}
