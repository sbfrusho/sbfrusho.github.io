/** Drop zones, the square cropper, and the photo, cover and résumé upload fields. */
import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { COVER_MAX_PX, PHOTO_MAX_PX } from "../config";
import { clampCrop, cropRect, decodeImage, renderCrop, renderResized, UploadError, validatePdf, type CropState } from "../images";
import { formatBytes } from "../lib/encoding";
import { fieldId } from "../lib/paths";
import { safeFileName } from "../lib/names";
import { assetUrl, dropIfUnreferenced, getState, selectIssues, setAt, stageUpload, toast, useStore } from "../store";
import { Dialog } from "./Dialog";
import { useDraftValue } from "./Fields";
import { Button, Icon, Note, Spinner } from "./ui";

function takenNames(): string[] {
  const s = getState();
  return [...(s.base?.files ?? []).map((f) => f.path), ...s.uploads.map((u) => u.path)].map((p) => p.split("/").pop() ?? "");
}

function describe(e: unknown): string {
  return e instanceof UploadError ? e.message : "That file could not be processed.";
}

export function DropZone({ id, accept, onFile, title, hint, busy, compact }: { id: string; accept: string; onFile: (f: File) => void; title: string; hint: string; busy?: boolean; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      data-testid={`${id}-drop`}
      className={`rounded-lg border border-dashed transition-colors ${over ? "border-accent bg-accent-soft" : "border-ink-3/50"} ${compact ? "p-1" : "p-2"}`}
    >
      <button id={id} type="button" disabled={busy} onClick={() => input.current?.click()} className={`flex w-full items-center gap-3 rounded-md px-3 text-left hover:bg-surface-2 cursor-pointer disabled:cursor-wait ${compact ? "min-h-11 py-1.5" : "min-h-16 py-3"}`}>
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-surface-2 text-ink-2">{busy ? <Spinner /> : <Icon name="upload" />}</span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">{busy ? "Processing" : title}</span>
          <span className="block text-xs text-ink-2">{hint}</span>
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept={accept}
        tabIndex={-1}
        aria-hidden="true"
        data-testid={`${id}-input`}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) onFile(f);
        }}
      />
    </div>
  );
}

export function AssetImage({ path, alt = "", className = "" }: { path: string; alt?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [path]);
  if (failed) {
    return <span className={`flex items-center justify-center bg-surface-2 p-2 text-center text-xs text-ink-2 ${className}`}>Preview unavailable</span>;
  }
  return <img src={assetUrl(path)} alt={alt} onError={() => setFailed(true)} className={className} />;
}

/* ---------- cropper ---------- */

export function Cropper({ bitmap, onCancel, onApply }: { bitmap: ImageBitmap; onCancel: () => void; onApply: (c: CropState) => Promise<void> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [crop, setCrop] = useState<CropState>({ cx: 0.5, cy: 0.5, zoom: 1 });
  const [busy, setBusy] = useState(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const { width: w, height: h } = bitmap;

  useEffect(() => {
    const c = canvas.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const { sx, sy, side } = cropRect(w, h, crop);
    ctx.imageSmoothingQuality = "high";
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, c.width, c.height);
  }, [bitmap, crop, w, h]);

  const pan = (dxPx: number, dyPx: number, displayed: number) => {
    const { side } = cropRect(w, h, crop);
    setCrop(clampCrop(w, h, { ...crop, cx: crop.cx - (dxPx / displayed) * (side / w), cy: crop.cy - (dyPx / displayed) * (side / h) }));
  };
  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!last.current) return;
    pan(e.clientX - last.current.x, e.clientY - last.current.y, e.currentTarget.clientWidth);
    last.current = { x: e.clientX, y: e.clientY };
  };
  const onKey = (e: KeyboardEvent<HTMLCanvasElement>) => {
    const step = 16;
    const map: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const d = map[e.key];
    if (!d) return;
    e.preventDefault();
    pan(d[0], d[1], e.currentTarget.clientWidth);
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Crop photo"
      locked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="primary"
            busy={busy}
            data-testid="crop-apply"
            onClick={async () => {
              setBusy(true);
              await onApply(crop);
            }}
          >
            Use this crop
          </Button>
        </>
      }
    >
      <div className="mx-auto max-w-72">
        <canvas
          ref={canvas}
          width={560}
          height={560}
          tabIndex={0}
          role="img"
          aria-label="Crop preview. Drag, or use the arrow keys, to reposition."
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={() => (last.current = null)}
          onKeyDown={onKey}
          className="block aspect-square w-full touch-none cursor-move rounded-lg bg-surface-2"
        />
        <label htmlFor="crop-zoom" className="mb-1 mt-4 block text-sm font-medium">Zoom</label>
        <input
          id="crop-zoom"
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => setCrop(clampCrop(w, h, { ...crop, zoom: Number(e.target.value) }))}
          className="h-11 w-full cursor-pointer accent-accent"
        />
        <p className="text-xs text-ink-2">Drag the image to reposition. Saved as a square up to {PHOTO_MAX_PX}px.</p>
      </div>
    </Dialog>
  );
}

/* ---------- fields ---------- */

function FieldError({ message }: { message: string | null }) {
  return message ? <Note kind="error" className="mt-2">{message}</Note> : null;
}

function FieldFrame({ label, path, children }: { label: string; path: string; children: ReactNode }) {
  const error = useStore((s) => (s.showAllErrors ? selectIssues(s).find((i) => i.path === path)?.message : undefined));
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink">{label}</p>
      {children}
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}

export function PhotoField({ path }: { path: string }) {
  const value = useDraftValue<string>(path);
  const [bitmap, setBitmap] = useState<{ image: ImageBitmap; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      setBitmap({ image: await decodeImage(file), name: file.name });
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  const apply = async (crop: CropState) => {
    if (!bitmap) return;
    try {
      const out = await renderCrop(bitmap.image, crop, PHOTO_MAX_PX);
      const name = safeFileName(bitmap.name, out.ext, takenNames());
      const publicPath = `/uploads/${name}`;
      stageUpload({ publicPath, blob: out.blob, type: out.type, label: "profile photo" });
      const previous = value;
      setAt(path, publicPath);
      dropIfUnreferenced(previous);
      toast("success", `Photo ready (${formatBytes(out.blob.size)}). It goes live when you publish.`);
    } catch (e) {
      setError(describe(e));
    }
    bitmap.image.close();
    setBitmap(null);
  };

  return (
    <FieldFrame label="Profile photo" path={path}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="size-28 flex-none overflow-hidden rounded-[var(--r-3)] border border-line bg-surface-2" data-testid="photo-preview">
          {value ? <AssetImage path={value} alt="Current profile photo" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-ink-3"><Icon name="profile" size={28} /></span>}
        </div>
        <div className="min-w-0 flex-1">
          <DropZone id={fieldId(path)} accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onFile={pick} busy={busy} title={value ? "Replace photo" : "Upload photo"} hint="Drop or choose JPEG, PNG or WebP, up to 15 MB." />
          {value && (
            <Button
              variant="dangerGhost"
              icon="trash"
              className="mt-1"
              onClick={() => {
                setAt(path, "");
                dropIfUnreferenced(value);
              }}
            >
              Remove photo
            </Button>
          )}
          <FieldError message={error} />
        </div>
      </div>
      {bitmap && (
        <Cropper
          bitmap={bitmap.image}
          onApply={apply}
          onCancel={() => {
            bitmap.image.close();
            setBitmap(null);
          }}
        />
      )}
    </FieldFrame>
  );
}

export function CoverField({ path, baseName }: { path: string; baseName: string }) {
  const value = useDraftValue<string>(path);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const bitmap = await decodeImage(file);
      const out = await renderResized(bitmap, COVER_MAX_PX);
      bitmap.close();
      const name = safeFileName(baseName || file.name, out.ext, takenNames());
      const publicPath = `/uploads/${name}`;
      stageUpload({ publicPath, blob: out.blob, type: out.type, label: `cover for ${baseName}` });
      const previous = value;
      setAt(path, publicPath);
      dropIfUnreferenced(previous);
      toast("success", `Cover ready (${formatBytes(out.blob.size)}). It goes live when you publish.`);
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <FieldFrame label="Cover image" path={path}>
      {value && (
        <div className="mb-2 overflow-hidden rounded-[var(--r-3)] border border-line bg-surface-2" data-testid="cover-preview">
          <AssetImage path={value} alt="Current project cover" className="max-h-64 w-full object-cover" />
        </div>
      )}
      <DropZone id={fieldId(path)} accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onFile={pick} busy={busy} compact={!!value} title={value ? "Replace cover" : "Upload cover"} hint={`Resized to at most ${COVER_MAX_PX}px. Empty uses the designed cover.`} />
      {value && (
        <Button
          variant="dangerGhost"
          icon="trash"
          className="mt-1"
          onClick={() => {
            setAt(path, "");
            dropIfUnreferenced(value);
          }}
        >
          Remove cover
        </Button>
      )}
      <FieldError message={error} />
    </FieldFrame>
  );
}

export function PdfField({ path, baseName }: { path: string; baseName: string }) {
  const value = useDraftValue<string>(path);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      await validatePdf(file);
      const name = safeFileName(baseName || file.name, "pdf", takenNames());
      const publicPath = `/resume/${name}`;
      stageUpload({ publicPath, blob: file.slice(0, file.size, "application/pdf"), type: "application/pdf", label: baseName || "résumé" });
      const previous = value;
      setAt(path, publicPath);
      dropIfUnreferenced(previous);
      toast("success", "PDF ready. It goes live when you publish.");
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <FieldFrame label="PDF file" path={path}>
      {value && <p className="mb-1.5 truncate font-mono text-xs text-ink-2" title={value}>{value}</p>}
      <DropZone id={fieldId(path)} accept="application/pdf,.pdf" onFile={pick} busy={busy} compact title={value ? "Replace PDF" : "Upload PDF"} hint="PDF only, up to 5 MB." />
      <FieldError message={error} />
    </FieldFrame>
  );
}
