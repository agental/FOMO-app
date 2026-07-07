// Map pin for admin "places" (and post recommendations) — see createPlacePinSVG.

/** Shade a #rrggbb colour: amt<0 darkens, amt>0 lightens (toward white). */
function shade(hex: string, amt: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const adj = (h: string) => {
    const v = parseInt(h, 16);
    const n = amt < 0 ? Math.round(v * (1 + amt)) : Math.round(v + (255 - v) * amt);
    return Math.max(0, Math.min(255, n));
  };
  const to = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to(adj(m[1]))}${to(adj(m[2]))}${to(adj(m[3]))}`;
}

/**
 * Modern place pin (36×41) — a glossy teardrop whose head is a vertical gradient of the pin
 * colour, with the emoji shown large directly on it (so the colour integrates with the icon).
 * No photo, no corner badge. A soft drop-shadow + white outline + top gloss give it depth.
 */
export function createPlacePinSVG(emoji: string, color: string = '#F97316'): HTMLElement {
  const W = 36, H = 41;
  const light = shade(color, 0.24);
  const dark  = shade(color, -0.20);
  const NS  = 'http://www.w3.org/2000/svg';
  const uid = `place-${Math.random().toString(36).slice(2, 8)}`;

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:relative;width:${W}px;height:${H}px;overflow:visible;filter:drop-shadow(0 3px 4px rgba(0,0,0,0.30));`;

  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', String(W));
  svg.setAttribute('height', String(H));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('fill', 'none');
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible;display:block;pointer-events:none;';

  const mk = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };

  // vertical gradient for the head
  const defs = document.createElementNS(NS, 'defs');
  const grad = mk('linearGradient', { id: `${uid}-g`, x1: '0', y1: '0', x2: '0', y2: '1' });
  grad.appendChild(mk('stop', { offset: '0%',  'stop-color': light }));
  grad.appendChild(mk('stop', { offset: '55%', 'stop-color': color }));
  grad.appendChild(mk('stop', { offset: '100%','stop-color': dark }));
  defs.appendChild(grad);
  svg.appendChild(defs);

  // teardrop body — gradient fill + white outline
  svg.appendChild(mk('path', {
    'fill-rule': 'evenodd', 'clip-rule': 'evenodd',
    d: 'M15.75 0C24.4485 0 31.5 7.05152 31.5 15.75C31.5 23.3702 26.0883 29.7265 18.8985 31.1852L16.2393 34.9931C16.1841 35.0725 16.1109 35.1372 16.0257 35.182C15.9405 35.2267 15.846 35.25 15.75 35.25C15.654 35.25 15.5595 35.2267 15.4743 35.182C15.3891 35.1372 15.3159 35.0725 15.2607 34.9931L12.6015 31.1852C5.41168 29.7265 0 23.3702 0 15.75C0 7.05152 7.05152 0 15.75 0Z',
    fill: `url(#${uid}-g)`, stroke: '#ffffff', 'stroke-width': '1.4',
  }));

  // anchor dot at the tip
  svg.appendChild(mk('path', {
    d: 'M17.25 39C17.25 38.1716 16.5784 37.5 15.75 37.5C14.9216 37.5 14.25 38.1716 14.25 39C14.25 39.8284 14.9216 40.5 15.75 40.5C16.5784 40.5 17.25 39.8284 17.25 39Z',
    fill: dark,
  }));

  // glossy highlight near the top of the head
  svg.appendChild(mk('ellipse', { cx: '15.75', cy: '10.2', rx: '7.6', ry: '4.2', fill: '#ffffff', opacity: '0.22' }));

  wrap.appendChild(svg);

  // emoji — large, centred on the head, sitting directly on the colour
  const em = document.createElement('div');
  em.style.cssText = [
    'position:absolute', 'left:15.75px', 'top:15.75px', 'transform:translate(-50%,-50%)',
    'font-size:17px', 'line-height:1', 'user-select:none', 'pointer-events:none',
    'filter:drop-shadow(0 1px 1.5px rgba(0,0,0,0.30))',
  ].join(';');
  em.textContent = emoji || '📍';
  wrap.appendChild(em);

  return wrap;
}

