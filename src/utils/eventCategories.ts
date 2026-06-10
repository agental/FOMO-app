export interface EventCategoryConfig {
  color: string;
  label: string;
  emoji: string;
}

export const eventCategories: Record<string, EventCategoryConfig> = {
  parties: {
    color: '#A855F7',   // purple
    label: 'מסיבות',
    emoji: '🎉',
  },
  sports: {
    color: '#0EA5E9',   // sky blue
    label: 'אטרקציות',
    emoji: '🎡',
  },
  treks: {
    color: '#22C55E',   // green
    label: 'טרקים',
    emoji: '🏕️',
  },
  workshops: {
    color: '#FACC15',   // sun yellow
    label: 'סדנאות',
    emoji: '🧘',
  },
};

export function getCategoryColor(eventType: string): string {
  return eventCategories[eventType]?.color || '#6B7280'; // gray default
}

export function getCategoryEmoji(eventType: string): string {
  return eventCategories[eventType]?.emoji || '📍';
}

export function getCategoryLabel(eventType: string): string {
  return eventCategories[eventType]?.label || eventType;
}
