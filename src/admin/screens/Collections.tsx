/** Projects, experience, research, education, skills, achievements and stats. */
import { useEffect, useMemo, useState } from "react";
import { Collection } from "../components/Collection";
import { Dialog } from "../components/Dialog";
import { FormGrid, LinksEditor, RowList, SelectField, StringList, TagInput, TextField, Toggle } from "../components/Fields";
import { Badge, Button, Card, Icon, Loading, Note, PageHeader, relativeTime } from "../components/ui";
import { CoverField } from "../components/Uploads";
import { projectFromRepo, projectsLinkingTo, type RepoSummary } from "../lib/content";
import { newId } from "../lib/names";
import { navigate } from "../route";
import { api, getAt, getState, setAt, toast, useStore } from "../store";
import { projectSchema, type Achievement, type Education, type Experience as Exp, type Project, type Research as Res, type SkillGroup } from "../../lib/schema";

const CATEGORIES = projectSchema.shape.category.options;

/* ---------- projects ---------- */

function ImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [repos, setRepos] = useState<RepoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<RepoSummary | null>(null);
  const draft = useStore((s) => s.draft);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setQuery("");
    setError(null);
    setRepos(null);
    api().listRepos().then(setRepos, (e) => setError(e instanceof Error ? e.message : "Could not load repositories."));
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (repos ?? []).filter((r) => !q || `${r.name} ${r.description ?? ""} ${r.language ?? ""}`.toLowerCase().includes(q));
  }, [repos, query]);

  const preview = picked ? projectFromRepo(picked, "preview") : null;
  const existing = picked && draft ? projectsLinkingTo(draft, picked.html_url) : [];

  const add = () => {
    if (!picked) return;
    const ids = (getState().draft?.projects ?? []).map((p) => p.id);
    const project = projectFromRepo(picked, newId(picked.name, ids, "project"));
    setAt("projects", [project, ...(getAt("projects") as Project[])]);
    onClose();
    navigate(`projects/${project.id}`);
    toast("success", `Added "${project.title}" as a new project. Review it, then publish.`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={picked ? "Check before adding" : "Import from GitHub"}
      footer={picked ? (
        <>
          <Button variant="ghost" onClick={() => setPicked(null)}>Back to list</Button>
          <Button variant="primary" onClick={add} data-testid="import-add">Add as new project</Button>
        </>
      ) : undefined}
    >
      {error && <Note kind="error">{error}</Note>}
      {!picked && !error && !repos && <Loading label="Loading repositories" />}
      {!picked && repos && (
        <div className="flex flex-col gap-2">
          <label htmlFor="repo-search" className="sr-only">Search repositories</label>
          <input id="repo-search" type="search" placeholder="Search repositories" value={query} onChange={(e) => setQuery(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 text-base text-ink placeholder:text-ink-3 sm:text-sm" />
          {visible.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-2">No repositories match.</p>
          ) : (
            <ul className="divide-y divide-line rounded-lg border border-line" data-testid="repo-list">
              {visible.map((r) => {
                const linked = draft ? projectsLinkingTo(draft, r.html_url).length > 0 : false;
                return (
                  <li key={r.full_name}>
                    <button type="button" onClick={() => setPicked(r)} className="flex min-h-11 w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-2 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-ink">
                          <span className="break-all">{r.name}</span>
                          {linked && <Badge tone="accent">already added</Badge>}
                          {r.fork && <Badge>fork</Badge>}
                          {r.archived && <Badge>archived</Badge>}
                        </span>
                        {r.description && <span className="block text-xs text-ink-2">{r.description}</span>}
                        <span className="block text-xs text-ink-2">{[r.language, relativeTime(r.updated_at)].filter(Boolean).join(" · ")}</span>
                      </span>
                      <Icon name="arrow" size={14} className="mt-1 text-ink-3" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {picked && preview && (
        <div className="flex flex-col gap-3 text-sm">
          {existing.length > 0 && (
            <Note kind="warning">
              {existing.map((e) => `"${e.title}"`).join(", ")} already links to this repository. Adding creates a separate project, and existing projects are not changed.
            </Note>
          )}
          <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-2" data-testid="import-preview">
            <dt className="text-ink-2">Title</dt><dd className="font-medium">{preview.title}</dd>
            <dt className="text-ink-2">Description</dt><dd>{preview.description || <span className="text-ink-2">Empty. You will need to write one.</span>}</dd>
            <dt className="text-ink-2">Category</dt><dd>{preview.category} <span className="text-ink-2">(a guess from the language)</span></dd>
            <dt className="text-ink-2">Tech</dt><dd>{preview.tech.join(", ") || <span className="text-ink-2">None</span>}</dd>
            <dt className="text-ink-2">Link</dt><dd className="break-all font-mono text-xs">{picked.html_url}</dd>
          </dl>
        </div>
      )}
    </Dialog>
  );
}

function ProjectEditor(path: string, item: Project) {
  return (
    <div className="flex flex-col gap-4">
      <Card title="Details">
        <div className="flex flex-col gap-4">
          <TextField path={`${path}.title`} label="Title" required />
          <TextField path={`${path}.tagline`} label="Tagline" hint="A few words shown under the title." />
          <TextField path={`${path}.description`} label="Description" required rows={4} />
          <SelectField path={`${path}.category`} label="Category" options={CATEGORIES} hint="Used by the filter on the site." />
          <TagInput path={`${path}.tech`} label="Tech" />
        </div>
      </Card>
      <Card title="Visibility">
        <div className="divide-y divide-line">
          <Toggle path={`${path}.featured`} label="Featured" hint="Given more prominence on the site." />
          <Toggle path={`${path}.hidden`} label="Hidden" hint="Stays here in the admin, but is not published to the site." />
        </div>
      </Card>
      <Card title="Cover">
        <div className="flex flex-col gap-4">
          <CoverField path={`${path}.image`} baseName={item.title} />
          <TextField path={`${path}.imageAlt`} label="Cover description" hint={item.image && !item.imageAlt.trim() ? "Please describe this image. The site uses this text as written for people using screen readers." : "Read aloud by screen readers."} disabled={!item.image} />
        </div>
      </Card>
      <Card title="Links"><LinksEditor path={`${path}.links`} /></Card>
    </div>
  );
}

export function Projects() {
  const [importing, setImporting] = useState(false);
  return (
    <>
      <Collection<Project>
        area="projects"
        title="Projects"
        description="Featured projects show first. Within each group, the order here is the order on the site."
        singular="Project"
        titleKey="title"
        titlePrompt="Project title"
        blank={(id, title) => ({ id, title, tagline: "", description: "", category: "Mobile", tech: [], image: "", imageAlt: "", links: [], featured: false, hidden: false })}
        meta={(p) => p.category}
        badges={(p) => (
          <>
            {p.featured && <Badge>featured</Badge>}
            {p.hidden && <Badge tone="warning">hidden</Badge>}
            {p.image && <Badge>cover</Badge>}
          </>
        )}
        searchText={(p) => `${p.title} ${p.tagline} ${p.description} ${p.category} ${p.tech.join(" ")}`}
        editor={ProjectEditor}
        headerActions={<Button icon="github" onClick={() => setImporting(true)} data-testid="import-open">Import from GitHub</Button>}
      />
      <ImportDialog open={importing} onClose={() => setImporting(false)} />
    </>
  );
}

/* ---------- experience ---------- */

export function Experience() {
  return (
    <Collection<Exp>
      area="experience"
      title="Experience"
      singular="Role"
      titleKey="role"
      titlePrompt="Role title"
      blank={(id, role) => ({ id, role, company: "", companyUrl: "", location: "", start: "", end: "", current: false, highlights: [], tech: [], links: [] })}
      meta={(e) => [e.company, e.current ? `${e.start} – Present` : [e.start, e.end].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}
      badges={(e) => e.current ? <Badge tone="accent">current</Badge> : null}
      editor={(path, item) => (
        <div className="flex flex-col gap-4">
          <Card title="Details">
            <div className="flex flex-col gap-4">
              <TextField path={`${path}.role`} label="Role" required />
              <FormGrid>
                <TextField path={`${path}.company`} label="Company" required />
                <TextField path={`${path}.companyUrl`} label="Company website" type="url" placeholder="https://" />
              </FormGrid>
              <TextField path={`${path}.location`} label="Location" />
              <Toggle path={`${path}.current`} label="I currently work here" hint="Shows “Present” instead of an end date." />
              <FormGrid>
                <TextField path={`${path}.start`} label="Start date" required placeholder="Jan 2026" />
                <TextField path={`${path}.end`} label="End date" placeholder={item.current ? "Present" : "May 2025"} disabled={item.current} />
              </FormGrid>
            </div>
          </Card>
          <Card title="Highlights"><StringList path={`${path}.highlights`} label="What you did" addLabel="Add highlight" itemName="Highlight" rows={2} /></Card>
          <Card title="Tech and links">
            <div className="flex flex-col gap-4">
              <TagInput path={`${path}.tech`} label="Tech" />
              <LinksEditor path={`${path}.links`} />
            </div>
          </Card>
        </div>
      )}
    />
  );
}

/* ---------- research ---------- */

export function Research() {
  return (
    <Collection<Res>
      area="research"
      title="Research"
      singular="Entry"
      titleKey="title"
      titlePrompt="Title"
      blank={(id, title) => ({ id, title, type: "", description: "", metric: "", metricLabel: "", tech: [], links: [] })}
      meta={(r) => r.type}
      editor={(path) => (
        <div className="flex flex-col gap-4">
          <Card title="Details">
            <div className="flex flex-col gap-4">
              <TextField path={`${path}.title`} label="Title" required rows={2} />
              <TextField path={`${path}.type`} label="Type" required placeholder="B.Sc. thesis" />
              <TextField path={`${path}.description`} label="Description" required rows={4} />
              <FormGrid>
                <TextField path={`${path}.metric`} label="Headline metric" placeholder="93.47%" hint="Optional." />
                <TextField path={`${path}.metricLabel`} label="Metric label" placeholder="mAP@0.5 on the RSOD dataset" />
              </FormGrid>
            </div>
          </Card>
          <Card title="Tech and links">
            <div className="flex flex-col gap-4">
              <TagInput path={`${path}.tech`} label="Tech" />
              <LinksEditor path={`${path}.links`} />
            </div>
          </Card>
        </div>
      )}
    />
  );
}

/* ---------- education, skills, achievements ---------- */

export function EducationScreen() {
  return (
    <Collection<Education>
      area="education"
      title="Education"
      singular="School"
      titleKey="school"
      titlePrompt="School name"
      blank={(id, school) => ({ id, school, degree: "", period: "", grade: "", note: "" })}
      meta={(e) => e.degree}
      editor={(path) => (
        <Card title="Details">
          <div className="flex flex-col gap-4">
            <TextField path={`${path}.school`} label="School" required />
            <TextField path={`${path}.degree`} label="Degree" required />
            <FormGrid>
              <TextField path={`${path}.period`} label="Period" required placeholder="2020 – 2025" />
              <TextField path={`${path}.grade`} label="Grade" placeholder="CGPA 3.52 / 4.00" />
            </FormGrid>
            <TextField path={`${path}.note`} label="Note" rows={2} />
          </div>
        </Card>
      )}
    />
  );
}

export function Skills() {
  return (
    <Collection<SkillGroup>
      area="skills"
      title="Skills"
      singular="Group"
      titleKey="group"
      titlePrompt="Group name"
      blank={(id, group) => ({ id, group, items: [] })}
      meta={(g) => `${g.items.length} skill${g.items.length === 1 ? "" : "s"}`}
      editor={(path) => (
        <Card title="Group">
          <div className="flex flex-col gap-4">
            <TextField path={`${path}.group`} label="Name" required />
            <TagInput path={`${path}.items`} label="Skills" />
          </div>
        </Card>
      )}
    />
  );
}

export function Achievements() {
  return (
    <Collection<Achievement>
      area="achievements"
      title="Achievements"
      singular="Achievement"
      titleKey="title"
      titlePrompt="Title"
      blank={(id, title) => ({ id, title, detail: "" })}
      meta={(a) => a.detail}
      editor={(path) => (
        <Card title="Details">
          <div className="flex flex-col gap-4">
            <TextField path={`${path}.title`} label="Title" required />
            <TextField path={`${path}.detail`} label="Detail" rows={3} />
          </div>
        </Card>
      )}
    />
  );
}

export function Stats() {
  return (
    <div>
      <PageHeader eyebrow="Content" title="Stats" description="Short facts shown as headline numbers." />
      <Card>
        <RowList<{ value: string; label: string }> path="stats" make={() => ({ value: "", label: "" })} addLabel="Add stat" itemName="Stat" labelOf={(s) => s.label} empty="No stats yet.">
          {(p) => (
            <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
              <TextField path={`${p}.value`} label="Value" required placeholder="50+" />
              <TextField path={`${p}.label`} label="Label" required />
            </div>
          )}
        </RowList>
      </Card>
    </div>
  );
}

