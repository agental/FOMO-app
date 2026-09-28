/* Loads Apple MapKit JS once and initializes it with a token from our Edge Function.
   Usage:  const mapkit = await loadMapKit();  then  new mapkit.Map(el, {...})
   MapKit calls the authorizationCallback whenever it needs a (fresh) token, so token
   rotation is automatic — we just hand it the current one from /functions/v1/mapkit-token. */

const TOKEN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mapkit-token`;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
// Pin the MapKit JS major version; "5.x.x" always resolves to the latest 5.x from Apple's CDN.
const MAPKIT_SRC = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.js';

let mapkitPromise: Promise<any> | null = null;

async function fetchToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!res.ok) throw new Error(`mapkit-token ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.text()).trim();
}

export function loadMapKit(): Promise<any> {
  if (mapkitPromise) return mapkitPromise;

  mapkitPromise = new Promise((resolve, reject) => {
    const init = () => {
      const mapkit = (window as any).mapkit;
      if (!mapkit) { reject(new Error('mapkit global missing after load')); return; }
      try {
        mapkit.init({
          authorizationCallback: (done: (token: string) => void) => {
            fetchToken().then(done).catch((e) => { console.error('[mapkit] token fetch failed:', e); });
          },
          language: 'he',
        });
        resolve(mapkit);
      } catch (e) {
        reject(e);
      }
    };

    // Already present (e.g. hot reload)
    if ((window as any).mapkit?.init) { init(); return; }

    const existing = document.querySelector(`script[src="${MAPKIT_SRC}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', init, { once: true });
      existing.addEventListener('error', () => reject(new Error('mapkit.js failed to load')), { once: true });
      return;
    }

    const s = document.createElement('script');
    s.src = MAPKIT_SRC;
    s.crossOrigin = 'anonymous';
    s.async = true;
    s.setAttribute('data-libraries', 'map,annotations,services,user-location');
    s.onload = init;
    s.onerror = () => reject(new Error('mapkit.js failed to load'));
    document.head.appendChild(s);
  });

  return mapkitPromise;
}
