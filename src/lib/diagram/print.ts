/**
 * 전체 계통도 한 장 인쇄.
 *  - 인쇄 직전(beforeprint)에 계통도 전체(model.width × height)가 용지 한 장에 들어가는 배율을 --print-scale 로 넣는다.
 *    용지는 A4 세로, 여백 8mm 기준 (인쇄 대화상자에서 A3 를 고르면 같은 배율로 위쪽에 놓인다).
 *  - 툴바 "인쇄" 버튼은 아직 받지 않은 타일 사진(data-src)을 모두 받은 뒤 인쇄 대화상자를 연다.
 *    Ctrl/Cmd+P 로 바로 인쇄하면 화면 밖 사진이 빠질 수 있다.
 *  - 실제 숨김·배치는 DiagramCanvas.css 의 @media print.
 */

/** A4 세로 인쇄 영역(여백 8mm) — CSS px(96dpi) */
const PAGE_W = 733;
const PAGE_H = 1062;
/** 맨 위 제목·범례 줄 높이 */
export const PRINT_HEADER_H = 40;

export function printScale(width: number, height: number): number {
  return Math.min(PAGE_W / width, (PAGE_H - PRINT_HEADER_H) / height);
}

/** 인쇄 배율을 문서에 반영 (beforeprint 에서 호출) */
export function applyPrintScale(width: number, height: number): void {
  const s = printScale(width, height);
  const root = document.documentElement.style;
  root.setProperty('--print-scale', String(s));
  root.setProperty('--print-w', `${Math.ceil(width * s)}px`);
  root.setProperty('--print-h', `${Math.ceil(height * s)}px`);
}

function waitImage(img: HTMLImageElement): Promise<void> {
  if (img.complete && img.naturalWidth > 0) return Promise.resolve();
  return new Promise((resolve) => {
    img.addEventListener('load', () => resolve(), { once: true });
    img.addEventListener('error', () => resolve(), { once: true });
  });
}

/** 계통도 사진을 모두 받은 뒤(최대 timeoutMs) 인쇄 대화상자를 연다 */
export async function printDiagram(root: ParentNode = document, timeoutMs = 4000): Promise<void> {
  const imgs = [...root.querySelectorAll<HTMLImageElement>('.diagram__inner img')];
  for (const img of imgs) {
    if (img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src;
  }
  await Promise.race([
    Promise.all(imgs.map(waitImage)),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
  window.print();
}
