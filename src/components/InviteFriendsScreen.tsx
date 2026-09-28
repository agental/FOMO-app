import { useEffect, useState } from 'react';
import { ChevronLeft, User } from 'lucide-react';
import { openExternalUrl, shareImage, shareInvite, dataUrlToFile } from '../utils/nativeShare';
import { generateStoryImage } from '../utils/launchStoryImage';

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Heebo, sans-serif";
const INK = '#111318';
const SECONDARY = '#73777F';
const ORANGE = '#F97316';

type Tint = { bg: string; icon: string };
const TINTS: Record<'orange' | 'purple' | 'green' | 'blue', Tint> = {
  orange: { bg: 'rgba(249,115,22,0.15)', icon: '#F97316' },
  purple: { bg: 'rgba(139,92,246,0.15)', icon: '#8B5CF6' },
  green: { bg: 'rgba(16,185,129,0.15)', icon: '#10B981' },
  blue: { bg: 'rgba(56,189,248,0.16)', icon: '#38BDF8' },
};

// Hand-placed liquid-glass "people" orbs scattered around the central avatar (avoids the middle).
type Bubble = { top: number; left: number; size: number; tint: keyof typeof TINTS; opacity: number; dur: number; delay: number };
const BUBBLES: Bubble[] = [
  { top: 4, left: 33, size: 54, tint: 'blue', opacity: 0.9, dur: 6, delay: 0 },
  { top: 8, left: 61, size: 46, tint: 'purple', opacity: 0.85, dur: 7, delay: 0.6 },
  { top: 17, left: 15, size: 74, tint: 'green', opacity: 1, dur: 8, delay: 0.2 },
  { top: 18, left: 45, size: 62, tint: 'orange', opacity: 1, dur: 6.5, delay: 1.1 },
  { top: 11, left: 78, size: 42, tint: 'orange', opacity: 0.7, dur: 7.5, delay: 0.4 },
  { top: 27, left: 71, size: 60, tint: 'orange', opacity: 1, dur: 6, delay: 1.4 },
  { top: 39, left: 5, size: 56, tint: 'orange', opacity: 0.95, dur: 8, delay: 0.8 },
  { top: 41, left: 89, size: 44, tint: 'blue', opacity: 0.85, dur: 7, delay: 1.6 },
  { top: 55, left: 91, size: 42, tint: 'orange', opacity: 0.7, dur: 6.5, delay: 0.3 },
  { top: 30, left: 88, size: 28, tint: 'orange', opacity: 0.45, dur: 7, delay: 2 },
  { top: 69, left: 11, size: 64, tint: 'purple', opacity: 1, dur: 8, delay: 0.5 },
  { top: 77, left: 39, size: 54, tint: 'orange', opacity: 0.95, dur: 6.5, delay: 1.2 },
  { top: 79, left: 65, size: 52, tint: 'green', opacity: 0.95, dur: 7.5, delay: 0.9 },
  { top: 89, left: 24, size: 38, tint: 'green', opacity: 0.7, dur: 7, delay: 1.8 },
  { top: 64, left: 78, size: 40, tint: 'orange', opacity: 0.5, dur: 6, delay: 2.2 },
];

/**
 * Invite Friends screen — a bright, premium, Apple "Liquid Glass" community screen (matches the
 * reference). Opens from the launch screen's "ספר לחברים" CTA. Presentation only; sharing reuses the
 * launch flow's story-image share (Instagram) and a WhatsApp deep link.
 */
export function InviteFriendsScreen({
  onBack,
  avatar,
  name,
  shareText,
  link,
}: {
  onBack: () => void;
  avatar: string | null;
  name: string;
  shareText: string;
  link: string;
}) {
  // Pre-generate the story image the moment the screen opens, so tapping "share" fires INSTANTLY —
  // iOS rejects navigator.share if an await runs between the tap and the call.
  const [storyDataUrl, setStoryDataUrl] = useState<string | null>(null);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [prepared, setPrepared] = useState(false); // generation attempt finished (ok OR failed)

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Cap generation so the button never gets stuck on "מכין…" (some devices stall on font/image load).
        const dataUrl = await Promise.race([
          generateStoryImage(avatar, name),
          new Promise<string | null>((r) => setTimeout(() => r(null), 10000)),
        ]);
        if (!alive) return;
        if (dataUrl) {
          setStoryDataUrl(dataUrl);
          const file = await dataUrlToFile(dataUrl);
          if (alive) setStoryFile(file);
        }
      } catch { /* image failed — the button falls back to a plain invite share */ }
      finally { if (alive) setPrepared(true); }
    })();
    return () => { alive = false; };
  }, [avatar, name]);

  // Enable the button as soon as the attempt is done — never leave it stuck on "מכין…".
  const ready = prepared;
  const onInstagram = () => {
    if (storyDataUrl) {
      void shareImage(storyDataUrl, shareText, storyFile ?? undefined);
    } else {
      // Story image couldn't be built (or the native build lacks the image handler) →
      // still let them share the invite text + link through the OS share sheet.
      void shareInvite(shareText, link);
    }
  };
  const onWhatsApp = () => {
    // Share a friendly landing page instead of a raw app link. It carries the referral link (so
    // attribution isn't lost) and shows a "download the app" CTA (the App Store link, once live).
    const invite = `https://fomo-tal.netlify.app/invite.html?to=${encodeURIComponent(link)}`;
    openExternalUrl(`https://wa.me/?text=${encodeURIComponent(`${shareText}\n${invite}`)}`);
  };

  return (
    <div
      dir="rtl"
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: '#FFFFFF',
        zIndex: 200,
        // Native-app feel: no text selection / iOS long-press "copy" callout.
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
      }}
    >
      <style>{`@keyframes iv-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }`}</style>

      {/* subtle warm ambient */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-6%', left: '-14%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.08), transparent 70%)', filter: 'blur(20px)' }} />
        <div style={{ position: 'absolute', bottom: '2%', right: '-16%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(249,115,22,0.06), transparent 70%)', filter: 'blur(20px)' }} />
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 440,
          margin: '0 auto',
          minHeight: '100dvh',
          padding: '0 22px',
          paddingTop: 'max(16px, env(safe-area-inset-top, 0px))',
          paddingBottom: 'max(20px, env(safe-area-inset-bottom, 0px))',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ position: 'relative', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={onBack}
            aria-label="חזרה"
            className="fomo-press"
            style={{
              position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
              width: 42, height: 42, borderRadius: '50%', cursor: 'pointer',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(16px) saturate(160%)', WebkitBackdropFilter: 'blur(16px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <ChevronLeft size={22} strokeWidth={2.4} color={INK} />
          </button>

          <div dir="ltr" style={{ fontFamily: SF, fontWeight: 800, fontSize: 24, color: INK, letterSpacing: '-1px' }}>
            FOMO<span style={{ color: ORANGE }}>.</span>
          </div>

        </div>

        {/* Community visual */}
        <div style={{ position: 'relative', width: '100%', height: 360, marginTop: 10 }}>
          {BUBBLES.map((b, i) => {
            const t = TINTS[b.tint];
            return (
              <div key={i} style={{ position: 'absolute', top: `${b.top}%`, left: `${b.left}%`, transform: 'translate(-50%,-50%)', opacity: b.opacity }}>
                <div
                  style={{
                    width: b.size, height: b.size, borderRadius: '50%', position: 'relative',
                    background: t.bg,
                    backdropFilter: 'blur(12px) saturate(160%)', WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                    border: '1px solid rgba(255,255,255,0.75)',
                    boxShadow: '0 8px 22px rgba(0,0,0,0.05), inset 0 1px 2px rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: `iv-float ${b.dur}s ease-in-out ${b.delay}s infinite`,
                  }}
                >
                  {/* glass highlight */}
                  <div style={{ position: 'absolute', top: '14%', left: '18%', width: '42%', height: '42%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.9), transparent 70%)', opacity: 0.75, pointerEvents: 'none' }} />
                  <User size={Math.round(b.size * 0.4)} strokeWidth={2} color={t.icon} />
                </div>
              </div>
            );
          })}

          {/* Center avatar */}
          <div
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 172, height: 172, borderRadius: '50%', padding: 4,
              background: ORANGE,
              boxShadow: '0 10px 40px rgba(249,115,22,0.22)',
            }}
          >
            {avatar ? (
              <img src={avatar} alt={name} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', display: 'block', border: '3px solid #fff' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', border: '3px solid #fff', background: '#FFF4EC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SF, fontWeight: 700, fontSize: 56, color: ORANGE }}>
                {(name || 'F').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontFamily: SF, fontWeight: 800, fontSize: 28, color: INK, letterSpacing: '-0.5px' }}>
            החברים שלך כבר פה?
          </div>
          <div style={{ fontFamily: SF, fontWeight: 400, fontSize: 15.5, color: SECONDARY, lineHeight: 1.5, marginTop: 12 }}>
            ככל שיותר אנשים מחכים איתנו,<br />ככה הפתיחה גדולה יותר.
          </div>
          <div style={{ fontFamily: SF, fontWeight: 500, fontSize: 13.5, color: SECONDARY, marginTop: 18 }}>
            תייגו אותנו בסטורי <span dir="ltr" style={{ color: INK, fontWeight: 700 }}>@fomo.dot</span>
          </div>
        </div>

        {/* Share actions */}
        <div style={{ display: 'flex', gap: 12, marginTop: 26 }}>
          <button
            onClick={onInstagram}
            disabled={!ready}
            className="fomo-press"
            style={{
              flex: 1, height: 58, borderRadius: 22, border: 'none', cursor: ready ? 'pointer' : 'default',
              background: 'linear-gradient(135deg, #F97316, #EA580C)',
              color: '#fff', fontFamily: SF, fontWeight: 700, fontSize: 15.5,
              boxShadow: '0 6px 18px rgba(249,115,22,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              opacity: ready ? 1 : 0.75,
            }}
          >
            <span>{ready ? 'שיתוף לסטורי' : 'מכין…'}</span>
            <InstagramGlyph />
          </button>

          <button
            onClick={onWhatsApp}
            className="fomo-press"
            style={{
              flex: 1, height: 58, borderRadius: 22, cursor: 'pointer',
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(18px) saturate(160%)', WebkitBackdropFilter: 'blur(18px) saturate(160%)',
              border: '1px solid rgba(255,255,255,0.85)',
              boxShadow: '0 6px 18px rgba(0,0,0,0.05), inset 0 1px 1px rgba(255,255,255,0.9)',
              color: INK, fontFamily: SF, fontWeight: 700, fontSize: 15.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
            }}
          >
            <span>שיתוף בוואטסאפ</span>
            <WhatsAppGlyph />
          </button>
        </div>

        {/* Bottom tagline */}
        <div style={{ marginTop: 'auto', paddingTop: 28, textAlign: 'center', fontFamily: SF, fontWeight: 600, fontSize: 10, letterSpacing: '3px', lineHeight: 1.8, color: 'rgba(115,119,127,0.45)' }}>
          GOOD PEOPLE<br />BETTER PLACES
        </div>
      </div>
    </div>
  );
}

// Instagram outline glyph (white).
function InstagramGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// WhatsApp brand glyph (green) — lucide has no brand logos, so inline the official mark.
function WhatsAppGlyph() {
  return (
    <svg width={19} height={19} viewBox="0 0 24 24" fill="#25D366">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}
