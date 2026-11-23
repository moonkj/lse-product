/**
 * Cloudflare Pages Function — POST /api/admin/publish (https://lse-grid-map.pages.dev/api/admin/publish)
 *
 * 관리자 화면의 "사이트에 반영": 고친 데이터 파일을 GitHub 저장소 main 에 한 커밋으로 올린다 → deploy.yml 이 자동 배포(약 3~4분).
 * - 비밀번호: Pages Secret ADMIN_PASSWORD 와 같아야 한다 (틀리면 1초 늦게 401 — 무작정 대입 늦추기).
 * - GitHub 토큰: Pages Secret ADMIN_GH_TOKEN (fine-grained, 이 저장소 Contents 읽기·쓰기만). 브라우저에는 절대 보내지 않는다.
 * - 올릴 수 있는 파일은 src/data 의 정해진 5개뿐(ALLOWED, 데이터센터 계통도 포함). 각 파일은 JSON 으로 읽혀야 하고 2MB 이하.
 * - 두 Secret 은 deploy.yml 이 GitHub Secret 에서 `wrangler pages secret put` 으로 등록.
 * - 관리자 화면은 로컬 개발 서버에서도 쓰므로 CORS 는 * (비밀번호가 보호).
 */

interface Env {
  ADMIN_PASSWORD?: string;
  ADMIN_GH_TOKEN?: string;
  /** owner/name (기본 moonkj/lse-product) */
  ADMIN_GH_REPO?: string;
  ADMIN_GH_BRANCH?: string;
}

export interface PublishContext {
  request: Request;
  env: Env;
}

export const ALLOWED = ['equipment-types.json', 'diagram.json', 'diagram-dc.json', 'equipment-images.json', 'specs.json'] as const;
export const MAX_FILE_BYTES = 2_000_000;
const DATA_DIR = 'src/data/';
const GH = 'https://api.github.com';
const WRONG_PASSWORD_DELAY_MS = 1_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });

/** 길이가 달라도 같은 시간 — 문자열 비교로 비밀번호 길이·앞부분을 알아내지 못하게 */
export function safeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  const n = Math.max(ea.length, eb.length);
  for (let i = 0; i < n; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

interface Body {
  password?: unknown;
  message?: unknown;
  files?: unknown;
}

/** 요청 본문 검사 → 올릴 파일 목록 (오류면 문자열) */
export function checkFiles(files: unknown): { path: string; content: string }[] | string {
  if (!files || typeof files !== 'object' || Array.isArray(files)) return '파일 목록이 없습니다';
  const entries = Object.entries(files as Record<string, unknown>);
  if (entries.length === 0) return '반영할 파일이 없습니다';
  const out: { path: string; content: string }[] = [];
  for (const [name, content] of entries) {
    if (!(ALLOWED as readonly string[]).includes(name)) return `올릴 수 없는 파일: ${name}`;
    if (typeof content !== 'string') return `${name}: 내용이 문자열이 아닙니다`;
    if (new TextEncoder().encode(content).length > MAX_FILE_BYTES) return `${name}: 2MB를 넘습니다`;
    try {
      const v = JSON.parse(content);
      if (v === null || typeof v !== 'object') return `${name}: JSON 객체·배열이 아닙니다`;
    } catch {
      return `${name}: JSON 형식이 아닙니다`;
    }
    out.push({ path: DATA_DIR + name, content });
  }
  return out;
}

async function gh(env: Env, path: string, init: RequestInit = {}) {
  const res = await fetch(`${GH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.ADMIN_GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'LSE-ProductMap-Admin',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${res.status} ${path.replace(/\/repos\/[^/]+\/[^/]+/, '')}`);
  return res.json() as Promise<Record<string, unknown>>;
}

/** 여러 파일을 한 커밋으로: ref → 커밋의 tree → 새 tree(base_tree) → 새 커밋 → ref 이동 */
export async function commitFiles(env: Env, files: { path: string; content: string }[], message: string) {
  const repo = env.ADMIN_GH_REPO || 'moonkj/lse-product';
  const branch = env.ADMIN_GH_BRANCH || 'main';
  const base = `/repos/${repo}`;
  const ref = await gh(env, `${base}/git/ref/heads/${branch}`);
  const headSha = (ref.object as { sha: string }).sha;
  const head = await gh(env, `${base}/git/commits/${headSha}`);
  const tree = await gh(env, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({
      base_tree: (head.tree as { sha: string }).sha,
      tree: files.map((f) => ({ path: f.path, mode: '100644', type: 'blob', content: f.content })),
    }),
  });
  const commit = await gh(env, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: tree.sha,
      parents: [headSha],
      author: { name: '제품맵 관리자', email: 'admin@lse-grid-map.invalid', date: new Date().toISOString() },
    }),
  });
  await gh(env, `${base}/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
  return { sha: String(commit.sha), url: `https://github.com/${repo}/commit/${commit.sha}` };
}

export async function onRequest(ctx: PublishContext): Promise<Response> {
  const { request, env } = ctx;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'POST 만 받습니다' }, 405);
  if (!env.ADMIN_PASSWORD || !env.ADMIN_GH_TOKEN) return json({ error: '사이트 반영이 아직 설정되지 않았습니다 (관리자 비밀번호·GitHub 토큰 미등록)' }, 503);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json({ error: '요청 형식이 잘못됐습니다' }, 400);
  }
  if (typeof body.password !== 'string' || !safeEqual(body.password, env.ADMIN_PASSWORD)) {
    await new Promise((r) => setTimeout(r, WRONG_PASSWORD_DELAY_MS));
    return json({ error: '관리자 비밀번호가 맞지 않습니다' }, 401);
  }
  const files = checkFiles(body.files);
  if (typeof files === 'string') return json({ error: files }, 400);
  const note = typeof body.message === 'string' ? body.message.trim().slice(0, 200) : '';
  const names = files.map((f) => f.path.slice(DATA_DIR.length)).join(', ');
  const message = `관리자 화면에서 제품맵 수정: ${note || names}\n\n파일: ${names}`;
  try {
    const r = await commitFiles(env, files, message);
    return json({ ok: true, ...r }, 200);
  } catch (e) {
    // 토큰·응답 내용은 돌려주지 않는다 (상태 코드와 단계만)
    return json({ error: `저장소 반영 실패 — ${(e as Error).message}` }, 502);
  }
}
