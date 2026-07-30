import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Plus, X, Users, Trash2, Pin, BellOff, Bell, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { COUNTRIES } from '../utils/countries';
import { emojiColor } from '../utils/emojiColor';
import { FloatingNavBar } from './FloatingNavBar';
import { CityGroupChat } from './CityGroupChat';
import { messagePreview } from '../utils/eventMessage';
import { loadValue, saveValue } from '../utils/warmCache';
import { fetchChatList, cleanupDuplicateGroups, chatListCache, type Conversation, type GroupChat } from '../services/chatListService';
import { getBlockedIdsCached, refreshBlockedIds } from '../services/blockService';

const COUNTRY_CITIES: Record<string, { name: string; emoji: string }[]> = {
  TH: [
    { name: 'בנגקוק',    emoji: '🏙️' },
    { name: 'קו פנגן',   emoji: '🏝️' },
    { name: 'קו תאו',    emoji: '🤿' },
    { name: 'קו סמואי',  emoji: '🌴' },
    { name: "צ'יאנג מאי", emoji: '🏔️' },
    { name: 'פוקט',      emoji: '🏖️' },
    { name: 'פאי',       emoji: '🌿' },
  ],
  JP: [
    { name: 'טוקיו',    emoji: '🗼' },
    { name: 'אוסקה',    emoji: '🏯' },
    { name: 'קיוטו',    emoji: '⛩️' },
    { name: 'הירושימה', emoji: '☮️' },
    { name: 'נארה',     emoji: '🦌' },
    { name: 'פוקואוקה', emoji: '🍜' },
    { name: 'הוקאידו',  emoji: '🌨️' },
  ],
  IT: [
    { name: 'רומא',       emoji: '🏛️' },
    { name: 'פירנצה',     emoji: '🎨' },
    { name: 'ונציה',      emoji: '🚤' },
    { name: 'מילאנו',     emoji: '👗' },
    { name: 'אמאלפי',     emoji: '🌊' },
    { name: "צ'ינקווה טרה", emoji: '🏘️' },
    { name: 'סיציליה',   emoji: '🌋' },
  ],
  GR: [
    { name: 'אתונה',    emoji: '🏛️' },
    { name: 'סנטוריני', emoji: '🌅' },
    { name: 'מיקונוס',  emoji: '🎉' },
    { name: 'כרתים',    emoji: '🏝️' },
    { name: 'רודוס',    emoji: '☀️' },
    { name: 'קורפו',    emoji: '🌿' },
  ],
  FR: [
    { name: "פריז",     emoji: '🗼' },
    { name: "ניס",      emoji: '🌊' },
    { name: "ליון",     emoji: '🍷' },
    { name: "בורדו",    emoji: '🍇' },
    { name: "מרסיי",    emoji: '⚓' },
  ],
  ES: [
    { name: 'ברצלונה',  emoji: '🏟️' },
    { name: 'מדריד',    emoji: '⚽' },
    { name: 'איביזה',   emoji: '🎶' },
    { name: 'מיורקה',   emoji: '🏖️' },
    { name: 'סביליה',   emoji: '💃' },
    { name: 'גרנדה',    emoji: '🏔️' },
  ],
  US: [
    { name: 'ניו יורק',       emoji: '🗽' },
    { name: 'מיאמי',          emoji: '🏖️' },
    { name: 'לוס אנג׳לס',     emoji: '🎬' },
    { name: 'לאס וגאס',       emoji: '🎰' },
    { name: 'סן פרנסיסקו',    emoji: '🌉' },
    { name: 'ניו אורלינס',    emoji: '🎷' },
  ],
  PT: [
    { name: 'ליסבון', emoji: '🚃' },
    { name: 'פורטו',  emoji: '🍷' },
    { name: 'אלגרבה', emoji: '🏖️' },
    { name: 'לאגוס',  emoji: '🌊' },
  ],
  ID: [
    { name: 'באלי',         emoji: '🌺' },
    { name: 'ג׳קרטה',       emoji: '🏙️' },
    { name: 'לומבוק',       emoji: '🏝️' },
    { name: "איי ג'ילי",    emoji: '🤿' },
    { name: 'יוגיאקרטה',   emoji: '🏯' },
  ],
  VN: [
    { name: 'האנוי',        emoji: '🏛️' },
    { name: 'הו צ׳י מין',   emoji: '🏙️' },
    { name: 'הוי אן',       emoji: '🏮' },
    { name: 'דה נאנג',      emoji: '🌉' },
    { name: 'האלונג ביי',   emoji: '⛵' },
  ],
  AU: [
    { name: 'סידני',   emoji: '🎭' },
    { name: 'מלבורן',  emoji: '☕' },
    { name: 'קיירנס',  emoji: '🐊' },
    { name: 'גולד קוסט', emoji: '🏄' },
    { name: 'פרת׳',    emoji: '🌅' },
  ],
  TR: [
    { name: 'איסטנבול',  emoji: '🕌' },
    { name: 'קפדוקיה',   emoji: '🎈' },
    { name: 'אנטליה',    emoji: '🏖️' },
    { name: 'בודרום',    emoji: '⛵' },
    { name: 'פמוקלה',    emoji: '♨️' },
  ],
  NZ: [
    { name: 'אוקלנד',     emoji: '⛵' },
    { name: 'קווינסטאון', emoji: '🎿' },
    { name: 'רוטורוא',    emoji: '♨️' },
    { name: 'קרייסטצ׳רץ׳', emoji: '🌿' },
  ],
  PH: [
    { name: 'מנילה',      emoji: '🏙️' },
    { name: 'בוראקאי',    emoji: '🏝️' },
    { name: 'אל נידו',    emoji: '🛶' },
    { name: 'קורון',      emoji: '🤿' },
    { name: 'סבו',        emoji: '🐋' },
    { name: 'סיארגאו',    emoji: '🏄' },
    { name: 'בוהול',      emoji: '🐒' },
  ],
  IN: [
    { name: 'מנאלי',     emoji: '🏔️' },
    { name: 'קסול',      emoji: '🌲' },
    { name: 'דהרמסלה',   emoji: '🧘' },
    { name: 'רישיקש',    emoji: '🕉️' },
    { name: 'גואה',      emoji: '🏖️' },
    { name: 'פושקאר',    emoji: '🐪' },
    { name: 'ואראנסי',   emoji: '🛕' },
    { name: 'דלהי',      emoji: '🏙️' },
  ],
};

// Conversation and GroupChat types now live in ../services/chatListService (shared with the preloader).

type MessagesScreenProps = {
  currentUserId: string;
  onBack: () => void;
  onConversationClick: (conversationId: string, otherUserId: string) => void;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onMyEventsClick?: () => void;
  onNavigateToCountrySelection?: () => void;
  onOpenMapAt?: (lat: number, lng: number, placeId?: string) => void;
  onNavigateToUserProfile?: (userId: string) => void;
  initialCountries?: string[];
};

const DEMO_COUNTRIES = ['TH', 'JP', 'IT', 'FR', 'US', 'GR'];
// Survives navigation so re-entering Messages shows the right flags instantly.
let _cachedUserCountries: string[] | null = loadValue<string[] | null>('msgUserCountries', null);

// The conversations/groups cache now lives in chatListService.chatListCache — a SHARED in-memory
// object the boot preloader fills, so warming reaches this screen even when the Expo WebView's
// localStorage is unreliable (that's why the phone used to still show a loading spinner).
// In-memory only: forces one background refresh on the first mount of each app session.
let _cachedInitialized = false;
let _cachedOpenCity: { code: string; flag: string; name: string; emoji: string } | null = null;

export function MessagesScreen({ currentUserId, onBack, onConversationClick, onHomeClick, onMapClick, onCreateClick, onMyEventsClick, onNavigateToCountrySelection, onOpenMapAt, onNavigateToUserProfile, initialCountries }: MessagesScreenProps) {
  // Read from the SHARED in-memory cache the preloader filled (works on the phone regardless of
  // localStorage). It's already hydrated from localStorage on the web for an instant cross-session paint.
  const [conversations,   setConversations]   = useState<Conversation[]>(chatListCache.conversations);
  const [groupChats,      setGroupChats]      = useState<GroupChat[]>(chatListCache.groups);
  // Blocked users — hide their DMs from the list. Instant from cache, then refreshed from the DB.
  const [blockedIds, setBlockedIds] = useState<Set<string>>(() => getBlockedIdsCached(currentUserId));
  useEffect(() => { refreshBlockedIds(currentUserId).then(setBlockedIds); }, [currentUserId]);
  // Show the spinner only on a truly cold, empty start. If the cache already has lists (from a
  // previous visit or the boot preloader), paint them instantly and refresh silently in the background.
  const [loading,         setLoading]         = useState(
    !_cachedInitialized && chatListCache.conversations.length === 0 && chatListCache.groups.length === 0
  );
  const [initialized,     setInitialized]     = useState(_cachedInitialized);
  const [searchQuery,     setSearchQuery]     = useState('');
  const [swipedId,        setSwipedId]        = useState<string | null>(null);
  const [userCountries,   setUserCountries]   = useState<string[]>(
    (initialCountries && initialCountries.length > 0)
      ? initialCountries.slice(0, 8)
      : (_cachedUserCountries ?? DEMO_COUNTRIES)
  );
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);
  const cityRowRef = useRef<HTMLDivElement>(null);

  // Lock the city strip to horizontal swipes only — block vertical drags so the
  // page doesn't scroll up/down when the user pans the cities (WebView ignores
  // CSS touch-action, so we enforce it with a non-passive touch listener).
  useEffect(() => {
    const el = cityRowRef.current;
    if (!el) return;
    let sx = 0, sy = 0;
    const onStart = (e: TouchEvent) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; };
    const onMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - sx);
      const dy = Math.abs(e.touches[0].clientY - sy);
      if (dy > dx) e.preventDefault(); // vertical gesture → do nothing
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
    };
  }, [expandedCountry]);
  const [currentUserName, setCurrentUserName] = useState('');
  const [currentUserAvatar, setCurrentUserAvatar] = useState<string | null>(null);
  const [openCity, setOpenCity] = useState<{ code: string; flag: string; name: string; emoji: string } | null>(_cachedOpenCity);
  useEffect(() => { _cachedOpenCity = openCity; }, [openCity]);
  // Top tab filter. Default 'all' shows BOTH groups + chats together; tapping a tab filters to it
  // (and tapping the active tab again returns to 'all'). Active tab's text is bold/orange.
  const [activeTab, setActiveTab] = useState<'all' | 'groups' | 'chats'>('all');
  // WhatsApp-style header: as the list scrolls down, the search bar thins out and disappears, leaving
  // just the (glass) title. Driven imperatively off the scroll position so the long list never re-renders.
  const listScrollRef = useRef<HTMLDivElement>(null);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // WhatsApp-style header: the search bar lives in the scroll content, so it glides away under the sticky
  // glass title on its own (native scroll = buttery). We ONLY add a compositor-cheap scaleY+fade so it
  // "thins out" as it goes — transform/opacity never trigger layout, and it's rAF-throttled, so the long
  // list never reflows mid-scroll (that per-frame reflow was the stutter). Listen on window + container
  // because the iOS WebView scrolls the document, not an inner element.
  useEffect(() => {
    let raf = 0;
    const apply = () => {
      raf = 0;
      const c = listScrollRef.current;
      const y = Math.max(window.scrollY || 0, document.documentElement.scrollTop || 0, document.body.scrollTop || 0, c ? c.scrollTop : 0);
      const t = Math.min(1, Math.max(0, y / 56));
      // WhatsApp large-title: the title AND the whole bar shrink as you scroll (fontSize + padding). The
      // bar is FIXED / out of flow, so resizing it reflows only itself (one element) — never the list.
      const title = titleRef.current;
      if (title) title.style.fontSize = `${25 - t * 7}px`; // 25 → 18px
      const hdr = headerRef.current;
      if (hdr) {
        hdr.style.paddingTop = `calc(env(safe-area-inset-top) + ${16 - t * 8}px)`;
        hdr.style.paddingBottom = `${12 - t * 6}px`;
      }
      const el = searchWrapRef.current;
      if (!el) return;
      el.style.opacity = `${1 - t}`;
      el.style.transform = `scaleY(${1 - t * 0.4})`;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    const c = listScrollRef.current;
    c?.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      c?.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  const [pinnedIds,  setPinnedIds]  = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('pinned_convos') || '[]')));
  const [mutedIds,   setMutedIds]   = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('muted_convos') || '[]')));
  // Group-row swipe actions (mirrors the DM ones, own storage keys)
  const [pinnedGroupIds, setPinnedGroupIds] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('pinned_groups') || '[]')));
  const [mutedGroupIds,  setMutedGroupIds]  = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('muted_groups') || '[]')));
  // Live "is typing" by chat id (conversation id for DMs, channel id for groups) — WhatsApp-style list indicator
  const [typingChats, setTypingChats] = useState<Record<string, { name?: string; ts: number }>>({});
  const [reconnectTick, setReconnectTick] = useState(0); // bump to force the realtime channels to rebuild
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    loadUserCountries();
    if (_cachedInitialized) {
      // Already have cached data — refresh in the background, no loading state.
      loadChatList();
    } else {
      // First load — wait for the whole list before revealing, so nothing "pops in" late.
      loadChatList().finally(() => {
        _cachedInitialized = true;
        setInitialized(true);
        setLoading(false);
      });
    }

    // Coalesce bursts of realtime events into one background refresh (reconciles exact unread counts,
    // new conversations, names). The list itself updates INSTANTLY below via incremental in-place
    // edits, so this debounce no longer affects perceived speed.
    const scheduleRefresh = () => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = setTimeout(() => { refreshTimerRef.current = null; loadChatList(); }, 1500);
    };

    // Instant, network-free row update straight from the realtime payload — so an incoming message
    // appears in the list at the SAME moment as the push notification (no 1.5s lag).
    const bumpConversation = (row: { conversation_id?: string; sender_id?: string; content?: string; created_at?: string }) => {
      if (!row.conversation_id) return scheduleRefresh();
      setConversations(prev => {
        const idx = prev.findIndex(c => c.id === row.conversation_id);
        if (idx === -1) { scheduleRefresh(); return prev; } // unknown conversation → full refresh adds it
        const c = prev[idx];
        const updated: Conversation = {
          ...c,
          last_message: { content: row.content ?? '', sender_id: row.sender_id ?? '' },
          last_message_at: row.created_at ?? new Date().toISOString(),
          unread_count: c.unread_count + 1,
        };
        const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        chatListCache.conversations = next;
        return next;
      });
    };
    const bumpGroup = (row: { channel_id?: string; content?: string; type?: string; created_at?: string; display_name?: string }) => {
      if (!row.channel_id) return scheduleRefresh();
      setGroupChats(prev => {
        const idx = prev.findIndex(g => g.channelId === row.channel_id);
        if (idx === -1) { scheduleRefresh(); return prev; }
        const g = prev[idx];
        const updated: GroupChat = {
          ...g,
          lastMessage: `${row.display_name || 'מישהו'}: ${messagePreview(row.content, row.type)}`,
          lastMessageAt: row.created_at ?? new Date().toISOString(),
          unreadCount: g.unreadCount + 1,
        };
        const next = [updated, ...prev.slice(0, idx), ...prev.slice(idx + 1)];
        chatListCache.groups = next;
        return next;
      });
    };

    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        // Ignore my own outgoing messages — the open chat already reflects them.
        if ((payload.new as { sender_id?: string })?.sender_id === currentUserId) return;
        // New message → update the row instantly; other events → background reconcile only.
        if (payload.eventType === 'INSERT') bumpConversation(payload.new as Parameters<typeof bumpConversation>[0]);
        else scheduleRefresh();
      })
      .subscribe((status) => {
        // Reliability: if the channel drops, schedule a rebuild (re-runs this effect → reconnect + reload catch-up)
        if (status === 'SUBSCRIBED') {
          if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        } else if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => { reconnectTimerRef.current = null; setReconnectTick(t => t + 1); }, 2500);
        }
      });

    const groupChannel = supabase
      .channel('group-messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, (payload) => {
        const row = payload.new as { user_id?: string; type?: string };
        if (row?.user_id === currentUserId || row?.type === 'system') return;
        bumpGroup(payload.new as Parameters<typeof bumpGroup>[0]);
      })
      .subscribe();

    // Membership changes (join / leave / approve) — keep the group list + member counts live.
    const groupMemChannel = supabase
      .channel('group-members-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
        scheduleRefresh();
      })
      .subscribe();

    return () => {
      if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
      if (refreshTimerRef.current) { clearTimeout(refreshTimerRef.current); refreshTimerRef.current = null; }
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(groupChannel);
      supabase.removeChannel(groupMemChannel);
    };
  }, [currentUserId, reconnectTick]);

  // Catch up on anything missed while the app was backgrounded (the realtime socket drops on lock/background).
  useEffect(() => {
    const onResume = () => { if (document.visibilityState === 'visible') loadChatList(); };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, [currentUserId]);

  // ── Listen for "is typing" broadcasts across every chat in the list (WhatsApp-style) ──
  const convoIds = conversations.map(c => c.id).join(',');
  const groupIds = groupChats.map(g => g.channelId).join(',');
  // The currently-open group already owns its typing topic (CityGroupChat) — skip it to avoid a duplicate subscribe.
  const openGroupChannelId = openCity
    ? (groupChats.find(g => g.countryCode === openCity.code && g.cityName === openCity.name)?.channelId ?? null)
    : null;
  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];
    // Read typing via broadcast (~100ms, instant). The typer sends a heartbeat every 1.2s while
    // typing, so opening Messages mid-typing catches it within ~1s; the prune below clears a dot
    // 4s after the last heartbeat.
    conversations.forEach(c => {
      const ch = supabase.channel(`dm-typing-${c.id}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if ((payload as { userId?: string })?.userId === currentUserId) return;
          setTypingChats(prev => ({ ...prev, [c.id]: { ts: Date.now() } }));
        })
        .on('broadcast', { event: 'stop' }, () => {
          setTypingChats(prev => { if (!prev[c.id]) return prev; const n = { ...prev }; delete n[c.id]; return n; });
        })
        .on('broadcast', { event: 'msg' }, () => {
          setTypingChats(prev => { if (!prev[c.id]) return prev; const n = { ...prev }; delete n[c.id]; return n; });
          loadChatList(); // refresh preview/order even if DB replication is off
        })
        .subscribe();
      channels.push(ch);
    });
    groupChats.forEach(g => {
      if (g.channelId === openGroupChannelId) return;
      const ch = supabase.channel(`group-typing-${g.channelId}`, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          const p = payload as { userId?: string; name?: string };
          if (!p?.userId || p.userId === currentUserId) return;
          setTypingChats(prev => ({ ...prev, [g.channelId]: { name: p.name, ts: Date.now() } }));
        })
        .on('broadcast', { event: 'stop' }, () => {
          setTypingChats(prev => { if (!prev[g.channelId]) return prev; const n = { ...prev }; delete n[g.channelId]; return n; });
        })
        .subscribe();
      channels.push(ch);
    });
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [convoIds, groupIds, openGroupChannelId, currentUserId]);

  // Prune typing entries with no heartbeat for >4s (safety if a "stop" was missed).
  useEffect(() => {
    if (Object.keys(typingChats).length === 0) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTypingChats(prev => {
        const n: typeof prev = {}; let changed = false;
        for (const k in prev) { if (now - prev[k].ts < 4000) n[k] = prev[k]; else changed = true; }
        return changed ? n : prev;
      });
    }, 1500);
    return () => clearInterval(id);
  }, [typingChats]);

  const loadUserCountries = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('selected_countries, display_name, avatar_url')
        .eq('id', currentUserId)
        .maybeSingle();
      if (data?.selected_countries && data.selected_countries.length > 0) {
        const cs = data.selected_countries.slice(0, 8);
        _cachedUserCountries = cs;
        saveValue('msgUserCountries', cs);
        setUserCountries(cs);
      }
      if (data?.display_name) setCurrentUserName(data.display_name);
      if (data?.avatar_url !== undefined) setCurrentUserAvatar(data.avatar_url);
    } catch (e) { console.error('[MessagesScreen] loadUserCountries failed:', e); }
  };

  // One shared loader (RPC + fallback + dedupe) fetches both lists; here we just commit the result
  // to state + the persisted cache, and clean up any duplicate memberships it flagged.
  const loadChatList = async () => {
    try {
      // fetchChatList already commits to the shared cache + localStorage; we just reflect it in state.
      const { conversations, groups, dupChannelIds } = await fetchChatList(currentUserId);
      setConversations(conversations);
      setGroupChats(groups);
      if (dupChannelIds.length) cleanupDuplicateGroups(currentUserId, dupChannelIds);
    } catch (e) {
      console.error('[MessagesScreen] loadChatList failed:', e);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, _id: string) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent, id: string) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 60) {
      setSwipedId(id);
    } else if (diff < -20) {
      setSwipedId(null);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!confirm('למחוק את השיחה? כל ההודעות יימחקו לצמיתות — אי אפשר לבטל.')) { setSwipedId(null); return; }
    setSwipedId(null);
    const snapshot = conversations.find(c => c.id === conversationId);
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    try {
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').delete().eq('id', conversationId);
    } catch (err) {
      console.error('Delete conversation error:', err);
      if (snapshot) setConversations(prev => [snapshot, ...prev]);
      alert('שגיאה במחיקת השיחה, נסה שוב.');
    }
  };

  const handlePinConversation = (id: string) => {
    setSwipedId(null);
    setPinnedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('pinned_convos', JSON.stringify([...next]));
      return next;
    });
  };

  const handleMuteConversation = (id: string) => {
    setSwipedId(null);
    setMutedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem('muted_convos', JSON.stringify([...next]));
      return next;
    });
  };

  /* ── Group-row swipe actions ── */
  const handlePinGroup = (channelId: string) => {
    setSwipedId(null);
    setPinnedGroupIds(prev => {
      const next = new Set(prev);
      next.has(channelId) ? next.delete(channelId) : next.add(channelId);
      localStorage.setItem('pinned_groups', JSON.stringify([...next]));
      return next;
    });
  };

  const handleMuteGroup = (channelId: string) => {
    setSwipedId(null);
    setMutedGroupIds(prev => {
      const next = new Set(prev);
      next.has(channelId) ? next.delete(channelId) : next.add(channelId);
      localStorage.setItem('muted_groups', JSON.stringify([...next]));
      return next;
    });
  };

  // Leave the group: status='left' (delete is RLS-blocked) + a system message so the
  // group sees "X עזב/ה את הקבוצה" — same behavior as leaving from inside the chat.
  const handleLeaveGroup = async (gc: GroupChat) => {
    if (!confirm(`לצאת מהקבוצה ${gc.countryFlag} ${gc.cityName}? תוכל לבקש להצטרף שוב בהמשך.`)) { setSwipedId(null); return; }
    setSwipedId(null);
    const snapshot = groupChats;
    setGroupChats(prev => prev.filter(g => g.channelId !== gc.channelId));
    try {
      const { error } = await supabase.from('group_members')
        .update({ status: 'left' })
        .eq('channel_id', gc.channelId)
        .eq('user_id', currentUserId);
      if (error) throw error;
      try {
        const left: string[] = JSON.parse(localStorage.getItem('left_group_channels') || '[]');
        if (!left.includes(gc.channelId)) localStorage.setItem('left_group_channels', JSON.stringify([...left, gc.channelId]));
      } catch { /* ignore */ }
      await supabase.from('group_messages').insert({
        channel_id: gc.channelId,
        user_id: currentUserId,
        display_name: currentUserName || 'משתמש',
        avatar_url: currentUserAvatar,
        content: `${currentUserName || 'משתמש'} עזב/ה את הקבוצה`,
        type: 'system',
      });
    } catch (err) {
      console.error('[MessagesScreen] leave group failed:', err);
      setGroupChats(snapshot);
      alert('שגיאה ביציאה מהקבוצה, נסה שוב.');
    }
  };

  const filteredConversations = conversations
    // blocked chats are NOT hidden (WhatsApp-style) — they stay in the list with a block icon
    .filter(convo => convo.other_user.display_name.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aPinned = pinnedIds.has(a.id) ? 0 : 1;
      const bPinned = pinnedIds.has(b.id) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `${diffMins}ד`;
    if (diffHours < 24) return `${diffHours}ש`;
    if (diffDays < 7) return `${diffDays}י`;
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  };

  // ── One row renderer per type, so groups + chats can be MERGED into a single WhatsApp-style list ──
  const renderGroupRow = (gc: GroupChat) => {
    const gid       = `g:${gc.channelId}`;
    const isSwiped  = swipedId === gid;
    const isGPinned = pinnedGroupIds.has(gc.channelId);
    const isGMuted  = mutedGroupIds.has(gc.channelId);
    const rowBg     = isGPinned ? '#FFF7ED' : '#F8F9FB';
    return (
      <React.Fragment key={gc.channelId}>
      <div style={{ position: 'relative', overflow: 'hidden' }}
        onTouchStart={(e) => handleTouchStart(e, gid)} onTouchEnd={(e) => handleTouchEnd(e, gid)}>
        {isSwiped && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 180, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', background: rowBg, zIndex: 0 }}>
          <button onClick={() => handleLeaveGroup(gc)} style={{ width: 44, height: 44, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={20} /></button>
          <button onClick={() => handlePinGroup(gc.channelId)} style={{ width: 44, height: 44, borderRadius: '50%', background: isGPinned ? '#6B7280' : '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Pin size={20} /></button>
          <button onClick={() => handleMuteGroup(gc.channelId)} style={{ width: 44, height: 44, borderRadius: '50%', background: isGMuted ? '#6B7280' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>{isGMuted ? <Bell size={20} /> : <BellOff size={20} />}</button>
        </div>}
        <button
          onClick={() => { if (isSwiped) { setSwipedId(null); return; } setOpenCity({ code: gc.countryCode, flag: gc.countryFlag, name: gc.cityName, emoji: gc.cityEmoji }); }}
          className="w-full flex items-center gap-3 px-4 active:scale-[0.98] transition-all duration-150"
          style={{ height: 72, paddingTop: 6, paddingBottom: 6, background: rowBg, position: 'relative', zIndex: 1, transform: isSwiped ? 'translateX(-180px)' : 'translateX(0)', transition: 'transform 0.25s ease' }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${emojiColor(gc.cityEmoji)}1F`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, boxShadow: `inset 0 0 0 2px ${emojiColor(gc.cityEmoji)}, 0 2px 8px ${emojiColor(gc.cityEmoji)}26` }}>
              <span>{gc.cityEmoji}</span>
            </div>
            {isGPinned && (
              <div style={{ position: 'absolute', bottom: -2, left: -2, width: 18, height: 18, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F8F9FB' }}><Pin size={9} color="#fff" /></div>
            )}
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#fff', borderRadius: 10, padding: '1px 5px', fontSize: 10, fontWeight: 700, color: '#6B7280', border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 2 }}>
              <Users size={9} />{gc.memberCount}
            </div>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className={`text-[15px] truncate ${gc.unreadCount > 0 ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`} style={{ fontFamily: 'Heebo, sans-serif' }}>{gc.countryFlag} {gc.cityName}</h3>
              <span className="text-[12px] text-gray-400 flex-shrink-0 ml-2 flex items-center gap-1">
                {isGMuted && <BellOff size={12} color="#9CA3AF" />}
                {gc.memberStatus === 'pending' ? '' : (gc.lastMessageAt ? formatTime(gc.lastMessageAt) : '')}
              </span>
            </div>
            {gc.memberStatus === 'pending' ? (
              <p className="text-[13px] truncate text-right font-semibold" style={{ color: '#F97316' }}>⏳ ממתין לאישור מנהל הקבוצה</p>
            ) : typingChats[gc.channelId] ? (
              <p className="text-[13px] truncate text-right font-semibold" style={{ color: '#F97316' }}>{typingChats[gc.channelId].name ? `${typingChats[gc.channelId].name} מקליד/ה…` : 'מקליד/ה…'}</p>
            ) : (
              <p className={`text-[13px] truncate text-right ${gc.unreadCount > 0 ? 'text-[#444] font-medium' : 'text-gray-400'}`}>{gc.lastMessage ?? 'טרם נשלחו הודעות'}</p>
            )}
          </div>
          {gc.unreadCount > 0 && gc.memberStatus !== 'pending' && (
            <div style={{ minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px', background: isGMuted ? '#9CA3AF' : 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{gc.unreadCount > 99 ? '99+' : gc.unreadCount}</span>
            </div>
          )}
        </button>
      </div>
      <div className="h-px bg-gray-100 mx-4" />
      </React.Fragment>
    );
  };

  const renderChatRow = (conversation: Conversation) => {
    const isUnread = conversation.unread_count > 0;
    const isSwiped = swipedId === conversation.id;
    const isPinned = pinnedIds.has(conversation.id);
    const isMuted  = mutedIds.has(conversation.id);
    const isBlocked = blockedIds.has(conversation.other_user.id);
    const rowBg    = isPinned ? '#FFF7ED' : '#F8F9FB';
    return (
      <React.Fragment key={conversation.id}>
        <div style={{ position: 'relative', overflow: 'hidden' }} onTouchStart={(e) => handleTouchStart(e, conversation.id)} onTouchEnd={(e) => handleTouchEnd(e, conversation.id)}>
          {isSwiped && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 180, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', background: rowBg, zIndex: 0 }}>
            <button onClick={() => handleDeleteConversation(conversation.id)} style={{ width: 44, height: 44, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Trash2 size={20} /></button>
            <button onClick={() => handlePinConversation(conversation.id)} style={{ width: 44, height: 44, borderRadius: '50%', background: isPinned ? '#6B7280' : '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}><Pin size={20} /></button>
            <button onClick={() => handleMuteConversation(conversation.id)} style={{ width: 44, height: 44, borderRadius: '50%', background: isMuted ? '#6B7280' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>{isMuted ? <Bell size={20} /> : <BellOff size={20} />}</button>
          </div>}
          <button
            onClick={() => { if (isSwiped) { setSwipedId(null); } else { onConversationClick(conversation.id, conversation.other_user.id); } }}
            className="w-full flex items-center gap-3 px-4 active:scale-[0.98] transition-all duration-150"
            style={{ height: '72px', paddingTop: '6px', paddingBottom: '6px', background: rowBg, position: 'relative', zIndex: 1, transform: isSwiped ? 'translateX(-180px)' : 'translateX(0)', transition: 'transform 0.25s ease' }}>
            <div className="relative flex-shrink-0">
              {/* Avatar fills the circle exactly (no white gap). Unread = orange ring via box-shadow. */}
              <div className="w-12 h-12 rounded-full overflow-hidden" style={{ boxShadow: isUnread ? '0 0 0 2px #F8F9FB, 0 0 0 4px #F97316, 0 2px 8px rgba(249,115,22,0.3)' : 'none' }}>
                <UserAvatar userId={conversation.other_user.id} displayName={conversation.other_user.display_name} avatarUrl={conversation.other_user.avatar_url} size="medium" />
              </div>
              {isPinned && !isUnread && (
                <div style={{ position: 'absolute', bottom: -2, left: -2, width: 18, height: 18, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F8F9FB' }}><Pin size={9} color="#fff" /></div>
              )}
              {isUnread && (
                <div style={{ position: 'absolute', bottom: -2, left: -2, minWidth: 20, height: 20, borderRadius: 10, padding: '0 4px', background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F8F9FB' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1 }}>{conversation.unread_count > 9 ? '9+' : conversation.unread_count}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <h3 className={`text-[15px] truncate flex items-center gap-1 ${isUnread ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`} style={{ fontFamily: 'Heebo, sans-serif' }}>
                  {isBlocked && <Ban size={14} style={{ color: '#9CA3AF', flexShrink: 0 }} />}
                  <span className="truncate">{conversation.other_user.display_name}</span>
                </h3>
                <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                  <span className="text-[12px] text-gray-400 font-normal">{formatTime(conversation.last_message_at)}</span>
                  {isMuted && <BellOff size={12} color="#9CA3AF" />}
                </div>
              </div>
              {typingChats[conversation.id] ? (
                <p className="text-[13px] truncate text-right font-semibold" style={{ color: '#F97316' }}>מקליד/ה…</p>
              ) : conversation.last_message && (
                <p className={`text-[13px] truncate text-right ${isUnread ? 'text-[#444] font-medium' : 'text-gray-400 font-normal'}`} style={{ opacity: isMuted ? 0.6 : 1 }}>
                  {conversation.last_message.sender_id === currentUserId && (<span className="text-gray-300">אתה: </span>)}
                  {messagePreview(conversation.last_message.content)}
                </p>
              )}
            </div>
          </button>
        </div>
        <div className="h-px bg-gray-100 mx-4" />
      </React.Fragment>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FB]" style={{ fontFamily: 'Rubik, sans-serif' }} dir="rtl">
      {/* Scrollable content — the header lives INSIDE the scroller so it can be sticky + glass with the
          list passing under it, and the search bar can thin out and disappear as you scroll (WhatsApp). */}
      <div ref={listScrollRef} className="pb-28" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
        {/* Title bar — FIXED glass (sticky breaks in the iOS WebView because the body has overflow-x:hidden,
            so it wouldn't stay pinned there). The whole bar + title shrink on scroll; the list glides under. */}
        <div ref={headerRef} className="fixed top-0 left-0 right-0 z-30 px-4" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)', paddingBottom: 12, background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(18px) saturate(180%)', WebkitBackdropFilter: 'blur(18px) saturate(180%)', boxShadow: '0 1px 0 rgba(0,0,0,0.05)' }}>
          <h1 ref={titleRef} className="font-extrabold text-[#111]" style={{ fontFamily: 'Heebo, sans-serif', fontSize: 25, lineHeight: 1.1, margin: 0, willChange: 'font-size' }}>
            הודעות
          </h1>
        </div>

        {/* Search — in the scroll flow so it glides away under the glass title; thins + fades via transform */}
        <div className="px-4 pt-3 pb-1">
          <div ref={searchWrapRef} className="relative" style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}>
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="חפש שיחה..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-100 rounded-full border-none focus:outline-none focus:ring-2 focus:ring-brand-300/60 focus:bg-white transition-all text-[14px] text-gray-800 placeholder-gray-400"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            />
          </div>
        </div>


        {/* Groups / Countries Section */}
        <div className="pt-4 pb-2">
          <style>{`
            @keyframes city-chip-fall {
              0%   { opacity: 0; transform: translateY(-28px) scale(0.82); }
              65%  { transform: translateY(3px) scale(1.04); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes country-ring-pulse {
              0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.5); }
              50%       { box-shadow: 0 0 0 5px rgba(249,115,22,0); }
            }
            @media (prefers-reduced-motion: reduce){ [style*="city-chip-fall"], [style*="country-ring-pulse"] { animation: none !important; } }
          `}</style>

          {/* Section header */}
          <div className="px-4 mb-3" dir="rtl">
            <h2 className="text-[16px] font-extrabold text-[#1C1917] leading-tight" style={{ fontFamily: 'Heebo, sans-serif' }}>קבוצות</h2>
            <p className="text-[12px] text-[#78716C] mt-0.5">בחרו יעד והצטרפו לקבוצת הצ'אט</p>
          </div>

          {/* Country selector */}
          <div className="overflow-x-auto scrollbar-hide" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
            <div className="flex gap-3.5 px-4 pb-1" style={{ width: 'max-content' }}>
              {userCountries.map((code) => {
                const country = COUNTRIES[code];
                if (!country) return null;
                const isExpanded = expandedCountry === code;
                return (
                  <button
                    key={code}
                    onClick={() => setExpandedCountry(isExpanded ? null : code)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <div
                      className="rounded-full flex items-center justify-center"
                      style={{
                        width: 58, height: 58, padding: isExpanded ? 2.5 : 0,
                        background: isExpanded ? 'linear-gradient(135deg,#F97316,#EA580C)' : 'transparent',
                        animation: isExpanded ? 'country-ring-pulse 1.5s ease-in-out infinite' : 'none',
                        transform: isExpanded ? 'scale(1.05)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <div
                        className="w-full h-full bg-white rounded-full flex items-center justify-center text-2xl"
                        style={{ border: isExpanded ? 'none' : '1.5px solid #EFEBE6', boxShadow: isExpanded ? 'none' : '0 1px 3px rgba(0,0,0,0.05)' }}
                      >
                        {country.flag}
                      </div>
                    </div>
                    <span
                      className="text-[11px] max-w-[58px] text-center truncate"
                      style={{ color: isExpanded ? '#EA580C' : '#78716C', fontWeight: isExpanded ? 800 : 500 }}
                    >
                      {country.name}
                    </span>
                  </button>
                );
              })}

              {/* Add button → at the end (left side of scroll) */}
              <button
                onClick={() => onNavigateToCountrySelection?.()}
                className="flex flex-col items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform"
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div className="rounded-full flex items-center justify-center" style={{ width: 58, height: 58, background: '#F5F3F0', border: '1.5px dashed #D6D3D1' }}>
                  <Plus className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] text-gray-400 font-medium">הוסף</span>
              </button>
            </div>
          </div>

          {/* City chips — animate in when a country is expanded */}
          {expandedCountry && COUNTRY_CITIES[expandedCountry] && (
            <div ref={cityRowRef} className="overflow-x-auto scrollbar-hide mt-3" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
              <div className="flex gap-2 px-4 pb-1" style={{ width: 'max-content' }}>
                {COUNTRY_CITIES[expandedCountry].map((city, i) => {
                  const accent = emojiColor(city.emoji); // frame + tint colour matched to the emoji
                  return (
                  <button
                    key={city.name}
                    onClick={() => {
                      const country = COUNTRIES[expandedCountry!];
                      setOpenCity({ code: expandedCountry!, flag: country?.flag ?? '🌍', name: city.name, emoji: city.emoji });
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px',
                      borderRadius: 50,
                      border: `1.5px solid ${accent}`,
                      background: `${accent}14`,
                      boxShadow: `0 2px 8px ${accent}26`,
                      cursor: 'pointer',
                      animation: `city-chip-fall 0.4s cubic-bezier(0.34,1.56,0.64,1) ${i * 0.06}s both`,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    <span style={{ fontSize: 17 }}>{city.emoji}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700,
                      color: '#1F2937',
                      fontFamily: 'Heebo, sans-serif',
                    }}>
                      {city.name}
                    </span>
                    <Users size={12} color={accent} strokeWidth={2.5} />
                  </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-4 my-2" />

        {/* ── Filter pills: All · Chats · Groups (All selected by default) ── */}
        <div className="flex items-center gap-2 px-4 mb-1 mt-3">
          {([['all', 'הכל', null], ['chats', 'צאטים', conversations.length], ['groups', 'קבוצות', groupChats.length]] as const).map(([key, label, count]) => {
            const on = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '5px 12px', borderRadius: 999, whiteSpace: 'nowrap', cursor: 'pointer',
                  fontFamily: 'Heebo, sans-serif', fontSize: 13, fontWeight: on ? 800 : 600,
                  border: on ? '1px solid transparent' : '1px solid #E5E7EB',
                  background: on ? '#FFEBDD' : '#FFFFFF',
                  color: on ? '#EA580C' : '#6B7280',
                  transition: 'background .15s ease, color .15s ease, border-color .15s ease',
                }}
              >
                <span>{label}</span>
                {count != null && count > 0 && (
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: on ? '#EA580C' : '#9CA3AF' }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Unified list: groups + chats MIXED, sorted like WhatsApp (pinned first, then most-recent) ── */}
        {(() => {
          const q = searchQuery.trim().toLowerCase();
          const showGroups = activeTab !== 'chats';
          const showChats  = activeTab !== 'groups';
          const groupsF = showGroups ? groupChats.filter(g => !q || g.cityName.toLowerCase().includes(q)) : [];
          const chatsF  = showChats ? filteredConversations : [];
          type Row = { kind: 'group'; ts: number; pinned: boolean; g: GroupChat } | { kind: 'chat'; ts: number; pinned: boolean; c: Conversation };
          const rows: Row[] = [
            ...groupsF.map(g => ({ kind: 'group' as const, ts: g.lastMessageAt ? new Date(g.lastMessageAt).getTime() : 0, pinned: pinnedGroupIds.has(g.channelId), g })),
            ...chatsF.map(c => ({ kind: 'chat' as const, ts: c.last_message_at ? new Date(c.last_message_at).getTime() : 0, pinned: pinnedIds.has(c.id), c })),
          ];
          rows.sort((a, b) => (a.pinned === b.pinned ? b.ts - a.ts : (a.pinned ? -1 : 1)));

          if (!initialized && conversations.length === 0 && groupChats.length === 0) {
            return (
              <div className="px-4 pt-3" aria-hidden>
                <style>{`@keyframes msg-skel { 0%,100%{opacity:0.55} 50%{opacity:0.9} }`}</style>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-3" style={{ animation: `msg-skel 1.3s ease-in-out ${i * 0.12}s infinite` }}>
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1"><div className="h-3.5 bg-gray-200 rounded-full mb-2" style={{ width: `${55 - i * 5}%` }} /><div className="h-3 bg-gray-100 rounded-full" style={{ width: `${80 - i * 6}%` }} /></div>
                  </div>
                ))}
              </div>
            );
          }
          if (rows.length === 0) {
            const title = activeTab === 'groups' ? 'עדיין לא הצטרפת לקבוצות' : searchQuery ? 'לא נמצאו תוצאות' : 'אין הודעות';
            const sub = activeTab === 'groups' ? 'בחרו יעד למעלה והצטרפו לטיילים' : searchQuery ? '' : 'התחילו שיחה או הצטרפו לקבוצה';
            return (
              <div className="flex flex-col items-center justify-center py-16 px-6">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  {activeTab === 'groups' ? <Users className="w-9 h-9 text-gray-300" strokeWidth={1.5} /> : <MessageCircle className="w-9 h-9 text-gray-300" strokeWidth={1.5} />}
                </div>
                <h2 className="text-base font-bold text-gray-700 mb-1" style={{ fontFamily: 'Heebo, sans-serif' }}>{title}</h2>
                {sub && <p className="text-[13px] text-gray-400 text-center">{sub}</p>}
              </div>
            );
          }
          return <div className="pt-1">{rows.map(r => r.kind === 'group' ? renderGroupRow(r.g) : renderChatRow(r.c))}</div>;
        })()}

      </div>

      {/* Floating Navigation Bar */}
      <FloatingNavBar
        activeTab="chat"
        currentUserId={currentUserId}
        onHomeClick={onHomeClick}
        onMapClick={onMapClick}
        onCreateClick={onCreateClick}
        onChatClick={onBack}
        onMyEventsClick={onMyEventsClick}
      />

      {/* City group chat overlay */}
      {openCity && (
        <CityGroupChat
          countryCode={openCity.code}
          countryFlag={openCity.flag}
          cityName={openCity.name}
          cityEmoji={openCity.emoji}
          currentUserId={currentUserId}
          currentUserName={currentUserName || 'אנונימי'}
          currentUserAvatar={currentUserAvatar}
          onClose={() => { setOpenCity(null); loadChatList(); }}
          onOpenMapAt={onOpenMapAt}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}
    </div>
  );
}
