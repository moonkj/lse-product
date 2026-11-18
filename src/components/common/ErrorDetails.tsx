import { DataValidationError } from '../../lib/errors';

/**
 * 오류 내용 표시 (최상위·페이지 오류 경계 공용).
 * DataValidationError.file 이 'src/…' 처럼 경로를 포함하면 그대로, 파일명만 있으면 src/data/ 기준으로 표시.
 */
export function errorFilePath(file: string): string {
  return file.includes('/') ? file : `src/data/${file}`;
}

/**
 * 화면 조각(청크)·스타일을 받지 못한 오류인가 — 오프라인·회선 끊김·배포 직후 옛 청크 (UX 토론 B10).
 * 브라우저마다 문구가 달라 대표 문구로 판정한다 (Chrome·Firefox·Safari·Vite 프리로드).
 */
const CHUNK_ERROR_RE =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (CSS )?chunk .* failed|Failed to fetch|NetworkError|Load failed/i;

export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(error.message);
}

export const NETWORK_ERROR_TEXT = '네트워크에 연결할 수 없습니다. 연결 상태를 확인한 뒤 다시 시도하세요.';

export default function ErrorDetails({ error }: { error: Error }) {
  if (isNetworkError(error))
    return (
      <p className="root-error__lead" data-testid="error-network">
        {NETWORK_ERROR_TEXT} 이미 열어 본 계통도는 그대로 볼 수 있습니다.
      </p>
    );
  if (!(error instanceof DataValidationError)) return <pre className="root-error__pre">{error.message}</pre>;
  return (
    <>
      <p>
        파일 <code>{errorFilePath(error.file)}</code> 에서 아래 항목이 형식에 맞지 않습니다. 해당 값을 고친 뒤 다시 배포하세요.
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
  );
}

export const errorHeading = (error: Error, scope: '화면' | '이 화면') =>
  isNetworkError(error)
    ? `${scope}을 불러오지 못했습니다`
    : error instanceof DataValidationError
      ? `데이터 파일에 오류가 있어 ${scope}을 표시할 수 없습니다`
      : `${scope}을 표시하는 중 오류가 발생했습니다`;
