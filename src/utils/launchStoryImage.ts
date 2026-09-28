/*
  Builds the branded Instagram-Story image (1080×1920 JPEG data URL) for the launch invite.

  Base = the fixed FOMO launch artwork (tropical sunset + "FOMO." + "PEOPLE PLACES MOMENTS" +
  App Store badge), bundled as an asset. On top we overlay the USER'S profile photo (circle + gold
  ring, upper area — over the sky, so the bottom branding stays clear) and the line
  "אני כבר בפנים / ואתם?".

  The base image is same-origin (no taint). The avatar is cross-origin; if it taints the canvas we
  transparently re-render with a letter fallback so export never fails. Shared via both the native
  `{type:'shareImage'}` bridge (needs base64) and the web `navigator.share({files})` fallback.
*/

import storyImage from '../assets/launch-story.jpg';

const W = 1080;
const H = 1920;
const ORANGE = '#F97316'; // the app's primary orange

export async function generateStoryImage(avatarUrl: string | null, name: string): Promise<string> {
  try {
    const f = (document as unknown as { fonts?: { load?: (s: string) => Promise<unknown>; ready?: Promise<unknown> } }).fonts;
    await Promise.all([f?.load?.('900 90px Heebo'), f?.load?.('900 130px Heebo')]);
    await f?.ready;
  } catch { /* ignore */ }

  const bg = await loadImage(storyImage, false);
  if (!bg) {
    // Base failed to load (very unlikely for a bundled asset) → share the raw asset unchanged.
    return await assetDataUrl();
  }
  const avatar = avatarUrl ? await loadImage(avatarUrl, true) : null;

  let canvas = renderStory(bg, avatar, name);
  try {
    // 0.75 (was 0.9) keeps it crisp for a Story while roughly halving the base64 — smaller payloads
    // cross the native WebView bridge far more reliably (large postMessage strings can silently fail).
    return canvas.toDataURL('image/jpeg', 0.75);
  } catch {
    // Cross-origin avatar tainted the canvas → re-render on a fresh canvas without it.
    canvas = renderStory(bg, null, name);
    return canvas.toDataURL('image/jpeg', 0.75);
  }
}

function renderStory(bg: HTMLImageElement, avatar: HTMLImageElement | null, name: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Base artwork, full-bleed.
  ctx.drawImage(bg, 0, 0, W, H);

  const cx = W / 2;
  const cy = 500;
  const r = 130;          // photo radius
  const bandW = 10;       // glass ring thickness (thin)
  const R = r + bandW;    // outer radius of the glass ring

  // Photo (or letter fallback), clipped to the inner circle.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    drawImageCover(ctx, avatar, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#241A12';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.direction = 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 120px Heebo, sans-serif';
    ctx.fillStyle = ORANGE;
    ctx.fillText((name || 'F').trim().charAt(0).toUpperCase(), cx, cy + 4);
  }
  ctx.restore();

  // ── Apple-style frosted-glass ring ──
  // Translucent band (the sunset shows faintly through it = glass), with a soft depth shadow.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 9;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.moveTo(cx + r, cy);
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const band = ctx.createLinearGradient(0, cy - R, 0, cy + R);
  band.addColorStop(0, 'rgba(255,255,255,0.62)');
  band.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  band.addColorStop(1, 'rgba(255,255,255,0.46)');
  ctx.fillStyle = band;
  ctx.fill('evenodd');
  ctx.restore();

  // Crisp edge highlights (glass rim).
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.stroke();

  // Specular light sweep on the upper-left of the ring.
  ctx.save();
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, (r + R) / 2, Math.PI * 1.08, Math.PI * 1.5);
  ctx.lineWidth = bandW * 0.5;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();
  ctx.restore();

  // Headline over the sky.
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 82px Heebo, sans-serif';
  ctx.fillText('אני כבר בפנים', cx, 740);
  ctx.fillText('ואתם?', cx, 835);
  ctx.restore();

  return canvas;
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, dx: number, dy: number, dw: number, dh: number) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(dw / iw, dh / ih);
  const sw = dw / scale;
  const sh = dh / scale;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh);
}

function loadImage(url: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function assetDataUrl(): Promise<string> {
  const blob = await (await fetch(storyImage)).blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('failed to read story image'));
    reader.readAsDataURL(blob);
  });
}
