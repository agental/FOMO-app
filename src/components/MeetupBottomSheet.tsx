import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Clock, Lock, X, Users } from 'lucide-react';
import { supabase, type Meetup } from '../lib/supabase';
import { createRecommendationPin } from '../utils/createRecommendationPin';
import { emojiColor } from '../utils/emojiColor';
import { JoinRequestCard } from './JoinRequestCard';

/* ─────────────────────────────────────── types ─── */

interface UserProfile {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}

interface Props {
  meetup: Meetup | null;
  isOpen: boolean;
  currentUserId: string;
  onClose: () => void;
  onJoined: (meetupId: string) => void;
  onOpenChat: (meetupId: string) => void;
  onRefresh: () => void;
}

/* ─────────────────────────────────────── helpers ─ */


/* ─────────────────────────────────── Avatar chip ─ */

function AvatarChip({ profile, isCreator, color }: { profile: UserProfile; isCreator: boolean; color: string }) {
  const SIZE = 52;
  const initial = (profile.display_name?.[0] ?? '?').toUpperCase();
  return (
    /* paddingTop absorbs the crown's upward overflow so it isn't clipped */
    <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ width: 68, paddingTop: 10 }}>
      <div style={{ position: 'relative', width: SIZE, height: SIZE, overflow: 'visible' }}>
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            style={{
              width: SIZE, height: SIZE, borderRadius: '50%',
              objectFit: 'cover',
              border: isCreator ? `2.5px solid ${color}` : '2.5px solid #E5E7EB',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            width: SIZE, height: SIZE, borderRadius: '50%',
            background: `linear-gradient(135deg, ${color}CC, ${color}88)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, color: 'white', fontWeight: 700,
            border: isCreator ? `2.5px solid ${color}` : '2.5px solid #E5E7EB',
          }}>
            {initial}
          </div>
        )}
        {isCreator && (
          <span style={{
            position: 'absolute', top: -8, right: -8,
            fontSize: 17, lineHeight: 1, userSelect: 'none',
            zIndex: 10,
            /* own stacking context so it floats above the avatar */
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))',
          }}>
            👑
          </span>
        )}
      </div>
      <p style={{
        fontSize: 11, color: '#6B7280', textAlign: 'center',
        width: 68, overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', lineHeight: 1.3,
      }}>
        {profile.display_name?.split(' ')[0] ?? ''}
      </p>
    </div>
  );
}

/* ─────────────────────────────────── component ─── */

export function MeetupBottomSheet({
  meetup, isOpen, currentUserId,
  onClose, onJoined, onOpenChat, onRefresh,
}: Props) {
  const [loading,          setLoading]          = useState(false);
  const [attendeeProfiles, setAttendeeProfiles] = useState<UserProfile[]>([]);
  const [pendingProfiles,  setPendingProfiles]  = useState<UserProfile[]>([]);
  const pinRef       = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  /* fetch all relevant user profiles when sheet opens */
  useEffect(() => {
    if (!meetup || !isOpen) { setAttendeeProfiles([]); setPendingProfiles([]); return; }

    const attendeeIds = meetup.attendees ?? [];
    const pendingIds  = meetup.pending_requests ?? [];
    const allIds      = [...new Set([...attendeeIds, ...pendingIds])];

    if (allIds.length === 0) return;

    supabase
      .from('users')
      .select('id, display_name, avatar_url')
      .in('id', allIds)
      .then(({ data }) => {
        if (!data) return;
        const byId = Object.fromEntries(data.map(u => [u.id, u]));
        setAttendeeProfiles(attendeeIds.map(id => byId[id]).filter(Boolean));
        setPendingProfiles(pendingIds.map(id => byId[id]).filter(Boolean));
      });
  }, [meetup?.id, isOpen]);

  /* re-render SVG pin whenever emoji / avatar / visibility changes */
  useEffect(() => {
    if (!pinRef.current || !meetup || !isOpen) return;
    pinRef.current.innerHTML = '';
    // The SAME pin the map shows: avatar coin + emoji, ringed in the emoji's colour.
    const pin = createRecommendationPin({ avatarUrl: meetup.users?.avatar_url ?? null, name: meetup.users?.display_name, color: emojiColor(meetup.emoji), emoji: meetup.emoji });
    pinRef.current.appendChild(pin);
  }, [meetup?.emoji, meetup?.users?.avatar_url, isOpen]);

  /* ── actions ── */

  const handleJoin = async () => {
    if (!meetup) return;
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
      // Supabase errors are plain objects (not Error instances) → String() gives "[object Object]".
      // Surface the real message/details/hint/code so a failing trigger is diagnosable.
      const e = err as { message?: string; details?: string; hint?: string; code?: string } | null;
      const msg = (err instanceof Error ? err.message : (e?.message || e?.details || e?.hint || e?.code)) || JSON.stringify(err);
      alert('שגיאה: ' + msg);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: string) => {
    if (!meetup) return;
    setLoading(true);
    // Optimistic: move them from pending → attending in the OPEN sheet right away. The `meetup` prop is a
    // stale snapshot, so without this the approved user lingers under "pending" until the sheet is reopened.
    const moved = pendingProfiles.find(p => p.id === uid);
    setPendingProfiles(prev => prev.filter(p => p.id !== uid));
    if (moved) setAttendeeProfiles(prev => prev.some(p => p.id === uid) ? prev : [...prev, moved]);
    try {
      const { error } = await supabase.from('meetups').update({
        attendees:        [...meetup.attendees, uid],
        pending_requests: (meetup.pending_requests ?? []).filter(x => x !== uid),
      }).eq('id', meetup.id);
      if (error) throw error;
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleReject = async (uid: string) => {
    if (!meetup) return;
    setLoading(true);
    setPendingProfiles(prev => prev.filter(p => p.id !== uid)); // optimistic remove from the open sheet
    try {
      const { error } = await supabase.from('meetups').update({
        pending_requests: (meetup.pending_requests ?? []).filter(x => x !== uid),
      }).eq('id', meetup.id);
      if (error) throw error;
      onRefresh();
    } finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!meetup || !confirm('למחוק את הציוץ?')) return;
    setLoading(true);
    try {
      await supabase.from('meetups').delete().eq('id', meetup.id);
      onRefresh();
      onClose();
    } finally { setLoading(false); }
  };

  /* ── derived state ── */

  if (!meetup) return null;

  const isOrganizer   = meetup.user_id === currentUserId;
  const isAttending   = meetup.attendees.includes(currentUserId);
  const hasPendingReq = (meetup.pending_requests ?? []).includes(currentUserId);
  const attendeeCount = meetup.attendees.length;
  const color         = emojiColor(meetup.emoji); // match the pin's frame colour (same as the Messages icon)

  /* ── render ── */

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* click-catcher for tap-outside-to-close — kept transparent & un-blurred so the map
              stays sharp and fully visible behind the meetup card */}
          <motion.div
            className="fixed inset-0 z-[55]"
            style={{ background: 'rgba(0,0,0,0.12)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* sheet */}
          <motion.div
            dir="rtl"
            className="fixed bottom-0 left-0 right-0 bg-white z-[56] flex flex-col mx-auto"
            style={{
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -8px 60px rgba(0,0,0,0.20)',
              maxWidth: 480,
              // Content-sized (compact) — only grows/scrolls if there are many pending requests.
              maxHeight: 'calc(88dvh - env(safe-area-inset-bottom, 0px))',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 500) onClose();
            }}
          >
            {/* drag handle */}
            <div
              className="w-full pt-3 pb-2 flex justify-center flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={e => dragControls.start(e)}
            >
              <div className="w-9 h-[4px] rounded-full bg-[#D1D1D6]" />
            </div>

            {/* close button */}
            <button
              onClick={onClose}
              className="absolute top-4 left-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors z-10"
            >
              <X size={15} className="text-gray-500" />
            </button>

            {/* scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="flex flex-col items-center px-5 pt-1 pb-4">

                {/* ── compact emoji coin ── */}
                <div className="flex items-center justify-center rounded-full mb-3 mt-1"
                  style={{ width: 60, height: 60, background: `${color}1a`, border: `2px solid ${color}` }}>
                  <span style={{ fontSize: 30, lineHeight: 1 }}>{meetup.emoji}</span>
                </div>

                {/* ── title = the meetup's own text ── */}
                <h2
                  className="text-[18px] font-black text-gray-900 text-center leading-snug mb-2.5 px-3"
                  dir="rtl"
                >
                  {meetup.text || 'מפגש'}
                </h2>

                {/* privacy + count — one compact row */}
                <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
                  <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-2.5 py-1">
                    {meetup.privacy === 'open'
                      ? <Users size={11} className="text-green-500" />
                      : <Lock size={11} className="text-gray-400" />
                    }
                    <span className="text-[11px] font-semibold" style={{ color: meetup.privacy === 'open' ? '#22c55e' : '#6B7280' }}>
                      {meetup.privacy === 'open' ? 'פתוח להצטרפות' : 'אישור נדרש'}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-bold" style={{ color }}>
                    {attendeeCount} {attendeeCount === 1 ? 'משתתף' : 'משתתפים'} 🎉
                  </span>
                </div>

                {/* ── attendee avatar row ── */}
                {attendeeProfiles.length > 0 && (
                  <div
                    className="flex gap-3 overflow-x-auto pb-1 mb-3 w-full"
                    style={{
                      justifyContent: attendeeProfiles.length <= 4 ? 'center' : 'flex-start',
                      /* give room for the crown badge that floats above each chip */
                      overflowY: 'visible',
                      paddingTop: 2,
                    }}
                  >
                    {attendeeProfiles.map(profile => (
                      <AvatarChip
                        key={profile.id}
                        profile={profile}
                        isCreator={profile.id === meetup.user_id}
                        color={color}
                      />
                    ))}
                  </div>
                )}

                {/* divider */}
                <div className="w-full h-px bg-gray-100 mb-4" />

                {/* ── pending requests (organizer only) ── */}
                {isOrganizer && pendingProfiles.length > 0 && (
                  <div className="w-full space-y-2 mb-4">
                    <p className="text-sm font-bold text-amber-800 mb-1 px-1">
                      {pendingProfiles.length} בקש{pendingProfiles.length === 1 ? 'ה' : 'ות'} ממתינות לאישור
                    </p>
                    {pendingProfiles.map(profile => (
                      <JoinRequestCard
                        key={profile.id}
                        profile={profile}
                        meetupLabel={`${meetup.emoji} ${meetup.text}`}
                        onApprove={() => handleApprove(profile.id)}
                        onReject={() => handleReject(profile.id)}
                        disabled={loading}
                      />
                    ))}
                  </div>
                )}

                {/* ── action buttons (compact row) ── */}
                <div className="w-full flex gap-2.5">
                  {/* Chat — organizer or attendee */}
                  {(isOrganizer || isAttending) && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onOpenChat(meetup.id)}
                      className="flex-1 py-3.5 text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-1.5"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}BB)`, boxShadow: `0 6px 20px ${color}40` }}
                    >
                      💬 {isOrganizer ? 'צ׳אט קבוצתי' : 'כנס לצ׳אט'}
                    </motion.button>
                  )}

                  {/* Join — non-member, non-pending */}
                  {!isOrganizer && !isAttending && !hasPendingReq && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleJoin}
                      disabled={loading}
                      className="flex-1 py-3.5 text-white rounded-2xl font-bold text-[14px] flex items-center justify-center gap-1.5 disabled:opacity-50"
                      style={{ background: `linear-gradient(135deg, ${color}, ${color}BB)`, boxShadow: `0 6px 20px ${color}40` }}
                    >
                      {loading ? 'מצטרף...' : meetup.privacy === 'open' ? '✅ הצטרף' : '📩 בקשת הצטרפות'}
                    </motion.button>
                  )}

                  {/* Pending state */}
                  {!isOrganizer && hasPendingReq && (
                    <div className="flex-1 py-3.5 bg-gray-100 text-gray-500 rounded-2xl font-semibold text-[14px] flex items-center justify-center gap-1.5">
                      <Clock size={16} />
                      ממתין לאישור
                    </div>
                  )}

                  {/* Delete — organizer only (sits beside Chat) */}
                  {isOrganizer && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleDelete}
                      disabled={loading}
                      className="py-3.5 px-4 rounded-2xl font-bold text-sm text-red-500 bg-red-50 flex items-center justify-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                    >
                      🗑 מחק
                    </motion.button>
                  )}
                </div>
              </div>
            </div>

            {/* iPhone home indicator spacer */}
            <div style={{ height: 'env(safe-area-inset-bottom, 12px)', flexShrink: 0 }} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
