import { supabase } from '../lib/supabase';
import { calculateDistance } from '../utils/distance';
import type { Event, CreateEventData, EventFilters } from '../types/event';

// ── Image helpers ──────────────────────────────────────────────────────────

const MIN_DIMENSION = 400; // reject anything under 400×400px
const MAX_DIMENSION = 1920;
const JPEG_QUALITY  = 0.85;

/** Compress + validate an image via Canvas. Converts HEIC→JPEG automatically. */
function compressImage(file: File): Promise<{ blob: Blob; base64: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const { naturalWidth: w, naturalHeight: h } = img;

      if (w < MIN_DIMENSION || h < MIN_DIMENSION) {
        reject(new Error(
          `התמונה קטנה מדי (${w}×${h} פיקסלים). ` +
          `בחר תמונה באיכות גבוהה יותר — לפחות ${MIN_DIMENSION}×${MIN_DIMENSION}.`
        ));
        return;
      }

      const scale = Math.min(1, MAX_DIMENSION / Math.max(w, h));
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(blob => {
        if (!blob) { reject(new Error('שגיאה בעיבוד התמונה')); return; }
        // Also produce base64 for moderation (strip the data: prefix)
        const base64 = canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1];
        resolve({ blob, base64, width: canvas.width, height: canvas.height });
      }, 'image/jpeg', JPEG_QUALITY);
    };

    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('לא ניתן לקרוא את קובץ התמונה')); };
    img.src = url;
  });
}

/** Call the Supabase edge function that runs Claude Vision moderation. */
async function moderateImage(base64: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('moderate-event-image', {
      body: { image: base64, mediaType: 'image/jpeg' },
    });
    if (error) {
      console.warn('[moderateImage] edge function error (allowing upload):', error);
      return; // fail open
    }
    if (data && data.approved === false) {
      throw new Error(data.reason || 'התמונה אינה מתאימה לאירוע — בחר תמונה אחרת.');
    }
  } catch (e: any) {
    // Only rethrow if it's a rejection from Claude, not a network/deploy error
    if (e?.message && !e.message.includes('fetch') && !e.message.includes('Failed')) throw e;
    console.warn('[moderateImage] moderation unavailable, allowing upload');
  }
}

export class EventService {
  static async createEvent(data: CreateEventData): Promise<Event | null> {
    const insertPayload = {
      user_id: data.user_id,
      title: data.title,
      description: data.description,
      emoji: data.emoji || null,
      image_url: data.image_url || null,
      event_type: data.event_type || null,
      latitude: data.latitude,
      longitude: data.longitude,
      country: data.country || null,
      city: data.city,
      address: data.address || null,
      event_date: data.event_date,
      is_private: data.is_private,
      max_attendees: data.max_attendees,
      attendees: [],
      ...(data.price != null ? { price: data.price } : {}),
    };

    try {
      const { data: insertedEvent, error: insertError } = await supabase
        .from('events')
        .insert(insertPayload)
        .select('*')
        .single();

      if (insertError) {
        console.error('[EventService.createEvent] INSERT failed:', insertError.message, insertError.details, insertError.hint);
        throw insertError;
      }

      if (!insertedEvent) {
        throw new Error('Insert returned no data');
      }

      const { data: verifyEvent, error: verifyError } = await supabase
        .from('events')
        .select('*')
        .eq('id', insertedEvent.id)
        .single();

      if (verifyError) {
        console.error('[EventService.createEvent] Verification failed — possible RLS SELECT issue:', verifyError);
        throw verifyError;
      }

      if (!verifyEvent) {
        throw new Error('Event not found after insert');
      }

      const { data: eventWithUser, error: userJoinError } = await supabase
        .from('events')
        .select('*, users(id, display_name, avatar_url)')
        .eq('id', insertedEvent.id)
        .single();

      if (userJoinError) {
        console.warn('[EventService.createEvent] Could not join user data:', userJoinError);
        return verifyEvent as Event;
      }

      return eventWithUser as Event;
    } catch (error) {
      console.error('[EventService.createEvent] Failed:', error);
      return null;
    }
  }

  static async getEvents(filters?: EventFilters): Promise<Event[]> {
    try {
      let query = supabase
        .from('events')
        .select('*, users(id, display_name, avatar_url)')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      if (filters?.countries && filters.countries.length > 0) {
        query = query.in('country', filters.countries);
      }

      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }

      const { data: events, error } = await query;

      if (error) {
        console.error('[EventService.getEvents] Fetch failed:', error.message);
        throw error;
      }

      if (!events || events.length === 0) return [];

      let processedEvents = events as Event[];

      if (filters?.userLocation) {
        const { latitude, longitude, radiusKm } = filters.userLocation;

        processedEvents = processedEvents.map(event => ({
          ...event,
          distance: calculateDistance(latitude, longitude, event.latitude, event.longitude),
        }));

        if (radiusKm) {
          processedEvents = processedEvents.filter(event =>
            (event.distance ?? Infinity) <= radiusKm
          );
        }

        processedEvents.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
      }

      if (filters?.searchQuery) {
        const searchTerm = filters.searchQuery.toLowerCase();
        processedEvents = processedEvents.filter(event =>
          event.title?.toLowerCase().includes(searchTerm) ||
          event.description?.toLowerCase().includes(searchTerm) ||
          event.city?.toLowerCase().includes(searchTerm) ||
          event.event_type?.toLowerCase().includes(searchTerm)
        );
      }

      return processedEvents;
    } catch (error) {
      console.error('[EventService.getEvents] Failed:', error);
      return [];
    }
  }

  static async updateEvent(eventId: string, updates: Partial<Omit<Event, 'id' | 'user_id' | 'created_at'>>): Promise<Event> {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select('*, users(id, display_name, avatar_url)')
      .single();
    if (error) throw error;
    return data as Event;
  }

  static async getAllEventsNoFilter(): Promise<Event[]> {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*, users(id, display_name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[EventService.getAllEventsNoFilter] Failed:', error);
      }

      return (events || []) as Event[];
    } catch (error) {
      console.error('[EventService.getAllEventsNoFilter] Failed:', error);
      return [];
    }
  }

  static async getEventById(id: string): Promise<Event | null> {
    try {
      const { data: event, error } = await supabase
        .from('events')
        .select('*, users(id, display_name, avatar_url)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return event as Event;
    } catch (error) {
      console.error('[EventService.getEventById] Failed to fetch event:', error);
      return null;
    }
  }

  static async updateEventAttendees(eventId: string, attendees: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('events')
        .update({ attendees })
        .eq('id', eventId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[EventService.updateEventAttendees] Failed:', error);
      return false;
    }
  }

  static async joinEvent(eventId: string, userId: string): Promise<boolean> {
    try {
      const event = await this.getEventById(eventId);
      if (!event) return false;

      if (event.attendees.includes(userId)) return true;

      const newAttendees = [...event.attendees, userId];
      return await this.updateEventAttendees(eventId, newAttendees);
    } catch (error) {
      console.error('[EventService.joinEvent] Failed:', error);
      return false;
    }
  }

  static async leaveEvent(eventId: string, userId: string): Promise<boolean> {
    try {
      const event = await this.getEventById(eventId);
      if (!event) return false;

      const newAttendees = event.attendees.filter(id => id !== userId);
      return await this.updateEventAttendees(eventId, newAttendees);
    } catch (error) {
      console.error('[EventService.leaveEvent] Failed:', error);
      return false;
    }
  }

  static async uploadEventImage(userId: string, file: File): Promise<string> {
    // 1. Compress via canvas (validates dimensions, converts HEIC→JPEG)
    const { blob, base64 } = await compressImage(file);

    // 2. AI content moderation — rejects screenshots, memes, NSFW, irrelevant images
    await moderateImage(base64);

    // 3. Upload the compressed JPEG
    const path = `events/${userId}-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from('images')
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });

    if (error) {
      console.error('[uploadEventImage] Supabase error:', JSON.stringify(error));
      throw new Error(error.message || 'שגיאה בהעלאת התמונה לשרת');
    }

    const { data: urlData } = supabase.storage.from('images').getPublicUrl(path);
    return urlData.publicUrl;
  }

  static subscribeToEvents(callback: (event: Event) => void) {
    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        async (payload) => {
          const event = await this.getEventById(payload.new.id as string);
          if (event) {
            callback(event);
          } else {
            console.error('[EventService.subscribe] Could not fetch event after INSERT for id:', payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
}
