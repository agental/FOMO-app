import { Fragment, useEffect, useState } from 'react';
import { msUntilLaunch, type LaunchState } from '../../services/launchService';

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Heebo, sans-serif";
const INK = '#111827';
const SECONDARY = '#6E6E73'; // Apple's secondaryLabel

/**
 * Server-anchored countdown — ONE unified native-system component (not floating cards): large tabular
 * numerals with thin ":" separators, on an almost-invisible glass surface. No glow, no heavy shadow —
 * reads like a system control, not a promo element. Ticks every second off the LaunchState's
 * MONOTONIC clock (device-clock tamper-proof). Shows "בקרוב" when there's no date yet; fires
 * onComplete at zero.
 */
export function CountdownTimer({ state, onComplete }: { state: LaunchState; onComplete: () => void }) {
  const [remaining, setRemaining] = useState<number | null>(() => msUntilLaunch(state));

  useEffect(() => {
    const tick = () => {
      const ms = msUntilLaunch(state);
      setRemaining(ms);
      if (ms != null && ms <= 0) onComplete();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.launchAtMs, state.serverNowMs]);

  if (remaining == null) {
    return (
      <div style={{ fontFamily: SF, fontWeight: 700, fontSize: 28, color: INK, letterSpacing: '-0.3px', textAlign: 'center' }}>
        בקרוב מאוד <span style={{ color: '#F97316' }}>✦</span>
      </div>
    );
  }

  const totalSec = Math.floor(remaining / 1000);
  const units: Array<[number, string]> = [
    [Math.floor(totalSec / 86400), 'ימים'],
    [Math.floor((totalSec % 86400) / 3600), 'שעות'],
    [Math.floor((totalSec % 3600) / 60), 'דקות'],
    [totalSec % 60, 'שניות'],
  ];

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 24,
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(60,60,67,0.08)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
        padding: '22px 8px 18px',
      }}
    >
      <div dir="ltr" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        {units.map(([val, label], i) => (
          <Fragment key={label}>
            {i > 0 && (
              <div style={{ height: 46, display: 'flex', alignItems: 'center', padding: '0 3px' }}>
                <span style={{ fontFamily: SF, fontWeight: 300, fontSize: 26, color: 'rgba(60,60,67,0.25)', lineHeight: 1 }}>:</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 62 }}>
              <span
                style={{
                  fontFamily: SF, fontWeight: 700, fontSize: 42, lineHeight: '46px',
                  color: INK, fontVariantNumeric: 'tabular-nums', letterSpacing: '-1px',
                }}
              >
                {String(val).padStart(2, '0')}
              </span>
              <span style={{ fontFamily: SF, fontWeight: 500, fontSize: 11.5, marginTop: 6, color: SECONDARY, letterSpacing: '0.2px' }}>
                {label}
              </span>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
