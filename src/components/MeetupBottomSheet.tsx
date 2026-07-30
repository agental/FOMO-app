import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Clock, Lock, X, Users } from 'lucide-react';
import { supabase, type Meetup } from '../lib/supabase';
import { createMeetupPinSVG } from '../utils/createMeetupPin';
import { getMeetupPinColor } from '../utils/meetupPinColor';
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

const HE_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function sameLocalDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function getMeetupDayLabel(iso: string): string {
  const d        = new Date(iso);
  const today    = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (sameLocalDay(d, today))    return 'היום';
  if (sameLocalDay(d, tomorrow)) return 'מחר';
  return `ביום ${HE_DAYS[d.getDay()]}`;
}

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
    const pin = createMeetupPinSVG(meetup.emoji, meetup.users?.avatar_url ?? null);
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
      alert('שגיאה: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (uid: string) => {
    if (!meetup) return;
    setLoading(true);
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
  const pendingCount  = meetup.pending_requests?.length ?? 0;
  const color         = getMeetupPinColor(meetup.emoji);
  const firstName     = (meetup.users?.display_name ?? 'מישהו').split(' ')[0];

  /* ── render ── */

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* blurred dark overlay */}
          <motion.div
            className="fixed inset-0 z-[55]"
            style={{ background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* sheet */}
          <motion.div
            dir="rtl"
            className="fixed bottom-0 left-0 right-0 bg-white z-[56] flex flex-col"
            style={{
              borderRadius: '28px 28px 0 0',
              boxShadow: '0 -8px 60px rgba(0,0,0,0.20)',
              maxHeight: 'calc(90dvh - env(safe-area-inset-bottom, 0px))',
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
              <div className="flex flex-col items-center px-5 pt-1 pb-6">

                {/* ── SVG pin hero ── */}
                {/*
                  No filter on the rectangle wrapper — CSS drop-shadow on a
                  sized div shadows the bounding box, not the pin shape.
                  The SVG already carries its own internal drop-shadow filter.
                  We add a separate blurred oval for the colored glow.
                */}
                <div style={{
                  position: 'relative',
                  width: 49 * 2.4,
                  height: 54 * 2.4,
                  overflow: 'visible',
                  background: 'transparent',
                  marginBottom: 2,
                }}>
                  <div
                    ref={pinRef}
                    style={{
                      transform: 'scale(2.4)',
                      transformOrigin: 'top left',
                      position: 'absolute',
                      top: 0, left: 0,
                      overflow: 'visible',
                      background: 'transparent',
                    }}
                  />
                </div>

                {/* colored glow oval — sits below the pin tip, no box artifact */}
                <div style={{
                  width: 64, height: 18, borderRadius: '50%',
                  background: color, opacity: 0.28,
                  filter: 'blur(10px)',
                  marginTop: -6, marginBottom: 18,
                  pointerEvents: 'none',
                }} />

                {/* ── title ── */}
                <h2
                  className="text-[22px] font-bold text-gray-900 text-center leading-snug mb-1 px-2"
                  dir="rtl"
                >
                  {`${firstName} רוצה ${meetup.emoji} ${getMeetupDayLabel(meetup.scheduled_at)}`}
                </h2>

                {/* description */}
                {meetup.text && (
                  <p className="text-[15px] text-gray-500 text-center mb-3 px-4 leading-snug">
                    {meetup.text}
                  </p>
                )}

                {/* time + privacy pills */}
                <div className="flex items-center gap-2 mb-5 flex-wrap justify-center">
                  <div className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1.5">
                    {meetup.privacy === 'open'
                      ? <Users size={12} className="text-green-500" />
                      : <Lock size={12} className="text-gray-400" />
                    }
                    <span className="text-xs font-medium" style={{ color: meetup.privacy === 'open' ? '#22c55e' : '#6B7280' }}>
                      {meetup.privacy === 'open' ? 'פתוח להצטרפות' : 'אישור נדרש'}
                    </span>
                  </div>
                </div>

                {/* ── attendee count ── */}
                <p className="text-sm font-bold mb-4" style={{ color }}>
                  {attendeeCount} {attendeeCount === 1 ? 'משתתף' : 'משתתפים'} 🎉
                </p>

                {/* ── attendee avatar row ── */}
                {attendeeProfiles.length > 0 && (
                  <div
                    className="flex gap-3 overflow-x-auto pb-1 mb-5 w-full"
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
                <div className="w-full h-px bg-gray-100 mb-5" />

                {/* ── pending requests (organizer only) ── */}
                {isOrganizer && pendingCount > 0 && (
                  <div className="w-full space-y-2 mb-4">
                    <p className="text-sm font-bold text-amber-800 mb-1 px-1">
                      {pendingCount} בקש{pendingCount === 1 ? 'ה' : 'ות'} ממתינות לאישור
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

                {/* ── action buttons ── */}
                <div className="w-full space-y-3">

                  {/* Chat — organizer or attendee */}
                  {(isOrganizer || isAttending) && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => onOpenChat(meetup.id)}
                      className="w-full py-4 text-white rounded-full font-bold text-[15px] flex items-center justify-center gap-2"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}BB)`,
                        boxShadow: `0 6px 24px ${color}45`,
                      }}
                    >
                      💬 {isOrganizer ? 'פתח צ׳אט קבוצתי' : 'כנס לצ׳אט הקבוצתי'}
                    </motion.button>
                  )}

                  {/* Join — non-member, non-pending */}
                  {!isOrganizer && !isAttending && !hasPendingReq && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleJoin}
                      disabled={loading}
                      className="w-full py-4 text-white rounded-full font-bold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50"
                      style={{
                        background: `linear-gradient(135deg, ${color}, ${color}BB)`,
                        boxShadow: `0 6px 24px ${color}45`,
                      }}
                    >
                      {loading ? 'מצטרף...' :
                        meetup.privacy === 'open' ? '✅ הצטרף לציוץ' : '📩 שלח בקשת הצטרפות'
                      }
                    </motion.button>
                  )}

                  {/* Pending state */}
                  {!isOrganizer && hasPendingReq && (
                    <div className="w-full py-4 bg-gray-100 text-gray-500 rounded-full font-semibold text-[15px] flex items-center justify-center gap-2">
                      <Clock size={17} />
                      ממתין לאישור המארגן
                    </div>
                  )}

                  {/* Delete — organizer only */}
                  {isOrganizer && (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleDelete}
                      disabled={loading}
                      className="w-full py-3.5 rounded-full font-semibold text-sm text-red-500 border-2 border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      🗑 מחק ציוץ
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
