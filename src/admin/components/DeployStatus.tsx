import { ACTIONS_URL, LIVE_URL } from "../config";
import type { DeployPhase } from "../lib/deploy";
import { useStore } from "../store";
import { ExtLink, Icon, Spinner } from "./ui";

const COPY: Record<DeployPhase, { title: string; body: string; tone: "busy" | "ok" | "bad" | "muted" }> = {
  idle: { title: "No deployment recorded for this commit", body: "The site deploys automatically whenever main changes.", tone: "muted" },
  waiting: { title: "Waiting for GitHub Actions", body: "A new deployment usually starts within a few seconds.", tone: "busy" },
  queued: { title: "Deployment queued", body: "GitHub is about to build the site.", tone: "busy" },
  building: { title: "Building and deploying", body: "This usually takes 1 to 2 minutes. You can keep working.", tone: "busy" },
  success: { title: "Deployed", body: "This commit is live. A hard refresh may be needed to see it.", tone: "ok" },
  failure: { title: "Deployment failed", body: "The previous version of the site stays live. Check the run log for the reason.", tone: "bad" },
  superseded: { title: "Replaced by a newer deployment", body: "A later commit started deploying, so this one was cancelled.", tone: "muted" },
  unavailable: { title: "Status not available", body: "This token does not have Actions: read, so progress cannot be shown. Your commit was saved, and the site normally updates within 1 to 2 minutes.", tone: "muted" },
  timeout: { title: "This is taking longer than usual", body: "Automatic checking has stopped. See the Actions tab for the current state.", tone: "muted" },
};

export function DeployStatus() {
  const deploy = useStore((s) => s.deploy);
  const c = COPY[deploy.phase];
  const icon = { busy: <Spinner size={18} />, ok: <Icon name="check" className="text-accent" />, bad: <Icon name="alert" className="text-danger" />, muted: <Icon name="info" className="text-ink-3" /> }[c.tone];
  return (
    <div role="status" className="flex items-start gap-3" data-testid="deploy-status" data-phase={deploy.phase}>
      <span className="mt-0.5 text-ink-2">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{c.title}</p>
        <p className="mt-0.5 text-sm text-ink-2">{c.body}</p>
        <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {deploy.phase === "success" && <ExtLink href={LIVE_URL}>Open live site</ExtLink>}
          <ExtLink href={deploy.url ?? ACTIONS_URL}>{deploy.url ? "View run" : "Actions tab"}</ExtLink>
        </p>
      </div>
    </div>
  );
}
