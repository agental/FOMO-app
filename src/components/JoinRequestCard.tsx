import { ChevronLeft } from 'lucide-react';

interface JoinRequestCardProps {
  profile: { id: string; display_name: string; avatar_url?: string | null };
  meetupLabel?: string;
  onApprove: () => void;
  onReject: () => void;
  onProfileClick?: () => void;
  disabled?: boolean;
}

export function JoinRequestCard({ profile, meetupLabel, onApprove, onReject, onProfileClick, disabled }: JoinRequestCardProps) {
  const initial = (profile.display_name?.[0] ?? '?').toUpperCase();

  return (
    <div
      dir="rtl"
      style={{
        background: '#FFFBEB',
        border: '1.5px solid #FDE68A',
        borderRadius: 20,
        padding: '14px 16px',
      }}
    >
      {/* top row: avatar + name + subtitle — tap to open profile */}
      <div
        onClick={onProfileClick}
        role={onProfileClick ? 'button' : undefined}
        aria-label={onProfileClick ? `פרופיל של ${profile.display_name}` : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, cursor: onProfileClick ? 'pointer' : 'default' }}
      >
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt={profile.display_name}
            style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: '2px solid #FDE68A' }}
          />
        ) : (
          <div style={{
            width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #F59E0B, #FBBF24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: '#fff',
            border: '2px solid #FDE68A',
          }}>
            {initial}
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', margin: 0 }}>
            {profile.display_name}
          </p>
          <p style={{ fontSize: 12, color: '#92400E', margin: '2px 0 0', fontWeight: 500 }}>
            רוצה להצטרף לישיבה
          </p>
          {meetupLabel && (
            <span style={{
              display: 'inline-block', marginTop: 5,
              background: '#FEF3C7', border: '1px solid #FDE68A',
              borderRadius: 20, padding: '2px 10px',
              fontSize: 11, fontWeight: 600, color: '#92400E',
            }}>
              {meetupLabel}
            </span>
          )}
        </div>
        {onProfileClick && <ChevronLeft size={18} style={{ color: '#92400E', flexShrink: 0, opacity: 0.55 }} />}
      </div>

      {/* buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onApprove}
          disabled={disabled}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
            background: '#22C55E', color: '#fff',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          אשר ✓
        </button>
        <button
          onClick={onReject}
          disabled={disabled}
          style={{
            flex: 1, padding: '9px 0', borderRadius: 12, border: 'none',
            background: '#E5E7EB', color: '#374151',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          דחה
        </button>
      </div>
    </div>
  );
}
