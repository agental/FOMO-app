import { useState, useEffect } from 'react';
import { UserPlus, Check, X, Calendar, ArrowRight, Clock, ChevronLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserAvatar } from './UserAvatar';
import { FloatingNavBar } from './FloatingNavBar';
import { JoinRequestCard } from './JoinRequestCard';

type JoinRequest = {
  id: string;
  event_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
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
};

type MeetupPendingRequest = {
  meetupId: string;
  meetupEmoji: string;
  meetupText: string;
  userId: string;
  profile: { id: string; display_name: string; avatar_url: string | null };
};

export function RequestsScreen({ currentUserId, onBack, onHomeClick, onMapClick, onCreateClick, onMessagesClick, onMyEventsClick, onNavigateToUserProfile }: RequestsScreenProps) {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [meetupRequests, setMeetupRequests] = useState<MeetupPendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [meetupLoading, setMeetupLoading] = useState(false);

  useEffect(() => {
    loadJoinRequests();
    loadMeetupRequests();

    const requestsChannel = supabase
      .channel('requests-screen-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'event_join_requests' }, () => {
        loadJoinRequests();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meetups' }, () => {
        loadMeetupRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(requestsChannel);
    };
  }, [currentUserId]);

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
        .select('attendees, price')
        .eq('id', request.event_id)
        .maybeSingle();

      // Free event → approval also adds the attendee.
      // Paid event → approval only; the user is added once they pay.
      const isPaid = !!((event as any)?.price && (event as any).price > 0);
      if (event && !isPaid) {
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
    <div className="min-h-screen bg-gradient-to-br from-brand-50/50 via-white to-white" dir="rtl">
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
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full hover:bg-gray-50 flex items-center justify-center transition-all active:scale-95"
          >
            <ArrowRight className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rose-500 to-red-500 rounded-lg flex items-center justify-center shadow-sm">
              <UserPlus className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <h1 className="text-lg font-black text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
              בקשות להצטרפות
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
        ) : meetupRequests.length === 0 && joinRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-emerald-100 rounded-3xl flex items-center justify-center mb-5 shadow-lg shadow-green-100/50">
              <UserPlus className="w-11 h-11 text-green-500" strokeWidth={1.8} />
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2" style={{ fontFamily: 'Heebo, sans-serif' }}>
              אין בקשות ממתינות כרגע
            </h3>
            <p className="text-sm text-gray-500 text-center leading-relaxed" style={{ fontFamily: 'Rubik, sans-serif' }}>
              כשמישהו יבקש להצטרף לישיבה שלך,<br />הבקשות יופיעו כאן
            </p>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Meetup pending requests ── */}
            {meetupRequests.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-600 mb-3 px-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {meetupRequests.length} {meetupRequests.length === 1 ? 'בקשה ממתינה' : 'בקשות ממתינות'} לישיבות
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
                            דחה
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
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
    </div>
  );
}
