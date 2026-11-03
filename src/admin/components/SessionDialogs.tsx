/** Dialogs that interrupt the session: main moved, and a saved draft found on return. */
import { useEffect, useState } from "react";
import { ACTIONS_URL, REPO_URL } from "../config";
import { changedAreas, areaLabel, type AreaKey } from "../lib/content";
import { acceptRestore, closeConflict, declineRestore, resolveConflict, useStore } from "../store";
import { Dialog } from "./Dialog";
import { Badge, Button, ExtLink, firstLine, Note, relativeTime } from "./ui";

export function ConflictDialog() {
  const conflict = useStore((s) => s.conflict);
  const [takeTheirs, setTakeTheirs] = useState<AreaKey[]>([]);
  useEffect(() => setTakeTheirs([]), [conflict]);
  const plan = conflict?.plan ?? [];
  const both = plan.filter((r) => r.status === "both");
  const mine = plan.filter((r) => r.status === "mine");
  const theirs = plan.filter((r) => r.status === "theirs");
  const c = conflict?.snapshot.commit;
  return (
    <Dialog
      open={!!conflict}
      onClose={closeConflict}
      wide
      title="main changed on GitHub"
      footer={
        <>
          <Button variant="ghost" onClick={closeConflict}>Not now</Button>
          <Button variant="primary" disabled={!conflict?.theirs} onClick={() => resolveConflict(takeTheirs)} data-testid="conflict-reapply">Reload and reapply</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-testid="conflict-dialog">
        <p className="text-sm text-ink-2">
          Someone (perhaps you, on another device or with a git push) committed to main after you started this draft. Nothing was overwritten, and your draft is safe.
        </p>
        {c && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="block font-medium">{firstLine(c.message)}</span>
            <span className="text-xs text-ink-2">
              <span className="font-mono">{c.sha.slice(0, 7)}</span> · {relativeTime(c.date)} · <ExtLink href={c.url || `${REPO_URL}/commit/${c.sha}`}>View on GitHub</ExtLink>
            </span>
          </p>
        )}
        {conflict?.problem ? (
          <Note kind="error">
            {conflict.problem} Your draft cannot be merged with it automatically. Export a backup from the Backup screen, then repair main. See <ExtLink href={ACTIONS_URL}>Actions</ExtLink> for the latest run.
          </Note>
        ) : (
          <>
            {mine.length > 0 && <p className="text-sm"><span className="font-medium">Your edits are kept:</span> {mine.map((r) => r.label).join(", ")}</p>}
            {theirs.length > 0 && <p className="text-sm"><span className="font-medium">Updated from GitHub:</span> {theirs.map((r) => r.label).join(", ")}</p>}
            {both.length > 0 && (
              <fieldset>
                <legend className="mb-1 text-sm font-medium">Changed in both places. Choose which version to keep:</legend>
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {both.map((r) => (
                    <li key={r.area} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm">
                      <span className="mr-auto font-medium">{r.label} <Badge tone="warning">both</Badge></span>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2">
                        <input type="radio" name={`merge-${r.area}`} className="size-4 accent-accent" checked={!takeTheirs.includes(r.area)} onChange={() => setTakeTheirs(takeTheirs.filter((a) => a !== r.area))} /> Mine
                      </label>
                      <label className="flex min-h-11 cursor-pointer items-center gap-2">
                        <input type="radio" name={`merge-${r.area}`} className="size-4 accent-accent" checked={takeTheirs.includes(r.area)} onChange={() => setTakeTheirs([...takeTheirs, r.area])} /> GitHub's
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )}
            <p className="text-xs text-ink-2">Reapplying only updates your draft. Nothing goes live until you publish again. Staged uploads are kept.</p>
          </>
        )}
      </div>
    </Dialog>
  );
}

export function RestoreDialog() {
  const offer = useStore((s) => s.restoreOffer);
  const baseContent = useStore((s) => s.base?.content ?? null);
  const baseSha = useStore((s) => s.base?.commit.sha);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  if (!offer) return null;
  const areas = changedAreas(offer.baseContent, offer.draft);
  return (
    <Dialog
      open
      onClose={() => void acceptRestore()}
      title="Restore your unsaved draft?"
      footer={
        confirmingDiscard ? (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDiscard(false)}>Go back</Button>
            <Button variant="danger" onClick={declineRestore} data-testid="restore-discard-confirm">Discard draft</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDiscard(true)} data-testid="restore-discard">Discard</Button>
            <Button variant="primary" onClick={() => void acceptRestore()} data-testid="restore-accept">Restore draft</Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 text-sm">
        {confirmingDiscard ? (
          <Note kind="warning">This permanently removes the saved draft from this device.</Note>
        ) : (
          <>
            <p className="text-ink-2">
              A draft from {relativeTime(new Date(offer.savedAt).toISOString())} was saved on this device.
              {areas.length > 0 && <> It changes {areas.map((a) => areaLabel(a).toLowerCase()).join(", ")}.</>}
              {offer.uploads.length > 0 && <> It includes {offer.uploads.length} uploaded file{offer.uploads.length > 1 ? "s" : ""}.</>}
              {offer.deletions.length > 0 && <> It removes {offer.deletions.length} file{offer.deletions.length > 1 ? "s" : ""}.</>}
            </p>
            {baseSha !== offer.baseCommitSha && <Note kind="info">main has changed since this draft was saved. You will be able to review that next.</Note>}
            {!baseContent && <Note kind="warning">The content on GitHub does not validate.</Note>}
          </>
        )}
      </div>
    </Dialog>
  );
}
