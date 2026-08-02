import { useEffect, type RefObject } from 'react';

/*
  WhatsApp / Telegram-grade keyboard handling — COMPOSITOR animation, no per-frame JS.

  The previous versions animated a `--kb` value every frame, which changed `height`
  (calc(100dvh - --kb)) → full layout reflow, and `scrollTop` → forced synchronous layout + repaint,
  every single frame, on top of the glass bars' `backdrop-filter` (blur recompute per frame). That is
  what produced ~3 FPS.

  This version does ZERO work per frame. When the keyboard starts moving we get the exact height +
  duration from the native wrapper (keyboardWillShow/Hide) and set, ONE time:
      element.style.transition = `transform <duration>ms <ios-curve>`
      element.style.transform  = `translate3d(0, -<height>px, 0)`
  on the message scroll area and the input bar. The browser then animates the transform entirely on
  the GPU compositor — no reflow, no repaint of the message list, no scroll mutation, no React render.
  Header is NOT transformed, so it stays perfectly fixed.

  • The messages ride up by the keyboard height (content rises with the keyboard; whatever you were
    reading rises with it — same as WhatsApp).
  • The input bar rides up by (height − safe-area-inset-bottom): when the keyboard is up it covers the
    home-indicator area, so the bar sits flush on the keyboard with no gap, using pure transform (no
    padding/layout change, so nothing re-measures or re-renders).

  No `--kb`, no requestAnimationFrame, no scrollTop writes, no height/padding writes during the move.
  On the plain web (no native bridge) we fall back to driving the same one-shot transform from
  visualViewport with a default duration.
*/

const IOS_KB_CURVE = 'cubic-bezier(0.38, 0.7, 0.125, 1)';

// env(safe-area-inset-bottom) in px, measured once (the keyboard covers this area when it's up).
let _safeBottom = -1;
function safeAreaBottom(): number {
  if (_safeBottom >= 0) return _safeBottom;
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    _safeBottom = probe.offsetHeight || 0;
    probe.remove();
  } catch { _safeBottom = 0; }
  return _safeBottom;
}

export function useKeyboardViewport<T extends HTMLElement>(
  rootRef: RefObject<T | null>,
  scrollRef?: RefObject<HTMLElement | null>,
  inputRef?: RefObject<HTMLElement | null>,
) {
  // Ask the native wrapper to disable the WebView's own page scroll while this chat is mounted, so
  // iOS can't scroll the page to reveal the input (that scroll is what made the fixed header flicker).
  useEffect(() => {
    const post = (on: boolean) => {
      const rn = (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView;
      try { rn?.postMessage(JSON.stringify({ type: 'keyboardLock', on })); } catch { /* ignore */ }
    };
    post(true);
    return () => post(false);
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;

    const lockScroll = () => {
      if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo(0, 0);
      const de = document.scrollingElement || document.documentElement;
      if (de && de.scrollTop !== 0) de.scrollTop = 0;
    };

    // Promote to a compositor layer so the transform animation is a pure GPU composite (no paint).
    const promote = (el: HTMLElement) => {
      if (el.style.willChange !== 'transform') { el.style.willChange = 'transform'; el.style.backfaceVisibility = 'hidden'; }
    };

    let curRise = 0; // rise currently committed (px). The keyboard covers (safe-area + rise) at the bottom.

    // FLIP animation. The STEADY state is real layout (extra scroll room via --kb-pad + a one-time
    // scrollTop shift) so every message — including the topmost — stays reachable. The MOVEMENT is a
    // pure GPU transform: we invert to the old position with no transition, then transition to 0. Zero
    // per-frame JS, zero scrollTop writes during the animation, zero layout thrash.
    const animate = (kb: number, duration: number) => {
      lockScroll();
      const sa = safeAreaBottom();
      // Rise = keyboard height − home-indicator strip (which the keyboard now covers). Keeps the input
      // flush on the keyboard and the last-message↔input gap unchanged.
      const targetRise = Math.max(0, kb - sa);
      if (targetRise === curRise) return;
      const delta = targetRise - curRise;
      const dur = Math.max(0, duration);
      const trans = `transform ${dur}ms ${IOS_KB_CURVE}`;
      const rootEl = rootRef.current || document.documentElement;
      const scrollEl = scrollRef?.current;
      const inputEl = inputRef?.current;

      if (scrollEl) {
        promote(scrollEl);
        // 1. Commit the new steady layout: grow/shrink the scroll room (so the top stays reachable) and
        //    shift the scroll so the content is bottom-anchored (moves WITH the keyboard by `delta`).
        //    Read scrollTop BEFORE touching --kb-pad: on CLOSE, shrinking the padding makes the browser
        //    auto-clamp scrollTop, and reading after that clamp would double-count the shift (−2·rise)
        //    and make the chat jump up. Capture `before` first, then set padding + the target scroll.
        const before = scrollEl.scrollTop;
        rootEl.style.setProperty('--kb-pad', `${targetRise}px`);
        scrollEl.style.transition = 'none';
        scrollEl.scrollTop = before + delta;
        const applied = scrollEl.scrollTop - before; // real shift vs the original position (post-clamp)
        // 2. Invert: translate back to exactly where it looked a moment ago (no transition → no motion).
        scrollEl.style.transform = `translate3d(0, ${applied}px, 0)`;
        void scrollEl.offsetHeight; // flush, so the transition below starts from the inverted position
        // 3. Play: let the compositor animate the transform to 0.
        scrollEl.style.transition = trans;
        scrollEl.style.transform = 'translate3d(0, 0, 0)';
      }

      if (inputEl) {
        promote(inputEl);
        inputEl.style.transition = trans;
        inputEl.style.transform = `translate3d(0, ${-targetRise}px, 0)`;
      }

      curRise = targetRise;
    };

    let nativeDriven = false;

    // Native, frame-accurate path: exact height + duration, delivered once at the start of the move.
    (window as unknown as { __fomoKeyboard?: (i: { height?: number; duration?: number }) => void }).__fomoKeyboard = (info) => {
      nativeDriven = true;
      const h = Math.max(0, info?.height || 0);
      const d = typeof info?.duration === 'number' && info.duration > 0 ? info.duration : 260;
      animate(h, d);
    };

    // Fallback (plain web / pre-native-build): one-shot from visualViewport, default duration.
    const onVV = () => {
      if (nativeDriven || !vv) return;
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      animate(kb, 260);
    };
    if (vv) {
      vv.addEventListener('resize', onVV);
      vv.addEventListener('scroll', onVV);
    }
    window.addEventListener('scroll', lockScroll, { passive: true });

    // WhatsApp-style keyboard dismiss: only a downward drag that STARTS in the strip just above the
    // input bar closes the keyboard. A drag anywhere else in the message list scrolls normally and
    // keeps the keyboard open (dragging on the whole list must NOT dismiss it).
    const DISMISS_ZONE = 90; // px above the input bar that arms the dismiss gesture
    let touchStartY = 0;
    let armed = false;            // did this gesture start in the dismiss zone with the keyboard open?
    let dismissedThisGesture = false;
    const keyboardOpen = () => {
      const ae = document.activeElement as HTMLElement | null;
      return !!ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA');
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0]?.clientY ?? 0;
      dismissedThisGesture = false;
      armed = false;
      if (!keyboardOpen()) return;
      const inputEl = inputRef?.current;
      if (!inputEl) return;
      const top = inputEl.getBoundingClientRect().top; // on-screen top of the input bar (transform-aware)
      if (touchStartY >= top - DISMISS_ZONE) armed = true; // started just above (or on) the input bar
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!armed || dismissedThisGesture) return;
      const dy = (e.touches[0]?.clientY ?? 0) - touchStartY;
      if (dy > 24 && keyboardOpen()) {
        (document.activeElement as HTMLElement).blur();
        dismissedThisGesture = true;
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });

    return () => {
      if (vv) {
        vv.removeEventListener('resize', onVV);
        vv.removeEventListener('scroll', onVV);
      }
      window.removeEventListener('scroll', lockScroll);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      (rootRef.current || document.documentElement).style.removeProperty('--kb-pad');
      delete (window as unknown as { __fomoKeyboard?: unknown }).__fomoKeyboard;
    };
  }, [rootRef, scrollRef, inputRef]);
}
