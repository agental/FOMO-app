import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MapPin, Lock, Globe, Users, Image as ImageIcon, Upload, ChevronRight, ChevronLeft } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { EventService } from '../services/eventService';
import { reverseGeocode } from '../utils/geocoding';

interface MapCreateEventFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (createdEvent?: Record<string, any>) => void;
  userId: string;
  initialLocation?: { latitude: number; longitude: number };
  defaultCountry?: string;
}

type FlowStep = 1 | 2 | 3 | 4;

const EVENT_TYPES = [
  { id: 'parties', label: 'מסיבות', emoji: '🎉', color: '#14B8A6' },
  { id: 'food', label: 'אוכל', emoji: '🍔', color: '#F97316' },
  { id: 'sports', label: 'ספורט', emoji: '🏄', color: '#3B82F6' },
  { id: 'treks', label: 'טיולים', emoji: '🏕️', color: '#22C55E' },
  { id: 'workshops', label: 'סדנאות', emoji: '🧘', color: '#EAB308' },
  { id: 'yeshivot', label: 'ישיבות', emoji: '📖', color: '#0D9488' },
];

const EMOJI_BY_TYPE: Record<string, string[]> = {
  parties: ['🎉', '🥳', '🎊', '🪩', '🍾', '🎈', '🕺', '💃', '🎵', '🎶', '🥂', '✨'],
  food: ['🍔', '🍕', '🍜', '🍣', '🥗', '🍰', '☕', '🍺', '🥘', '🍱', '🌮', '🍦'],
  sports: ['🏄', '⚽', '🏀', '🎾', '🏊', '🚴', '🤸', '🧗', '🏋️', '⛷️', '🎿', '🏈'],
  treks: ['🏕️', '⛺', '🥾', '🏔️', '🌲', '🌄', '🌿', '🌊', '🦅', '🌅', '🗺️', '🧭'],
  workshops: ['🧘', '🎨', '📚', '💡', '🎸', '📷', '🖌️', '✂️', '🎭', '🪴', '🧪', '🛠️'],
  yeshivot: ['📖', '📚', '🕯️', '✡️', '🙏', '📜', '🕎', '🌟', '❤️', '🤝', '💫', '🕊️'],
};

const SUGGESTED_IMAGES: Record<string, string[]> = {
  parties: [
    'https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/787961/pexels-photo-787961.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/1540406/pexels-photo-1540406.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  food: [
    'https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/1567620/pexels-photo-1567620.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  sports: [
    'https://images.pexels.com/photos/46798/the-ball-stadion-football-the-pitch-46798.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/863988/pexels-photo-863988.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/248547/pexels-photo-248547.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  treks: [
    'https://images.pexels.com/photos/1365425/pexels-photo-1365425.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/417173/pexels-photo-417173.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/1526000/pexels-photo-1526000.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  workshops: [
    'https://images.pexels.com/photos/1181406/pexels-photo-1181406.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/373545/pexels-photo-373545.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
  yeshivot: [
    'https://images.pexels.com/photos/267559/pexels-photo-267559.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/415071/pexels-photo-415071.jpeg?auto=compress&cs=tinysrgb&w=400',
    'https://images.pexels.com/photos/301920/pexels-photo-301920.jpeg?auto=compress&cs=tinysrgb&w=400',
  ],
};

const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`);

function getNextDays(count: number): { label: string; value: string; day: string; num: number }[] {
  const result = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dayName = DAYS[d.getDay()];
    const dayNum = d.getDate();
    const month = d.getMonth() + 1;
    const value = d.toISOString().split('T')[0];
    result.push({ label: `${dayNum}/${month}`, value, day: i === 0 ? 'היום' : i === 1 ? 'מחר' : dayName, num: dayNum });
  }
  return result;
}

function createEventPinPreview(emoji: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="74" viewBox="0 0 64 74" style="filter:drop-shadow(0 4px 12px rgba(0,0,0,0.25))">
    <defs>
      <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color}" />
        <stop offset="100%" stop-color="${color}cc" />
      </linearGradient>
    </defs>
    <path d="M32 4C18.2 4 7 15.2 7 29C7 45 32 70 32 70C32 70 57 45 57 29C57 15.2 45.8 4 32 4Z" fill="url(#pinGrad)" />
    <circle cx="32" cy="29" r="16" fill="rgba(255,255,255,0.95)" />
    <text x="32" y="35" text-anchor="middle" font-size="16">${emoji}</text>
  </svg>`;
}

function StepIndicator({ step, total = 4 }: { step: FlowStep; total?: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {Array.from({ length: total }, (_, i) => {
        const stepNum = (i + 1) as FlowStep;
        const isActive = stepNum === step;
        const isDone = stepNum < step;
        return (
          <div
            key={i}
            className="transition-all duration-300"
            style={{
              width: isActive ? 28 : 8,
              height: 8,
              borderRadius: 4,
              background: isActive
                ? 'linear-gradient(to right, #14B8A6, #0D9488)'
                : isDone
                ? '#0D9488'
                : '#E5E7EB',
            }}
          />
        );
      })}
    </div>
  );
}

export function MapCreateEventFlow({
  isOpen,
  onClose,
  onSuccess,
  userId,
  initialLocation,
  defaultCountry,
}: MapCreateEventFlowProps) {
  const [step, setStep] = useState<FlowStep>(1);
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');
  const [animating, setAnimating] = useState(false);

  const [title, setTitle] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('🎉');
  const [eventType, setEventType] = useState('parties');

  const [latitude, setLatitude] = useState<number | null>(initialLocation?.latitude || null);
  const [longitude, setLongitude] = useState<number | null>(initialLocation?.longitude || null);
  const [locationName, setLocationName] = useState('');
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);

  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTime, setSelectedTime] = useState('20:00');
  const [isPrivate, setIsPrivate] = useState(false);

  const [maxAttendees, setMaxAttendees] = useState(20);
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const days = getNextDays(10);
  const currentType = EVENT_TYPES.find(t => t.id === eventType) || EVENT_TYPES[0];

  useEffect(() => {
    mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN || '';
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (step === 2 && mapContainerRef.current && !mapInstanceRef.current) {
      const centerLat = latitude || initialLocation?.latitude || 32.0853;
      const centerLng = longitude || initialLocation?.longitude || 34.7818;

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/streets-v11',
        center: [centerLng, centerLat],
        zoom: 14,
      });

      map.addControl(new mapboxgl.NavigationControl(), 'top-left');

      const marker = new mapboxgl.Marker({ color: currentType.color, draggable: true })
        .setLngLat([centerLng, centerLat])
        .addTo(map);

      if (!latitude || !longitude) {
        setLatitude(centerLat);
        setLongitude(centerLng);
      }

      const updateLocation = async (lat: number, lng: number) => {
        setLatitude(lat);
        setLongitude(lng);
        setDetectedCountry(null);

        const result = await reverseGeocode(lat, lng);

        if (result.address) {
          setLocationName(result.address);
        } else {
          setLocationName(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }

        setDetectedCity(result.city);
        setDetectedCountry(result.countryCode);
      };

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        updateLocation(lngLat.lat, lngLat.lng);
      });

      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        marker.setLngLat([lng, lat]);
        updateLocation(lat, lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;

      updateLocation(centerLat, centerLng);
    }
  }, [step]);

  const goToStep = useCallback((next: FlowStep, dir: 'forward' | 'back' = 'forward') => {
    if (animating) return;
    setAnimDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 180);
  }, [animating]);

  const handleNext = () => {
    if (step === 1) {
      if (!title.trim()) return;
      goToStep(2);
    } else if (step === 2) {
      if (!latitude || !longitude) return;
      goToStep(3);
    } else if (step === 3) {
      if (!selectedDay || !selectedTime) return;
      goToStep(4);
    }
  };

  const handleBack = () => {
    if (step === 2) goToStep(1, 'back');
    else if (step === 3) goToStep(2, 'back');
    else if (step === 4) goToStep(3, 'back');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const objectUrl = URL.createObjectURL(file);
    setImagePreview(objectUrl);
    setImageUrl('');
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return imageUrl || null;
    setUploadingImage(true);
    try {
      const uploadedUrl = await EventService.uploadEventImage(userId, imageFile);
      return uploadedUrl;
    } catch {
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedDay || !selectedTime || !latitude || !longitude) return;
    setSubmitting(true);
    try {
      const finalImageUrl = await uploadImage();
      const eventDateTime = new Date(`${selectedDay}T${selectedTime}`);

      const createdEvent = await EventService.createEvent({
        user_id: userId,
        title,
        description: title,
        emoji: selectedEmoji,
        event_type: eventType,
        latitude,
        longitude,
        city: detectedCity || locationName || 'Unknown',
        address: locationName || undefined,
        country: detectedCountry || defaultCountry || undefined,
        event_date: eventDateTime.toISOString(),
        is_private: isPrivate,
        max_attendees: maxAttendees,
        image_url: finalImageUrl || undefined,
      });

      if (!createdEvent) {
        throw new Error('Failed to create event');
      }

      console.log('[EVENT_CREATE] Event created successfully:', createdEvent);
      onSuccess(createdEvent);
      handleClose();
    } catch (err) {
      console.error('Error creating event:', err);
      alert('שגיאה ביצירת האירוע');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    setStep(1);
    setTitle('');
    setSelectedEmoji('🎉');
    setEventType('parties');
    setEventDate('');
    setSelectedTime('20:00');
    setIsPrivate(false);
    setMaxAttendees(20);
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
    setLocationName('');
    setDetectedCountry(null);
    setLatitude(initialLocation?.latitude || null);
    setLongitude(initialLocation?.longitude || null);
    onClose();
  };

  function setEventDate(v: string) {
    setSelectedDay(v);
  }

  const activeImageUrl = imagePreview || imageUrl || SUGGESTED_IMAGES[eventType]?.[0] || '';

  const stepTitles = ['', 'איזה אירוע?', 'איפה?', 'מתי?', 'פרטים אחרונים'];

  if (!isOpen) return null;

  const slideStyle: React.CSSProperties = {
    opacity: animating ? 0 : 1,
    transform: animating
      ? `translateX(${animDir === 'forward' ? '20px' : '-20px'})`
      : 'translateX(0)',
    transition: 'opacity 0.18s ease, transform 0.18s ease',
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={handleClose} />
      <div
        className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-50 overflow-hidden flex flex-col"
        style={{ maxHeight: step === 2 ? '92vh' : '88vh' }}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-2 pb-0 bg-white">
          {/* Drag handle */}
          <div className="flex justify-center mb-1">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* Step indicator */}
          <StepIndicator step={step} />

          {/* Title row */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {step > 1 && (
                <button
                  onClick={handleBack}
                  className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <h2 className="text-xl font-bold text-gray-900">{stepTitles[step]}</h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto" style={slideStyle}>

          {/* STEP 1: Emoji + description */}
          {step === 1 && (
            <div className="px-5 pb-6 space-y-5">
              {/* Category selection */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">קטגוריה</p>
                <div className="grid grid-cols-3 gap-2">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setEventType(type.id);
                        setSelectedEmoji(type.emoji);
                      }}
                      className="relative p-3 rounded-2xl transition-all active:scale-95"
                      style={{
                        background: eventType === type.id ? type.color + '18' : '#F9FAFB',
                        border: eventType === type.id ? `2px solid ${type.color}` : '2px solid transparent',
                      }}
                    >
                      <div className="text-2xl mb-1">{type.emoji}</div>
                      <div
                        className="text-xs font-bold"
                        style={{ color: eventType === type.id ? type.color : '#6B7280' }}
                      >
                        {type.label}
                      </div>
                      {eventType === type.id && (
                        <div
                          className="absolute top-1.5 left-1.5 w-2 h-2 rounded-full"
                          style={{ background: type.color }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji picker */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">בחר אימוג'י לסמן</p>
                <div className="grid grid-cols-6 gap-2">
                  {EMOJI_BY_TYPE[eventType]?.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => setSelectedEmoji(emoji)}
                      className="w-full aspect-square rounded-2xl text-2xl flex items-center justify-center transition-all active:scale-90"
                      style={{
                        background: selectedEmoji === emoji
                          ? `linear-gradient(135deg, #14B8A6, #0D9488)`
                          : '#F3F4F6',
                        transform: selectedEmoji === emoji ? 'scale(1.12)' : 'scale(1)',
                        boxShadow: selectedEmoji === emoji ? '0 4px 12px rgba(13,148,136,0.35)' : 'none',
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live pin preview */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-4 flex items-center gap-4 border border-gray-200">
                <div
                  dangerouslySetInnerHTML={{ __html: createEventPinPreview(selectedEmoji, currentType.color) }}
                  className="flex-shrink-0"
                />
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">תצוגה מקדימה של הסמן</p>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`לדוגמה: ${
                      eventType === 'parties' ? 'מסיבה בחוף הים' :
                      eventType === 'food' ? 'ארוחת ערב ביחד' :
                      eventType === 'sports' ? 'משחק כדורגל בפארק' :
                      eventType === 'treks' ? 'טיול להר' :
                      eventType === 'workshops' ? 'סדנת יצירה' :
                      'שיעור תורה'
                    }`}
                    className="w-full text-base font-semibold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-400"
                    maxLength={60}
                  />
                  {title && (
                    <p className="text-xs text-gray-400 mt-1">{title.length}/60</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Map location */}
          {step === 2 && (
            <div className="flex flex-col" style={{ height: 'calc(88vh - 140px)' }}>
              <div className="px-5 pb-3">
                <div className="bg-brand-50 border border-brand-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0" />
                  <p className="text-sm text-brand-700 font-medium">גרור את המפה או לחץ לבחירת מיקום</p>
                </div>
              </div>

              <div className="relative flex-1 mx-5 rounded-2xl overflow-hidden border-2 border-brand-300 shadow-lg">
                <div ref={mapContainerRef} className="absolute inset-0" />
              </div>

              {locationName && (
                <div className="px-5 pt-3 pb-0">
                  <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: currentType.color }}
                    />
                    <p className="text-sm text-gray-700 font-medium truncate flex-1">{locationName}</p>
                    {detectedCountry && (
                      <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-lg flex-shrink-0">
                        {detectedCountry}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Date + Time + Privacy */}
          {step === 3 && (
            <div className="px-5 pb-6 space-y-6">
              {/* Day selector */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">תאריך</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
                  {days.map((d) => {
                    const isSelected = selectedDay === d.value;
                    return (
                      <button
                        key={d.value}
                        onClick={() => setSelectedDay(d.value)}
                        className="flex-shrink-0 flex flex-col items-center justify-center rounded-2xl transition-all active:scale-95"
                        style={{
                          width: 64,
                          paddingTop: 14,
                          paddingBottom: 14,
                          background: isSelected
                            ? 'linear-gradient(135deg, #14B8A6, #0D9488)'
                            : '#F3F4F6',
                          boxShadow: isSelected ? '0 4px 14px rgba(13,148,136,0.3)' : 'none',
                        }}
                      >
                        <span
                          className="text-xs font-semibold mb-1"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : '#9CA3AF' }}
                        >
                          {d.day}
                        </span>
                        <span
                          className="text-xl font-bold"
                          style={{ color: isSelected ? '#fff' : '#1F2937' }}
                        >
                          {d.num}
                        </span>
                        <span
                          className="text-xs mt-1"
                          style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#9CA3AF' }}
                        >
                          {d.label.split('/')[1]}/{String(new Date().getFullYear()).slice(-2)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time selector */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">שעה</p>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
                  {HOURS.map((h) => {
                    const isSelected = selectedTime === h;
                    return (
                      <button
                        key={h}
                        onClick={() => setSelectedTime(h)}
                        className="flex-shrink-0 rounded-2xl px-4 py-3 transition-all active:scale-95 font-bold text-sm"
                        style={{
                          background: isSelected
                            ? 'linear-gradient(135deg, #14B8A6, #0D9488)'
                            : '#F3F4F6',
                          color: isSelected ? '#fff' : '#1F2937',
                          boxShadow: isSelected ? '0 4px 14px rgba(13,148,136,0.3)' : 'none',
                        }}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Privacy */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">מי יכול להצטרף?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setIsPrivate(false)}
                    className="relative p-4 rounded-2xl transition-all active:scale-95 text-right"
                    style={{
                      background: !isPrivate ? 'linear-gradient(135deg, #22C55E18, #16A34A18)' : '#F9FAFB',
                      border: !isPrivate ? '2px solid #22C55E' : '2px solid #E5E7EB',
                    }}
                  >
                    {!isPrivate && (
                      <div className="absolute top-2 left-2 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                    <Globe className="w-7 h-7 mb-2" style={{ color: !isPrivate ? '#22C55E' : '#9CA3AF' }} />
                    <div className="font-bold text-gray-900 text-sm">פתוח</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">כל אחד יכול להצטרף ישירות</div>
                  </button>

                  <button
                    onClick={() => setIsPrivate(true)}
                    className="relative p-4 rounded-2xl transition-all active:scale-95 text-right"
                    style={{
                      background: isPrivate ? 'linear-gradient(135deg, #14B8A618, #0D948818)' : '#F9FAFB',
                      border: isPrivate ? '2px solid #14B8A6' : '2px solid #E5E7EB',
                    }}
                  >
                    {isPrivate && (
                      <div className="absolute top-2 left-2 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: '#14B8A6' }}>
                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                      </div>
                    )}
                    <Lock className="w-7 h-7 mb-2" style={{ color: isPrivate ? '#14B8A6' : '#9CA3AF' }} />
                    <div className="font-bold text-gray-900 text-sm">פרטי</div>
                    <div className="text-xs text-gray-500 mt-0.5 leading-snug">דורש אישור ממני לפני כניסה</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Participants + Image */}
          {step === 4 && (
            <div className="px-5 pb-6 space-y-6">
              {/* Participant limit */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm font-semibold text-gray-500">מספר משתתפים מקסימלי</p>
                  <div
                    className="text-2xl font-black"
                    style={{ background: 'linear-gradient(to right, #0D9488, #14B8A6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
                  >
                    {maxAttendees === 200 ? '200+' : maxAttendees}
                  </div>
                </div>

                {/* Visual participant bar */}
                <div className="relative pb-2">
                  <div className="relative h-10 flex items-center">
                    <div className="absolute left-0 right-0 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-150"
                        style={{
                          width: `${((maxAttendees - 5) / (200 - 5)) * 100}%`,
                          background: 'linear-gradient(to left, #14B8A6, #0D9488)',
                        }}
                      />
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={200}
                      step={5}
                      value={maxAttendees}
                      onChange={(e) => setMaxAttendees(Number(e.target.value))}
                      className="absolute left-0 right-0 w-full opacity-0 h-10 cursor-pointer"
                    />
                    <div
                      className="absolute h-7 w-7 rounded-full bg-white shadow-lg border-2 transition-all duration-150 flex items-center justify-center"
                      style={{
                        left: `calc(${((maxAttendees - 5) / (200 - 5)) * 100}% - 14px)`,
                        borderColor: '#14B8A6',
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#14B8A6' }} />
                    </div>
                  </div>
                </div>

                {/* Preset chips */}
                <div className="flex gap-2 flex-wrap mt-2">
                  {[10, 20, 30, 50, 100, 200].map((n) => (
                    <button
                      key={n}
                      onClick={() => setMaxAttendees(n)}
                      className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                      style={{
                        background: maxAttendees === n
                          ? 'linear-gradient(to right, #0D9488, #14B8A6)'
                          : '#F3F4F6',
                        color: maxAttendees === n ? '#fff' : '#6B7280',
                      }}
                    >
                      {n === 200 ? '200+' : n}
                    </button>
                  ))}
                </div>

                {/* Participants visual */}
                <div className="flex gap-0.5 mt-3 flex-wrap">
                  {Array.from({ length: Math.min(maxAttendees, 40) }).map((_, i) => (
                    <div
                      key={i}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-xs transition-all"
                      style={{
                        background: i < Math.min(maxAttendees, 40)
                          ? `hsl(${280 + i * 3}, 70%, ${65 + (i % 3) * 5}%)`
                          : '#E5E7EB',
                        opacity: 0.85,
                      }}
                    >
                      <Users className="w-2.5 h-2.5 text-white" />
                    </div>
                  ))}
                  {maxAttendees > 40 && (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-600 font-bold">
                      +{maxAttendees - 40}
                    </div>
                  )}
                </div>
              </div>

              {/* Image */}
              <div>
                <p className="text-sm font-semibold text-gray-500 mb-3">תמונה לאירוע</p>

                {/* Current image preview */}
                {activeImageUrl && (
                  <div className="relative h-36 rounded-2xl overflow-hidden mb-3 border border-gray-200">
                    <img src={activeImageUrl} alt="event" className="w-full h-full object-cover" />
                    {(imagePreview || imageUrl) && (
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(''); setImageUrl(''); }}
                        className="absolute top-2 left-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center"
                      >
                        <X className="w-3.5 h-3.5 text-white" />
                      </button>
                    )}
                    {!imagePreview && !imageUrl && (
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
                        הצעה אוטומטית
                      </div>
                    )}
                  </div>
                )}

                {/* Upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed transition-all active:scale-98"
                  style={{ borderColor: '#14B8A6', background: '#14B8A60A' }}
                >
                  <Upload className="w-4 h-4" style={{ color: '#14B8A6' }} />
                  <span className="text-sm font-semibold" style={{ color: '#14B8A6' }}>
                    {imagePreview ? 'החלף תמונה' : 'העלה תמונה'}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {/* Suggested images */}
                {!imagePreview && !imageUrl && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-2">או בחר תמונה מוצעת</p>
                    <div className="flex gap-2">
                      {SUGGESTED_IMAGES[eventType]?.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setImageUrl(url)}
                          className="flex-1 h-20 rounded-xl overflow-hidden border-2 transition-all active:scale-95"
                          style={{ borderColor: imageUrl === url ? '#14B8A6' : 'transparent' }}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="flex-shrink-0 px-5 py-4 bg-white border-t border-gray-100">
          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="w-12 h-14 bg-gray-100 rounded-2xl flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <button
              onClick={step === 4 ? handleSubmit : handleNext}
              disabled={
                (step === 1 && !title.trim()) ||
                (step === 2 && (!latitude || !longitude)) ||
                (step === 3 && (!selectedDay || !selectedTime)) ||
                submitting ||
                uploadingImage
              }
              className="flex-1 h-14 rounded-2xl font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-98 disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0D9488, #14B8A6)', boxShadow: '0 4px 20px rgba(20,184,166,0.35)' }}
            >
              {submitting || uploadingImage ? (
                <span>רגע...</span>
              ) : step === 4 ? (
                <>
                  <ImageIcon className="w-5 h-5" />
                  <span>הוסף למפה</span>
                </>
              ) : (
                <>
                  <span>המשך</span>
                  <ChevronLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
