/**
 * A recommendation on the map = a round photo pin: the recommender's avatar as a glossy
 * "coin" that sits on the spot above a soft ground shadow.
 *
 * Why a circle: places are teardrops and events/meetups are plain dots, so a photo-in-a-ring
 * is its own silhouette — and the photo-as-head says "a person pinned their take here".
 *
 * When several recommendations share one spot they arrive as a GROUP: the head becomes a small fan
 * of photos with a count badge, so a popular place is one tidy stack instead of a pile of overlaps.
 *
 * The bottom-centre is the anchor point (just under the coin), so a Mapbox marker with
 * anchor 'bottom' plants it on the coord.
 */
export interface RecommendationPinOpts {
  avatarUrl?: string | null;
  name?: string | null;              // for the initial fallback when there's no photo
  color: string;                     // category colour → the head ring
  emoji: string;                     // category badge on the head
  count?: number;                    // group size; >1 draws the fan + count badge
  extraAvatars?: (string | null)[];  // up to 2 more photos for the fan behind the head
}

const W = 62;
const H = 56;
const HEAD = 40;                        // avatar diameter
const HEAD_CX = W / 2;
const HEAD_CY = 28;                     // head centre
const SHADOW_Y = H - 3;                 // soft ground shadow, just under the coin

function avatarNode(url: string | null | undefined, name: string | null | undefined, size: number, ring: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, 'border-radius:50%',
    'overflow:hidden', 'background:#fff',
    `box-shadow:0 0 0 2.5px #fff, 0 0 0 4.5px ${ring}`,
    'display:flex', 'align-items:center', 'justify-content:center',
    'flex-shrink:0',
  ].join(';');

  if (url) {
    const img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    el.appendChild(img);
  } else {
    // initial on the category colour
    const span = document.createElement('div');
    span.textContent = (name || 'מ').trim().charAt(0);
    span.style.cssText = [
      'width:100%', 'height:100%', 'display:flex', 'align-items:center', 'justify-content:center',
      `background:${ring}`, 'color:#fff', 'font-weight:800', `font-size:${Math.round(size * 0.44)}px`,
      "font-family:'Heebo',sans-serif",
    ].join(';');
    el.appendChild(span);
  }
  return el;
}

export function createRecommendationPin(opts: RecommendationPinOpts): HTMLElement {
  const { avatarUrl, name, color, emoji, count = 1, extraAvatars = [] } = opts;
  const NS = 'http://www.w3.org/2000/svg';

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;line-height:0;`;

  /* ── soft ground shadow (SVG behind everything) ── */
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;pointer-events:none;';
  svg.innerHTML = `
    <ellipse cx="${HEAD_CX}" cy="${SHADOW_Y}" rx="9" ry="2.6" fill="rgba(0,0,0,0.22)"/>
  `;
  wrap.appendChild(svg);

  /* ── head: the fan of photos (front one is the recommender) ── */
  const head = document.createElement('div');
  head.style.cssText = [
    'position:absolute', `left:${HEAD_CX}px`, `top:${HEAD_CY}px`,
    'transform:translate(-50%,-50%)', 'width:0', 'height:0',
    'display:flex', 'align-items:center', 'justify-content:center',
  ].join(';');

  // fan siblings sit BEHIND, rotated out to either side
  const fan = extraAvatars.slice(0, 2);
  fan.forEach((a, i) => {
    const c = avatarNode(a, null, HEAD - 8, '#FFFFFF');
    const dir = i === 0 ? -1 : 1;
    c.style.position = 'absolute';
    c.style.transform = `translateX(${dir * 11}px) translateY(-3px) rotate(${dir * 12}deg)`;
    c.style.filter = 'brightness(0.97)';
    c.style.zIndex = '0';
    head.appendChild(c);
  });

  const front = avatarNode(avatarUrl, name, HEAD, color);
  front.style.position = 'relative';
  front.style.zIndex = '2';
  // lift the coin off its ground shadow
  front.style.boxShadow = `${front.style.boxShadow}, 0 4px 9px rgba(0,0,0,0.22)`;
  head.appendChild(front);

  // glossy plastic highlight — sells the pushpin look
  const gloss = document.createElement('div');
  gloss.style.cssText = [
    'position:absolute', 'z-index:3', 'top:2px', 'left:8px',
    'width:14px', 'height:9px', 'border-radius:50%',
    'background:rgba(255,255,255,0.55)', 'filter:blur(1px)', 'pointer-events:none',
  ].join(';');
  head.appendChild(gloss);

  wrap.appendChild(head);

  /* ── category badge (bottom-right of the head) ── */
  const badge = document.createElement('div');
  badge.textContent = emoji;
  badge.style.cssText = [
    'position:absolute', 'z-index:4',
    `left:${HEAD_CX + HEAD / 2 - 8}px`, `top:${HEAD_CY + HEAD / 2 - 12}px`,
    'width:20px', 'height:20px', 'border-radius:50%',
    'background:#fff', 'box-shadow:0 1px 3px rgba(0,0,0,0.25)',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:12px', 'line-height:1',
  ].join(';');
  wrap.appendChild(badge);

  /* ── count badge (top-right) when it's a stack ── */
  if (count > 1) {
    const cnt = document.createElement('div');
    cnt.textContent = String(count);
    cnt.style.cssText = [
      'position:absolute', 'z-index:5',
      `left:${HEAD_CX + HEAD / 2 - 6}px`, `top:${HEAD_CY - HEAD / 2 - 6}px`,
      'min-width:20px', 'height:20px', 'padding:0 5px', 'border-radius:11px',
      `background:${color}`, 'color:#fff', 'box-shadow:0 1px 4px rgba(0,0,0,0.3), 0 0 0 2px #fff',
      'display:flex', 'align-items:center', 'justify-content:center',
      'font-size:11.5px', 'font-weight:800', "font-family:'Heebo',sans-serif", 'line-height:1',
    ].join(';');
    wrap.appendChild(cnt);
  }

  return wrap;
}
