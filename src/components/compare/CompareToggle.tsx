import './Compare.css';
import { COMPARE_MAX, useCompareStore, type CompareKind } from '../../store/useCompareStore';

interface Props {
  kind: CompareKind;
  id: string;
  /** 스크린리더 라벨용 이름 */
  name: string;
  /** full = "비교에 담기" 글자 버튼, icon = 작은 ＋/✓ 버튼 (제품 카드 옆) */
  variant?: 'full' | 'icon';
  className?: string;
}

/**
 * "비교에 담기" 토글 (aria-pressed). 기기·제품 목록은 따로, 각 최대 4개 — 가득 차면 비활성 + 안내.
 * 라벨은 상태와 무관하게 고정하고 상태는 aria-pressed 로 전달 (토글 버튼 관례).
 */
export default function CompareToggle({ kind, id, name, variant = 'full', className }: Props) {
  const list = useCompareStore((s) => s[kind]);
  const toggle = useCompareStore((s) => s.toggle);
  const pressed = list.includes(id);
  const full = !pressed && list.length >= COMPARE_MAX;
  const what = kind === 'equipment' ? '기기' : '제품';
  const title = full ? `${what} 비교 목록이 가득 찼습니다 (최대 ${COMPARE_MAX}개)` : pressed ? '비교 목록에서 빼기' : '비교 목록에 담기';
  return (
    <button
      type="button"
      className={`cmp-toggle cmp-toggle--${variant}${pressed ? ' is-on' : ''}${className ? ` ${className}` : ''}`}
      aria-pressed={pressed}
      aria-label={variant === 'icon' ? `${name} 비교에 담기` : undefined}
      disabled={full}
      title={title}
      data-testid={`compare-toggle-${id}`}
      onClick={() => toggle(kind, id)}
    >
      <span aria-hidden="true" className="cmp-toggle__icon">
        {pressed ? '✓' : '＋'}
      </span>
      {variant === 'full' && <span>비교에 담기</span>}
    </button>
  );
}
