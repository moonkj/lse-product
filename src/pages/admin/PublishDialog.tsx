import { useEffect, useRef, useState } from 'react';
import { PUBLISH_ETA_MIN, publishFiles, type PublishResult } from '../../lib/admin/publish';

interface Props {
  /** 반영할 파일 이름 → 내용 (검사를 통과한 것만 넘긴다) */
  files: Record<string, string>;
  /** 변경 요약 기본 문구 (커밋 메시지) */
  defaultMessage: string;
  onClose: () => void;
  onDone?: (r: Extract<PublishResult, { ok: true }>) => void;
}

/**
 * "사이트에 반영" 확인 창 — 관리자 비밀번호 + 변경 요약을 받아 저장소에 커밋한다 (2026-11-23 사용자: 관리자 탭에서 제품맵 수정이 바로 반영돼야 함).
 * 비밀번호는 이 창이 닫히면 버린다 (저장하지 않음).
 */
export default function PublishDialog({ files, defaultMessage, onClose, onDone }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const names = Object.keys(files);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal?.();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    const r = await publishFiles(files, password, message);
    setBusy(false);
    setResult(r);
    if (r.ok) {
      setPassword('');
      onDone?.(r);
    }
  };

  return (
    <dialog ref={ref} className="apub" aria-labelledby="apub-title" onClose={onClose} onCancel={onClose} data-testid="admin-publish-dialog">
      <form onSubmit={submit} className="apub__form">
        <h2 id="apub-title" className="apub__title">
          사이트에 반영
        </h2>
        {result?.ok ? (
          <div className="apub__done" role="status" data-testid="admin-publish-done">
            <p>
              반영을 요청했습니다. 약 {PUBLISH_ETA_MIN}분 뒤 모든 사용자 화면에 보입니다.
            </p>
            <p>
              <a href={result.url} target="_blank" rel="noreferrer">
                변경 기록 보기 ↗
              </a>
            </p>
            <div className="apub__actions">
              <button type="button" className="abtn abtn--primary" onClick={() => ref.current?.close()}>
                닫기
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="apub__files">
              반영할 파일: <strong>{names.join(', ')}</strong>
            </p>
            <label className="apub__field">
              <span>변경 요약</span>
              <input type="text" value={message} maxLength={200} onChange={(e) => setMessage(e.target.value)} data-testid="admin-publish-message" />
            </label>
            <label className="apub__field">
              <span>관리자 비밀번호</span>
              <input
                type="password"
                value={password}
                autoComplete="current-password"
                required
                autoFocus
                onChange={(e) => setPassword(e.target.value)}
                data-testid="admin-publish-password"
              />
            </label>
            {result && !result.ok && (
              <p className="apub__error" role="alert" data-testid="admin-publish-error">
                {result.error}
              </p>
            )}
            <div className="apub__actions">
              <button type="button" className="abtn" onClick={() => ref.current?.close()} disabled={busy}>
                취소
              </button>
              <button type="submit" className="abtn abtn--primary" disabled={busy || !password} data-testid="admin-publish-submit">
                {busy ? '반영 중…' : '반영'}
              </button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
