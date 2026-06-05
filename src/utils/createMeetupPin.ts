import { getMeetupPinColor } from './meetupPinColor';

export function createMeetupPinSVG(emoji: string, avatarUrl?: string | null): HTMLElement {
  const W = 49;
  const H = 54;
  const color = getMeetupPinColor(emoji);

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

  /* ── defs ── */
  const defs = document.createElementNS(NS, 'defs');

  /* shared filter builder (same structure as the reference SVG) */
  const makeFilter = (id: string, x: string, y: string, w: string, h: string) => {
    const f = mk('filter', {
      id, x, y, width: w, height: h,
      filterUnits: 'userSpaceOnUse',
      'color-interpolation-filters': 'sRGB',
    });
    f.appendChild(mk('feFlood',       { 'flood-opacity': '0', result: 'BackgroundImageFix' }));
    f.appendChild(mk('feColorMatrix', {
      in: 'SourceAlpha', type: 'matrix',
      values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0',
      result: 'hardAlpha',
    }));
    f.appendChild(mk('feOffset',       { dy: '0.75' }));
    f.appendChild(mk('feGaussianBlur', { stdDeviation: '1.875' }));
    f.appendChild(mk('feComposite',    { in2: 'hardAlpha', operator: 'out' }));
    f.appendChild(mk('feColorMatrix',  {
      type: 'matrix',
      values: '0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0',
    }));
    f.appendChild(mk('feBlend', { mode: 'normal', in2: 'BackgroundImageFix', result: 'shadow' }));
    f.appendChild(mk('feBlend', { mode: 'normal', in: 'SourceGraphic', in2: 'shadow', result: 'shape' }));
    return f;
  };

  defs.appendChild(makeFilter(`${uid}-f0`, '0',     '0',     '45.75', '53.0357'));
  defs.appendChild(makeFilter(`${uid}-f1`, '26.25', '21.75', '22.5',  '22.5'));

  /* clip path for avatar image */
  const clip = mk('clipPath', { id: `${uid}-clip` });
  clip.appendChild(mk('circle', { cx: 37.5, cy: 32.25, r: 7.5 }));
  defs.appendChild(clip);

  svg.appendChild(defs);

  /* ── group 0: main teardrop pin ── */
  const g0 = document.createElementNS(NS, 'g');
  g0.setAttribute('filter', `url(#${uid}-f0)`);
  g0.appendChild(mk('path', {
    'fill-rule': 'evenodd',
    'clip-rule':  'evenodd',
    d: 'M22.875 3C33.4374 3 42 11.5626 42 22.125C42 30.2237 36.9661 37.1466 29.8566 39.9357L23.9641 47.9899C23.8413 48.1585 23.6781 48.2961 23.4885 48.3911C23.299 48.4861 23.0884 48.5357 22.8748 48.5357C22.6611 48.5357 22.4506 48.4861 22.261 48.3911C22.0714 48.2961 21.9083 48.1585 21.7855 47.9899L15.8929 39.9354C8.78361 37.1463 3.75 30.2235 3.75 22.125C3.75 11.5626 12.3126 3 22.875 3Z',
    fill: color,
  }));
  svg.appendChild(g0);

  /* inner white circle — backdrop for emoji */
  svg.appendChild(mk('circle', { cx: 22.875, cy: 22.125, r: 16, fill: 'white' }));

  /* ── group 1: avatar badge circle ── */
  const g1 = document.createElementNS(NS, 'g');
  g1.setAttribute('filter', `url(#${uid}-f1)`);
  /* white fill */
  g1.appendChild(mk('path', {
    d: 'M37.5 39.75C41.6421 39.75 45 36.3921 45 32.25C45 28.1079 41.6421 24.75 37.5 24.75C33.3579 24.75 30 28.1079 30 32.25C30 36.3921 33.3579 39.75 37.5 39.75Z',
    fill: 'white',
  }));
  /* category-color stroke */
  g1.appendChild(mk('path', {
    d: 'M37.5 25.125C41.435 25.125 44.625 28.315 44.625 32.25C44.625 36.185 41.435 39.375 37.5 39.375C33.565 39.375 30.375 36.185 30.375 32.25C30.375 28.315 33.565 25.125 37.5 25.125Z',
    stroke: color,
    'stroke-width': '2.8',
  }));
  svg.appendChild(g1);

  /* ── avatar content ── */
  if (avatarUrl) {
    svg.appendChild(mk('image', {
      href: avatarUrl,
      x: 30, y: 24.75,
      width: 15, height: 15,
      'clip-path': `url(#${uid}-clip)`,
      preserveAspectRatio: 'xMidYMid slice',
    }));
  } else {
    /* person silhouette */
    const g = document.createElementNS(NS, 'g');
    g.appendChild(mk('circle', { cx: 37.5, cy: 30.4, r: 2.3, fill: color, opacity: '0.6' }));
    g.appendChild(mk('path', {
      d: 'M33.8,37.5 C33.8,34.9 35.4,33.4 37.5,33.4 C39.6,33.4 41.2,34.9 41.2,37.5',
      stroke: color, 'stroke-width': '1.2', fill: 'none',
      'stroke-linecap': 'round', opacity: '0.6',
    }));
    svg.appendChild(g);
  }

  wrapper.appendChild(svg);

  /* ── emoji overlay (HTML div for full-color emoji rendering) ── */
  const emojiEl = document.createElement('div');
  emojiEl.style.cssText = [
    'position:absolute',
    'left:22.875px',
    'top:22.125px',
    'transform:translate(-50%,-50%)',
    'width:26px',
    'height:26px',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'font-size:17px',
    'line-height:1',
    'user-select:none',
    'pointer-events:none',
  ].join(';');
  emojiEl.textContent = emoji;
  wrapper.appendChild(emojiEl);

  return wrapper;
}