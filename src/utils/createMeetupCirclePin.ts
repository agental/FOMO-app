import { emojiColor } from './emojiColor';

/**
 * Meetup ("ציוץ") map pin — the SAME circle design as the meetup chat row in the Messages list:
 * a round tile tinted by the emoji's colour, an inset coloured ring (the "frame" the user loved),
 * a soft coloured glow, and the chosen emoji centred. No avatar. Shared by the map (mapPinDom) and
 * the create-meetup preview so they always match.
 */
export function createMeetupCirclePin(emoji: string, size = 44): HTMLElement {
  const e = emoji || '☕';
  const color = emojiColor(e);
  const el = document.createElement('div');
  el.style.cssText = [
    `width:${size}px`, `height:${size}px`, 'border-radius:50%',
    `background:${color}1F`,
    'display:flex', 'align-items:center', 'justify-content:center',
    `box-shadow:inset 0 0 0 2.5px ${color}, 0 2px 8px ${color}40, 0 2px 6px rgba(0,0,0,0.22)`,
    'line-height:0',
  ].join(';');
  const em = document.createElement('div');
  em.textContent = e;
  em.style.cssText = `font-size:${Math.round(size * 0.52)}px;line-height:1;user-select:none;`;
  el.appendChild(em);
  return el;
}
