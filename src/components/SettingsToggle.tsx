/* iOS-style switch in FOMO's brand orange. Used by the settings sub-screens. */
export function SettingsToggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative flex-shrink-0 rounded-full transition-colors duration-200 active:scale-95 disabled:opacity-50"
      style={{ width: 46, height: 28, background: checked ? '#F97316' : '#E5E7EB' }}
    >
      <span
        className="absolute top-1 rounded-full bg-white transition-transform duration-200"
        style={{
          width: 20, height: 20, right: 4,
          transform: checked ? 'translateX(-18px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  );
}
