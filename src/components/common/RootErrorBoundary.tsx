import { Component, type ErrorInfo, type ReactNode } from 'react';
import { DataValidationError } from '../../data/load';
import './RootErrorBoundary.css';

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

    const isData = error instanceof DataValidationError;
    return (
      <div role="alert" className="root-error" data-testid="root-error">
        <h1>{isData ? '데이터 파일에 오류가 있어 화면을 표시할 수 없습니다' : '화면을 표시하는 중 오류가 발생했습니다'}</h1>
        {isData ? (
          <>
            <p>
              파일 <code>src/data/{error.file}</code> 에서 아래 항목이 형식에 맞지 않습니다. 해당 값을 고친 뒤 다시
              배포하세요.
            </p>
            <table className="root-error__table">
              <thead>
                <tr>
                  <th scope="col">위치(필드)</th>
                  <th scope="col">문제</th>
                </tr>
              </thead>
              <tbody>
                {error.issues.slice(0, 50).map((i, idx) => (
                  <tr key={idx}>
                    <td>
                      <code>{i.path}</code>
                    </td>
                    <td>{i.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {error.issues.length > 50 && <p>외 {error.issues.length - 50}건</p>}
            <p className="root-error__hint">
              위치 예: <code>12.coverage</code> = 배열의 13번째 항목의 coverage 필드 (0부터 셈)
            </p>
          </>
        ) : (
          <pre className="root-error__pre">{error.message}</pre>
        )}
        <button type="button" onClick={() => window.location.reload()}>
          새로고침
        </button>
      </div>
    );
  }
}
