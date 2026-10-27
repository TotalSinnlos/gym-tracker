import { type MouseEvent, type PointerEvent, useRef, useState } from "react";

/** How far (px) a finger moves sideways before it's a swipe rather than a tap or a scroll. */
const SLOP = 10;
/** How far a swipe has to go to flip. */
const FLIP = 72;

/**
 * Swiping sideways through things, like the exercises of a session. While a finger drags, `offset` follows
 * it (with resistance where there's nothing to flip to); let go far enough and `onFlip` gets -1 (previous,
 * swiped right) or 1 (next, swiped left). Scrolling up and down is left to the browser (see `.swipe`).
 */
export function useSwipe(onFlip: (direction: -1 | 1) => Promise<unknown>, can: { previous: boolean; next: boolean }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  // A swipe that ends over a button mustn't also press it.
  const swiped = useRef(false);
  const [offset, setOffset] = useState(0);

  function stop() {
    start.current = null;
    dragging.current = false;
  }

  return {
    offset,
    dragging: dragging.current,
    handlers: {
      onPointerDown(e: PointerEvent<HTMLElement>) {
        swiped.current = false;
        // Fingers only: with a mouse, dragging selects text.
        if (e.pointerType !== "mouse") start.current = { x: e.clientX, y: e.clientY };
      },
      onPointerMove(e: PointerEvent<HTMLElement>) {
        if (!start.current) return;
        const dx = e.clientX - start.current.x;
        const dy = e.clientY - start.current.y;
        if (!dragging.current) {
          if (Math.abs(dy) > SLOP && Math.abs(dy) > Math.abs(dx)) return stop();
          if (Math.abs(dx) < SLOP) return;
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        const blocked = dx > 0 ? !can.previous : !can.next;
        setOffset(blocked ? dx / 4 : dx);
      },
      onPointerUp(e: PointerEvent<HTMLElement>) {
        if (!start.current || !dragging.current) return stop();
        const dx = e.clientX - start.current.x;
        swiped.current = true;
        stop();
        const direction = dx <= -FLIP && can.next ? 1 : dx >= FLIP && can.previous ? -1 : 0;
        // When it flips, the next exercise replaces this one where it was let go.
        if (direction === 0) setOffset(0);
        else onFlip(direction).finally(() => setOffset(0));
      },
      onPointerCancel() {
        stop();
        setOffset(0);
      },
      onClickCapture(e: MouseEvent<HTMLElement>) {
        if (!swiped.current) return;
        swiped.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}
