/**
 * UX 라운드 U — B7: 패널 구성품(sourced)은 공백이 아니므로 판정 표기에 "공백"이 들어가지 않는다.
 */
import { describe, expect, it } from 'vitest';
import { CONFIDENCE_LABELS, assessmentTitle, confidenceLabel } from '../../../src/lib/labels';

describe('B7 confidenceLabel / assessmentTitle', () => {
  it('sourced → "판정 확정/후보", 제목 "구성품 판정" (공백 단어 없음)', () => {
    expect(confidenceLabel('sourced', 'confirmed')).toBe('판정 확정');
    expect(confidenceLabel('sourced', 'candidate')).toBe('판정 후보');
    expect(assessmentTitle('sourced')).not.toMatch(/공백/);
  });
  it('미보유·일부·계열사 → 기존 "공백 확정/후보"', () => {
    for (const c of ['missing', 'partial', 'affiliate'] as const) {
      expect(confidenceLabel(c, 'confirmed')).toBe(CONFIDENCE_LABELS.confirmed);
      expect(confidenceLabel(c, 'candidate')).toBe(CONFIDENCE_LABELS.candidate);
      expect(assessmentTitle(c)).toBe('공백 판정');
    }
  });
});
