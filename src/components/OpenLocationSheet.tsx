import { Smartphone } from 'lucide-react';

/* ── Brand logos (inline SVG) ── */
const GoogleMapsLogo = () => (
  <svg width="40" height="40" viewBox="0 0 512 512" aria-label="Google Maps" role="img">
    <rect id="gm-a" width="512" height="512" x="0" y="0" rx="15%" fill="#ffffff" />
    <clipPath id="gm-b"><use xlinkHref="#gm-a" /></clipPath>
    <g clipPath="url(#gm-b)">
      <path fill="#35a85b" d="M0 512V0h512z" />
      <path fill="#5881ca" d="M256 288L32 512h448z" />
      <path fill="#c1c0be" d="M288 256L512 32v448z" />
      <path stroke="#fadb2a" strokeWidth="71" d="M0 512L512 0" />
      <path fill="none" stroke="#f2f2f2" strokeWidth="22" d="M175 173h50a50 54 0 1 1-15-41" />
      <path fill="#de3738" d="M353 85a70 70 0 0 1 140 0c0 70-70 70-70 157 0-87-70-87-70-157" />
      <circle cx="423" cy="89" r="25" fill="#7d2426" />
    </g>
  </svg>
);

const AppleMapsLogo = () => (
  <svg width="40" height="40" viewBox="67 212 512 512" aria-label="Apple Maps" role="img">
    <defs>
      <clipPath id="am-clip"><rect x="67" y="212" width="512" height="512" rx="112" ry="112" fill="none" /></clipPath>
      <linearGradient id="am-g1" x1="323" y1="726" x2="323" y2="337" gradientTransform="translate(0 938) scale(1 -1)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#7fed7d" /><stop offset="1" stopColor="#2ed058" />
      </linearGradient>
      <clipPath id="am-clip2"><rect x="381" y="212" width="198" height="205" fill="none" /></clipPath>
      <linearGradient id="am-g2" x1="261" y1="741" x2="261" y2="470" gradientTransform="translate(0 938) scale(1 -1)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0c91ff" /><stop offset="1" stopColor="#0077f7" />
      </linearGradient>
      <linearGradient id="am-g3" x1="260" y1="538" x2="260" y2="280" gradientTransform="translate(0 938) scale(1 -1)" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#0c91ff" /><stop offset="1" stopColor="#017aff" />
      </linearGradient>
    </defs>
    <g clipPath="url(#am-clip)">
      <rect x="326" y="601" width="253" height="123" fill="#fc0" />
      <rect x="67" y="212" width="512" height="389" fill="url(#am-g1)" />
      <rect x="67" y="400" width="132" height="324" fill="#f082ca" />
      <g clipPath="url(#am-clip2)">
        <circle cx="585.5" cy="204.5" r="161.5" fill="none" stroke="#fff" strokeWidth="86" />
        <path d="M585.5,333.32c71.15,0,128.83-57.68,128.83-128.83s-57.68-128.82-128.83-128.82-128.83,57.68-128.83,128.82,57.68,128.83,128.83,128.83ZM585.5,399c107.42,0,194.5-87.08,194.5-194.5S692.92,10,585.5,10s-194.5,87.08-194.5,194.5,87.08,194.5,194.5,194.5Z" fill="#d2d1d6" fillRule="evenodd" />
      </g>
      <path d="M338.8,205h-157v117.71c0,6.29-6.92,10.12-12.25,6.78l-100.29-62.78L0,369.76l546.85,362.66,69.26-106.05-277.32-185.96v-235.4Z" fill="#f2f1f6" />
      <path d="M207,197h108v271h-108V197Z" fill="url(#am-g2)" />
      <path d="M185,468h153v256h-153v-256Z" fill="#eef0f6" />
      <circle cx="260" cy="529" r="119" fill="url(#am-g3)" stroke="#fff" strokeWidth="20" />
      <path d="M272.22,458.17c-4.15-10.9-20.29-10.9-24.44,0l-45.84,125.2c-2.92,7.97,6.96,14.4,13.07,8.51l42.21-40.71c1.55-1.49,4-1.49,5.55,0l42.21,40.71c6.11,5.89,15.98-.54,13.07-8.51l-45.84-125.2Z" fill="#fff" />
    </g>
  </svg>
);

const WazeLogo = () => (
  <svg width="40" height="40" viewBox="0 0 52 52" aria-label="Waze" role="img">
    <defs>
      <mask id="waze-mask" x="10.44" y="10.43" width="31.07" height="31.17" maskUnits="userSpaceOnUse">
        <path d="M10.44,10.43h31.06v31.17H10.44V10.43Z" fill="#fff" fillRule="evenodd" />
      </mask>
    </defs>
    <path d="M52,8.56v34.89c0,4.73-3.83,8.56-8.56,8.56H8.56C3.83,52,0,48.17,0,43.44V8.56C0,3.83,3.83,0,8.56,0h34.89c4.73,0,8.56,3.83,8.56,8.56Z" fill="#3cf" fillRule="evenodd" />
    <path d="M27.54,36.94h-3.17c-.36-1.82-1.95-3.13-3.8-3.13-1.32,0-2.56.66-3.27,1.78v.03c-1.16-.6-2.22-1.39-3.14-2.32-1.09-1.11-1.69-2.12-1.96-2.76.71-.17,1.36-.55,1.86-1.08.67-.72,1.04-1.68,1.04-2.66v-2.32c0-2.76.92-5.46,2.61-7.63,2.42-3.11,5.99-4.85,9.84-4.85,3.31,0,6.42,1.3,8.77,3.66,2.34,2.33,3.65,5.5,3.64,8.81,0,3.33-1.29,6.46-3.64,8.81-2.29,2.3-5.43,3.68-8.78,3.68" fill="#fff" />
    <g mask="url(#waze-mask)">
      <path d="M27.54,36.94h-3.17c-.36-1.82-1.95-3.13-3.8-3.13-1.32,0-2.56.66-3.27,1.78v.02c-1.16-.6-2.22-1.39-3.14-2.32-1.09-1.11-1.69-2.12-1.96-2.76.71-.17,1.36-.55,1.86-1.08.67-.72,1.04-1.68,1.04-2.66v-2.32c0-2.76.92-5.46,2.61-7.63,2.42-3.11,5.99-4.85,9.84-4.85,3.31,0,6.43,1.3,8.77,3.66,2.34,2.33,3.65,5.5,3.64,8.81,0,3.33-1.29,6.46-3.64,8.81-2.29,2.3-5.43,3.68-8.78,3.68M41.51,24.45c0-3.72-1.47-7.28-4.1-9.9-2.64-2.65-6.15-4.11-9.87-4.11-4.27,0-8.24,1.91-10.96,5.32-1.96,2.48-3.03,5.55-3.03,8.71v2.33c0,1.18-.93,2.35-2.5,2.35-.26,0-.49.17-.57.42-.29.97.89,3.12,2.57,4.82,1.07,1.09,2.31,1.98,3.67,2.66-.37,2.12,1.05,4.13,3.16,4.5.22.04.44.06.66.06,1.85,0,3.45-1.3,3.81-3.12h3.26c.43,2.2,2.72,3.71,5.16,2.89,1.06-.36,1.91-1.19,2.28-2.25.36-1.02.31-2-.02-2.85.86-.55,1.65-1.19,2.37-1.92,2.63-2.63,4.1-6.19,4.09-9.91" fill="#000" fillRule="evenodd" />
    </g>
    <path d="M35.3,21.34c0-.86-.69-1.56-1.55-1.56s-1.55.7-1.55,1.56.7,1.56,1.55,1.56,1.55-.7,1.55-1.56M25.98,21.34c0-.86-.69-1.56-1.55-1.56s-1.55.7-1.55,1.56.7,1.56,1.55,1.56,1.55-.7,1.55-1.56M24.9,26.44c-.13-.27-.41-.44-.71-.44-.43,0-.77.35-.78.77,0,.11.02.22.07.33,1.02,2.18,3.21,3.57,5.62,3.58,2.41,0,4.6-1.4,5.62-3.58.18-.39.01-.85-.38-1.03-.1-.05-.21-.07-.33-.07h-.02c-.3,0-.56.17-.69.44-.77,1.63-2.41,2.67-4.21,2.67-1.8,0-3.44-1.05-4.21-2.68" fill="#000" fillRule="evenodd" />
  </svg>
);

type Props = {
  lat: number;
  lng: number;
  name?: string | null;
  onClose: () => void;
  /** Open the location inside the app's own map, if available. */
  onOpenInApp?: (lat: number, lng: number) => void;
};

/**
 * Bottom action sheet for opening a shared location in an external maps app
 * (Apple Maps / Google Maps / Waze) or inside the app.
 */
export function OpenLocationSheet({ lat, lng, name, onClose, onOpenInApp }: Props) {
  const q = encodeURIComponent(name || 'מיקום');
  // Navigate (not window.open) so the native wrapper's onShouldStartLoadWithRequest
  // intercepts it and opens the real maps app via Linking.openURL.
  const open = (url: string) => { window.location.href = url; onClose(); };

  const rows: { key: string; label: string; sub: string; icon: React.ReactNode; onClick: () => void }[] = [
    {
      key: 'apple', label: 'Apple Maps', sub: 'מפות אפל',
      icon: <AppleMapsLogo />,
      onClick: () => open(`https://maps.apple.com/?ll=${lat},${lng}&q=${q}`),
    },
    {
      key: 'google', label: 'Google Maps', sub: 'גוגל מפות',
      icon: <GoogleMapsLogo />,
      onClick: () => open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`),
    },
    {
      key: 'waze', label: 'Waze', sub: 'ניווט עם וייז',
      icon: <WazeLogo />,
      onClick: () => open(`https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`),
    },
    ...(onOpenInApp ? [{
      key: 'app', label: 'פתח באפליקציה', sub: 'הצג על המפה כאן',
      icon: (
        <span className="w-10 h-10 rounded-[11px] flex items-center justify-center" style={{ background: '#F97316' }}>
          <Smartphone className="w-5 h-5 text-white" strokeWidth={2.4} />
        </span>
      ),
      onClick: () => { onOpenInApp(lat, lng); onClose(); },
    }] : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', animation: 'fade-in 0.18s ease' }}
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="w-full max-w-md bg-white"
        style={{ borderRadius: '24px 24px 0 0', paddingBottom: 'max(16px, env(safe-area-inset-bottom))', animation: 'slide-up 0.28s cubic-bezier(0.25,1,0.5,1)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-3" />
          <p className="text-center text-[15px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>פתח מיקום ב…</p>
        </div>

        <div className="px-3 pb-2">
          {rows.map(r => (
            <button
              key={r.key}
              onClick={r.onClick}
              className="w-full flex items-center gap-3.5 px-3 py-3 rounded-2xl active:bg-gray-100 transition-colors"
            >
              <span className="flex-shrink-0" style={{ width: 40, height: 40, lineHeight: 0 }}>
                {r.icon}
              </span>
              <span className="flex-1 text-right">
                <span className="block text-[15px] font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>{r.label}</span>
                <span className="block text-[12px] text-gray-400" style={{ fontFamily: 'Rubik, sans-serif' }}>{r.sub}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="px-3 pt-1">
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl text-[15px] font-black active:scale-[0.99] transition"
            style={{ background: '#F3F4F6', color: '#6B7280', fontFamily: 'Heebo, sans-serif' }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
