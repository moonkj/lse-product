import { DataValidationError } from '../../data/load';

/**
 * 오류 내용 표시 (최상위·페이지 오류 경계 공용).
 * DataValidationError.file 이 'src/…' 처럼 경로를 포함하면 그대로, 파일명만 있으면 src/data/ 기준으로 표시.
 */
export function errorFilePath(file: string): string {
  return file.includes('/') ? file : `src/data/${file}`;
}

export default function ErrorDetails({ error }: { error: Error }) {
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
  error instanceof DataValidationError
    ? `데이터 파일에 오류가 있어 ${scope}을 표시할 수 없습니다`
    : `${scope}을 표시하는 중 오류가 발생했습니다`;
