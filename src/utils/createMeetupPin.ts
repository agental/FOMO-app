/**
 * ישיבות map pin — chat-bubble shape, 48×58px.
 *
 * Design: warm gradient ring, white fill, emoji centered, small tail at bottom.
 * Distinct from event/place pins — signals "social & spontaneous".
 */
export function createMeetupPinSVG(emoji: string, attendeeCount: number = 0): HTMLElement {
  const W  = 48;
  const H  = 58;
  const R  = 22;   // circle radius
  const CX = 24;
  const CY = 24;

  const NS  = 'http://www.w3.org/2000/svg';
  const uid = `mu-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const mk = (tag: string, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };

  /* wrapper */
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:visible;`;

  /* SVG */
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width',   String(W));
  svg.setAttribute('height',  String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('fill',    'none');
  svg.style.cssText = 'position:absolute;top:0;left:0;overflow:visible;display:block;pointer-events:none;';

  /* defs: gradient + shadow filter */
  const defs = document.createElementNS(NS, 'defs');

  const grad = mk('linearGradient', {
    id: `${uid}-g`, x1: '0', y1: '0', x2: '1', y2: '1',
  });
  const s1 = mk('stop', { offset: '0%',   'stop-color': '#FF9F43' });
  const s2 = mk('stop', { offset: '100%', 'stop-color': '#EE5A24' });
  grad.appendChild(s1);
  grad.appendChild(s2);
  defs.appendChild(grad);

  /* drop shadow */
  const filt = mk('filter', {
    id: `${uid}-sh`, x: '-30%', y: '-30%', width: '160%', height: '160%',
    filterUnits: 'objectBoundingBox', 'color-interpolation-filters': 'sRGB',
  });
  filt.append(
    mk('feDropShadow', { dx: '0', dy: '2', stdDeviation: '3', 'flood-color': 'rgba(238,90,36,0.30)' }),
  );
  defs.appendChild(filt);
  svg.appendChild(defs);

  /* outer gradient ring */
  svg.appendChild(mk('circle', {
    cx: CX, cy: CY, r: R,
    fill: `url(#${uid}-g)`,
    filter: `url(#${uid}-sh)`,
  }));

  /* inner white circle */
  svg.appendChild(mk('circle', { cx: CX, cy: CY, r: R - 3, fill: 'white' }));

  /* tail: small downward triangle */
  svg.appendChild(mk('path', {
    d: `M${CX - 6},${CY + R - 2} L${CX},${H - 1} L${CX + 6},${CY + R - 2}Z`,
    fill: `url(#${uid}-g)`,
  }));

  /* attendee count badge (top-right), only if > 1 */
  if (attendeeCount > 1) {
    const bx = CX + R - 6;
    const by = CY - R + 6;
    svg.appendChild(mk('circle', { cx: bx, cy: by, r: 8, fill: '#FF9F43' }));
    const bt = document.createElementNS(NS, 'text');
    bt.setAttribute('x',           String(bx));
    bt.setAttribute('y',           String(by + 4));
    bt.setAttribute('text-anchor', 'middle');
    bt.setAttribute('font-size',   '9');
    bt.setAttribute('font-weight', '700');
    bt.setAttribute('fill',        'white');
    bt.setAttribute('font-family', 'system-ui, sans-serif');
    bt.textContent = attendeeCount > 9 ? '9+' : String(attendeeCount);
    svg.appendChild(bt);
  }

  wrapper.appendChild(svg);

  /* emoji — HTML div for color-emoji rendering */
  const emojiEl = document.createElement('div');
  emojiEl.style.cssText = [
    'position:absolute',
    `left:${CX}px`,
    `top:${CY}px`,
    'transform:translate(-50%,-50%)',
    'width:34px',
    'height:34px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:20px',
    'line-height:1',
    'user-select:none',
    'pointer-events:none',
  ].join(';');
  emojiEl.textContent = emoji;
  wrapper.appendChild(emojiEl);

  return wrapper;
}
