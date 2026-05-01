import { getCategoryColor, getCategoryEmoji } from './eventCategories';

/**
 * Creates an event map pin SVG matching the Figma design.
 *
 * Structure (Figma-derived):
 *   • Teardrop body   — filled with the event category colour
 *   • Large white circle (r=18) — always shows the category emoji
 *   • Small badge circle (r=9)  — lower-right, shows the admin-chosen emoji
 *     (badgeEmoji = event.emoji set when the event was created)
 */
export function createEventPinSVG(eventType: string, badgeEmoji?: string): SVGElement {
  const PIN_W = 44;
  const PIN_H = 54;

  // Main circle (Figma: inner-white-r / outer-balloon-r = 12.75/15.75 = 81 %)
  const CX       = 22;
  const CY       = 21;
  const CIRCLE_R = 18;   // up from 17 — matches Figma proportion

  // Badge (Figma: centre offset +9.75, +7.5 from balloon centre, scaled to our r=21 balloon)
  // scale = 21/15.75 = 1.333 → offset (13, 10) → centre (35, 31)
  const BADGE_CX = 35;
  const BADGE_CY = 31;
  const BADGE_R  = 9;    // Figma: 6.75 × 1.333 ≈ 9

  const color        = getCategoryColor(eventType);
  const categoryEmoji = getCategoryEmoji(eventType);
  const uid    = `event-${eventType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const NS  = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width',   String(PIN_W));
  svg.setAttribute('height',  String(PIN_H));
  svg.setAttribute('viewBox', `0 0 ${PIN_W} ${PIN_H}`);
  svg.style.cssText = 'overflow:visible;display:block;';

  /* ── drop-shadow filter ─────────────────────────────────────────────────── */
  const defs   = document.createElementNS(NS, 'defs');
  const filter = document.createElementNS(NS, 'filter');
  filter.setAttribute('id',          `${uid}-shadow`);
  filter.setAttribute('x',           '0');
  filter.setAttribute('y',           '0');
  filter.setAttribute('width',       String(PIN_W));
  filter.setAttribute('height',      String(PIN_H));
  filter.setAttribute('filterUnits', 'userSpaceOnUse');
  filter.setAttribute('color-interpolation-filters', 'sRGB');

  const mk = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  filter.append(
    mk('feFlood',       { 'flood-opacity': '0', result: 'BackgroundImageFix' }),
    mk('feColorMatrix', { in: 'SourceAlpha', type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0', result: 'hardAlpha' }),
    mk('feOffset',      { dy: '1' }),
    mk('feGaussianBlur',{ stdDeviation: '2.5' }),
    mk('feComposite',   { in2: 'hardAlpha', operator: 'out' }),
    mk('feColorMatrix', { type: 'matrix', values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0' }),
    mk('feBlend',       { mode: 'normal', in2: 'BackgroundImageFix', result: 'effect1_dropShadow' }),
    mk('feBlend',       { mode: 'normal', in: 'SourceGraphic', in2: 'effect1_dropShadow', result: 'shape' }),
  );
  defs.appendChild(filter);
  svg.appendChild(defs);

  /* ── pin body (teardrop) ────────────────────────────────────────────────── */
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('filter', `url(#${uid}-shadow)`);
  const pinPath = mk('path', {
    'fill-rule': 'evenodd',
    'clip-rule': 'evenodd',
    // Same path as before — proportions are close to Figma at this scale
    d: 'M22 0C33.598 0 43 9.40202 43 21C43 31.1603 35.7844 39.6353 26.198 41.5803L22.6524 46.6575C22.5788 46.7633 22.4812 46.8497 22.3676 46.9093C22.254 46.9689 22.128 47 22 47C21.872 47 21.746 46.9689 21.6324 46.9093C21.5188 46.8497 21.4212 46.7633 21.3476 46.6575L17.802 41.5803C8.21557 39.6353 1 31.1603 1 21C1 9.40202 10.402 0 22 0Z',
    fill: color,
  });
  g.appendChild(pinPath);
  svg.appendChild(g);

  /* ── bottom dot ─────────────────────────────────────────────────────────── */
  svg.appendChild(mk('circle', { cx: '22', cy: '52', r: '2', fill: color }));

  /* ── main white circle (Figma: r proportional to 81 % of balloon) ────────── */
  svg.appendChild(mk('circle', {
    cx:   String(CX),
    cy:   String(CY),
    r:    String(CIRCLE_R),
    fill: 'white',
  }));

  /* ── event emoji (foreignObject for colour-emoji rendering) ─────────────── */
  const fo = document.createElementNS(NS, 'foreignObject');
  fo.setAttribute('x',      String(CX - CIRCLE_R));
  fo.setAttribute('y',      String(CY - CIRCLE_R));
  fo.setAttribute('width',  String(CIRCLE_R * 2));
  fo.setAttribute('height', String(CIRCLE_R * 2));

  const div = document.createElement('div');
  div.style.cssText =
    'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:20px;line-height:1;user-select:none;';
  div.textContent = categoryEmoji;
  fo.appendChild(div);
  svg.appendChild(fo);

  /* ── badge circle (Figma: small ring lower-right, white fill + colour border) */
  if (badgeEmoji) {
    // White separator ring — visually separates badge from pin body
    svg.appendChild(mk('circle', {
      cx:   String(BADGE_CX),
      cy:   String(BADGE_CY),
      r:    String(BADGE_R + 2),
      fill: 'white',
    }));

    // Badge fill with colour border
    svg.appendChild(mk('circle', {
      cx:             String(BADGE_CX),
      cy:             String(BADGE_CY),
      r:              String(BADGE_R),
      fill:           'white',
      stroke:         color,
      'stroke-width': '1',
    }));

    // Admin-chosen emoji centered in badge
    const badgeFo = document.createElementNS(NS, 'foreignObject');
    badgeFo.setAttribute('x',      String(BADGE_CX - BADGE_R));
    badgeFo.setAttribute('y',      String(BADGE_CY - BADGE_R));
    badgeFo.setAttribute('width',  String(BADGE_R * 2));
    badgeFo.setAttribute('height', String(BADGE_R * 2));

    const badgeDiv = document.createElement('div');
    badgeDiv.style.cssText =
      'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:11px;line-height:1;user-select:none;';
    badgeDiv.textContent = badgeEmoji;
    badgeFo.appendChild(badgeDiv);
    svg.appendChild(badgeFo);
  }

  return svg;
}
