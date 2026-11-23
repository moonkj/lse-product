/**
 * 관리자 "사이트에 반영" — 고친 데이터 파일을 /api/admin/publish(functions/api/admin/publish.ts)로 보내 저장소에 커밋한다.
 * 커밋되면 deploy.yml 이 자동 배포하므로 몇 분 뒤 모두의 화면에 보인다.
 * 비밀번호는 저장하지 않는다 (요청 한 번에만 쓰고 버림).
 */
export const PUBLISH_URL = 'https://lse-grid-map.pages.dev/api/admin/publish';
/** 커밋부터 사이트에 보이기까지 대략 (빌드·배포 실측 3~4분) */
export const PUBLISH_ETA_MIN = 4;

export type PublishResult = { ok: true; sha: string; url: string } | { ok: false; error: string };

export async function publishFiles(files: Record<string, string>, password: string, message: string, url = PUBLISH_URL): Promise<PublishResult> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, message, files }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; sha?: string; url?: string; error?: string };
    if (res.ok && body.ok && body.sha && body.url) return { ok: true, sha: body.sha, url: body.url };
    return { ok: false, error: body.error || `반영 실패 (HTTP ${res.status})` };
  } catch {
    return { ok: false, error: '서버에 연결하지 못했습니다 — 인터넷 연결을 확인하세요' };
  }
}
