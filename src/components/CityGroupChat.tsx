import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { MoreVertical, Send, Mic, MapPin, Image as ImageIcon, ChevronDown, Camera, Smile, Paperclip, X, Crown, Pencil, Check, Map, Phone, DollarSign, Clock, Wifi, AlertTriangle, CornerUpLeft, Copy, Flag, Trash2, LogOut } from 'lucide-react';
import { BackButton } from './BackButton';
import { MessageBubble } from './MessageBubble';
import { ImageBubble } from './ImageBubble';
import { EventChatCard } from './EventChatCard';
import { EventDetailsModal } from './EventDetailsModal';
import { parseEvent } from '../utils/eventMessage';
import type { Event } from '../lib/supabase';
import { LocationName } from './LocationName';
import { OpenLocationSheet } from './OpenLocationSheet';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';

/* ─── types ─── */
interface GMessage {
  id: string; channel_id: string; user_id: string;
  display_name: string; avatar_url: string | null;
  content: string | null; type: 'text' | 'image' | 'location';
  image_url: string | null;
  location_lat: number | null; location_lng: number | null; location_name: string | null;
  created_at: string; reactions: GReaction[];
}
interface GReaction { emoji: string; count: number; mine: boolean; }
interface GMember {
  user_id: string; display_name: string; avatar_url: string | null;
  last_seen_at: string | null; is_admin?: boolean;
}
interface CityGroupChatProps {
  countryCode: string; countryFlag: string; cityName: string; cityEmoji: string;
  currentUserId: string; currentUserName: string; currentUserAvatar: string | null;
  onClose: () => void;
  onOpenMapAt?: (lat: number, lng: number) => void;
  onNavigateToUserProfile?: (userId: string) => void;
}

/* ─── constants ─── */
const QUICK_EMOJIS = ['❤️', '😂', '😮', '🔥', '👍', '🙏'];

/* ─── reply encoding (no schema): a quoted reply is stored inline in content,
   wrapped by an invisible separator so it never collides with real text ─── */
const REPLY_SEP = '⁣';
function encodeReply(name: string, snippet: string, body: string): string {
  return `${REPLY_SEP}${JSON.stringify({ n: name, t: snippet })}${REPLY_SEP}${body}`;
}
function parseReply(content: string | null): { reply: { n: string; t: string } | null; body: string } {
  if (!content || content[0] !== REPLY_SEP) return { reply: null, body: content ?? '' };
  const end = content.indexOf(REPLY_SEP, 1);
  if (end === -1) return { reply: null, body: content };
  try {
    return { reply: JSON.parse(content.slice(1, end)), body: content.slice(end + 1) };
  } catch {
    return { reply: null, body: content };
  }
}
/* Short preview of any message for the reply quote */
function msgSnippet(m: { type: string; content: string | null; location_name: string | null }): string {
  if (m.type === 'image') return '📷 תמונה';
  if (m.type === 'location') return '📍 מיקום';
  return parseReply(m.content).body.slice(0, 90);
}
const ORANGE = 'linear-gradient(135deg, #F97316, #EA580C)';
const ORANGE_SH = '0 2px 8px rgba(234,88,12,0.35)';
/* Pastel bubble colors per sender */
const PASTELS = ['#FCE4EC', '#FFF3E0', '#EDE7F6', '#E0F2F1', '#FBE9E7', '#E8EAF6', '#F1F8E9', '#E3F2FD'];
/* Sender name colors */
const NAME_COLORS = [
  '#C62828', '#1565C0', '#2E7D32', '#6A1B9A', '#BF360C', '#00838F', '#AD1457',
  '#4527A0', '#00695C', '#D84315', '#283593', '#558B2F', '#7B1FA2', '#EF6C00',
];

/* ─── city guide data ─── */
interface CityGuide {
  subtitle: string;
  critical: { emoji: string; title: string; body: string }[];
  israeli:  { emoji: string; title: string; body: string }[];
  quickFacts: { label: string; value: string }[];
}

const CITY_GUIDES: Record<string, CityGuide> = {
  'TH:🏝️': {
    subtitle: 'מסיבות, טבע, ים וקהילה — לא רק ירח מלא',
    quickFacts: [
      { label: '💱 מטבע',   value: 'באט (THB) — 1 ₪ ≈ 10 באט' },
      { label: '🕐 שעון',   value: 'UTC+7 — ישראל קדים ב-5 שעות' },
      { label: '🚨 חירום',  value: '191 משטרה · 1669 אמבולנס' },
      { label: '📶 SIM',    value: 'AIS / DTAC בנמל — 30 יום ~300 באט' },
      { label: '✈️ הגעה',   value: 'מעבורת מקו סמואי / סורת תאני (12GO)' },
      { label: '🌤 עונה טובה', value: 'ינואר–אוגוסט. אוקטובר–דצמבר גשמי' },
    ],
    critical: [
      { emoji: '🛵', title: 'סקוטר — הסיכון הגדול ביותר', body: 'אין Grab או Bolt באי. התחבורה היא מוטו/סונגטאו. לפני שכירת אופנוע — צלם כל שריטה קיימת. בעלי הרכב יגידו שאתה גרמת לנזק ויחייבו אותך. תמיד קסדה, הדרכים בג׳ונגל חשוכות ומחליקות.' },
      { emoji: '🎉', title: 'Full Moon & Half Moon — זהירות', body: 'מסיבת ירח מלא בחאד-רין — עשרות אלפי אנשים. אל תשתה מכוס של זר, Buckets (דלי אלכוהול) מסוכנים. שמור על חפצים. כרטיסים — קנה ממקורות רשמיים בלבד.' },
      { emoji: '🚕', title: 'טקסי — תמיד תמקח מראש', body: 'אין מחירים קבועים — הנהגים מנצלים היעדר אפליקציות תחבורה. סכם מחיר לפני העלייה לרכב. סונגטאו (טנדר אדום) זול יותר אם מחכה לנוסעים נוספים.' },
      { emoji: '🌊', title: 'ים בעונת הגשמים', body: 'אוקטובר–דצמבר: גלים גבוהים, לפעמים שחייה אסורה. שים לב לדגלים אדומים. ג׳טסקי — ספקים לא אמינים יאשימו אותך בנזק שלא גרמת.' },
      { emoji: '🏥', title: 'בתי חולים', body: 'לפציעות קלות: Bangkok Hospital Koh Phangan. לחמורות — מפנים לקו סמואי (Bangkok Hospital Samui). ביטוח נסיעות חובה.' },
      { emoji: '💧', title: 'מים ובריאות', body: 'שתיית מים מהברז אסורה — בקבוקים בלבד. ספריי יתושים חובה. קרח ממקומות לא מוכרים — בזהירות.' },
    ],
    israeli: [
      { emoji: '🏘️', title: 'איפה לגור — לפי סגנון', body: 'חאד-רין: מסיבות וחוף + Israeli House. סרי-טאנו: יוגה, מדיטציה, קהילה ישראלית צפופה + בית חב״ד. תונג-סאלה: נמל ראשי, שוק לילי, נגיש לכל. חאד-סאלאד: שקט ומשפחתי. צ׳לוקלום: דייגים מקומיים + פירות ים.' },
      { emoji: '✡️', title: 'בית חב״ד', body: 'בית חב״ד פעיל באזור סרי-טאנו — קבלת שבת, ארוחות חג, עזרה לישראלים. מומלץ לבקר גם אם אתה לא דתי.' },
      { emoji: '🥙', title: 'אוכל ישראלי', body: 'סרי-טאנו = "תל-אביב של קו פנגן": חומוס, שקשוקה, פיתות, לחמג׳ין. עשרות מסעדות ישראליות בכל רחבי האי.' },
      { emoji: '🧘', title: 'יוגה ובריאות', body: 'Kaia Studio מציעה שיעורי יוגה עם 100 באט הנחה לחברי מזרחניק. שפע סטודיואים, ריטריטים וסשנים של healing.' },
      { emoji: '🌊', title: 'מה לעשות', body: 'טיול 42 איים, צלילה וסנורקלינג, ATV בג׳ונגל, מפלים (Wang Sai, Phaeng), חופים מוסתרים — Bottle Beach, Zen Beach, Haad Yuan.' },
      { emoji: '💰', title: 'תקציב', body: 'לינה 200–600 באט ללילה, ארוחה 80–150 באט, ספא/עיסוי 200–400 באט לשעה. זול משמעותית מישראל.' },
      { emoji: '📱', title: 'קבוצות וערוצים', body: 'ערוץ אירועים בוואטסאפ לכל מסיבות האי. קבוצות ישראלים בפייסבוק עם אלפי חברים לטיפים, שיתופי נסיעות ועזרה.' },
    ],
  },
};

const DEFAULT_CITY_GUIDE: CityGuide = {
  subtitle: 'מדריך קהילתי',
  quickFacts: [
    { label: '🚨 חירום', value: '112 בינלאומי' },
    { label: '📶 SIM', value: 'בדוק בנמל התעופה המקומי' },
  ],
  critical: [
    { emoji: '💧', title: 'מים', body: 'שתה מים בקבוקים בלבד במדינות מתפתחות.' },
    { emoji: '📋', title: 'ביטוח נסיעות', body: 'ודא שיש לך ביטוח נסיעות תקף לכל משך השהייה.' },
  ],
  israeli: [
    { emoji: '🇮🇱', title: 'קהילה ישראלית', body: 'חפש קבוצות ישראליות ברשתות החברתיות ליעד שלך.' },
  ],
};

/* ─── helpers ─── */
// Fallback color for a name not among the loaded participants — hash the whole string (not just the first char)
const senderColor = (n: string) => {
  let h = 0;
  for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
};
const pastelFor   = (n: string) => PASTELS[n.charCodeAt(0) % PASTELS.length];
const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
const fmtTime = (ts: string) => new Date(ts).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtSep = (ts: string) => {
  const d = new Date(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
};
const sameDay = (a: string, b: string) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};
const sameMinute = (a: string, b: string) => {
  const da = new Date(a), db = new Date(b);
  return sameDay(a, b) && da.getHours() === db.getHours() && da.getMinutes() === db.getMinutes();
};

/* ─── tail SVGs ─── */
/* Others (LEFT): protrudes left, white */
const TailLeft = () => (
  <svg width="8" height="14" viewBox="0 0 8 14"
    style={{ position: 'absolute', bottom: 0, left: -7, display: 'block', pointerEvents: 'none' }}>
    <path d="M8 0 C8 9, 0 10, 0 14 L8 14 Z" fill="#FFFFFF" />
  </svg>
);
/* Mine (RIGHT): protrudes right, green */
const TailRight = () => (
  <svg width="8" height="14" viewBox="0 0 8 14"
    style={{ position: 'absolute', bottom: 0, right: -7, display: 'block', pointerEvents: 'none' }}>
    <path d="M0 0 C0 9, 8 10, 8 14 L0 14 Z" fill="#D9FDD3" />
  </svg>
);

/* ── module-level caches (survive navigation) ── */
const _msgCache:     Record<string, GMessage[]> = {};
const _channelCache: Record<string, string>     = {}; // `${countryCode}:${cityEmoji}` → channelId
const _countCache:   Record<string, number>     = {}; // channelId → approved member count
// channelId → last-confirmed membership status. Used so we only OPTIMISTICALLY treat the user as an
// approved member when a prior DB check actually confirmed it — never merely because the channel is
// cached (that would let a *pending* request be silently upgraded to approved by markSeen()).
const _memberStatusCache: Record<string, 'none' | 'pending' | 'approved' | 'left'> = {};

// Channels the user explicitly left — persisted so opening the city again shows a rejoin screen
// instead of silently auto-joining.
// Invisible marker for system notices ("X left the group"). Stored inside a normal `type:'text'`
// message so it never trips a CHECK constraint on the `type` column. U+2061 won't collide with
// the reply (U+2063) or event (U+2064) markers.
const SYS_MARK = '⁡';
const LEFT_KEY = 'left_group_channels';
const _leftChannels: Set<string> = new Set(
  (() => { try { return JSON.parse(localStorage.getItem(LEFT_KEY) || '[]'); } catch { return []; } })()
);
const saveLeftChannels = () => { try { localStorage.setItem(LEFT_KEY, JSON.stringify([..._leftChannels])); } catch { /* ignore */ } };

/* ════════════════════════════════════════════════════ */
export function CityGroupChat({
  countryCode, countryFlag, cityName, cityEmoji,
  currentUserId, currentUserName, currentUserAvatar, onClose,
  onNavigateToUserProfile,
}: CityGroupChatProps) {

  const cityKey = `${countryCode}:${cityEmoji}`;
  const _initChannelId = _channelCache[cityKey] ?? null;
  const _initMsgs      = _initChannelId ? (_msgCache[_initChannelId] ?? []) : [];

  const [locSheet, setLocSheet] = useState<{ lat: number; lng: number; name: string | null } | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null); // last_seen_at captured BEFORE this open
  const [unreadReady, setUnreadReady] = useState(false);
  const [channelId,    setChannelId]    = useState<string | null>(_initChannelId);
  const [memberStatus, setMemberStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'just_approved' | 'left'>(
    // Only skip straight to 'approved' when a previous DB check CONFIRMED approval (cached below).
    // A cached channelId alone must NOT imply membership — otherwise a pending user re-opening the
    // group would trigger markSeen() and be auto-approved without the admin.
    _initChannelId
      ? (_leftChannels.has(_initChannelId) ? 'left' : (_memberStatusCache[_initChannelId] ?? 'loading'))
      : 'loading'
  );
  const [messages,     setMessages]     = useState<GMessage[]>(_initMsgs);
  const [msgsLoading,  setMsgsLoading]  = useState(_initMsgs.length === 0);
  const [memberCount,  setMemberCount]  = useState(_initChannelId ? (_countCache[_initChannelId] ?? 0) : 0);
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [locLoading,   setLocLoading]   = useState(false);
  const [openEvent,    setOpenEvent]    = useState<Event | null>(null); // shared-event card → details
  const [menuMsg,      setMenuMsg]      = useState<GMessage | null>(null); // long-press context menu
  const [replyTo,      setReplyTo]      = useState<GMessage | null>(null); // message being replied to
  const [toast,        setToast]        = useState<string | null>(null);
  const [typingUsers,  setTypingUsers]  = useState<Record<string, { name: string; ts: number }>>({}); // live "is typing" by userId — keyed by user_id
  const [showScroll,   setShowScroll]   = useState(false);
  const [unreadNew,    setUnreadNew]    = useState(0); // count of messages arrived while scrolled up
  const [reconnectTick, setReconnectTick] = useState(0); // bump to force the realtime channels to rebuild
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leftRef = useRef(false); // once we leave, stop markSeen from re-creating the membership
  const showInfoRef = useRef(false); // live: is the group-info screen open (so member changes refresh it)
  const [showAttach,   setShowAttach]   = useState(false);
  const [showInfo,     setShowInfo]     = useState(false);
  const [members,      setMembers]      = useState<GMember[]>([]);
  const [pendingReqs,  setPendingReqs]  = useState<GMember[]>([]);
  const [approvingId,  setApprovingId]  = useState<string | null>(null);
  const [groupDesc,    setGroupDesc]    = useState<string | null>(null);
  const [editingDesc,  setEditingDesc]  = useState(false);
  const [descDraft,    setDescDraft]    = useState('');
  const [showMenu,     setShowMenu]     = useState(false);
  const [showGuide,    setShowGuide]    = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving,      setLeaving]      = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // keep pinned to bottom while user is at the bottom
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const keepUnreadRef = useRef(false); // hold the view at the unread divider until the user scrolls
  const unreadHandled = useRef(false); // ensure the one-time unread reposition runs once
  const lastGestureRef = useRef(0); // timestamp of the last real user scroll gesture
  const seenIdsRef = useRef<Set<string>>(new Set()); // ids already on screen — only NEW messages get the pop-in
  const seenInitRef = useRef(false);
  const typingChanRef = useRef<ReturnType<typeof supabase.channel> | null>(null); // broadcast channel for "is typing"
  const lastTypingSentRef = useRef(0); // throttle outgoing typing broadcasts
  const fileRef   = useRef<HTMLInputElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);
  // Floating glass header / input → measure their heights so messages can
  // scroll *behind* them with matching top/bottom padding.
  const headerRef = useRef<HTMLDivElement>(null);
  const inputBarRef = useRef<HTMLDivElement>(null);
  const [headerH, setHeaderH] = useState(64);
  const [inputH, setInputH] = useState(56);
  useLayoutEffect(() => {
    const measure = () => {
      if (headerRef.current) setHeaderH(headerRef.current.offsetHeight);
      if (inputBarRef.current) setInputH(inputBarRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (headerRef.current) ro.observe(headerRef.current);
    if (inputBarRef.current) ro.observe(inputBarRef.current);
    return () => ro.disconnect();
  }, []);

  /* ── channel init (skip if already cached) ── */
  useEffect(() => {
    if (_channelCache[cityKey]) return; // already know the channelId
    (async () => {
      const { data: all } = await supabase.from('group_channels')
        .select('id, city_slug, created_at')
        .eq('country_code', countryCode).eq('city_emoji', cityEmoji)
        .order('created_at', { ascending: true });

      const save = (id: string) => {
        _channelCache[cityKey] = id;
        setChannelId(id);
      };

      if (all && all.length > 1) {
        const canonical = all[0];
        const dupeIds = all.slice(1).map(c => c.id);
        for (const dupeId of dupeIds) {
          await supabase.from('group_members').delete().eq('channel_id', dupeId).eq('user_id', currentUserId);
          await supabase.from('group_channels').delete().eq('id', dupeId);
        }
        if (canonical.city_slug !== cityEmoji)
          await supabase.from('group_channels').update({ city_slug: cityEmoji }).eq('id', canonical.id);
        save(canonical.id); return;
      }

      if (all && all.length === 1) {
        if (all[0].city_slug !== cityEmoji)
          await supabase.from('group_channels').update({ city_slug: cityEmoji }).eq('id', all[0].id);
        save(all[0].id); return;
      }

      const { data, error } = await supabase.from('group_channels')
        .upsert({ country_code: countryCode, city_slug: cityEmoji, city_name: cityName, city_emoji: cityEmoji },
          { onConflict: 'country_code,city_slug', ignoreDuplicates: false })
        .select('id').maybeSingle();
      if (error || !data) {
        const { data: sel } = await supabase.from('group_channels').select('id')
          .eq('country_code', countryCode).eq('city_emoji', cityEmoji).maybeSingle();
        if (sel) save(sel.id);
        return;
      }
      save(data.id);
    })();
  }, [cityKey]);

  /* ── check membership status after channel resolves ── */
  useEffect(() => {
    if (!channelId) return;
    if (_leftChannels.has(channelId)) { _memberStatusCache[channelId] = 'left'; setMemberStatus('left'); return; } // user left → require an explicit rejoin
    (async () => {
      const { data } = await supabase.from('group_members')
        .select('status').eq('channel_id', channelId).eq('user_id', currentUserId).maybeSingle();
      if (!data) { _memberStatusCache[channelId] = 'none'; setMemberStatus('none'); return; }
      const st = (data.status ?? 'approved') as 'pending' | 'approved' | 'left';
      _memberStatusCache[channelId] = st;
      setMemberStatus(st);
    })();
  }, [channelId]);

  /* ── join + realtime (only for approved members) ── */
  useEffect(() => {
    if (!channelId || memberStatus !== 'approved') return;
    const markSeen = () => supabase.from('group_members').upsert(
      { channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, last_seen_at: new Date().toISOString(), status: 'approved' },
      { onConflict: 'channel_id,user_id' });
    // Capture the PREVIOUS last_seen_at first, so we can open at the first unread
    // message — only THEN mark the chat as seen (overwriting last_seen_at to now).
    (async () => {
      const { data: me } = await supabase.from('group_members')
        .select('last_seen_at, status').eq('channel_id', channelId).eq('user_id', currentUserId).maybeSingle();
      // Safety net: never let an (optimistic) 'approved' UI state promote a real pending/left row.
      // A row that exists but isn't approved means the admin hasn't approved yet — bail out and
      // correct the UI to the pending/left screen instead of running markSeen (which sets approved).
      if (me && me.status && me.status !== 'approved') {
        _memberStatusCache[channelId] = me.status as 'pending' | 'left';
        setMemberStatus(me.status as 'pending' | 'left');
        return;
      }
      setLastRead(me?.last_seen_at ?? null);
      setUnreadReady(true);
      const isNewJoin = !me; // no prior membership row → this open is a fresh join
      await markSeen();
      _memberStatusCache[channelId] = 'approved';
      if (isNewJoin) {
        // WhatsApp-style "X joined the group" notice
        await supabase.from('group_messages').insert({ channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, content: `${SYS_MARK}${currentUserName} הצטרף/ה לקבוצה`, type: 'text' });
      }
      loadMemberCount();
    })();
    loadMessages();
    const msgSub = supabase.channel(`group-msg-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          if (leftRef.current) return; // we've left — don't process (and never markSeen ourselves back in)
          const msg = payload.new as Omit<GMessage, 'reactions'>;
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, { ...msg, reactions: [] }]);
          // they just sent → they're no longer typing
          setTypingUsers(prev => { if (!prev[msg.user_id]) return prev; const n = { ...prev }; delete n[msg.user_id]; return n; });
          if (msg.type === 'system' || (msg.content ?? '').startsWith(SYS_MARK)) loadMemberCount(); // someone left → refresh the participant count live
          // Only auto-scroll if already at the bottom, or if it's my own message — don't yank away from history
          if (stickRef.current || msg.user_id === currentUserId) scrollToBottom(true);
          else setUnreadNew(n => n + 1); // arrived while reading history → count it for the badge
          markSeen();
        }).subscribe((status) => {
          // Reliability: if the channel drops, schedule a rebuild (which re-runs this effect → reconnect + loadMessages catch-up)
          if (status === 'SUBSCRIBED') {
            if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
          } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !reconnectTimerRef.current) {
            reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; setReconnectTick(t => t + 1); }, 2500);
          }
        });
    const rxSub  = supabase.channel(`group-rx-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_reactions' }, (payload) => {
        // INSERT carries message_id — ignore reactions for messages not in this chat (e.g. another group).
        const mid = (payload.new as { message_id?: string })?.message_id;
        if (payload.eventType === 'INSERT' && mid && !messagesRef.current.some(m => m.id === mid)) return;
        refreshReactions(); // reactions only — no full message reload
      }).subscribe();
    const memSub = supabase.channel(`group-mem-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `channel_id=eq.${channelId}` }, () => {
        loadMemberCount();                       // count updates live (join / leave / approve)
        if (showInfoRef.current) loadGroupInfo(); // refresh the open members list live too
      }).subscribe();
    // ── live typing indicator over ephemeral broadcast (no DB writes) ──
    const typingSub = supabase.channel(`group-typing-${channelId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as { userId: string; name: string };
        if (!p?.userId || p.userId === currentUserId) return;
        setTypingUsers(prev => ({ ...prev, [p.userId]: { name: p.name, ts: Date.now() } }));
      })
      .on('broadcast', { event: 'stop' }, ({ payload }) => {
        const p = payload as { userId: string };
        if (!p?.userId) return;
        setTypingUsers(prev => { if (!prev[p.userId]) return prev; const n = { ...prev }; delete n[p.userId]; return n; });
      })
      .subscribe();
    typingChanRef.current = typingSub;
    return () => {
      if (!leftRef.current) supabase.from('group_members').update({ last_seen_at: new Date().toISOString() }).eq('channel_id', channelId).eq('user_id', currentUserId);
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      typingChanRef.current = null;
      supabase.removeChannel(msgSub); supabase.removeChannel(rxSub); supabase.removeChannel(memSub); supabase.removeChannel(typingSub);
    };
  }, [channelId, memberStatus, reconnectTick]);

  useEffect(() => { showInfoRef.current = showInfo; }, [showInfo]);

  // Messages present at mount must NOT animate — mark them seen before the first render.
  if (!seenInitRef.current) { messages.forEach(m => seenIdsRef.current.add(m.id)); seenInitRef.current = true; }
  /* ── mark rendered messages as "seen" (post-commit) so the pop-in plays once per new message ── */
  useEffect(() => { messages.forEach(m => seenIdsRef.current.add(m.id)); }, [messages]);

  /* ── prune stale typing entries (no broadcast for >4s ⇒ stopped) ── */
  useEffect(() => {
    if (Object.keys(typingUsers).length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTypingUsers(prev => {
        const n: typeof prev = {}; let changed = false;
        for (const k in prev) { if (now - prev[k].ts < 15000) n[k] = prev[k]; else changed = true; }
        return changed ? n : prev;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [typingUsers]);

  /* ── real-time approval listener for pending users ── */
  useEffect(() => {
    if (!channelId || memberStatus !== 'pending') return;
    const appSub = supabase.channel(`group-approval-${channelId}-${currentUserId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'group_members',
        filter: `channel_id=eq.${channelId}`,
      }, (payload) => {
        const row = payload.new as { user_id: string; status: string };
        if (row.user_id === currentUserId && row.status === 'approved') {
          setMemberStatus('just_approved');
        }
      }).subscribe();
    return () => { supabase.removeChannel(appSub); };
  }, [channelId, memberStatus]);

  const loadMemberCount = async () => {
    if (!channelId) return;
    const { count } = await supabase.from('group_members').select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId).eq('status', 'approved');
    const n = count ?? 0;
    _countCache[channelId] = n;
    setMemberCount(n);
  };


  const loadGroupInfo = async () => {
    if (!channelId) return;
    const [{ data: mems }, { data: pending }, { data: ch }] = await Promise.all([
      supabase.from('group_members').select('user_id,display_name,avatar_url,last_seen_at')
        .eq('channel_id', channelId).eq('status', 'approved').order('last_seen_at', { ascending: true }),
      supabase.from('group_members').select('user_id,display_name,avatar_url,last_seen_at')
        .eq('channel_id', channelId).eq('status', 'pending'),
      supabase.from('group_channels').select('description').eq('id', channelId).maybeSingle(),
    ]);
    // Admin status comes ONLY from the app admin panel (users.role === 'admin') — not per-group.
    const memberIds = (mems ?? []).map(m => m.user_id);
    const { data: roleRows } = memberIds.length
      ? await supabase.from('users').select('id, role').in('id', memberIds)
      : { data: [] as { id: string; role: string | null }[] };
    const adminSet = new Set((roleRows ?? []).filter(u => u.role === 'admin').map(u => u.id));
    setMembers((mems ?? []).map(m => ({ ...m, is_admin: adminSet.has(m.user_id) })));
    setPendingReqs((pending ?? []).map(m => ({ ...m, is_admin: false })));
    setGroupDesc(ch?.description ?? null);
  };

  const leaveGroup = async () => {
    if (!channelId || leaving) return;
    setLeaving(true);
    leftRef.current = true; // block markSeen (incl. the system-notice echo) from recreating the membership
    // WhatsApp-style notice — insert while still approved so RLS allows it; others see it live.
    const { error: sysErr } = await supabase.from('group_messages').insert({ channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, content: `${SYS_MARK}${currentUserName} עזב/ה את הקבוצה`, type: 'text' });
    if (sysErr) console.error('leave: system-notice insert failed', sysErr);
    // Mark as 'left' rather than DELETE (delete is RLS-blocked; UPDATE is allowed). This drops the
    // user from the approved count + members list, and the group-mem subscription pushes it live.
    const { error: updErr } = await supabase.from('group_members').update({ status: 'left' }).eq('channel_id', channelId).eq('user_id', currentUserId);
    if (updErr) console.error('leave: status update failed', updErr);
    _memberStatusCache[channelId] = 'left';
    _leftChannels.add(channelId); saveLeftChannels(); // remember: don't auto-rejoin on next open
    setLeaving(false);
    onClose(); // exit back to the messages list
  };

  const rejoinGroup = async () => {
    if (!channelId) return;
    _leftChannels.delete(channelId); saveLeftChannels();
    leftRef.current = false;
    await handleRequestJoin(); // request approval again → 'pending' (no silent auto-join)
  };

  const handleApprove = async (userId: string) => {
    if (!channelId || approvingId) return;
    setApprovingId(userId);
    const rpcRes = await supabase.rpc('approve_group_member', { p_channel_id: channelId, p_user_id: userId });
    setApprovingId(null);
    const rowsUpdated = rpcRes.data as number | null;
    const ok = !rpcRes.error && (rowsUpdated ?? 0) > 0;
    console.log('approve rpc:', { error: rpcRes.error, rowsUpdated, ok });
    if (!ok) { alert(`שגיאה באישור: ${rpcRes.error?.message ?? 'אין שורות עודכנו'}`); return; }
    const approved = pendingReqs.find(m => m.user_id === userId);
    if (approved) {
      setPendingReqs(prev => prev.filter(m => m.user_id !== userId));
      setMembers(prev => [...prev, { ...approved, is_admin: false }]);
      setMemberCount(prev => prev + 1);
      // WhatsApp-style "X joined the group" notice for the newly-approved member
      await supabase.from('group_messages').insert({ channel_id: channelId, user_id: userId, display_name: approved.display_name, avatar_url: approved.avatar_url, content: `${SYS_MARK}${approved.display_name} הצטרף/ה לקבוצה`, type: 'text' });
    }
  };

  const handleReject = async (userId: string) => {
    if (!channelId || approvingId) return;
    setApprovingId(userId);
    const rpcRes = await supabase.rpc('reject_group_member', { p_channel_id: channelId, p_user_id: userId });
    setApprovingId(null);
    console.log('reject rpc:', { error: rpcRes.error, data: rpcRes.data });
    setPendingReqs(prev => prev.filter(m => m.user_id !== userId));
  };


  const saveDesc = async () => {
    if (!channelId) return;
    const val = descDraft.trim() || null;
    const { error } = await supabase.rpc('update_group_description', {
      p_channel_id: channelId, p_description: val,
    });
    if (error) { console.error('saveDesc failed:', error); return; }
    setGroupDesc(val);
    setEditingDesc(false);
  };

  // Keep a live ref of messages so the reaction subscription can read current ids without a stale closure.
  const messagesRef = useRef<GMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Refresh only the reactions for the currently-loaded messages — no message reload, no flicker, no re-animate.
  const refreshReactions = useCallback(async () => {
    const ids = messagesRef.current.map(m => m.id);
    if (!ids.length) return;
    const { data: rxs } = await supabase.from('group_reactions').select('*').in('message_id', ids);
    const rxMap: Record<string, { emoji: string; users: string[] }[]> = {};
    for (const rx of rxs || []) {
      if (!rxMap[rx.message_id]) rxMap[rx.message_id] = [];
      const ex = rxMap[rx.message_id].find(r => r.emoji === rx.emoji);
      if (ex) ex.users.push(rx.user_id); else rxMap[rx.message_id].push({ emoji: rx.emoji, users: [rx.user_id] });
    }
    setMessages(prev => prev.map(m => ({
      ...m,
      reactions: (rxMap[m.id] || []).map(r => ({ emoji: r.emoji, count: r.users.length, mine: r.users.includes(currentUserId) })),
    })));
  }, [currentUserId]);

  const loadMessages = useCallback(async () => {
    if (!channelId) return;
    // Show cached messages instantly — no skeleton if we have them
    if (_msgCache[channelId]?.length) {
      _msgCache[channelId].forEach(m => seenIdsRef.current.add(m.id)); // fetched, not "new" → no pop-in
      setMessages(_msgCache[channelId]);
      setMsgsLoading(false);
    }
    // Always fetch fresh in background
    const { data: msgs } = await supabase.from('group_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: true }).limit(80);
    if (!msgs) { setMsgsLoading(false); return; }
    const ids = msgs.map(m => m.id);
    const { data: rxs } = ids.length ? await supabase.from('group_reactions').select('*').in('message_id', ids) : { data: [] };
    const rxMap: Record<string, { emoji: string; users: string[] }[]> = {};
    for (const rx of rxs || []) {
      if (!rxMap[rx.message_id]) rxMap[rx.message_id] = [];
      const ex = rxMap[rx.message_id].find(r => r.emoji === rx.emoji);
      if (ex) ex.users.push(rx.user_id); else rxMap[rx.message_id].push({ emoji: rx.emoji, users: [rx.user_id] });
    }
    const result = msgs.map(m => ({ ...m, reactions: (rxMap[m.id] || []).map(r => ({ emoji: r.emoji, count: r.users.length, mine: r.users.includes(currentUserId) })) }));
    _msgCache[channelId] = result;
    result.forEach(m => seenIdsRef.current.add(m.id)); // fetched batch, not "new" → no pop-in on first open / reaction reload
    setMessages(result);
    setMsgsLoading(false);
  }, [channelId, currentUserId]);

  // Catch up on messages missed while the app was backgrounded (the realtime socket drops on lock/background).
  useEffect(() => {
    const onResume = () => { if (document.visibilityState === 'visible') loadMessages(); };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [loadMessages]);

  const initialLoadDone = useRef(false);
  const scrollToBottom = (smooth = false) => {
    if (smooth) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // WhatsApp-style sender colors: assign a distinct color per user by order of appearance
  // (the current user is skipped — their bubbles are orange). Colors repeat only once the palette runs out.
  const nameColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    let i = 0;
    for (const m of messages) {
      const n = m.display_name;
      if (n && n !== currentUserName && !(n in map)) { map[n] = NAME_COLORS[i % NAME_COLORS.length]; i++; }
    }
    return map;
  }, [messages, currentUserName]);
  const colorFor = (n: string) => nameColorMap[n] ?? senderColor(n);

  // First message (from someone else) newer than our previous last_seen_at.
  const firstUnreadId = (() => {
    if (!lastRead) return null;
    const t = new Date(lastRead).getTime();
    const m = messages.find(mm => mm.user_id !== currentUserId && new Date(mm.created_at).getTime() > t);
    return m?.id ?? null;
  })();

  const scrollToUnread = () => {
    const el = scrollRef.current, u = firstUnreadRef.current;
    if (!el || !u) return;
    const top = u.getBoundingClientRect().top - el.getBoundingClientRect().top;
    el.scrollTop += top - (headerH + 10);
  };

  // Open at the BOTTOM when messages are present. Layout settles asynchronously
  // (measured header/input padding, fonts, images), so re-pin a few times.
  useLayoutEffect(() => {
    if (msgsLoading || initialLoadDone.current || !scrollRef.current) return;
    initialLoadDone.current = true;
    stickRef.current = true;
    const pin = () => {
      if (!scrollRef.current) return;
      if (stickRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      else if (keepUnreadRef.current) scrollToUnread();
    };
    pin();
    requestAnimationFrame(pin);
    requestAnimationFrame(() => requestAnimationFrame(pin));
    const t1 = setTimeout(pin, 120);
    const t2 = setTimeout(pin, 350);
    const t3 = setTimeout(pin, 700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [msgsLoading]);

  // Once the previous last-seen is known, jump up to the first unread (if any).
  useLayoutEffect(() => {
    if (!unreadReady || unreadHandled.current) return;
    unreadHandled.current = true;
    if (firstUnreadId && firstUnreadRef.current) {
      scrollToUnread();
      stickRef.current = false;
      keepUnreadRef.current = true; // hold here while images above settle
    }
  }, [unreadReady]);

  // The floating header / input bar heights are measured AFTER first paint, which
  // changes the scroll padding and would knock us off the bottom on first open.
  // Re-anchor whenever those heights settle.
  useLayoutEffect(() => {
    if (!scrollRef.current) return;
    if (stickRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    else if (keepUnreadRef.current) scrollToUnread();
  }, [headerH, inputH]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Only treat scrolls that follow a real user gesture as "user scrolled".
    // Programmatic scrolls and content-growth-induced scroll events must NOT
    // flip the stick flag, otherwise an image loading would strand us mid-chat.
    const markGesture = () => { lastGestureRef.current = Date.now(); };
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScroll(dist > 100);
      if (dist < 80) setUnreadNew(0); // reached the bottom → clear the new-message badge
      if (Date.now() - lastGestureRef.current < 500) {
        stickRef.current = dist < 80;       // user reached / left the bottom
        keepUnreadRef.current = false;      // user took control of the view
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('wheel', markGesture, { passive: true });
    el.addEventListener('touchmove', markGesture, { passive: true });
    el.addEventListener('keydown', markGesture);
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('wheel', markGesture);
      el.removeEventListener('touchmove', markGesture);
      el.removeEventListener('keydown', markGesture);
    };
  }, []);

  // While content grows (images / map snapshots loading after open) keep the view
  // anchored — to the bottom if the user is there, or to the unread divider on open.
  useEffect(() => {
    const content = contentRef.current;
    const el = scrollRef.current;
    if (!content || !el) return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight;
      else if (keepUnreadRef.current) scrollToUnread();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const sendText = async () => {
    if (!text.trim() || !channelId || sending) return;
    setSending(true);
    lastTypingSentRef.current = 0;
    typingChanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { userId: currentUserId } });
    let body = text.trim(); setText('');
    if (replyTo) {
      body = encodeReply(replyTo.display_name, msgSnippet(replyTo), body);
      setReplyTo(null);
    }
    if (textRef.current) textRef.current.style.height = 'auto';
    await supabase.from('group_messages').insert({ channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, content: body, type: 'text' });
    setSending(false);
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !channelId) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `group-chat/${channelId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('images').getPublicUrl(path);
      await supabase.from('group_messages').insert({ channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, type: 'image', image_url: publicUrl });
    } finally { setUploading(false); e.target.value = ''; }
  };

  const shareLocation = async () => {
    if (!channelId || locLoading) return;
    setLocLoading(true); setShowAttach(false);
    const send = async (lat: number, lng: number) => {
      await supabase.from('group_messages').insert({ channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, type: 'location', location_lat: lat, location_lng: lng, location_name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      setLocLoading(false);
    };
    const onNative = (e: Event) => { window.removeEventListener('nativeLocation', onNative); const { lat, lng } = (e as CustomEvent).detail; send(lat, lng); };
    window.addEventListener('nativeLocation', onNative);
    if ('geolocation' in navigator) navigator.geolocation.getCurrentPosition(pos => { window.removeEventListener('nativeLocation', onNative); send(pos.coords.latitude, pos.coords.longitude); }, () => {}, { enableHighAccuracy: true, timeout: 8000 });
    setTimeout(() => { window.removeEventListener('nativeLocation', onNative); setLocLoading(false); }, 12000);
  };

  const toggleReaction = async (messageId: string, emoji: string) => {
    const msg = messages.find(m => m.id === messageId);
    const removing = !!msg?.reactions.find(r => r.emoji === emoji && r.mine);
    setMenuMsg(null);
    // Optimistic: update the badge instantly, sync to the server in the background.
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      let reactions = m.reactions.map(r => ({ ...r }));
      const r = reactions.find(r => r.emoji === emoji);
      if (removing) {
        if (r) { r.count -= 1; r.mine = false; }
        reactions = reactions.filter(r => r.count > 0);
      } else if (r) {
        r.count += 1; r.mine = true;
      } else {
        reactions.push({ emoji, count: 1, mine: true });
      }
      return { ...m, reactions };
    }));
    const { error } = removing
      ? await supabase.from('group_reactions').delete().eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji)
      : await supabase.from('group_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
    if (error) refreshReactions(); // revert to server truth if it failed
  };

  /* ─── long-press context menu (WhatsApp-style) ─── */
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuOpenAt = useRef(0);
  const startPress = (msg: GMessage) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = setTimeout(() => {
      menuOpenAt.current = Date.now();
      setMenuMsg(msg);
      try { (navigator as Navigator & { vibrate?: (n: number) => void }).vibrate?.(15); } catch { /* no haptics */ }
    }, 400);
  };
  const cancelPress = () => { if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } };

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };

  const menuReply = () => { setReplyTo(menuMsg); setMenuMsg(null); setTimeout(() => textRef.current?.focus(), 50); };
  const menuCopy = () => {
    if (menuMsg) {
      const t = menuMsg.type === 'text' ? parseReply(menuMsg.content).body
        : menuMsg.type === 'location' ? (menuMsg.location_name ?? '') : '';
      if (t) navigator.clipboard?.writeText(t).catch(() => {});
    }
    setMenuMsg(null); showToast('הועתק ✓');
  };
  const menuDelete = async () => {
    const m = menuMsg; setMenuMsg(null);
    if (!m) return;
    setMessages(prev => prev.filter(x => x.id !== m.id)); // optimistic
    const { error } = await supabase.from('group_messages').delete().eq('id', m.id);
    if (error) { showToast('לא ניתן למחוק'); loadMessages(); } else { showToast('ההודעה נמחקה'); }
  };
  const openEventById = async (id: string) => {
    const { data } = await supabase.from('events').select('*').eq('id', id).maybeSingle();
    if (data) setOpenEvent(data as Event);
    else showToast('האירוע לא נמצא');
  };

  const menuReport = async () => {
    const m = menuMsg; setMenuMsg(null);
    showToast('תודה, ההודעה דווחה ✓');
    if (!m) return;
    try {
      await supabase.from('message_reports').insert({
        message_id: m.id,
        channel_id: channelId,
        reporter_id: currentUserId,
        reported_user_id: m.user_id,
        message_content: m.type === 'text' ? parseReply(m.content).body : (m.location_name ?? m.image_url ?? ''),
        message_type: m.type,
      });
    } catch { /* reports table not provisioned yet — toast already shown */ }
  };

  const onInput = () => {
    const el = textRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  /* ─── render message ─── */
  const renderMsg = (msg: GMessage, idx: number) => {
    // System notice (WhatsApp-style "X joined/left the group") — centered pill, no bubble/avatar.
    if (msg.type === 'system' || (msg.content ?? '').startsWith(SYS_MARK)) {
      const sysText = (msg.content ?? '').replace(SYS_MARK, '');
      const selfText = sysText.includes('הצטרף') ? 'הצטרפת לקבוצה' : 'עזבת את הקבוצה';
      return (
        <div key={msg.id} style={{ display: 'flex', justifyContent: 'center', margin: '10px 14px' }}>
          <span dir="rtl" style={{ background: 'rgba(60,55,50,0.10)', color: '#555', fontSize: 12.5, fontWeight: 500, padding: '5px 14px', borderRadius: 14, textAlign: 'center', maxWidth: '85%' }}>
            {msg.user_id === currentUserId ? selfText : sysText}
          </span>
        </div>
      );
    }
    const mine    = msg.user_id === currentUserId;
    const prev    = messages[idx - 1];
    const next    = messages[idx + 1];
    const isFirst   = !prev || prev.user_id !== msg.user_id;
    const isLast    = !next || next.user_id !== msg.user_id;
    const showSep   = !prev || !sameDay(prev.created_at, msg.created_at);
    // Only show the time on the last message of a same-sender, same-minute run
    const showTime  = !next || next.user_id !== msg.user_id || !sameMinute(msg.created_at, next.created_at);
    // WhatsApp-style: avatar on the LAST message of a same-sender, same-minute
    // run, bottom-aligned next to the tail (one avatar per burst, at the bottom)
    const showAvatar = !next || next.user_id !== msg.user_id || !sameMinute(msg.created_at, next.created_at);

    const bubbleBg  = mine ? '#FFD4A8' : '#FFFFFF';
    const textClr   = mine ? '#7C3400' : '#111111';
    const nameClr   = colorFor(msg.display_name);
    const showName  = !mine; // group sender label, inside every incoming bubble
    const noPad     = msg.type === 'image' || msg.type === 'location';
    const timeStr   = fmtTime(msg.created_at);
    const isNew     = !seenIdsRef.current.has(msg.id); // animate only freshly-arrived messages

    return (
      <div key={msg.id}>
        {/* Date separator */}
        {showSep && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
            <span style={{
              background: 'rgba(60,55,50,0.55)',
              color: '#FFFFFF',
              fontSize: 12, fontWeight: 600,
              padding: '5px 14px', borderRadius: 20,
              boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            }}>
              {fmtSep(msg.created_at)}
            </span>
          </div>
        )}

        {/* Message stack — bubble row (avatar anchored to the tail) + time/reactions below */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: mine ? 'flex-end' : 'flex-start',
          paddingLeft: 8, paddingRight: 8,
          marginBottom: isLast ? 6 : 2,
        }}>
          {/* Bubble row — avatar bottom-aligned to the bubble so it hugs the tail */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, maxWidth: '82%', marginBottom: msg.reactions.length > 0 ? 12 : 0, ...(isNew && { animation: 'gchat-pop 360ms cubic-bezier(0.34,1.56,0.64,1) both', transformOrigin: mine ? 'right bottom' : 'left bottom' }) }}>
            {/* Avatar attached to the tail (incoming only) */}
            {!mine && (
              showAvatar ? (
                <div
                  onClick={() => onNavigateToUserProfile?.(msg.user_id)}
                  style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: colorFor(msg.display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: `2px solid ${colorFor(msg.display_name)}`, marginBottom: -1, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
                >
                  {msg.avatar_url
                    ? <UserAvatar userId={msg.user_id} displayName={msg.display_name} avatarUrl={msg.avatar_url} size="small" />
                    : <span style={{ color: '#fff', fontWeight: 700, fontSize: 11 }}>{msg.display_name.charAt(0)}</span>
                  }
                </div>
              ) : <div style={{ width: 26, flexShrink: 0 }} />
            )}

            {/* Bubble */}
            <div
              style={{ position: 'relative', minWidth: 0, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}
              onTouchStart={() => startPress(msg)}
              onTouchMove={cancelPress}
              onTouchEnd={cancelPress}
              onContextMenu={(e) => { e.preventDefault(); setMenuMsg(msg); }}
            >
              {msg.type === 'text' && parseEvent(msg.content).event ? (
                /* Shared event → glass card that opens the event */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {showName && (
                    <span
                      onClick={() => onNavigateToUserProfile?.(msg.user_id)}
                      style={{ display: 'block', fontSize: 10, fontWeight: 700, color: nameClr, margin: '0 4px 3px', lineHeight: 1.2, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
                      dir="rtl"
                    >
                      {msg.display_name}
                    </span>
                  )}
                  <EventChatCard data={parseEvent(msg.content).event!} onClick={() => openEventById(parseEvent(msg.content).event!.id)} />
                </div>
              ) : msg.type === 'text' ? (
                /* iMessage-exact bubble (single SVG path, stretchable, fixed tail) */
                <MessageBubble mine={!mine} tail={showAvatar} color={bubbleBg} contentStyle={{ padding: showName ? '5px 14px 7px' : '7px 14px' }}>
                  {showName && (
                    <span
                      onClick={() => onNavigateToUserProfile?.(msg.user_id)}
                      style={{ display: 'block', fontSize: 10, fontWeight: 700, color: nameClr, marginBottom: 2, lineHeight: 1.2, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
                      dir="rtl"
                    >
                      {msg.display_name}
                    </span>
                  )}
                  {(() => {
                    const { reply, body } = parseReply(msg.content);
                    return (
                      <>
                        {reply && (() => {
                          // Replied-to sender's color — but orange when the reply targets MY own message
                          const replyClr = reply.n === currentUserName ? '#EA580C' : colorFor(reply.n);
                          return (
                            <div dir="rtl" style={{
                              borderInlineStart: `3px solid ${replyClr}`,
                              background: mine ? 'rgba(124,52,0,0.08)' : 'rgba(0,0,0,0.05)',
                              borderRadius: 8, padding: '3px 8px', marginBottom: 4, maxWidth: 240,
                            }}>
                              <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: replyClr, lineHeight: 1.3 }}>{reply.n === currentUserName ? 'אתה' : reply.n}</span>
                              <span style={{ display: 'block', fontSize: 12, color: mine ? 'rgba(124,52,0,0.7)' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reply.t}</span>
                            </div>
                          );
                        })()}
                        <p style={{ fontSize: 14, lineHeight: 1.4, color: textClr, margin: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }} dir="rtl">
                          {body}
                        </p>
                      </>
                    );
                  })()}
                </MessageBubble>
              ) : msg.type === 'image' && msg.image_url ? (
                /* iMessage-exact image bubble: photo clipped to the SVG outline path */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {showName && (
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: nameClr, margin: '0 4px 3px', lineHeight: 1.2 }} dir="rtl">
                      {msg.display_name}
                    </span>
                  )}
                  <ImageBubble src={msg.image_url} tailLeft={mine} tail={showAvatar} />
                </div>
              ) : msg.type === 'location' && msg.location_lat != null ? (
                /* iOS-style shared location: real map snapshot with a pin, clipped to the iMessage shape */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                  {showName && (
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: nameClr, margin: '0 4px 3px', lineHeight: 1.2 }} dir="rtl">
                      {msg.display_name}
                    </span>
                  )}
                  <ImageBubble
                    src={`https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/pin-l+FF3B30(${msg.location_lng},${msg.location_lat})/${msg.location_lng},${msg.location_lat},15,0/460x320@2x?access_token=${import.meta.env.VITE_MAPBOX_TOKEN}`}
                    tailLeft={mine}
                    tail={showAvatar}
                    maxW={230}
                    onClick={() => setLocSheet({ lat: msg.location_lat!, lng: msg.location_lng!, name: msg.location_name ?? null })}
                    caption={
                      <div dir="rtl">
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.25, textShadow: '0 1px 4px rgba(0,0,0,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <LocationName lat={msg.location_lat} lng={msg.location_lng} fallback={msg.location_name} />
                        </p>
                        <p style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.85)', margin: '1px 0 0', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                          מיקום משותף
                        </p>
                      </div>
                    }
                  />
                </div>
              ) : null}

              {/* Reactions — WhatsApp-style badge straddling the bubble's bottom edge */}
              {msg.reactions.length > 0 && (
                <div style={{ position: 'absolute', bottom: -11, zIndex: 3, display: 'flex', gap: 3, ...(mine ? { left: 2 } : { right: 18 }) }}>
                  {msg.reactions.map(r => (
                    <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px',
                        borderRadius: 14, cursor: 'pointer', lineHeight: 1,
                        background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 3px rgba(0,0,0,0.14)',
                      }}>
                      <span style={{ fontSize: 13 }}>{r.emoji}</span>
                      {r.count > 1 && <span style={{ fontSize: 11, fontWeight: 700, color: '#555' }}>{r.count}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Timestamp — under the bubble (offset past the avatar); once per same-minute run */}
          {showTime && (
            <span style={{ fontSize: 10, color: '#9AA0A6', marginTop: 3, marginInlineStart: !mine ? 31 : 0, paddingInline: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {timeStr}
            </span>
          )}
        </div>
      </div>
    );
  };

  const handleRequestJoin = async () => {
    if (!channelId) return;
    await supabase.from('group_members').upsert(
      { channel_id: channelId, user_id: currentUserId, display_name: currentUserName, avatar_url: currentUserAvatar, last_seen_at: new Date().toISOString(), status: 'pending' },
      { onConflict: 'channel_id,user_id' }
    );
    _memberStatusCache[channelId] = 'pending';
    setMemberStatus('pending');
  };

  const hasText = text.trim().length > 0;

  /* ── Loading / Pending / Join screens — the main chat renders ONLY for approved members ── */
  if (memberStatus !== 'approved') {
    const isPending      = memberStatus === 'pending';
    const isLoading      = memberStatus === 'loading' || !channelId; // still resolving channel/membership
    const isJustApproved = memberStatus === 'just_approved';
    const isLeft         = memberStatus === 'left';

    // Reusable "orb": the city emoji (or a status glyph) in a white disc with a pulsing
    // halo + gentle bob — gives the screen life without needing a coloured header bar.
    const heroOrb = (emoji: string, ring: string = '#F97316', pulse: boolean = true) => (
      <div style={{ position: 'relative', width: 132, height: 132, display: 'grid', placeItems: 'center', marginBottom: 24 }}>
        {pulse && <span style={{ position: 'absolute', inset: 13, borderRadius: '50%', background: ring, opacity: 0.18, animation: 'fomo-ring 2.6s ease-out infinite' }} />}
        {pulse && <span style={{ position: 'absolute', inset: 13, borderRadius: '50%', background: ring, opacity: 0.18, animation: 'fomo-ring 2.6s ease-out 1.3s infinite' }} />}
        <div style={{ width: 106, height: 106, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', fontSize: 52, boxShadow: `0 12px 30px ${ring}2E, 0 3px 10px rgba(0,0,0,0.06)`, animation: 'fomo-bob 4s ease-in-out infinite' }}>{emoji}</div>
      </div>
    );

    return (
      <div className="fomo-join" style={{
        position: 'fixed', inset: 0, zIndex: 120,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Rubik','Heebo',sans-serif",
        background: 'radial-gradient(125% 85% at 50% -10%, #FFF4E8 0%, #FFFFFF 55%)',
        overflow: 'hidden', direction: 'rtl',
        animation: 'gchat-slide 0.3s cubic-bezier(0.25,1,0.5,1)',
      }}>
        <style>{`
          @keyframes gchat-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes gchat-spin  { to { transform: rotate(360deg); } }
          @keyframes fomo-float-a { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-16px,20px) scale(1.08)} }
          @keyframes fomo-float-b { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(20px,-16px) scale(1.1)} }
          @keyframes fomo-ring { 0%{transform:scale(0.72);opacity:0.3} 80%{opacity:0} 100%{transform:scale(1.55);opacity:0} }
          @keyframes fomo-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
          @keyframes fomo-rise { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fomo-dot  { 0%,100%{transform:scale(0.6);opacity:0.35} 50%{transform:scale(1);opacity:1} }
          @keyframes approved-pop { from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }
          .fomo-btn { transition: transform .12s ease, box-shadow .12s ease; }
          .fomo-btn:active { transform: scale(0.97); }
          @media (prefers-reduced-motion: reduce){ .fomo-join *{animation-duration:.001ms!important;animation-iteration-count:1!important} }
        `}</style>

        {/* Soft floating background — alive, no coloured header bar */}
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-12%', right: '-16%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(253,186,116,0.38), rgba(253,186,116,0))', filter: 'blur(6px)', animation: 'fomo-float-a 9s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', bottom: '-14%', left: '-20%', width: 340, height: 340, borderRadius: '50%', background: 'radial-gradient(circle, rgba(251,146,60,0.24), rgba(251,146,60,0))', filter: 'blur(8px)', animation: 'fomo-float-b 12s ease-in-out infinite' }} />
          <div style={{ position: 'absolute', top: '34%', left: '6%', width: 150, height: 150, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.14), rgba(56,189,248,0))', filter: 'blur(6px)', animation: 'fomo-float-a 14s ease-in-out infinite' }} />
        </div>

        {/* Floating back button (RTL → top-right) */}
        <div style={{ position: 'absolute', top: 'max(14px, env(safe-area-inset-top))', right: 14, zIndex: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}>
          <BackButton onClick={onClose} variant="light" />
        </div>

        {/* Body */}
        <div style={{
          position: 'relative', zIndex: 1, flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 30px max(34px, env(safe-area-inset-bottom))',
          textAlign: 'center',
        }}>
          {isLoading ? (
            <div style={{ width: 54, height: 54, borderRadius: '50%', border: '3px solid #FCE3CC', borderTopColor: '#F97316', animation: 'gchat-spin 0.8s linear infinite' }} />
          ) : isJustApproved ? (
            <>
              <div style={{ animation: 'approved-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)' }}>
                {heroOrb('🎉', '#10B981')}
              </div>
              <h2 style={{ fontSize: 25, fontWeight: 800, color: '#059669', margin: '0 0 10px', animation: 'fomo-rise .5s both .05s' }}>אושרת לקבוצה!</h2>
              <p style={{ fontSize: 15.5, color: '#57534E', margin: '0 0 26px', lineHeight: 1.65, maxWidth: 300, animation: 'fomo-rise .5s both .12s' }}>
                המנהל אישר את בקשתך להצטרף לקבוצת <strong style={{ color: '#1C1C1E' }}>{cityName}</strong> 🎊
              </p>
              <button className="fomo-btn"
                onClick={() => { if (channelId) _memberStatusCache[channelId] = 'approved'; setMemberStatus('approved'); }}
                style={{ width: '100%', maxWidth: 300, padding: '15px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#34D399,#059669)', color: '#fff', fontSize: 16.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 22px rgba(16,185,129,0.35)', animation: 'fomo-rise .5s both .2s' }}>
                כניסה לקבוצה
              </button>
            </>
          ) : isLeft ? (
            <>
              {heroOrb(cityEmoji, '#F97316', false)}
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#1C1C1E', margin: '0 0 10px', animation: 'fomo-rise .5s both .05s' }}>עזבת את קבוצת {cityName}</h2>
              <p style={{ fontSize: 15.5, color: '#6B7280', margin: '0 0 26px', lineHeight: 1.65, maxWidth: 300, animation: 'fomo-rise .5s both .12s' }}>
                כבר לא מגיעות אליך הודעות מהקבוצה. אפשר להצטרף שוב בכל רגע.
              </p>
              <button className="fomo-btn"
                onClick={rejoinGroup}
                style={{ width: '100%', maxWidth: 300, padding: '15px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#FB923C,#F97316)', color: '#fff', fontSize: 16.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 22px rgba(249,115,22,0.32)', animation: 'fomo-rise .5s both .2s' }}>
                הצטרף מחדש
              </button>
              <button onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', animation: 'fomo-rise .5s both .26s' }}>חזרה</button>
            </>
          ) : isPending ? (
            <>
              {heroOrb('⏳', '#F59E0B')}
              <h2 style={{ fontSize: 23, fontWeight: 800, color: '#1C1C1E', margin: '0 0 10px', animation: 'fomo-rise .5s both .05s' }}>בקשתך נשלחה!</h2>
              <p style={{ fontSize: 15.5, color: '#6B7280', margin: '0 0 18px', lineHeight: 1.65, maxWidth: 300, animation: 'fomo-rise .5s both .12s' }}>
                הבקשה שלך להצטרף לקבוצת <strong style={{ color: '#1C1C1E' }}>{cityName}</strong> ממתינה לאישור המנהל.
              </p>
              <div style={{ display: 'flex', gap: 7, marginBottom: 20, animation: 'fomo-rise .5s both .18s' }}>
                {[0, 1, 2].map(i => <span key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: '#F59E0B', animation: `fomo-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.75)', border: '1px solid #F3E8DD', fontSize: 13, color: '#78716C', fontWeight: 600, marginBottom: 26, animation: 'fomo-rise .5s both .24s' }}>
                🔔 תקבל גישה ברגע שהמנהל יאשר
              </div>
              <button className="fomo-btn" onClick={onClose}
                style={{ width: '100%', maxWidth: 300, padding: '14px 24px', borderRadius: 16, border: '1.5px solid #FED7AA', background: '#fff', color: '#EA580C', fontSize: 15.5, fontWeight: 700, cursor: 'pointer', animation: 'fomo-rise .5s both .3s' }}>
                חזרה
              </button>
            </>
          ) : (
            <>
              {heroOrb(cityEmoji)}
              <h2 style={{ fontSize: 26, fontWeight: 800, color: '#1C1C1E', margin: '0 0 10px', animation: 'fomo-rise .5s both .05s' }}>קבוצת {cityName}</h2>
              <p style={{ fontSize: 15.5, color: '#6B7280', margin: '0 0 22px', lineHeight: 1.65, maxWidth: 305, animation: 'fomo-rise .5s both .12s' }}>
                הצטרף לטיילים ב{cityName} — שתפו חוויות, קבלו המלצות ומצאו חברים לדרך.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 30, animation: 'fomo-rise .5s both .19s' }}>
                {([['💬', "צ'אט חי"], ['📍', 'המלצות מקומיות'], ['🤝', 'חברים לדרך']] as [string, string][]).map(([e, t]) => (
                  <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 999, background: 'rgba(255,255,255,0.82)', border: '1px solid #F3E8DD', fontSize: 13, fontWeight: 600, color: '#57534E', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: 15 }}>{e}</span>{t}
                  </span>
                ))}
              </div>
              <button className="fomo-btn"
                onClick={handleRequestJoin}
                style={{ width: '100%', maxWidth: 300, padding: '15px 24px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg,#FB923C,#F97316)', color: '#fff', fontSize: 16.5, fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 22px rgba(249,115,22,0.35)', animation: 'fomo-rise .5s both .26s' }}>
                בקש להצטרף
              </button>
              <button onClick={onClose} style={{ marginTop: 14, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14.5, fontWeight: 600, cursor: 'pointer', animation: 'fomo-rise .5s both .32s' }}>ביטול</button>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ════════════ RENDER ════════════ */
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 120,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Rubik','Heebo',sans-serif",
      animation: 'gchat-slide 0.28s cubic-bezier(0.25,1,0.5,1)',
    }}>
      <style>{`
        @keyframes gchat-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes gchat-spin  { to { transform: rotate(360deg); } }
        @keyframes gchat-pop {
          0%   { transform: scale(0.8);  opacity: 0; }
          60%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1); }
        }
        @keyframes gchat-typing {
          0%, 60%, 100% { transform: translateY(0); }
          30%           { transform: translateY(-4px); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes gchat-pop { from { opacity: 0; } to { opacity: 1; } }
          @keyframes gchat-typing { 0%,100% { transform: none; } }
        }
      `}</style>

      {/* ── Header — glass (matches home), floats over messages ── */}
      <div ref={headerRef} style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(255,255,255,0.4)',
        paddingTop: 'env(safe-area-inset-top)',
        flexShrink: 0, zIndex: 10,
        boxShadow: '0 2px 16px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 10px' }}>
          {/* Back */}
          <BackButton onClick={onClose} />

          {/* Avatar + Name (clickable — opens info panel) */}
          <button
            onClick={() => { loadGroupInfo(); setConfirmLeave(false); setShowInfo(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: '1.5px solid rgba(255,255,255,0.6)' }}>
              {cityEmoji}
            </div>
            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
              <h1 style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em' }} dir="rtl">
                {countryFlag} {cityName}
              </h1>
              <p style={{ fontSize: 12, color: 'rgba(0,0,0,0.5)', margin: 0 }}>
                {memberCount === 0
                  ? <span style={{
                      display: 'inline-block', width: 64, height: 10, borderRadius: 5,
                      background: 'rgba(255,255,255,0.25)',
                      overflow: 'hidden', position: 'relative',
                    }}>
                      <span style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)',
                        animation: 'shimmer 1.4s infinite',
                      }} />
                      <style>{`@keyframes shimmer { from{transform:translateX(-100%)} to{transform:translateX(100%)} }`}</style>
                    </span>
                  : <>{memberCount} {memberCount === 1 ? 'חבר' : 'חברים'}</>}
              </p>
            </div>
          </button>

          {/* Actions */}
          <button onClick={() => setShowMenu(v => !v)} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: showMenu ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <MoreVertical size={19} style={{ color: '#333' }} />
          </button>
        </div>
      </div>

      {/* ── Messages area with WA-style bg (fills container; scrolls behind glass bars) ── */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#F3EFE9', backgroundImage: 'url(/chat-bg.png)', backgroundSize: '50%', backgroundRepeat: 'repeat' }}>
        <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingTop: headerH + 10, paddingBottom: inputH + 8 }}>
         <div ref={contentRef}>

          {/* Skeleton while loading */}
          {msgsLoading && (
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { mine: false, w1: 160, w2: 110 },
                { mine: true,  w1: 130, w2: 0   },
                { mine: false, w1: 200, w2: 140 },
                { mine: true,  w1: 180, w2: 90  },
                { mine: false, w1: 140, w2: 0   },
                { mine: true,  w1: 110, w2: 160 },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: s.mine ? 'flex-start' : 'flex-end', gap: 4 }}>
                  {!s.mine && <div style={{ width: 60, height: 9, borderRadius: 5, background: '#E5E7EB', marginBottom: 2, animation: 'sk-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.1}s` }} />}
                  <div style={{ width: s.w1, height: 36, borderRadius: 14, background: s.mine ? '#F3F4F6' : '#FFE4CC', animation: 'sk-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.12}s` }} />
                  {s.w2 > 0 && <div style={{ width: s.w2, height: 36, borderRadius: 14, background: s.mine ? '#F3F4F6' : '#FFE4CC', animation: 'sk-pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />}
                </div>
              ))}
              <style>{`@keyframes sk-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
            </div>
          )}

          {/* Empty state — only after load */}
          {!msgsLoading && messages.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: ORANGE, boxShadow: ORANGE_SH, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                {cityEmoji}
              </div>
              <div style={{ background: 'rgba(255,255,255,0.85)', borderRadius: 12, padding: '10px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#333', margin: '0 0 3px' }} dir="rtl">ברוכים הבאים לקבוצת {cityName}</p>
                <p style={{ fontSize: 12, color: '#888', margin: 0 }}>היו הראשונים לכתוב! 👋</p>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <React.Fragment key={m.id}>
              {m.id === firstUnreadId && (
                <div ref={firstUnreadRef} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 16px 10px' }}>
                  <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.10)' }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', whiteSpace: 'nowrap' }}>הודעות שלא נקראו</span>
                  <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.10)' }} />
                </div>
              )}
              {renderMsg(m, i)}
            </React.Fragment>
          ))}

          {/* Live typing indicator (ephemeral broadcast) */}
          {(() => {
            const names = Object.values(typingUsers).map(t => t.name);
            if (names.length === 0) return null;
            const label = names.length === 1 ? `${names[0]} מקליד/ה`
              : names.length === 2 ? `${names[0]} ו${names[1]} מקלידים`
              : `${names[0]} ועוד ${names.length - 1} מקלידים`;
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 18, paddingRight: 18, marginBottom: 8, animation: 'gchat-pop 260ms ease-out both', transformOrigin: 'left bottom' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {[4, 5, 6].map((d, i) => (
                    <span key={i} style={{ width: d, height: d, borderRadius: '50%', background: 'rgba(0,0,0,0.3)', display: 'inline-block', animation: `gchat-typing 1.2s ${i * 0.16}s infinite ease-in-out` }} />
                  ))}
                </div>
                <span dir="rtl" style={{ fontSize: 12.5, fontWeight: 500, color: 'rgba(0,0,0,0.6)' }}>{label}</span>
              </div>
            );
          })()}
          <div ref={bottomRef} />
         </div>
        </div>

        {/* Scroll to bottom — float ABOVE the glass input bar so it isn't hidden behind it */}
        {showScroll && (
          <button onClick={() => { setUnreadNew(0); stickRef.current = true; scrollToBottom(true); }} style={{
            position: 'absolute', bottom: inputH + 12, right: 12, zIndex: 11,
            width: 38, height: 38, borderRadius: '50%',
            background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ChevronDown size={18} style={{ color: '#555' }} />
            {unreadNew > 0 && (
              <span style={{
                position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                background: ORANGE, boxShadow: ORANGE_SH,
                color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: '18px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {unreadNew > 99 ? '99+' : unreadNew}
              </span>
            )}
          </button>
        )}
      </div>

      {/* ── Three-dot menu ── */}
      {showMenu && (
        <>
          <div style={{ position: 'absolute', inset: 0, zIndex: 200 }} onClick={() => setShowMenu(false)} />
          <div style={{
            position: 'absolute', top: 58, right: 8, zIndex: 201,
            background: '#fff', borderRadius: 14,
            boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid rgba(0,0,0,0.07)',
            minWidth: 190, overflow: 'hidden',
          }}>
            {[
              { icon: Map, label: 'מדריך מדינה', color: '#F97316', action: () => { setShowMenu(false); setShowGuide(true); } },
            ].map(({ icon: Icon, label, color, action }) => (
              <button key={label} onClick={action} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                width: '100%', border: 'none', background: 'transparent', cursor: 'pointer',
                direction: 'rtl', fontFamily: 'inherit',
              }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} style={{ color }} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: '#111' }}>{label}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── City Guide Screen ── */}
      {showGuide && (() => {
        const g = CITY_GUIDES[`${countryCode}:${cityEmoji}`] ?? DEFAULT_CITY_GUIDE;
        return (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 50,
            display: 'flex', flexDirection: 'column',
            fontFamily: "'Rubik','Heebo',sans-serif",
            animation: 'ginfo-slide 0.28s cubic-bezier(0.25,1,0.5,1)',
            background: '#F4F6F9',
          }}>
            {/* Header */}
            <div style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(0,0,0,0.08)', paddingTop: 'env(safe-area-inset-top)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 10px' }}>
                <BackButton onClick={() => setShowGuide(false)} />
                <h2 style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#111', margin: 0, textAlign: 'right' }} dir="rtl">
                  מדריך {cityEmoji} {cityName}
                </h2>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px', paddingBottom: 'max(24px, env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Hero */}
              <div style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', borderRadius: 20, padding: '22px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 52, lineHeight: 1 }}>{cityEmoji}</span>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0, textAlign: 'center' }} dir="rtl">{countryFlag} {cityName}</h3>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', margin: 0, textAlign: 'center' }} dir="rtl">{g.subtitle}</p>
              </div>

              {/* Quick facts */}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
                {g.quickFacts.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < g.quickFacts.length - 1 ? '1px solid #F0F0F0' : 'none', direction: 'rtl' }}>
                    <span style={{ fontSize: 13, color: '#888' }}>{f.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'left' }}>{f.value}</span>
                  </div>
                ))}
              </div>

              {/* Critical */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, direction: 'rtl' }}>
                  <AlertTriangle size={15} style={{ color: '#EF4444' }} />
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', margin: 0 }}>דברים קריטיים לדעת</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {g.critical.map((item, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', direction: 'rtl' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{item.emoji} {item.title}</p>
                      <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.6 }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Israeli tips */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, direction: 'rtl' }}>
                  <span style={{ fontSize: 15 }}>🇮🇱</span>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#1565C0', margin: 0 }}>רלוונטי לישראלים</p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {g.israeli.map((item, i) => (
                    <div key={i} style={{ background: '#fff', borderRadius: 14, padding: '14px 16px', direction: 'rtl', borderRight: '3px solid #1565C0' }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{item.emoji} {item.title}</p>
                      <p style={{ fontSize: 13, color: '#555', margin: 0, lineHeight: 1.6 }}>{item.body}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* ── Group Info Screen (full-screen, slides in from right like WhatsApp) ── */}
      {showInfo && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Rubik','Heebo',sans-serif",
          animation: 'ginfo-slide 0.28s cubic-bezier(0.25,1,0.5,1)',
          background: '#fff',
        }}>
          <style>{`
            @keyframes ginfo-slide { from { transform: translateX(-100%); } to { transform: translateX(0); } }
          `}</style>

          {/* Header — same glass style */}
          <div style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,0,0,0.08)',
            paddingTop: 'env(safe-area-inset-top)',
            flexShrink: 0,
            boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px 10px' }}>
              <BackButton onClick={() => setShowInfo(false)} />
              <h2 style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#111', margin: 0, textAlign: 'right' }} dir="rtl">מידע על הקבוצה</h2>
              <button onClick={() => setConfirmLeave(true)} title="עזוב את הקבוצה" style={{
                width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <LogOut size={18} style={{ color: '#DC2626', transform: 'scaleX(-1)' }} />
              </button>
            </div>
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>

            {/* Hero — big avatar + name + description */}
            <div style={{ padding: '28px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 72, lineHeight: 1 }}>
                {cityEmoji}
              </div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#111', margin: 0, textAlign: 'center' }} dir="rtl">
                {countryFlag} {cityName}
              </h3>
              <p style={{ fontSize: 13, color: '#888', margin: 0 }}>
                קבוצה · {memberCount} {memberCount === 1 ? 'חבר' : 'חברים'}
              </p>
              {editingDesc ? (
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <textarea
                    autoFocus
                    value={descDraft}
                    onChange={e => setDescDraft(e.target.value)}
                    placeholder="הוסף תיאור לקבוצה..."
                    dir="rtl"
                    rows={3}
                    style={{
                      width: '100%', maxWidth: 320, resize: 'none', outline: 'none',
                      border: '1.5px solid #F97316', borderRadius: 10, padding: '8px 12px',
                      fontSize: 14, color: '#111', lineHeight: 1.6, fontFamily: 'inherit',
                      background: '#FFF8F3',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setEditingDesc(false)} style={{ padding: '6px 16px', borderRadius: 20, border: '1px solid #DDD', background: '#fff', fontSize: 13, color: '#555', cursor: 'pointer' }}>
                      ביטול
                    </button>
                    <button onClick={saveDesc} style={{ padding: '6px 16px', borderRadius: 20, border: 'none', background: '#F97316', fontSize: 13, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Check size={13} /> שמור
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {groupDesc ? (
                    <p style={{ fontSize: 14, color: '#333', textAlign: 'center', lineHeight: 1.6, margin: 0 }} dir="rtl">{groupDesc}</p>
                  ) : (
                    <p style={{ fontSize: 13, color: '#BDBDBD', textAlign: 'center', margin: 0 }} dir="rtl">אין תיאור לקבוצה</p>
                  )}
                  <button
                    onClick={() => { setDescDraft(groupDesc ?? ''); setEditingDesc(true); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                  >
                    <Pencil size={14} style={{ color: '#F97316' }} />
                  </button>
                </div>
              )}
            </div>

            <div style={{ height: 1, background: '#F0F0F0', margin: '0 16px' }} />

            {/* Pending requests (admin only) */}
            {pendingReqs.length > 0 && members.some(x => x.user_id === currentUserId && x.is_admin) && (
              <div style={{ padding: '0 0 8px' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#F97316', letterSpacing: '0.05em', margin: '12px 0 4px', padding: '0 16px', textAlign: 'right' }}>
                  בקשות ממתינות ({pendingReqs.length})
                </p>
                {pendingReqs.map((m, i) => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid #F3F3F3', direction: 'rtl', background: '#FFFBF7' }}>
                    <div
                      onClick={() => onNavigateToUserProfile?.(m.user_id)}
                      style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
                    >
                      {m.avatar_url
                        ? <UserAvatar userId={m.user_id} displayName={m.display_name} avatarUrl={m.avatar_url} size="medium" />
                        : <span style={{ color: '#555', fontWeight: 700, fontSize: 16 }}>{m.display_name.charAt(0)}</span>
                      }
                    </div>
                    <div
                      onClick={() => onNavigateToUserProfile?.(m.user_id)}
                      style={{ flex: 1, cursor: onNavigateToUserProfile ? 'pointer' : 'default' }}
                    >
                      <span style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>{m.display_name}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleApprove(m.user_id); }}
                        disabled={!!approvingId}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#D1FAE5', cursor: approvingId ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: approvingId && approvingId !== m.user_id ? 0.5 : 1 }}>
                        {approvingId === m.user_id
                          ? <div style={{ width: 14, height: 14, border: '2px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'gchat-spin 0.7s linear infinite' }} />
                          : <Check size={18} style={{ color: '#059669' }} />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleReject(m.user_id); }}
                        disabled={!!approvingId}
                        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: '#FEE2E2', cursor: approvingId ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: approvingId && approvingId !== m.user_id ? 0.5 : 1 }}>
                        <X size={18} style={{ color: '#DC2626' }} />
                      </button>
                    </div>
                  </div>
                ))}
                <div style={{ height: 1, background: '#F0F0F0', margin: '8px 16px 0' }} />
              </div>
            )}

            {/* Members list */}
            <div style={{ padding: '12px 0' }}>
              {(() => {
                const sorted = [...members].sort((a, b) => {
                  if (a.is_admin && !b.is_admin) return -1;
                  if (!a.is_admin && b.is_admin) return 1;
                  return 0;
                });
                const admins  = sorted.filter(m => m.is_admin);
                const regular = sorted.filter(m => !m.is_admin);

                const MemberRow = ({ m, i }: { m: GMember; i: number }) => {
                  const isAdmin = !!m.is_admin;
                  const isSelf  = m.user_id === currentUserId;
                  const canNav  = !isSelf && !!onNavigateToUserProfile;
                  const inner = (
                    <>
                      {/* Avatar */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F0F0' }}>
                          {m.avatar_url
                            ? <UserAvatar userId={m.user_id} displayName={m.display_name} avatarUrl={m.avatar_url} size="medium" />
                            : <span style={{ color: '#555', fontWeight: 700, fontSize: 16 }}>{m.display_name.charAt(0)}</span>
                          }
                        </div>
                        {isAdmin && (
                          <div style={{
                            position: 'absolute', bottom: 0, left: 0,
                            width: 18, height: 18, borderRadius: '50%',
                            background: '#F97316', border: '2px solid #fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Crown size={9} style={{ color: '#fff' }} />
                          </div>
                        )}
                      </div>
                      <div style={{ flex: 1, textAlign: 'right' }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>{m.display_name}</span>
                        {isSelf && <span style={{ fontSize: 11, color: '#9CA3AF', marginRight: 6 }}>אתה</span>}
                      </div>
                      {isAdmin && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316', flexShrink: 0 }}>מנהל</span>
                      )}
                      {canNav && (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
                          <path d="M6 12L10 8L6 4" stroke="#111" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </>
                  );

                  const sharedStyle: React.CSSProperties = {
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    borderTop: i === 0 ? 'none' : '1px solid #F3F3F3',
                    direction: 'rtl', textAlign: 'right', background: 'none',
                    WebkitTapHighlightColor: 'transparent',
                  };

                  if (canNav) {
                    return (
                      <button
                        onClick={() => onNavigateToUserProfile!(m.user_id)}
                        style={{ ...sharedStyle, border: 'none', cursor: 'pointer' }}
                      >
                        {inner}
                      </button>
                    );
                  }
                  return <div style={sharedStyle}>{inner}</div>;
                };

                return (
                  <>
                    {admins.map((m, i) => <MemberRow key={m.user_id} m={m} i={i} />)}
                    {regular.length > 0 && (
                      <>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#888', letterSpacing: '0.05em', margin: '12px 0 4px', padding: '0 16px', textAlign: 'right' }}>חברים</p>
                        {regular.map((m, i) => <MemberRow key={m.user_id} m={m} i={i} />)}
                      </>
                    )}
                  </>
                );
              })()}
            </div>

          </div>

          {/* Leave-group confirmation dialog */}
          {confirmLeave && (
            <div onClick={() => !leaving && setConfirmLeave(false)} style={{
              position: 'absolute', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}>
              <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 18, padding: 22, width: '100%', maxWidth: 320, boxShadow: '0 10px 40px rgba(0,0,0,0.25)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <LogOut size={24} style={{ color: '#DC2626', transform: 'scaleX(-1)' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#111', textAlign: 'center' }} dir="rtl">לעזוב את הקבוצה?</p>
                  <p style={{ margin: 0, fontSize: 13, color: '#888', textAlign: 'center' }} dir="rtl">לא תקבל יותר הודעות מהקבוצה הזו.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={leaveGroup} disabled={leaving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#DC2626', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{leaving ? 'עוזב…' : 'עזוב'}</button>
                  <button onClick={() => setConfirmLeave(false)} disabled={leaving} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.12)', background: '#fff', color: '#555', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>ביטול</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Input bar (glass, matches home), floats over messages ── */}
      <div ref={inputBarRef} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'transparent',
        flexShrink: 0, zIndex: 10,
        padding: '6px 26px',
        paddingBottom: 'calc(max(10px, env(safe-area-inset-bottom)) + 10px)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />

        {/* Reply preview (WhatsApp-style) */}
        {replyTo && (() => {
          const previewClr = replyTo.display_name === currentUserName ? '#EA580C' : colorFor(replyTo.display_name);
          return (
          <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 14, padding: '6px 10px', boxShadow: '0 2px 10px rgba(0,0,0,0.12)' }}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: previewClr }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: previewClr, lineHeight: 1.3 }}>{replyTo.display_name === currentUserName ? 'אתה' : replyTo.display_name}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msgSnippet(replyTo)}</span>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={15} style={{ color: '#666' }} />
            </button>
          </div>
          );
        })()}

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>

        {/* Attach tray popup */}
        {showAttach && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setShowAttach(false)} />
            <div style={{
              position: 'absolute', bottom: 'calc(100% + 8px)', left: 8, zIndex: 30,
              background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(16px)',
              borderRadius: 18, boxShadow: '0 6px 32px rgba(0,0,0,0.18)',
              border: '1px solid rgba(0,0,0,0.06)', overflow: 'hidden', width: 190,
            }}>
              {[
                { icon: ImageIcon, label: 'תמונה',  color: '#8B5CF6', action: () => { setShowAttach(false); fileRef.current?.click(); }, loading: uploading },
                { icon: MapPin,   label: 'מיקום',   color: '#10B981', action: shareLocation, loading: locLoading },
                { icon: Camera,   label: 'מצלמה',   color: '#06B6D4', action: () => setShowAttach(false), loading: false },
              ].map(({ icon: Icon, label, color, action, loading }) => (
                <button key={label} onClick={action}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {loading
                      ? <div style={{ width: 16, height: 16, border: `2px solid ${color}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'gchat-spin 0.7s linear infinite' }} />
                      : <Icon size={17} style={{ color }} />
                    }
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#1F2937', fontFamily: 'inherit' }} dir="rtl">{label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Emoji + text pill */}
        <div style={{
          flex: 1, background: '#fff', borderRadius: 24, minHeight: 44,
          display: 'flex', alignItems: 'flex-end',
          paddingLeft: 6, paddingRight: 12, paddingTop: 6, paddingBottom: 6,
          boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
          gap: 4,
        }}>
          <button onClick={() => setShowAttach(v => !v)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Smile size={22} style={{ color: '#8696A0' }} />
          </button>
          <textarea
            ref={textRef}
            value={text}
            onChange={e => {
              const v = e.target.value;
              setText(v);
              const now = Date.now();
              if (!v) {
                // input cleared → stop showing immediately
                lastTypingSentRef.current = 0;
                typingChanRef.current?.send({ type: 'broadcast', event: 'stop', payload: { userId: currentUserId } });
              } else if (now - lastTypingSentRef.current > 1500) {
                // keep the indicator alive while there's text being changed (expires 15s after last change)
                lastTypingSentRef.current = now;
                typingChanRef.current?.send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId, name: currentUserName } });
              }
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
            onInput={onInput}
            placeholder="הודעה..."
            dir="rtl"
            rows={1}
            style={{
              flex: 1, background: 'transparent', resize: 'none', outline: 'none', border: 'none',
              fontSize: 15.5, color: '#111', lineHeight: 1.45, maxHeight: 120, minWidth: 0,
              alignSelf: 'flex-end', fontFamily: 'inherit',
            }}
          />
          <button onClick={() => setShowAttach(v => !v)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Paperclip size={20} style={{ color: '#8696A0' }} />
          </button>
        </div>

        {/* Mic / Send */}
        <button
          onClick={hasText ? sendText : undefined}
          disabled={sending}
          style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer',
            background: ORANGE, boxShadow: ORANGE_SH,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
          {sending
            ? <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'gchat-spin 0.7s linear infinite' }} />
            : hasText
              ? <Send size={18} style={{ color: '#fff', transform: 'scaleX(-1)' }} />
              : <Mic size={20} style={{ color: '#fff' }} />
          }
        </button>
        </div>
      </div>

      {/* ── Long-press message menu (WhatsApp-style): reactions + actions ── */}
      {menuMsg && (() => {
        const isMine = menuMsg.user_id === currentUserId;
        const amAdmin = members.some(x => x.user_id === currentUserId && x.is_admin);
        const canDelete = isMine || amAdmin;
        return (
          <div
            onClick={() => { if (Date.now() - menuOpenAt.current > 350) setMenuMsg(null); }}
            style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, animation: 'fade-in 0.15s ease' }}
            dir="rtl"
          >
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: 320, width: '100%' }}>
              {/* Emoji reactions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#fff', borderRadius: 30, padding: '7px 12px', boxShadow: '0 6px 30px rgba(0,0,0,0.22)' }}>
                {QUICK_EMOJIS.map(e => (
                  <button key={e} onClick={() => toggleReaction(menuMsg.id, e)}
                    style={{ fontSize: 26, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 3, transition: 'transform 0.12s' }}
                    onMouseDown={(ev) => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1.3)'; }}
                    onMouseUp={(ev) => { (ev.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
                    {e}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 30px rgba(0,0,0,0.22)', minWidth: 200 }}>
                {[
                  { key: 'reply',  label: 'הגב',   icon: <CornerUpLeft size={19} />, color: '#111', onClick: menuReply },
                  ...(menuMsg.type === 'text' || menuMsg.type === 'location'
                    ? [{ key: 'copy', label: 'העתק', icon: <Copy size={19} />, color: '#111', onClick: menuCopy }] : []),
                  ...(canDelete
                    ? [{ key: 'delete', label: 'מחק', icon: <Trash2 size={19} />, color: '#E53935', onClick: menuDelete }] : []),
                  ...(!isMine
                    ? [{ key: 'report', label: 'דווח', icon: <Flag size={19} />, color: '#E53935', onClick: menuReport }] : []),
                ].map((a, i, arr) => (
                  <button key={a.key} onClick={a.onClick}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      width: '100%', padding: '13px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
                      borderBottom: i < arr.length - 1 ? '1px solid #F0F0F0' : 'none',
                      fontFamily: 'Heebo, sans-serif',
                    }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: a.color }}>{a.label}</span>
                    <span style={{ color: a.color, display: 'flex' }}>{a.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 'calc(90px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 320, background: 'rgba(40,40,40,0.92)', color: '#fff', fontSize: 13.5, fontWeight: 600, padding: '9px 18px', borderRadius: 22, boxShadow: '0 4px 20px rgba(0,0,0,0.3)', fontFamily: 'Heebo, sans-serif', animation: 'fade-in 0.2s ease', pointerEvents: 'none', whiteSpace: 'nowrap' }} dir="rtl">
          {toast}
        </div>
      )}

      {/* Open-location action sheet */}
      {locSheet && (
        <OpenLocationSheet
          lat={locSheet.lat}
          lng={locSheet.lng}
          name={locSheet.name}
          onClose={() => setLocSheet(null)}
        />
      )}

      {/* Shared-event details */}
      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          currentUserId={currentUserId}
          onClose={() => setOpenEvent(null)}
        />
      )}
    </div>
  );
}
