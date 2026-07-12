/**
 * A community recommendation on the map, drawn as a CHAT BUBBLE rather than a pin — the author's
 * photo, the place they recommended, and a snippet of what they said. The tail points down at the
 * coordinate, so the marker is anchored 'bottom' like the teardrop pins.
 *
 *      ┌──────────────────────────┐
 *      │ (avatar)  🍜 Baan Thai   │
 *      │           "הכי טוב באי"  │
 *      └───────────▼──────────────┘   ← tail tip sits on the location
 */
export function createRecommendationBubble(o: {
  author: string;
  avatarUrl?: string | null;
  placeName: string;
  content?: string | null;
  emoji: string;
  color: string;
}): HTMLDivElement {
  const root = document.createElement('div');
  root.style.cssText = 'position:relative;display:flex;flex-direction:column;align-items:center;cursor:pointer;user-select:none;line-height:normal;';

  const bubble = document.createElement('div');
  bubble.style.cssText = [
    'display:flex', 'align-items:center', 'gap:8px',
    'background:#ffffff', 'border-radius:16px', 'padding:7px 9px',
    `box-shadow:0 5px 18px rgba(0,0,0,0.20), 0 1px 3px rgba(0,0,0,0.10), inset 0 0 0 1.5px ${o.color}30`,
    'max-width:208px', 'direction:rtl',
  ].join(';');

  /* author photo — the whole point of the bubble */
  const av = document.createElement('div');
  av.style.cssText = [
    'width:32px', 'height:32px', 'border-radius:50%', 'flex-shrink:0', 'overflow:hidden',
    `background:${o.color}`, 'display:grid', 'place-items:center',
    'color:#fff', 'font-family:Heebo,system-ui,sans-serif', 'font-weight:800', 'font-size:13px',
    `box-shadow:0 0 0 2px #fff, 0 1px 4px ${o.color}66`,
  ].join(';');
  if (o.avatarUrl) {
    const img = document.createElement('img');
    img.src = o.avatarUrl;
    img.decoding = 'async';
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
    img.addEventListener('error', () => { img.remove(); av.textContent = (o.author[0] || '?').toUpperCase(); });
    av.appendChild(img);
  } else {
    av.textContent = (o.author[0] || '?').toUpperCase();
  }

  const text = document.createElement('div');
  text.style.cssText = 'min-width:0;display:flex;flex-direction:column;gap:1px;';

  const title = document.createElement('div');
  title.style.cssText = [
    'font-family:Heebo,system-ui,sans-serif', 'font-weight:800', 'font-size:12.5px', 'color:#111827',
    'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'max-width:150px',
  ].join(';');
  title.textContent = `${o.emoji} ${o.placeName}`;

  text.appendChild(title);

  if (o.content) {
    const snippet = document.createElement('div');
    snippet.style.cssText = [
      'font-family:Heebo,system-ui,sans-serif', 'font-weight:600', 'font-size:11px', 'color:#8B90A0',
      'white-space:nowrap', 'overflow:hidden', 'text-overflow:ellipsis', 'max-width:150px',
    ].join(';');
    snippet.textContent = o.content;
    text.appendChild(snippet);
  }

  bubble.appendChild(av);
  bubble.appendChild(text);
  root.appendChild(bubble);

  /* the tail: points straight down at the coordinate */
  const tail = document.createElement('div');
  tail.style.cssText = [
    'width:0', 'height:0', 'margin-top:-1px',
    'border-left:7px solid transparent', 'border-right:7px solid transparent',
    'border-top:9px solid #ffffff',
    'filter:drop-shadow(0 2px 2px rgba(0,0,0,0.14))',
  ].join(';');
  root.appendChild(tail);

  return root;
}
