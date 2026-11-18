/**
 * 계통도 줌/패닝 엔진 (프레임워크 독립).
 *
 * 구조: viewport(overflow:auto) > sizer(크기만 가짐) > inner(transform: translate+scale)
 *  - 패닝 = viewport 의 네이티브 스크롤 → 포커스 이동·scrollIntoView·터치 관성 스크롤이 그대로 동작
 *  - 줌   = inner 의 transform 과 sizer 크기만 바꾼다 (React 렌더 없음)
 *  - 마우스 드래그로 패닝(이동량 > 4px)한 경우 뒤따르는 click 은 버린다 → 노드 선택으로 처리되지 않음
 *  - 휠 = 확대·축소(커서 기준), 두 손가락 핀치 = 확대·축소(중점 기준)
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewInfo extends Rect {
  scale: number;
}

export interface PanZoomOptions {
  width: number;
  height: number;
  /** 콘텐츠 둘레 여백 (화면 px) */
  pad?: number;
  maxScale?: number;
  onView: (v: ViewInfo) => void;
}

const DRAG_THRESHOLD = 4;

export class PanZoom {
  scale = 1;
  private ox = 0;
  private oy = 0;
  private readonly pad: number;
  private readonly maxScale: number;
  private raf = 0;
  /** 드래그 상태: 시작점(x,y)은 임계 판정용, 직전 위치(lx,ly)는 증분 이동용 — 드래그 중 휠 줌이 섞여도 튀지 않게 */
  private drag: { x: number; y: number; lx: number; ly: number; active: boolean; id: number } | null = null;
  private suppressClick = false;
  private pinch: { dist: number; scale: number; mx: number; my: number } | null = null;
  private ro?: ResizeObserver;
  private lastSize = { w: 0, h: 0 };
  /** 오른쪽·아래 덮개(비교 바·하단 시트 등) 몫의 추가 스크롤 여백 — 끝자락 타일도 덮개 위로 올릴 수 있게 */
  private inset = { r: 0, b: 0 };
  private readonly cleanups: (() => void)[] = [];

  constructor(
    private readonly vp: HTMLElement,
    private readonly sizer: HTMLElement,
    private readonly inner: HTMLElement,
    private readonly opts: PanZoomOptions,
  ) {
    this.pad = opts.pad ?? 32;
    this.maxScale = opts.maxScale ?? 2;
    this.lastSize = { w: vp.clientWidth, h: vp.clientHeight };
    this.listen(vp, 'wheel', this.onWheel as EventListener, { passive: false });
    this.listen(vp, 'pointerdown', this.onPointerDown as EventListener);
    this.listen(window, 'pointermove', this.onPointerMove as EventListener);
    this.listen(window, 'pointerup', this.onPointerUp as EventListener);
    this.listen(window, 'pointercancel', this.onPointerUp as EventListener);
    this.listen(vp, 'click', this.onClickCapture as EventListener, { capture: true });
    this.listen(vp, 'touchstart', this.onTouchStart as EventListener, { passive: false });
    this.listen(vp, 'touchmove', this.onTouchMove as EventListener, { passive: false });
    this.listen(vp, 'touchend', this.onTouchEnd as EventListener);
    this.listen(vp, 'touchcancel', this.onTouchEnd as EventListener);
    this.listen(vp, 'scroll', this.onScroll, { passive: true });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(this.onResize);
      this.ro.observe(vp);
    }
    this.apply(1);
  }

  destroy() {
    this.cleanups.forEach((c) => c());
    this.ro?.disconnect();
    cancelAnimationFrame(this.raf);
  }

  private listen(
    target: EventTarget,
    type: string,
    fn: EventListener,
    options?: AddEventListenerOptions,
  ) {
    target.addEventListener(type, fn, options);
    this.cleanups.push(() => target.removeEventListener(type, fn, options));
  }

  private get vw() {
    return this.vp.clientWidth || 1;
  }

  private get vh() {
    return this.vp.clientHeight || 1;
  }

  /** 전체가 들어오는 배율의 80% 까지 축소 허용 */
  minScale() {
    const fit = Math.min((this.vw - 2 * this.pad) / this.opts.width, (this.vh - 2 * this.pad) / this.opts.height);
    return Math.max(0.05, Math.min(fit * 0.8, 0.5));
  }

  private clamp(s: number) {
    return Math.min(this.maxScale, Math.max(this.minScale(), s));
  }

  /** 배율 적용 (스크롤 위치는 호출자가 맞춘다) */
  private apply(s: number) {
    this.scale = this.clamp(s);
    const cw = this.opts.width * this.scale;
    const ch = this.opts.height * this.scale;
    const sw = Math.max(this.vw, cw + 2 * this.pad + this.inset.r);
    const sh = Math.max(this.vh, ch + 2 * this.pad + this.inset.b);
    this.ox = (sw - this.inset.r - cw) / 2;
    this.oy = (sh - this.inset.b - ch) / 2;
    this.sizer.style.width = `${sw}px`;
    this.sizer.style.height = `${sh}px`;
    this.inner.style.transform = `translate(${this.ox}px, ${this.oy}px) scale(${this.scale})`;
    // 많이 축소했을 때 밴드 라벨이 읽히도록 글자 배율 보정
    this.inner.style.setProperty('--label-k', String(Math.max(1, Math.min(3.5, 0.8 / this.scale))));
  }

  /** 현재 보이는 영역 (diagram 좌표) */
  view(): ViewInfo {
    const s = this.scale;
    return {
      scale: s,
      x: (this.vp.scrollLeft - this.ox) / s,
      y: (this.vp.scrollTop - this.oy) / s,
      w: this.vw / s,
      h: this.vh / s,
    };
  }

  private publish = () => {
    this.raf = 0;
    this.opts.onView(this.view());
  };

  private schedule() {
    if (!this.raf) this.raf = requestAnimationFrame(this.publish);
  }

  /** 화면 지점(px, py: viewport 기준)을 고정한 채 배율 변경 */
  zoomAt(s: number, px: number, py: number) {
    const dx = (this.vp.scrollLeft + px - this.ox) / this.scale;
    const dy = (this.vp.scrollTop + py - this.oy) / this.scale;
    this.apply(s);
    this.vp.scrollLeft = this.ox + dx * this.scale - px;
    this.vp.scrollTop = this.oy + dy * this.scale - py;
    this.opts.onView(this.view());
  }

  zoomBy(f: number) {
    this.zoomAt(this.scale * f, this.vw / 2, this.vh / 2);
  }

  /** diagram 좌표 (x, y) 를 화면 가운데로 */
  centerOn(x: number, y: number, s?: number) {
    if (s !== undefined) this.apply(s);
    this.vp.scrollLeft = this.ox + x * this.scale - this.vw / 2;
    this.vp.scrollTop = this.oy + y * this.scale - this.vh / 2;
    this.opts.onView(this.view());
  }

  /** diagram 좌표 (x, y) 를 viewport 안의 화면 지점 (px, py) 에 (s 를 주면 그 배율로) */
  placeAt(x: number, y: number, px: number, py: number, s?: number) {
    if (s !== undefined) this.apply(s);
    this.vp.scrollLeft = this.ox + x * this.scale - px;
    this.vp.scrollTop = this.oy + y * this.scale - py;
    this.opts.onView(this.view());
  }

  /** 오른쪽·아래 덮개 크기(화면 px)만큼 스크롤 여백을 더한다. 지금 보이는 위치는 유지 */
  setInsets(r: number, b: number) {
    r = Math.max(0, Math.round(r));
    b = Math.max(0, Math.round(b));
    if (r === this.inset.r && b === this.inset.b) return;
    const v = this.view();
    this.inset = { r, b };
    this.apply(this.scale);
    this.vp.scrollLeft = this.ox + v.x * this.scale;
    this.vp.scrollTop = this.oy + v.y * this.scale;
  }

  /** 저장해 둔 보기(view())를 그대로 복원 — 뒤로가기 시 위치 복원용 */
  restore(v: ViewInfo) {
    this.apply(v.scale);
    this.vp.scrollLeft = this.ox + v.x * this.scale;
    this.vp.scrollTop = this.oy + v.y * this.scale;
    this.opts.onView(this.view());
  }

  /** diagram 영역을 viewport 기준 화면 좌표(px, 클라이언트 영역 왼쪽 위 = 0)로 */
  toScreen(r: Rect): Rect {
    const s = this.scale;
    return {
      x: this.ox + r.x * s - this.vp.scrollLeft,
      y: this.oy + r.y * s - this.vp.scrollTop,
      w: r.w * s,
      h: r.h * s,
    };
  }

  /** 영역이 화면에 꽉 차게 (maxScale 이하) */
  fitRect(r: Rect, maxScale = 1, margin = 16) {
    const s = Math.min((this.vw - 2 * margin) / r.w, (this.vh - 2 * margin) / r.h, maxScale);
    this.centerOn(r.x + r.w / 2, r.y + r.h / 2, s);
  }

  fitAll() {
    this.fitRect({ x: 0, y: 0, w: this.opts.width, h: this.opts.height }, 1);
  }

  /** 영역이 지금 화면 안에 다 보이는지 */
  isVisible(r: Rect) {
    const v = this.view();
    return r.x >= v.x && r.y >= v.y && r.x + r.w <= v.x + v.w && r.y + r.h <= v.y + v.h;
  }

  // ── 이벤트 ─────────────────────────────────────────────
  private onScroll = () => this.schedule();

  private onResize = () => {
    const w = this.vp.clientWidth;
    const h = this.vp.clientHeight;
    if (w === this.lastSize.w && h === this.lastSize.h) return;
    const v = this.view();
    const cx = v.x + (this.lastSize.w / this.scale) / 2;
    const cy = v.y + (this.lastSize.h / this.scale) / 2;
    this.lastSize = { w, h };
    this.centerOn(cx, cy, this.scale);
  };

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.vh : 1;
    const k = e.ctrlKey ? 0.01 : 0.0015; // ctrl+휠 = 트랙패드 핀치
    const f = Math.exp(-e.deltaY * unit * k);
    const rect = this.vp.getBoundingClientRect();
    this.zoomAt(this.scale * f, e.clientX - rect.left, e.clientY - rect.top);
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    // 네이티브 스크롤바를 잡은 경우는 브라우저에 맡긴다 (커스텀 드래그와 겹치지 않게)
    if (e.target === this.vp && (e.offsetX >= this.vp.clientWidth || e.offsetY >= this.vp.clientHeight)) return;
    this.drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, active: false, id: e.pointerId };
  };

  private onPointerMove = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const mx = e.clientX - d.x;
    const my = e.clientY - d.y;
    if (!d.active) {
      if (Math.hypot(mx, my) <= DRAG_THRESHOLD) return;
      d.active = true;
      this.vp.classList.add('is-panning');
    }
    e.preventDefault();
    this.vp.scrollLeft -= e.clientX - d.lx;
    this.vp.scrollTop -= e.clientY - d.ly;
    d.lx = e.clientX;
    d.ly = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    if (d.active) {
      this.vp.classList.remove('is-panning');
      this.suppressClick = true;
      setTimeout(() => {
        this.suppressClick = false;
      }, 0);
    }
  };

  private onClickCapture = (e: MouseEvent) => {
    if (!this.suppressClick) return;
    e.stopPropagation();
    e.preventDefault();
    this.suppressClick = false;
  };

  private static dist(t: TouchList) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  private onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const [a, b] = [e.touches[0], e.touches[1]];
      this.pinch = { dist: PanZoom.dist(e.touches), scale: this.scale, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2 };
    }
  };

  private onTouchMove = (e: TouchEvent) => {
    if (!this.pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const rect = this.vp.getBoundingClientRect();
    const px = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const py = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    this.zoomAt((this.pinch.scale * PanZoom.dist(e.touches)) / this.pinch.dist, px, py);
    // 두 손가락 중점이 움직이면 그만큼 패닝
    const mx = px + rect.left;
    const my = py + rect.top;
    this.vp.scrollLeft -= mx - this.pinch.mx;
    this.vp.scrollTop -= my - this.pinch.my;
    this.pinch.mx = mx;
    this.pinch.my = my;
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) this.pinch = null;
  };
}
