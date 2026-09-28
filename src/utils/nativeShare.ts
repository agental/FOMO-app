/*
  Share bridge to the native Expo wrapper.

  `navigator.share` is unreliable inside the iOS WebView (it silently rejects when not user-gesture
  bound), so on the phone we hand sharing to the wrapper (App.js), which uses the real OS share sheet
  (React Native `Share` for text/links; `expo-sharing` for an image file → the sheet surfaces
  Instagram → Stories, WhatsApp, Messages, etc.). On plain web we fall back to `navigator.share`,
  then to copying the link.
*/

type RNBridge = { postMessage: (msg: string) => void };

function bridge(): RNBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { ReactNativeWebView?: RNBridge }).ReactNativeWebView ?? null;
}

/** True inside the native wrapper. */
export function isNativeApp(): boolean {
  return !!bridge();
}

/** Share an invite (text + link) through the native OS share sheet, or the web fallbacks.
 *  Returns true if a share/copy path was taken. */
export async function shareInvite(message: string, url: string): Promise<boolean> {
  const rn = bridge();
  if (rn) {
    try { rn.postMessage(JSON.stringify({ type: 'share', message, url })); return true; } catch { /* fall through */ }
  }
  // Plain web
  try {
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
    if (nav.share) { await nav.share({ text: message, url }); return true; }
  } catch { /* user cancelled — treat as handled */ return true; }
  return copyToClipboard(`${message} ${url}`.trim());
}

/** Share an image (JPEG data URL) — the Instagram-Story card. Native writes it to a temp file and
 *  opens the share sheet (choose Instagram → Stories). On web, pass a PRE-BUILT `file` so
 *  `navigator.share` is invoked synchronously inside the tap gesture (iOS rejects it otherwise);
 *  falls back to a download. */
export async function shareImage(dataUrl: string, message?: string, file?: File): Promise<boolean> {
  const rn = bridge();
  if (rn) {
    try { rn.postMessage(JSON.stringify({ type: 'shareImage', dataUrl, message: message || '' })); return true; } catch { /* fall through */ }
  }
  // Web: prefer the Web Share API with the pre-built file (keeps the user gesture alive), else download.
  const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void>; canShare?: (d: ShareData) => boolean };
  if (file && nav.canShare && nav.canShare({ files: [file] }) && nav.share) {
    try { await nav.share({ files: [file], text: message }); } catch { /* user cancelled */ }
    return true;
  }
  try {
    const blob = file ?? await (await fetch(dataUrl)).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'fomo-invite.jpg';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    return true;
  } catch {
    return false;
  }
}

/** Build a File from a data URL (JPEG). Used to pre-build the story image so sharing is instant. */
export async function dataUrlToFile(dataUrl: string, name = 'fomo-invite.jpg'): Promise<File> {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: 'image/jpeg' });
}

/** Open a URL in the real external app (native → Linking.openURL) or a new tab (plain web). Used for
 *  the WhatsApp share link (wa.me), which must leave the WebView rather than load inside it. */
export function openExternalUrl(url: string): void {
  const rn = bridge();
  if (rn) {
    try { rn.postMessage(JSON.stringify({ type: 'openExternal', url })); return; } catch { /* fall through */ }
  }
  try { window.open(url, '_blank', 'noopener'); } catch { /* ignore */ }
}

/** Copy text to the clipboard. Returns true on success. */
export function copyToClipboard(text: string): boolean {
  try {
    if (navigator.clipboard?.writeText) { navigator.clipboard.writeText(text); return true; }
  } catch { /* ignore */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  } catch {
    return false;
  }
}
