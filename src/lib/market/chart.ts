/** 연간 지표 SVG 차트용 순수 계산 (의존성 없음) */

/** min~max 를 덮는 보기 좋은 눈금 (1·2·2.5·5 × 10^n 간격) */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

/** 선형 축척 */
export function linear(d0: number, d1: number, r0: number, r1: number) {
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** 연평균 증가율(%) — 시작값이 0 이하이거나 기간이 0이면 undefined */
export function cagr(first: { year: number; value: number }, last: { year: number; value: number }): number | undefined {
  const years = last.year - first.year;
  if (years <= 0 || first.value <= 0 || last.value <= 0) return undefined;
  return ((last.value / first.value) ** (1 / years) - 1) * 100;
}

/** 숫자 표기 — 천 단위 쉼표, 소수 자리 고정 */
export function fmt(v: number, digits = 1): string {
  return v.toLocaleString('ko-KR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
