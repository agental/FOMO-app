/*
  warmCache — tiny localStorage-backed persistence for the app's in-memory module caches.

  The screens already keep module-level caches (e.g. _chatMsgCache) so navigation feels
  instant, but those live only in memory and are wiped on a full WebView reload / cold app
  start. This module makes them survive a cold start so chats and the feed paint instantly,
  then refresh silently in the background (WhatsApp-style).

  Two shapes:
    • createPersistedRecord<T>(name, {entryCap}) → a Proxy that behaves EXACTLY like a plain
      Record<string,T> (read `c[key]`, write `c[key]=v`, `delete c[key]`) but hydrates from
      localStorage on load and auto-persists (debounced) on every write. Drop-in for the
      existing `const _cache = {}` module caches — call sites don't change.
    • loadValue/saveValue(name) → for single-value caches (e.g. an array list).

  Bump SCHEMA_VERSION to invalidate every persisted cache at once after a shape change.
*/

const SCHEMA_VERSION = 'v1';
const PREFIX = `fomo:cache:${SCHEMA_VERSION}:`;

/*
  Native persistence bridge (the fix for the phone).

  In the Expo WebView, localStorage is NOT reliable across app launches — a cold start (or airplane
  mode) comes up with an empty cache, so every screen has to hit the network → visible loading. The
  wrapper (App.js) solves this: on startup it reads the cache blob from native AsyncStorage and
  injects it as `window.__FOMO_NATIVE_CACHE` BEFORE this bundle runs, and it persists every write we
  post back. So on the phone we read/write through that blob; on the plain web we fall back to
  localStorage. Same keys, same values — screens don't change.
*/
type NativeWin = typeof window & {
  __FOMO_NATIVE_CACHE?: Record<string, string>;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};
const w = (typeof window !== 'undefined' ? window : {}) as NativeWin;
const nativeCache = w.__FOMO_NATIVE_CACHE;                 // present only inside the Expo wrapper
const rnBridge = w.ReactNativeWebView;                     // present only inside a WebView

function nativeWrite(fullKey: string, value: string) {
  if (!rnBridge) return;
  try { rnBridge.postMessage(JSON.stringify({ type: 'cacheSet', key: fullKey, value })); } catch { /* ignore */ }
}
function nativeRemove(fullKey: string) {
  if (!rnBridge) return;
  try { rnBridge.postMessage(JSON.stringify({ type: 'cacheRemove', key: fullKey })); } catch { /* ignore */ }
}

function readRaw<T>(name: string, fallback: T): T {
  try {
    // Native-injected blob wins on the phone; localStorage is the web fallback.
    const raw = (nativeCache && nativeCache[PREFIX + name] != null)
      ? nativeCache[PREFIX + name]
      : localStorage.getItem(PREFIX + name);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed == null ? fallback : (parsed as T);
  } catch {
    return fallback;
  }
}

const timers: Record<string, ReturnType<typeof setTimeout>> = {};
function scheduleWrite(name: string, getSnapshot: () => unknown) {
  if (timers[name]) return;
  timers[name] = setTimeout(() => {
    delete timers[name];
    const fullKey = PREFIX + name;
    let str: string | null = null;
    try { str = JSON.stringify(getSnapshot()); } catch { str = null; }
    if (str == null) return;
    // Mirror to BOTH: localStorage (web / same-session) and native AsyncStorage (survives phone relaunch).
    try { localStorage.setItem(fullKey, str); } catch { try { localStorage.removeItem(fullKey); } catch { /* ignore */ } }
    nativeWrite(fullKey, str);
  }, 500);
}

/**
 * A Record<string,T> that persists to localStorage. Use exactly like a plain object:
 *   const _cache = createPersistedRecord<Msg[]>('chatMsgs', { entryCap: 30 });
 *   _cache[id]            // read
 *   _cache[id] = msgs     // write (auto-persists; arrays trimmed to the last entryCap items)
 *   delete _cache[id]     // delete (auto-persists)
 * @param entryCap  when a written value is an array, keep only its last N items in storage
 */
export function createPersistedRecord<T>(name: string, opts: { entryCap?: number } = {}): Record<string, T> {
  const target: Record<string, T> = readRaw<Record<string, T>>(name, {});
  const { entryCap } = opts;

  return new Proxy(target, {
    set(obj, prop: string, value: T) {
      obj[prop] = (entryCap && Array.isArray(value) && value.length > entryCap)
        ? ((value as unknown[]).slice(-entryCap) as unknown as T)
        : value;
      scheduleWrite(name, () => obj);
      return true;
    },
    deleteProperty(obj, prop: string) {
      delete obj[prop];
      scheduleWrite(name, () => obj);
      return true;
    },
  });
}

/** Read a single persisted value (e.g. a cached list). Returns `fallback` if absent/corrupt. */
export function loadValue<T>(name: string, fallback: T): T {
  return readRaw<T>(name, fallback);
}

/** Persist a single value (debounced). */
export function saveValue<T>(name: string, value: T): void {
  scheduleWrite(name, () => value);
}

/** Remove a single persisted value from BOTH localStorage and native AsyncStorage. */
export function removeValue(name: string): void {
  const fullKey = PREFIX + name;
  if (timers[name]) { clearTimeout(timers[name]); delete timers[name]; }
  try { localStorage.removeItem(fullKey); } catch { /* ignore */ }
  nativeRemove(fullKey);
}

/** Clear every persisted cache (e.g. on sign-out) — both localStorage and native AsyncStorage. */
export function clearWarmCache(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => { localStorage.removeItem(k); nativeRemove(k); });
  } catch { /* ignore */ }
  if (rnBridge) { try { rnBridge.postMessage(JSON.stringify({ type: 'cacheClear' })); } catch { /* ignore */ } }
}
