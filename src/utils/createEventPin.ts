import { getCategoryColor, getCategoryEmoji } from './eventCategories';

/**
 * Creates an event map pin — same SVG structure as createLocationPinSVG (Figma 36×41).
 * Color and content come from the event category / emoji.
 */
export function createEventPinSVG(eventType: string, badgeEmoji?: string, imageUrl?: string | null): SVGElement {
  // Exact Figma canvas — same as location pin
  const W = 36;
  const H = 41;

  // Inner white circle — same proportions as location pin
  const CX = 15.75;
  const CY = 15.75;
  const CR = 12.75;

  // Badge centre — same as location pin
  const BCX      = 25.5;
  const BCY      = 23.25;
  const BR_INNER = 6;

  const color         = getCategoryColor(eventType);
  const categoryEmoji = getCategoryEmoji(eventType);
  const uid           = `event-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const NS  = 'http://www.w3.org/2000/svg';

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

  /* ── defs: drop-shadow + clip path ─────────────────────────────────────── */
  const defs   = document.createElementNS(NS, 'defs');
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id',          `${uid}-shadow`);
  filter.setAttribute('x',           '0');
  filter.setAttribute('y',           '0');
  filter.setAttribute('width',       String(W));
  filter.setAttribute('height',      String(H));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');
  filter.append(
    mk('feFlood',       { 'flood-opacity': '0', result: 'BackgroundImageFix' }),
    mk('feColorMatrix', { in: 'SourceAlpha', type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0', result: 'hardAlpha' }),
    mk('feOffset',      { dy: '0.75' }),
    mk('feGaussianBlur',{ stdDeviation: '1.875' }),
    mk('feComposite',   { in2: 'hardAlpha', operator: 'out' }),
    mk('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0' }),
    mk('feBlend',       { mode: 'normal', in2: 'BackgroundImageFix', result: 'effect1_dropShadow' }),
    mk('feBlend',       { mode: 'normal', in: 'SourceGraphic', in2: 'effect1_dropShadow', result: 'shape' }),
  );
  defs.appendChild(filter);

  const mainClip = document.createElementNS(NS, 'clipPath');
  mainClip.setAttribute('id', `${uid}-clip`);
  mainClip.appendChild(mk('circle', { cx: String(CX), cy: String(CY), r: String(CR) }));
  defs.appendChild(mainClip);
  svg.appendChild(defs);

  /* ── pin body — exact Figma path from createLocationPinSVG ─────────────── */
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', `url(#${uid}-shadow)`);
  g.appendChild(mk('path', {
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M15.75 0C24.4485 0 31.5 7.05152 31.5 15.75C31.5 23.3702 26.0883 29.7265 18.8985 31.1852L16.2393 34.9931C16.1841 35.0725 16.1109 35.1372 16.0257 35.182C15.9405 35.2267 15.846 35.25 15.75 35.25C15.654 35.25 15.5595 35.2267 15.4743 35.182C15.3891 35.1372 15.3159 35.0725 15.2607 34.9931L12.6015 31.1852C5.41168 29.7265 0 23.3702 0 15.75C0 7.05152 7.05152 0 15.75 0Z',
    fill: color,
  }));
  svg.appendChild(g);

  /* ── bottom dot — exact Figma path from createLocationPinSVG ───────────── */
  svg.appendChild(mk('path', {
    d: 'M17.25 39C17.25 38.1716 16.5784 37.5 15.75 37.5C14.9216 37.5 14.25 38.1716 14.25 39C14.25 39.8284 14.9216 40.5 15.75 40.5C16.5784 40.5 17.25 39.8284 17.25 39Z',
    fill: color,
  }));

  /* ── main white circle ──────────────────────────────────────────────────── */
  svg.appendChild(mk('circle', { cx: String(CX), cy: String(CY), r: String(CR), fill: 'white' }));

  /* ── main circle content: event image OR category emoji ─────────────────── */
  if (imageUrl) {
    svg.appendChild(mk('image', {
      href:                imageUrl,
      x:                   String(CX - CR),
      y:                   String(CY - CR),
      width:               String(CR * 2),
      height:              String(CR * 2),
      'clip-path':         `url(#${uid}-clip)`,
      preserveAspectRatio: 'xMidYMid slice',
    }));
  } else {
    const fo = document.createElementNS(NS, 'foreignObject');
    fo.setAttribute('x',      String(CX - CR));
    fo.setAttribute('y',      String(CY - CR));
    fo.setAttribute('width',  String(CR * 2));
    fo.setAttribute('height', String(CR * 2));
    const div = document.createElement('div');
    div.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:14px;line-height:1;user-select:none;';
    div.textContent = categoryEmoji;
    fo.appendChild(div);
    svg.appendChild(fo);
  }

  /* ── badge — exact paths from createLocationPinSVG ──────────────────────── */
  if (badgeEmoji) {
    // outer white circle (r=6.75)
    svg.appendChild(mk('path', {
      d: 'M25.5 30C29.2279 30 32.25 26.9779 32.25 23.25C32.25 19.5221 29.2279 16.5 25.5 16.5C21.7721 16.5 18.75 19.5221 18.75 23.25C18.75 26.9779 21.7721 30 25.5 30Z',
      fill: 'white',
    }));

    // colored ring (r=6 inner)
    svg.appendChild(mk('path', {
      d: 'M31.5 23.25C31.5 19.9363 28.8137 17.25 25.5 17.25C22.1863 17.25 19.5 19.9363 19.5 23.25C19.5 26.5637 22.1863 29.25 25.5 29.25V30C21.7721 30 18.75 26.9779 18.75 23.25C18.75 19.5221 21.7721 16.5 25.5 16.5C29.2279 16.5 32.25 19.5221 32.25 23.25C32.25 26.9779 29.2279 30 25.5 30V29.25C28.8137 29.25 31.5 26.5637 31.5 23.25Z',
      fill: color,
    }));

    // badge emoji
    const badgeFo = document.createElementNS(NS, 'foreignObject');
    badgeFo.setAttribute('x',      String(BCX - BR_INNER));
    badgeFo.setAttribute('y',      String(BCY - BR_INNER));
    badgeFo.setAttribute('width',  String(BR_INNER * 2));
    badgeFo.setAttribute('height', String(BR_INNER * 2));
    const badgeDiv = document.createElement('div');
    badgeDiv.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:9px;line-height:1;user-select:none;';
    badgeDiv.textContent = badgeEmoji;
    badgeFo.appendChild(badgeDiv);
    svg.appendChild(badgeFo);
  }

  return svg;
}
