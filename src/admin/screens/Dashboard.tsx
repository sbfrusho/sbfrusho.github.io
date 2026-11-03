import { useEffect, useMemo, useState } from "react";
import { DeployStatus } from "../components/DeployStatus";
import { LIVE_URL } from "../config";
import { counts } from "../lib/content";
import { navigate } from "../route";
import { api, selectChangedAreas, useStore } from "../store";
import { Badge, Button, Card, ExtLink, firstLine, Icon, Loading, Note, PageHeader, relativeTime } from "../components/ui";
import type { CommitInfo } from "../github";

export function Dashboard() {
  const draft = useStore((s) => s.draft);
  const base = useStore((s) => s.base);
  const changed = useStore(selectChangedAreas);
  const dropped = useStore((s) => s.droppedKeys);
  const revision = useStore((s) => s.revision);
  const [commits, setCommits] = useState<CommitInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setError(null);
    api().recentCommits({ perPage: 5 }).then(
      (c) => live && setCommits(c),
      (e) => live && setError(e instanceof Error ? e.message : "Could not load commits."),
    );
    return () => {
      live = false;
    };
  }, [revision]);

  const c = useMemo(() => (draft ? counts(draft) : null), [draft]);
  if (!c || !base) return null;
  const tiles = [
    { label: "Projects", value: c.projects, note: `${c.projectsFeatured} featured${c.projectsHidden ? `, ${c.projectsHidden} hidden` : ""}`, route: "projects" },
    { label: "Experience", value: c.experience, route: "experience" },
    { label: "Research", value: c.research, route: "research" },
    { label: "Education", value: c.education, route: "education" },
    { label: "Skill groups", value: c.skills, route: "skills" },
    { label: "Achievements", value: c.achievements, route: "achievements" },
    { label: "Stats", value: c.stats, route: "stats" },
    { label: "Résumés", value: c.resumes, route: "profile" },
  ];

  return (
    <div>
      <PageHeader eyebrow="Overview" title="Dashboard" />
      {dropped.length > 0 && (
        <Note kind="warning" className="mb-4">
          content.json has fields this admin does not recognise, and they would be dropped on publish: {dropped.slice(0, 5).join(", ")}.
        </Note>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="What is live" actions={<ExtLink href={LIVE_URL} className="min-h-11 text-sm">Open site</ExtLink>}>
          <p className="text-sm font-medium text-ink" data-testid="head-message">{firstLine(base.commit.message)}</p>
          <p className="mt-0.5 text-xs text-ink-2">
            <span className="font-mono">{base.commit.sha.slice(0, 7)}</span> on main · {relativeTime(base.commit.date)}
          </p>
          <div className="mt-4 border-t border-line pt-4"><DeployStatus /></div>
        </Card>

        <Card title="Your draft">
          {changed.length ? (
            <>
              <p className="text-sm text-ink-2">Unpublished changes in:</p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {changed.map((a) => <li key={a}><Badge tone="accent">{a}</Badge></li>)}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-2">No unpublished changes. Your draft matches main.</p>
          )}
          <h3 className="mb-2 mt-4 border-t border-line pt-4 text-sm font-medium text-ink">Quick actions</h3>
          <div className="flex flex-wrap gap-2">
            <Button icon="plus" onClick={() => navigate("projects")}>Add a project</Button>
            <Button icon="profile" onClick={() => navigate("profile")}>Edit profile</Button>
            <Button icon="file" onClick={() => navigate("profile", "profile.resumes")}>Update résumé</Button>
            <Button icon="backup" onClick={() => navigate("backup")}>Back up</Button>
          </div>
        </Card>
      </div>

      <h2 className="mb-2 mt-6 font-mono text-xs tracking-wide text-ink-2">Content</h2>
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--r-3)] border border-line bg-line sm:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className="bg-surface">
            <a href={`#/${t.route}`} className="block h-full p-4 hover:bg-surface-2">
              <span className="block font-display text-3xl font-semibold leading-none tracking-tight text-ink">{t.value}</span>
              <span className="mt-1.5 block text-sm text-ink-2">{t.label}</span>
              {t.note && <span className="block text-xs text-ink-2">{t.note}</span>}
            </a>
          </li>
        ))}
      </ul>

      <Card title="Recent commits" className="mt-6" actions={<a href="#/history" className="inline-flex min-h-11 items-center text-sm font-medium text-ink-2 hover:text-ink">History</a>}>
        {error ? (
          <Note kind="error">{error}</Note>
        ) : !commits ? (
          <Loading label="Loading commits" />
        ) : commits.length === 0 ? (
          <p className="text-sm text-ink-2">No commits yet.</p>
        ) : (
          <ul className="divide-y divide-line" data-testid="recent-commits">
            {commits.map((co) => (
              <li key={co.sha}>
                <a href={co.url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-3 py-2 hover:text-accent">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{firstLine(co.message)}</span>
                    <span className="block text-xs text-ink-2"><span className="font-mono">{co.sha.slice(0, 7)}</span> · {relativeTime(co.date)}</span>
                  </span>
                  <Icon name="arrow" size={14} className="text-ink-3" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
