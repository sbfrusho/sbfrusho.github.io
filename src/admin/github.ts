/**
 * Minimal GitHub REST client. The token only ever lives in this object and in the
 * Authorization header; it is never logged, put in a URL or included in an error.
 */
import { BRANCH, CONTENT_PATH, OWNER, REPO, RESUME_DIR, UPLOADS_DIR } from "./config";
import { base64ToText, bytesToBase64, textToBase64 } from "./lib/encoding";
import type { RepoSummary } from "./lib/content";
import type { WorkflowRun } from "./lib/deploy";

export type ErrorKind = "unauthorized" | "forbidden" | "rate-limit" | "not-found" | "conflict" | "offline" | "invalid" | "server";

export class GitHubError extends Error {
  constructor(
    public kind: ErrorKind,
    message: string,
    public status = 0,
    public resetAt?: number,
    public headSha?: string,
  ) {
    super(message);
    this.name = "GitHubError";
  }
}

export interface RemoteFile {
  /** Repo path, e.g. public/uploads/a.webp */
  path: string;
  size: number;
  sha: string;
}

export interface CommitInfo {
  sha: string;
  message: string;
  date: string;
  author: string;
  url: string;
}

export interface RemoteSnapshot {
  commit: CommitInfo;
  treeSha: string;
  files: RemoteFile[];
  /** null when the content file does not exist on the branch. */
  rawText: string | null;
}

export interface StagedFile {
  path: string;
  blob: Blob;
}

export interface PublishPlan {
  baseCommitSha: string;
  contentJson: string;
  uploads: StagedFile[];
  deletions: string[];
  message: string;
}

export type PublishStep = "checking" | "uploading" | "tree" | "commit" | "ref";

const API = "https://api.github.com";
const REPO_PATH = `/repos/${OWNER}/${REPO}`;

function rateLimitMessage(resetAt?: number): string {
  if (!resetAt) return "GitHub rate limit reached. Wait a minute and try again. Your draft is safe.";
  const mins = Math.max(1, Math.ceil((resetAt - Date.now()) / 60000));
  return `GitHub rate limit reached. It resets in about ${mins} minute${mins > 1 ? "s" : ""}. Your draft is safe.`;
}

export function toGitHubError(status: number, headers: Headers, apiMessage: string): GitHubError {
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = Number(headers.get("x-ratelimit-reset"));
  const retryAfter = Number(headers.get("retry-after"));
  const isRate = status === 429 || (status === 403 && (remaining === "0" || retryAfter > 0 || /rate limit/i.test(apiMessage)));
  if (isRate) {
    const resetAt = retryAfter > 0 ? Date.now() + retryAfter * 1000 : reset > 0 ? reset * 1000 : undefined;
    return new GitHubError("rate-limit", rateLimitMessage(resetAt), status, resetAt);
  }
  if (status === 401) return new GitHubError("unauthorized", "GitHub rejected this token. It may be mistyped, revoked or expired.", status);
  if (status === 403) {
    return new GitHubError(
      "forbidden",
      `This token is not allowed to do that (${apiMessage || "forbidden"}). Check it has Contents: read and write on ${REPO}.`,
      status,
    );
  }
  if (status === 404) return new GitHubError("not-found", "GitHub could not find that, or this token cannot see it.", status);
  if (status === 409 || status === 422) return new GitHubError("invalid", apiMessage || "GitHub refused the request.", status);
  return new GitHubError("server", `GitHub returned an error (${status}). Try again shortly.`, status);
}

export class GitHubClient {
  #token: string;
  #onUnauthorized: () => void;

  constructor(token: string, onUnauthorized: () => void = () => {}) {
    this.#token = token;
    this.#onUnauthorized = onUnauthorized;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        // GitHub sends max-age=60 on GETs. A cached ref would defeat conflict detection.
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${this.#token}`,
          "X-GitHub-Api-Version": "2022-11-28",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new GitHubError(
        "offline",
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "You appear to be offline. Reconnect and try again. Your draft is safe."
          : "Could not reach GitHub. Check your connection and try again. Your draft is safe.",
      );
    }
    if (res.status === 204) return undefined as T;
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* some errors have no JSON body */
    }
    if (!res.ok) {
      const err = toGitHubError(res.status, res.headers, typeof data?.message === "string" ? data.message : "");
      if (err.kind === "unauthorized") this.#onUnauthorized();
      throw err;
    }
    return data as T;
  }

  /* ---------- auth ---------- */

  /** Confirms the token belongs to the owner and can push. Throws GitHubError with a precise message. */
  async verify(): Promise<{ login: string; name: string }> {
    const user = await this.request<{ login: string; name?: string | null }>("GET", "/user");
    let repo: { permissions?: { push?: boolean }; owner?: { login?: string } };
    try {
      repo = await this.request("GET", REPO_PATH);
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "not-found") {
        throw new GitHubError("not-found", `This token cannot see ${OWNER}/${REPO}. When creating it, choose "Only select repositories" and pick that repository.`, 404);
      }
      throw e;
    }
    const owner = repo.owner?.login ?? OWNER;
    if (user.login.toLowerCase() !== owner.toLowerCase()) {
      throw new GitHubError("forbidden", `This token belongs to ${user.login}, but only the repository owner (${owner}) can use this admin panel.`, 403);
    }
    if (!repo.permissions?.push) {
      throw new GitHubError("forbidden", `This token cannot write to ${REPO}. Set Repository permissions > Contents to "Read and write".`, 403);
    }
    return { login: user.login, name: user.name || user.login };
  }

  /* ---------- reading ---------- */

  async headSha(): Promise<string> {
    const ref = await this.request<{ object: { sha: string } }>("GET", `${REPO_PATH}/git/ref/heads/${BRANCH}`);
    return ref.object.sha;
  }

  async commit(sha: string): Promise<CommitInfo & { treeSha: string }> {
    const c = await this.request<any>("GET", `${REPO_PATH}/git/commits/${sha}`);
    return {
      sha: c.sha,
      treeSha: c.tree.sha,
      message: c.message,
      date: c.author?.date ?? c.committer?.date ?? "",
      author: c.author?.name ?? "",
      url: c.html_url ?? "",
    };
  }

  async tree(treeSha: string): Promise<{ path: string; type: string; size?: number; sha: string }[]> {
    const t = await this.request<{ tree: any[] }>("GET", `${REPO_PATH}/git/trees/${treeSha}?recursive=1`);
    return t.tree;
  }

  async blobText(sha: string): Promise<string> {
    const b = await this.request<{ content: string }>("GET", `${REPO_PATH}/git/blobs/${sha}`);
    return base64ToText(b.content);
  }

  /** Everything the admin needs about main, pinned to one commit. */
  async snapshot(sha?: string): Promise<RemoteSnapshot> {
    const head = sha ?? (await this.headSha());
    const { treeSha, ...commit } = await this.commit(head);
    const tree = await this.tree(treeSha);
    const contentEntry = tree.find((e) => e.path === CONTENT_PATH);
    const files = tree
      .filter((e) => e.type === "blob" && (e.path.startsWith(`${UPLOADS_DIR}/`) || e.path.startsWith(`${RESUME_DIR}/`)))
      .map((e) => ({ path: e.path, size: e.size ?? 0, sha: e.sha }));
    return { commit, treeSha, files, rawText: contentEntry ? await this.blobText(contentEntry.sha) : null };
  }

  async recentCommits(opts: { path?: string; perPage?: number } = {}): Promise<CommitInfo[]> {
    const q = new URLSearchParams({ sha: BRANCH, per_page: String(opts.perPage ?? 10) });
    if (opts.path) q.set("path", opts.path);
    const list = await this.request<any[]>("GET", `${REPO_PATH}/commits?${q}`);
    return list.map((c) => ({
      sha: c.sha,
      message: c.commit?.message ?? "",
      date: c.commit?.author?.date ?? c.commit?.committer?.date ?? "",
      author: c.commit?.author?.name ?? "",
      url: c.html_url ?? "",
    }));
  }

  async contentAt(sha: string): Promise<string> {
    const f = await this.request<{ content?: string; encoding?: string; sha: string }>(
      "GET",
      `${REPO_PATH}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(sha)}`,
    );
    // Over 1 MB the contents API leaves content empty; the blob API has no such limit.
    return f.content ? base64ToText(f.content) : this.blobText(f.sha);
  }

  /** Public repositories of the owner, most recently updated first. */
  async listRepos(): Promise<RepoSummary[]> {
    const all: RepoSummary[] = [];
    for (let page = 1; page <= 5; page++) {
      const batch = await this.request<RepoSummary[]>("GET", `/users/${OWNER}/repos?type=owner&sort=updated&per_page=100&page=${page}`);
      all.push(...batch);
      if (batch.length < 100) break;
    }
    return all;
  }

  async runsFor(sha: string): Promise<WorkflowRun[]> {
    const r = await this.request<{ workflow_runs: WorkflowRun[] }>("GET", `${REPO_PATH}/actions/runs?head_sha=${encodeURIComponent(sha)}&per_page=10`);
    return r.workflow_runs ?? [];
  }

  /* ---------- writing ---------- */

  async #createBlob(base64: string): Promise<string> {
    const b = await this.request<{ sha: string }>("POST", `${REPO_PATH}/git/blobs`, { content: base64, encoding: "base64" });
    return b.sha;
  }

  /**
   * One atomic commit: blobs, tree, commit, then a non-force ref update.
   * Nothing is visible on main until the last call, so a failure part-way changes nothing.
   */
  async publish(plan: PublishPlan, onStep: (s: PublishStep, detail?: string) => void = () => {}): Promise<{ sha: string; treeSha: string }> {
    onStep("checking");
    const head = await this.headSha();
    if (head !== plan.baseCommitSha) throw new GitHubError("conflict", "main has moved since this draft was started.", 0, undefined, head);
    const base = await this.commit(plan.baseCommitSha);
    const existing = new Set((await this.tree(base.treeSha)).map((e) => e.path));

    onStep("uploading", `${plan.uploads.length + 1} file${plan.uploads.length ? "s" : ""}`);
    const entries: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];
    entries.push({ path: CONTENT_PATH, mode: "100644", type: "blob", sha: await this.#createBlob(textToBase64(plan.contentJson)) });
    for (const u of plan.uploads) {
      const bytes = new Uint8Array(await u.blob.arrayBuffer());
      entries.push({ path: u.path, mode: "100644", type: "blob", sha: await this.#createBlob(bytesToBase64(bytes)) });
    }
    // sha:null deletes. GitHub rejects the whole tree if the path does not exist.
    for (const path of plan.deletions) {
      if (existing.has(path)) entries.push({ path, mode: "100644", type: "blob", sha: null });
    }

    onStep("tree");
    const tree = await this.request<{ sha: string }>("POST", `${REPO_PATH}/git/trees`, { base_tree: base.treeSha, tree: entries });

    onStep("commit");
    const commit = await this.request<{ sha: string }>("POST", `${REPO_PATH}/git/commits`, {
      message: plan.message,
      tree: tree.sha,
      parents: [plan.baseCommitSha],
    });

    onStep("ref");
    try {
      await this.request("PATCH", `${REPO_PATH}/git/refs/heads/${BRANCH}`, { sha: commit.sha, force: false });
    } catch (e) {
      // 422 "Update is not a fast forward": main moved between our check and this call.
      if (e instanceof GitHubError && e.kind === "invalid") {
        throw new GitHubError("conflict", "main moved while publishing.", e.status);
      }
      throw e;
    }
    return { sha: commit.sha, treeSha: tree.sha };
  }
}
