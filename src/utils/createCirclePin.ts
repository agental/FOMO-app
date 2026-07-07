/**
 * Apple-Maps-style circular map pin (shared builder for events, places & meetups).
 *
 * Selection is a SINGLE continuous morph (no element swap, no fade): the circle balloon is
 * a persistent element that grows ~8% and does a small left-right wobble, while the EXACT
 * user tail SVG + dot SVG stretch out beneath it to the coordinate. See setPinSelected.
 *
 * DOM shape:
 *   .fomo-pin                 ← marker root (anchor 'center'); size = circle diameter
 *     .fomo-pin-scale         ← zoom-driven scale target (inline transform)
 *       .fomo-pin-body        ← persistent balloon; on select grows + lifts
 *         .fomo-pin-wobble    ← plays the one-shot rotate wobble on select
 *           .fomo-pin-pulse / .fomo-pin-ping
 *           .fomo-pin-tail    ← EXACT tail SVG + dot SVG; stretches out on select
 *           .fomo-pin-circle  ← photo / colour circle + category ring + shadow
 *           .fomo-pin-badge   ← optional category badge
 *     .fomo-pin-label         ← name under the pin, hidden until zoomed-in / selected
 */

export type CirclePinVariant = 'photo' | 'color';

export interface CirclePinOptions {
  size: number;                 // circle diameter in px
  color: string;                // category colour — ring, tail & dot
  label: string;
  variant: CirclePinVariant;    // 'photo' = image fill, 'color' = solid colour + emoji
  imageUrl?: string | null;
  emoji?: string;
  badgeEmoji?: string;
  today?: boolean;
  emojiScale?: number;          // emoji size as a fraction of the diameter (default ~0.52)
}

/** Darken a #rrggbb colour by `amt` (0..1). */
function darken(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const f = (h: string) => Math.max(0, Math.round(parseInt(h, 16) * (1 - amt)));
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(f(m[1]))}${to(f(m[2]))}${to(f(m[3]))}`;
}

// EXACT tail shape (filter2) from the user's supplied SVG — rendered verbatim, tinted per category.
const TAIL_PATH =
  'M59.894 41.3814C59.0722 40.4644 58.1564 39.5677 57 39.1715C64.5 39.1715 73.5 38.6715 69.1222 39.379C67.9659 39.7752 66.9278 40.4644 66.106 41.3814C65.2842 42.2985 64.7057 43.4132 64.4251 44.6205L64.1476 45.7057C64.0959 45.9759 63.954 46.2196 63.7458 46.3956C63.5377 46.5716 63.2761 46.6691 63.0053 46.6715C62.7328 46.6716 62.4687 46.5752 62.2583 46.399C62.0479 46.2228 61.9045 45.9777 61.8524 45.7057L61.5749 44.6205C61.2943 43.4132 60.7158 42.2985 59.894 41.3814Z';

export function createCirclePin(o: CirclePinOptions): HTMLDivElement {
  const { size, color, variant } = o;

  const R      = size / 2;
  const ringPx = Math.max(4, Math.round(size * 0.09));
  const TAIL_W = Math.round(size * 0.42);
  const TAIL_H = Math.round(size * 0.26);
  const DOT_D  = Math.max(5, Math.round(size * 0.13));
  const GAP    = Math.round(size * 0.06);
  const TUCK   = Math.round(size * 0.06);
  const DDY    = R - TUCK + TAIL_H + GAP + DOT_D / 2; // centre → dot centre (unscaled)

  const root = document.createElement('div');
  root.className = 'fomo-pin';
  // MUST be `absolute` (see note): mapbox positions markers via `.mapboxgl-marker` + inline
  // transform; `relative` would drop the pin into normal flow.
  root.style.cssText = `position:absolute;width:${size}px;height:${size}px;cursor:pointer;user-select:none;`;
  root.dataset.ddy = String(DDY); // read by setPinSelected to lift the balloon so the dot lands on the coordinate

  const scale = document.createElement('div');
  scale.className = 'fomo-pin-scale';
  scale.style.cssText = 'position:absolute;inset:0;transform-origin:center;will-change:transform;';

  const body = document.createElement('div');
  body.className = 'fomo-pin-body';
  // grow + lift on select; transition inline so the morph works even without the <style> block
  body.style.cssText = 'position:absolute;inset:0;transform-origin:center;transform:scale(1);transition:transform 0.6s cubic-bezier(0.34,1.4,0.5,1);';

  const wobble = document.createElement('div');
  wobble.className = 'fomo-pin-wobble';
  wobble.style.cssText = 'position:absolute;inset:0;transform-origin:50% 100%;';

  /* "today" pulse */
  if (o.today) {
    const pulse = document.createElement('div');
    pulse.className = 'fomo-pin-pulse';
    pulse.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};`;
    wobble.appendChild(pulse);
  }

  /* one-shot ping ring on selection */
  const ping = document.createElement('div');
  ping.className = 'fomo-pin-ping';
  ping.style.cssText = `position:absolute;inset:0;border-radius:50%;border:2.5px solid ${color};`;
  wobble.appendChild(ping);

  /* tail (EXACT SVG) + dot (EXACT SVG), behind the circle, collapsed by default */
  const tail = document.createElement('div');
  tail.className = 'fomo-pin-tail';
  tail.style.cssText = [
    'position:absolute', 'left:50%', 'top:100%', `margin-top:${-TUCK}px`,
    `width:${TAIL_W}px`, `height:${TAIL_H + GAP + DOT_D}px`,
    'opacity:0', 'transform:translateX(-50%) scaleY(0)', 'transform-origin:top center',
    'transition:transform 0.6s cubic-bezier(0.34,1.4,0.5,1), opacity 0.3s ease',
    'pointer-events:none', 'filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.18))',
  ].join(';');

  const tailShape = document.createElement('div');
  tailShape.style.cssText = `position:absolute;top:0;left:50%;transform:translateX(-50%);width:${TAIL_W}px;height:${TAIL_H}px;`;
  tailShape.innerHTML = `<svg viewBox="57 39.17 12.12 7.5" width="${TAIL_W}" height="${TAIL_H}" style="display:block;overflow:visible" xmlns="http://www.w3.org/2000/svg"><path d="${TAIL_PATH}" fill="${color}"/></svg>`;
  tail.appendChild(tailShape);

  const dotShape = document.createElement('div');
  dotShape.style.cssText = `position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:${DOT_D}px;height:${DOT_D}px;`;
  dotShape.innerHTML = `<svg viewBox="105 55 4 4" width="${DOT_D}" height="${DOT_D}" style="display:block" xmlns="http://www.w3.org/2000/svg"><circle cx="107" cy="57" r="2" fill="${color}"/></svg>`;
  tail.appendChild(dotShape);

  wobble.appendChild(tail);

  /* the circle balloon: photo (or colour+emoji) inside a category-colour ring + soft shadow */
  const circle = document.createElement('div');
  circle.className = 'fomo-pin-circle';
  const baseShadow = `0 0 0 ${ringPx}px ${color}, 0 2px 6px rgba(0,0,0,0.28), 0 1px 2px rgba(0,0,0,0.16)`;
  circle.style.cssText = [
    'position:absolute', 'inset:0', 'border-radius:50%', 'overflow:hidden',
    `background:${variant === 'photo' ? '#fff' : `linear-gradient(150deg, ${color}, ${darken(color, 0.22)})`}`,
    `box-shadow:${baseShadow}`,
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');

  const addEmoji = (fill: boolean) => {
    const em = document.createElement('div');
    em.style.cssText = [
      `font-size:${Math.round(size * (o.emojiScale ?? (fill ? 0.52 : 0.5)))}px`, 'line-height:1', 'user-select:none',
      fill ? 'filter:drop-shadow(0 1px 1px rgba(0,0,0,0.25))' : '',
    ].join(';');
    em.textContent = o.emoji || '📍';
    circle.appendChild(em);
  };

  if (variant === 'photo' && o.imageUrl) {
    const img = document.createElement('img');
    img.src = o.imageUrl;
    img.decoding = 'async';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.addEventListener('error', () => {
      img.remove();
      circle.style.background = `linear-gradient(150deg, ${color}, ${darken(color, 0.22)})`;
      addEmoji(true);
    });
    circle.appendChild(img);
  } else {
    addEmoji(true);
  }

  wobble.appendChild(circle);

  /* tiny category badge */
  if (o.badgeEmoji) {
    const badge = document.createElement('div');
    badge.className = 'fomo-pin-badge';
    const bs = Math.round(size * 0.42);
    badge.style.cssText = [
      'position:absolute', 'right:-2px', 'bottom:-2px',
      `width:${bs}px`, `height:${bs}px`, 'border-radius:50%',
      'background:#fff', `box-shadow:0 0 0 1.5px ${color}, 0 1px 3px rgba(0,0,0,0.25)`,
      'display:flex', 'align-items:center', 'justify-content:center',
      `font-size:${Math.round(bs * 0.62)}px`, 'line-height:1',
    ].join(';');
    badge.textContent = o.badgeEmoji;
    wobble.appendChild(badge);
  }

  body.appendChild(wobble);
  scale.appendChild(body);
  root.appendChild(scale);

  /* label under the pin */
  const label = document.createElement('div');
  label.className = 'fomo-pin-label';
  label.textContent = o.label || '';
  label.style.cssText = [
    'position:absolute', 'top:100%', 'left:50%', 'transform:translate(-50%,5px)',
    'white-space:nowrap', 'max-width:132px', 'overflow:hidden', 'text-overflow:ellipsis',
    'font-family:Heebo,system-ui,sans-serif', 'font-size:11.5px', 'font-weight:700',
    'color:#111827', 'letter-spacing:0.01em', 'pointer-events:none',
    'text-shadow:0 1px 2px #fff,0 -1px 2px #fff,1px 0 2px #fff,-1px 0 2px #fff,0 0 3px #fff',
  ].join(';');
  root.appendChild(label);

  return root;
}

/** Cluster bubble — a colour circle with the child count, shown when zoomed out. */
export function createClusterBubble(count: number, color = '#F97316'): HTMLDivElement {
  const size = count < 10 ? 42 : count < 30 ? 50 : count < 80 ? 58 : 66;

  const root = document.createElement('div');
  root.className = 'fomo-cluster';
  root.style.cssText = `position:absolute;width:${size}px;height:${size}px;cursor:pointer;user-select:none;`;

  const halo = document.createElement('div');
  halo.style.cssText = `position:absolute;inset:0;border-radius:50%;background:${color};opacity:0.22;`;

  const inner = document.createElement('div');
  inner.className = 'fomo-cluster-inner';
  const pad = Math.round(size * 0.16);
  inner.style.cssText = [
    'position:absolute', `inset:${pad}px`, 'border-radius:50%', 'transform-origin:center',
    `background:linear-gradient(145deg, ${color}, ${darken(color, 0.28)})`,
    'box-shadow:0 0 0 3px #fff, 0 5px 14px rgba(0,0,0,0.32)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'color:#fff', 'font-family:Heebo,system-ui,sans-serif', 'font-weight:800',
    `font-size:${count < 100 ? 15 : 13}px`, 'letter-spacing:0.02em',
  ].join(';');
  inner.textContent = count < 1000 ? String(count) : `${(count / 1000).toFixed(1)}k`;

  root.appendChild(halo);
  root.appendChild(inner);
  return root;
}
