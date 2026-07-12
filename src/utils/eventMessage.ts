/**
 * Encodes a shared event inside a chat message's text content (no schema change),
 * so the chat can render it as a clickable event card. Uses a rare invisible
 * marker (U+2064) so it never collides with normal text or the reply marker (U+2063).
 * A plain-text fallback is appended for any client that doesn't parse it.
 */
import { parsePlace } from './placeMessage';

const EVT = '⁤';
const PREFIX = `${EVT}EVT`;

export type EventPayload = {
  id: string;
  title: string;
  city?: string | null;
  country?: string | null;
  date?: string | null;
  emoji?: string | null;
  image?: string | null;
};

export function encodeEvent(p: EventPayload, fallback: string): string {
  return `${PREFIX}${JSON.stringify(p)}${EVT}${fallback}`;
}

export function parseEvent(content: string | null): { event: EventPayload | null; body: string } {
  if (!content || !content.startsWith(PREFIX)) return { event: null, body: content ?? '' };
  const sep = content.indexOf(EVT, PREFIX.length);
  if (sep === -1) return { event: null, body: content };
  try {
    return { event: JSON.parse(content.slice(PREFIX.length, sep)), body: content.slice(sep + 1) };
  } catch {
    return { event: null, body: content };
  }
}

const REPLY_SEP = '⁣'; // matches CityGroupChat's reply marker (U+2063)

const SYS_MARK = '⁡'; // matches CityGroupChat's system-notice marker (U+2061)

/** Clean one-line preview for chat lists — strips event/reply/system markers, never shows raw payload. */
export function messagePreview(content: string | null, type?: string | null): string {
  if (content && content.startsWith(SYS_MARK)) return content.slice(SYS_MARK.length); // "X left the group"
  if (type === 'image') return '📷 תמונה';
  if (type === 'location') return '📍 מיקום';
  const { event } = parseEvent(content);
  if (event) return `📅 שיתף אירוע: ${event.title}`;
  const { place } = parsePlace(content);
  if (place) return `${place.emoji || '📍'} שיתף מקום: ${place.name}`;
  // Strip a reply quote prefix if present
  let c = content ?? '';
  if (c[0] === REPLY_SEP) {
    const end = c.indexOf(REPLY_SEP, 1);
    if (end !== -1) c = c.slice(end + 1);
  }
  return c;
}
