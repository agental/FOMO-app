import { useState, useEffect, useCallback } from 'react';
import {
  CalendarCheck, Clock, Check, MapPin, CalendarPlus, Eye, CalendarX2, Inbox,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Event } from '../types/event';
import { COUNTRIES } from '../utils/countries';
import { FloatingNavBar } from './FloatingNavBar';
import { BackButton } from './BackButton';
import { SkeletonCard } from './SkeletonCard';
import { EventDetailsModal } from './EventDetailsModal';

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

const TABS: { key: TabKey; label: string }[] = [
  { key: 'pending',   label: 'ממתין לאישור' },
  { key: 'confirmed', label: 'אירועים מאושרים' },
  { key: 'past',      label: 'היסטוריה' },
];

/* Category fallback thumbnails (same set used across the app) */
const CATEGORY_IMG: Record<string, string> = {
  parties:   'https://images.pexels.com/photos/1105666/pexels-photo-1105666.jpeg?auto=compress&cs=tinysrgb&w=400',
  treks:     'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=400',
  food:      'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
  sports:    'https://images.pexels.com/photos/390051/surfer-wave-sunset-the-indian-ocean-390051.jpeg?auto=compress&cs=tinysrgb&w=400',
  workshops: 'https://images.pexels.com/photos/3822622/pexels-photo-3822622.jpeg?auto=compress&cs=tinysrgb&w=400',
};

const thumbFor = (e: Event): string | null =>
  e.image_url || (e.event_type ? CATEGORY_IMG[e.event_type] ?? null : null);

const fmtDateTime = (s?: string) => {
  if (!s) return '';
  const d = new Date(s);
  const date = d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return `${date} · ${time}`;
};

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString('he-IL') : '');

const gcalUrl = (e: Event) => {
  const start = new Date(e.event_date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const location = [e.address, e.city, e.country ? COUNTRIES[e.country]?.name : null].filter(Boolean).join(', ');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title || 'אירוע',
    dates: `${stamp(start)}/${stamp(end)}`,
    details: e.description || '',
    location,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

const readTabFromUrl = (): TabKey => {
  const t = new URLSearchParams(window.location.search).get('tab');
  return t === 'confirmed' || t === 'past' ? t : 'pending';
};

const SELECT = '*, users(id, display_name, avatar_url)';

/* ── module-level cache (survives navigation) ── */
type MyEventsCache = { pending: Item[]; confirmed: Item[]; past: Item[] };
const _myEventsCache: Record<string, MyEventsCache> = {};

export function MyEventsScreen({
  currentUserId, onBack, onHomeClick, onMapClick, onCreateClick, onMessagesClick, onNavigateToUserProfile,
}: MyEventsScreenProps) {
  const _cached = _myEventsCache[currentUserId];
  const [tab, setTab] = useState<TabKey>(readTabFromUrl);
  const [loading, setLoading] = useState(!_cached);
  const [pending, setPending] = useState<Item[]>(_cached?.pending ?? []);
  const [confirmed, setConfirmed] = useState<Item[]>(_cached?.confirmed ?? []);
  const [past, setPast] = useState<Item[]>(_cached?.past ?? []);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  /* keep the active tab in the URL (?tab=) so it survives reloads / sharing */
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
        supabase.from('event_join_requests').select('event_id, created_at')
          .eq('user_id', currentUserId).eq('status', 'pending').order('created_at', { ascending: false }),
        supabase.from('event_join_requests').select('event_id')
          .eq('user_id', currentUserId).eq('status', 'approved'),
        supabase.from('events').select(SELECT).contains('attendees', [currentUserId]),
      ]);

      const pendingReqs = pendingReqsRes.data ?? [];
      const attending = (attendingRes.data ?? []) as unknown as Event[];

      // events for pending requests
      const pendingIds = [...new Set(pendingReqs.map(r => r.event_id))];
      let pendingEvents: Event[] = [];
      if (pendingIds.length) {
        const { data } = await supabase.from('events').select(SELECT).in('id', pendingIds);
        pendingEvents = (data ?? []) as unknown as Event[];
      }

      // approved requests whose event isn't already in the attending list
      const approvedIds = [...new Set((approvedReqsRes.data ?? []).map(r => r.event_id))];
      const missingApproved = approvedIds.filter(id => !attending.some(e => e.id === id));
      let approvedEvents: Event[] = [];
      if (missingApproved.length) {
        const { data } = await supabase.from('events').select(SELECT).in('id', missingApproved);
        approvedEvents = (data ?? []) as unknown as Event[];
      }

      // ── Pending tab ──
      const pendingMap = new Map(pendingEvents.map(e => [e.id, e]));
      const pendingItems: Item[] = pendingReqs
        .filter(r => pendingMap.has(r.event_id))
        .map(r => ({ event: pendingMap.get(r.event_id)!, registeredAt: r.created_at }));

      // ── Confirmed / Past (everything the user attends) ──
      const seen = new Set<string>();
      const attendingAll = [...attending, ...approvedEvents].filter(e => {
        if (seen.has(e.id)) return false; seen.add(e.id); return true;
      });
      const now = Date.now();
      const confirmedItems: Item[] = attendingAll
        .filter(e => new Date(e.event_date).getTime() >= now)
        .sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime())
        .map(e => ({ event: e }));
      const pastItems: Item[] = attendingAll
        .filter(e => new Date(e.event_date).getTime() < now)
        .sort((a, b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime())
        .map(e => ({ event: e }));

      _myEventsCache[currentUserId] = { pending: pendingItems, confirmed: confirmedItems, past: pastItems };
      setPending(pendingItems);
      setConfirmed(confirmedItems);
      setPast(pastItems);
    } catch (err) {
      console.error('[MyEventsScreen] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('my-events-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  const items = tab === 'pending' ? pending : tab === 'confirmed' ? confirmed : past;

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50/50 via-white to-white" dir="rtl">
      {/* ── Header ── */}
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between h-16 px-4">
          <BackButton onClick={onBack} />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-brand-500 to-brand-700 rounded-lg flex items-center justify-center shadow-sm">
              <CalendarCheck className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
              האירועים שלי
            </h1>
          </div>
          <div className="w-10" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex px-3 pb-2 gap-1">
          {TABS.map(t => {
            const active = tab === t.key;
            const count = t.key === 'pending' ? pending.length : t.key === 'confirmed' ? confirmed.length : past.length;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                aria-pressed={active}
                className="flex-1 py-2 rounded-xl text-sm font-bold transition-all active:scale-95"
                style={{
                  fontFamily: 'Heebo, sans-serif',
                  background: active ? 'linear-gradient(135deg, #F97316, #EA580C)' : 'transparent',
                  color: active ? '#fff' : '#6B7280',
                  boxShadow: active ? '0 4px 14px rgba(249,115,22,0.35)' : 'none',
                }}
              >
                {t.label}{!loading && count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </header>

      <div style={{ paddingTop: 'calc(7rem + env(safe-area-inset-top))' }} />

      {/* ── Body ── */}
      <div className="px-4 pt-2 pb-28">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <EmptyState tab={tab} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
        onMyEventsClick={() => {}}
      />
    </div>
  );
}

/* ─────────────────────────── Card ─────────────────────────── */

function StatusBadge({ tab }: { tab: TabKey }) {
  if (tab === 'pending') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200" style={{ fontFamily: 'Rubik, sans-serif' }}>
        <Clock className="w-3 h-3" strokeWidth={2.5} /> ממתין לאישור
      </span>
    );
  }
  if (tab === 'confirmed') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200" style={{ fontFamily: 'Rubik, sans-serif' }}>
        <Check className="w-3 h-3" strokeWidth={3} /> מאושר
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500 border border-gray-200" style={{ fontFamily: 'Rubik, sans-serif' }}>
      הסתיים
    </span>
  );
}

function EventStatusCard({ item, tab, onViewDetails }: { item: Item; tab: TabKey; onViewDetails: () => void }) {
  const { event } = item;
  const img = thumbFor(event);
  const organizer = event.users?.display_name || 'מארגן';
  const flag = event.country ? COUNTRIES[event.country]?.flag ?? '' : '';
  const locationLabel = `${flag} ${event.city ?? ''}`.trim();
  const muted = tab === 'past';

  return (
    <div
      className="bg-white rounded-2xl p-3.5 border border-gray-100/70 transition-all"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', opacity: muted ? 0.7 : 1 }}
    >
      <div className="flex gap-3">
        {/* thumbnail */}
        <div className="w-[72px] h-[72px] rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-brand-100 to-brand-200 flex items-center justify-center">
          {img ? (
            <img src={img} alt={event.title} className="w-full h-full object-cover" draggable={false} style={{ filter: muted ? 'grayscale(0.4)' : 'none' }} />
          ) : (
            <span className="text-3xl">{event.emoji || '📅'}</span>
          )}
        </div>

        {/* info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="text-[15px] font-black text-gray-900 leading-tight truncate" style={{ fontFamily: 'Heebo, sans-serif' }}>
              {event.title}
            </h3>
            <div className="flex-shrink-0"><StatusBadge tab={tab} /></div>
          </div>

          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <CalendarCheck className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">{fmtDateTime(event.event_date)}</span>
          </div>

          {locationLabel && (
            <div className="flex items-center gap-1.5 text-[12px] text-gray-500 mb-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
              <MapPin className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" strokeWidth={2} />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}

          <p className="text-[12px] text-gray-400 truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>
            מאת {organizer}
          </p>

          {tab === 'pending' && item.registeredAt && (
            <p className="text-[11px] text-gray-400 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
              נרשמת ב-{fmtDate(item.registeredAt)}
            </p>
          )}
          {tab === 'past' && (
            <p className="text-[11px] text-green-600 font-semibold mt-1 flex items-center gap-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
              <Check className="w-3 h-3" strokeWidth={2.5} /> השתתפת
            </p>
          )}
        </div>
      </div>

      {/* actions — confirmed only */}
      {tab === 'confirmed' && (
        <div className="flex gap-2 mt-3">
          <a
            href={gcalUrl(event)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all active:scale-95"
            style={{ fontFamily: 'Heebo, sans-serif', background: 'linear-gradient(135deg, #F97316, #EA580C)', boxShadow: '0 4px 14px rgba(249,115,22,0.3)' }}
          >
            <CalendarPlus className="w-4 h-4" strokeWidth={2.2} />
            הוסף ליומן
          </a>
          <button
            onClick={onViewDetails}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all active:scale-95"
            style={{ fontFamily: 'Heebo, sans-serif' }}
          >
            <Eye className="w-4 h-4" strokeWidth={2.2} />
            פרטים
          </button>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Empty state ─────────────────────────── */

function EmptyState({ tab }: { tab: TabKey }) {
  const config = {
    pending:   { Icon: Clock,      title: 'אין בקשות ממתינות',  text: 'אירועים שתבקש להצטרף אליהם ויחכו לאישור יופיעו כאן' },
    confirmed: { Icon: CalendarCheck, title: 'אין אירועים מאושרים', text: 'כשתאושר לאירוע, הוא יופיע כאן עם כל הפרטים' },
    past:      { Icon: CalendarX2, title: 'אין היסטוריה עדיין',  text: 'אירועים שהשתתפת בהם והסתיימו יופיעו כאן' },
  }[tab];
  const { Icon } = config;

  return (
    <div className="flex flex-col items-center justify-center py-20 px-6">
      <div className="w-24 h-24 bg-gradient-to-br from-brand-50 to-brand-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-brand-100/50">
        <Icon className="w-11 h-11 text-brand-500" strokeWidth={1.8} />
      </div>
      <h3 className="text-xl font-black text-gray-900 mb-2 text-center" style={{ fontFamily: 'Heebo, sans-serif' }}>
        {config.title}
      </h3>
      <p className="text-sm text-gray-500 text-center leading-relaxed max-w-xs" style={{ fontFamily: 'Rubik, sans-serif' }}>
        {config.text}
      </p>
      <div className="mt-6"><Inbox className="w-5 h-5 text-gray-300" /></div>
    </div>
  );
}
