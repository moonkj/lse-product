import { useEffect, useRef } from 'react';

/**
 * 휴대폰으로 열기 QR (2026-11-19 사용자: 마켓뉴스처럼 QR 넣기).
 * 주소는 배포 주소 고정 — 빌드 때 segno 로 만든 경로를 그대로 넣음(외부 서비스 호출 없음).
 * <details> 라 키보드·화면낭독기로 열고 닫을 수 있고, 바깥을 누르거나 Esc 로 닫힌다.
 */
export const QR_URL = 'https://moonkj.github.io/lse-product/';
const QR_VIEWBOX = '0 0 33 33';
const QR_PATH = 'M2 2.5h7m1 0h2m2 0h2m3 0h4m1 0h7m-29 1h1m5 0h1m1 0h2m1 0h1m1 0h1m3 0h1m2 0h1m1 0h1m5 0h1m-29 1h1m1 0h3m1 0h1m3 0h1m1 0h3m3 0h1m1 0h1m1 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m1 0h1m2 0h2m2 0h3m1 0h1m2 0h1m1 0h3m1 0h1m-29 1h1m1 0h3m1 0h1m2 0h3m2 0h3m2 0h2m1 0h1m1 0h3m1 0h1m-29 1h1m5 0h1m2 0h3m1 0h1m3 0h3m2 0h1m5 0h1m-29 1h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7m-21 1h3m1 0h1m1 0h2m1 0h4m-21 1h1m1 0h2m1 0h3m1 0h2m1 0h2m2 0h2m1 0h1m2 0h1m2 0h1m1 0h2m-22 1h1m1 0h5m2 0h9m3 0h1m-29 1h2m2 0h1m1 0h1m1 0h1m4 0h1m2 0h1m1 0h1m3 0h3m1 0h2m-28 1h2m2 0h1m2 0h1m2 0h1m1 0h1m5 0h4m1 0h2m3 0h1m-28 1h1m1 0h4m4 0h1m2 0h4m2 0h1m4 0h2m-26 1h1m2 0h1m2 0h6m1 0h3m2 0h1m2 0h1m3 0h3m-29 1h1m2 0h1m1 0h2m1 0h1m1 0h1m2 0h1m2 0h1m1 0h2m3 0h2m1 0h3m-29 1h1m1 0h3m5 0h1m1 0h1m1 0h3m1 0h1m2 0h3m3 0h1m-28 1h4m2 0h1m1 0h3m3 0h1m3 0h3m2 0h3m1 0h1m-27 1h1m2 0h2m1 0h3m2 0h1m1 0h2m2 0h1m1 0h1m2 0h1m1 0h3m-28 1h1m1 0h1m1 0h1m1 0h2m1 0h3m1 0h6m3 0h2m2 0h1m-25 1h3m5 0h9m3 0h1m1 0h1m1 0h1m-26 1h1m1 0h2m1 0h1m2 0h1m2 0h15m-19 1h2m1 0h1m4 0h1m1 0h3m3 0h5m-29 1h7m1 0h2m2 0h1m1 0h1m2 0h4m1 0h1m1 0h2m1 0h1m-28 1h1m5 0h1m1 0h3m1 0h5m1 0h1m1 0h1m3 0h2m1 0h2m-29 1h1m1 0h3m1 0h1m2 0h1m2 0h1m2 0h4m1 0h5m1 0h1m-27 1h1m1 0h3m1 0h1m1 0h3m2 0h1m1 0h2m2 0h3m1 0h3m2 0h1m-29 1h1m1 0h3m1 0h1m1 0h3m5 0h1m1 0h3m2 0h1m2 0h1m1 0h1m-29 1h1m5 0h1m2 0h2m3 0h2m4 0h1m2 0h3m1 0h1m-28 1h7m1 0h6m2 0h1m1 0h5m1 0h1m2 0h1';

function QrSvg({ className }: { className?: string }) {
  return (
    <svg viewBox={QR_VIEWBOX} className={className} aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path d={QR_PATH} stroke="currentColor" fill="none" />
    </svg>
  );
}

export default function QrButton() {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onDoc = (e: MouseEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && el.open) {
        el.open = false;
        el.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
  return (
    <details className="hdr-qr" ref={ref} data-testid="qr">
      <summary className="hdr-qr__btn" aria-label="휴대폰으로 열기 — QR 코드 크게 보기" title="휴대폰 카메라로 찍으면 제품맵이 열려요">
        <QrSvg className="hdr-qr__mini" />
      </summary>
      <div className="hdr-qr__pop" role="dialog" aria-label="휴대폰으로 열기">
        <QrSvg className="hdr-qr__big" />
        <p className="hdr-qr__t">휴대폰 카메라로 찍으면<br />제품맵이 열려요</p>
        <p className="hdr-qr__u">{QR_URL}</p>
      </div>
    </details>
  );
}
