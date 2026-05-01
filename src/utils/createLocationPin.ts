/**
 * Admin-location map pin — exact Figma SVG (36×41).
 *
 * DOM stacking order (bottom → top):
 *   svgBg  — pin body + dot + white circle bg + SVG <image> (clipPath clipped)
 *   svgFg  — badge circles                     ← always above the photo
 *   emoji  — HTML div                           ← always on top
 */
export function createLocationPinSVG(
  imageUrl: string,
  pinColor: string = '#14B8A6',
  emoji?: string,
): HTMLElement {
  // exact Figma canvas
  const W = 36;
  const H = 41;

  // inner white circle (image area)  — Figma: 3 → 28.5 → r=12.75
  const CX = 15.75;
  const CY = 15.75;
  const CR = 12.75;

  // badge — Figma: centre (25.5, 23.25), inner white r=6
  const BCX      = 25.5;
  const BCY      = 23.25;
  const BR_INNER = 6;

  const uid = `loc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const NS  = 'http://www.w3.org/2000/svg';

  const mk = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  /* ── wrapper ──────────────────────────────────────────────────────────── */
  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    `position:relative;width:${W}px;height:${H}px;overflow:visible;`;

  const sharedSvgStyle =
    'position:absolute;top:0;left:0;overflow:visible;display:block;pointer-events:none;';

  /* ══ LAYER 1 — background SVG: pin body + dot + white circle ════════════ */
  const svgBg = document.createElementNS(NS, 'svg');
  svgBg.setAttribute('width',   String(W));
  svgBg.setAttribute('height',  String(H));
  svgBg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgBg.setAttribute('fill',    'none');
  svgBg.style.cssText = sharedSvgStyle;

  // pin body (exact Figma path)
  svgBg.appendChild(mk('path', {
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    d: 'M15.75 0C24.4485 0 31.5 7.05152 31.5 15.75C31.5 23.3702 26.0883 29.7265 18.8985 31.1852L16.2393 34.9931C16.1841 35.0725 16.1109 35.1372 16.0257 35.182C15.9405 35.2267 15.846 35.25 15.75 35.25C15.654 35.25 15.5595 35.2267 15.4743 35.182C15.3891 35.1372 15.3159 35.0725 15.2607 34.9931L12.6015 31.1852C5.41168 29.7265 0 23.3702 0 15.75C0 7.05152 7.05152 0 15.75 0Z',
    fill: pinColor,
  }));

  // bottom dot (exact Figma path)
  svgBg.appendChild(mk('path', {
    d: 'M17.25 39C17.25 38.1716 16.5784 37.5 15.75 37.5C14.9216 37.5 14.25 38.1716 14.25 39C14.25 39.8284 14.9216 40.5 15.75 40.5C16.5784 40.5 17.25 39.8284 17.25 39Z',
    fill: pinColor,
  }));

  // defs: clipPath circle — exactly matches the inner image area
  const bgDefs = document.createElementNS(NS, 'defs');
  const clip   = document.createElementNS(NS, 'clipPath');
  clip.setAttribute('id', `${uid}-clip`);
  clip.appendChild(mk('circle', { cx: String(CX), cy: String(CY), r: String(CR) }));
  bgDefs.appendChild(clip);
  svgBg.appendChild(bgDefs);

  // white fallback circle (shown when image fails to load)
  svgBg.appendChild(mk('circle', { cx: String(CX), cy: String(CY), r: String(CR), fill: 'white' }));

  // photo — SVG <image> with clipPath: pixel-perfect, no border-radius gaps
  const imgEl = document.createElementNS(NS, 'image');
  imgEl.setAttribute('href',                imageUrl);
  imgEl.setAttribute('x',                   String(CX - CR));
  imgEl.setAttribute('y',                   String(CY - CR));
  imgEl.setAttribute('width',               String(CR * 2));
  imgEl.setAttribute('height',              String(CR * 2));
  imgEl.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  imgEl.setAttribute('clip-path',           `url(#${uid}-clip)`);
  svgBg.appendChild(imgEl);

  wrapper.appendChild(svgBg);

  /* ══ LAYER 3 — foreground SVG: badge + emoji (always above the photo) ═══ */
  const svgFg = document.createElementNS(NS, 'svg');
  svgFg.setAttribute('width',   String(W));
  svgFg.setAttribute('height',  String(H));
  svgFg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svgFg.setAttribute('fill',    'none');
  svgFg.style.cssText = sharedSvgStyle;

  // badge drop-shadow filter (exact Figma params)
  const defs = document.createElementNS(NS, 'defs');
  const makeFilter = (id: string) => {
    const f = mk('filter', {
      id,
      x: '15', y: '13.5', width: '21', height: '21',
      filterUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    f.append(
      mk('feFlood',       { 'flood-opacity': '0', result: 'BackgroundImageFix' }),
      mk('feColorMatrix', { in: 'SourceAlpha', type: 'matrix',
                            values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0',
                            result: 'hardAlpha' }),
      mk('feOffset',      { dy: '0.75' }),
      mk('feGaussianBlur',{ stdDeviation: '1.875' }),
      mk('feComposite',   { in2: 'hardAlpha', operator: 'out' }),
      mk('feColorMatrix', { type: 'matrix',
                            values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0' }),
      mk('feBlend', { mode: 'normal', in2: 'BackgroundImageFix',
                      result: 'effect1_dropShadow' }),
      mk('feBlend', { mode: 'normal', in: 'SourceGraphic',
                      in2: 'effect1_dropShadow', result: 'shape' }),
    );
    return f;
  };
  defs.append(makeFilter(`${uid}-f0`), makeFilter(`${uid}-f1`));
  svgFg.appendChild(defs);

  // badge outer white circle with drop shadow (exact Figma path)
  const gWhite = document.createElementNS(NS, 'g');
  gWhite.setAttribute('filter', `url(#${uid}-f0)`);
  gWhite.appendChild(mk('path', {
    d: 'M25.5 30C29.2279 30 32.25 26.9779 32.25 23.25C32.25 19.5221 29.2279 16.5 25.5 16.5C21.7721 16.5 18.75 19.5221 18.75 23.25C18.75 26.9779 21.7721 30 25.5 30Z',
    fill: 'white',
  }));
  svgFg.appendChild(gWhite);

  // badge colored ring (exact Figma path)
  const gRing = document.createElementNS(NS, 'g');
  gRing.setAttribute('filter', `url(#${uid}-f1)`);
  gRing.appendChild(mk('path', {
    d: 'M31.5 23.25C31.5 19.9363 28.8137 17.25 25.5 17.25C22.1863 17.25 19.5 19.9363 19.5 23.25C19.5 26.5637 22.1863 29.25 25.5 29.25V30C21.7721 30 18.75 26.9779 18.75 23.25C18.75 19.5221 21.7721 16.5 25.5 16.5C29.2279 16.5 32.25 19.5221 32.25 23.25C32.25 26.9779 29.2279 30 25.5 30V29.25C28.8137 29.25 31.5 26.5637 31.5 23.25Z',
    fill: pinColor,
  }));
  svgFg.appendChild(gRing);

  wrapper.appendChild(svgFg);

  /* ══ LAYER 4 — emoji: plain HTML div, always on top ══════════════════════ */
  // Plain HTML absolutely-positioned div — reliable color-emoji rendering.
  const emojiEl = document.createElement('div');
  emojiEl.style.cssText = [
    'position:absolute',
    `left:${BCX}px`,                  // 25.5 — badge centre x
    `top:${BCY}px`,                   // 23.25 — badge centre y
    'transform:translate(-50%,-50%)', // truly centred
    `width:${BR_INNER * 2}px`,        // 12px — inner badge diameter
    `height:${BR_INNER * 2}px`,       // 12px
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:9px',
    'line-height:1',
    'user-select:none',
    'pointer-events:none',
  ].join(';');
  if (!emoji) return wrapper;
  emojiEl.textContent = emoji;
  wrapper.appendChild(emojiEl);

  return wrapper;
}

export const LOCATION_PIN_COLORS = [
  { name: 'Red',    value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Yellow', value: '#EAB308' },
  { name: 'Lime',   value: '#84CC16' },
  { name: 'Green',  value: '#22C55E' },
  { name: 'Teal',   value: '#14B8A6' },
  { name: 'Blue',   value: '#3B82F6' },
  { name: 'Sky',    value: '#0EA5E9' },
  { name: 'Pink',   value: '#EC4899' },
  { name: 'Rose',   value: '#F43F5E' },
];
