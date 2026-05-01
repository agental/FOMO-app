export interface EventCategoryConfig {
  color: string;
  label: string;
  emoji: string;
}

export const eventCategories: Record<string, EventCategoryConfig> = {
  parties: {
    color: '#14B8A6',
    label: 'מסיבות',
    emoji: '🎉',
  },
  food: {
    color: '#F97316',
    label: 'אוכל',
    emoji: '🍔',
  },
  sports: {
    color: '#0EA5E9',
    label: 'ספורט',
    emoji: '🏄',
  },
  treks: {
    color: '#22C55E',
    label: 'טרקים',
    emoji: '🏕️',
  },
  workshops: {
    color: '#D97706',
    label: 'סדנאות',
    emoji: '🧘',
  },
  yeshivot: {
    color: '#0D9488',
    label: 'ישיבות',
    emoji: '📖',
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
