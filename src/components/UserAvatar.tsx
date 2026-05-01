import { User } from 'lucide-react';

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

export function UserAvatar({
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
      <img
        src={avatarUrl}
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
      className={`${sizeClasses[size]} rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold ${className} ${clickableClasses}`}
    >
      {displayName ? firstLetter : <User className={iconSizes[size]} />}
    </div>
  );
}
