import { useState, useEffect, useCallback } from 'react';
import { Ticket, Clock, Check, MapPin, CalendarPlus, Eye, CalendarX2, Sparkles, Calendar, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Event } from '../types/event';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';
import { BackButton } from './BackButton';
import { SkeletonCard } from './SkeletonCard';
import { EventDetailsModal } from './EventDetailsModal';
import { getCategoryEmoji } from '../utils/eventCategories';

type TabKey = 'pending' | 'confirmed' | 'past';

type MyEventsScreenProps = {
  currentUserId: string;
  onBack: () => void;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onMessagesClick?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
};

type Item = { event: Event; registeredAt?: string };

const TABS: { key: TabKey; label: string; emoji: string }[] = [
  { key: 'pending',   label: 'ממתין',   emoji: '⏳' },
  { key: 'confirmed', label: 'מאושר',   emoji: '✅' },
  { key: 'past',      label: 'היסטוריה', emoji: '🏁' },
];

const CATEGORY_GRADIENT: Record<string, string> = {
  parties:   'linear-gradient(135deg,#a855f7,#ec4899)',
  treks:     'linear-gradient(135deg,#10b981,#0ea5e9)',
  food:      'linear-gradient(135deg,#f97316,#eab308)',
  sports:    'linear-gradient(135deg,#3b82f6,#06b6d4)',
  workshops: 'linear-gradient(135deg,#f59e0b,#f97316)',
  yeshivot:  'linear-gradient(135deg,#6366f1,#8b5cf6)',
};

const CATEGORY_IMG: Record<string, string> = {
  parties:   'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=600',
  treks:     'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=600',
  food:      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=600',
  sports:    'https://images.pexels.com/photos/2884867/pexels-photo-2884867.jpeg?auto=compress&cs=tinysrgb&w=600',
  workshops: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=600',
  yeshivot:  'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=600',
};

const heroImg  = (e: Event) => e.image_url || (e.event_type ? CATEGORY_IMG[e.event_type] ?? null : null);
const heroGrad = (e: Event) => (e.event_type ? CATEGORY_GRADIENT[e.event_type] : null) ?? 'linear-gradient(135deg,#F97316,#ea580c)';

const fmtDate = (s?: string) => s ? new Date(s).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' }) : '';
const fmtTime = (s?: string) => s ? new Date(s).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }) : '';

const daysUntil = (s?: string) => {
  if (!s) return null;
  const diff = Math.ceil((new Date(s).getTime() - Date.now()) / 86400000);
  if (diff < 0) return null;
  if (diff === 0) return 'היום! 🔥';
  if (diff === 1) return 'מחר ⚡';
  return `בעוד ${diff} ימים`;
};

const gcalUrl = (e: Event) => {
  const start = new Date(e.event_date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const location = [e.address, e.city, e.country ? COUNTRIES[e.country]?.name : null].filter(Boolean).join(', ');
  return `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: e.title || 'אירוע', dates: `${stamp(start)}/${stamp(end)}`, details: e.description || '', location }).toString()}`;
};

const readTabFromUrl = (): TabKey => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'confirmed' || t === 'past' ? t : 'pending';
};

const SELECT = '*, users(id, display_name, avatar_url)';
type MyEventsCache = { pending: Item[]; confirmed: Item[]; past: Item[] };
const _myEventsCache: Record<string, MyEventsCache> = {};

export function MyEventsScreen({
  currentUserId, onBack, onHomeClick, onMapClick, onCreateClick, onMessagesClick, onNavigateToUserProfile,
}: MyEventsScreenProps) {
  const _cached = _myEventsCache[currentUserId];
  const [tab, setTab] = useState<TabKey>(readTabFromUrl);
  const [loading, setLoading] = useState(!_cached);
  const [loadError, setLoadError] = useState(false);
  const [pending, setPending] = useState<Item[]>(_cached?.pending ?? []);
  const [confirmed, setConfirmed] = useState<Item[]>(_cached?.confirmed ?? []);
  const [past, setPast] = useState<Item[]>(_cached?.past ?? []);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
  }, [tab]);

  const load = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const [pendingReqsRes, approvedReqsRes, attendingRes] = await Promise.all([
        supabase.from('event_join_requests').select('event_id, created_at').eq('user_id', currentUserId).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('event_join_requests').select('event_id').eq('user_id', currentUserId).eq('status', 'approved'),
        supabase.from('events').select(SELECT).contains('attendees', [currentUserId]),
      ]);

      const pendingReqs = pendingReqsRes.data ?? [];
      const attending = (attendingRes.data ?? []) as unknown as Event[];
      const pendingIds = [...new Set(pendingReqs.map(r => r.event_id))];
      let pendingEvents: Event[] = [];
      if (pendingIds.length) {
        const { data } = await supabase.from('events').select(SELECT).in('id', pendingIds);
        pendingEvents = (data ?? []) as unknown as Event[];
      }
      const approvedIds = [...new Set((approvedReqsRes.data ?? []).map(r => r.event_id))];
      const missingApproved = approvedIds.filter(id => !attending.some(e => e.id === id));
      let approvedEvents: Event[] = [];
      if (missingApproved.length) {
        const { data } = await supabase.from('events').select(SELECT).in('id', missingApproved);
        approvedEvents = (data ?? []) as unknown as Event[];
      }

      const pendingMap = new Map(pendingEvents.map(e => [e.id, e]));
      const pendingItems: Item[] = pendingReqs.filter(r => pendingMap.has(r.event_id)).map(r => ({ event: pendingMap.get(r.event_id)!, registeredAt: r.created_at }));

      const seen = new Set<string>();
      const attendingAll = [...attending, ...approvedEvents].filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
      const now = Date.now();
      const confirmedItems: Item[] = attendingAll.filter(e => new Date(e.event_date).getTime() >= now).sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime()).map(e => ({ event: e }));
      const pastItems: Item[] = attendingAll.filter(e => new Date(e.event_date).getTime() < now).sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()).map(e => ({ event: e }));

      _myEventsCache[currentUserId] = { pending: pendingItems, confirmed: confirmedItems, past: pastItems };
      setPending(pendingItems); setConfirmed(confirmedItems); setPast(pastItems);
    } catch (err) {
      console.error('[MyEventsScreen] load failed:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
    const channel = supabase.channel('my-events-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => load()).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const items = tab === 'pending' ? pending : tab === 'confirmed' ? confirmed : past;
  const counts = { pending: pending.length, confirmed: confirmed.length, past: past.length };

  return (
    <div className="min-h-screen" style={{ background: '#F8F9FB' }} dir="rtl">

      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          background: 'rgba(248,249,251,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <BackButton onClick={onBack} />
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 12px rgba(249,115,22,0.4)' }}
            >
              <Ticket className="w-4.5 h-4.5 text-white" strokeWidth={2.2} />
            </div>
            <h1 className="text-[18px] font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
              האירועים שלי
            </h1>
          </div>
          <div className="w-10" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex px-4 pb-3 gap-2">
          {TABS.map(t => {
            const active = tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className="flex-1 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95 flex items-center justify-center gap-1"
                style={{
                  fontFamily: 'Heebo, sans-serif',
                  background: active ? 'linear-gradient(135deg,#F97316,#EA580C)' : 'rgba(255,255,255,0.8)',
                  color: active ? '#fff' : '#6B7280',
                  boxShadow: active ? '0 4px 14px rgba(249,115,22,0.35)' : '0 1px 4px rgba(0,0,0,0.06)',
                }}
              >
                <span>{t.emoji}</span>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ paddingTop: 'calc(7.5rem + env(safe-area-inset-top))', paddingBottom: 112 }} className="px-4 pt-2">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <span className="text-4xl">⚠️</span>
            <p className="text-gray-500 text-[15px]">שגיאה בטעינת האירועים</p>
            <button onClick={() => { setLoadError(false); load(); }} className="px-5 py-2 rounded-full text-white text-[14px] font-bold" style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)' }}>נסה שוב</button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <EventStatusCard
                key={item.event.id}
                item={item}
                tab={tab}
                onViewDetails={() => setSelectedEvent(item.event)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          currentUserId={currentUserId}
          onClose={() => setSelectedEvent(null)}
          onNavigateToUserProfile={onNavigateToUserProfile}
        />
      )}

      <FloatingNavBar
        activeTab="myEvents"
        currentUserId={currentUserId}
        onHomeClick={onHomeClick}
        onMapClick={onMapClick}
        onCreateClick={onCreateClick}
        onChatClick={onMessagesClick}
        onMyEventsClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      />
    </div>
  );
}

/* ─────────────────────────── Card ─────────────────────────── */

function EventStatusCard({ item, tab, onViewDetails }: { item: Item; tab: TabKey; onViewDetails: () => void }) {
  const { event } = item;
  const img       = heroImg(event);
  const grad      = heroGrad(event);
  const emoji     = (event as any).emoji || getCategoryEmoji(event.event_type || '');
  const flag      = event.country ? COUNTRIES[event.country]?.flag ?? '' : '';
  const location  = `${flag} ${event.city ?? ''}`.trim();
  const organizer = (event as any).users?.display_name || 'מארגן';
  const isPast    = tab === 'past';
  const countdown = !isPast ? daysUntil(event.event_date) : null;
  const isToday   = countdown?.includes('היום');

  // Status badge config — all use orange palette
  const badge = tab === 'pending'
    ? { label: 'ממתין לאישור', bg: '#F59E0B', Icon: Clock, pulse: true }
    : tab === 'confirmed'
      ? { label: 'מאושר', bg: '#10b981', Icon: Check, pulse: false }
      : { label: 'הסתיים', bg: '#9CA3AF', Icon: null, pulse: false };

  return (
    <div
      className="bg-white rounded-[20px] overflow-hidden active:scale-[0.99] transition-transform"
      style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.07)', opacity: isPast ? 0.8 : 1 }}
      onClick={tab !== 'confirmed' ? onViewDetails : undefined}
    >
      <div className="flex gap-3 p-4">

        {/* ── Thumbnail (square, no distortion) ── */}
        <div
          className="flex-shrink-0 rounded-[14px] overflow-hidden relative"
          style={{ width: 86, height: 86 }}
        >
          <div className="absolute inset-0" style={{ background: grad }} />
          {img && (
            <img
              src={img} alt={event.title}
              className="absolute inset-0 w-full h-full object-cover"
              style={{ filter: isPast ? 'grayscale(0.5)' : 'none' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          {/* Event emoji overlay */}
          {emoji && (
            <div className="absolute inset-0 flex items-end justify-start p-1.5">
              <span style={{ fontSize: 20, lineHeight: 1, filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.5))' }}>{emoji}</span>
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">

          {/* Top: title + status badge */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-[15px] font-black text-gray-900 leading-tight flex-1"
              style={{ fontFamily: 'Heebo, sans-serif' }}>
              {event.title}
            </h3>
            <span
              className={`flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white ${badge.pulse ? 'animate-pulse' : ''}`}
              style={{ background: badge.bg, fontFamily: 'Heebo, sans-serif' }}
            >
              {badge.Icon && <badge.Icon className="w-2.5 h-2.5" strokeWidth={3} />}
              {badge.label}
            </span>
          </div>

          {/* Date */}
          <div className="flex items-center gap-1.5 mb-1">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F97316' }} strokeWidth={2} />
            <span className="text-[12px] text-gray-600 font-medium" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {fmtDate(event.event_date)} · {fmtTime(event.event_date)}
            </span>
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#F97316' }} strokeWidth={2} />
              <span className="text-[12px] text-gray-500" style={{ fontFamily: 'Heebo, sans-serif' }}>{location}</span>
            </div>
          )}

          {/* Organizer + countdown/status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 flex-shrink-0 text-gray-300" strokeWidth={2} />
              <span className="text-[11px] text-gray-400" style={{ fontFamily: 'Heebo, sans-serif' }}>
                {organizer}
              </span>
            </div>
            {countdown && (
              <span
                className="text-[11px] font-black px-2 py-0.5 rounded-full"
                style={{
                  fontFamily: 'Heebo, sans-serif',
                  background: isToday ? '#FFF7ED' : '#F3F4F6',
                  color: isToday ? '#F97316' : '#6B7280',
                }}
              >
                {countdown}
              </span>
            )}
            {isPast && (
              <span className="text-[11px] font-bold text-green-600 flex items-center gap-1"
                style={{ fontFamily: 'Heebo, sans-serif' }}>
                <Check className="w-3 h-3" strokeWidth={3} /> השתתפת
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Actions (confirmed only) ── */}
      {tab === 'confirmed' && (
        <div className="flex gap-2 px-4 pb-4 -mt-1">
          <button
            onClick={onViewDetails}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[13px] font-bold transition-all active:scale-95"
            style={{ background: '#F3F4F6', color: '#374151', fontFamily: 'Heebo, sans-serif' }}
          >
            <Eye className="w-4 h-4" strokeWidth={2} /> פרטים
          </button>
          <a
            href={gcalUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-2xl text-[13px] font-bold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg,#F97316,#EA580C)', boxShadow: '0 4px 12px rgba(249,115,22,0.35)', fontFamily: 'Heebo, sans-serif' }}
          >
            <CalendarPlus className="w-4 h-4" strokeWidth={2} /> הוסף ליומן
          </a>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Empty states ─────────────────────────── */

function EmptyState({ tab }: { tab: TabKey }) {
  const config = {
    pending: {
      emoji: '⏳',
      title: 'אין בקשות ממתינות',
      text: 'כשתבקש להצטרף לאירוע פרטי, הוא יופיע כאן עד לאישור המארגן',
      Icon: Clock,
    },
    confirmed: {
      emoji: '🎟️',
      title: 'אין אירועים מאושרים',
      text: 'כשתצטרף לאירוע, הוא יופיע כאן עם כל הפרטים ואפשרות להוסיף ליומן',
      Icon: Sparkles,
    },
    past: {
      emoji: '🏁',
      title: 'אין היסטוריה עדיין',
      text: 'אירועים שהשתתפת בהם ועברו יופיעו כאן כזיכרון יפה',
      Icon: CalendarX2,
    },
  }[tab];

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="text-7xl mb-5" style={{ lineHeight: 1 }}>{config.emoji}</div>
      <h3 className="text-[20px] font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
        {config.title}
      </h3>
      <p className="text-[14px] text-gray-400 leading-relaxed max-w-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>
        {config.text}
      </p>
    </div>
  );
}
