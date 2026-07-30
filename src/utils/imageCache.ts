/*
  imageCache — persist small, downscaled copies of remote images (avatars + event covers) so they
  render INSTANTLY on a refresh / cold start instead of re-downloading every time.

  Built on warmCache's native bridge, so entries survive a WebView reload on the phone (they live in
  AsyncStorage via the wrapper, same as the data caches). Because Supabase is on the free plan (no
  server-side image transform), we downscale on the client with a canvas — same approach as
  eventService.compressImage — and store a base64 data-URI.

  Kept deliberately small + capped (LRU by count AND bytes): the wrapper re-serializes its whole
  cache blob to AsyncStorage on every write, so a runaway image cache would make every persist slow.
*/

import { loadValue, saveValue, removeValue } from './warmCache';

const KEY_PREFIX = 'img:';
const INDEX_KEY = 'imgIndex';
const MAX_ITEMS = 40;
const MAX_BYTES = 3 * 1024 * 1024; // ~3MB of cached images total
const DEFAULT_MAX_DIM = 640;
const DEFAULT_QUALITY = 0.72;

type IndexEntry = { k: string; size: number; ts: number };

// In-session mirror so repeated getCachedImage() for the same url is O(1) (no re-parse per render).
const mem = new Map<string, string>();
// url-hashes we've already tried to cache this session (avoid duplicate fetches / retry storms).
const attempted = new Set<string>();

let index: IndexEntry[] = loadValue<IndexEntry[]>(INDEX_KEY, []);

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
const keyFor = (url: string) => KEY_PREFIX + hash(url);

/** Synchronous read of the cached data-URI for a url, or null. Safe to call every render. */
export function getCachedImage(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:')) return url; // already inline
  const k = keyFor(url);
  const cached = mem.get(k);
  if (cached !== undefined) return cached;
  const v = loadValue<string | null>(k, null);
  if (v) { mem.set(k, v); return v; }
  return null;
}

/** Downscale a remote image to a small JPEG data-URI. Resolves null if it can't be read (CORS-tainted,
    load error) — the caller just keeps using the original url. */
function downscale(url: string, maxDim: number, quality: number): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // required so the canvas isn't tainted and toDataURL can read it
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) return resolve(null);
        const scale = Math.min(1, maxDim / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality)); // throws if tainted → caught below
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function evictIfNeeded() {
  let total = index.reduce((s, e) => s + e.size, 0);
  while (index.length > MAX_ITEMS || total > MAX_BYTES) {
    const victim = index.shift(); // oldest first (newest is pushed to the end on touch)
    if (!victim) break;
    total -= victim.size;
    mem.delete(victim.k);
    removeValue(victim.k);
  }
}

function touch(k: string, size: number) {
  index = index.filter((e) => e.k !== k);
  index.push({ k, size, ts: Date.now() });
  evictIfNeeded();
  saveValue(INDEX_KEY, index);
}

/** Fetch → downscale → persist a remote image, so the next render is instant. No-op if already
    cached or already attempted this session. Silent on any failure (falls back to the live url). */
export async function cacheImage(
  url: string | null | undefined,
  opts: { maxDim?: number; quality?: number } = {},
): Promise<void> {
  if (!url || url.startsWith('data:')) return;
  const k = keyFor(url);
  if (mem.has(k) || attempted.has(k)) return;
  attempted.add(k);
  if (getCachedImage(url)) return; // persisted from a previous session
  const dataUri = await downscale(url, opts.maxDim ?? DEFAULT_MAX_DIM, opts.quality ?? DEFAULT_QUALITY);
  if (!dataUri) return;
  mem.set(k, dataUri);
  saveValue(k, dataUri);
  touch(k, dataUri.length);
}

/** Warm several images in the background (used by the boot preloader during the splash). */
export function warmImages(urls: (string | null | undefined)[], opts?: { maxDim?: number; quality?: number }): void {
  for (const u of urls) cacheImage(u, opts).catch(() => { /* ignore */ });
}
