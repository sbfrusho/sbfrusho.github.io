/** Form fields bound to the draft by dotted path. Errors come from the same validation used at publish. */
import { useState, type ReactNode } from "react";
import { fieldId, moveItem } from "../lib/paths";
import { selectIssues, setAt, useStore } from "../store";
import { SortableList } from "./Sortable";
import { Button, Icon, IconButton } from "./ui";

const INPUT = "block w-full min-h-11 rounded-lg border bg-bg px-3 py-2 text-base text-ink placeholder:text-ink-3 transition-colors sm:text-sm disabled:cursor-not-allowed disabled:opacity-55";
const inputTone = (err?: string) => (err ? "border-danger" : "border-line hover:border-ink-3");

export function useDraftValue<T = any>(path: string): T {
  return useStore((s) => {
    let cur: any = s.draft;
    for (const k of path.split(".")) cur = cur?.[k];
    return cur as T;
  });
}

function useFieldError(path: string, touched: boolean): string | undefined {
  const message = useStore((s) => selectIssues(s).find((i) => i.path === path)?.message);
  const showAll = useStore((s) => s.showAllErrors);
  return touched || showAll ? message : undefined;
}

export function FieldShell({ id, label, hint, error, required, children, counter }: { id: string; label: ReactNode; hint?: ReactNode; error?: string; required?: boolean; children: ReactNode; counter?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-ink-3" aria-hidden="true">*</span>}
        </label>
        {counter}
      </div>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-2">{hint}</p>}
      {error && (
        <p id={`${id}-err`} className="mt-1 flex items-start gap-1 text-xs font-medium text-danger">
          <Icon name="alert" size={14} className="mt-px" /> {error}
        </p>
      )}
    </div>
  );
}

interface TextProps {
  path: string;
  label: string;
  hint?: ReactNode;
  required?: boolean;
  placeholder?: string;
  type?: "text" | "email" | "url" | "tel";
  rows?: number;
  disabled?: boolean;
  counter?: ReactNode;
}

export function TextField({ path, label, hint, required, placeholder, type = "text", rows, disabled, counter }: TextProps) {
  const value = useDraftValue<string>(path) ?? "";
  const [touched, setTouched] = useState(false);
  const error = useFieldError(path, touched);
  const id = fieldId(path);
  const shared = {
    id,
    value,
    placeholder,
    disabled,
    required,
    "aria-invalid": !!error || undefined,
    "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
    onBlur: () => setTouched(true),
    onChange: (e: { target: { value: string } }) => setAt(path, e.target.value),
    className: `${INPUT} ${inputTone(error)}`,
  };
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} counter={counter}>
      {rows ? <textarea {...shared} rows={rows} className={`${shared.className} field-sizing-content leading-relaxed`} /> : <input {...shared} type={type} />}
    </FieldShell>
  );
}

export function SelectField({ path, label, options, labels, hint, onChanged }: { path: string; label: string; options: readonly string[]; labels?: Record<string, string>; hint?: string; onChanged?: (value: string) => void }) {
  const value = useDraftValue<string>(path);
  const id = fieldId(path);
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <select id={id} value={value} onChange={(e) => {
          setAt(path, e.target.value);
          onChanged?.(e.target.value);
        }} className={`${INPUT} ${inputTone()}`}>
        {options.map((o) => <option key={o} value={o}>{labels?.[o] ?? o}</option>)}
      </select>
    </FieldShell>
  );
}

export function Toggle({ path, label, hint, onChanged }: { path: string; label: string; hint?: string; onChanged?: (v: boolean) => void }) {
  const value = useDraftValue<boolean>(path);
  const id = fieldId(path);
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-1">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-ink-2">{hint}</span>}
      </span>
      <span className="relative inline-flex h-6 w-11 flex-none">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={!!value}
          onChange={(e) => {
            setAt(path, e.target.checked);
            onChanged?.(e.target.checked);
          }}
          className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full bg-[color-mix(in_oklab,var(--ink-3)_55%,transparent)] transition-colors checked:bg-accent"
        />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-surface shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Tags with Enter or comma to add, Backspace to remove last, and paste of comma-separated lists. */
export function TagInput({ path, label, hint, placeholder = "Type and press Enter" }: { path: string; label: string; hint?: string; placeholder?: string }) {
  const tags = useDraftValue<string[]>(path) ?? [];
  const [text, setText] = useState("");
  const [touched, setTouched] = useState(false);
  const error = useFieldError(path, touched);
  const id = fieldId(path);
  const add = (raw: string) => {
    const incoming = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (!incoming.length) return;
    const lower = new Set(tags.map((t) => t.toLowerCase()));
    const next = [...tags];
    for (const t of incoming) {
      if (!lower.has(t.toLowerCase())) {
        next.push(t);
        lower.add(t.toLowerCase());
      }
    }
    setAt(path, next);
    setText("");
  };
  return (
    <FieldShell id={id} label={label} hint={hint ?? "Press Enter or comma to add."} error={error}>
      <div className={`flex flex-wrap items-center gap-1.5 rounded-lg border bg-bg p-1.5 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${inputTone(error)}`}>
        {tags.map((t, i) => (
          <span key={`${t}-${i}`} className="inline-flex max-w-full items-center rounded-md bg-surface-2 py-0.5 pl-2 text-sm text-ink">
            <span className="truncate">{t}</span>
            <button type="button" aria-label={`Remove ${t}`} onClick={() => setAt(path, tags.filter((_, j) => j !== i))} className="flex size-8 flex-none items-center justify-center rounded text-ink-3 hover:text-danger cursor-pointer">
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={text}
          placeholder={tags.length ? "" : placeholder}
          aria-describedby={error ? `${id}-err` : `${id}-hint`}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(text);
            } else if (e.key === "Backspace" && !text && tags.length) {
              setAt(path, tags.slice(0, -1));
            }
          }}
          onBlur={() => {
            add(text);
            setTouched(true);
          }}
          className="min-h-8 min-w-24 flex-1 bg-transparent px-1.5 text-base text-ink outline-none placeholder:text-ink-3 sm:text-sm"
        />
      </div>
    </FieldShell>
  );
}

/** Repeating rows of fields, each row reorderable and removable. */
export function RowList<T>({ path, label, description, make, addLabel, itemName, labelOf, children, empty }: {
  path: string;
  label?: string;
  description?: string;
  make: () => T;
  addLabel: string;
  itemName: string;
  labelOf?: (item: T, index: number) => string;
  children: (itemPath: string, index: number, item: T) => ReactNode;
  empty?: string;
}) {
  const items = useDraftValue<T[]>(path) ?? [];
  const [touched, setTouched] = useState(false);
  const error = useFieldError(path, touched);
  const name = (i: number) => labelOf?.(items[i] as T, i) || `${itemName} ${i + 1}`;
  return (
    <fieldset className="min-w-0" onBlur={() => setTouched(true)}>
      {label && <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>}
      {description && <p className="-mt-1 mb-2 text-xs text-ink-2">{description}</p>}
      {items.length === 0 && empty && <p className="mb-2 rounded-lg border border-dashed border-line px-3 py-3 text-center text-sm text-ink-2">{empty}</p>}
      <SortableList id={`rows-${path.replace(/\./g, "-")}`} count={items.length} labelOf={name} onMove={(from, to) => setAt(path, moveItem(items, from, to))} className="flex flex-col gap-2">
        {({ index, rowProps, handle, arrows }) => (
          <li key={index} {...rowProps} className={`rounded-lg border border-line bg-surface-2/40 p-2 ${rowProps.className}`}>
            <div className="flex items-start gap-1">
              <div className="hidden sm:block">{handle}</div>
              <div className="min-w-0 flex-1 py-0.5 sm:py-0">{children(`${path}.${index}`, index, items[index] as T)}</div>
            </div>
            <div className="mt-1 flex items-center justify-end sm:mt-0">
              <div className="mr-auto sm:hidden">{handle}</div>
              {arrows}
              <IconButton label={`Remove ${name(index)}`} icon="trash" className="hover:text-danger" onClick={() => setAt(path, items.filter((_, j) => j !== index))} />
            </div>
          </li>
        )}
      </SortableList>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
      <Button icon="plus" className="mt-2" onClick={() => setAt(path, [...items, make()])}>{addLabel}</Button>
    </fieldset>
  );
}

export function LinksEditor({ path, label = "Links" }: { path: string; label?: string }) {
  return (
    <RowList<{ label: string; url: string }> path={path} label={label} make={() => ({ label: "", url: "" })} addLabel="Add link" itemName="Link" labelOf={(l) => l.label} empty="No links yet.">
      {(p) => (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <TextField path={`${p}.label`} label="Label" required placeholder="GitHub" />
          <TextField path={`${p}.url`} label="URL" required type="url" placeholder="https://" />
        </div>
      )}
    </RowList>
  );
}

export function StringList({ path, label, description, addLabel, itemName, rows, make = "" }: { path: string; label: string; description?: string; addLabel: string; itemName: string; rows?: number; make?: string }) {
  return (
    <RowList<string> path={path} label={label} description={description} make={() => make} addLabel={addLabel} itemName={itemName} labelOf={(s, i) => (s ? s.slice(0, 40) : `${itemName} ${i + 1}`)} empty="None yet.">
      {(p, i) => <TextField path={p} label={`${itemName} ${i + 1}`} rows={rows} required />}
    </RowList>
  );
}

export function FormGrid({ children, cols = 2 }: { children: ReactNode; cols?: 1 | 2 }) {
  return <div className={`grid gap-4 ${cols === 2 ? "sm:grid-cols-2" : ""}`}>{children}</div>;
}
