/**
 * Pure logic over content: what changed, what files are referenced, how to merge,
 * what the commit should say and which field each validation error belongs to.
 */
import { contentSchema, type Content } from "../../lib/schema";
import { getIn } from "./paths";

export type AreaKey = keyof Content;
export const AREAS: { key: AreaKey; label: string }[] = [
  { key: "profile", label: "Profile" },
  { key: "projects", label: "Projects" },
  { key: "experience", label: "Experience" },
  { key: "research", label: "Research" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "achievements", label: "Achievements" },
  { key: "stats", label: "Stats" },
  { key: "settings", label: "Settings" },
];
export const areaLabel = (key: AreaKey) => AREAS.find((a) => a.key === key)?.label ?? key;

/** JSON with sorted keys, so equality ignores key order. */
export function stable(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}
export const same = (a: unknown, b: unknown) => stable(a) === stable(b);

/** The exact bytes committed: same format as the file in the repo, so diffs stay small. */
export const serializeContent = (c: Content) => `${JSON.stringify(c, null, 2)}\n`;

export function changedAreas(base: Content | null, draft: Content | null): AreaKey[] {
  if (!draft) return [];
  return AREAS.filter((a) => !base || !same(base[a.key], draft[a.key])).map((a) => a.key);
}

export const ITEM_TITLE: Partial<Record<AreaKey, string>> = {
  projects: "title",
  experience: "role",
  research: "title",
  education: "school",
  skills: "group",
  achievements: "title",
};

export interface AreaChange {
  area: AreaKey;
  label: string;
  details: string[];
}

function diffList(area: AreaKey, base: any[], draft: any[]): string[] {
  const key = ITEM_TITLE[area] as string;
  const name = (it: any) => `"${it[key] || it.id}"`;
  const baseById = new Map(base.map((it) => [it.id, it]));
  const draftIds = new Set(draft.map((it) => it.id));
  const out: string[] = [];
  for (const it of draft) {
    const prev = baseById.get(it.id);
    if (!prev) out.push(`Added ${name(it)}`);
    else if (!same(prev, it)) out.push(`Edited ${name(it)}`);
  }
  for (const it of base) if (!draftIds.has(it.id)) out.push(`Removed ${name(it)}`);
  const kept = base.filter((it) => draftIds.has(it.id)).map((it) => it.id);
  const keptNow = draft.filter((it) => baseById.has(it.id)).map((it) => it.id);
  if (!same(kept, keptNow)) out.push("Reordered");
  return out;
}

export function diffContent(base: Content | null, draft: Content): AreaChange[] {
  return changedAreas(base, draft).map((area) => {
    const label = areaLabel(area);
    if (!base) return { area, label, details: ["Replaced"] };
    let details: string[];
    if (ITEM_TITLE[area]) {
      details = diffList(area, base[area] as any[], draft[area] as any[]);
    } else if (area === "stats") {
      details = base.stats.length === draft.stats.length
        ? ["Updated"]
        : [`${base.stats.length} to ${draft.stats.length} stats`];
    } else {
      const a = base[area] as Record<string, unknown>;
      const b = draft[area] as Record<string, unknown>;
      const keys = Object.keys(b).filter((k) => !same(a[k], b[k]));
      details = [`Changed ${keys.map(humanize).join(", ").toLowerCase()}`];
    }
    return { area, label, details };
  });
}

export function commitMessage(changes: AreaChange[], added: string[], removed: string[]): string {
  const labels = changes.map((c) => c.label.toLowerCase());
  let subject: string;
  if (labels.length === 0) subject = added.length || removed.length ? "Update media files" : "Update content";
  else if (labels.length <= 3) subject = `Update ${labels.join(", ")}`;
  else subject = `Update ${labels.length} content areas`;
  const fileBits: string[] = [];
  if (added.length) fileBits.push(`add ${added.length} file${added.length > 1 ? "s" : ""}`);
  if (removed.length) fileBits.push(`remove ${removed.length} file${removed.length > 1 ? "s" : ""}`);
  if (fileBits.length) subject += ` (${fileBits.join(", ")})`;

  const lines = changes.map((c) => `- ${c.label}: ${c.details.join("; ")}`);
  for (const f of added) lines.push(`- Added ${f}`);
  for (const f of removed) lines.push(`- Removed ${f}`);
  lines.push("", "Published from the admin panel.");
  return `${subject}\n\n${lines.join("\n")}`;
}

/* ---------- files referenced by content ---------- */

export interface AssetRef {
  /** Public path, e.g. /uploads/a.webp */
  file: string;
  /** Where it is used, for humans. */
  usedBy: string;
  /** Content path of the field. */
  path: string;
}

export function assetRefs(c: Content): AssetRef[] {
  const refs: AssetRef[] = [];
  if (c.profile.photo) refs.push({ file: c.profile.photo, usedBy: "Profile photo", path: "profile.photo" });
  c.profile.resumes.forEach((r, i) => {
    if (r.file) refs.push({ file: r.file, usedBy: `Résumé: ${r.label || "untitled"}`, path: `profile.resumes.${i}.file` });
  });
  c.projects.forEach((p, i) => {
    if (p.image) refs.push({ file: p.image, usedBy: `Project cover: ${p.title || p.id}`, path: `projects.${i}.image` });
  });
  return refs;
}

export const toRepoPath = (publicPath: string) => `public${publicPath}`;
export const toPublicPath = (repoPath: string) => repoPath.replace(/^public/, "");

/* ---------- three-way merge at area level ---------- */

export type MergeStatus = "same" | "mine" | "theirs" | "both";
export interface MergeRow {
  area: AreaKey;
  label: string;
  status: MergeStatus;
}

export function planMerge(base: Content | null, mine: Content, theirs: Content): MergeRow[] {
  return AREAS.map(({ key, label }) => {
    let status: MergeStatus;
    if (same(mine[key], theirs[key])) status = "same";
    else if (base && same(base[key], mine[key])) status = "theirs";
    else if (base && same(base[key], theirs[key])) status = "mine";
    else status = "both";
    return { area: key, label, status };
  });
}

/** `takeTheirs` lists the "both" areas the owner chose to give up. */
export function applyMerge(plan: MergeRow[], mine: Content, theirs: Content, takeTheirs: AreaKey[] = []): Content {
  const out: any = { ...theirs };
  for (const row of plan) {
    const keepMine = row.status === "mine" || (row.status === "both" && !takeTheirs.includes(row.area));
    out[row.area] = keepMine ? mine[row.area] : theirs[row.area];
  }
  return out as Content;
}

/* ---------- validation ---------- */

export interface Issue {
  path: string;
  message: string;
  /** Hash route that shows the field. */
  route: string;
  /** Human location, e.g. "Projects › Limiter › Title". */
  where: string;
}

export const humanize = (key: string) =>
  key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bUrl\b/, "URL");

export function routeForPath(path: string, content: unknown): string {
  const [area, index] = path.split(".");
  if (!area) return "dashboard";
  if (area === "profile" || area === "settings" || area === "stats") return area;
  const id = index !== undefined ? getIn(content, `${area}.${index}.id`) : undefined;
  return id ? `${area}/${id}` : area;
}

export function whereForPath(path: string, content: unknown): string {
  const parts = path.split(".");
  const area = parts[0] as AreaKey;
  const out: string[] = [areaLabel(area)];
  let cursor = area as string;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i] as string;
    cursor += `.${part}`;
    if (/^\d+$/.test(part)) {
      const item = getIn(content, cursor);
      const titleKey = i === 1 ? ITEM_TITLE[area] : undefined;
      const named = titleKey ? item?.[titleKey] : (item?.label ?? (typeof item === "string" ? item : ""));
      out.push(named ? String(named).slice(0, 32) : `#${Number(part) + 1}`);
    } else {
      out.push(humanize(part));
    }
  }
  return out.join(" › ");
}

function friendlyMessage(issue: { code: string; message: string; minimum?: unknown; format?: string; origin?: string }): string {
  if (issue.code === "too_small" && issue.minimum === 1) return "This field is required.";
  if (issue.code === "invalid_format" && issue.format === "email") return "Enter a valid email address.";
  if (issue.code === "invalid_type") return "This value is missing or has the wrong type.";
  return issue.message;
}

export function zodIssues(raw: unknown): Issue[] {
  const result = contentSchema.safeParse(raw);
  if (result.success) return [];
  return result.error.issues.map((i) => {
    const path = i.path.join(".");
    return {
      path,
      message: friendlyMessage(i as any),
      route: routeForPath(path, raw),
      where: path ? whereForPath(path, raw) : "Content",
    };
  });
}

/** Every referenced file must exist after this publish. `available` holds public paths. */
export function missingAssetIssues(c: Content, available: Set<string>): Issue[] {
  const missing = assetRefs(c)
    .filter((r) => !available.has(r.file))
    .map((r) => ({
      path: r.path,
      message: `${r.file} is not in the repository. Upload it again or clear this field.`,
      route: routeForPath(r.path, c),
      where: whereForPath(r.path, c),
    }));
  // The schema allows an empty file, but the site silently hides such a résumé.
  const noFile = c.profile.resumes.flatMap((r, i) => {
    if (r.file) return [];
    const path = `profile.resumes.${i}.file`;
    return [{ path, message: "Upload a PDF, or remove this résumé.", route: routeForPath(path, c), where: whereForPath(path, c) }];
  });
  return [...missing, ...noFile];
}

/** Field names present in raw JSON that the schema would drop on publish. */
export function unknownKeys(raw: unknown, parsed: unknown, prefix = ""): string[] {
  if (!raw || typeof raw !== "object" || !parsed || typeof parsed !== "object") return [];
  const out: string[] = [];
  for (const k of Object.keys(raw)) {
    const here = prefix ? `${prefix}.${k}` : k;
    if (!(k in parsed)) out.push(here);
    else out.push(...unknownKeys((raw as any)[k], (parsed as any)[k], here));
  }
  return out;
}

export function counts(c: Content) {
  return {
    projects: c.projects.length,
    projectsHidden: c.projects.filter((p) => p.hidden).length,
    projectsFeatured: c.projects.filter((p) => p.featured).length,
    experience: c.experience.length,
    research: c.research.length,
    education: c.education.length,
    skills: c.skills.length,
    achievements: c.achievements.length,
    stats: c.stats.length,
    resumes: c.profile.resumes.length,
  };
}

/* ---------- import from GitHub ---------- */

export interface RepoSummary {
  name: string;
  full_name: string;
  description: string | null;
  language: string | null;
  html_url: string;
  fork: boolean;
  archived: boolean;
  updated_at: string;
  stargazers_count?: number;
}

export function titleFromRepo(name: string): string {
  return name
    .replace(/[-_.]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function categoryFromLanguage(language: string | null): "Mobile" | "AI & ML" | "Web" {
  if (language && ["Kotlin", "Dart", "Swift", "Java", "Objective-C"].includes(language)) return "Mobile";
  if (language && ["Jupyter Notebook", "Python", "R"].includes(language)) return "AI & ML";
  return "Web";
}

export function projectFromRepo(repo: RepoSummary, id: string): Content["projects"][number] {
  return {
    id,
    title: titleFromRepo(repo.name),
    tagline: "",
    description: repo.description?.trim() ?? "",
    category: categoryFromLanguage(repo.language),
    tech: repo.language ? [repo.language] : [],
    image: "",
    imageAlt: "",
    links: [{ label: "GitHub", url: repo.html_url }],
    featured: false,
    hidden: false,
  };
}

/** Projects already linking to this repository, so re-importing is a visible choice. */
export function projectsLinkingTo(c: Content, repoUrl: string) {
  const norm = (u: string) => u.toLowerCase().replace(/\/+$/, "");
  const target = norm(repoUrl);
  return c.projects.filter((p) => p.links.some((l) => norm(l.url) === target || norm(l.url).startsWith(`${target}/`)));
}
