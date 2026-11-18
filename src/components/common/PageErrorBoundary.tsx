import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorDetails, { errorHeading, isNetworkError } from './ErrorDetails';
import './RootErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** 값이 바뀌면(라우트 이동) 오류 상태를 지우고 다시 그린다 */
  resetKey: string;
}

interface State {
  error?: Error;
  key: string;
  /** 다시 시도를 눌렀는데 아직 오프라인 */
  stillOffline?: boolean;
}

/**
 * 페이지 단위 오류 경계 (리뷰 R7) — 한 화면(예: 데이터 파일 오류)이 실패해도 헤더·좌측 내비는 남기고
 * 본문 자리에만 안내 + "계통도로" 버튼을 보여 준다.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { key: props.resetKey, error: undefined, stillOffline: false } : null;
  }

  /**
   * 다시 시도 — React.lazy 는 한 번 실패한 import 를 기억하므로 경계만 지워서는 다시 받지 않는다 → 새로고침.
   * 아직 오프라인이면 새로고침하지 않고(브라우저 오프라인 화면으로 바뀌지 않게) 안내만.
   */
  retry = () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.setState({ stillOffline: true });
      return;
    }
    window.location.reload();
  };

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error, stillOffline } = this.state;
    if (!error) return this.props.children;
    const network = isNetworkError(error);
    return (
      <div role="alert" className="root-error" data-testid="page-error" data-kind={network ? 'network' : undefined}>
        <h1>{errorHeading(error, '이 화면')}</h1>
        <ErrorDetails error={error} />
        {stillOffline && <p className="root-error__hint">아직 오프라인입니다. 연결되면 다시 눌러 주세요.</p>}
        <p className="root-error__actions">
          <button type="button" className="root-error__btn root-error__btn--primary" data-testid="page-error-retry" onClick={this.retry}>
            {network ? '다시 시도' : '새로고침'}
          </button>{' '}
          {/* HashRouter 밖으로 나가지 않도록 a href="#/" 사용 (경계가 라우터 컨텍스트 오류도 잡을 수 있게 Link 미사용) */}
          <a href="#/" className="root-error__btn">
            계통도로 돌아가기
          </a>
        </p>
      </div>
    );
  }
}
