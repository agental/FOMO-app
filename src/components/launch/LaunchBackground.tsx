/**
 * Native-iOS launch background — flat white, with ONE extremely subtle warm-orange ambient glow
 * anchored behind the profile-photo area (not spread across the whole screen). No blobs, no grain,
 * no vignette — this is a system-app background, not a marketing page.
 */
export function LaunchBackground() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: '#FFFFFF' }}>
      <div
        style={{
          position: 'absolute',
          top: '-4%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.07), transparent 68%)',
          filter: 'blur(30px)',
        }}
      />
    </div>
  );
}
