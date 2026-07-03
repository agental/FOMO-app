import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
  },
});

export type User = {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  selected_countries: string[];
  is_location_shared: boolean;
  latitude?: number;
  longitude?: number;
  role: 'user' | 'admin';
  instagram?: string | null;
  bio?: string;
  age?: number;
  languages?: string[];
  interests?: string[];
  current_country?: string;
  visited_countries?: string[];
  home_base?: string;
  created_at: string;
  updated_at: string;
};

export type AdminAction = {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  target_user_id?: string;
  details?: Record<string, any>;
  created_at: string;
};

export type Meetup = {
  id: string;
  user_id: string;
  emoji: string;
  text: string;
  latitude: number;
  longitude: number;
  country?: string;
  city?: string;
  scheduled_at: string;
  privacy: 'open' | 'approval';
  attendees: string[];
  pending_requests: string[];
  created_at: string;
  users?: { id: string; display_name: string; avatar_url?: string | null };
};

export type Event = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url?: string | null;
  country?: string | null;
  city: string;
  address?: string | null;
  latitude?: number;
  longitude?: number;
  date?: string;
  event_date?: string;
  time?: string;
  event_type?: string | null;
  emoji?: string | null;
  attendees: string[];
  max_attendees: number;
  is_private?: boolean;
  created_at: string;
  users?: { id: string; display_name: string; avatar_url?: string | null };
  distance?: number;
};

export type ChabadHouse = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  image_url?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
};

export type AdminLocation = {
  id: string;
  name: string;
  description?: string;
  address?: string;
  city?: string;
  country: string;
  latitude: number;
  longitude: number;
  phone?: string;
  email?: string;
  website?: string;
  image_url?: string;
  pin_color?: string;
  emoji?: string | null;
  google_place_id?: string;
  place_name?: string;
  place_address?: string;
  place_rating?: number;
  place_review_count?: number;
  place_photo_url?: string;
  place_photos?: string[];
  place_phone?: string;
  place_website?: string;
  place_types?: string[];
  place_open_now?: boolean;
  google_maps_url?: string;
  opening_hours?: Record<string, { open: string; close: string; closed: boolean }> | null;
  created_by?: string;
  created_at: string;
  updated_at: string;
};
