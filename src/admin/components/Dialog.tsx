/** Native <dialog>: focus trap, Escape and inert background come from the browser. */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { closeConfirm, useStore } from "../store";
import { Button, IconButton } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  /** Blocks Escape and backdrop close, e.g. while publishing. */
  locked?: boolean;
}

export function Dialog({ open, onClose, title, children, footer, wide, locked }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!locked) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-1.5rem)] overflow-hidden rounded-[var(--r-3)] border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-[color-mix(in_oklab,var(--ink)_40%,transparent)] ${wide ? "max-w-2xl" : "max-w-md"} ${open ? "flex" : ""} flex-col`}
    >
      {open && (
        <>
          <header className="flex items-center justify-between gap-3 border-b border-line py-1.5 pl-4 pr-1.5 sm:pl-5">
            <h2 id="dialog-title" className="font-display text-lg font-semibold tracking-tight">{title}</h2>
            <IconButton label="Close dialog" icon="close" onClick={onClose} disabled={locked} />
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface px-4 py-3 sm:px-5">{footer}</footer>}
        </>
      )}
    </dialog>
  );
}

/** Host for the promise-based confirm and prompt dialogs in the store. */
export function ConfirmHost() {
  const req = useStore((s) => s.confirm);
  const [value, setValue] = useState("");
  useEffect(() => setValue(req?.prompt?.initial ?? ""), [req]);
  const cancel = () => closeConfirm(req?.prompt ? null : false);
  const ok = () => {
    if (req?.prompt) {
      if (req.prompt.required && !value.trim()) return;
      closeConfirm(value.trim());
    } else closeConfirm(true);
  };
  return (
    <Dialog
      open={!!req}
      onClose={cancel}
      title={req?.title ?? ""}
      footer={
        <>
          <Button variant="ghost" onClick={cancel} autoFocus={!req?.prompt && req?.danger}>{req?.cancelLabel ?? "Cancel"}</Button>
          <Button variant={req?.danger ? "danger" : "primary"} onClick={ok} disabled={!!req?.prompt?.required && !value.trim()} data-testid="confirm-ok">
            {req?.confirmLabel ?? "Confirm"}
          </Button>
        </>
      }
    >
      {req?.body && <p className="whitespace-pre-line text-sm text-ink-2">{req.body}</p>}
      {req?.prompt && (
        <form
          className={req.body ? "mt-3" : ""}
          onSubmit={(e) => {
            e.preventDefault();
            ok();
          }}
        >
          <label htmlFor="prompt-input" className="mb-1.5 block text-sm font-medium">{req.prompt.label}</label>
          <input id="prompt-input" autoFocus value={value} onChange={(e) => setValue(e.target.value)} className="min-h-11 w-full rounded-lg border border-line bg-bg px-3 py-2 text-base text-ink sm:text-sm" />
        </form>
      )}
    </Dialog>
  );
}
