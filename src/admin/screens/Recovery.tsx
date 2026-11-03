/** Shown when content on GitHub cannot be used: invalid, missing, or failed to load. */
import { useState } from "react";
import { contentSchema } from "../../lib/schema";
import { CONTENT_PATH, REPO_URL } from "../config";
import { zodIssues, type Issue } from "../lib/content";
import { loadRemote, replaceDraft, signOut, toast, useStore } from "../store";
import { Button, Card, ExtLink, Note, ThemeToggle } from "../components/ui";
import { downloadText } from "./Backup";

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-2">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">{title}</h1>
        <ThemeToggle />
      </div>
      {children}
      <div className="mt-6"><Button variant="ghost" icon="logout" onClick={() => signOut()}>Sign out</Button></div>
    </main>
  );
}

export function LoadError() {
  const error = useStore((s) => s.loadError);
  return (
    <Frame title="Could not load your content">
      <Note kind="error">{error}</Note>
      <div className="mt-4"><Button variant="primary" onClick={() => void loadRemote()}>Try again</Button></div>
    </Frame>
  );
}

export function MissingContent() {
  return (
    <Frame title="No content on main yet">
      <Note kind="warning">
        <code className="font-mono text-xs">{CONTENT_PATH}</code> does not exist on the main branch. Push this project to <ExtLink href={REPO_URL}>the repository</ExtLink> first, then come back and try again.
      </Note>
      <div className="mt-4"><Button variant="primary" onClick={() => void loadRemote()}>Check again</Button></div>
    </Frame>
  );
}

export function InvalidContent() {
  const base = useStore((s) => s.base);
  const problems = useStore((s) => s.invalidProblems);
  const [raw, setRaw] = useState(base?.rawText ?? "");
  const [result, setResult] = useState<Issue[] | string | null>(null);

  const check = () => {
    try {
      const parsed = JSON.parse(raw);
      const issues = zodIssues(parsed);
      setResult(issues.length ? issues : []);
      return issues.length ? null : contentSchema.parse(parsed);
    } catch (e) {
      setResult(`Not valid JSON: ${e instanceof Error ? e.message : ""}`);
      return null;
    }
  };

  const shown = result ?? problems;
  return (
    <Frame title="Your content needs repair">
      <Note kind="error">
        The <code className="font-mono text-xs">content.json</code> on main does not pass validation, so the editor cannot open it. The live site's next build would fail too. Fix the JSON below and load it into a draft.
      </Note>
      <Card title="Problems" className="mt-4">
        {typeof shown === "string" ? (
          <p className="text-sm text-danger" data-testid="recovery-problems">{shown}</p>
        ) : shown && shown.length ? (
          <ul className="flex flex-col gap-1.5 text-sm" data-testid="recovery-problems">
            {shown.slice(0, 50).map((p, i) => (
              <li key={`${p.path}-${i}`}>
                <code className="break-all font-mono text-xs text-ink">{p.path || "(root)"}</code>
                <span className="block text-xs text-danger">{p.message}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Note kind="success">No problems found. You can load this into the draft.</Note>
        )}
      </Card>
      <Card title="Raw JSON" className="mt-4">
        <label htmlFor="raw-json" className="sr-only">Raw content JSON</label>
        <textarea id="raw-json" value={raw} spellCheck={false} onChange={(e) => { setRaw(e.target.value); setResult(null); }} rows={16} className="block w-full rounded-lg border border-line bg-bg p-3 font-mono text-xs leading-relaxed text-ink" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => check()}>Validate</Button>
          <Button
            variant="primary"
            data-testid="recovery-load"
            onClick={() => {
              const content = check();
              if (content) {
                replaceDraft(content);
                toast("success", "Loaded into your draft. Review it, then publish to repair main.");
              }
            }}
          >
            Load into draft
          </Button>
          <Button icon="download" onClick={() => downloadText("content-recovery.json", raw)}>Download</Button>
        </div>
      </Card>
    </Frame>
  );
}
