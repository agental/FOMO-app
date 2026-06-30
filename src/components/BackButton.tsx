type BackButtonProps = {
  onClick?: () => void;
  /**
   * 'light' (default) — dark chevron for light headers.
   * 'dark' — white chevron + translucent press state, for coloured headers.
   */
  variant?: 'light' | 'dark';
  className?: string;
};

/**
 * Shared back-navigation control — a chevron inside a round, tappable button.
 * Matches the back arrow used in the event details screen so every page is
 * consistent. Use at the start (right side, RTL) of a screen header.
 */
export function BackButton({ onClick, variant = 'light', className = '' }: BackButtonProps) {
  const isDark = variant === 'dark';
  return (
    <button
      onClick={onClick}
      aria-label="חזור"
      className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'active:bg-white/20' : 'active:bg-gray-100'} ${className}`}
      style={{ touchAction: 'manipulation' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#ffffff' : '#111827'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}
