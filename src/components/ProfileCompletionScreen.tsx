import { useEffect, useState } from 'react';
import { CircleCheck as CheckCircle2, Sparkles, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';

interface ProfileCompletionScreenProps {
  userId: string;
  onContinue: () => void;
}

export function ProfileCompletionScreen({ userId, onContinue }: ProfileCompletionScreenProps) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#F5F7FB] to-[#E8EAF6] flex items-center justify-center overflow-x-hidden max-w-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F7FB] to-[#E8EAF6] flex flex-col items-center justify-center p-6 overflow-x-hidden max-w-full" dir="rtl">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6 animate-bounce-in">
          <div className="w-24 h-24 bg-gradient-to-tr from-green-500 to-emerald-500 rounded-full flex items-center justify-center shadow-2xl">
            <CheckCircle2 className="w-14 h-14 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <div className="text-center mb-8 animate-fade-in">
          <h1
            className="text-4xl font-bold text-[#0A122A] mb-3"
            style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
          >
            כל הכבוד! 🎉
          </h1>
          <p
            className="text-lg text-gray-600"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            הפרופיל שלך הושלם בהצלחה
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 animate-slide-up">
          <div className="flex items-center gap-4 mb-6">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-4 border-blue-100"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {profile?.display_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <div className="flex-1">
              <h2
                className="text-2xl font-bold text-[#0A122A]"
                style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
              >
                {profile?.display_name}
              </h2>
              {profile?.age && (
                <p className="text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  גיל {profile.age}
                </p>
              )}
            </div>
          </div>

          {profile?.bio && (
            <div className="mb-4">
              <p className="text-gray-700 text-sm leading-relaxed" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {profile.bio}
              </p>
            </div>
          )}

          {profile?.current_country && (
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{COUNTRIES[profile.current_country]?.flag}</span>
              <span className="text-gray-700 text-sm" style={{ fontFamily: 'Rubik, sans-serif' }}>
                {COUNTRIES[profile.current_country]?.name}
              </span>
            </div>
          )}

          {profile?.languages && profile.languages.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                שפות:
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.languages.map((lang: string) => (
                  <span
                    key={lang}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}

          {profile?.interests && profile.interests.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2" style={{ fontFamily: 'Rubik, sans-serif' }}>
                תחומי עניין:
              </p>
              <div className="flex flex-wrap gap-2">
                {profile.interests.map((interest: string) => (
                  <span
                    key={interest}
                    className="px-3 py-1 bg-brand-50 text-brand-700 rounded-full text-xs font-medium"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-2xl p-6 mb-6 border-2 border-blue-200 animate-slide-up">
          <div className="flex items-start gap-3">
            <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
            <div>
              <h3
                className="text-lg font-bold text-[#0A122A] mb-2"
                style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
              >
                מה הלאה?
              </h3>
              <ul className="space-y-2 text-sm text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  בחר את המדינות שאתה מטייל בהן
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  חפש מטיילים אחרים במיקום שלך
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                  התחבר, שתף והצטרף לאירועים
                </li>
              </ul>
            </div>
          </div>
        </div>

        <button
          onClick={onContinue}
          className="w-full h-14 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2"
          style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
        >
          <span>בואו נתחיל!</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <style>{`
        @keyframes bounce-in {
          0% {
            opacity: 0;
            transform: scale(0.3);
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-bounce-in {
          animation: bounce-in 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
        }

        .animate-fade-in {
          animation: fade-in 0.8s ease-out 0.3s both;
        }

        .animate-slide-up {
          animation: slide-up 0.6s ease-out 0.5s both;
        }
      `}</style>
    </div>
  );
}
