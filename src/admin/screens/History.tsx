import { useEffect, useMemo, useState } from "react";
import { contentSchema, type Content } from "../../lib/schema";
import { Badge, Button, Card, EmptyState, ExtLink, firstLine, Loading, Note, PageHeader, relativeTime } from "../components/ui";
import { CONTENT_PATH } from "../config";
import type { CommitInfo } from "../github";
import { counts, diffContent } from "../lib/content";
import { navigate } from "../route";
import { api, confirmDialog, replaceDraft, selectDirty, toast, useStore } from "../store";

export function History() {
  const revision = useStore((s) => s.revision);
  const draft = useStore((s) => s.draft);
  const dirty = useStore(selectDirty);
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<CommitInfo | null>(null);
  const [version, setVersion] = useState<{ content: Content | null; problem?: string } | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);

  useEffect(() => {
    let live = true;
    setCommits(null);
    setError(null);
    api().recentCommits({ path: CONTENT_PATH, perPage: 30 }).then(
      (c) => live && setCommits(c),
      (e) => live && setError(e instanceof Error ? e.message : "Could not load history."),
    );
    return () => {
      live = false;
    };
  }, [revision]);

  const open = async (c: CommitInfo) => {
    setPicked(c);
    setVersion(null);
    setLoadingVersion(true);
    try {
      const text = await api().contentAt(c.sha);
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        setVersion({ content: null, problem: "This version is not valid JSON." });
        return;
      }
      const parsed = contentSchema.safeParse(raw);
      setVersion(parsed.success ? { content: parsed.data } : { content: null, problem: "This version does not match the current content format, so it cannot be restored automatically." });
    } catch (e) {
      setVersion({ content: null, problem: e instanceof Error ? e.message : "Could not load this version." });
    } finally {
      setLoadingVersion(false);
    }
  };

  const changes = useMemo(() => (version?.content && draft ? diffContent(draft, version.content) : []), [version, draft]);
  const summary = version?.content ? counts(version.content) : null;

  const restore = async () => {
    if (!version?.content || !picked) return;
    const ok = await confirmDialog({
      title: "Restore into your draft?",
      body: `Your draft will be replaced with the content from ${picked.sha.slice(0, 7)}.${dirty ? " Your current unpublished edits will be lost." : ""} Nothing goes live until you publish.`,
      confirmLabel: "Restore into draft",
      danger: dirty,
    });
    if (!ok) return;
    replaceDraft(version.content);
    toast("success", "Restored into your draft. Review it, then publish to make it live.");
    navigate("dashboard");
  };

  return (
    <div>
      <PageHeader eyebrow="Site" title="History" description="Every published version of your content. Restoring only changes your draft, never the live site." />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          {error ? (
            <Note kind="error">{error}</Note>
          ) : !commits ? (
            <Loading label="Loading history" />
          ) : commits.length === 0 ? (
            <EmptyState icon="history" title="No history yet">Commits that change content.json will appear here.</EmptyState>
          ) : (
            <ul className="overflow-hidden rounded-[var(--r-3)] border border-line bg-surface" data-testid="history-list">
              {commits.map((c, i) => (
                <li key={c.sha} className="border-b border-line last:border-b-0">
                  <button type="button" onClick={() => void open(c)} aria-current={picked?.sha === c.sha ? "true" : undefined} className={`block min-h-11 w-full px-3 py-2 text-left hover:bg-surface-2 cursor-pointer ${picked?.sha === c.sha ? "bg-accent-soft" : ""}`}>
                    <span className="block truncate text-sm font-medium text-ink">{firstLine(c.message)}</span>
                    <span className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-2">
                      <span className="font-mono">{c.sha.slice(0, 7)}</span> · {relativeTime(c.date)}
                      {i === 0 && <Badge tone="accent">latest</Badge>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          {!picked ? (
            commits && commits.length > 0 && <Card><p className="py-8 text-center text-sm text-ink-2">Choose a version to see how it differs from your draft.</p></Card>
          ) : (
            <Card title={firstLine(picked.message)} description={<><span className="font-mono">{picked.sha.slice(0, 7)}</span> · {picked.author} · {relativeTime(picked.date)}</>} actions={picked.url ? <ExtLink href={picked.url} className="text-sm">GitHub</ExtLink> : undefined}>
              {loadingVersion && <Loading label="Loading this version" />}
              {version?.problem && <Note kind="error">{version.problem}</Note>}
              {version?.content && summary && (
                <div className="flex flex-col gap-4" data-testid="history-detail">
                  <p className="text-sm text-ink-2">
                    This version has {summary.projects} projects, {summary.experience} roles, {summary.research} research entries and {summary.skills} skill groups.
                  </p>
                  <div>
                    <h3 className="mb-1.5 text-sm font-medium text-ink">Restoring would change your draft like this</h3>
                    {changes.length === 0 ? (
                      <p className="text-sm text-ink-2">It is identical to your draft.</p>
                    ) : (
                      <ul className="flex flex-col gap-1.5 text-sm">
                        {changes.map((c) => (
                          <li key={c.area} className="rounded-lg bg-surface-2 px-3 py-2">
                            <span className="font-medium text-ink">{c.label}</span>
                            <span className="block text-xs text-ink-2">{c.details.join(" · ")}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div><Button variant="primary" icon="undo" disabled={changes.length === 0} onClick={restore} data-testid="history-restore">Restore into draft</Button></div>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
