/* Inline reply encoding (no DB schema change): a quoted reply is stored at the
   START of the message content, wrapped by an invisible separator so it never
   collides with real text. This is the exact format the group chats already use,
   so a quoted reply renders identically across every chat. */
export const REPLY_SEP = '⁣'; // INVISIBLE SEPARATOR (U+2063)

export type ReplyMeta = { n: string; t: string }; // n = quoted sender's name, t = short snippet

export function encodeReply(name: string, snippet: string, body: string): string {
  return `${REPLY_SEP}${JSON.stringify({ n: name, t: snippet })}${REPLY_SEP}${body}`;
}

export function parseReply(content: string | null | undefined): { reply: ReplyMeta | null; body: string } {
  if (!content || content[0] !== REPLY_SEP) return { reply: null, body: content ?? '' };
  const end = content.indexOf(REPLY_SEP, 1);
  if (end === -1) return { reply: null, body: content };
  try {
    return { reply: JSON.parse(content.slice(1, end)) as ReplyMeta, body: content.slice(end + 1) };
  } catch {
    return { reply: null, body: content };
  }
}
