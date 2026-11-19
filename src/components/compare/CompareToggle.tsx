import './Compare.css';
import { buttonClass } from '../common/Button';
import { COMPARE_MAX, compareIdInData, useCompareStore, type CompareKind } from '../../store/useCompareStore';
import { useData } from '../../data/load';
import { announce } from '../../lib/announce';

interface Props {
  kind: CompareKind;
  /** 기기 id, 제품 id, 또는 "제품id:옵션id" (사양 옵션 하나만 담기) */
  id: string;
  /** 스크린리더 라벨용 이름 */
  name: string;
  /** full = "비교에 담기" 글자 버튼, icon = 작은 ＋/✓ 버튼 (제품 카드 옆) */
  variant?: 'full' | 'icon';
  className?: string;
  /** full 버튼 글자 (기본 "비교에 담기" — 옵션 표에서는 "이 옵션 비교에 담기") */
  label?: string;
  /** 스크린리더 이름을 직접 지정 (화면 글자를 포함해야 함 — WCAG 2.5.3). 옵션 표의 작은 "비교" 버튼용 */
  ariaLabel?: string;
}

/**
 * "비교에 담기" 토글 (aria-pressed). 기기·제품 목록은 따로, 각 최대 4개 — 가득 차면 비활성 + 안내.
 * 디자인 토론 P1: 기본 글자일 때 담기면 "✓ 담김 n/4"(누르면 빼기)로 바뀐다 — 패널·기기·제품 페이지 같은 모양.
 * 직접 지정한 글자(옵션 표 등)는 그대로 두고 아이콘만 ＋ → ✓. 상태는 늘 aria-pressed 로도 전달.
 */
const DEFAULT_LABEL = '비교에 담기';

export default function CompareToggle({ kind, id, name, variant = 'full', className, label = DEFAULT_LABEL, ariaLabel }: Props) {
  const list = useCompareStore((s) => s[kind]);
  const toggle = useCompareStore((s) => s.toggle);
  const pressed = list.includes(id);
  const data = useData();
  // 가득 판정은 데이터에 있는 id 기준 (사라진 id 는 자리를 차지하지 않음 — store.toggle 과 같은 규칙)
  const validCount =
    list.length < COMPARE_MAX ? list.length : list.filter((x) => compareIdInData(kind, x, data)).length;
  const full = !pressed && validCount >= COMPARE_MAX;
  const what = kind === 'equipment' ? '기기' : '제품';
  const count = list.filter((x) => compareIdInData(kind, x, data)).length;
  const showCount = variant === 'full' && pressed && label === DEFAULT_LABEL;
  const title = full ? `${what} 비교 목록이 가득 찼습니다 (최대 ${COMPARE_MAX}${kind === 'equipment' ? '종' : '개'})` : pressed ? '누르면 비교 목록에서 빼기' : '비교 목록에 담기';
  return (
    <button
      type="button"
      className={buttonClass({
        variant: 'secondary',
        size: 'md',
        className: `cmp-toggle cmp-toggle--${variant}${pressed ? ' is-on' : ''}${className ? ` ${className}` : ''}`,
      })}
      aria-pressed={pressed}
      aria-label={ariaLabel ? ariaLabel : variant === 'icon' ? `${name} 비교에 담기` : label !== DEFAULT_LABEL ? `${name} ${label}` : undefined}
      disabled={full}
      title={title}
      data-testid={`compare-toggle-${id}`}
      onClick={() => {
        const r = toggle(kind, id);
        const n = useCompareStore.getState()[kind].length;
        if (r === 'added') announce(`비교에 ${name} 담음 (${n}/${COMPARE_MAX})`);
        else if (r === 'removed') announce(`비교에서 ${name} 뺌 (${n}/${COMPARE_MAX})`);
        else announce(title);
      }}
    >
      <span aria-hidden="true" className="cmp-toggle__icon">
        {pressed ? '✓' : '＋'}
      </span>
      {variant === 'full' &&
        (showCount ? (
          <span>
            담김 <span className="cmp-toggle__count">{count}/{COMPARE_MAX}</span>
          </span>
        ) : (
          <span>{label}</span>
        ))}
    </button>
  );
}
