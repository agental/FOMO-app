interface WorldMapProps {
  visitedCountries: string[];
}

export function WorldMap({ visitedCountries }: WorldMapProps) {
  const totalCountries = 195;
  const visitedCount = visitedCountries.length;
  const percentage = ((visitedCount / totalCountries) * 100).toFixed(1);

  return (
    <div className="bg-white rounded-2xl p-6 space-y-4">
      <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
        מדינות שביקרתי
      </h3>

      <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ paddingBottom: '56.25%' }}>
        <svg
          viewBox="0 0 800 450"
          className="absolute inset-0 w-full h-full"
          style={{ backgroundColor: '#f3f4f6' }}
        >
          <rect width="800" height="450" fill="#e5e7eb" />

          <g id="world-map">
            <path
              d="M 150 180 L 180 160 L 210 180 L 200 210 L 170 220 Z"
              fill={visitedCountries.includes('US') ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="200"
              cy="190"
              r="3"
              fill={visitedCountries.includes('US') ? '#dc2626' : '#9ca3af'}
            />

            <path
              d="M 400 180 L 430 170 L 450 190 L 440 220 L 410 225 Z"
              fill={visitedCountries.includes('IL') ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="425"
              cy="200"
              r="3"
              fill={visitedCountries.includes('IL') ? '#dc2626' : '#9ca3af'}
            />

            <path
              d="M 450 160 L 480 150 L 510 170 L 500 200 L 470 210 Z"
              fill={visitedCountries.includes('IN') ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="480"
              cy="180"
              r="3"
              fill={visitedCountries.includes('IN') ? '#dc2626' : '#9ca3af'}
            />

            <path
              d="M 380 150 L 410 140 L 430 160 L 420 185 L 390 190 Z"
              fill={visitedCountries.some(c => ['FR', 'ES', 'IT', 'DE'].includes(c)) ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="405"
              cy="165"
              r="3"
              fill={visitedCountries.some(c => ['FR', 'ES', 'IT', 'DE'].includes(c)) ? '#dc2626' : '#9ca3af'}
            />

            <path
              d="M 520 200 L 550 190 L 580 210 L 570 240 L 540 250 Z"
              fill={visitedCountries.includes('TH') ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="550"
              cy="220"
              r="3"
              fill={visitedCountries.includes('TH') ? '#dc2626' : '#9ca3af'}
            />

            <path
              d="M 280 280 L 310 270 L 340 290 L 330 320 L 300 330 Z"
              fill={visitedCountries.includes('BR') ? '#ef4444' : '#d1d5db'}
              stroke="#ffffff"
              strokeWidth="1"
            />
            <circle
              cx="310"
              cy="300"
              r="3"
              fill={visitedCountries.includes('BR') ? '#dc2626' : '#9ca3af'}
            />
          </g>

          <text x="400" y="435" textAnchor="middle" fontSize="12" fill="#6b7280" fontFamily="Rubik, sans-serif">
            ייצוג מפה סכמטי
          </text>
        </svg>
      </div>

      <div className="text-center space-y-2">
        <div className="text-5xl font-bold text-gray-900" style={{ fontFamily: 'Heebo, sans-serif' }}>
          {percentage}%
        </div>
        <p className="text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
          מהעולם שהתגלה
        </p>
        <p className="text-sm text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>
          {visitedCount} {visitedCount === 1 ? 'מדינה בוקרה' : 'מדינות בוקרו'}
        </p>
      </div>
    </div>
  );
}
