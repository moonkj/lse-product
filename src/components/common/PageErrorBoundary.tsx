import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorDetails, { errorHeading } from './ErrorDetails';
import './RootErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** 값이 바뀌면(라우트 이동) 오류 상태를 지우고 다시 그린다 */
  resetKey: string;
}

interface State {
  error?: Error;
  key: string;
}

/**
 * 페이지 단위 오류 경계 (리뷰 R7) — 한 화면(예: learn.json 오류)이 실패해도 헤더·좌측 내비는 남기고
 * 본문 자리에만 안내 + "계통도로" 버튼을 보여 준다.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { key: props.resetKey, error: undefined } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[PageErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="root-error" data-testid="page-error">
        <h1>{errorHeading(error, '이 화면')}</h1>
        <ErrorDetails error={error} />
        <p>
          {/* HashRouter 밖으로 나가지 않도록 a href="#/" 사용 (경계가 라우터 컨텍스트 오류도 잡을 수 있게 Link 미사용) */}
          <a href="#/">계통도로 돌아가기</a>{' '}
          <button type="button" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </p>
      </div>
    );
  }
}
