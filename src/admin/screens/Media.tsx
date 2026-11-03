import { useMemo } from "react";
import { Badge, Button, Card, EmptyState, ExtLink, Icon, PageHeader } from "../components/ui";
import { AssetImage } from "../components/Uploads";
import { assetRefs, toPublicPath } from "../lib/content";
import { formatBytes } from "../lib/encoding";
import { assetUrl, confirmDialog, isInUse, stageDeletion, toast, undoDeletion, unstageUpload, useStore } from "../store";
import { RESUME_DIR, UPLOADS_DIR } from "../config";

interface Row {
  repoPath: string;
  publicPath: string;
  size: number;
  usedBy: string[];
  staged: boolean;
  removing: boolean;
}

const isImage = (p: string) => /\.(webp|jpe?g|png|gif|avif)$/i.test(p);

function FileRow({ row }: { row: Row }) {
  const unused = row.usedBy.length === 0;
  const remove = async () => {
    if (isInUse(row.publicPath)) {
      toast("error", `${row.publicPath} is in use by: ${row.usedBy.join(", ")}. Change that first.`);
      return;
    }
    if (row.staged) {
      unstageUpload(row.publicPath);
      toast("info", "Upload dropped. It will not be part of the commit.");
      return;
    }
    const ok = await confirmDialog({
      title: "Remove this file?",
      body: `${row.publicPath} is not used by any content. It will be deleted from the repository the next time you publish.`,
      confirmLabel: "Remove on publish",
      danger: true,
    });
    if (ok && !stageDeletion(row.repoPath)) toast("error", `${row.publicPath} is in use, so it was not removed.`);
  };
  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5 sm:flex-nowrap" data-testid="media-row" data-path={row.publicPath}>
      <span className="flex size-12 flex-none items-center justify-center overflow-hidden rounded-lg bg-surface-2 text-ink-3">
        {isImage(row.publicPath) ? <AssetImage path={row.publicPath} className={`size-full object-cover ${row.removing ? "opacity-40" : ""}`} /> : <Icon name="file" />}
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className={`truncate font-mono text-xs text-ink ${row.removing ? "line-through" : ""}`} title={row.publicPath}>{row.publicPath.split("/").pop()}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-ink-2">
          <span>{formatBytes(row.size)}</span>
          {row.staged && <Badge tone="accent">new in draft</Badge>}
          {row.removing && <Badge tone="danger">removed on publish</Badge>}
          {!row.removing && (unused ? <Badge tone="warning">unused</Badge> : <span className="min-w-0">{row.usedBy.join(", ")}</span>)}
        </p>
      </div>
      <div className="flex flex-none items-center gap-1">
        {!row.staged && <ExtLink href={assetUrl(row.publicPath)} className="mr-2 min-h-11 text-sm">Open</ExtLink>}
        {row.removing ? (
          <Button variant="ghost" icon="undo" onClick={() => undoDeletion(row.repoPath)}>Keep</Button>
        ) : (
          <Button variant="dangerGhost" icon="trash" onClick={remove} data-testid="media-delete">Delete</Button>
        )}
      </div>
    </li>
  );
}

export function Media() {
  const files = useStore((s) => s.base?.files);
  const uploads = useStore((s) => s.uploads);
  const deletions = useStore((s) => s.deletions);
  const draft = useStore((s) => s.draft);

  const rows = useMemo(() => {
    const refs = draft ? assetRefs(draft) : [];
    const usedBy = (publicPath: string) => refs.filter((r) => r.file === publicPath).map((r) => r.usedBy);
    const out: Row[] = (files ?? []).map((f) => {
      const publicPath = toPublicPath(f.path);
      return { repoPath: f.path, publicPath, size: f.size, usedBy: usedBy(publicPath), staged: false, removing: deletions.includes(f.path) };
    });
    for (const u of uploads) {
      out.push({ repoPath: u.path, publicPath: u.publicPath, size: u.size, usedBy: usedBy(u.publicPath), staged: true, removing: false });
    }
    return out.sort((a, b) => a.publicPath.localeCompare(b.publicPath));
  }, [files, uploads, deletions, draft]);

  const images = rows.filter((r) => r.repoPath.startsWith(`${UPLOADS_DIR}/`));
  const pdfs = rows.filter((r) => r.repoPath.startsWith(`${RESUME_DIR}/`));
  const unused = rows.filter((r) => r.usedBy.length === 0 && !r.removing).length;

  return (
    <div>
      <PageHeader
        eyebrow="Site"
        title="Media"
        description="Files in public/uploads and public/resume. Upload new ones from the Profile and Projects screens."
      />
      <p className="mb-4 text-sm text-ink-2" data-testid="media-summary">
        {rows.length} file{rows.length === 1 ? "" : "s"}{unused > 0 ? `, ${unused} unused` : ", all in use"}.
      </p>
      <div className="flex flex-col gap-4">
        <Card title="Images" description="public/uploads">
          {images.length ? <ul className="divide-y divide-line">{images.map((r) => <FileRow key={r.repoPath} row={r} />)}</ul> : <EmptyState icon="media" title="No images yet">Upload a profile photo or project cover and it will appear here.</EmptyState>}
        </Card>
        <Card title="PDFs" description="public/resume">
          {pdfs.length ? <ul className="divide-y divide-line">{pdfs.map((r) => <FileRow key={r.repoPath} row={r} />)}</ul> : <EmptyState icon="file" title="No PDFs yet">Upload a résumé on the Profile screen.</EmptyState>}
        </Card>
      </div>
    </div>
  );
}
