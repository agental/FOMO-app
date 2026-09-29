import launchBg from '../../assets/launch-background.mp4';

/**
 * Launch background — a looping, muted video (friends watching a Koh Phangan sunset) filling the
 * screen, with a top/bottom gradient scrim so the logo, countdown and buttons stay legible.
 */
export function LaunchBackground() {
  return (
    <div aria-hidden style={{ position: 'fixed', inset: 0, overflow: 'hidden', pointerEvents: 'none', background: '#0C0C10' }}>
      <video
        src={launchBg}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(8,8,12,0.60) 0%, rgba(8,8,12,0.15) 26%, rgba(8,8,12,0.30) 62%, rgba(8,8,12,0.72) 100%)',
        }}
      />
    </div>
  );
}
