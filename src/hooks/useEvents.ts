import { useState, useEffect, useCallback, useRef } from 'react';
import { EventService } from '../services/eventService';
import type { Event, EventFilters } from '../types/event';

/* ── module-level event cache (survives navigation) ── */
const _eventsCache: Record<string, Event[]> = {};
const filterKey = (f?: EventFilters) =>
  (f?.countries?.slice().sort().join(',') || '*') + (f?.eventType || '') + (f?.searchQuery || '');

export function useEvents(initialFilters?: EventFilters) {
  const initKey = filterKey(initialFilters);
  const [events, setEvents] = useState<Event[]>(_eventsCache[initKey] ?? []);
  const [loading, setLoading] = useState(!_eventsCache[initKey]);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(initialFilters);
  const mountedRef = useRef(true);
  const localEventsRef = useRef<Set<string>>(new Set());

  const loadEvents = useCallback(async (filters?: EventFilters) => {
    try {
      const currentFilters = filters || filtersRef.current;
      const key = filterKey(currentFilters);

      // Show cached events instantly — skip skeleton if we have them
      if (_eventsCache[key]?.length) {
        setEvents(_eventsCache[key]);
        setLoading(false);
      } else {
        setLoading(true);
      }
      setError(null);

      const fetchedEvents = await EventService.getEvents(currentFilters);

      if (mountedRef.current) {
        setEvents(prev => {
          const localEvents = prev.filter(e => localEventsRef.current.has(e.id));
          const fetchedIds = new Set(fetchedEvents.map(e => e.id));
          const uniqueLocalEvents = localEvents.filter(e => !fetchedIds.has(e.id));
          const result = [...uniqueLocalEvents, ...fetchedEvents];
          _eventsCache[key] = result;
          return result;
        });
      }
    } catch (err) {
      console.error('[useEvents] Error loading events:', err);
      if (mountedRef.current) {
        setError('Failed to load events');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    return loadEvents(filtersRef.current);
  }, [loadEvents]);

  const updateFilters = useCallback((newFilters: EventFilters) => {
    filtersRef.current = newFilters;
    loadEvents(newFilters);
  }, [loadEvents]);

  const addEvent = useCallback((event: Event, isLocal = true) => {
    if (isLocal) {
      localEventsRef.current.add(event.id);
    }

    setEvents(prev => {
      const exists = prev.some(e => e.id === event.id);
      if (exists) {
        return prev.map(e => e.id === event.id ? event : e);
      }
      return [event, ...prev];
    });
  }, []);

  const updateEvent = useCallback((eventId: string, updates: Partial<Event>) => {
    setEvents(prev =>
      prev.map(e => e.id === eventId ? { ...e, ...updates } : e)
    );
  }, []);

  const removeEvent = useCallback((eventId: string) => {
    setEvents(prev => prev.filter(e => e.id !== eventId));
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadEvents(initialFilters);

    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = EventService.subscribeToEvents((newEvent) => {
      const hasCountryFilter = filtersRef.current?.countries && filtersRef.current.countries.length > 0;

      if (!hasCountryFilter) {
        addEvent(newEvent);
        return;
      }

      const matchesFilter = newEvent.country && filtersRef.current?.countries?.includes(newEvent.country);
      if (matchesFilter) {
        addEvent(newEvent);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [addEvent]);

  return {
    events,
    loading,
    error,
    refreshEvents,
    updateFilters,
    addEvent,
    updateEvent,
    removeEvent,
  };
}
