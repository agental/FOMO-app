import { useState, useEffect, useRef } from 'react';
import { Calendar, MapPin, Users, Image as ImageIcon, X, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { COUNTRIES } from '../utils/countries';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

type CreateEventFormProps = {
  onSuccess: () => void;
  onCancel: () => void;
  currentUserId?: string | null;
  userCountries?: string[];
};

export function CreateEventForm({ onSuccess, onCancel, currentUserId, userCountries }: CreateEventFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [country, setCountry] = useState('');

  useEffect(() => {
    if (userCountries && userCountries.length > 0) {
      setCountry(userCountries[0]);
    } else {
      setCountry('IL');
    }
  }, [userCountries]);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [capacity, setCapacity] = useState('');
  const [eventType, setEventType] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  const eventTypes = [
    { id: 'parties', label: 'מסיבות', emoji: '🎉' },
    { id: 'treks', label: 'טרקים', emoji: '🏕️' },
    { id: 'food', label: 'אוכל', emoji: '🍔' },
    { id: 'sports', label: 'ספורט', emoji: '🏄' },
    { id: 'workshops', label: 'סדנאות', emoji: '🧘' },
    { id: 'yeshivot', label: 'ישיבות', emoji: '📖' },
  ];

  const emojiOptions: Record<string, string[]> = {
    parties: ['🎉', '🥳', '🎊', '🪩', '🍾', '🎈', '🎵', '💃'],
    treks: ['🏕️', '⛺', '🥾', '🏔️', '🌲', '🌄', '🗻', '🧗'],
    food: ['🍔', '🍕', '🍜', '🍣', '🥗', '🍰', '☕', '🍺'],
    sports: ['🏄', '⚽', '🏀', '🎾', '🏊', '🚴', '🧘', '💪'],
    workshops: ['🧘', '🎨', '📚', '💡', '🎸', '📷', '✍️', '🧠'],
    yeshivot: ['📖', '📚', '🕯️', '✡️', '🙏', '📜', '🎓', '💫'],
  };

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
    if (!showMapPicker || !mapContainerRef.current || !latitude || !longitude || mapInstanceRef.current) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [longitude, latitude],
      zoom: 13,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    const marker = new mapboxgl.Marker({ color: '#EF4444', draggable: true })
      .setLngLat([longitude, latitude])
      .addTo(map);

    marker.on('dragend', () => {
      const lngLat = marker.getLngLat();
      setLatitude(lngLat.lat);
      setLongitude(lngLat.lng);
    });

    map.on('click', (e) => {
      const { lng, lat } = e.lngLat;
      setLatitude(lat);
      setLongitude(lng);
      marker.setLngLat([lng, lat]);
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;
  }, [showMapPicker, latitude, longitude]);

  const getCurrentLocation = () => {
    setMapLoading(true);
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setShowMapPicker(true);
          setMapLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('לא ניתן להשיג מיקום. אנא אפשר גישה למיקום בהגדרות הדפדפן');
          setLatitude(32.0853);
          setLongitude(34.7818);
          setShowMapPicker(true);
          setMapLoading(false);
        }
      );
    } else {
      alert('הדפדפן שלך לא תומך באיתור מיקום');
      setLatitude(32.0853);
      setLongitude(34.7818);
      setShowMapPicker(true);
      setMapLoading(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('images')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading image:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title || !description || !city || !eventDate || !eventTime) {
      alert('אנא מלא את כל השדות החובה');
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl = null;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile);
        if (!imageUrl) {
          alert('שגיאה בהעלאת התמונה');
          setSubmitting(false);
          return;
        }
      }

      const eventDateTime = new Date(`${eventDate}T${eventTime}`);

      const { error } = await supabase.from('events').insert({
        user_id: currentUserId || '00000000-0000-0000-0000-000000000001',
        title,
        description,
        country,
        city,
        address: address || null,
        image_url: imageUrl,
        event_date: eventDateTime.toISOString(),
        event_type: eventType,
        emoji: selectedEmoji || (eventType ? emojiOptions[eventType]?.[0] : null),
        attendees: [],
        max_attendees: capacity ? parseInt(capacity, 10) : 20,
        latitude: latitude,
        longitude: longitude,
      });

      if (error) {
        console.error('Error creating event:', error);
        alert(`שגיאה ביצירת האירוע: ${error.message}`);
      } else {
        alert('האירוע נוצר בהצלחה!');
        onSuccess();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      alert('שגיאה ביצירת האירוע. אנא נסה שוב.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50" dir="rtl">
      <div className="bg-white w-full max-w-2xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">📅 יצירת אירוע</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              כותרת האירוע *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="למשל: טיול לים בתל אביב"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              תיאור *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="פרט על האירוע, מה צפוי, מה להביא..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="inline w-4 h-4 ml-1" />
                מדינה *
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                {Object.entries(COUNTRIES).map(([code, { name, flag }]) => (
                  <option key={code} value={code}>
                    {flag} {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                עיר *
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="תל אביב"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              כתובת מדויקת
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="רחוב בן יהודה 123"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <MapPin className="inline w-4 h-4 ml-1" />
              מיקום על המפה
            </label>
            {!showMapPicker ? (
              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={mapLoading}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-500 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Navigation className="w-5 h-5" />
                {mapLoading ? 'מאתר מיקום...' : 'בחר מיקום על המפה'}
              </button>
            ) : (
              <div className="space-y-2">
                <div
                  ref={mapContainerRef}
                  className="relative h-64 rounded-xl overflow-hidden border-2 border-blue-300"
                />
                <div className="flex gap-2">
                  <div className="flex-1 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-semibold">קו רוחב:</span> {latitude?.toFixed(6)}
                  </div>
                  <div className="flex-1 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg">
                    <span className="font-semibold">קו אורך:</span> {longitude?.toFixed(6)}
                  </div>
                </div>
                <p className="text-xs text-gray-500 text-center">לחץ על המפה או גרור את הסמן כדי לבחור מיקום מדויק</p>
                <button
                  type="button"
                  onClick={() => {
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.remove();
                      mapInstanceRef.current = null;
                    }
                    setShowMapPicker(false);
                    setLatitude(null);
                    setLongitude(null);
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  הסר מיקום
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 ml-1" />
                תאריך *
              </label>
              <input
                type="date"
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                שעה *
              </label>
              <input
                type="time"
                value={eventTime}
                onChange={(e) => setEventTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <ImageIcon className="inline w-4 h-4 ml-1" />
              הוסף תמונה
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 file:ml-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {imagePreview && (
              <img
                src={imagePreview}
                alt="Preview"
                className="mt-3 w-full h-48 object-cover rounded-xl"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              <Users className="inline w-4 h-4 ml-1" />
              מספר משתתפים מקסימלי
            </label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="10"
              min="1"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              סוג אירוע
            </label>
            <div className="grid grid-cols-3 gap-3">
              {eventTypes.map(type => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setEventType(type.id);
                    setSelectedEmoji(emojiOptions[type.id]?.[0] || type.emoji);
                  }}
                  className={`px-4 py-3 rounded-xl font-medium transition-all active:scale-95 shadow-sm ${
                    eventType === type.id
                      ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                  }`}
                  style={{ fontFamily: 'Rubik, sans-serif', fontWeight: 500 }}
                >
                  <div className="text-2xl mb-1">{type.emoji}</div>
                  <div className="text-sm">{type.label}</div>
                </button>
              ))}
            </div>
          </div>

          {eventType && emojiOptions[eventType] && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                בחר אימוג'י לאירוע
              </label>
              <div className="flex flex-wrap gap-2">
                {emojiOptions[eventType].map((emoji, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`w-12 h-12 text-2xl rounded-xl transition-all active:scale-95 ${
                      selectedEmoji === emoji
                        ? 'bg-gradient-to-r from-blue-500 to-cyan-400 shadow-lg scale-110 ring-2 ring-blue-300'
                        : 'bg-white hover:bg-gray-50 border border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              {selectedEmoji && (
                <p className="mt-2 text-sm text-gray-500 text-center">
                  האימוג'י הנבחר: <span className="text-2xl">{selectedEmoji}</span>
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'יוצר אירוע...' : 'יצירת אירוע'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-4 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors"
            >
              ביטול
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
