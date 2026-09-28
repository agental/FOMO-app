import { useRef, useState } from 'react';

/**
 * Swipe-down-to-dismiss for a bottom sheet. Attach `handlers` to the sheet root and pass the
 * inner scroll element's ref — the drag only engages on a DOWNWARD pull that starts while the
 * scroll body is at the top, so scrolling the content still works normally. Past `threshold`
 * on release the sheet is dismissed; otherwise it springs back.
 *
 * Wire-up in the sheet:
 *   transform:  entered ? `translateY(${dragY}px)` : 'translateY(100%)'
 *   transition: dragging ? 'none' : '<the sheet\'s open/close curve>'
 */
export function useSheetDrag(
  scrollRef: React.RefObject<HTMLElement | null>,
  onDismiss: () => void,
  threshold = 90,
) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const active = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    active.current = false;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const delta = e.touches[0].clientY - startY.current;
    if (!active.current) {
      const atTop = (scrollRef.current?.scrollTop ?? 0) <= 0;
      // engage only on a clear downward pull that begins at the top of the scroll area
      if (delta > 6 && atTop) { active.current = true; setDragging(true); }
      else return;
    }
    if (delta > 0) setDragY(delta);
    else { active.current = false; setDragging(false); setDragY(0); } // reversed up → hand back to scroll
  };

  const onTouchEnd = () => {
    startY.current = null;
    if (!active.current) return;
    active.current = false;
    setDragging(false);
    if (dragY > threshold) onDismiss();
    setDragY(0);
  };

  return { dragY, dragging, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
