/** List + editor for any array of items with ids: create, edit, duplicate, delete, search and reorder. */
import { useMemo, useState, type ReactNode } from "react";
import type { AreaKey } from "../lib/content";
import { same } from "../lib/content";
import { newId } from "../lib/names";
import { moveItem } from "../lib/paths";
import { navigate, useRoute } from "../route";
import { confirmDialog, getAt, getState, mutateDraft, promptDialog, setAt, toast, useStore } from "../store";
import { SortableList } from "./Sortable";
import { Badge, Button, Card, EmptyState, Icon, PageHeader } from "./ui";

interface Item {
  id: string;
}

interface Props<T extends Item> {
  area: AreaKey;
  title: string;
  description?: string;
  singular: string;
  /** The field that names an item, asked for on create. */
  titleKey: keyof T & string;
  titlePrompt: string;
  blank: (id: string, title: string) => T;
  meta?: (item: T) => string;
  badges?: (item: T) => ReactNode;
  editor: (path: string, item: T) => ReactNode;
  searchText?: (item: T) => string;
  headerActions?: ReactNode;
}

export function Collection<T extends Item>({ area, title, description, singular, titleKey, titlePrompt, blank, meta, badges, editor, searchText, headerActions }: Props<T>) {
  const items = useStore((s) => s.draft?.[area]) as unknown as T[];
  const baseItems = useStore((s) => s.base?.content?.[area]) as unknown as T[] | undefined;
  const { param } = useRoute();
  const [query, setQuery] = useState("");
  const lower = singular.toLowerCase();

  const selectedIndex = param ? items.findIndex((i) => i.id === param) : -1;
  const selected = selectedIndex >= 0 ? items[selectedIndex] : undefined;
  const label = (it: T) => String(it[titleKey] ?? "") || `Untitled ${lower}`;

  const changed = useMemo(() => {
    const byId = new Map((baseItems ?? []).map((b) => [b.id, b]));
    const out = new Map<string, "new" | "edited">();
    for (const it of items) {
      const b = byId.get(it.id);
      if (!b) out.set(it.id, "new");
      else if (!same(b, it)) out.set(it.id, "edited");
    }
    return out;
  }, [items, baseItems]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchText) return items;
    return items.filter((i) => searchText(i).toLowerCase().includes(q));
  }, [items, query, searchText]);

  const allIds = () => (getState().draft?.[area] as unknown as Item[]).map((i) => i.id);

  const create = async () => {
    const value = await promptDialog({ title: `New ${lower}`, prompt: { label: titlePrompt, required: true }, confirmLabel: "Create" });
    if (!value) return;
    const id = newId(value, allIds(), lower.replace(/\W+/g, "-"));
    setAt(area, [blank(id, value), ...(getAt(area) as T[])]);
    navigate(`${area}/${id}`);
  };

  const duplicate = (item: T, index: number) => {
    const name = `${label(item)} (copy)`;
    const id = newId(name.replace(" (copy)", "-copy"), allIds(), lower);
    const copy = { ...structuredClone(item), id, [titleKey]: name };
    const list = (getAt(area) as T[]).slice();
    list.splice(index + 1, 0, copy);
    setAt(area, list);
    navigate(`${area}/${id}`);
    toast("success", `Duplicated as "${name}".`);
  };

  const remove = async (item: T) => {
    const ok = await confirmDialog({
      title: `Delete this ${lower}?`,
      body: `"${label(item)}" will be removed from your draft, and from the live site when you publish.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    mutateDraft((c) => ({ ...c, [area]: (c[area] as unknown as T[]).filter((i) => i.id !== item.id) }));
    navigate(area);
    toast("info", `Deleted "${label(item)}" from the draft.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Content"
        title={title}
        description={description}
        actions={
          <>
            {headerActions}
            <Button variant="primary" icon="plus" className="order-first sm:order-none" onClick={create}>Add {lower}</Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className={selected ? "hidden lg:block" : ""}>
          {searchText && items.length > 3 && (
            <div className="relative mb-2">
              <Icon name="search" size={16} className="pointer-events-none absolute left-3 top-3.5 text-ink-3" />
              <input
                type="search"
                aria-label={`Search ${title.toLowerCase()}`}
                placeholder={`Search ${title.toLowerCase()}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="min-h-11 w-full rounded-lg border border-line bg-surface py-2 pl-9 pr-3 text-base text-ink placeholder:text-ink-3 sm:text-sm"
              />
            </div>
          )}
          {items.length === 0 ? (
            <EmptyState title={`No ${title.toLowerCase()} yet`} action={<Button icon="plus" onClick={create}>Add {lower}</Button>}>
              Add the first one and it will appear on the site after you publish.
            </EmptyState>
          ) : visible.length === 0 ? (
            <EmptyState icon="search" title="No matches">Nothing matches "{query}".</EmptyState>
          ) : (
            <SortableList
              id={`list-${area}`}
              count={visible.length}
              disabled={visible !== items}
              labelOf={(i) => label(visible[i] as T)}
              onMove={(from, to) => setAt(area, moveItem(items, from, to))}
              className="overflow-hidden rounded-[var(--r-3)] border border-line bg-surface"
            >
              {({ index, rowProps, handle, arrows }) => {
                const it = visible[index] as T;
                const active = it.id === param;
                return (
                  <li key={it.id} {...rowProps} className={`flex items-center border-b border-line pl-1 last:border-b-0 ${active ? "bg-accent-soft" : ""} ${rowProps.className}`}>
                    {handle}
                    <a href={`#/${area}/${encodeURIComponent(it.id)}`} aria-current={active ? "true" : undefined} className="min-w-0 flex-1 rounded py-2 pr-1 hover:text-accent">
                      <span className="block truncate text-sm font-medium text-ink">{label(it)}</span>
                      <span className="flex flex-wrap items-center gap-1 pt-0.5 text-xs text-ink-2">
                        {meta && meta(it) && <span className="max-w-full min-w-0 truncate">{meta(it)}</span>}
                        {badges?.(it)}
                        {changed.get(it.id) === "new" && <Badge tone="accent">new</Badge>}
                        {changed.get(it.id) === "edited" && <Badge tone="accent">edited</Badge>}
                      </span>
                    </a>
                    {arrows}
                  </li>
                );
              }}
            </SortableList>
          )}
          {visible !== items && visible.length > 0 && <p className="mt-2 text-xs text-ink-2">Clear the search to reorder.</p>}
        </div>

        <div className={selected ? "" : "hidden lg:block"}>
          {selected ? (
            <div key={selected.id}>
              <div className="mb-3 flex flex-wrap items-center gap-1">
                <a href={`#/${area}`} className="inline-flex min-h-11 w-full items-center gap-1.5 rounded-lg px-1 text-sm font-medium text-ink-2 hover:text-ink lg:hidden">
                  <Icon name="back" size={16} /> All {title.toLowerCase()}
                </a>
                <span className="mr-auto hidden font-mono text-xs text-ink-2 lg:inline" title="Internal id">{selected.id}</span>
                <Button variant="ghost" icon="copy" className="ml-auto lg:ml-0" onClick={() => duplicate(selected, selectedIndex)}>Duplicate</Button>
                <Button variant="dangerGhost" icon="trash" onClick={() => remove(selected)}>Delete</Button>
              </div>
              {editor(`${area}.${selectedIndex}`, selected)}
            </div>
          ) : (
            items.length > 0 && (
              <Card>
                <p className="py-8 text-center text-sm text-ink-2">Choose {/^[aeiou]/.test(lower) ? "an" : "a"} {lower} to edit, or add a new one.</p>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
  );
}
