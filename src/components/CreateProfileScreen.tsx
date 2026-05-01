import { useState } from 'react';
import { User, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';

interface CreateProfileScreenProps {
  userId: string;
  onComplete: () => void;
}

export function CreateProfileScreen({ userId, onComplete }: CreateProfileScreenProps) {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [currentCountry, setCurrentCountry] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [languageInput, setLanguageInput] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [interestInput, setInterestInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addLanguage = () => {
    if (languageInput.trim() && !languages.includes(languageInput.trim())) {
      setLanguages([...languages, languageInput.trim()]);
      setLanguageInput('');
    }
  };

  const removeLanguage = (lang: string) => {
    setLanguages(languages.filter(l => l !== lang));
  };

  const addInterest = () => {
    if (interestInput.trim() && !interests.includes(interestInput.trim())) {
      setInterests([...interests, interestInput.trim()]);
      setInterestInput('');
    }
  };

  const removeInterest = (interest: string) => {
    setInterests(interests.filter(i => i !== interest));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: authUser?.email ?? '',
          display_name: displayName,
          bio: bio || null,
          age: age ? parseInt(age) : null,
          current_country: currentCountry || null,
          languages: languages.length > 0 ? languages : null,
          interests: interests.length > 0 ? interests : null,
          profile_completed: true,
          selected_countries: [],
          is_location_shared: false,
          role: 'user',
        });

      if (error) throw error;

      onComplete();
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FB] overflow-x-hidden max-w-full" dir="rtl">
      <div className="bg-gradient-to-tr from-[#FF512F] to-[#DD2476] text-white p-6 text-center rounded-b-3xl shadow-lg sticky top-0 z-10">
        <div className="flex items-center justify-center mb-4">
          <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
            <User className="w-10 h-10 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
          צור את הפרופיל שלך
        </h1>
        <p className="text-white/90 text-sm" style={{ fontFamily: 'Rubik, sans-serif' }}>
          ספר לנו עליך כדי שנוכל לחבר אותך למטיילים אחרים
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-4 space-y-4 pb-24">
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#0A122A] mb-4" style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
            מידע בסיסי
          </h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
              שם לתצוגה *
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              style={{ fontFamily: 'Rubik, sans-serif' }}
              placeholder="איך תרצה שיקראו לך?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
              תיאור אישי
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
              style={{ fontFamily: 'Rubik, sans-serif' }}
              placeholder="ספר קצת על עצמך ועל חוויות הטיול שלך..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
              גיל
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min="1"
              max="120"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              style={{ fontFamily: 'Rubik, sans-serif' }}
              placeholder="הגיל שלך"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
              מדינה נוכחית
            </label>
            <select
              value={currentCountry}
              onChange={(e) => setCurrentCountry(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              <option value="">בחר מדינה</option>
              {Object.entries(COUNTRIES).map(([code, country]) => (
                <option key={code} value={code}>
                  {country.flag} {country.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#0A122A] mb-4" style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
            שפות
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={languageInput}
              onChange={(e) => setLanguageInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLanguage();
                }
              }}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              style={{ fontFamily: 'Rubik, sans-serif' }}
              placeholder="הוסף שפה (לדוגמה: עברית, אנגלית)"
            />
            <button
              type="button"
              onClick={addLanguage}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {languages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {languages.map((lang) => (
                <span
                  key={lang}
                  className="px-3 py-2 bg-[#60A5FA]/10 text-[#1E40AF] rounded-full text-sm font-medium flex items-center gap-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  {lang}
                  <button
                    type="button"
                    onClick={() => removeLanguage(lang)}
                    className="hover:bg-red-100 rounded-full p-0.5 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 space-y-4">
          <h2 className="text-lg font-bold text-[#0A122A] mb-4" style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}>
            תחומי עניין
          </h2>

          <div className="flex gap-2">
            <input
              type="text"
              value={interestInput}
              onChange={(e) => setInterestInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addInterest();
                }
              }}
              className="flex-1 px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              style={{ fontFamily: 'Rubik, sans-serif' }}
              placeholder="הוסף תחום עניין (לדוגמה: טיולים, אוכל)"
            />
            <button
              type="button"
              onClick={addInterest}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {interests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <span
                  key={interest}
                  className="px-3 py-2 bg-[#60A5FA]/10 text-[#1E40AF] rounded-full text-sm font-medium flex items-center gap-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  {interest}
                  <button
                    type="button"
                    onClick={() => removeInterest(interest)}
                    className="hover:bg-red-100 rounded-full p-0.5 transition-all"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {error}
          </div>
        )}
      </form>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleSubmit}
          disabled={loading || !displayName}
          className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl h-12 font-bold shadow-lg hover:shadow-xl transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
        >
          {loading ? 'שומר...' : 'המשך'}
        </button>
      </div>
    </div>
  );
}
