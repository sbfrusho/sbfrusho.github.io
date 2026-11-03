/** Application state: session, remote base, draft, staged files and the publish workflow. */
import { useSyncExternalStore } from "react";
import { contentSchema, type Content } from "../lib/schema";
import { clearToken, loadToken, saveToken } from "./auth";
import { BRANCH, OWNER, REPO, REPO_URL } from "./config";
import { GitHubClient, GitHubError, type CommitInfo, type PublishStep, type RemoteFile, type RemoteSnapshot } from "./github";
import {
  applyMerge,
  assetRefs,
  changedAreas,
  commitMessage,
  diffContent,
  missingAssetIssues,
  planMerge,
  serializeContent,
  toPublicPath,
  toRepoPath,
  unknownKeys,
  zodIssues,
  type AreaKey,
  type Issue,
  type MergeRow,
} from "./lib/content";
import { interpretRuns, isFinalPhase, pollDelay, POLL_TIMEOUT_MS, type DeployView } from "./lib/deploy";
import { getIn, setIn } from "./lib/paths";
import { clearSavedDraft, idbDelete, idbGet, idbPut, readSavedDraft, writeSavedDraft, type SavedDraft } from "./persist";

export interface Upload {
  path: string;
  publicPath: string;
  blob: Blob;
  type: string;
  size: number;
  label: string;
  url: string;
}

export interface Base {
  commit: CommitInfo;
  content: Content | null;
  rawText: string | null;
  files: RemoteFile[];
}

export interface Conflict {
  snapshot: RemoteSnapshot;
  theirs: Content | null;
  plan: MergeRow[];
  problem?: string;
}

export interface Toast {
  id: number;
  kind: "success" | "error" | "info" | "warning";
  message: string;
}

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  prompt?: { label: string; initial?: string; required?: boolean };
  resolve: (value: string | boolean | null) => void;
}

export type Phase = "boot" | "signed-out" | "verifying" | "loading" | "ready" | "invalid" | "missing" | "load-error";

export interface State {
  phase: Phase;
  user: { login: string; name: string } | null;
  remembered: boolean;
  signInError: string | null;
  /** The session ended mid-way: the draft is kept in memory and shown again after sign-in. */
  expired: boolean;
  /** A saved token exists but could not be verified (offline, rate limit). */
  canRetrySavedToken: boolean;
  loadError: string | null;
  invalidProblems: Issue[] | string | null;
  base: Base | null;
  draft: Content | null;
  uploads: Upload[];
  deletions: string[];
  showAllErrors: boolean;
  savedAt: number | null;
  storageWarning: string | null;
  droppedKeys: string[];
  restoreOffer: SavedDraft | null;
  conflict: Conflict | null;
  deploy: DeployView;
  /** Bumps after publish so screens refetch commit lists. */
  revision: number;
  toasts: Toast[];
  announcement: string;
  confirm: ConfirmRequest | null;
}

let state: State = {
  phase: "boot",
  user: null,
  remembered: false,
  signInError: null,
  expired: false,
  canRetrySavedToken: false,
  loadError: null,
  invalidProblems: null,
  base: null,
  draft: null,
  uploads: [],
  deletions: [],
  showAllErrors: false,
  savedAt: null,
  storageWarning: null,
  droppedKeys: [],
  restoreOffer: null,
  conflict: null,
  deploy: { phase: "idle" },
  revision: 0,
  toasts: [],
  announcement: "",
  confirm: null,
};

const listeners = new Set<() => void>();
function setState(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const getState = () => state;
export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state));
}

/* ---------- derived ---------- */

let issuesMemo: { key: unknown[]; value: Issue[] } = { key: [], value: [] };

export function availableAssets(s: State): Set<string> | null {
  if (!s.base) return null;
  const set = new Set(s.base.files.filter((f) => !s.deletions.includes(f.path)).map((f) => toPublicPath(f.path)));
  for (const u of s.uploads) set.add(u.publicPath);
  return set;
}

export function selectIssues(s: State): Issue[] {
  const key = [s.draft, s.base?.files, s.uploads, s.deletions];
  if (key.every((k, i) => k === issuesMemo.key[i])) return issuesMemo.value;
  let value: Issue[] = [];
  if (s.draft) {
    value = zodIssues(s.draft);
    const available = availableAssets(s);
    if (available) {
      const seen = new Set(value.map((i) => i.path));
      value = [...value, ...missingAssetIssues(s.draft, available).filter((i) => !seen.has(i.path))];
    }
  }
  issuesMemo = { key, value };
  return value;
}

let areasMemo: { draft: unknown; base: unknown; value: AreaKey[] } = { draft: undefined, base: undefined, value: [] };
export function selectChangedAreas(s: State): AreaKey[] {
  const baseContent = s.base?.content ?? null;
  if (areasMemo.draft === s.draft && areasMemo.base === baseContent) return areasMemo.value;
  areasMemo = { draft: s.draft, base: baseContent, value: changedAreas(baseContent, s.draft) };
  return areasMemo.value;
}

/** Staged files still referenced. A staged file nothing points to never reaches the commit. */
export function effectiveUploads(s: State): Upload[] {
  if (!s.draft) return [];
  const used = new Set(assetRefs(s.draft).map((r) => r.file));
  return s.uploads.filter((u) => used.has(u.publicPath));
}

export function selectChangeCount(s: State): number {
  return selectChangedAreas(s).length + (s.deletions.length > 0 ? 1 : 0);
}
export const selectDirty = (s: State) => selectChangeCount(s) > 0;

/* ---------- toasts, announcements, dialogs ---------- */

let toastId = 0;
export function toast(kind: Toast["kind"], message: string) {
  const id = ++toastId;
  setState({ toasts: [...state.toasts, { id, kind, message }] });
  window.setTimeout(() => dismissToast(id), kind === "error" ? 9000 : 4500);
}
export function dismissToast(id: number) {
  setState({ toasts: state.toasts.filter((t) => t.id !== id) });
}
export function announce(message: string) {
  setState({ announcement: message });
}

export function confirmDialog(opts: Omit<ConfirmRequest, "resolve" | "prompt">): Promise<boolean> {
  return new Promise((resolve) => setState({ confirm: { ...opts, resolve: (v) => resolve(v === true) } }));
}
export function promptDialog(opts: Omit<ConfirmRequest, "resolve">): Promise<string | null> {
  return new Promise((resolve) => setState({ confirm: { ...opts, resolve: (v) => resolve(typeof v === "string" ? v : null) } }));
}
export function closeConfirm(value: string | boolean | null) {
  const c = state.confirm;
  setState({ confirm: null });
  c?.resolve(value);
}

/* ---------- autosave ---------- */

let persistTimer: number | undefined;
let hasPersisted = false;
const inIdb = new Set<string>();

function persistNow() {
  window.clearTimeout(persistTimer);
  persistTimer = undefined;
  const s = state;
  if (!s.draft || !s.base || !s.user || s.phase === "boot") return;
  if (!selectDirty(s)) {
    if (hasPersisted) {
      clearSavedDraft();
      inIdb.clear();
      hasPersisted = false;
      setState({ savedAt: null });
    }
    return;
  }
  const uploads = s.uploads.map(({ path, publicPath, type, size, label }) => ({ path, publicPath, type, size, label }));
  const ok = writeSavedDraft({
    v: 1,
    login: s.user.login,
    savedAt: Date.now(),
    baseCommitSha: s.base.commit.sha,
    baseContent: s.base.content,
    draft: s.draft,
    deletions: s.deletions,
    uploads,
  });
  hasPersisted = ok;
  if (!ok) {
    setState({ storageWarning: "This browser refused to save your draft. Keep this tab open, or export a backup." });
    return;
  }
  setState({ savedAt: Date.now(), storageWarning: state.storageWarning?.startsWith("This browser refused") ? null : state.storageWarning });
  for (const u of s.uploads) {
    if (inIdb.has(u.path)) continue;
    inIdb.add(u.path);
    void idbPut(u.path, u.blob).then((stored) => {
      if (!stored) {
        inIdb.delete(u.path);
        setState({ storageWarning: `Uploaded files could not be saved on this device. If you close this tab before publishing you will need to upload ${u.label} again.` });
      }
    });
  }
}

function schedulePersist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(persistNow, 400);
}

export function flushDraft() {
  if (persistTimer !== undefined) persistNow();
}

/* ---------- editing ---------- */

export function setAt(path: string, value: unknown) {
  if (!state.draft) return;
  setState({ draft: setIn(state.draft, path, value) });
  schedulePersist();
}

export function mutateDraft(fn: (c: Content) => Content) {
  if (!state.draft) return;
  setState({ draft: fn(state.draft) });
  schedulePersist();
}

export const getAt = (path: string) => getIn(state.draft, path);

/** Used by history restore, backup import and raw JSON recovery. Never goes straight to live. */
export function replaceDraft(content: Content) {
  setState({ draft: content, phase: "ready", showAllErrors: false });
  schedulePersist();
}

export function showAllErrors() {
  setState({ showAllErrors: true });
}

/* ---------- staged files ---------- */

const previews = new Map<string, string>();

export function stageUpload(input: { publicPath: string; blob: Blob; type: string; label: string }) {
  const url = URL.createObjectURL(input.blob);
  previews.set(input.publicPath, url);
  const upload: Upload = { ...input, path: toRepoPath(input.publicPath), size: input.blob.size, url };
  setState({ uploads: [...state.uploads.filter((u) => u.publicPath !== input.publicPath), upload] });
  schedulePersist();
}

/** Removes a file staged in this draft, so it can never reach a commit. No-op for files on GitHub. */
export function unstageUpload(publicPath: string) {
  const upload = state.uploads.find((u) => u.publicPath === publicPath);
  if (!upload) return;
  URL.revokeObjectURL(upload.url);
  previews.delete(publicPath);
  inIdb.delete(upload.path);
  void idbDelete(upload.path);
  setState({ uploads: state.uploads.filter((u) => u !== upload) });
  schedulePersist();
}

/** After a field stops pointing at a staged file, drop it if nothing else uses it. */
export function dropIfUnreferenced(publicPath: string) {
  if (!publicPath || !state.draft) return;
  if (!assetRefs(state.draft).some((r) => r.file === publicPath)) unstageUpload(publicPath);
}

export function isInUse(publicPath: string): boolean {
  return !!state.draft && assetRefs(state.draft).some((r) => r.file === publicPath);
}

/** Refuses in-use files. Returns false when refused. */
export function stageDeletion(repoPath: string): boolean {
  if (isInUse(toPublicPath(repoPath))) return false;
  if (!state.deletions.includes(repoPath)) setState({ deletions: [...state.deletions, repoPath] });
  schedulePersist();
  return true;
}

export function undoDeletion(repoPath: string) {
  setState({ deletions: state.deletions.filter((p) => p !== repoPath) });
  schedulePersist();
}

/** Preview URL for any asset: local blob while staged, otherwise the raw file at the base commit. */
export function assetUrl(publicPath: string): string {
  const local = previews.get(publicPath);
  if (local) return local;
  const ref = state.base?.commit.sha ?? BRANCH;
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${ref}/${toRepoPath(publicPath)}`;
}

/* ---------- session ---------- */

let client: GitHubClient | null = null;

export function api(): GitHubClient {
  if (!client) throw new GitHubError("unauthorized", "Not signed in.");
  return client;
}

function onUnauthorized() {
  stopDeployTracking();
  flushDraft();
  clearToken();
  client = null;
  setState({
    phase: "signed-out",
    expired: true,
    remembered: false,
    canRetrySavedToken: false,
    signInError: "Your token has expired or been revoked. Sign in with a new one to continue. Your unsaved work is still here.",
  });
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

export async function boot() {
  const saved = loadToken();
  if (!saved) return setState({ phase: "signed-out" });
  await signIn(saved.token, saved.remembered, true);
}

export async function retrySavedToken() {
  const saved = loadToken();
  if (saved) await signIn(saved.token, saved.remembered, true);
}

export async function signIn(rawToken: string, remember: boolean, fromSaved = false) {
  const token = rawToken.trim();
  setState({ phase: "verifying", signInError: null, canRetrySavedToken: false });
  const candidate = new GitHubClient(token);
  let user: { login: string; name: string };
  try {
    user = await candidate.verify();
  } catch (e) {
    const err = e instanceof GitHubError ? e : null;
    const transient = err?.kind === "offline" || err?.kind === "rate-limit" || err?.kind === "server";
    // A saved token that is simply wrong now gets forgotten; a network blip must not sign the owner out.
    if (fromSaved && !transient) clearToken();
    setState({
      phase: "signed-out",
      canRetrySavedToken: fromSaved && transient,
      signInError: fromSaved && err?.kind === "unauthorized"
        ? "Your saved token has expired or been revoked. Sign in with a new one."
        : messageOf(e),
    });
    return;
  }
  saveToken(token, remember);
  client = new GitHubClient(token, onUnauthorized);
  const resuming = state.draft && state.user?.login === user.login && state.expired;
  setState({ user, remembered: remember, expired: false, signInError: null });
  if (resuming) {
    setState({ phase: "ready" });
    toast("success", "Signed in again. Your draft is intact.");
    if (state.base) trackDeploy(state.base.commit.sha, true);
    return;
  }
  await loadRemote();
}

function resetSession(patch: Partial<State>) {
  stopDeployTracking();
  for (const u of state.uploads) URL.revokeObjectURL(u.url);
  previews.clear();
  inIdb.clear();
  hasPersisted = false;
  client = null;
  setState({
    user: null,
    base: null,
    draft: null,
    uploads: [],
    deletions: [],
    showAllErrors: false,
    savedAt: null,
    droppedKeys: [],
    restoreOffer: null,
    conflict: null,
    expired: false,
    deploy: { phase: "idle" },
    loadError: null,
    invalidProblems: null,
    ...patch,
  });
}

/** Clears the token. The draft autosave stays unless the owner chooses to discard it. */
export function signOut(discardDraft = false) {
  flushDraft();
  clearToken();
  if (discardDraft) clearSavedDraft();
  resetSession({ phase: "signed-out", signInError: null, canRetrySavedToken: false, remembered: false });
}

function parseRemote(rawText: string): { content: Content | null; problems: Issue[] | string | null; dropped: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(rawText);
  } catch (e) {
    return { content: null, problems: `The file is not valid JSON: ${messageOf(e)}`, dropped: [] };
  }
  const parsed = contentSchema.safeParse(raw);
  if (!parsed.success) return { content: null, problems: zodIssues(raw), dropped: [] };
  return { content: parsed.data, problems: null, dropped: unknownKeys(raw, parsed.data) };
}

export async function loadRemote() {
  setState({ phase: "loading", loadError: null });
  try {
    const snap = await api().snapshot();
    if (snap.rawText === null) {
      setState({ phase: "missing", base: { commit: snap.commit, content: null, rawText: null, files: snap.files } });
      return;
    }
    const { content, problems, dropped } = parseRemote(snap.rawText);
    const base: Base = { commit: snap.commit, content, rawText: snap.rawText, files: snap.files };
    if (!content) {
      setState({ phase: "invalid", base, invalidProblems: problems, draft: null });
      return;
    }
    const saved = readSavedDraft();
    const offer = saved && saved.login === state.user?.login ? saved : null;
    setState({ phase: "ready", base, draft: content, droppedKeys: dropped, restoreOffer: offer, invalidProblems: null, uploads: [], deletions: [] });
    hasPersisted = !!offer;
    trackDeploy(snap.commit.sha, true);
  } catch (e) {
    if (state.phase === "signed-out") return;
    setState({ phase: "load-error", loadError: messageOf(e) });
  }
}

/* ---------- restore a saved draft ---------- */

export async function acceptRestore() {
  const saved = state.restoreOffer;
  const base = state.base;
  if (!saved || !base) return;
  setState({ restoreOffer: null });

  const uploads: Upload[] = [];
  const lost: string[] = [];
  for (const m of saved.uploads) {
    const blob = await idbGet(m.path);
    if (blob) {
      const url = URL.createObjectURL(blob);
      previews.set(m.publicPath, url);
      inIdb.add(m.path);
      uploads.push({ ...m, blob, url });
    } else {
      lost.push(m.label);
    }
  }
  if (lost.length) toast("warning", `Could not recover ${lost.length} uploaded file${lost.length > 1 ? "s" : ""}: ${lost.join(", ")}. Upload ${lost.length > 1 ? "them" : "it"} again.`);

  const deletions = saved.deletions.filter((p) => base.files.some((f) => f.path === p));
  if (saved.baseCommitSha === base.commit.sha) {
    setState({ draft: saved.draft, uploads, deletions });
    toast("success", "Draft restored.");
    return;
  }
  // main moved while away. Keep the old base, so the normal conflict flow can compare properly.
  setState({
    draft: saved.draft,
    uploads,
    deletions,
    base: { ...base, content: saved.baseContent, commit: { ...base.commit, sha: saved.baseCommitSha } },
  });
  await openConflict();
}

export function declineRestore() {
  clearSavedDraft();
  inIdb.clear();
  hasPersisted = false;
  setState({ restoreOffer: null });
}

export function discardChanges() {
  const base = state.base;
  for (const u of state.uploads) {
    URL.revokeObjectURL(u.url);
    previews.delete(u.publicPath);
  }
  clearSavedDraft();
  inIdb.clear();
  hasPersisted = false;
  setState({
    draft: base?.content ?? null,
    phase: base?.content ? "ready" : "invalid",
    uploads: [],
    deletions: [],
    showAllErrors: false,
    savedAt: null,
  });
}

/* ---------- conflict ---------- */

export async function openConflict() {
  const s = state;
  if (!s.draft || !s.base) return;
  try {
    const snapshot = await api().snapshot();
    const { content, problems } = snapshot.rawText === null ? { content: null, problems: "content.json no longer exists on main." } : parseRemote(snapshot.rawText);
    setState({
      conflict: {
        snapshot,
        theirs: content,
        plan: content ? planMerge(s.base.content, s.draft, content) : [],
        problem: content ? undefined : typeof problems === "string" ? problems : "The version on GitHub does not pass validation.",
      },
    });
  } catch (e) {
    if (state.phase !== "signed-out") toast("error", messageOf(e));
  }
}

export function closeConflict() {
  setState({ conflict: null });
}

export function resolveConflict(takeTheirs: AreaKey[]) {
  const c = state.conflict;
  if (!c?.theirs || !state.draft) return;
  const merged = applyMerge(c.plan, state.draft, c.theirs, takeTheirs);
  const paths = new Set(c.snapshot.files.map((f) => f.path));
  setState({
    conflict: null,
    draft: merged,
    base: { commit: c.snapshot.commit, content: c.theirs, rawText: c.snapshot.rawText, files: c.snapshot.files },
    deletions: state.deletions.filter((p) => paths.has(p)),
  });
  schedulePersist();
  toast("success", "Reloaded from GitHub and reapplied your changes. Review, then publish.");
  announce("Draft reapplied on the latest version.");
}

/* ---------- publish ---------- */

export function buildCommitMessage(): string {
  const s = state;
  if (!s.draft || !s.base) return "";
  return commitMessage(diffContent(s.base.content, s.draft), effectiveUploads(s).map((u) => u.path), s.deletions);
}

export async function publish(message: string, onStep: (s: PublishStep, detail?: string) => void): Promise<{ sha: string }> {
  const s = state;
  if (!s.draft || !s.base) throw new Error("Nothing to publish.");
  const parsed = contentSchema.safeParse(s.draft);
  if (!parsed.success || selectIssues(s).length) throw new Error("Fix the highlighted fields first.");
  const inUseDeletion = s.deletions.find((p) => isInUse(toPublicPath(p)));
  if (inUseDeletion) throw new Error(`${inUseDeletion} is marked for removal but is still in use.`);

  const uploads = effectiveUploads(s);
  const contentJson = serializeContent(parsed.data);
  let result: { sha: string; treeSha: string };
  try {
    result = await api().publish(
      {
        baseCommitSha: s.base.commit.sha,
        contentJson,
        uploads: uploads.map((u) => ({ path: u.path, blob: u.blob })),
        deletions: s.deletions,
        message,
      },
      onStep,
    );
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "conflict") await openConflict();
    throw e;
  }

  const removed = new Set(s.deletions);
  const added = uploads.map((u) => ({ path: u.path, size: u.size, sha: "" }));
  const files = [...s.base.files.filter((f) => !removed.has(f.path) && !added.some((a) => a.path === f.path)), ...added];
  clearSavedDraft();
  inIdb.clear();
  hasPersisted = false;
  setState({
    base: {
      commit: { sha: result.sha, message, date: new Date().toISOString(), author: s.user?.name ?? "", url: `${REPO_URL}/commit/${result.sha}` },
      content: parsed.data,
      rawText: contentJson,
      files,
    },
    draft: parsed.data,
    uploads: [],
    deletions: [],
    showAllErrors: false,
    savedAt: null,
    revision: state.revision + 1,
  });
  trackDeploy(result.sha);
  return { sha: result.sha };
}


/* ---------- deployment tracking ---------- */

let deployRun = 0;
let deployTimer: number | undefined;

function stopDeployTracking() {
  deployRun++;
  window.clearTimeout(deployTimer);
}

/** `passive` is for commits not just published here: no run is normal, so it does not wait for one. */
export function trackDeploy(sha: string, passive = false) {
  stopDeployTracking();
  const run = deployRun;
  const startedAt = Date.now();
  setState({ deploy: { phase: passive ? "idle" : "waiting", sha, startedAt } });

  const tick = async () => {
    if (run !== deployRun || !client) return;
    const elapsed = Date.now() - startedAt;
    try {
      const view = interpretRuns(await client.runsFor(sha));
      if (run !== deployRun) return;
      const phase = passive && view.phase === "waiting" ? "idle" : view.phase;
      setState({ deploy: { phase, sha, url: view.url, startedAt } });
      if (isFinalPhase(phase)) {
        if (!passive && phase === "success") toast("success", "Deployed. Your changes are live.");
        if (!passive && phase === "failure") toast("error", "The deployment failed. The previous version stays live.");
        return;
      }
    } catch (e) {
      if (run !== deployRun) return;
      if (e instanceof GitHubError && (e.kind === "forbidden" || e.kind === "not-found")) {
        setState({ deploy: { phase: "unavailable", sha, startedAt } });
        return;
      }
      if (e instanceof GitHubError && e.kind === "unauthorized") return;
      // Network blips while polling are not worth reporting. The timeout below still ends this.
    }
    if (elapsed > POLL_TIMEOUT_MS) {
      setState({ deploy: { ...state.deploy, phase: "timeout" } });
      return;
    }
    deployTimer = window.setTimeout(tick, pollDelay(elapsed));
  };
  deployTimer = window.setTimeout(tick, passive ? 0 : 3000);
}
