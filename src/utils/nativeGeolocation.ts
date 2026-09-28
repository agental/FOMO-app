/* Polyfill navigator.geolocation on top of the native GPS bridge (window._nativeLocation + the
   "nativeLocation" event that App.js streams). In the Expo WebView the browser geolocation doesn't work,
   so any map that relies on navigator.geolocation (Mapbox's GeolocateControl, Apple MapKit's
   showsUserLocation) needs this. Importing this module installs it once; on desktop it's a no-op so the
   browser's real geolocation is kept. */
if (typeof window !== 'undefined' && (window as any).ReactNativeWebView && !(window as any).__fomoGeoPolyfilled) {
  (window as any).__fomoGeoPolyfilled = true;

  const toPos = (d: any) => ({
    coords: {
      latitude: d.lat, longitude: d.lng,
      accuracy: typeof d.accuracy === 'number' ? d.accuracy : 25,
      altitude: null, altitudeAccuracy: null,
      heading: typeof (window as any)._nativeHeading === 'number' ? (window as any)._nativeHeading : null,
      speed: null,
    },
    timestamp: Date.now(),
  });

  let seq = 1;
  const watchers: Record<number, (e: any) => void> = {};
  const geo = {
    getCurrentPosition(success: any) {
      const cur = (window as any)._nativeLocation;
      if (cur && cur.lat != null) { success(toPos(cur)); return; }
      const once = (e: any) => { window.removeEventListener('nativeLocation', once); success(toPos(e.detail)); };
      window.addEventListener('nativeLocation', once);
    },
    watchPosition(success: any) {
      const id = seq++;
      const handler = (e: any) => success(toPos(e.detail));
      watchers[id] = handler;
      window.addEventListener('nativeLocation', handler);
      const cur = (window as any)._nativeLocation;
      if (cur && cur.lat != null) success(toPos(cur));
      return id;
    },
    clearWatch(id: any) {
      if (watchers[id]) { window.removeEventListener('nativeLocation', watchers[id]); delete watchers[id]; }
    },
  };
  // navigator.geolocation is getter-only — plain assignment throws in strict mode (white screen).
  try {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo });
  } catch { /* keep the browser's native geolocation */ }
}

export {};
