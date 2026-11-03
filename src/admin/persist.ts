/**
 * Draft autosave. Text goes to localStorage, pending binaries to IndexedDB.
 * The token is never part of anything stored here.
 */
import type { Content } from "../lib/schema";

const KEY = "admin.draft.v1";
const DB = "sbfrusho-admin";
const STORE = "uploads";

export interface UploadMeta {
  path: string;
  publicPath: string;
  type: string;
  size: number;
  label: string;
}

export interface SavedDraft {
  v: 1;
  login: string;
  savedAt: number;
  baseCommitSha: string;
  baseContent: Content | null;
  draft: Content;
  deletions: string[];
  uploads: UploadMeta[];
}

export function readSavedDraft(): SavedDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.v === 1 && parsed.draft ? (parsed as SavedDraft) : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused (quota or blocked storage). */
export function writeSavedDraft(saved: SavedDraft): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(saved));
    return true;
  } catch {
    return false;
  }
}

export function clearSavedDraft(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
  void idbClear();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    t.onerror = t.onabort = () => {
      db.close();
      reject(t.error);
    };
  });
}

export async function idbPut(path: string, blob: Blob): Promise<boolean> {
  try {
    await tx("readwrite", (s) => s.put(blob, path));
    return true;
  } catch {
    return false;
  }
}

export async function idbGet(path: string): Promise<Blob | null> {
  try {
    return ((await tx<Blob | undefined>("readonly", (s) => s.get(path))) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function idbDelete(path: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(path));
  } catch {
    /* best effort */
  }
}

export async function idbClear(): Promise<void> {
  try {
    await tx("readwrite", (s) => s.clear());
  } catch {
    /* best effort */
  }
}
