/*
  Bridge to the native Expo wrapper for REAL system notifications.

  Sound, vibration, and the iOS top-of-screen banner cannot be triggered from inside
  the WebView — the wrapper (App.js) does it via expo-notifications + expo-haptics.
  When running as a plain web page (no wrapper), callers fall back to the in-app toast.
*/

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as unknown as { ReactNativeWebView?: unknown }).ReactNativeWebView;
}

/** Ask the native wrapper to fire a system notification (iOS banner + sound + vibration).
 *  Returns true if the bridge handled it (native), false on plain web. */
export function nativeNotify(title: string, body: string): boolean {
  const rn = typeof window !== 'undefined'
    ? (window as unknown as { ReactNativeWebView?: { postMessage: (s: string) => void } }).ReactNativeWebView
    : null;
  if (!rn) return false;
  try {
    rn.postMessage(JSON.stringify({ type: 'notify', title, body }));
    return true;
  } catch {
    return false;
  }
}
