import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorDetails, { errorHeading } from './ErrorDetails';
import './RootErrorBoundary.css';
import { reloadFresh } from '../../lib/freshReload';

interface State {
  error?: Error;
}

/** 최상위 오류 경계 — 데이터 검증 실패·렌더 오류를 흰 화면 대신 한국어 안내로 보여 준다 */
export default class RootErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[RootErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="root-error" data-testid="root-error">
        <h1>{errorHeading(error, '화면')}</h1>
        <ErrorDetails error={error} />
        <button type="button" onClick={() => reloadFresh()}>
          새로고침
        </button>
      </div>
    );
  }
}
