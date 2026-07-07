// Derive a vivid accent colour that harmonises with an emoji, by rendering the emoji
// to an offscreen canvas and averaging its most saturated pixels. Result is cached per
// emoji (client-only; the WebView renders colour-emoji glyphs, so sampling works there).

const _cache: Record<string, string> = {};

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(r)}${to(g)}${to(b)}`;
}

/** Vivid accent colour matching an emoji's dominant colour. Cached; safe on any input. */
export function emojiColor(emoji: string, fallback = '#F97316'): string {
  if (_cache[emoji]) return _cache[emoji];
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.font = '26px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.clearRect(0, 0, size, size);
    ctx.fillText(emoji, size / 2, size / 2 + 1);
    const { data } = ctx.getImageData(0, 0, size, size);

    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue;
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx; // favour colourful pixels over greys
      const weight = sat * sat * (a / 255) + 0.01;
      r += R * weight; g += G * weight; b += B * weight; w += weight;
    }
    if (w === 0) { _cache[emoji] = fallback; return fallback; }
    r /= w; g /= w; b /= w;

    const [h, s] = rgbToHsl(r, g, b);
    // Keep the emoji's hue; clamp to a pleasant, vivid, consistent saturation/lightness.
    const col = hslToHex(h, Math.min(Math.max(s, 0.5), 0.85), 0.5);
    _cache[emoji] = col;
    return col;
  } catch {
    return fallback;
  }
}
