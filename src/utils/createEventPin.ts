import { getCategoryColor, getCategoryEmoji } from './eventCategories';

/**
 * Creates an EVENT map pin — a rounded-SQUARE pin (vs. the circular pin used for
 * places/recommendations). The image sits inside a rounded square so events are
 * visually distinct from round recommendation pins. The whole SVG is scaled by
 * the map zoom (see getPinScale), so the square + image grow as you zoom in.
 */
export function createEventPinSVG(eventType: string, badgeEmoji?: string, imageUrl?: string | null, isToday?: boolean): SVGElement {
  const W = 40;
  const H = 46;

  // Rounded-square body
  const SX = 2;          // square x
  const SY = 2;          // square y
  const SS = 36;         // square size
  const SR = 11;         // corner radius
  const INSET = 3;       // image inset from the colored frame
  const IR = 7;          // image corner radius

  const color         = getCategoryColor(eventType);
  const categoryEmoji = getCategoryEmoji(eventType);
  const uid           = `event-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width',   String(W));
  svg.setAttribute('height',  String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('fill',    'none');
  svg.style.cssText = 'overflow:visible;display:block;';

  /* ── defs: drop-shadow + rounded-rect clip ─────────────────────────────── */
  const defs   = document.createElementNS(NS, 'defs');
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id',          `${uid}-shadow`);
  filter.setAttribute('x',           '-2');
  filter.setAttribute('y',           '-1');
  filter.setAttribute('width',       String(W + 4));
  filter.setAttribute('height',      String(H + 4));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.append(
    mk('feFlood',        { 'flood-opacity': '0', result: 'BackgroundImageFix' }),
    mk('feColorMatrix',  { in: 'SourceAlpha', type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0', result: 'hardAlpha' }),
    mk('feOffset',       { dy: '1' }),
    mk('feGaussianBlur', { stdDeviation: '2' }),
    mk('feComposite',    { in2: 'hardAlpha', operator: 'out' }),
    mk('feColorMatrix',  { type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.18 0' }),
    mk('feBlend',        { mode: 'normal', in2: 'BackgroundImageFix', result: 'effect1_dropShadow' }),
    mk('feBlend',        { mode: 'normal', in: 'SourceGraphic', in2: 'effect1_dropShadow', result: 'shape' }),
  );
  defs.appendChild(filter);

  const clip = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', `${uid}-clip`);
  clip.appendChild(mk('rect', { x: String(SX + INSET), y: String(SY + INSET), width: String(SS - INSET * 2), height: String(SS - INSET * 2), rx: String(IR), ry: String(IR) }));
  defs.appendChild(clip);
  svg.appendChild(defs);

  /* ── pulse rings for today's events (behind pin, at the tip) ──────────── */
  if (isToday) {
    const tipX = W / 2;
    const tipY = H - 2;
    for (let i = 0; i < 3; i++) {
      const ring = document.createElementNS(NS, 'circle');
      ring.setAttribute('cx', String(tipX));
      ring.setAttribute('cy', String(tipY));
      ring.setAttribute('r', '0');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', color);
      ring.setAttribute('stroke-width', i === 0 ? '2' : '1.5');

      const animR = document.createElementNS(NS, 'animate');
      animR.setAttribute('attributeName', 'r');
      animR.setAttribute('from', '4');
      animR.setAttribute('to', '32');
      animR.setAttribute('dur', '2s');
      animR.setAttribute('begin', `${i * 0.65}s`);
      animR.setAttribute('repeatCount', 'indefinite');
      ring.appendChild(animR);

      const animO = document.createElementNS(NS, 'animate');
      animO.setAttribute('attributeName', 'opacity');
      animO.setAttribute('from', '0.6');
      animO.setAttribute('to', '0');
      animO.setAttribute('dur', '2s');
      animO.setAttribute('begin', `${i * 0.65}s`);
      animO.setAttribute('repeatCount', 'indefinite');
      ring.appendChild(animO);

      svg.appendChild(ring);
    }
  }

  /* ── body: colored rounded square + downward tail (under one shadow) ────── */
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', `url(#${uid}-shadow)`);
  // tail (drawn first so the square overlaps its top edge cleanly)
  const cx = SX + SS / 2;
  g.appendChild(mk('path', { d: `M${cx - 6} ${SY + SS - 4} L${cx + 6} ${SY + SS - 4} L${cx} ${H - 2} Z`, fill: color }));
  // rounded square frame
  g.appendChild(mk('rect', { x: String(SX), y: String(SY), width: String(SS), height: String(SS), rx: String(SR), ry: String(SR), fill: color }));
  svg.appendChild(g);

  /* ── white inset behind the image ──────────────────────────────────────── */
  svg.appendChild(mk('rect', {
    x: String(SX + INSET), y: String(SY + INSET),
    width: String(SS - INSET * 2), height: String(SS - INSET * 2),
    rx: String(IR), ry: String(IR), fill: 'white',
  }));

  /* ── content: event image OR category emoji ────────────────────────────── */
  if (imageUrl) {
    svg.appendChild(mk('image', {
      href:                imageUrl,
      x:                   String(SX + INSET),
      y:                   String(SY + INSET),
      width:               String(SS - INSET * 2),
      height:              String(SS - INSET * 2),
      'clip-path':         `url(#${uid}-clip)`,
      preserveAspectRatio: 'xMidYMid slice',
    }));
  } else {
    const fo = document.createElementNS(NS, 'foreignObject');
    fo.setAttribute('x',      String(SX + INSET));
    fo.setAttribute('y',      String(SY + INSET));
    fo.setAttribute('width',  String(SS - INSET * 2));
    fo.setAttribute('height', String(SS - INSET * 2));
    const div = document.createElement('div');
    div.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;user-select:none;';
    div.textContent = categoryEmoji;
    fo.appendChild(div);
    svg.appendChild(fo);
  }

  /* ── badge — category emoji in a white circle at the bottom-right corner ── */
  if (badgeEmoji) {
    const bcx = SX + SS - 4;
    const bcy = SY + SS - 4;
    svg.appendChild(mk('circle', { cx: String(bcx), cy: String(bcy), r: '8', fill: 'white' }));
    svg.appendChild(mk('circle', { cx: String(bcx), cy: String(bcy), r: '8', fill: 'none', stroke: color, 'stroke-width': '1.5' }));
    const badgeFo = document.createElementNS(NS, 'foreignObject');
    badgeFo.setAttribute('x',      String(bcx - 6));
    badgeFo.setAttribute('y',      String(bcy - 6));
    badgeFo.setAttribute('width',  '12');
    badgeFo.setAttribute('height', '12');
    const badgeDiv = document.createElement('div');
    badgeDiv.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:10px;line-height:1;user-select:none;';
    badgeDiv.textContent = badgeEmoji;
    badgeFo.appendChild(badgeDiv);
    svg.appendChild(badgeFo);
  }

  return svg;
}
