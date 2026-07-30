import { useEffect, useRef, type RefObject } from 'react';

/**
 * App-wide "swipe to go back" — the interactive, WhatsApp/Instagram style: the page FOLLOWS your finger
 * sideways as you drag from the edge, then either completes (slides off + goes back) or springs back.
 *
 * Usage: `const ref = useSwipeBack(onBack);` and attach `ref` to the screen's ROOT element. The element
 * is what we translate during the drag. Surfaces register on a shared STACK in mount order, so an overlay
 * on top of a screen (e.g. a group chat over Messages) handles the swipe first; when it closes the screen
 * beneath takes over — just like a native navigation stack.
 *
 * The gesture starts from the RIGHT edge (~44px) and drags left — RTL "back". We only hijack the touch
 * once it's clearly horizontal, so vertical scrolling, the map, and in-content carousels are unaffected.
 */

type Entry = { el: RefObject<HTMLElement | null>; onBack: () => void };

const stack: Entry[] = [];

let installed = false;

// live drag state
let entry: Entry | null = null;
let node: HTMLElement | null = null;
let dir = 0;            // +1 = dragging right (from left edge), -1 = dragging left (from right edge)
let startX = 0;
let startY = 0;
let startT = 0;
let width = 0;
let locked = false;    // committed to a horizontal back-drag
let dragging = false;

const EDGE = 44;        // px from an edge where a back-drag may begin
const LOCK = 8;         // px of movement before we decide the gesture's axis
const COMPLETE_FRAC = 0.4;   // dragged past this fraction of the width → complete
const FLICK_MS = 260;        // …or a quick flick past a smaller distance
const FLICK_FRAC = 0.14;

function reset() {
  entry = null;
  node = null;
  locked = false;
  dragging = false;
}

function onTouchStart(e: TouchEvent) {
  reset();
  if (stack.length === 0 || e.touches.length !== 1) return;
  const t = e.touches[0];
  const w = window.innerWidth;
  if (t.clientX < w - EDGE) return; // right edge only
  const top = stack[stack.length - 1];
  if (!top.el.current) return; // nothing to move → let it be a plain (non-swipe) screen
  entry = top;
  node = top.el.current;
  dir = -1; // drag left / inward from the right edge
  startX = t.clientX;
  startY = t.clientY;
  startT = Date.now();
  width = w;
}

function onTouchMove(e: TouchEvent) {
  if (!entry || !node) return;
  const t = e.touches[0];
  const dx = t.clientX - startX;
  const dy = t.clientY - startY;

  if (!locked) {
    if (Math.abs(dx) < LOCK && Math.abs(dy) < LOCK) return;
    // commit only to a clearly-horizontal drag heading inward from the edge
    if (Math.abs(dx) > Math.abs(dy) && (dir > 0 ? dx > 0 : dx < 0)) {
      locked = true;
      dragging = true;
      node.style.willChange = 'transform';
      node.style.transition = 'none';
    } else {
      reset(); // vertical scroll or wrong way — hand the touch back
      return;
    }
  }

  if (dragging) {
    e.preventDefault(); // we own this gesture now → stop the page scrolling under it
    let x = dx;
    if (dir > 0) x = Math.max(0, Math.min(width, x));
    else x = Math.min(0, Math.max(-width, x));
    node.style.transform = `translateX(${x}px)`;
    node.style.boxShadow = '0 0 40px rgba(0,0,0,0.18)';
  }
}

function settleBack(el: HTMLElement) {
  el.style.transition = 'transform 0.26s cubic-bezier(0.22,1,0.32,1)';
  el.style.transform = '';
  window.setTimeout(() => {
    el.style.transition = '';
    el.style.willChange = '';
    el.style.boxShadow = '';
  }, 280);
}

function onTouchEnd(e: TouchEvent) {
  const el = node;
  const ent = entry;
  const d = dir;
  const w = width;
  const wasDragging = dragging;
  const t0 = startT;
  reset();
  if (!el || !ent || !wasDragging) return;

  const t = e.changedTouches[0];
  const dx = t ? t.clientX - startX : 0;
  const dist = Math.abs(dx);
  const quick = Date.now() - t0 < FLICK_MS && dist > w * FLICK_FRAC;
  const far = dist > w * COMPLETE_FRAC;

  if (quick || far) {
    // slide the page the rest of the way off, then navigate back
    el.style.transition = 'transform 0.2s ease-out';
    el.style.transform = `translateX(${d > 0 ? w : -w}px)`;
    window.setTimeout(() => {
      ent.onBack();
      // if the element didn't unmount (spring case), clean it up
      el.style.transition = 'none';
      el.style.transform = '';
      el.style.willChange = '';
      el.style.boxShadow = '';
    }, 200);
  } else {
    settleBack(el); // not far enough — snap home
  }
}

function ensureInstalled() {
  if (installed) return;
  installed = true;
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: false }); // non-passive: we preventDefault mid-drag
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchcancel', () => { const el = node; reset(); if (el) settleBack(el); }, { passive: true });
}

/**
 * @param onBack  invoked when a back-swipe completes; nullish registers nothing.
 * @returns a ref to attach to the screen's root element (the thing that slides).
 */
export function useSwipeBack<T extends HTMLElement = HTMLElement>(onBack?: (() => void) | null): RefObject<T | null> {
  const elRef = useRef<T | null>(null);
  const cbRef = useRef(onBack);
  cbRef.current = onBack;
  useEffect(() => {
    if (!onBack) return;
    ensureInstalled();
    const e: Entry = { el: elRef as RefObject<HTMLElement | null>, onBack: () => cbRef.current?.() };
    stack.push(e);
    return () => {
      const i = stack.indexOf(e);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [!!onBack]);
  return elRef;
}
