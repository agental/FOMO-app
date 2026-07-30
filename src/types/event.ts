export interface EventUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

/** A single purchasable ticket type on an event (e.g. "רגיל" ₪50, "VIP" ₪120). */
export interface TicketType {
  id: string;
  name: string;
  price: number;
}

export interface Event {
  id: string;
  user_id: string;
  title: string;
  description: string;
  emoji: string | null;
  image_url: string | null;
  event_type: string | null;
  latitude: number;
  longitude: number;
  country: string | null;
  city: string;
  address: string | null;
  event_date: string;
  is_private: boolean;
  max_attendees: number;
  attendees: string[];
  price?: number | null;
  ticket_types?: TicketType[];
  has_group?: boolean;
  created_at: string;
  users?: EventUser;
  distance?: number;
}

export interface CreateEventData {
  user_id: string;
  title: string;
  description: string;
  emoji?: string;
  image_url?: string;
  event_type?: string;
  latitude: number;
  longitude: number;
  country?: string;
  city: string;
  address?: string;
  event_date: string;
  is_private: boolean;
  max_attendees: number;
  price?: number | null;
  ticket_types?: TicketType[];
  has_group?: boolean;
}

export interface EventFilters {
  countries?: string[];
  eventType?: string;
  searchQuery?: string;
  userLocation?: {
    latitude: number;
    longitude: number;
    radiusKm?: number;
  };
}
