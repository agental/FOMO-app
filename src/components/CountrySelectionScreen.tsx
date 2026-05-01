import { useState } from 'react';
import { Search, Check, ArrowRight } from 'lucide-react';
import { COUNTRIES } from '../utils/countries';
import { CONTINENTS, getContinentForCountry } from '../utils/continents';

interface CountrySelectionScreenProps {
  selectedCountries: Set<string>;
  onToggleCountry: (code: string) => void;
  onContinue: () => void;
  onBack?: () => void;
}

export function CountrySelectionScreen({
  selectedCountries,
  onToggleCountry,
  onContinue,
  onBack,
}: CountrySelectionScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContinent, setSelectedContinent] = useState<keyof typeof CONTINENTS>('all');

  const filteredCountries = Object.entries(COUNTRIES).filter(([code, country]) => {
    const matchesSearch =
      searchQuery === '' ||
      country.name.includes(searchQuery) ||
      code.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesContinent =
      selectedContinent === 'all' || getContinentForCountry(code) === selectedContinent;

    return matchesSearch && matchesContinent;
  });

  const popularCountries = ['IL', 'TH', 'IN', 'US', 'ES', 'IT', 'GR', 'TR'];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F7FB] to-[#E8EAF6] flex flex-col overflow-x-hidden max-w-full" dir="rtl">
      <div className="bg-gradient-to-tr from-[#FF512F] to-[#DD2476] text-white p-6 rounded-b-3xl shadow-lg sticky top-0 z-10">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium mb-4 active:scale-95 transition-all"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            <ArrowRight className="w-4 h-4" />
            חזרה
          </button>
        )}
        <h2
          className="text-3xl font-bold mb-2 text-center"
          style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
        >
          באילו מדינות אתם מטיילים?
        </h2>
        <p className="text-white/90 text-sm text-center mb-4" style={{ fontFamily: 'Rubik, sans-serif' }}>
          בחרו את המדינות שבהן תרצו להכיר מטיילים אחרים
        </p>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש מדינה..."
            className="w-full bg-white rounded-full h-10 pr-10 pl-4 text-sm text-[#0A122A] placeholder:text-gray-400 focus:ring-2 focus:ring-white/50 focus:outline-none transition-all"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          />
        </div>

        <div className="flex gap-2 mt-4 overflow-x-auto pb-2 hide-scrollbar">
          {Object.entries(CONTINENTS).map(([key, continent]) => (
            <button
              key={key}
              onClick={() => setSelectedContinent(key as keyof typeof CONTINENTS)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                selectedContinent === key
                  ? 'bg-white text-[#DD2476] shadow-md'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              <span className="ml-1">{continent.emoji}</span>
              {continent.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-4 pb-24 overflow-y-auto">
        {searchQuery === '' && selectedContinent === 'all' && (
          <div className="mb-6">
            <h3
              className="text-lg font-bold text-[#0A122A] mb-3"
              style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
            >
              🔥 מדינות פופולריות
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {popularCountries.map((code) => {
                const country = COUNTRIES[code];
                if (!country) return null;
                const isSelected = selectedCountries.has(code);
                return (
                  <button
                    key={code}
                    onClick={() => onToggleCountry(code)}
                    className={`relative flex items-center gap-3 p-4 rounded-xl transition-all border-2 ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-[#3B82F6] shadow-md scale-105'
                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <span className="text-3xl">{country.flag}</span>
                    <span
                      className={`text-sm font-medium flex-1 text-right ${
                        isSelected ? 'text-[#1E40AF]' : 'text-gray-700'
                      }`}
                      style={{ fontFamily: 'Rubik, sans-serif' }}
                    >
                      {country.name}
                    </span>
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          {searchQuery === '' && selectedContinent === 'all' && (
            <h3
              className="text-lg font-bold text-[#0A122A] mb-3"
              style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
            >
              כל המדינות
            </h3>
          )}
          <div className="grid grid-cols-2 gap-3">
            {filteredCountries.map(([code, country]) => {
              if (searchQuery === '' && selectedContinent === 'all' && popularCountries.includes(code)) {
                return null;
              }
              const isSelected = selectedCountries.has(code);
              return (
                <button
                  key={code}
                  onClick={() => onToggleCountry(code)}
                  className={`relative flex items-center gap-3 p-3 rounded-xl transition-all border-2 ${
                    isSelected
                      ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-[#3B82F6] shadow-md'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-2xl">{country.flag}</span>
                  <span
                    className={`text-sm font-medium flex-1 text-right ${
                      isSelected ? 'text-[#1E40AF]' : 'text-gray-700'
                    }`}
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {country.name}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={onContinue}
          disabled={selectedCountries.size === 0}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl h-12 font-bold shadow-lg hover:shadow-xl transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
        >
          המשך ({selectedCountries.size} מדינות נבחרו)
        </button>
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
