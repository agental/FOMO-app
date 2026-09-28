/* The FOMO map-pin DOM subsystem, extracted VERBATIM from MapScreen so the Apple (MapKit) map renders and
   animates pins identically to the old Mapbox map: the same .fomo-pin > .fomo-pin-scale > (swing|body/tail)
   structure, the same select morph (knock/swing + grow + tail), the same zoom dot↔pin. Pure DOM — engine
   agnostic. The only change vs MapScreen: the zoom is passed in (Mapbox read it off the map instance). */
import { createEventPinSVG } from './createEventPin';
import { createChabadPinSVG } from './createChabadPin';
import { createPlacePinSVG } from './createLocationPin';
import { createRecommendationPin } from './createRecommendationPin';
import { getCategoryColor } from './eventCategories';
import { emojiColor } from './emojiColor';
import type { Event } from '../types/event';

export type LeafType = 'event' | 'chabad' | 'admin' | 'meetup';
export interface MapPoint { id: string; type: LeafType; lng: number; lat: number; title: string; data: any; }

export const PIN_DOT_ZOOM = 12;
export const MEETUP_PIN_ZOOM = 15;
export const PIN_DOT_D = 13;
const DOT_MIN = 3;
const DOT_FADE_RANGE = 5;
export const CHABAD_PURPLE = '#972689';
export const PLACE_PIN_SCALE = 1.0;
export const CHABAD_PIN_SCALE = 41 / 54;
export const FEATURED_PLACE_SCALE = 1.75; // places that crossed 50 likes (is_featured) get a big, prominent pin

const GROW_EASE = 'cubic-bezier(0.34, 1.42, 0.5, 1)';
const SHRINK_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const SELECT_SCALE = 1.08;

export function isTodayDate(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr), n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

/** anchor: 'bottom' (tip on the coord) for teardrops, 'center' for event circles. */
export function pinAnchor(type: LeafType): 'bottom' | 'center' {
  return type === 'event' ? 'center' : 'bottom';
}

function appendPinDot(root: HTMLElement, color: string, atBottom: boolean, emoji?: string) {
  const dot = document.createElement('div');
  dot.className = 'fomo-pin-dot';
  if (emoji) {
    // Meetups zoom out to a circle with the chosen emoji, styled EXACTLY like the meetup icon in the Messages
    // list: emoji-colour tinted background + an inset coloured ring (the "frame") + a soft coloured glow.
    // Fixed size — only the opacity fades in as you approach the pin-zoom threshold.
    const D = 28;
    const frame = emojiColor(emoji);
    dot.dataset.emojiDot = '1';
    dot.style.cssText = [
      'position:absolute', 'left:50%', atBottom ? 'top:100%' : 'top:50%',
      'transform:translate(-50%,-50%)', 'transform-origin:center',
      `width:${D}px`, `height:${D}px`, 'border-radius:50%',
      `background:${frame}1F`, `box-shadow:inset 0 0 0 2px ${frame}, 0 2px 7px ${frame}55, 0 1px 3px rgba(0,0,0,0.2)`,
      'display:none', 'align-items:center', 'justify-content:center',
      'pointer-events:none', 'transition:opacity 0.12s linear',
    ].join(';');
    const em = document.createElement('div');
    em.textContent = emoji;
    em.style.cssText = 'font-size:15px;line-height:1;user-select:none;';
    dot.appendChild(em);
  } else {
    dot.style.cssText = [
      'position:absolute', 'left:50%', atBottom ? 'top:100%' : 'top:50%',
      'transform:translate(-50%,-50%)', 'transform-origin:center',
      `width:${PIN_DOT_D}px`, `height:${PIN_DOT_D}px`, 'border-radius:50%',
      `background:${color}`, 'box-shadow:0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,0.4)',
      'display:none', 'pointer-events:none', 'transition:width 0.12s linear,height 0.12s linear,opacity 0.12s linear',
    ].join(';');
  }
  root.appendChild(dot);
}

function wrapTeardrop(inner: HTMLElement | SVGElement): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fomo-pin';
  root.style.cssText = 'position:absolute;cursor:pointer;user-select:none;line-height:0;';
  const scaleEl = document.createElement('div');
  scaleEl.className = 'fomo-pin-scale';
  scaleEl.style.cssText = 'transform-origin:center bottom;line-height:0;';
  const swingEl = document.createElement('div');
  swingEl.className = 'fomo-pin-swing';
  swingEl.style.cssText = 'transform-origin:center bottom;line-height:0;';
  swingEl.appendChild(inner);
  scaleEl.appendChild(swingEl);
  root.appendChild(scaleEl);
  return root;
}

export function buildLeafPin(pt: MapPoint): HTMLElement {
  let el: HTMLElement;
  let dotColor = '#F97316';
  let dotAtBottom = false;
  let dotEmoji: string | undefined; // meetups: zoom-out dot is a white circle with this emoji

  if (pt.type === 'event') {
    const e = pt.data as Event;
    el = createEventPinSVG(e.event_type || 'parties', e.emoji ?? undefined, e.image_url, isTodayDate(e.event_date), e.title || 'אירוע');
    dotColor = getCategoryColor(e.event_type || '');
  } else if (pt.type === 'chabad') {
    const chabadPin = createChabadPinSVG();
    chabadPin.style.transformOrigin = 'bottom center';
    // Chabad pin: CHABAD_PIN_SCALE (41/54) matches a normal place pin (41px); ×0.87 makes it a touch
    // smaller so it sits slightly under the other pins per request.
    chabadPin.style.transform = `scale(${CHABAD_PIN_SCALE * 0.87})`;
    el = wrapTeardrop(chabadPin);
    dotColor = CHABAD_PURPLE;
    dotAtBottom = true;
  } else if (pt.type === 'admin') {
    const l = pt.data as any;
    const raw = l.pin_color || '#EF4444';
    const pipe = raw.indexOf('|');
    const pinColor = pipe !== -1 ? raw.slice(0, pipe) : raw;
    const pinEmoji = (pipe !== -1 ? raw.slice(pipe + 1) : (l.emoji || undefined)) || '📍';
    const featured = !!l.is_featured; // crossed 50 likes → big, glowing, starred pin
    const adminPin = createPlacePinSVG(pinEmoji, pinColor);
    adminPin.style.transformOrigin = 'bottom center';
    adminPin.style.transform = `scale(${featured ? FEATURED_PLACE_SCALE : PLACE_PIN_SCALE})`;
    if (featured) {
      adminPin.style.filter = `drop-shadow(0 0 7px ${pinColor}) drop-shadow(0 3px 5px rgba(0,0,0,0.32))`;
      const star = document.createElement('div');
      star.textContent = '⭐';
      star.style.cssText = 'position:absolute;top:-5px;right:-5px;font-size:11px;line-height:1;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.35));';
      adminPin.appendChild(star);
    }
    el = wrapTeardrop(adminPin);
    dotColor = pinColor;
    dotAtBottom = true;
  } else {
    const m = pt.data as any;
    dotColor = emojiColor(m.emoji || '☕'); // same colour as the Messages meetup icon → avatar ring + zoom-out dot match
    const pin = createRecommendationPin({ avatarUrl: m.users?.avatar_url, name: m.users?.display_name, color: dotColor, emoji: m.emoji });
    el = wrapTeardrop(pin);
    el.dataset.dotZoom = String(MEETUP_PIN_ZOOM);
    dotAtBottom = true;
    dotEmoji = m.emoji || '☕'; // meetup zoom-out = white circle + this emoji
  }

  appendPinDot(el, dotColor, dotAtBottom, dotEmoji);
  return el;
}

/** Swap between the full pin and its colour dot based on the current zoom. */
export function setLeafDotMode(el: HTMLElement, selected: boolean, zoom: number) {
  const z = zoom;
  const threshold = Number(el.dataset.dotZoom) || PIN_DOT_ZOOM;
  const asDot = z < threshold && !selected;
  const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
  const dotEl = el.querySelector('.fomo-pin-dot') as HTMLElement | null;

  const mode = asDot ? 'dot' : 'pin';
  const crossedToPin = mode === 'pin' && el.dataset.leafMode === 'dot';
  el.dataset.leafMode = mode;

  if (scaleEl) {
    scaleEl.style.opacity = asDot ? '0' : '1';
    scaleEl.style.pointerEvents = asDot ? 'none' : '';
    if (crossedToPin) {
      const swing = el.querySelector('.fomo-pin-swing') as HTMLElement | null;
      if (swing) { swing.classList.remove('pin-pop'); void swing.offsetHeight; swing.classList.add('pin-pop'); }
    }
  }
  if (!dotEl) return;
  if (!asDot) { dotEl.style.display = 'none'; return; }
  const hideZoom = threshold - DOT_FADE_RANGE;
  if (z < hideZoom) { dotEl.style.display = 'none'; return; }
  const t = Math.max(0, Math.min(1, (z - hideZoom) / (threshold - hideZoom)));
  const isEmojiDot = dotEl.dataset.emojiDot === '1';
  dotEl.style.display = isEmojiDot ? 'flex' : 'block';
  dotEl.style.opacity = String(t);
  if (!isEmojiDot) {
    const d = DOT_MIN + t * (PIN_DOT_D - DOT_MIN);
    dotEl.style.width = `${d}px`;
    dotEl.style.height = `${d}px`;
  }
}

/** The single continuous select morph: knock/swing on the tip, grow the balloon + stretch the tail. */
export function setPinSelected(el: HTMLElement, selected: boolean, zoom: number) {
  const body = el.querySelector('.fomo-pin-body') as HTMLElement | null;
  const tail = el.querySelector('.fomo-pin-tail') as HTMLElement | null;
  const ddy = Number(el.dataset.ddy) || 40;
  if (selected) {
    el.classList.add('selected', 'show-label');
    el.style.zIndex = '6';
    const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
    const dotEl = el.querySelector('.fomo-pin-dot') as HTMLElement | null;
    if (scaleEl) { scaleEl.style.display = ''; scaleEl.style.opacity = '1'; scaleEl.style.pointerEvents = ''; }
    if (dotEl) dotEl.style.display = 'none';
    el.dataset.leafMode = 'pin';

    const swing = el.querySelector('.fomo-pin-swing') as HTMLElement | null;
    if (swing) {
      swing.style.animation = 'none';
      void swing.offsetHeight;
      swing.style.animation = 'fomo-pin-swing 0.78s cubic-bezier(0.28,0.9,0.4,1)';
    }
    const lift = ddy * SELECT_SCALE;
    if (body) { body.style.transitionTimingFunction = GROW_EASE; body.style.transform = `translateY(-${lift}px) scale(${SELECT_SCALE})`; }
    if (tail) { tail.style.transitionTimingFunction = GROW_EASE; tail.style.opacity = '1'; tail.style.transform = 'translateX(-50%) scaleY(1)'; }
  } else {
    el.classList.remove('selected');
    el.style.zIndex = '';
    if (body) { body.style.transitionTimingFunction = SHRINK_EASE; body.style.transform = 'scale(1)'; }
    if (tail) { tail.style.transitionTimingFunction = SHRINK_EASE; tail.style.opacity = '0'; tail.style.transform = 'translateX(-50%) scaleY(0)'; }
    setLeafDotMode(el, false, zoom);
  }
}

export function applyLeafScale(el: HTMLElement, scale: number, showLabels: boolean, selected: boolean, zoom: number) {
  const scaleEl = el.querySelector('.fomo-pin-scale') as HTMLElement | null;
  if (scaleEl) scaleEl.style.transform = `scale(${scale})`;
  el.classList.toggle('show-label', showLabels || selected);
  setPinSelected(el, selected, zoom);
}

/** The pin CSS (swing / wobble / pulse / ping / dot-reveal) — identical to MapScreen's, minus mapbox bits. */
export const PIN_CSS = `
.fomo-pin-label { opacity: 0; transition: opacity 0.18s ease; }
.fomo-pin.show-label .fomo-pin-label { opacity: 1; }
.fomo-pin.selected .fomo-pin-label { opacity: 0; }
.fomo-pin-ping { opacity: 0; }
.fomo-pin.selected .fomo-pin-ping { animation: fomo-tap-ping 0.55s ease-out; }
.fomo-pin-pulse { opacity: 0.35; animation: fomo-today-pulse 2s ease-in-out infinite; }
@keyframes fomo-today-pulse { 0%,100% { transform: scale(1); opacity: 0.35; } 50% { transform: scale(1.35); opacity: 0; } }
@keyframes fomo-tap-ping { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.9); opacity: 0; } }
.fomo-pin.selected .fomo-pin-wobble { animation: fomo-wobble 1s ease-out; }
@keyframes fomo-pin-swing {
  0% { transform: rotate(0deg); } 14% { transform: rotate(-14deg); } 32% { transform: rotate(10deg); }
  50% { transform: rotate(-6deg); } 66% { transform: rotate(3.4deg); } 80% { transform: rotate(-1.8deg); }
  92% { transform: rotate(0.8deg); } 100% { transform: rotate(0deg); }
}
@media (prefers-reduced-motion: reduce) { .fomo-pin-swing, .fomo-pin-swing.pin-pop { animation: none !important; } }
.fomo-pin-scale { transition: opacity 0.2s ease; }
@keyframes fomo-pin-pop { 0% { transform: scale(0.5); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
.fomo-pin-swing.pin-pop { animation: fomo-pin-pop 0.34s cubic-bezier(0.34,1.42,0.5,1); }
@keyframes fomo-wobble { 0% { transform: rotate(0deg); } 28% { transform: rotate(-4deg); } 55% { transform: rotate(2.4deg); } 78% { transform: rotate(-1.1deg); } 100% { transform: rotate(0deg); } }
`;
