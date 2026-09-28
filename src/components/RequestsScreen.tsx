import { useState, useEffect } from 'react';
import { useSwipeBack } from '../hooks/useSwipeBack';
import { Check, X, Calendar, Clock, ChevronLeft, Bell, Ticket, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { FloatingNavBar } from './FloatingNavBar';
import { JoinRequestCard } from './JoinRequestCard';
import { BackButton } from './BackButton';
import { EventDetailsModal } from './EventDetailsModal';
import { EventService } from '../services/eventService';
import type { Event } from '../types/event';
type NotifRow = {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  emoji: string | null;
  read: boolean;
  created_at: string;
  entity_kind?: string | null;
  entity_id?: string | null;
};

type JoinRequest = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  paid_amount?: number | null;
  ticket_label?: string | null;
  user: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  event: {
    id: string;
    title: string;
  };
};

type RequestsScreenProps = {
  currentUserId: string;
  onBack: () => void;
  onHomeClick?: () => void;
  onMapClick?: () => void;
  onCreateClick?: () => void;
  onMessagesClick?: () => void;
  onMyEventsClick?: () => void;
  onNavigateToUserProfile?: (userId: string) => void;
  onOpenMapAt?: (lat: number, lng: number) => void;
};

type MeetupPendingRequest = {
  meetupId: string;
  meetupEmoji: string;
  meetupText: string;
  userId: string;
  profile: { id: string; display_name: string; avatar_url: string | null };
};

export function RequestsScreen({ currentUserId, onBack, onHomeClick, onMapClick, onCreateClick, onMessagesClick, onMyEventsClick, onNavigateToUserProfile, onOpenMapAt }: RequestsScreenProps) {
  const swipeRef = useSwipeBack<HTMLDivElement>(onBack); // swipe from an edge to slide the screen back
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [meetupRequests, setMeetupRequests] = useState<MeetupPendingRequest[]>([]);
  const [notifications, setNotifications] = useState<NotifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetupLoading, setMeetupLoading] = useState(false);
  // Full events behind APPROVED decision notifications → power the "view ticket / enter group" actions.
  // Keyed by id, plus a title index used to resolve rows whose notification carries no event_id.
  const [eventMap, setEventMap] = useState<Record<string, Event>>({});
  const [eventByTitle, setEventByTitle] = useState<Record<string, Event>>({});
  // The event opened from a notification action, and whether to jump straight into its group chat.
  const [openEvent, setOpenEvent] = useState<Event | null>(null);
  const [openInGroup, setOpenInGroup] = useState(false);

  useEffect(() => {
    loadJoinRequests();
    loadMeetupRequests();
    loadNotifications();

    const requestsChannel = supabase
      .channel('requests-screen-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => {
        loadJoinRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, () => {
        loadMeetupRequests();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, () => {
        loadNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [currentUserId]);

  // Decisions on MY OWN join requests (approved / rejected). The "new" flag is
  // computed against the last time the user opened this screen; we then bump the
  // seen-timestamp so the bell badge clears and these stop counting as unread.
  const notifBg = (type: string) =>
    type.endsWith('approved') ? 'linear-gradient(135deg,#22c55e,#16a34a)'
      : type.endsWith('rejected') ? 'linear-gradient(135deg,#ef4444,#e11d48)'
      : 'linear-gradient(135deg,#F97316,#EA580C)';

  // Full notifications history (events + meetups; requests received AND decisions on my own requests).
  // Loading it marks everything read → the bell dot clears, but the history itself stays (Instagram-style).
  const loadNotifications = async () => {
    try {
      // entity_kind/entity_id let an APPROVED event decision (type 'event_approved', entity_kind 'event')
      // deep-link to its event for the "view ticket / enter group" actions. Kept behind a graceful fallback
      // in case an older DB lacks the columns.
      let rows: NotifRow[] = [];
      const withEntity = await supabase
        .from('notifications')
        .select('id, type, title, body, emoji, read, created_at, entity_kind, entity_id')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (withEntity.error) {
        const base = await supabase
          .from('notifications')
          .select('id, type, title, body, emoji, read, created_at')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false })
          .limit(100);
        rows = (base.data || []) as NotifRow[];
      } else {
        rows = (withEntity.data || []) as NotifRow[];
      }
      setNotifications(rows);

      // Load the full events behind approved decisions so the action buttons can open the card / group.
      // Two sources so this works whatever the notifications schema looks like:
      //   1. event_id straight off the notification (when the column exists), and
      //   2. MY approved event_join_requests (always have event_id) — also used to match by title for
      //      notifications that carry no event_id.
      const { data: myApproved } = await supabase
        .from('event_join_requests')
        .select('event_id')
        .eq('user_id', currentUserId)
        .eq('status', 'approved');
      const approvedEventIds = [...new Set([
        ...rows.filter(n => n.type === 'event_approved' && n.entity_kind === 'event' && n.entity_id).map(n => n.entity_id as string),
        ...((myApproved || []).map(r => r.event_id as string).filter(Boolean)),
      ])];
      if (approvedEventIds.length) {
        const events = await Promise.all(approvedEventIds.map(id => EventService.getEventById(id)));
        const byId: Record<string, Event> = {};
        const byTitle: Record<string, Event> = {};
        events.forEach(ev => { if (ev) { byId[ev.id] = ev; if (ev.title) byTitle[ev.title.trim()] = ev; } });
        setEventMap(prev => ({ ...prev, ...byId }));
        setEventByTitle(prev => ({ ...prev, ...byTitle }));
      }

      const unread = rows.filter((n: NotifRow) => !n.read).map((n: NotifRow) => n.id);
      if (unread.length) await supabase.from('notifications').update({ read: true }).in('id', unread);
      globalThis.__fomoPendingCount = 0;
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  };

  const loadMeetupRequests = async () => {
    setMeetupLoading(true);
    try {
      const { data: myMeetups } = await supabase
        .from('meetups')
        .select('id, emoji, text, pending_requests')
        .eq('user_id', currentUserId);

      const meetupsWithPending = (myMeetups ?? []).filter(m => m.pending_requests?.length > 0);
      if (meetupsWithPending.length === 0) { setMeetupRequests([]); return; }

      const allPendingIds = [...new Set(meetupsWithPending.flatMap(m => m.pending_requests ?? []))];
      const { data: profiles } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', allPendingIds);

      const byId = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
      const flat: MeetupPendingRequest[] = meetupsWithPending.flatMap(m =>
        (m.pending_requests ?? []).map((uid: string) => ({
          meetupId: m.id,
          meetupEmoji: m.emoji,
          meetupText: m.text,
          userId: uid,
          profile: byId[uid] ?? { id: uid, display_name: 'משתמש', avatar_url: null },
        }))
      );
      setMeetupRequests(flat);
    } catch (err) {
      console.error('Error loading meetup requests:', err);
    } finally {
      setMeetupLoading(false);
    }
  };

  const handleApproveMeetup = async (meetupId: string, userId: string) => {
    setMeetupRequests(prev => prev.filter(r => !(r.meetupId === meetupId && r.userId === userId))); // optimistic
    const { data: meetup } = await supabase
      .from('meetups')
      .select('attendees, pending_requests')
      .eq('id', meetupId)
      .single();
    if (!meetup) return;
    await supabase.from('meetups').update({
      attendees:        [...(meetup.attendees ?? []), userId],
      pending_requests: (meetup.pending_requests ?? []).filter((x: string) => x !== userId),
    }).eq('id', meetupId);
    loadMeetupRequests();
  };

  const handleRejectMeetup = async (meetupId: string, userId: string) => {
    setMeetupRequests(prev => prev.filter(r => !(r.meetupId === meetupId && r.userId === userId))); // optimistic
    const { data: meetup } = await supabase
      .from('meetups')
      .select('pending_requests')
      .eq('id', meetupId)
      .single();
    if (!meetup) return;
    await supabase.from('meetups').update({
      pending_requests: (meetup.pending_requests ?? []).filter((x: string) => x !== userId),
    }).eq('id', meetupId);
    loadMeetupRequests();
  };

  const loadJoinRequests = async () => {
    try {
      setLoading(true);
      const { data: myEvents } = await supabase
        .from('events')
        .select('id')
        .eq('user_id', currentUserId);

      if (!myEvents || myEvents.length === 0) {
        setJoinRequests([]);
        return;
      }

      const eventIds = myEvents.map(e => e.id);
      const { data: requests, error } = await supabase
        .from('event_join_requests')
        .select('*')
        .in('event_id', eventIds)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!requests || requests.length === 0) {
        setJoinRequests([]);
        return;
      }

      const userIds = [...new Set(requests.map(r => r.user_id))];
      const { data: users } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .in('id', userIds);

      const { data: events } = await supabase
        .from('events')
        .select('id, title')
        .in('id', eventIds);

      const requestsWithDetails = requests.map(request => ({
        ...request,
        user: users?.find(u => u.id === request.user_id) || { id: request.user_id, display_name: 'משתמש לא ידוע', avatar_url: null },
        event: events?.find(e => e.id === request.event_id) || { id: request.event_id, title: 'אירוע לא ידוע' },
      }));

      setJoinRequests(requestsWithDetails);
    } catch (error) {
      console.error('Error loading join requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (request: JoinRequest) => {
    try {
      await supabase
        .from('event_join_requests')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      const { data: event } = await supabase
        .from('events')
        .select('attendees')
        .eq('id', request.event_id)
        .maybeSingle();

      // Approval always admits the buyer now (they already paid, for paid events).
      if (event && !(event.attendees || []).includes(request.user_id)) {
        const updatedAttendees = [...(event.attendees || []), request.user_id];
        await supabase
          .from('events')
          .update({ attendees: updatedAttendees })
          .eq('id', request.event_id);
      }

      loadJoinRequests();
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleRejectRequest = async (request: JoinRequest) => {
    try {
      // Paid ticket → refund at the provider first (best-effort). The Edge Function no-ops for
      // free events and is safe to call regardless; a provider hiccup shouldn't block the reject.
      if (request.paid_amount != null && request.paid_amount > 0) {
        try {
          await supabase.functions.invoke('payments-refund', { body: { joinRequestId: request.id } });
        } catch (refundErr) {
          console.error('Refund failed (rejecting anyway):', refundErr);
        }
      }

      await supabase
        .from('event_join_requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      loadJoinRequests();
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'עכשיו';
    if (diffInMinutes < 60) return `לפני ${diffInMinutes} דקות`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `לפני ${diffInHours} שעות`;

    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `לפני ${diffInDays} ימים`;

    return date.toLocaleDateString('he-IL');
  };

  return (
    <div ref={swipeRef} className="min-h-screen bg-gradient-to-br from-brand-50/50 via-white to-white" dir="rtl">
      <header
        className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-100/50"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div
          className="flex items-center justify-between h-16 px-4"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left))',
            paddingRight: 'max(1rem, env(safe-area-inset-right))'
          }}
        >
          <BackButton onClick={onBack} />

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
              התראות
            </h1>
          </div>

          <div className="w-10" />
        </div>
      </header>

      <div style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top))' }}></div>

      <div className="px-4 pt-6 pb-24">
        {(loading || meetupLoading) ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 border-4 border-brand-100 border-t-brand-500 rounded-full animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>טוען בקשות...</p>
          </div>
        ) : meetupRequests.length === 0 && joinRequests.length === 0 && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-orange-100 to-amber-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-orange-100/50">
              <Bell className="w-11 h-11 text-orange-500" strokeWidth={1.8} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
              אין התראות חדשות
            </h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed" style={{ fontFamily: 'Rubik, sans-serif' }}>
              בקשות הצטרפות לאירועים שלך ועדכונים<br />על הבקשות שלך יופיעו כאן
            </p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Meetup pending requests ── */}
            {meetupRequests.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3 px-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {meetupRequests.length} {meetupRequests.length === 1 ? 'בקשה ממתינה' : 'בקשות ממתינות'} לציוצים
                </p>
                <div className="space-y-3">
                  {meetupRequests.map(req => (
                    <JoinRequestCard
                      key={`${req.meetupId}-${req.userId}`}
                      profile={req.profile}
                      meetupLabel={`${req.meetupEmoji} ${req.meetupText}`}
                      onApprove={() => handleApproveMeetup(req.meetupId, req.userId)}
                      onReject={() => handleRejectMeetup(req.meetupId, req.userId)}
                      onProfileClick={() => onNavigateToUserProfile?.(req.userId)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Event join requests (legacy) ── */}
            {joinRequests.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3 px-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {joinRequests.length} {joinRequests.length === 1 ? 'בקשה ממתינה' : 'בקשות ממתינות'} לאירועים
                </p>
                <div className="space-y-3">
                  {joinRequests.map((request, idx) => (
                    <div
                      key={request.id}
                      className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl border border-gray-100/50 animate-fade-in transition-all duration-300"
                      style={{ animationDelay: `${idx * 60}ms` }}
                    >
                      <div className="p-4">
                        <div className="flex items-start gap-3 mb-4">
                          <button
                            type="button"
                            onClick={() => onNavigateToUserProfile?.(request.user.id)}
                            aria-label={`פרופיל של ${request.user.display_name}`}
                            className="flex-shrink-0 active:scale-95 transition-transform"
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          >
                            <UserAvatar
                              userId={request.user.id}
                              displayName={request.user.display_name}
                              avatarUrl={request.user.avatar_url}
                              size="small"
                            />
                          </button>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => onNavigateToUserProfile?.(request.user.id)}
                              className="flex items-center gap-1 active:opacity-70 mb-0.5"
                              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                            >
                              <span className="font-bold text-gray-900 text-sm" style={{ fontFamily: 'Heebo, sans-serif' }}>
                                {request.user.display_name}
                              </span>
                              <ChevronLeft className="w-4 h-4 text-gray-400" strokeWidth={2.5} />
                            </button>
                            <div className="flex items-center gap-1.5 mb-2.5">
                              <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={2} />
                              <span className="text-[11px] text-gray-500 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                {formatTimeAgo(request.created_at)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-brand-50 to-brand-100 rounded-xl border border-brand-100">
                              <Calendar className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" strokeWidth={2.5} />
                              <span className="text-xs font-bold text-brand-900 truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                {request.event.title}
                              </span>
                            </div>
                            {(request.paid_amount != null && request.paid_amount > 0) && (
                              <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1.5 bg-amber-50 rounded-xl border border-amber-100">
                                <span className="text-xs font-bold text-amber-800" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                  🎟️ {request.ticket_label || 'כרטיס'} · שילם ₪{request.paid_amount}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApproveRequest(request)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-500/20 hover:from-green-600 hover:to-emerald-600 transition-all duration-300 active:scale-95"
                            style={{ fontFamily: 'Heebo, sans-serif' }}
                          >
                            <Check className="w-4 h-4" strokeWidth={2.5} />
                            אשר
                          </button>
                          <button
                            onClick={() => handleRejectRequest(request)}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-red-500 to-rose-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/20 hover:from-red-600 hover:to-rose-600 transition-all duration-300 active:scale-95"
                            style={{ fontFamily: 'Heebo, sans-serif' }}
                          >
                            <X className="w-4 h-4" strokeWidth={2.5} />
                            {(request.paid_amount != null && request.paid_amount > 0) ? 'דחה והחזר' : 'דחה'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Notifications history (events + meetups; requests + decisions) — stays like Instagram ── */}
            {notifications.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3 px-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  היסטוריית התראות
                </p>
                <div className="space-y-3">
                  {notifications.map((n, idx) => {
                    // Offer "view ticket / enter group" when this notification is about an event I'm APPROVED
                    // for. eventMap/eventByTitle only ever hold events I'm an approved attendee of, so a match
                    // (by event_id, else by the event title shown in the body/title) is safe regardless of the
                    // exact notification `type` string — and never fires for pending/rejected rows.
                    const ev = (n.entity_kind === 'event' && n.entity_id && eventMap[n.entity_id])
                      || (n.body && eventByTitle[n.body.trim()])
                      || (n.title && eventByTitle[n.title.trim()])
                      || null;
                    return (
                    <div
                      key={n.id}
                      className="bg-white rounded-2xl shadow-md border border-gray-100/50 animate-fade-in p-4"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl"
                          style={{ background: notifBg(n.type) }}
                        >
                          {n.emoji || '🔔'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
                            {n.title || 'התראה'}
                          </p>
                          {n.body && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" strokeWidth={2.5} />
                              <span className="text-xs text-gray-600 font-medium truncate" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                {n.body}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 mt-1">
                            <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" strokeWidth={2} />
                            <span className="text-[11px] text-gray-400 font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>
                              {formatTimeAgo(n.created_at)}
                            </span>
                          </div>
                        </div>
                        {!n.read && (
                          <span className="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-orange-500" />
                        )}
                      </div>

                      {ev && (
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => { setOpenInGroup(false); setOpenEvent(ev); }}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
                            style={{ fontFamily: 'Heebo, sans-serif' }}
                          >
                            <Ticket className="w-4 h-4" strokeWidth={2.5} />
                            צפה בכרטיס
                          </button>
                          {!!(ev as any).has_group && (
                            <button
                              onClick={() => { setOpenInGroup(true); setOpenEvent(ev); }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-white text-orange-600 border-2 border-orange-200 rounded-xl font-bold text-sm active:scale-95 transition-all"
                              style={{ fontFamily: 'Heebo, sans-serif' }}
                            >
                              <MessageCircle className="w-4 h-4" strokeWidth={2.5} />
                              כניסה לקבוצה
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      <FloatingNavBar
        activeTab="chat"
        currentUserId={currentUserId}
        onHomeClick={onHomeClick}
        onMapClick={onMapClick}
        onCreateClick={onCreateClick}
        onChatClick={onMessagesClick}
        onMyEventsClick={onMyEventsClick}
      />

      {openEvent && (
        <EventDetailsModal
          event={openEvent}
          currentUserId={currentUserId}
          onClose={() => { setOpenEvent(null); setOpenInGroup(false); }}
          onOpenMapAt={onOpenMapAt}
          onNavigateToUserProfile={onNavigateToUserProfile}
          initialOpenGroup={openInGroup}
        />
      )}
    </div>
  );
}
