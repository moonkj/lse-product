/**
 * 화면 상태 안내(스크린리더 live region) — 앱 전체에서 하나만 쓴다 (UX 토론 B10).
 * AppLayout 의 <LiveRegion/> 이 subscribe 해서 aria-live="polite" 영역에 표시한다.
 * 예: announce('비교에 VCB 담음 (2/4)'), announce('공백 표 — 17건')
 */
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function announce(message: string): void {
  for (const l of listeners) l(message);
}

export function subscribeAnnounce(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
