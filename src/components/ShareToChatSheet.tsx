import { useState, useEffect, useMemo } from 'react';
import { X, Search, Check, Link2, Share2, Send, Users, Loader2 } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { loadShareTargets, sendToTargets, type ShareTarget } from '../services/shareService';

/**
 * Share sheet: pick chats inside the app and post to them, or fall back to the OS share sheet.
 *
 * `navigator.share` is unreliable inside the iOS WebView (and silently rejects when it isn't
 * user-gesture-bound), which is why sharing looked broken. In-app targets don't depend on it at all.
 */
interface ShareToChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId?: string;
  /** Header preview of the thing being shared. */
  title: string;
  subtitle?: string;
  emoji?: string;
  color?: string;
  /** What gets posted into the chat — may carry an encoded payload the chat renders as a card. */
  text: string;
  /** Plain, human-readable version for the clipboard and the OS share sheet. */
  plainText?: string;
  /** Optional external link for "copy link" + the OS sheet. */
  url?: string;
}

const HEEBO = "'Heebo', sans-serif";
const INK   = '#111827';
const MUTED = '#9AA0AC';

export function ShareToChatSheet({
  isOpen, onClose, currentUserId, title, subtitle, emoji = '📍', color = '#F97316', text, plainText, url,
}: ShareToChatSheetProps) {
  const [targets, setTargets]   = useState<ShareTarget[]>([]);
  const [loading, setLoading]   = useState(true);
  const [picked, setPicked]     = useState<Set<string>>(new Set());
  const [query, setQuery]       = useState('');
  const [sending, setSending]   = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [me, setMe]             = useState<{ name: string; avatarUrl: string | null } | null>(null);
  const [entered, setEntered]   = useState(false);

  useEffect(() => {
    if (!isOpen || !currentUserId) return;
    setLoading(true); setPicked(new Set()); setQuery(''); setSentCount(0); setEntered(false);

    (async () => {
      const [list, profile] = await Promise.all([
        loadShareTargets(currentUserId),
        import('../lib/supabase').then(({ supabase }) =>
          supabase.from('users').select('display_name, avatar_url').eq('id', currentUserId).single()),
      ]);
      setTargets(list);
      setMe({ name: profile.data?.display_name || 'מטייל', avatarUrl: profile.data?.avatar_url ?? null });
      setLoading(false);
    })();

    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [isOpen, currentUserId]);

  const groups = useMemo(
    () => targets.filter(t => t.kind === 'group' && t.name.toLowerCase().includes(query.toLowerCase())),
    [targets, query],
  );
  const dms = useMemo(
    () => targets.filter(t => t.kind === 'dm' && t.name.toLowerCase().includes(query.toLowerCase())),
    [targets, query],
  );

  if (!isOpen) return null;

  const key = (t: ShareTarget) => `${t.kind}:${t.id}`;
  const toggle = (t: ShareTarget) => {
    setPicked(prev => {
      const next = new Set(prev);
      const k = key(t);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const closeSheet = () => { setEntered(false); setTimeout(onClose, 260); };

  const send = async () => {
    if (!currentUserId || !me || picked.size === 0) return;
    setSending(true);
    const chosen = targets.filter(t => picked.has(key(t)));
    const { sent, failed } = await sendToTargets({ id: currentUserId, ...me }, chosen, text);
    setSending(false);

    if (sent === 0) { alert('השליחה נכשלה. נסה שוב.'); return; }
    setSentCount(sent);
    if (failed > 0) console.warn(`share: ${failed} target(s) failed`);
    setTimeout(closeSheet, 900); // let them see it landed
  };

  // Never leak the encoded chat payload outside the app — that's what `plainText` is for.
  const outside = plainText ?? text;

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(url || outside); alert('הקישור הועתק'); closeSheet(); }
    catch { alert('לא הצלחתי להעתיק'); }
  };

  const osShare = async () => {
    try {
      if (navigator.share) { await navigator.share({ title, text: outside, url }); closeSheet(); }
      else copyLink();
    } catch { /* the user cancelled — not an error */ }
  };

  const Row = ({ t }: { t: ShareTarget }) => {
    const on = picked.has(key(t));
    return (
      <button
        onClick={() => toggle(t)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 4px',
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right',
        }}
      >
        {t.kind === 'group' ? (
          <span style={{
            width: 42, height: 42, borderRadius: 14, flexShrink: 0, fontSize: 20,
            background: '#F1F2F5', display: 'grid', placeItems: 'center',
          }}>
            {t.emoji || '🌍'}
          </span>
        ) : (
          <UserAvatar userId={t.id} displayName={t.name} avatarUrl={t.avatarUrl || undefined} size="medium" />
        )}

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: 14.5, fontWeight: 800, color: INK, fontFamily: HEEBO,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t.name}
          </span>
          <span style={{
            display: 'block', fontSize: 11.5, fontWeight: 600, color: MUTED, fontFamily: HEEBO,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {t.kind === 'group' ? (t.sub ?? 'קבוצת עיר') : 'הודעה פרטית'}
          </span>
        </span>

        <span style={{
          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: on ? color : 'transparent',
          boxShadow: on ? 'none' : 'inset 0 0 0 2px #DDE1E7',
          transition: 'background 0.15s ease',
        }}>
          {on && <Check size={14} strokeWidth={3.2} color="#fff" />}
        </span>
      </button>
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/45 z-[65]"
        style={{ opacity: entered ? 1 : 0, transition: 'opacity 0.26s ease' }}
        onClick={closeSheet}
      />

      <div
        className="fixed left-0 right-0 bottom-0 bg-white rounded-t-3xl z-[65] flex flex-col"
        style={{
          maxHeight: '82vh',
          transform: entered ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.22,1,0.3,1)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
        }}
        dir="rtl"
      >
        {/* head */}
        <div style={{ flexShrink: 0, padding: '10px 20px 0' }}>
          <div className="w-9 h-1 rounded-full bg-gray-300 mx-auto" />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
            <span style={{
              width: 40, height: 40, borderRadius: 13, flexShrink: 0, fontSize: 19,
              background: `${color}1A`, display: 'grid', placeItems: 'center',
            }}>
              {emoji}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                margin: 0, fontSize: 16, fontWeight: 900, color: INK, fontFamily: HEEBO,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title}
              </p>
              {subtitle && (
                <p style={{
                  margin: 0, fontSize: 12, fontWeight: 600, color: MUTED, fontFamily: HEEBO,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={closeSheet} aria-label="סגור"
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: '#F1F2F5', display: 'grid', placeItems: 'center', flexShrink: 0,
              }}
            >
              <X size={16} strokeWidth={2.6} color="#6C727E" />
            </button>
          </div>

          {/* search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 14,
            background: '#F4F5F7', borderRadius: 14, padding: '10px 13px',
          }}>
            <Search size={16} strokeWidth={2.4} color={MUTED} style={{ flexShrink: 0 }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="חפש קבוצה או איש קשר"
              style={{
                flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 14, fontWeight: 600, color: INK, fontFamily: HEEBO,
              }}
            />
          </div>
        </div>

        {/* list */}
        <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '6px 20px', overscrollBehavior: 'contain' }}>
          {loading ? (
            <div style={{ display: 'grid', placeItems: 'center', padding: '40px 0' }}>
              <Loader2 size={22} className="animate-spin" color={MUTED} />
            </div>
          ) : groups.length === 0 && dms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 12px' }}>
              <Users size={24} strokeWidth={1.8} color="#CBD0DA" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: 14, fontWeight: 800, color: INK, fontFamily: HEEBO, margin: 0 }}>
                {query ? 'לא נמצא' : 'אין עדיין צ׳אטים'}
              </p>
              <p style={{ fontSize: 12, color: MUTED, fontFamily: HEEBO, margin: '3px 0 0' }}>
                {query ? 'נסה שם אחר' : 'הצטרף לקבוצת עיר כדי לשתף בה'}
              </p>
            </div>
          ) : (
            <>
              {groups.length > 0 && (
                <>
                  <p style={{ fontSize: 11.5, fontWeight: 900, color: MUTED, fontFamily: HEEBO, margin: '10px 4px 2px', letterSpacing: '0.02em' }}>
                    קבוצות
                  </p>
                  {groups.map(t => <Row key={key(t)} t={t} />)}
                </>
              )}
              {dms.length > 0 && (
                <>
                  <p style={{ fontSize: 11.5, fontWeight: 900, color: MUTED, fontFamily: HEEBO, margin: '14px 4px 2px', letterSpacing: '0.02em' }}>
                    הודעות
                  </p>
                  {dms.map(t => <Row key={key(t)} t={t} />)}
                </>
              )}
            </>
          )}
        </div>

        {/* foot */}
        <div style={{
          flexShrink: 0, padding: '12px 20px', borderTop: '1px solid #EEF0F3',
          paddingBottom: 'max(16px, env(safe-area-inset-bottom))',
        }}>
          <button
            onClick={send}
            disabled={picked.size === 0 || sending || sentCount > 0}
            style={{
              width: '100%', height: 50, borderRadius: 16, border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: sentCount > 0 ? '#16A34A' : picked.size ? color : '#E9EBEF',
              color: picked.size || sentCount ? '#fff' : '#A6ACB8',
              fontSize: 15, fontWeight: 900, fontFamily: HEEBO,
              cursor: picked.size ? 'pointer' : 'default',
              transition: 'background 0.18s ease',
            }}
          >
            {sentCount > 0 ? (
              <><Check size={18} strokeWidth={3} /> נשלח ל־{sentCount}</>
            ) : sending ? (
              <><Loader2 size={18} className="animate-spin" /> שולח…</>
            ) : (
              <><Send size={17} strokeWidth={2.4} /> {picked.size ? `שלח ל־${picked.size}` : 'בחר לאן לשלוח'}</>
            )}
          </button>

          <div style={{ display: 'flex', gap: 8, marginTop: 9 }}>
            <button
              onClick={copyLink}
              style={{
                flex: 1, height: 42, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: '#F4F5F7', color: INK, fontSize: 13.5, fontWeight: 800, fontFamily: HEEBO,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Link2 size={15} strokeWidth={2.4} /> העתק קישור
            </button>
            <button
              onClick={osShare}
              style={{
                flex: 1, height: 42, borderRadius: 14, border: 'none', cursor: 'pointer',
                background: '#F4F5F7', color: INK, fontSize: 13.5, fontWeight: 800, fontFamily: HEEBO,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <Share2 size={15} strokeWidth={2.4} /> אפליקציה אחרת
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
