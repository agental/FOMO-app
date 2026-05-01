interface InterestTagProps {
  interest: string;
}

const interestIcons: Record<string, string> = {
  'parties': '🎉',
  'treks': '🏕️',
  'food': '🍔',
  'sports': '🏄',
  'workshops': '🧘',
  'foodie': '🍜',
  'cocktails': '🍹',
  'cocktail bars': '🍹',
  'clubbing': '💃',
  'nightlife': '🌙',
  'culture': '🌍',
  'adventure': '🗺️',
  'beach': '🏖️',
  'music': '🎵',
  'art': '🎨',
  'hiking': '🥾',
  'travel': '✈️',
  'gaming': '🎮',
  'reading': '📚',
  'cooking': '👨‍🍳',
};

export function InterestTag({ interest }: InterestTagProps) {
  const lowerInterest = interest.toLowerCase();
  const icon = interestIcons[lowerInterest] || '✨';

  return (
    <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-50 to-brand-100 rounded-full border border-brand-100">
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
        {interest}
      </span>
    </div>
  );
}
