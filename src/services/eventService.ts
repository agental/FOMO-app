import { supabase } from '../lib/supabase';
import { calculateDistance } from '../utils/distance';
import type { Event, CreateEventData, EventFilters } from '../types/event';

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
          event.title.toLowerCase().includes(searchTerm) ||
          event.description.toLowerCase().includes(searchTerm) ||
          event.city.toLowerCase().includes(searchTerm) ||
          event.event_type?.toLowerCase().includes(searchTerm)
        );
      }

      return processedEvents;
    } catch (error) {
      console.error('[EventService.getEvents] Failed:', error);
      return [];
    }
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

  static async uploadEventImage(userId: string, file: File): Promise<string | null> {
    try {
      const ext = file.name.split('.').pop();
      const path = `events/${userId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('images')
        .upload(path, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('images')
        .getPublicUrl(path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('[EventService.uploadEventImage] Failed:', error);
      return null;
    }
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
