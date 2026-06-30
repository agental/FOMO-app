import React, { useState, useEffect, useRef } from 'react';
import { Search, MessageCircle, Plus, X, Users, ChevronDown, Trash2, Pin, BellOff, Bell } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';
import { CityGroupChat } from './CityGroupChat';

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

type Conversation = {
  id: string;
  participant_1_id: string;
  participant_2_id: string;
  last_message_at: string;
  other_user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  last_message: {
    content: string;
    sender_id: string;
  } | null;
  unread_count: number;
};

type MessagesScreenProps = {
  currentUserId: string;
  onBack: () => void;
  onConversationClick: (conversationId: string, otherUserId: string) => void;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onMyEventsClick?: () => void;
  onNavigateToCountrySelection?: () => void;
  onOpenMapAt?: (lat: number, lng: number) => void;
  initialCountries?: string[];
};

const DEMO_COUNTRIES = ['TH', 'JP', 'IT', 'FR', 'US', 'GR'];
// Survives navigation so re-entering Messages shows the right flags instantly.
let _cachedUserCountries: string[] | null = null;

// Module-level cache — survives component remounts
let _cachedConversations: Conversation[] = [];
let _cachedGroupChats: GroupChat[] = [];
let _cachedInitialized = false;

type GroupChat = {
  channelId: string;
  countryCode: string;
  countryFlag: string;
  cityName: string;
  cityEmoji: string;
  memberCount: number;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  memberStatus: 'approved' | 'pending';
};

export function MessagesScreen({ currentUserId, onBack, onConversationClick, onHomeClick, onMapClick, onCreateClick, onMyEventsClick, onNavigateToCountrySelection, onOpenMapAt, initialCountries }: MessagesScreenProps) {
  const [conversations,   setConversations]   = useState<Conversation[]>(_cachedConversations);
  const [groupChats,      setGroupChats]      = useState<GroupChat[]>(_cachedGroupChats);
  const [loading,         setLoading]         = useState(!_cachedInitialized);
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
  const [openCity, setOpenCity] = useState<{ code: string; flag: string; name: string; emoji: string } | null>(null);
  const [groupsCollapsed, setGroupsCollapsed] = useState(false);
  const [chatsCollapsed,  setChatsCollapsed]  = useState(false);
  const [pinnedIds,  setPinnedIds]  = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('pinned_convos') || '[]')));
  const [mutedIds,   setMutedIds]   = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem('muted_convos') || '[]')));
  const touchStartX = useRef<number>(0);

  useEffect(() => {
    loadConversations();
    loadUserCountries();
    loadGroupChats();

    const messagesChannel = supabase
      .channel('messages-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        loadConversations();
      })
      .subscribe();

    const groupChannel = supabase
      .channel('group-messages-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages' }, () => {
        loadGroupChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(groupChannel);
    };
  }, [currentUserId]);

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
        setUserCountries(cs);
      }
      if (data?.display_name) setCurrentUserName(data.display_name);
      if (data?.avatar_url !== undefined) setCurrentUserAvatar(data.avatar_url);
    } catch {}
  };

  const loadGroupChats = async () => {
    try {
      const { data: memberships } = await supabase
        .from('group_members')
        .select('channel_id, last_seen_at, status')
        .eq('user_id', currentUserId);
      if (!memberships?.length) return;

      const channelIds = memberships.map(m => m.channel_id);
      const { data: channels } = await supabase
        .from('group_channels').select('*').in('id', channelIds);
      if (!channels) return;

      await loadGroupChatsFromChannels(memberships, channels);
    } catch {}
  };

  const loadGroupChatsFromChannels = async (
    memberships: { channel_id: string; last_seen_at: string | null; status?: string | null }[],
    channels: Record<string, unknown>[]
  ) => {
    const results: GroupChat[] = await Promise.all(channels.map(async (ch: Record<string, unknown>) => {
      const membership = memberships.find(m => m.channel_id === ch.id);
      const lastSeen = membership?.last_seen_at ?? '1970-01-01';
      const mStatus = (membership?.status ?? 'approved') as 'approved' | 'pending';
      const country = COUNTRIES[ch.country_code as string];

      const [lastMsgRes, unreadRes, memCountRes] = await Promise.all([
        supabase.from('group_messages').select('content,type,created_at,display_name')
          .eq('channel_id', ch.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('group_messages').select('id', { count: 'exact', head: true })
          .eq('channel_id', ch.id as string).neq('user_id', currentUserId).gt('created_at', lastSeen),
        supabase.from('group_members').select('*', { count: 'exact', head: true })
          .eq('channel_id', ch.id),
      ]);

      const lastMsg = lastMsgRes.data;
      let preview = null;
      if (lastMsg) {
        if (lastMsg.type === 'image') preview = `${lastMsg.display_name}: 📷 תמונה`;
        else if (lastMsg.type === 'location') preview = `${lastMsg.display_name}: 📍 מיקום`;
        else preview = `${lastMsg.display_name}: ${lastMsg.content}`;
      }

      return {
        channelId: ch.id as string,
        countryCode: ch.country_code as string,
        countryFlag: country?.flag ?? '🌍',
        cityName: ch.city_name as string,
        cityEmoji: ch.city_emoji as string,
        memberCount: memCountRes.count ?? 0,
        lastMessage: preview,
        lastMessageAt: lastMsg?.created_at ?? null,
        unreadCount: unreadRes.count ?? 0,
      };
    }));

    // Deduplicate in-memory: keep the one with the most messages per country+emoji
    const seenKeys = new Map<string, GroupChat>();
    const dupChannelIds: string[] = [];
    for (const gc of results) {
      const key = `${gc.countryCode}:${gc.cityEmoji}`;
      const existing = seenKeys.get(key);
      if (!existing) {
        seenKeys.set(key, gc);
      } else {
        // keep the one with more messages; discard the other
        const keepNew = (gc.unreadCount + (gc.lastMessageAt ? 1 : 0)) >
                        (existing.unreadCount + (existing.lastMessageAt ? 1 : 0));
        if (keepNew) {
          dupChannelIds.push(existing.channelId);
          seenKeys.set(key, gc);
        } else {
          dupChannelIds.push(gc.channelId);
        }
      }
    }
    // Remove memberships from duplicates in the background
    if (dupChannelIds.length) {
      dupChannelIds.forEach(id =>
        supabase.from('group_members').delete().eq('channel_id', id).eq('user_id', currentUserId)
      );
    }

    const deduped = [...seenKeys.values()];
    const sorted = deduped.sort((a, b) =>
      (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '')
    );
    _cachedGroupChats = sorted;
    setGroupChats(sorted);
  };

  const loadConversations = async () => {
    try {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1_id.eq.${currentUserId},participant_2_id.eq.${currentUserId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      if (!convos || convos.length === 0) {
        _cachedConversations = [];
        _cachedInitialized = true;
        setConversations([]);
        setInitialized(true);
        setLoading(false);
        return;
      }

      const conversationsWithDetails = await Promise.all(
        convos.map(async (convo) => {
          const otherUserId = convo.participant_1_id === currentUserId
            ? convo.participant_2_id
            : convo.participant_1_id;

          const [userResult, lastMessageResult, unreadResult] = await Promise.all([
            supabase.from('users').select('id, display_name, avatar_url').eq('id', otherUserId).maybeSingle(),
            supabase.from('messages').select('content, sender_id').eq('conversation_id', convo.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
            supabase.from('messages').select('id', { count: 'exact', head: true }).eq('conversation_id', convo.id).eq('is_read', false).neq('sender_id', currentUserId)
          ]);

          return {
            id: convo.id,
            participant_1_id: convo.participant_1_id,
            participant_2_id: convo.participant_2_id,
            last_message_at: convo.last_message_at,
            other_user: userResult.data || { id: otherUserId, display_name: 'משתמש', avatar_url: null },
            last_message: lastMessageResult.data,
            unread_count: unreadResult.count || 0
          };
        })
      );

      _cachedConversations = conversationsWithDetails;
      _cachedInitialized = true;
      setConversations(conversationsWithDetails);
      setInitialized(true);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
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
    setSwipedId(null);
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    try {
      await supabase.from('messages').delete().eq('conversation_id', conversationId);
      await supabase.from('conversations').delete().eq('id', conversationId);
    } catch (err) {
      console.error('Delete conversation error:', err);
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

  const filteredConversations = conversations
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

  return (
    <div className="min-h-screen bg-[#F8F9FB] flex flex-col" style={{ fontFamily: 'Rubik, sans-serif' }} dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-100/80 px-4 pt-4 pb-3 safe-area-top">
        <h1 className="text-[22px] font-bold text-[#111] mb-4" style={{ fontFamily: 'Heebo, sans-serif' }}>
          הודעות
        </h1>

        {/* Search */}
        <div className="relative">
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

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28">


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
          `}</style>

          <p className="text-[13px] font-bold text-gray-400 px-4 mb-3 tracking-wide">קבוצות</p>

          {/* Country circles row */}
          <div className="overflow-x-auto scrollbar-hide" style={{ touchAction: 'pan-x', overscrollBehaviorX: 'contain' }}>
            <div className="flex gap-3 px-4 pb-1" style={{ width: 'max-content' }}>
              {userCountries.map((code) => {
                const country = COUNTRIES[code];
                if (!country) return null;
                const isExpanded = expandedCountry === code;
                const hasCities  = !!COUNTRY_CITIES[code];
                return (
                  <button
                    key={code}
                    onClick={() => setExpandedCountry(isExpanded ? null : code)}
                    className="flex flex-col items-center gap-1.5 flex-shrink-0"
                    style={{ background: 'none', border: 'none', cursor: hasCities ? 'pointer' : 'default', padding: 0 }}
                  >
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center p-[2.5px]"
                      style={{
                        background: isExpanded
                          ? 'linear-gradient(135deg, #F97316, #EA580C)'
                          : 'linear-gradient(135deg, #F97316, #EA580C)',
                        animation: isExpanded ? 'country-ring-pulse 1.4s ease-in-out infinite' : 'none',
                        transition: 'background 0.25s',
                      }}
                    >
                      <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-2xl">
                        {country.flag}
                      </div>
                    </div>
                    <span
                      className="text-[11px] font-medium max-w-[56px] text-center truncate"
                      style={{ color: isExpanded ? '#F97316' : '#6B7280' }}
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
                <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300">
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
                {COUNTRY_CITIES[expandedCountry].map((city, i) => (
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
                      border: '1.5px solid #FED7AA',
                      background: 'white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
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
                    <Users size={12} color="#F97316" strokeWidth={2.5} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px bg-gray-100 mx-4 my-2" />

        {/* Group chats the user has joined */}
        {groupChats.length > 0 && (
          <div>
            <button
              onClick={() => setGroupsCollapsed(p => !p)}
              className="w-full flex items-center gap-1 px-4 mb-1 mt-3"
            >
              <p className="text-[13px] font-bold text-gray-400 tracking-wide">קבוצות שלי</p>
              <ChevronDown
                size={16}
                color="#9CA3AF"
                style={{ transition: 'transform 0.2s', transform: groupsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              />
            </button>
            {!groupsCollapsed && groupChats.map(gc => (
              <button
                key={gc.channelId}
                onClick={() => setOpenCity({ code: gc.countryCode, flag: gc.countryFlag, name: gc.cityName, emoji: gc.cityEmoji })}
                className="w-full flex items-center gap-3 px-4 bg-[#F8F9FB] active:scale-[0.98] transition-all duration-150"
                style={{ height: 72, paddingTop: 6, paddingBottom: 6 }}
              >
                {/* Group avatar */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: '50%',
                    background: gc.unreadCount > 0 ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'linear-gradient(135deg, #E5E7EB, #D1D5DB)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24,
                    boxShadow: gc.unreadCount > 0 ? '0 3px 10px rgba(249,115,22,0.35)' : 'none',
                  }}>
                    {gc.cityEmoji}
                  </div>
                  {/* Member count badge */}
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    background: '#fff', borderRadius: 10, padding: '1px 5px',
                    fontSize: 10, fontWeight: 700, color: '#6B7280',
                    border: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: 2,
                  }}>
                    <Users size={9} />
                    {gc.memberCount}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 text-right">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-[15px] truncate ${gc.unreadCount > 0 ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`}
                      style={{ fontFamily: 'Heebo, sans-serif' }}>
                      {gc.countryFlag} {gc.cityName}
                    </h3>
                    <span className="text-[12px] text-gray-400 flex-shrink-0 ml-2">
                      {gc.lastMessageAt ? formatTime(gc.lastMessageAt) : ''}
                    </span>
                  </div>
                  <p className={`text-[13px] truncate text-right ${gc.unreadCount > 0 ? 'text-[#444] font-medium' : 'text-gray-400'}`}>
                    {gc.lastMessage ?? 'טרם נשלחו הודעות'}
                  </p>
                </div>

                {/* Unread badge */}
                {gc.unreadCount > 0 && (
                  <div style={{
                    minWidth: 20, height: 20, borderRadius: 10, padding: '0 5px',
                    background: 'linear-gradient(135deg, #F97316, #EA580C)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>
                      {gc.unreadCount > 99 ? '99+' : gc.unreadCount}
                    </span>
                  </div>
                )}
              </button>
            ))}
            <div className="h-px bg-gray-100 mx-4 my-2" />
          </div>
        )}

        {/* Chat List */}
        {!initialized ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-brand-500 rounded-full animate-spin" style={{ borderWidth: '3px' }}></div>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-9 h-9 text-gray-300" strokeWidth={1.5} />
            </div>
            <h2 className="text-base font-bold text-gray-700 mb-1" style={{ fontFamily: 'Heebo, sans-serif' }}>
              אין שיחות
            </h2>
            <p className="text-[13px] text-gray-400 text-center">
              {searchQuery ? 'לא נמצאו שיחות' : 'התחל שיחה עם משתמש מהפרופיל שלו'}
            </p>
          </div>
        ) : (
          <div className="px-0 pt-1">
            <button
              onClick={() => setChatsCollapsed(p => !p)}
              className="w-full flex items-center gap-1 px-4 mb-1 mt-2"
            >
              <p className="text-[13px] font-bold text-gray-400 tracking-wide">צאטים שלי</p>
              <ChevronDown
                size={16}
                color="#9CA3AF"
                style={{ transition: 'transform 0.2s', transform: chatsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
              />
            </button>
            {!chatsCollapsed && filteredConversations.map((conversation) => {
              const isUnread  = conversation.unread_count > 0;
              const isSwiped  = swipedId === conversation.id;
              const isPinned  = pinnedIds.has(conversation.id);
              const isMuted   = mutedIds.has(conversation.id);
              const rowBg     = isPinned ? '#FFF7ED' : '#F8F9FB';

              return (
                <React.Fragment key={conversation.id}>
                <div
                  style={{ position: 'relative', overflow: 'hidden' }}
                  onTouchStart={(e) => handleTouchStart(e, conversation.id)}
                  onTouchEnd={(e) => handleTouchEnd(e, conversation.id)}
                >
                  {/* Actions — only rendered when swiped */}
                  {isSwiped && <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 180, display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', background: rowBg, zIndex: 0 }}>
                    <button onClick={() => handleDeleteConversation(conversation.id)}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      <Trash2 size={20} />
                    </button>
                    <button onClick={() => handlePinConversation(conversation.id)}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: isPinned ? '#6B7280' : '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      <Pin size={20} />
                    </button>
                    <button onClick={() => handleMuteConversation(conversation.id)}
                      style={{ width: 44, height: 44, borderRadius: '50%', background: isMuted ? '#6B7280' : '#F59E0B', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      {isMuted ? <Bell size={20} /> : <BellOff size={20} />}
                    </button>
                  </div>}

                  {/* Row — slides left to reveal actions */}
                  <button
                    onClick={() => {
                      if (isSwiped) {
                        setSwipedId(null);
                      } else {
                        onConversationClick(conversation.id, conversation.other_user.id);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-4 active:scale-[0.98] transition-all duration-150"
                    style={{
                      height: '72px',
                      paddingTop: '6px',
                      paddingBottom: '6px',
                      background: rowBg,
                      position: 'relative',
                      zIndex: 1,
                      transform: isSwiped ? 'translateX(-180px)' : 'translateX(0)',
                      transition: 'transform 0.25s ease',
                    }}
                  >
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      <div
                        className="w-[52px] h-[52px] rounded-full overflow-hidden flex items-center justify-center"
                        style={{
                          padding: isUnread ? 2 : 0,
                          background: isUnread ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'transparent',
                          boxShadow: isUnread ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                        }}
                      >
                        <div className="w-full h-full bg-white rounded-full overflow-hidden">
                          <UserAvatar
                            userId={conversation.other_user.id}
                            displayName={conversation.other_user.display_name}
                            avatarUrl={conversation.other_user.avatar_url}
                            size="medium"
                          />
                        </div>
                      </div>
                      {/* Pin badge */}
                      {isPinned && !isUnread && (
                        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 18, height: 18, borderRadius: '50%', background: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F8F9FB' }}>
                          <Pin size={9} color="#fff" />
                        </div>
                      )}
                      {/* Unread badge */}
                      {isUnread && (
                        <div
                          style={{ position: 'absolute', bottom: -2, left: -2, minWidth: 20, height: 20, borderRadius: 10, padding: '0 4px', background: 'linear-gradient(135deg, #F97316, #EA580C)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #F8F9FB' }}
                        >
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
                            {conversation.unread_count > 9 ? '9+' : conversation.unread_count}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <h3
                          className={`text-[15px] truncate ${isUnread ? 'font-bold text-[#111]' : 'font-semibold text-[#333]'}`}
                          style={{ fontFamily: 'Heebo, sans-serif' }}
                        >
                          {conversation.other_user.display_name}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0 mr-2">
                          <span className="text-[12px] text-gray-400 font-normal">
                            {formatTime(conversation.last_message_at)}
                          </span>
                          {isMuted && <BellOff size={12} color="#9CA3AF" />}
                        </div>
                      </div>
                      {conversation.last_message && (
                        <p
                          className={`text-[13px] truncate text-right ${isUnread ? 'text-[#444] font-medium' : 'text-gray-400 font-normal'}`}
                          style={{ opacity: isMuted ? 0.6 : 1 }}
                        >
                          {conversation.last_message.sender_id === currentUserId && (
                            <span className="text-gray-300">אתה: </span>
                          )}
                          {conversation.last_message.content}
                        </p>
                      )}
                    </div>
                  </button>

                </div>
                {/* Subtle separator */}
                <div className="h-px bg-gray-100 mx-4" />
                </React.Fragment>
              );
            })}
          </div>
        )}
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
          onClose={() => { setOpenCity(null); loadGroupChats(); }}
          onOpenMapAt={onOpenMapAt}
        />
      )}
    </div>
  );
}
