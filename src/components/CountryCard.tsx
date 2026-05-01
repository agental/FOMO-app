interface CountryCardProps {
  countryCode: string;
  countryName: string;
  flagEmoji: string;
  isSelected: boolean;
  onClick: () => void;
}

export function CountryCard({
  countryCode,
  countryName,
  isSelected,
  onClick,
}: CountryCardProps) {
  const localFlags: Record<string, string> = {
    'lk': '/sri lanka.png',
  };

  const flagUrl = localFlags[countryCode.toLowerCase()] ||
                  `https://flagcdn.com/w160/${countryCode.toLowerCase()}.png`;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 flex-shrink-0 transition-all duration-300 active:scale-90 group"
    >
      <div
        className={`relative rounded-full flex items-center justify-center transition-all duration-300 ${
          isSelected
            ? 'w-20 h-20 bg-white p-[4px] shadow-2xl ring-4 ring-brand-200 scale-110'
            : 'w-[72px] h-[72px] bg-white p-[4px] shadow-lg hover:shadow-2xl hover:scale-105 hover:ring-4 hover:ring-brand-100'
        }`}
      >
        <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center bg-gray-50">
          <img
            src={flagUrl}
            alt={countryName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        {isSelected && (
          <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full border-3 border-white shadow-lg flex items-center justify-center">
            <span className="text-white text-base font-bold">✓</span>
          </div>
        )}
      </div>
      <span
        className={`text-sm font-semibold transition-all duration-300 text-center ${
          isSelected ? 'text-brand-700 scale-105' : 'text-gray-600 group-hover:text-brand-600'
        }`}
        style={{ fontFamily: 'Rubik, sans-serif' }}
      >
        {countryName}
      </span>
    </button>
  );
}
