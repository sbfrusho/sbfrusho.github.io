/**
 * Reordering by pointer (mouse, pen and touch), keyboard on the handle, or up/down buttons.
 * Pointer events rather than HTML drag-and-drop, because HTML drag-and-drop does not work on touch screens.
 */
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { announce } from "../store";
import { Icon, IconButton } from "./ui";

export interface SortRowProps {
  index: number;
  rowProps: { "data-sort-row": true; className: string };
  handle: ReactNode;
  arrows: ReactNode;
}

interface Props {
  id: string;
  count: number;
  onMove: (from: number, to: number) => void;
  labelOf: (index: number) => string;
  disabled?: boolean;
  className?: string;
  children: (row: SortRowProps) => ReactNode;
  as?: "ul" | "div";
}

export function SortableList({ id, count, onMove, labelOf, disabled, className = "", children }: Props) {
  const box = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);

  const move = (from: number, to: number, focusControl: "handle" | "up" | "down") => {
    if (to < 0 || to >= count || from === to) return;
    const label = labelOf(from);
    onMove(from, to);
    announce(`${label} moved to position ${to + 1} of ${count}.`);
    requestAnimationFrame(() => {
      const primary = document.getElementById(`${id}-${focusControl}-${to}`) as HTMLButtonElement | null;
      if (primary && !primary.disabled) primary.focus();
      else document.getElementById(`${id}-handle-${to}`)?.focus();
    });
  };

  /** The index the dragged row ends up at if dropped at y. */
  const targetAt = (y: number, from: number) => {
    const rows = box.current ? Array.from(box.current.querySelectorAll<HTMLElement>(":scope > [data-sort-row]")) : [];
    let insertion = rows.length;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]!.getBoundingClientRect();
      if (y < r.top + r.height / 2) {
        insertion = i;
        break;
      }
    }
    return insertion > from ? insertion - 1 : insertion;
  };

  const startDrag = (index: number) => (e: PointerEvent<HTMLButtonElement>) => {
    if (disabled) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: index, over: index });
  };
  const onDragMove = (e: PointerEvent<HTMLButtonElement>) => {
    if (!drag) return;
    const over = targetAt(e.clientY, drag.from);
    if (over !== drag.over) setDrag({ ...drag, over });
  };
  const endDrag = () => {
    if (drag && drag.from !== drag.over) move(drag.from, drag.over, "handle");
    setDrag(null);
  };
  const onHandleKey = (index: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      move(index, index - 1, "handle");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      move(index, index + 1, "handle");
    } else if (e.key === "Escape") setDrag(null);
  };

  return (
    <ul ref={box} className={className} data-testid={id}>
      {Array.from({ length: count }, (_, index) => {
        const label = labelOf(index);
        const isDragged = drag?.from === index;
        const isTarget = !!drag && drag.over === index && drag.from !== index;
        const marker = isTarget ? (drag!.from < index ? "shadow-[0_2px_0_0_var(--accent)]" : "shadow-[0_-2px_0_0_var(--accent)]") : "";
        return children({
          index,
          rowProps: { "data-sort-row": true, className: `${isDragged ? "opacity-50" : ""} ${marker}` },
          handle: (
            <button
              type="button"
              id={`${id}-handle-${index}`}
              disabled={disabled}
              aria-label={`Reorder ${label}. Position ${index + 1} of ${count}. Use the up and down arrow keys.`}
              title="Drag, or use arrow keys"
              onPointerDown={startDrag(index)}
              onPointerMove={onDragMove}
              onPointerUp={endDrag}
              onPointerCancel={() => setDrag(null)}
              onKeyDown={onHandleKey(index)}
              className="flex h-11 w-8 flex-none touch-none cursor-grab items-center justify-center rounded text-ink-3 hover:text-ink active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
            >
              <Icon name="grip" />
            </button>
          ),
          arrows: (
            <span className="flex flex-none">
              <IconButton id={`${id}-up-${index}`} label={`Move ${label} up`} icon="up" disabled={disabled || index === 0} onClick={() => move(index, index - 1, "up")} />
              <IconButton id={`${id}-down-${index}`} label={`Move ${label} down`} icon="down" disabled={disabled || index === count - 1} onClick={() => move(index, index + 1, "down")} />
            </span>
          ),
        });
      })}
    </ul>
  );
}
