import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { MoreVertical, Send, Mic, MapPin, Image as ImageIcon, ChevronDown, Camera, Smile, Paperclip, X, Crown, Pencil, Check, Map, Phone, DollarSign, Clock, Wifi, AlertTriangle, CornerUpLeft, Copy, Flag, Trash2 } from 'lucide-react';
import { BackButton } from './BackButton';
import { MessageBubble } from './MessageBubble';
import { ImageBubble } from './ImageBubble';
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
const NAME_COLORS = ['#C62828', '#6A1B9A', '#1565C0', '#00695C', '#BF360C', '#F57F17'];

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
const senderColor = (n: string) => NAME_COLORS[n.charCodeAt(0) % NAME_COLORS.length];
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

/* ════════════════════════════════════════════════════ */
export function CityGroupChat({
  countryCode, countryFlag, cityName, cityEmoji,
  currentUserId, currentUserName, currentUserAvatar, onClose,
}: CityGroupChatProps) {

  const cityKey = `${countryCode}:${cityEmoji}`;
  const _initChannelId = _channelCache[cityKey] ?? null;
  const _initMsgs      = _initChannelId ? (_msgCache[_initChannelId] ?? []) : [];

  const [locSheet, setLocSheet] = useState<{ lat: number; lng: number; name: string | null } | null>(null);
  const [lastRead, setLastRead] = useState<string | null>(null); // last_seen_at captured BEFORE this open
  const [unreadReady, setUnreadReady] = useState(false);
  const [channelId,    setChannelId]    = useState<string | null>(_initChannelId);
  const [memberStatus, setMemberStatus] = useState<'loading' | 'none' | 'pending' | 'approved' | 'just_approved'>(_initChannelId ? 'approved' : 'loading');
  const [messages,     setMessages]     = useState<GMessage[]>(_initMsgs);
  const [msgsLoading,  setMsgsLoading]  = useState(_initMsgs.length === 0);
  const [memberCount,  setMemberCount]  = useState(_initChannelId ? (_countCache[_initChannelId] ?? 0) : 0);
  const [text,         setText]         = useState('');
  const [sending,      setSending]      = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [locLoading,   setLocLoading]   = useState(false);
  const [menuMsg,      setMenuMsg]      = useState<GMessage | null>(null); // long-press context menu
  const [replyTo,      setReplyTo]      = useState<GMessage | null>(null); // message being replied to
  const [toast,        setToast]        = useState<string | null>(null);
  const [showScroll,   setShowScroll]   = useState(false);
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true); // keep pinned to bottom while user is at the bottom
  const firstUnreadRef = useRef<HTMLDivElement>(null);
  const keepUnreadRef = useRef(false); // hold the view at the unread divider until the user scrolls
  const unreadHandled = useRef(false); // ensure the one-time unread reposition runs once
  const lastGestureRef = useRef(0); // timestamp of the last real user scroll gesture
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
    (async () => {
      const { data } = await supabase.from('group_members')
        .select('status').eq('channel_id', channelId).eq('user_id', currentUserId).maybeSingle();
      if (!data) { setMemberStatus('none'); return; }
      setMemberStatus((data.status ?? 'approved') as 'pending' | 'approved');
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
        .select('last_seen_at').eq('channel_id', channelId).eq('user_id', currentUserId).maybeSingle();
      setLastRead(me?.last_seen_at ?? null);
      setUnreadReady(true);
      await markSeen();
      loadMemberCount();
    })();
    loadMessages();
    const msgSub = supabase.channel(`group-msg-${channelId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const msg = payload.new as Omit<GMessage, 'reactions'>;
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, { ...msg, reactions: [] }]);
          scrollToBottom(true); markSeen();
        }).subscribe();
    const rxSub  = supabase.channel(`group-rx-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_reactions' }, () => loadMessages()).subscribe();
    const memSub = supabase.channel(`group-mem-${channelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter: `channel_id=eq.${channelId}` }, () => loadMemberCount()).subscribe();
    return () => {
      supabase.from('group_members').update({ last_seen_at: new Date().toISOString() }).eq('channel_id', channelId).eq('user_id', currentUserId);
      supabase.removeChannel(msgSub); supabase.removeChannel(rxSub); supabase.removeChannel(memSub);
    };
  }, [channelId, memberStatus]);

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

  const adminKey = (cid: string) => `group_admins_${cid}`;
  const getAdminIds = (cid: string): string[] => {
    try { return JSON.parse(localStorage.getItem(adminKey(cid)) || '[]'); } catch { return []; }
  };
  const saveAdminIds = (cid: string, ids: string[]) => {
    localStorage.setItem(adminKey(cid), JSON.stringify(ids));
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
    const adminIds = getAdminIds(channelId);
    if (!adminIds.includes(currentUserId)) {
      adminIds.push(currentUserId);
      saveAdminIds(channelId, adminIds);
    }
    setMembers((mems ?? []).map(m => ({ ...m, is_admin: adminIds.includes(m.user_id) })));
    setPendingReqs((pending ?? []).map(m => ({ ...m, is_admin: false })));
    setGroupDesc(ch?.description ?? null);
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

  const toggleAdmin = (userId: string, current: boolean) => {
    if (!channelId) return;
    const next = !current;
    const adminIds = getAdminIds(channelId);
    const updated = next ? [...new Set([...adminIds, userId])] : adminIds.filter(id => id !== userId);
    saveAdminIds(channelId, updated);
    setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, is_admin: next } : m));
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

  const loadMessages = useCallback(async () => {
    if (!channelId) return;
    // Show cached messages instantly — no skeleton if we have them
    if (_msgCache[channelId]?.length) {
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
    setMessages(result);
    setMsgsLoading(false);
  }, [channelId, currentUserId]);

  const initialLoadDone = useRef(false);
  const scrollToBottom = (smooth = false) => {
    if (smooth) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

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
    const existing = msg?.reactions.find(r => r.emoji === emoji && r.mine);
    if (existing) await supabase.from('group_reactions').delete().eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
    else await supabase.from('group_reactions').insert({ message_id: messageId, user_id: currentUserId, emoji });
    setMenuMsg(null);
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
    const nameClr   = senderColor(msg.display_name);
    const showName  = !mine; // group sender label, inside every incoming bubble
    const noPad     = msg.type === 'image' || msg.type === 'location';
    const timeStr   = fmtTime(msg.created_at);

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
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, maxWidth: '82%' }}>
            {/* Avatar attached to the tail (incoming only) */}
            {!mine && (
              showAvatar ? (
                <div style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', overflow: 'hidden', background: senderColor(msg.display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', border: `2px solid ${senderColor(msg.display_name)}`, marginBottom: -1 }}>
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
              {msg.type === 'text' ? (
                /* iMessage-exact bubble (single SVG path, stretchable, fixed tail) */
                <MessageBubble mine={!mine} tail={showAvatar} color={bubbleBg} contentStyle={{ padding: showName ? '5px 14px 7px' : '7px 14px' }}>
                  {showName && (
                    <span style={{ display: 'block', fontSize: 10, fontWeight: 700, color: nameClr, marginBottom: 2, lineHeight: 1.2 }} dir="rtl">
                      {msg.display_name}
                    </span>
                  )}
                  {(() => {
                    const { reply, body } = parseReply(msg.content);
                    return (
                      <>
                        {reply && (
                          <div dir="rtl" style={{
                            borderInlineStart: `3px solid ${mine ? 'rgba(124,52,0,0.45)' : nameClr}`,
                            background: mine ? 'rgba(124,52,0,0.08)' : 'rgba(0,0,0,0.05)',
                            borderRadius: 8, padding: '3px 8px', marginBottom: 4, maxWidth: 240,
                          }}>
                            <span style={{ display: 'block', fontSize: 11, fontWeight: 700, color: mine ? 'rgba(124,52,0,0.8)' : nameClr, lineHeight: 1.3 }}>{reply.n}</span>
                            <span style={{ display: 'block', fontSize: 12, color: mine ? 'rgba(124,52,0,0.7)' : '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{reply.t}</span>
                          </div>
                        )}
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
            </div>
          </div>

          {/* Timestamp — under the bubble (offset past the avatar); once per same-minute run */}
          {showTime && (
            <span style={{ fontSize: 10, color: '#9AA0A6', marginTop: 3, marginInlineStart: !mine ? 31 : 0, paddingInline: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {timeStr}
            </span>
          )}

          {/* Reactions */}
          {msg.reactions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, marginInlineStart: !mine ? 31 : 0, justifyContent: mine ? 'flex-end' : 'flex-start' }}>
              {msg.reactions.map(r => (
                <button key={r.emoji} onClick={() => toggleReaction(msg.id, r.emoji)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 3, padding: '3px 8px',
                    borderRadius: 16, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    background: r.mine ? 'rgba(37,99,235,0.1)' : '#fff',
                    border: r.mine ? '1.5px solid rgba(37,99,235,0.35)' : '1px solid #E5E7EB',
                    color: r.mine ? '#2563EB' : '#555',
                  }}>
                  <span>{r.emoji}</span><span style={{ fontSize: 11 }}>{r.count}</span>
                </button>
              ))}
            </div>
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
    setMemberStatus('pending');
  };

  const hasText = text.trim().length > 0;

  /* ── Pending / Join screens ── */
  if ((memberStatus === 'none' || memberStatus === 'pending' || memberStatus === 'just_approved') && channelId) {
    const isPending      = memberStatus === 'pending';
    const isLoading      = false;
    const isJustApproved = memberStatus === 'just_approved';
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 120,
        display: 'flex', flexDirection: 'column',
        fontFamily: "'Rubik','Heebo',sans-serif",
        background: '#fff',
        animation: 'gchat-slide 0.28s cubic-bezier(0.25,1,0.5,1)',
      }}>
        <style>{`
          @keyframes gchat-slide { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes gchat-spin  { to { transform: rotate(360deg); } }
        `}</style>

        {/* Header — matches main chat header with safe-area top */}
        <div style={{
          background: 'linear-gradient(135deg,#F97316,#EA580C)',
          paddingTop: 'max(14px, env(safe-area-inset-top))',
          paddingBottom: 14,
          paddingLeft: 16,
          paddingRight: 16,
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <BackButton onClick={onClose} variant="dark" />
          <span style={{ fontSize: 20 }}>{cityEmoji}</span>
          <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', flex: 1 }} dir="rtl">{cityName}</span>
        </div>

        {/* Body — safe-area bottom padding */}
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '32px 32px max(32px, env(safe-area-inset-bottom))',
          gap: 20, direction: 'rtl',
        }}>
          {isLoading ? (
            <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #FFE4CC', borderTopColor: '#F97316', animation: 'gchat-spin 0.8s linear infinite' }} />
          ) : isJustApproved ? (
            <>
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                background: 'linear-gradient(135deg,#D1FAE5,#A7F3D0)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 42,
                boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
                animation: 'approved-pop 0.5s cubic-bezier(0.175,0.885,0.32,1.275)',
              }}>🎉</div>
              <style>{`@keyframes approved-pop { from{transform:scale(0.4);opacity:0} to{transform:scale(1);opacity:1} }`}</style>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: '#059669', margin: 0, textAlign: 'center' }}>אושרת לקבוצה!</h2>
              <p style={{ fontSize: 15, color: '#555', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                המנהל אישר את בקשתך להצטרף לקבוצת <strong>{cityName}</strong>.
              </p>
              <button
                onClick={() => setMemberStatus('approved')}
                style={{ marginTop: 12, padding: '13px 40px', borderRadius: 26, border: 'none', background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}>
                כניסה לקבוצה
              </button>
            </>
          ) : isPending ? (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#FFF3E0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>⏳</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0, textAlign: 'center' }}>בקשתך נשלחה!</h2>
              <p style={{ fontSize: 15, color: '#666', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                הבקשה שלך להצטרף לקבוצת <strong>{cityName}</strong> ממתינה לאישור מנהל הקבוצה.
              </p>
              <p style={{ fontSize: 13, color: '#999', margin: 0, textAlign: 'center' }}>תקבל גישה ברגע שהמנהל יאשר</p>
              <button onClick={onClose} style={{ marginTop: 8, padding: '10px 28px', borderRadius: 24, border: '1.5px solid #F97316', background: '#fff', color: '#F97316', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>
                חזרה
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 56 }}>{cityEmoji}</div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0, textAlign: 'center' }}>קבוצת {cityName}</h2>
              <p style={{ fontSize: 15, color: '#666', margin: 0, textAlign: 'center', lineHeight: 1.6 }}>
                כדי להצטרף לקבוצה, שלח בקשה למנהל הקבוצה.
              </p>
              <button
                onClick={handleRequestJoin}
                style={{ marginTop: 8, padding: '12px 36px', borderRadius: 24, border: 'none', background: 'linear-gradient(135deg,#F97316,#EA580C)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', boxShadow: '0 3px 10px rgba(234,88,12,0.35)' }}>
                בקש להצטרף
              </button>
              <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#999', fontSize: 14, cursor: 'pointer' }}>ביטול</button>
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
            onClick={() => { loadGroupInfo(); setShowInfo(true); }}
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
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#F3EFE9' }}>
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
          <div ref={bottomRef} />
         </div>
        </div>

        {/* Scroll to bottom */}
        {showScroll && (
          <button onClick={() => scrollToBottom(true)} style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 10,
            width: 38, height: 38, borderRadius: '50%',
            background: '#fff', border: '1px solid rgba(0,0,0,0.1)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <ChevronDown size={18} style={{ color: '#555' }} />
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
                    <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: '#F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {m.avatar_url
                        ? <UserAvatar userId={m.user_id} displayName={m.display_name} avatarUrl={m.avatar_url} size="medium" />
                        : <span style={{ color: '#555', fontWeight: 700, fontSize: 16 }}>{m.display_name.charAt(0)}</span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
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
                const amAdmin = members.some(x => x.user_id === currentUserId && x.is_admin);

                const MemberRow = ({ m, i }: { m: GMember; i: number }) => {
                  const isAdmin = !!m.is_admin;
                  const isSelf  = m.user_id === currentUserId;
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 16px',
                      borderTop: i === 0 ? 'none' : '1px solid #F3F3F3',
                      direction: 'rtl',
                    }}>
                      {/* Avatar — right side (RTL first) */}
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
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 15, fontWeight: 500, color: '#111' }}>{m.display_name}</span>
                      </div>
                      {amAdmin && !isSelf && (
                        <button
                          onClick={() => toggleAdmin(m.user_id, isAdmin)}
                          style={{
                            width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', border: 'none', flexShrink: 0,
                            background: isAdmin ? '#FEE2E2' : '#FFF3E0',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {isAdmin ? <X size={13} style={{ color: '#DC2626' }} /> : <Crown size={13} style={{ color: '#F97316' }} />}
                        </button>
                      )}
                    </div>
                  );
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
        </div>
      )}

      {/* ── Input bar (glass, matches home), floats over messages ── */}
      <div ref={inputBarRef} style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'rgba(255,255,255,0.55)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderTop: '1px solid rgba(255,255,255,0.4)',
        flexShrink: 0, zIndex: 10,
        padding: '6px 8px',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />

        {/* Reply preview (WhatsApp-style) */}
        {replyTo && (
          <div dir="rtl" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: '6px 10px' }}>
            <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 3, background: senderColor(replyTo.display_name) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 12, fontWeight: 700, color: senderColor(replyTo.display_name), lineHeight: 1.3 }}>{replyTo.display_name}</span>
              <span style={{ display: 'block', fontSize: 12.5, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{msgSnippet(replyTo)}</span>
            </div>
            <button onClick={() => setReplyTo(null)} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={15} style={{ color: '#666' }} />
            </button>
          </div>
        )}

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
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          gap: 4,
        }}>
          <button onClick={() => setShowAttach(v => !v)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Smile size={22} style={{ color: '#8696A0' }} />
          </button>
          <textarea
            ref={textRef}
            value={text}
            onChange={e => setText(e.target.value)}
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
    </div>
  );
}
