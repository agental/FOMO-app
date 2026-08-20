import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

/*
  Auth session storage that SURVIVES an Expo WebView relaunch — so the user stays logged in.

  In the Expo WebView, localStorage is dropped between app launches, so the default Supabase storage
  loses the session and the user has to log in every time. The native wrapper already mirrors storage
  into AsyncStorage: on startup it injects the saved blob as window.__FOMO_NATIVE_CACHE, and it persists
  every write we post via ReactNativeWebView. We route the auth session through that bridge:
    - read: localStorage first (fresh within a session); on a cold start it's empty, so fall back to
      the native blob (which holds the last-persisted session) → the login is restored.
    - write/remove: localStorage + post to the bridge so it lands in AsyncStorage for next launch.
  On plain web (no wrapper) this is just localStorage.
*/
type BridgeWin = typeof window & {
  __FOMO_NATIVE_CACHE?: Record<string, string>;
  ReactNativeWebView?: { postMessage: (msg: string) => void };
};
const bw = (typeof window !== 'undefined' ? window : {}) as BridgeWin;

const nativeSessionStorage = {
  getItem(key: string): string | null {
    try {
      const ls = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (ls != null) return ls;                       // fresh within the current session
      const nc = bw.__FOMO_NATIVE_CACHE;               // cold start on the phone: localStorage is empty
      return nc && nc[key] != null ? nc[key] : null;   // restore from the native blob
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch { /* ignore */ }
    if (bw.ReactNativeWebView) {
      try { bw.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cacheSet', key, value })); } catch { /* ignore */ }
    }
  },
  removeItem(key: string): void {
    try { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); } catch { /* ignore */ }
    if (bw.ReactNativeWebView) {
      try { bw.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cacheRemove', key })); } catch { /* ignore */ }
    }
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // Persist the session through the native bridge so a WebView relaunch stays logged in.
    storage: nativeSessionStorage,
    // Implicit flow: OAuth returns access_token + refresh_token directly in the URL
    // fragment. The native wrapper reads them and calls setSession — no PKCE code
    // exchange / code_verifier (which is fragile in a non-secure http WebView).
    flowType: 'implicit',
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
  is_seed?: boolean;      // generated "seed" event (see seed-events fn)
  seed_key?: string | null; // template key, e.g. 'beach:2' — the learning key for admin image overrides
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
  is_featured?: boolean;
  extra_likes?: number;  // admin-set likes added on top of real saves (manual boost / edit)
  created_by?: string;
  created_at: string;
  updated_at: string;
};
