/** Immutable get/set by dotted path, e.g. "projects.3.links.0.url". Pure. */
type Key = string | number;

export function parsePath(path: string): Key[] {
  return path === "" ? [] : path.split(".").map((p) => (/^\d+$/.test(p) ? Number(p) : p));
}

export function getIn(obj: unknown, path: string): any {
  let cur: any = obj;
  for (const k of parsePath(path)) {
    if (cur == null) return undefined;
    cur = cur[k];
  }
  return cur;
}

function setKeys(obj: any, keys: Key[], value: unknown): any {
  if (keys.length === 0) return value;
  const [head, ...rest] = keys as [Key, ...Key[]];
  const next = setKeys(obj?.[head], rest, value);
  if (Array.isArray(obj)) {
    const copy = obj.slice();
    copy[head as number] = next;
    return copy;
  }
  return { ...obj, [head]: next };
}

export function setIn<T>(obj: T, path: string, value: unknown): T {
  return setKeys(obj, parsePath(path), value);
}

/** DOM id of the control editing a path. Navigation from validation errors relies on this. */
export const fieldId = (path: string) => `f-${path.replace(/\./g, "-")}`;

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = list.slice();
  if (from < 0 || from >= copy.length || to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item as T);
  return copy;
}
