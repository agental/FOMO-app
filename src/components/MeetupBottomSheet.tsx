import { useState } from 'react';
import { X, Clock, MapPin, Users, Lock, Check, ChevronLeft } from 'lucide-react';
import { supabase, type Meetup } from '../lib/supabase';

interface MeetupBottomSheetProps {
  meetup: Meetup | null;
  isOpen: boolean;
  currentUserId: string;
  onClose: () => void;
  onJoined: (meetupId: string) => void;
  onOpenChat: (meetupId: string) => void;
  onRefresh: () => void;
}

function formatScheduledAt(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs  = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHr  = Math.round(diffMs / 3600000);

  if (diffMin < 0) return 'כבר התחיל';
  if (diffMin < 60) return `בעוד ${diffMin} דקות`;
  if (diffHr  < 24) return `בעוד ${diffHr} שעות`;

  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' · ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

export function MeetupBottomSheet({
  meetup,
  isOpen,
  currentUserId,
  onClose,
  onJoined,
  onOpenChat,
  onRefresh,
}: MeetupBottomSheetProps) {
  const [loading, setLoading] = useState(false);

  if (!isOpen || !meetup) return null;

  const isOrganizer     = meetup.user_id === currentUserId;
  const isAttending     = meetup.attendees.includes(currentUserId);
  const hasPendingReq   = meetup.pending_requests?.includes(currentUserId);
  const pendingCount    = meetup.pending_requests?.length ?? 0;
  const attendeeCount   = meetup.attendees.length;

  const handleJoin = async () => {
    setLoading(true);
    try {
      if (meetup.privacy === 'open') {
        const { error } = await supabase
          .from('meetups')
          .update({ attendees: [...meetup.attendees, currentUserId] })
          .eq('id', meetup.id);
        if (error) throw error;
        onJoined(meetup.id);
        onRefresh();
      } else {
        const { error } = await supabase
          .from('meetups')
          .update({ pending_requests: [...(meetup.pending_requests ?? []), currentUserId] })
          .eq('id', meetup.id);
        if (error) throw error;
        alert('בקשתך נשלחה! המארגן יאשר אותה בקרוב.');
        onRefresh();
      }
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: string) => {
    setLoading(true);
    try {
      const newAttendees = [...meetup.attendees, uid];
      const newPending   = (meetup.pending_requests ?? []).filter(x => x !== uid);
      const { error } = await supabase
        .from('meetups')
        .update({ attendees: newAttendees, pending_requests: newPending })
        .eq('id', meetup.id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      alert('שגיאה באישור: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (uid: string) => {
    setLoading(true);
    try {
      const newPending = (meetup.pending_requests ?? []).filter(x => x !== uid);
      const { error } = await supabase
        .from('meetups')
        .update({ pending_requests: newPending })
        .eq('id', meetup.id);
      if (error) throw error;
      onRefresh();
    } catch (err) {
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMeetup = async () => {
    if (!confirm('למחוק את הישיבה?')) return;
    setLoading(true);
    try {
      await supabase.from('meetups').delete().eq('id', meetup.id);
      onRefresh();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[55]"
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[55] flex flex-col"
        style={{ maxHeight: '85dvh' }}
        dir="rtl"
      >
        {/* Handle */}
        <div className="w-full pt-3 pb-2 flex justify-center flex-shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-5 pb-6 space-y-5">

            {/* Hero */}
            <div className="relative">
              <button onClick={onClose} className="absolute left-0 top-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4 text-gray-600" />
              </button>

              <div className="flex flex-col items-center pt-2 pb-4">
                <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-50 to-orange-100 border-2 border-orange-200 flex items-center justify-center text-5xl shadow-inner mb-4">
                  {meetup.emoji}
                </div>
                <h2 className="text-xl font-bold text-gray-900 text-center leading-snug">{meetup.text}</h2>
                {meetup.users && (
                  <p className="text-sm text-gray-500 mt-1">
                    {isOrganizer ? 'הישיבה שלך' : `מאורגן ע"י ${meetup.users.display_name}`}
                  </p>
                )}
              </div>
            </div>

            {/* Info pills */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-800 leading-tight">
                  {formatScheduledAt(meetup.scheduled_at)}
                </p>
              </div>
              <div className="bg-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                <Users className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <p className="text-sm font-medium text-gray-800">
                  {attendeeCount} {attendeeCount === 1 ? 'משתתף' : 'משתתפים'}
                </p>
              </div>
              <div className="bg-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                {meetup.privacy === 'open'
                  ? <Users className="w-5 h-5 text-green-500 flex-shrink-0" />
                  : <Lock className="w-5 h-5 text-orange-500 flex-shrink-0" />
                }
                <p className="text-sm font-medium text-gray-800">
                  {meetup.privacy === 'open' ? 'הצטרפות חופשית' : 'אישור נדרש'}
                </p>
              </div>
              {(meetup.city || meetup.country) && (
                <div className="bg-orange-50 rounded-2xl px-4 py-3 flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {meetup.city || meetup.country}
                  </p>
                </div>
              )}
            </div>

            {/* Organizer: pending requests */}
            {isOrganizer && pendingCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-3">
                  {pendingCount} בקש{pendingCount === 1 ? 'ה' : 'ות'} ממתינות לאישור
                </p>
                <div className="space-y-2">
                  {(meetup.pending_requests ?? []).map(uid => (
                    <div key={uid} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-mono text-left">{uid.slice(0, 8)}…</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(uid)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                        >
                          אשר
                        </button>
                        <button
                          onClick={() => handleReject(uid)}
                          disabled={loading}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 text-xs rounded-lg font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                        >
                          דחה
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action area */}
            {isOrganizer ? (
              <div className="space-y-3">
                <button
                  onClick={() => onOpenChat(meetup.id)}
                  className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-base hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-2"
                >
                  💬 פתח צ׳אט קבוצתי
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDeleteMeetup}
                  disabled={loading}
                  className="w-full py-3 text-red-500 text-sm font-medium hover:text-red-700 transition-colors"
                >
                  מחק ישיבה
                </button>
              </div>
            ) : isAttending ? (
              <button
                onClick={() => onOpenChat(meetup.id)}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-base hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-200 flex items-center justify-center gap-2"
              >
                💬 כנס לצ׳אט הקבוצתי
                <ChevronLeft className="w-4 h-4" />
              </button>
            ) : hasPendingReq ? (
              <div className="w-full py-4 bg-gray-100 text-gray-500 rounded-2xl font-semibold text-base flex items-center justify-center gap-2">
                <Clock className="w-5 h-5" />
                ממתין לאישור המארגן
              </div>
            ) : (
              <button
                onClick={handleJoin}
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold text-base hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 shadow-md shadow-orange-200"
              >
                {loading ? 'מצטרף...' :
                  meetup.privacy === 'open' ? '✅ הצטרף לישיבה' : '📩 שלח בקשת הצטרפות'
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
