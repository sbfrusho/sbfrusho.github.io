import { dismissToast, useStore } from "../store";
import { Icon } from "./ui";

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  const announcement = useStore((s) => s.announcement);
  const tone = { success: "text-accent", error: "text-danger", warning: "text-warning", info: "text-ink-3" };
  return (
    <>
      <div className="sr-only" aria-live="polite" role="status">{announcement}</div>
      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-3 top-3 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:top-4 sm:w-96 sm:items-stretch" data-testid="toasts">
        {toasts.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : undefined} className="pointer-events-auto flex w-full items-start gap-2.5 rounded-lg border border-line bg-surface py-2.5 pl-3 pr-1 text-sm text-ink shadow-card">
            <Icon name={t.kind === "success" ? "check" : t.kind === "info" ? "info" : "alert"} className={`mt-1 ${tone[t.kind]}`} />
            <p className="min-w-0 flex-1 py-1">{t.message}</p>
            <button type="button" aria-label="Dismiss" onClick={() => dismissToast(t.id)} className="flex size-9 flex-none items-center justify-center rounded text-ink-3 hover:text-ink cursor-pointer">
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
