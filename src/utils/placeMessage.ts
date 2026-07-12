/**
 * Encodes a shared place inside a chat message's text content (no schema change) so the chat can
 * render it as a map card. Same trick as `eventMessage.ts` — a rare invisible marker, here U+2062,
 * chosen so it can't collide with the event (U+2064), reply (U+2063) or system (U+2061) markers.
 * A plain-text fallback is appended for any client that doesn't parse it.
 */
const PLC = '⁢';
const PREFIX = `${PLC}PLC`;

export type PlacePayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  emoji?: string | null;
  color?: string | null;
  address?: string | null;
};

export function encodePlace(p: PlacePayload, fallback: string): string {
  return `${PREFIX}${JSON.stringify(p)}${PLC}${fallback}`;
}

export function parsePlace(content: string | null): { place: PlacePayload | null; body: string } {
  if (!content || !content.startsWith(PREFIX)) return { place: null, body: content ?? '' };
  const sep = content.indexOf(PLC, PREFIX.length);
  if (sep === -1) return { place: null, body: content };
  try {
    return { place: JSON.parse(content.slice(PREFIX.length, sep)), body: content.slice(sep + 1) };
  } catch {
    return { place: null, body: content };
  }
}
