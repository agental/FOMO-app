/*
  Boot preloader — warms the important data into memory + localStorage the moment auth
  resolves, WHILE the splash screen is still showing. By the time the user reaches the home
  feed, the profile, their events, and the bell count are already cached, so the feed paints
  with no skeleton and the screens skip their first blocking fetch.

  Called once from App.handleAuthSuccess (see App.tsx). Everything runs in parallel via
  Promise.allSettled — one slow/failed query never blocks the others, and a total failure
  just means the screens fall back to their normal on-mount fetch.
*/

import { supabase } from '../lib/supabase';
import { EventService } from '../services/eventService';
import { filterKey, _eventsCache } from '../hooks/useEvents';
import { _homeUserCache } from '../components/HomeScreen';
import { getNotifLastSeen } from '../utils/notificationsSeen';
import { fetchChatList, chatListCache } from '../services/chatListService';
import { saveValue } from '../utils/warmCache';
import { warmImages } from '../utils/imageCache';

/** Set after a preload run so screens can skip an immediate duplicate fetch (background refresh stays). */
declare global {
  // eslint-disable-next-line no-var
  var __fomoPreloadedAt: number | undefined;
  // eslint-disable-next-line no-var
  var __fomoPendingCount: number | undefined;
}

let inFlight: Promise<void> | null = null;

export function preloadAppData(userId: string): Promise<void> {
  // De-dupe: INITIAL_SESSION + a quick SIGNED_IN can both fire on startup.
  if (inFlight) return inFlight;
  inFlight = run(userId).finally(() => { inFlight = null; });
  return inFlight;
}

async function run(userId: string): Promise<void> {
  // 1) Profile — one query that feeds both the home header cache and the events warm-up below.
  const profilePromise = supabase
    .from('users')
    .select('display_name, selected_countries, role, avatar_url')
    .eq('id', userId)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) return [] as string[];
      const countries = (data.selected_countries as string[] | null) ?? [];
      const name = data.display_name ? String(data.display_name).split(' ')[0] : '';
      _homeUserCache[userId] = {
        userName: name,
        userAvatarUrl: (data.avatar_url as string | null) ?? null,
        isAdmin: data.role === 'admin',
        selectedCountries: countries,
      };
      return countries;
    });

  // 2) Events — warm the exact keys HomeScreen renders first: the single active country
  //    (activeCountry defaults to selectedCountries[0]) and the full-list fallback.
  const eventsPromise = profilePromise.then(async (countries) => {
    if (!countries.length) return;
    const keysAndFilters = [
      { countries: [countries[0]] },
      { countries },
    ];
    await Promise.allSettled(
      keysAndFilters.map(async (f) => {
        const key = filterKey(f);
        if (_eventsCache[key]?.length) return; // already warm from a previous session
        const events = await EventService.getEvents(f);
        _eventsCache[key] = events;
      })
    );
  });

  // 3) Bell count — same logic as HomeScreen.loadPendingRequests, stashed for an instant badge.
  const pendingPromise = (async () => {
    const { data: myEvents } = await supabase.from('events').select('id').eq('user_id', userId);
    let incoming = 0;
    if (myEvents && myEvents.length) {
      const { data: reqs } = await supabase
        .from('event_join_requests')
        .select('id')
        .in('event_id', myEvents.map((e) => e.id as string))
        .eq('status', 'pending');
      incoming = reqs?.length || 0;
    }
    const lastSeen = getNotifLastSeen(userId);
    const { data: myDecisions } = await supabase
      .from('event_join_requests')
      .select('updated_at')
      .eq('user_id', userId)
      .in('status', ['approved', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(50);
    const unread = (myDecisions || []).filter(
      (d) => new Date(d.updated_at as string).getTime() > lastSeen
    ).length;
    globalThis.__fomoPendingCount = incoming + unread;
  })();

  // 4) Chat list — fetchChatList commits the result into the shared in-memory chatListCache (and
  //    localStorage), which MessagesScreen reads at mount, so tapping "הודעות" is instant.
  const chatPromise = fetchChatList(userId);

  // 5) Map data — warm the pins so the map opens with them already in place (last location can't be
  //    warmed here — it needs GPS — so the map canvas itself still resolves on first open).
  const mapPromise = (async () => {
    const [chabad, admin] = await Promise.all([
      supabase.from('chabad_houses').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_locations').select('*').order('created_at', { ascending: false }),
    ]);
    if (chabad.data) saveValue('mapChabad', chabad.data);
    if (admin.data) saveValue('mapAdmin', admin.data);
  })();

  // 6) Images — once the feed + chat data is warm, cache the images the user sees first (own avatar,
  //    the featured event covers, chat partners' avatars) so a refresh paints them from cache with no
  //    re-download. Kicked off during the splash; the downloads finish in the background.
  const imageWarmPromise = (async () => {
    await Promise.allSettled([profilePromise, eventsPromise, chatPromise]);
    const covers: (string | null | undefined)[] = [];
    const avatars: (string | null | undefined)[] = [_homeUserCache[userId]?.userAvatarUrl];
    const countries = _homeUserCache[userId]?.selectedCountries ?? [];
    if (countries.length) {
      const primary = _eventsCache[filterKey({ countries: [countries[0]] })] ?? [];
      for (const e of primary.slice(0, 8)) { covers.push(e.image_url); avatars.push(e.users?.avatar_url); }
    }
    for (const c of chatListCache.conversations.slice(0, 12)) avatars.push(c.other_user?.avatar_url);
    warmImages(covers, { maxDim: 640 });
    warmImages(avatars, { maxDim: 96 });
  })();

  await Promise.allSettled([profilePromise, eventsPromise, pendingPromise, chatPromise, mapPromise, imageWarmPromise]);
  globalThis.__fomoPreloadedAt = Date.now();
}
