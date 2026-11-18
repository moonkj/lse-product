import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { pageTitle } from '../lib/labels';

interface Props {
  /** '기기' | '제품' — 없으면 일반 경로 404 */
  kind?: string;
  id?: string;
}

/** 받침 유무로 을/를 선택 */
function objectParticle(word: string) {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0 ? '을' : '를';
}

export default function NotFoundPage({ kind, id }: Props) {
  useEffect(() => {
    document.title = pageTitle('찾을 수 없음');
  }, []);
  return (
    <div className="page" data-testid="not-found">
      <h1>{kind ? `${kind}${objectParticle(kind)} 찾을 수 없습니다` : '페이지를 찾을 수 없습니다'}</h1>
      {kind && id && (
        <p className="page__lead">
          요청한 {kind} ID <code>{id}</code> 는 등록되어 있지 않습니다. 주소를 확인하거나 계통도에서 다시 찾아보세요.
        </p>
      )}
      <Link to="/">← 계통도로</Link>
    </div>
  );
}
