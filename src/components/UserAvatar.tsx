import { User } from 'lucide-react';
import { CachedImage } from './CachedImage';

interface UserAvatarProps {
  userId?: string;
  avatarUrl?: string | null;
  displayName: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  className?: string;
  onClick?: () => void;
}

const sizeClasses = {
  small: 'w-8 h-8 text-xs',
  medium: 'w-12 h-12 text-lg',
  large: 'w-20 h-20 text-2xl',
  xlarge: 'w-24 h-24 text-3xl',
};

const iconSizes = {
  small: 'w-4 h-4',
  medium: 'w-6 h-6',
  large: 'w-10 h-10',
  xlarge: 'w-12 h-12',
};

// Distinct per-user avatar colors (WhatsApp-style) — hashed from a stable id so each user gets their own.
const AVATAR_COLORS = [
  '#EF5350', '#EC407A', '#AB47BC', '#7E57C2', '#5C6BC0', '#42A5F5', '#26A69A',
  '#66BB6A', '#9CCC65', '#FFA726', '#FF7043', '#8D6E63', '#26C6DA', '#78909C',
];
const avatarColor = (key: string) => {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

export function UserAvatar({
  userId,
  avatarUrl,
  displayName,
  size = 'medium',
  className = '',
  onClick
}: UserAvatarProps) {
  const firstLetter = displayName?.[0]?.toUpperCase() || '?';
  const isClickable = !!onClick;
  const clickableClasses = isClickable ? 'cursor-pointer hover:opacity-80 active:scale-95 transition-all duration-200' : '';

  if (avatarUrl) {
    return (
      <CachedImage
        url={avatarUrl}
        maxDim={96}
        alt={displayName}
        onClick={onClick}
        className={`${sizeClasses[size]} rounded-full object-cover ${className} ${clickableClasses}`}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  return (
    <div
      onClick={onClick}
      style={{ background: avatarColor(userId || displayName || '?') }}
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center text-white font-bold ${className} ${clickableClasses}`}
    >
      {displayName ? firstLetter : <User className={iconSizes[size]} />}
    </div>
  );
}
