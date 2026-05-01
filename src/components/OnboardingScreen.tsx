import { useState } from 'react';
import { Globe, Users, MapPin, Sparkles, ArrowRight } from 'lucide-react';

interface OnboardingScreenProps {
  onComplete: () => void;
}

const slides = [
  {
    icon: Globe,
    title: 'ברוכים הבאים להטיול הגדול',
    description: 'הרשת החברתית שמחברת בין מטיילים ישראלים בכל מקום בעולם',
    gradient: 'from-[#FF512F] to-[#DD2476]',
  },
  {
    icon: Users,
    title: 'מצא חברים לטיול',
    description: 'הכר מטיילים אחרים באותן מדינות, שתף חוויות והצטרף לאירועים',
    gradient: 'from-[#4776E6] to-[#8E54E9]',
  },
  {
    icon: MapPin,
    title: 'גלה אירועים ומפגשים',
    description: 'הצטרף לאירועים קרובים, צור מפגשים חדשים ובנה קהילה בכל יעד',
    gradient: 'from-[#11998e] to-[#38ef7d]',
  },
  {
    icon: Sparkles,
    title: 'התחל להתחבר',
    description: 'צור פרופיל, שתף את המסלול שלך והתחבר למטיילים ברחבי העולם',
    gradient: 'from-[#FA709A] to-[#FEE140]',
  },
];

export function OnboardingScreen({ onComplete }: OnboardingScreenProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const currentSlideData = slides[currentSlide];
  const Icon = currentSlideData.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col overflow-x-hidden max-w-full" dir="rtl">
      <div className="flex justify-end p-4">
        {currentSlide < slides.length - 1 && (
          <button
            onClick={handleSkip}
            className="text-gray-500 hover:text-gray-700 font-medium text-sm transition-colors"
            style={{ fontFamily: 'Rubik, sans-serif' }}
          >
            דלג
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div
          key={currentSlide}
          className="w-full max-w-md space-y-8 animate-fade-in"
        >
          <div className="flex justify-center">
            <div
              className={`w-32 h-32 rounded-full bg-gradient-to-tr ${currentSlideData.gradient} flex items-center justify-center shadow-2xl transform transition-all duration-500 hover:scale-110`}
              style={{
                animation: 'float 3s ease-in-out infinite',
              }}
            >
              <Icon className="w-16 h-16 text-white" strokeWidth={2} />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h1
              className="text-5xl font-black text-white drop-shadow-2xl animate-fade-in mb-2"
              style={{ fontFamily: 'Righteous, cursive', letterSpacing: '0.15em' }}
            >
              FOMO
            </h1>
            <h2
              className="text-3xl font-bold text-[#0A122A] leading-tight"
              style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
            >
              {currentSlideData.title}
            </h2>
            <p
              className="text-lg text-gray-600 leading-relaxed"
              style={{ fontFamily: 'Rubik, sans-serif' }}
            >
              {currentSlideData.description}
            </p>
          </div>

          <div className="flex justify-center gap-2 pt-4">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? 'w-8 bg-gradient-to-r ' + currentSlideData.gradient
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`עבור לשקופית ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white border-t border-gray-200 shadow-lg">
        <button
          onClick={handleNext}
          className={`w-full h-14 bg-gradient-to-r ${currentSlideData.gradient} text-white rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-98 flex items-center justify-center gap-2`}
          style={{ fontFamily: 'Heebo, sans-serif', fontWeight: 700 }}
        >
          <span>{currentSlide < slides.length - 1 ? 'המשך' : 'בוא נתחיל!'}</span>
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
