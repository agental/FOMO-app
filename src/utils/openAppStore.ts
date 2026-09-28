// Open the App Store product page for a numeric app id. Inside the Expo wrapper this opens the
// native in-app store sheet (SKStoreProductViewController) — the user installs without leaving FOMO.
// On plain web it falls back to opening the App Store product page in a new tab.
type BridgeWin = typeof window & {
  ReactNativeWebView?: { postMessage: (msg: string) => void };
  __fomoHasStoreKit?: boolean;
};

// Whether to show an "install" button. Plain web → yes (opens a new tab). Inside the Expo wrapper →
// only when the native store module is present (set by App.js), so older builds without the handler
// never show a dead button.
export function canOpenAppStore(): boolean {
  const w = window as BridgeWin;
  if (!w.ReactNativeWebView) return true;
  return !!w.__fomoHasStoreKit;
}

export function openAppStore(appId: string): void {
  const w = window as BridgeWin;
  if (w.ReactNativeWebView) {
    try {
      w.ReactNativeWebView.postMessage(JSON.stringify({ type: 'openStore', appId }));
      return;
    } catch { /* fall through to web */ }
  }
  window.open(`https://apps.apple.com/app/id${appId}`, '_blank', 'noopener');
}
