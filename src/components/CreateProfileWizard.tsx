import { useState, useRef, useEffect } from 'react';
import { User, Heart, ArrowRight, ArrowLeft, Check, Camera, Sparkles, CircleUser as UserCircle2, Cake, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import { SUGGESTED_LANGUAGES, SUGGESTED_INTERESTS } from '../utils/suggestions';

interface CreateProfileWizardProps {
  userId: string;
  onComplete: () => void;
}

const STEPS = [
  { id: 1, title: 'פרטים בסיסיים', icon: User },
  { id: 2, title: 'תחומי עניין', icon: Heart },
  { id: 3, title: 'סיום', icon: Check },
];

export function CreateProfileWizard({ userId, onComplete }: CreateProfileWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [age, setAge] = useState('');
  const [instagram, setInstagram] = useState('');

  const [currentCountry, setCurrentCountry] = useState('');
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLanguage, setCustomLanguage] = useState('');

  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState('');

  const MAX_BIO_LENGTH = 150;

  useEffect(() => {
    if (currentStep === 3 && !currentCountry) {
      detectUserLocation();
    }
  }, [currentStep]);

  const toggleLanguage = (lang: string) => {
    setLanguages(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const addCustomLanguage = () => {
    if (customLanguage.trim() && !languages.includes(customLanguage.trim())) {
      setLanguages([...languages, customLanguage.trim()]);
      setCustomLanguage('');
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest.trim() && !interests.includes(customInterest.trim())) {
      setInterests([...interests, customInterest.trim()]);
      setCustomInterest('');
    }
  };

  const detectUserLocation = async () => {
    if (!navigator.geolocation) {
      console.log('Geolocation is not supported');
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;

          const response = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );

          if (!response.ok) throw new Error('Failed to fetch location');

          const data = await response.json();
          const countryCode = data.countryCode;

          if (countryCode && COUNTRIES[countryCode]) {
            setCurrentCountry(countryCode);
          }
        } catch (err) {
          console.error('Location detection error:', err);
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsDetectingLocation(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('נא להעלות קובץ תמונה בלבד');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('התמונה גדולה מדי. גודל מקסימלי: 5MB');
      return;
    }

    setError(null);
    setIsUploadingImage(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      setAvatarUrl(publicUrl);

      await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const canContinue = () => {
    if (currentStep === 1) return displayName.trim().length > 0;
    if (currentStep === 2) return interests.length > 0;
    if (currentStep === 3) return languages.length > 0;
    return false;
  };

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      console.log('Saving profile data:', {
        avatar_url: avatarUrl,
        display_name: displayName,
        bio: bio || null,
        age: age ? parseInt(age) : null,
        current_country: currentCountry || null,
        languages: languages.length > 0 ? languages : [],
        interests: interests.length > 0 ? interests : [],
        instagram: instagram || null,
        profile_completed: true,
      });

      const { data: { user: authUser } } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('users')
        .upsert({
          id: userId,
          email: authUser?.email ?? '',
          avatar_url: avatarUrl,
          display_name: displayName,
          bio: bio || null,
          age: age ? parseInt(age) : null,
          current_country: currentCountry || null,
          languages: languages.length > 0 ? languages : [],
          interests: interests.length > 0 ? interests : [],
          instagram: instagram || null,
          profile_completed: true,
          selected_countries: [],
          is_location_shared: false,
          role: 'user',
        })
        .select();

      console.log('Update result:', { data, error });
      if (error) {
        console.error('Upsert error JSON:', JSON.stringify(error));
        throw error;
      }

      onComplete();
    } catch (err: any) {
      const msg = err?.message || err?.error_description || JSON.stringify(err);
      console.error('Profile save error:', msg);
      setError(msg || 'אירעה שגיאה בשמירת הפרופיל');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F8F9FB] to-[#F0F2F7] overflow-x-hidden max-w-full" dir="rtl">
      <div className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-10 border-b border-gray-100">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-6">
            <span
              className="text-sm font-medium text-[#6B7280]"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              שלב {currentStep} מתוך {STEPS.length}
            </span>
          </div>

          <div className="flex items-center gap-3 mb-2">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-2 flex-1">
                  <div className="flex items-center w-full">
                    {index > 0 && (
                      <div className={`h-0.5 flex-1 transition-all duration-300 ${
                        step.id <= currentStep ? 'bg-[#14B8A6]' : 'bg-gray-200'
                      }`} />
                    )}
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 ${
                      step.id <= currentStep
                        ? 'bg-gradient-to-br from-[#14B8A6] to-[#0D9488] text-white shadow-md'
                        : 'bg-gray-200 text-gray-400'
                    } ${step.id === currentStep ? 'ring-4 ring-brand-100' : ''}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 transition-all duration-300 ${
                        step.id < currentStep ? 'bg-[#14B8A6]' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                  <span className={`text-xs font-medium transition-colors ${
                    step.id === currentStep ? 'text-[#14B8A6]' : 'text-gray-500'
                  }`} style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {step.title}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 pb-32">
        {currentStep === 1 && (
          <div className="space-y-6 animate-slide-in">
            <div className="text-center mb-8 mt-4">
              <div className="flex items-center justify-center gap-2 mb-3">
                <h1
                  className="text-3xl font-bold text-[#1F2937]"
                  style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
                >
                  בוא נבנה את הפרופיל שלך
                </h1>
                <Sparkles className="w-6 h-6 text-[#0D9488]" />
              </div>
              <p
                className="text-base text-[#6B7280] max-w-md mx-auto"
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                תמונה טובה ותיאור קצר יעזרו לאנשים להכיר אותך
              </p>
            </div>

            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="relative group">
                {avatarUrl ? (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#14B8A6] to-[#0D9488] p-1 shadow-lg">
                    <img
                      src={avatarUrl}
                      alt="Profile"
                      className="w-full h-full rounded-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#14B8A6]/10 to-[#0D9488]/10 p-1 shadow-md border-2 border-dashed border-[#14B8A6]/30">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center">
                      <Camera className="w-12 h-12 text-[#14B8A6]/40" />
                    </div>
                  </div>
                )}

                {isUploadingImage && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="absolute -bottom-1 -left-1 w-10 h-10 bg-gradient-to-br from-[#14B8A6] to-[#0D9488] rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="text-sm font-medium text-[#14B8A6] hover:text-[#3D5FD9] transition-colors disabled:opacity-50"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  {avatarUrl ? 'שנה תמונה' : 'העלה תמונה'}
                </button>
                <p
                  className="text-xs text-[#9CA3AF] mt-1"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  תמונה ברורה תעזור לאנשים אחרים להכיר אותך
                </p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  <UserCircle2 className="w-4 h-4 text-[#14B8A6]" />
                  שם התצוגה
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all bg-gray-50 focus:bg-white text-[#1F2937]"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                  placeholder="איך אנשים יכירו אותך?"
                />
                <p
                  className="text-xs text-[#9CA3AF] mt-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  השם הזה יופיע בפרופיל שלך
                </p>
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-[#374151] mb-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  עליי
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => {
                    if (e.target.value.length <= MAX_BIO_LENGTH) {
                      setBio(e.target.value);
                    }
                  }}
                  rows={4}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all resize-none bg-gray-50 focus:bg-white text-[#1F2937]"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                  placeholder="ספר בקצרה מי אתה, מה הווייב שלך ומה אתה מחפש..."
                />
                <div className="flex justify-between items-center mt-2">
                  <p
                    className="text-xs text-[#9CA3AF]"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    תיאור קצר ומעניין
                  </p>
                  <span
                    className={`text-xs font-medium ${
                      bio.length >= MAX_BIO_LENGTH ? 'text-[#EF4444]' : 'text-[#9CA3AF]'
                    }`}
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {bio.length}/{MAX_BIO_LENGTH}
                  </span>
                </div>
              </div>

              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  <Cake className="w-4 h-4 text-[#14B8A6]" />
                  גיל
                </label>
                <select
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all bg-gray-50 focus:bg-white text-[#1F2937]"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  <option value="">בן כמה אתה?</option>
                  {Array.from({ length: 63 }, (_, i) => i + 18).map(ageOption => (
                    <option key={ageOption} value={ageOption}>
                      {ageOption}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="flex items-center gap-2 text-sm font-semibold text-[#374151] mb-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  <span className="text-lg">📷</span>
                  חשבון אינסטגרם
                  <span className="text-xs text-[#9CA3AF] font-normal">(אופציונלי)</span>
                </label>
                <div className="relative">
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] font-medium">@</span>
                  <input
                    type="text"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value.replace('@', ''))}
                    className="w-full pr-10 pl-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all bg-gray-50 focus:bg-white text-[#1F2937]"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                    placeholder="username_שלך"
                  />
                </div>
                <p
                  className="text-xs text-[#9CA3AF] mt-2"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  משתמשים אחרים יוכלו להתחבר אליך דרך אינסטגרם
                </p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6 animate-slide-in">
            <div className="text-center mb-8 mt-4">
              <h1
                className="text-3xl font-bold text-[#1F2937] mb-3"
                style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
              >
                מה מעניין אותך?
              </h1>
              <p
                className="text-base text-[#6B7280] max-w-md mx-auto"
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                תחומי עניין משותפים יעזרו למצוא מטיילים מתאימים
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-4">
              <label
                className="block text-sm font-semibold text-[#374151] mb-3"
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                בחר תחומי עניין ({interests.length} נבחרו)
              </label>

              <div className="flex flex-wrap gap-2 mb-4">
                {SUGGESTED_INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    onClick={() => toggleInterest(interest)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                      interests.includes(interest)
                        ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white shadow-md scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                    }`}
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    {interest}
                  </button>
                ))}
              </div>

              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={customInterest}
                  onChange={(e) => setCustomInterest(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomInterest();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                  placeholder="הוסף תחום עניין נוסף..."
                />
                <button
                  type="button"
                  onClick={addCustomInterest}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white rounded-2xl hover:shadow-md transition-all text-sm font-medium active:scale-95"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  הוסף
                </button>
              </div>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6 animate-slide-in">
            <div className="text-center mb-8 mt-4">
              <h1
                className="text-3xl font-bold text-[#1F2937] mb-3"
                style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
              >
                כמעט סיימנו!
              </h1>
              <p
                className="text-base text-[#6B7280] max-w-md mx-auto"
                style={{ fontFamily: 'Rubik, sans-serif' }}
              >
                עוד כמה פרטים ונוכל להתחיל
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    className="flex items-center gap-2 text-sm font-semibold text-[#374151]"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    <MapPin className="w-4 h-4 text-[#14B8A6]" />
                    מדינה נוכחית
                  </label>
                  {isDetectingLocation && (
                    <span className="text-xs text-[#14B8A6] flex items-center gap-1">
                      <div className="w-3 h-3 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin" />
                      מזהה מיקום...
                    </span>
                  )}
                </div>
                <select
                  value={currentCountry}
                  onChange={(e) => setCurrentCountry(e.target.value)}
                  disabled={isDetectingLocation}
                  className="w-full px-4 py-3.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all bg-gray-50 focus:bg-white disabled:opacity-50 disabled:cursor-wait"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  <option value="">בחר מדינה</option>
                  {Object.entries(COUNTRIES).map(([code, country]) => (
                    <option key={code} value={code}>
                      {country.flag} {country.name}
                    </option>
                  ))}
                </select>
                {currentCountry && !isDetectingLocation && (
                  <p
                    className="text-xs text-[#10B981] mt-2 flex items-center gap-1"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    <Check className="w-3 h-3" />
                    המדינה זוהתה אוטומטית לפי המיקום שלך
                  </p>
                )}
              </div>

              <div>
                <label
                  className="block text-sm font-semibold text-[#374151] mb-3"
                  style={{ fontFamily: 'Rubik, sans-serif' }}
                >
                  שפות שאתה מדבר ({languages.length} נבחרו)
                </label>

                <div className="flex flex-wrap gap-2 mb-4">
                  {SUGGESTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                        languages.includes(lang)
                          ? 'bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white shadow-md scale-105'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                      }`}
                      style={{ fontFamily: 'Rubik, sans-serif' }}
                    >
                      {lang}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customLanguage}
                    onChange={(e) => setCustomLanguage(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomLanguage();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-[#14B8A6]/20 focus:border-[#14B8A6] outline-none transition-all text-sm bg-gray-50 focus:bg-white"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                    placeholder="הוסף שפה נוספת..."
                  />
                  <button
                    type="button"
                    onClick={addCustomLanguage}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white rounded-2xl hover:shadow-md transition-all text-sm font-medium active:scale-95"
                    style={{ fontFamily: 'Rubik, sans-serif' }}
                  >
                    הוסף
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mt-4"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            {error}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-5 bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-2xl">
        <div className="flex flex-col gap-3 max-w-md mx-auto">
          <div className="flex gap-3">
            {currentStep > 1 && (
              <button
                onClick={handleBack}
                className="px-6 h-14 bg-gray-100 text-gray-700 rounded-2xl font-semibold hover:bg-gray-200 transition-all flex items-center gap-2 active:scale-95"
                style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 600 }}
              >
                <ArrowLeft className="w-5 h-5" />
                חזור
              </button>
            )}

            <button
              onClick={handleNext}
              disabled={!canContinue() || loading}
              className="flex-1 h-14 bg-gradient-to-r from-[#14B8A6] to-[#0D9488] text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2"
              style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>שומר...</span>
                </div>
              ) : currentStep < STEPS.length ? (
                <>
                  <span>המשך</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              ) : (
                <>
                  <span>סיים</span>
                  <Check className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          <p
            className="text-xs text-center text-[#9CA3AF]"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            🔒 המידע שלך נשמר בצורה מאובטחת
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        .animate-slide-in {
          animation: slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}
