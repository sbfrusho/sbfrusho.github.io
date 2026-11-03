/**
 * Deterministic fallback covers for projects without an image.
 * The same id always yields the same art. Colours come from the --cover-* tokens, which hold in both themes.
 */
export const COVER_W = 800;
export const COVER_H = 500;

export interface Shape {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
  fill: string;
  stroke?: string;
  opacity?: number;
}

export interface Cover {
  background: string;
  shapes: Shape[];
  /** Pre-built path groups, used by the heatmap to keep markup small. */
  paths: { d: string; fill: string; opacity?: number; stroke?: string; strokeWidth?: number }[];
}

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function prng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const range = (rand: () => number, min: number, max: number) => min + rand() * (max - min);

/** A wave of phone silhouettes rising from the bottom edge. One is lit. */
function mobile(rand: () => number): Cover {
  const shapes: Shape[] = [];
  const count = 5;
  const phoneW = 108;
  const gap = 24;
  const left = (COVER_W - (phoneW * count + gap * (count - 1))) / 2;
  const phase = range(rand, 0, Math.PI * 2);
  const freq = range(rand, 0.7, 1.25);
  const tops = Array.from({ length: count }, (_, i) => 190 + 118 * Math.sin(phase + i * freq));
  const lit = tops.indexOf(Math.min(...tops));
  tops.forEach((y, i) => {
    const x = left + i * (phoneW + gap);
    const on = i === lit;
    shapes.push({ x, y, w: phoneW, h: COVER_H, r: 20, fill: on ? "var(--cover-1)" : "var(--cover-3)", stroke: on ? undefined : "var(--cover-2)" });
    const ink = on ? "var(--cover-bg)" : "var(--cover-2)";
    shapes.push({ x: x + phoneW / 2 - 15, y: y + 13, w: 30, h: 6, r: 3, fill: ink });
    let cy = y + 36;
    const blockH = range(rand, 70, 130);
    shapes.push({ x: x + 12, y: cy, w: phoneW - 24, h: blockH, r: 8, fill: ink, opacity: on ? 0.9 : 0.55 });
    cy += blockH + 10;
    while (cy < COVER_H) {
      shapes.push({ x: x + 12, y: cy, w: (phoneW - 24) * range(rand, 0.45, 1), h: 9, r: 4.5, fill: ink, opacity: on ? 0.9 : 0.55 });
      cy += 27;
    }
  });
  return { background: "var(--cover-bg)", shapes, paths: [] };
}

/** An attention map with a detection box around its peak. */
function ai(rand: () => number): Cover {
  const cols = 20;
  const rows = 13;
  const cell = COVER_W / cols;
  const main = { x: range(rand, 7, cols - 7), y: range(rand, 5, rows - 5), s: range(rand, 2, 2.6), a: 1 };
  const peaks = [
    main,
    ...Array.from({ length: 2 }, () => ({
      x: range(rand, 1, cols - 1),
      y: range(rand, 1, rows - 1),
      s: range(rand, 1.2, 2),
      a: range(rand, 0.35, 0.6),
    })),
  ];
  const levels = [0.07, 0.17, 0.34, 0.6, 1];
  const buckets: string[] = levels.map(() => "");
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const value = peaks.reduce((sum, p) => {
        const d = (col + 0.5 - p.x) ** 2 + (row + 0.5 - p.y) ** 2;
        return sum + p.a * Math.exp(-d / (2 * p.s * p.s));
      }, 0);
      const noisy = value + (rand() - 0.5) * 0.1;
      const level = Math.min(levels.length - 1, Math.max(0, Math.floor(noisy * levels.length)));
      const s = cell - 3;
      buckets[level] += `M${col * cell + 1.5} ${row * cell + 1.5}h${s}v${s}h${-s}z`;
    }
  }
  const half = main.s * 1.7 * cell;
  const x0 = main.x * cell - half;
  const x1 = main.x * cell + half;
  const y0 = main.y * cell - half * 0.85;
  const y1 = main.y * cell + half * 0.85;
  const t = 36;
  const brackets =
    `M${x0} ${y0 + t}V${y0}H${x0 + t}M${x1 - t} ${y0}H${x1}V${y0 + t}` +
    `M${x1} ${y1 - t}V${y1}H${x1 - t}M${x0 + t} ${y1}H${x0}V${y1 - t}`;
  return {
    background: "var(--cover-bg)",
    shapes: [],
    paths: [
      ...buckets.map((d, i) => ({ d, fill: "var(--cover-1)", opacity: levels[i] })),
      { d: brackets, fill: "none", stroke: "var(--cover-ink)", strokeWidth: 4 },
    ],
  };
}

/** A browser window whose layout is a seeded recursive split. */
function web(rand: () => number): Cover {
  const fx = 76;
  const fy = 64;
  const shapes: Shape[] = [
    { x: fx, y: fy, w: COVER_W, h: COVER_H, r: 16, fill: "var(--cover-3)", stroke: "var(--cover-2)" },
  ];
  for (let i = 0; i < 3; i++) {
    shapes.push({ x: fx + 22 + i * 20, y: fy + 18, w: 10, h: 10, r: 5, fill: "var(--cover-2)" });
  }
  const tiles: { x: number; y: number; w: number; h: number }[] = [];
  const split = (x: number, y: number, w: number, h: number, depth: number) => {
    if (depth === 0 || w < 170 || h < 110) {
      tiles.push({ x, y, w, h });
      return;
    }
    const gap = 12;
    const ratio = range(rand, 0.36, 0.64);
    if (w / h > 1.2) {
      const a = (w - gap) * ratio;
      split(x, y, a, h, depth - 1);
      split(x + a + gap, y, w - gap - a, h, depth - 1);
    } else {
      const a = (h - gap) * ratio;
      split(x, y, w, a, depth - 1);
      split(x, y + a + gap, w, h - gap - a, depth - 1);
    }
  };
  split(fx + 22, fy + 46, COVER_W - fx, COVER_H - fy - 46 + 20, 3);
  const lit = Math.floor(rand() * tiles.length);
  tiles.forEach((tile, i) => {
    shapes.push({ ...tile, r: 8, fill: i === lit ? "var(--cover-1)" : "var(--cover-2)", opacity: i === lit ? 1 : range(rand, 0.45, 1) });
  });
  return { background: "var(--cover-bg)", shapes, paths: [] };
}

export function makeCover(id: string, category: string): Cover {
  const rand = prng(hash(`${category}:${id}`));
  if (category === "AI & ML") return ai(rand);
  if (category === "Web") return web(rand);
  return mobile(rand);
}
