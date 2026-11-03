import { useMemo, useRef, useState } from "react";
import { contentSchema, type Content } from "../../lib/schema";
import { Button, Card, Note, PageHeader } from "../components/ui";
import { diffContent, serializeContent, zodIssues, type Issue } from "../lib/content";
import { navigate } from "../route";
import { confirmDialog, replaceDraft, selectDirty, toast, useStore } from "../store";

export function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

export function Backup() {
  const draft = useStore((s) => s.draft);
  const live = useStore((s) => s.base?.content);
  const dirty = useStore(selectDirty);
  const [imported, setImported] = useState<Content | null>(null);
  const [problems, setProblems] = useState<Issue[] | string | null>(null);
  const [fileName, setFileName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const pick = async (file: File) => {
    setImported(null);
    setProblems(null);
    setFileName(file.name);
    if (file.size > 5 * 1024 * 1024) {
      setProblems("That file is too large to be a content backup.");
      return;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch (e) {
      setProblems(`Not valid JSON: ${e instanceof Error ? e.message : ""}`);
      return;
    }
    const parsed = contentSchema.safeParse(raw);
    if (parsed.success) setImported(parsed.data);
    else setProblems(zodIssues(raw));
  };

  const changes = useMemo(() => (imported && draft ? diffContent(draft, imported) : []), [imported, draft]);

  const load = async () => {
    if (!imported) return;
    const ok = await confirmDialog({
      title: "Import into your draft?",
      body: `Your draft will be replaced with ${fileName}.${dirty ? " Your current unpublished edits will be lost." : ""} Nothing goes live until you publish.`,
      confirmLabel: "Import into draft",
      danger: dirty,
    });
    if (!ok) return;
    replaceDraft(imported);
    setImported(null);
    toast("success", "Imported into your draft. Review it, then publish.");
    navigate("dashboard");
  };

  return (
    <div>
      <PageHeader eyebrow="Site" title="Backup" description="Export your content as a JSON file, or bring one back into your draft." />
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card title="Export" description="Text content only. Images and PDFs stay in the repository. Your token is never included.">
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon="download" disabled={!draft} data-testid="export-draft" onClick={() => draft && downloadText(`portfolio-draft-${stamp()}.json`, serializeContent(draft))}>Export draft</Button>
            <Button icon="download" disabled={!live} data-testid="export-live" onClick={() => live && downloadText(`portfolio-live-${stamp()}.json`, serializeContent(live))}>Export live version</Button>
          </div>
        </Card>
        <Card title="Import" description="The file is checked against the content format first. Importing only changes your draft.">
          <Button icon="upload" onClick={() => input.current?.click()}>Choose JSON file</Button>
          <input
            ref={input}
            type="file"
            accept="application/json,.json"
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="import-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void pick(f);
            }}
          />
          {problems && (
            <div className="mt-3" data-testid="import-problems">
              <Note kind="error">{fileName} cannot be imported{typeof problems === "string" ? `. ${problems}` : ` because ${problems.length} field${problems.length === 1 ? " has" : "s have"} problems:`}</Note>
              {typeof problems !== "string" && (
                <ul className="mt-2 flex max-h-60 flex-col gap-1.5 overflow-y-auto text-sm">
                  {problems.slice(0, 30).map((p, i) => (
                    <li key={`${p.path}-${i}`}><code className="break-all font-mono text-xs text-ink">{p.path || "(root)"}</code><span className="block text-xs text-danger">{p.message}</span></li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {imported && (
            <div className="mt-3 flex flex-col gap-3" data-testid="import-ready">
              <Note kind="success">{fileName} is valid.</Note>
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
              <div><Button variant="primary" disabled={changes.length === 0} onClick={load} data-testid="import-load">Import into draft</Button></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
