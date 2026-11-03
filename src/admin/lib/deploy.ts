/** Interprets GitHub Actions runs for a commit. Pure. */
import { WORKFLOW_PATH } from "../config";

export interface WorkflowRun {
  id: number;
  name?: string | null;
  path?: string;
  event?: string;
  status: string | null;
  conclusion: string | null;
  html_url: string;
  head_sha: string;
  created_at?: string;
}

export type DeployPhase = "idle" | "waiting" | "queued" | "building" | "success" | "failure" | "superseded" | "unavailable" | "timeout";

export interface DeployView {
  phase: DeployPhase;
  sha?: string;
  url?: string;
  startedAt?: number;
}

export function interpretRuns(runs: WorkflowRun[]): { phase: DeployPhase; url?: string } {
  const run = runs.find((r) => r.path === WORKFLOW_PATH) ?? runs.find((r) => r.event === "push");
  if (!run) return { phase: "waiting" };
  const url = run.html_url;
  if (run.status === "completed") {
    if (run.conclusion === "success") return { phase: "success", url };
    if (run.conclusion === "cancelled") return { phase: "superseded", url };
    return { phase: "failure", url };
  }
  if (run.status === "in_progress") return { phase: "building", url };
  return { phase: "queued", url };
}

export const isFinalPhase = (p: DeployPhase) => ["success", "failure", "superseded", "unavailable", "timeout", "idle"].includes(p);

/** Frequent at first when something is about to change, then back off. */
export function pollDelay(elapsedMs: number): number {
  if (elapsedMs < 60_000) return 5_000;
  if (elapsedMs < 300_000) return 10_000;
  return 20_000;
}

export const POLL_TIMEOUT_MS = 10 * 60_000;
