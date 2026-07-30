/*
  Tracks which conversation/group is currently open, so the global notification
  listener doesn't buzz the user for messages in the chat they're already looking at.
  Chat screens call setActiveChat(id) on mount and setActiveChat(null) on unmount.
*/
let activeChatId: string | null = null;

export function setActiveChat(id: string | null) {
  activeChatId = id;
}

export function getActiveChat(): string | null {
  return activeChatId;
}
