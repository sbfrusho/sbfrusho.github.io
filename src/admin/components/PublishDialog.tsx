import { useEffect, useMemo, useState } from "react";
import { GitHubError, type PublishStep } from "../github";
import { diffContent } from "../lib/content";
import { LIVE_URL, REPO_URL } from "../config";
import { navigate } from "../route";
import { buildCommitMessage, effectiveUploads, getState, publish, selectIssues, showAllErrors, useStore } from "../store";
import { DeployStatus } from "./DeployStatus";
import { Dialog } from "./Dialog";
import { Button, ExtLink, Icon, Note, Spinner } from "./ui";

const STEPS: { key: PublishStep; label: string }[] = [
  { key: "checking", label: "Checking main has not moved" },
  { key: "uploading", label: "Uploading files" },
  { key: "tree", label: "Preparing the change" },
  { key: "commit", label: "Creating the commit" },
  { key: "ref", label: "Updating main" },
];

type Stage = "review" | "working" | "done";

export function PublishDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const issues = useStore(selectIssues);
  const draft = useStore((s) => s.draft);
  const baseContent = useStore((s) => s.base?.content ?? null);
  const uploads = useStore((s) => s.uploads);
  const deletions = useStore((s) => s.deletions);
  const deployPhase = useStore((s) => s.deploy.phase);
  const [stage, setStage] = useState<Stage>("review");
  const [step, setStep] = useState<PublishStep>("checking");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [sha, setSha] = useState("");

  useEffect(() => {
    if (!open) return;
    setStage("review");
    setError(null);
    setMessage(buildCommitMessage());
    showAllErrors();
  }, [open]);

  const changes = useMemo(() => (draft ? diffContent(baseContent, draft) : []), [draft, baseContent]);
  const added = useMemo(() => effectiveUploads(getState()), [uploads, draft]);

  const run = async () => {
    setStage("working");
    setError(null);
    try {
      const r = await publish(message.trim(), (s) => setStep(s));
      setSha(r.sha);
      setStage("done");
    } catch (e) {
      if (e instanceof GitHubError && e.kind === "conflict") {
        onClose();
        return;
      }
      if (e instanceof GitHubError && e.kind === "unauthorized") return;
      setError(e instanceof Error ? e.message : "Publishing failed.");
      setStage("review");
    }
  };

  const stepIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      locked={stage === "working"}
      wide
      title={stage === "done" ? "Published" : "Review and publish"}
      footer={
        stage === "review" ? (
          <>
            <Button variant="ghost" onClick={onClose}>Keep editing</Button>
            <Button variant="primary" icon="upload" disabled={issues.length > 0 || !message.trim()} onClick={run} data-testid="publish-confirm">
              Publish to main
            </Button>
          </>
        ) : stage === "done" ? (
          <Button variant="primary" onClick={onClose}>Done</Button>
        ) : undefined
      }
    >
      {stage === "review" && (
        <div className="flex flex-col gap-4">
          {error && <Note kind="error">{error} Nothing was changed on main, and your draft is safe.</Note>}
          {issues.length > 0 ? (
            <div data-testid="publish-issues">
              <Note kind="error">
                {issues.length === 1 ? "1 field needs" : `${issues.length} fields need`} attention before publishing.
              </Note>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                {issues.map((i) => (
                  <li key={i.path}>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        navigate(i.route, i.path);
                      }}
                      className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2 cursor-pointer"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-ink">{i.where}</span>
                        <span className="block text-xs text-danger">{i.message}</span>
                      </span>
                      <Icon name="arrow" size={14} className="mt-1 text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h3 className="mb-1.5 text-sm font-medium">What changes</h3>
            <ul className="flex flex-col gap-1.5 text-sm" data-testid="publish-changes">
              {changes.map((c) => (
                <li key={c.area} className="rounded-lg bg-surface-2 px-3 py-2">
                  <span className="font-medium text-ink">{c.label}</span>
                  <span className="block text-xs text-ink-2">{c.details.join(" · ")}</span>
                </li>
              ))}
              {added.map((u) => (
                <li key={u.path} className="rounded-lg bg-surface-2 px-3 py-2">
                  <span className="font-medium text-ink">New file</span>
                  <span className="block truncate font-mono text-xs text-ink-2">{u.path}</span>
                </li>
              ))}
              {deletions.map((p) => (
                <li key={p} className="rounded-lg bg-surface-2 px-3 py-2">
                  <span className="font-medium text-ink">File removed</span>
                  <span className="block truncate font-mono text-xs text-ink-2">{p}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label htmlFor="commit-message" className="mb-1.5 block text-sm font-medium">Commit message</label>
            <textarea id="commit-message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="block w-full rounded-lg border border-line bg-bg px-3 py-2 font-mono text-xs leading-relaxed text-ink" />
          </div>
          <p className="text-xs text-ink-2">Saved as a single commit. The site rebuilds automatically and is usually live 1 to 2 minutes later.</p>
        </div>
      )}
      {stage === "working" && (
        <ol className="flex flex-col gap-2.5 py-2" role="status" aria-label="Publish progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`flex items-center gap-2.5 text-sm ${i > stepIndex ? "text-ink-3" : "text-ink"}`}>
              <span className="flex size-5 items-center justify-center">
                {i < stepIndex ? <Icon name="check" size={16} className="text-accent" /> : i === stepIndex ? <Spinner /> : <span className="size-1.5 rounded-full bg-line" />}
              </span>
              {s.label}
            </li>
          ))}
        </ol>
      )}
      {stage === "done" && (
        <div className="flex flex-col gap-4">
          <Note kind="success">
            Your changes are committed to main as <ExtLink href={`${REPO_URL}/commit/${sha}`} className="font-mono">{sha.slice(0, 7)}</ExtLink>
          </Note>
          <DeployStatus />
          {deployPhase !== "success" && <p className="text-sm text-ink-2">The live site at <ExtLink href={LIVE_URL}>sbfrusho.github.io</ExtLink> updates when the deployment finishes, usually 1 to 2 minutes after publishing.</p>}
        </div>
      )}
    </Dialog>
  );
}
