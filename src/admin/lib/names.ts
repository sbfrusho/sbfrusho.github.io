/** Safe, unique identifiers and filenames. Pure apart from the random source. */
const FILE_RE = /^[A-Za-z0-9._-]+$/;

export function shortRandom(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => (b % 36).toString(36)).join("");
}

export function slugify(text: string, fallback = "item", maxLength = 40): string {
  const slug = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug || fallback;
}

/** slug + short random. Retries in the near-impossible event of a collision. */
export function newId(title: string, existing: Iterable<string>, fallback = "item"): string {
  const taken = new Set(existing);
  const slug = slugify(title, fallback);
  for (;;) {
    const id = `${slug}-${shortRandom()}`;
    if (!taken.has(id)) return id;
  }
}

/** A filename that matches the assetPath regex in schema.ts and is not already taken. */
export function safeFileName(original: string, ext: string, existing: Iterable<string> = []): string {
  const taken = new Set(existing);
  const stem = slugify(original.replace(/\.[^.]*$/, ""), "file");
  const cleanExt = ext.replace(/[^a-z0-9]/gi, "").toLowerCase();
  for (;;) {
    const name = `${stem}-${shortRandom()}.${cleanExt}`;
    if (FILE_RE.test(name) && !taken.has(name)) return name;
  }
}
