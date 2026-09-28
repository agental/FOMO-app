import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { HomeScreen } from './components/HomeScreen';
const ProfileScreen = lazy(() => import('./components/ProfileScreen'));
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { CreateProfileWizard } from './components/CreateProfileWizard';
import { CountrySelectionScreen } from './components/CountrySelectionScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
// Apple Maps (MapKit JS) is the app's map. Lazy so mapkit loads only when the map tab is first opened.
const AppleMapScreen = lazy(() => import('./components/AppleMapScreen').then(m => ({ default: m.AppleMapScreen })));
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import { savePushToken } from './services/pushToken';
import { preloadAppData } from './boot/preload';
import { fetchChatList } from './services/chatListService';
import type { PlacePayload } from './utils/placeMessage';
// Admin-only + heavy — lazy so regular users never download it.
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
import { isBanned, type BanInfo } from './services/banService';
// Secondary screens — lazy so they're not in the first-paint bundle (each loads on first navigation).
const BanScreen = lazy(() => import('./components/BanScreen').then(m => ({ default: m.BanScreen })));
const MessagesScreen = lazy(() => import('./components/MessagesScreen').then(m => ({ default: m.MessagesScreen })));
const RequestsScreen = lazy(() => import('./components/RequestsScreen').then(m => ({ default: m.RequestsScreen })));
const ChatScreen = lazy(() => import('./components/ChatScreen').then(m => ({ default: m.ChatScreen })));
const SettingsScreen = lazy(() => import('./components/SettingsScreen').then(m => ({ default: m.SettingsScreen })));
const NotificationsScreen = lazy(() => import('./components/NotificationsScreen').then(m => ({ default: m.NotificationsScreen })));
const PrivacyScreen = lazy(() => import('./components/PrivacyScreen').then(m => ({ default: m.PrivacyScreen })));
const AboutScreen = lazy(() => import('./components/AboutScreen').then(m => ({ default: m.AboutScreen })));
const MyEventsScreen = lazy(() => import('./components/MyEventsScreen').then(m => ({ default: m.MyEventsScreen })));
// Launch Mode (pre-launch countdown + referral) — lazy so post-launch users never download it.
const LaunchScreen = lazy(() => import('./components/LaunchScreen').then(m => ({ default: m.LaunchScreen })));
import { fetchLaunchState, shouldShowLaunch, captureReferralFromUrl, claimPendingReferral, type LaunchState } from './services/launchService';
import { loadValue, saveValue, removeValue, flushWrites } from './utils/warmCache';
import { supabase, hardSignOut } from './lib/supabase';
import { OnboardingTour, type TourStep } from './components/OnboardingTour';

// First-run coach-mark tour steps (shown once to new users on their first visit to Home).
const TOUR_STEPS: TourStep[] = [
  { emoji: '👋', title: 'ברוכים הבאים ל-FOMO!', body: 'בוא נעשה סיבוב זריז — 30 שניות, ותכיר את כל מה שאפשר לעשות כאן.' },
  { target: '[data-tour="country-chips"]', emoji: '🌍', title: 'היעדים שלך', body: 'עבור בין מדינות ויעדים כדי לראות מה קורה בכל מקום.' },
  { target: '[data-tour="hot-now"]', emoji: '🔥', title: 'חם עכשיו', body: 'האירועים הכי לוהטים כרגע — החלק לצדדים כדי לגלול ביניהם.' },
  { target: '[data-tour="category-chips"]', emoji: '🎯', title: 'סינון מהיר', body: 'סנן אירועים לפי סוג — מסיבות, טרקים, אוכל ועוד.' },
  { target: '[data-tour="header-search"]', emoji: '🔍', title: 'חיפוש', body: 'מצא אירוע, מקום או עיר תוך שנייה.' },
  { target: '[data-tour="nav-map"]', emoji: '🗺️', title: 'מפה', body: 'גלה אירועים ומקומות סביבך על המפה החיה.' },
  { target: '[data-tour="nav-create"]', emoji: '➕', title: 'צור אירוע', body: 'יש לך משהו מגניב? צור אירוע משלך בכמה קליקים.' },
  { target: '[data-tour="nav-chat"]', emoji: '💬', title: 'צ׳אטים', body: 'דבר עם המשתתפים והמארגנים בצ׳אט של כל אירוע.' },
  { target: '[data-tour="nav-events"]', emoji: '🎫', title: 'האירועים שלי', body: 'כל האירועים שנרשמת אליהם והכרטיסים שלך — במקום אחד.' },
  { emoji: '🎉', title: 'יאללה, מוכנים!', body: 'זהו — אתה מכיר את FOMO. בוא נתחיל לגלות אירועים!' },
];

// Screens worth restoring after a short-background WebView reload (NOT transient/pre-auth flows or admin).
const RESTORABLE_SCREENS: string[] = ['home', 'map', 'messages', 'myEvents', 'requests', 'notifications', 'profile', 'settings', 'about', 'privacy', 'chat', 'userProfile'];
// How recently the app must have been active for the last screen to be restored. Longer than this ⇒ treat
// as a fresh open → Home (approximates "the app was fully closed").
const NAV_RESTORE_WINDOW_MS = 30 * 60 * 1000;

function App() {
  type Screen = 'auth' | 'onboarding' | 'createProfile' | 'country' | 'home' | 'profile' | 'map' | 'admin' | 'userProfile' | 'messages' | 'requests' | 'chat' | 'settings' | 'notifications' | 'privacy' | 'about' | 'myEvents' | 'launch';
  const [splashDone, setSplashDone] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [launchState, setLaunchState] = useState<LaunchState | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null); // set when the signed-in user is banned
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [profileBackScreen, setProfileBackScreen] = useState<Screen>('home');
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number; placeId?: string; place?: PlacePayload } | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatOtherUserId, setChatOtherUserId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);

  // The "+" create button lives on the Home screen. From any other screen it
  // routes back to Home and signals it to open the create sheet.
  const goCreate = () => { setOpenCreate(true); setCurrentScreen('home'); };

  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
    };
  }, []);

  // Capture a referral code from the launch link (`?ref=CODE`) as early as possible — before the
  // OAuth round-trip can reload the page — and strip it from the URL. It's claimed after sign-in.
  useEffect(() => { captureReferralFromUrl(); }, []);

  // Native OAuth bridge: the Expo wrapper opens Google/Apple in the system browser
  // (embedded webviews are blocked by the providers) and calls this back with the
  // access_token + refresh_token from the implicit-flow redirect fragment. setSession
  // establishes the session here → a normal SIGNED_IN event then routes the user.
  useEffect(() => {
    (window as unknown as { __fomoSetSession?: (a: string, r: string) => void }).__fomoSetSession = async (accessToken: string, refreshToken: string) => {
      try {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      } catch (err) {
        console.error('OAuth setSession failed:', err);
      }
    };
  }, []);

  // Push-token bridge: the native wrapper hands us the device's Expo push token; store it so the
  // server can send BACKGROUND notifications (see services/pushToken + the send-push Edge Function).
  useEffect(() => {
    (window as unknown as { __fomoSetPushToken?: (t: string, p?: string) => void }).__fomoSetPushToken =
      (token: string, platform?: string) => { savePushToken(token, platform); };
  }, []);

  // Remember the screen the user came from, so a viewed profile can return there
  useEffect(() => {
    if (currentScreen !== 'userProfile') setProfileBackScreen(currentScreen);
  }, [currentScreen]);

  // Nav restore: continuously snapshot the CURRENT real screen (+ its sub-state) so a WebView reload after a
  // SHORT background returns the user exactly where they were — any screen, not just Home. A truly closed/
  // reclaimed-after-long app opens clean at Home (the snapshot's timestamp is stale → routeAfterAuthOrLaunch
  // ignores it). Transient/pre-auth screens are NOT snapshotted, so the last real screen survives the reload.
  useEffect(() => {
    if (!RESTORABLE_SCREENS.includes(currentScreen)) return;
    saveValue('navSnap', {
      screen: currentScreen,
      conversationId: currentConversationId,
      otherUserId: chatOtherUserId,
      viewingUserId,
      ts: Date.now(),
    });
  }, [currentScreen, currentConversationId, chatOtherUserId, viewingUserId]);

  // NAV RESTORE POLICY: a fresh load (cold launch OR a WebView reload after iOS reclaimed it) always
  // starts at Home — we deliberately do NOT restore the last screen, because guessing it after a
  // reload landed users on the wrong page. "Stay where you were" is handled by NOT reloading the live
  // WebView on a short/medium background (see the native wrapper), so an app kept open in the
  // background resumes exactly in place; a truly closed/reclaimed app opens clean at Home.

  // First-run coach-mark tour: show ONCE when a new user first lands on Home. The "seen" flag goes
  // through warmCache (native-reliable), scoped per user, so it survives reloads/restarts.
  useEffect(() => {
    if (currentScreen !== 'home' || !currentUserId) return;
    if (loadValue<boolean>(`tourSeen:${currentUserId}`, false)) return;
    const t = setTimeout(() => setShowTour(true), 700); // let Home render + settle first
    return () => clearTimeout(t);
  }, [currentScreen, currentUserId]);

  const finishTour = () => {
    if (currentUserId) saveValue<boolean>(`tourSeen:${currentUserId}`, true);
    setShowTour(false);
  };

  // Post-auth routing for a fully-onboarded user: the ONE place launch mode can intercept. The server
  // decides (get_launch_state); admins/bypass/early-access and post-launch users pass straight through.
  // FAILS OPEN — any error sends the user into the app, never traps them on a blank/launch screen.
  // Always lands on Home on a fresh load (see NAV RESTORE POLICY above).
  const routeAfterAuthOrLaunch = async (): Promise<void> => {
    // Attribute a pending ?ref= referral (server-verified; safe no-op if none / already claimed).
    claimPendingReferral().catch(() => {});
    try {
      const state = await fetchLaunchState();
      if (state && shouldShowLaunch(state)) {
        setLaunchState(state);
        setCurrentScreen('launch');
        return;
      }
    } catch { /* fail-open → fall through into the app */ }
    // Restore the last screen after a SHORT-background reload (any restorable screen). A stale snapshot
    // (app was closed / away long) falls through to Home.
    try {
      const snap = loadValue<{ screen?: string; conversationId?: string; otherUserId?: string; viewingUserId?: string; ts?: number } | null>('navSnap', null);
      if (snap?.screen && snap.ts && Date.now() - snap.ts < NAV_RESTORE_WINDOW_MS && RESTORABLE_SCREENS.includes(snap.screen)) {
        if (snap.screen === 'chat') {
          if (snap.conversationId && snap.otherUserId) {
            setCurrentConversationId(snap.conversationId);
            setChatOtherUserId(snap.otherUserId);
            setCurrentScreen('chat');
            return;
          }
        } else if (snap.screen === 'userProfile') {
          if (snap.viewingUserId) {
            setViewingUserId(snap.viewingUserId);
            setCurrentScreen('userProfile');
            return;
          }
        } else {
          setCurrentScreen(snap.screen as Screen);
          return;
        }
      }
    } catch { /* ignore → Home */ }
    setCurrentScreen('home');
  };

  // Refresh session silently when the user returns to the app after being in background. And the
  // MOMENT the app is hidden/backgrounded, force-persist all pending writes (esp. the current-screen
  // snapshot) so a WebView reclaim can't drop the last navigation and restore an older screen.
  useEffect(() => {
    // Stamp the nav snapshot with the moment we go to background, so the restore window measures HOW LONG
    // the user was away (short background → restore that screen; long/closed → Home).
    const stampNav = () => { try { const s = loadValue('navSnap', null) as Record<string, unknown> | null; if (s) saveValue('navSnap', { ...s, ts: Date.now() }); } catch { /* ignore */ } };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {});
      } else {
        stampNav();
        flushWrites();
      }
    };
    const handleHide = () => { stampNav(); flushWrites(); };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handleHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handleHide);
    };
  }, []);

  useEffect(() => {
    // onAuthStateChange fires INITIAL_SESSION once on startup with the current
    // session — this covers normal loads, refreshes, and OAuth redirects.
    // Do NOT call getSession() or exchangeCodeForSession() separately;
    // detectSessionInUrl handles the ?code= / #access_token= automatically,
    // and calling it twice would invalidate the one-time code and trigger SIGNED_OUT.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          handleAuthSuccess(session.user.id, session.user);
        } else {
          setAuthChecked(true); // no session → show auth screen
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        handleAuthSuccess(session.user.id, session.user);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setBanInfo(null); // clear the ban gate so the ban screen doesn't linger after logout
        setCurrentScreen('auth');
        setAuthChecked(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Global realtime notifications — approval/rejection/new-request + new chat messages
  // reach the user immediately on any screen; tapping opens the relevant screen.
  useRealtimeNotifications(
    currentUserId,
    () => setCurrentScreen('requests'),
    () => setCurrentScreen('messages'),
  );

  // Warm the chat list once, as soon as we have a logged-in user. The boot preloader can fire too
  // early on the phone (before Supabase applies the auth token → empty results), so this guaranteed
  // post-auth warm fills the shared in-memory chatListCache that MessagesScreen paints from, making
  // the FIRST tap on "הודעות" instant instead of showing a loading skeleton.
  const chatWarmedRef = useRef<string | null>(null);
  useEffect(() => {
    if (currentUserId && chatWarmedRef.current !== currentUserId) {
      chatWarmedRef.current = currentUserId;
      fetchChatList(currentUserId).catch(() => {});
    }
  }, [currentUserId]);

  const handleAuthSuccess = async (userId: string, sessionUser?: { is_anonymous?: boolean; user_metadata?: Record<string, unknown>; email?: string } | null) => {
    setAuthChecked(true);
    try {
      setCurrentUserId(userId);

      // Prefer the user object already delivered by onAuthStateChange — avoids a blocking
      // getUser() round-trip on every startup. Only AuthScreen (no session object) falls back.
      const user = sessionUser ?? (await supabase.auth.getUser()).data.user;
      const isAnonymous = user?.is_anonymous || false;

      if (isAnonymous) {
        setCurrentScreen('onboarding');
        return;
      }

      // Warm the important data into memory/localStorage while the rest of auth resolves.
      preloadAppData(userId).catch(() => {});

      // For Google/OAuth users — ensure profile exists using their metadata
      const meta = user?.user_metadata || {};
      const googleName    = meta.full_name || meta.name || meta.display_name || '';
      const googleAvatar  = meta.avatar_url || meta.picture || '';
      const googleEmail   = user?.email || '';

      // Admin ban → block access entirely, show the ban screen instead of the app. Kept in its OWN
      // query so the critical profile routing below never breaks if the ban columns aren't migrated yet.
      const { data: banRow } = await supabase
        .from('users').select('banned_until, banned_reason').eq('id', userId).maybeSingle();
      const ban: BanInfo = { until: (banRow as { banned_until?: string | null } | null)?.banned_until ?? null, reason: (banRow as { banned_reason?: string | null } | null)?.banned_reason ?? null };
      if (isBanned(ban)) { setBanInfo(ban); return; }
      setBanInfo(null);

      const { data } = await supabase
        .from('users')
        .select('display_name, selected_countries, profile_completed')
        .eq('id', userId)
        .maybeSingle();

      if (!data) {
        // New user with no row yet — insert their Google profile data, then go to onboarding.
        // (upsert would fail: its ON CONFLICT path touches the API-revoked `email` column.)
        await supabase.from('users').insert({
          id: userId,
          email: googleEmail,
          display_name: googleName || googleEmail.split('@')[0],
          avatar_url: googleAvatar || null,
          role: 'user',
          selected_countries: [],
          is_location_shared: false,
          profile_completed: false,
        });
        setCurrentScreen('onboarding');
        return;
      }

      if (data.profile_completed) {
        if (data.selected_countries && data.selected_countries.length > 0) {
          setSelectedCountries(new Set(data.selected_countries));
          // Launch mode may intercept here (server-decided, fail-open); otherwise return to the last
          // screen the user was on (native-app style), or Home if none saved.
          await routeAfterAuthOrLaunch();
        } else {
          setCurrentScreen('country');
        }
      } else {
        // Mid-signup: if the profile wizard was already started (a saved draft exists), resume it
        // directly instead of dropping the user back at the start of onboarding after a reload.
        const hasDraft = !!loadValue<Record<string, unknown> | null>(`createProfileDraft:${userId}`, null);
        setCurrentScreen(hasDraft ? 'createProfile' : 'onboarding');
      }
    } catch (err) {
      console.error('handleAuthSuccess error:', err);
      // Fall back to onboarding rather than staying on auth
      setCurrentScreen('onboarding');
    }
  };

  const navigateToCountrySelection = () => {
    setPreviousScreen(currentScreen);
    setCurrentScreen('country');
  };

  const toggleCountry = (code: string) => {
    const newSelected = new Set(selectedCountries);
    if (newSelected.has(code)) {
      newSelected.delete(code);
    } else {
      newSelected.add(code);
    }
    setSelectedCountries(newSelected);
  };

  const handleContinue = async () => {
    if (selectedCountries.size > 0 && currentUserId) {
      try {
        const { error } = await supabase
          .from('users')
          .update({
            selected_countries: Array.from(selectedCountries),
            profile_completed: true
          })
          .eq('id', currentUserId);

        if (error) throw error;

        const cameFromInApp = !!previousScreen; // country change from Settings vs. initial onboarding
        setPreviousScreen(null);
        // Initial onboarding funnels through the launch gate (server-decided); a mid-session country
        // change just returns to the app.
        if (cameFromInApp) setCurrentScreen('home');
        else await routeAfterAuthOrLaunch();
      } catch (error) {
        console.error('Error saving countries:', error);
        alert('אירעה שגיאה בשמירת המדינות');
      }
    } else {
      alert('אנא בחר לפחות מדינה אחת');
    }
  };

  const handleMessageUser = async (otherUserId: string) => {
    if (!currentUserId) return;

    try {
      const [smallerId, largerId] = [currentUserId, otherUserId].sort();

      let { data: existingConvo, error: findError } = await supabase
        .from('conversations')
        .select('id')
        .eq('participant_1_id', smallerId)
        .eq('participant_2_id', largerId)
        .maybeSingle();

      if (findError) throw findError;

      if (existingConvo) {
        setCurrentConversationId(existingConvo.id);
        setChatOtherUserId(otherUserId);
        setCurrentScreen('chat');
      } else {
        const { data: newConvo, error: createError } = await supabase
          .from('conversations')
          .insert({
            participant_1_id: smallerId,
            participant_2_id: largerId
          })
          .select('id')
          .single();

        if (createError) throw createError;

        setCurrentConversationId(newConvo.id);
        setChatOtherUserId(otherUserId);
        setCurrentScreen('chat');
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('אירעה שגיאה ביצירת השיחה');
    }
  };














  // Dev/preview hook: open the onboarding flow directly with ?preview=onboarding
  // (harmless in production — regular users never hit this param).
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('preview') === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={() => { window.location.search = ''; }}
        onLogin={() => { window.location.search = ''; }}
      />
    );
  }

  if (!splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }

  if (banInfo && isBanned(banInfo)) {
    return <BanScreen until={banInfo.until} reason={banInfo.reason} />;
  }

  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(160deg, #0A0C12 0%, #111318 60%, #1A0F05 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.1)',
          borderTop: '3px solid #FF6B35',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Rubik, sans-serif', fontSize: 14 }}>
          טוען...
        </p>
      </div>
    );
  }

  if (currentScreen === 'auth') {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  if (currentScreen === 'onboarding') {
    return (
      <OnboardingScreen
        onComplete={() => setCurrentScreen('createProfile')}
        onLogin={() => setCurrentScreen('auth')}
      />
    );
  }

  if (currentScreen === 'createProfile') {
    return (
      <CreateProfileWizard
        userId={currentUserId!}
        onComplete={async () => {
          // Profile (incl. travel countries) is saved in the wizard — go straight to the app.
          if (currentUserId) {
            try {
              const { data } = await supabase.from('users').select('selected_countries').eq('id', currentUserId).maybeSingle();
              if (data?.selected_countries && data.selected_countries.length > 0) {
                setSelectedCountries(new Set(data.selected_countries));
                // Fresh signup complete → funnel through the launch gate (server-decided, fail-open).
                await routeAfterAuthOrLaunch();
                return;
              }
            } catch { /* fall through */ }
          }
          setCurrentScreen('country');
        }}
        onBack={async () => {
          await hardSignOut();
          setCurrentScreen('auth');
        }}
      />
    );
  }

  if (currentScreen === 'country') {
    return (
      <CountrySelectionScreen
        currentUserId={currentUserId}
        selectedCountries={selectedCountries}
        onToggleCountry={toggleCountry}
        onContinue={handleContinue}
        onBack={previousScreen && ['home', 'map', 'messages', 'profile', 'settings'].includes(previousScreen) ? () => setCurrentScreen(previousScreen) : undefined}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => setCurrentScreen('home')}
        currentUserId={currentUserId}
        onNavigateToMap={() => setCurrentScreen('map')}
        onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
        onNavigateToSettings={() => setCurrentScreen('settings')}
        onNavigateToMessages={() => setCurrentScreen('messages')}
        onNavigateToCreate={goCreate}
      />
    );
  }
  if (currentScreen === 'myEvents') {
    return (
      <MyEventsScreen
        currentUserId={currentUserId!}
        onBack={() => setCurrentScreen('home')}
        onHomeClick={() => setCurrentScreen('home')}
        onMapClick={() => setCurrentScreen('map')}
        onCreateClick={goCreate}
        onMessagesClick={() => setCurrentScreen('messages')}
        onNavigateToUserProfile={(userId: string) => {
          setViewingUserId(userId);
          setCurrentScreen('userProfile');
        }}
        onOpenMapAt={(lat: number, lng: number) => { setMapFocus({ latitude: lat, longitude: lng }); setCurrentScreen('map'); }}
      />
    );
  }

  if (currentScreen === 'admin') {
    return (
      <Suspense fallback={null}>
        <AdminDashboard
          currentUserId={currentUserId!}
          onBack={() => setCurrentScreen('home')}
        />
      </Suspense>
    );
  }

  if (currentScreen === 'userProfile' && viewingUserId) {
    return (
      <ProfileScreen
        onBack={() => setCurrentScreen(profileBackScreen)}
        currentUserId={currentUserId}
        onNavigateToMap={() => setCurrentScreen('map')}
        onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
        onNavigateToMessages={() => setCurrentScreen('messages')}
        onNavigateToCreate={goCreate}
        viewUserId={viewingUserId}
        onMessageUser={handleMessageUser}
      />
    );
  }

  if (currentScreen === 'requests') {
    return (
      <RequestsScreen
        currentUserId={currentUserId!}
        onBack={() => setCurrentScreen('home')}
        onHomeClick={() => setCurrentScreen('home')}
        onMapClick={() => setCurrentScreen('map')}
        onCreateClick={goCreate}
        onMessagesClick={() => setCurrentScreen('messages')}
        onMyEventsClick={() => setCurrentScreen('myEvents')}
        onNavigateToUserProfile={(userId: string) => {
          setViewingUserId(userId);
          setCurrentScreen('userProfile');
        }}
        onOpenMapAt={(lat: number, lng: number) => { setMapFocus({ latitude: lat, longitude: lng }); setCurrentScreen('map'); }}
      />
    );
  }

  if (currentScreen === 'settings') {
    return (
      <SettingsScreen
        currentUserId={currentUserId}
        onBack={() => setCurrentScreen('home')}
        onNavigateToHome={() => setCurrentScreen('home')}
        onNavigateToMap={() => setCurrentScreen('map')}
        onNavigateToMessages={() => setCurrentScreen('messages')}
        onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
        onNavigateToCreate={goCreate}
        onNavigateToCountrySelection={navigateToCountrySelection}
        onNavigateToNotifications={() => setCurrentScreen('notifications')}
        onNavigateToPrivacy={() => setCurrentScreen('privacy')}
        onNavigateToAbout={() => setCurrentScreen('about')}
        onReplayTour={() => { if (currentUserId) { removeValue(`tourSeen:${currentUserId}`); removeValue(`msgTourSeen:${currentUserId}`); } setCurrentScreen('home'); setShowTour(true); }}
        onSignOut={() => setCurrentScreen('auth')}
      />
    );
  }

  if (currentScreen === 'notifications') {
    return (
      <NotificationsScreen
        currentUserId={currentUserId}
        onBack={() => setCurrentScreen('settings')}
      />
    );
  }

  if (currentScreen === 'privacy') {
    return (
      <PrivacyScreen
        currentUserId={currentUserId}
        onBack={() => setCurrentScreen('settings')}
      />
    );
  }

  if (currentScreen === 'about') {
    return <AboutScreen onBack={() => setCurrentScreen('settings')} />;
  }

  // Launch Mode — pre-launch countdown + referral hub. Shown only when the server said to (see
  // routeAfterAuthOrLaunch); onEnterApp hands control back to the app once launch is over / access granted.
  if (currentScreen === 'launch' && launchState) {
    return (
      <Suspense fallback={null}>
        <LaunchScreen
          initialState={launchState}
          currentUserId={currentUserId}
          onEnterApp={() => setCurrentScreen('home')}
        />
      </Suspense>
    );
  }

  // Home + Messages + Map rendered together — the Map stays mounted after its first visit so
  // Mapbox doesn't re-initialise (flicker + reload) each time you switch to it from another tab.
  // (Messages used to early-return, which unmounted the map → that was the flicker on Messages→Map.)
  return (
    <>
      {(currentScreen === 'messages' || currentScreen === 'chat') && (
        <MessagesScreen
          currentUserId={currentUserId!}
          onBack={() => setCurrentScreen('home')}
          onConversationClick={(conversationId, otherUserId) => {
            setCurrentConversationId(conversationId);
            setChatOtherUserId(otherUserId);
            setCurrentScreen('chat');
          }}
          onHomeClick={() => setCurrentScreen('home')}
          onMapClick={() => setCurrentScreen('map')}
          onCreateClick={goCreate}
          onMyEventsClick={() => setCurrentScreen('myEvents')}
          onNavigateToCountrySelection={navigateToCountrySelection}
          onOpenMapAt={(lat: number, lng: number, placeId?: string, place?: PlacePayload) => { setMapFocus({ latitude: lat, longitude: lng, placeId, place }); setCurrentScreen('map'); }}
          onNavigateToUserProfile={(userId: string) => { setViewingUserId(userId); setCurrentScreen('userProfile'); }}
          initialCountries={Array.from(selectedCountries)}
        />
      )}
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToProfile={() => setCurrentScreen('profile')}
          onNavigateToMap={() => setCurrentScreen('map')}
          onNavigateToAdmin={() => setCurrentScreen('admin')}
          onNavigateToMessages={() => setCurrentScreen('messages')}
          onNavigateToRequests={() => setCurrentScreen('requests')}
          onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
          onNavigateToCountrySelection={navigateToCountrySelection}
          onNavigateToUserProfile={(userId: string) => {
            setViewingUserId(userId);
            setCurrentScreen('userProfile');
          }}
          onMessageUser={handleMessageUser}
          onOpenMapAt={(lat: number, lng: number, placeId?: string) => { setMapFocus({ latitude: lat, longitude: lng, placeId }); setCurrentScreen('map'); }}
          initialCountries={Array.from(selectedCountries)}
          currentUserId={currentUserId}
          openCreateSignal={openCreate}
          onCreateConsumed={() => setOpenCreate(false)}
        />
      )}
      {showTour && currentScreen === 'home' && (
        <OnboardingTour steps={TOUR_STEPS} onFinish={finishTour} />
      )}
      {/* Apple Maps mounts only while the map tab is open. */}
      {currentScreen === 'map' && (
        <Suspense fallback={null}>
          <ErrorBoundary onBack={() => setCurrentScreen('home')} label="map">
          <AppleMapScreen
            userId={currentUserId!}
            selectedCountries={Array.from(selectedCountries)}
            onBack={() => setCurrentScreen('home')}
            onNavigateToHome={() => setCurrentScreen('home')}
            onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
            onNavigateToMessages={() => setCurrentScreen('messages')}
            onNavigateToUserProfile={(userId: string) => { setViewingUserId(userId); setCurrentScreen('userProfile'); }}
            onMessageUser={handleMessageUser}
            focusLocation={mapFocus}
            onFocusHandled={() => setMapFocus(null)}
          />
          </ErrorBoundary>
        </Suspense>
      )}
      {/* Personal chat is an OVERLAY (not an early-return) so Messages stays mounted behind it — you see
          the chat list through the gap as you swipe the chat away, exactly like the city group chat. */}
      {currentScreen === 'chat' && currentConversationId && chatOtherUserId && (
        <ChatScreen
          conversationId={currentConversationId}
          currentUserId={currentUserId!}
          otherUserId={chatOtherUserId}
          onBack={() => setCurrentScreen('messages')}
          onOpenMapAt={(lat: number, lng: number, placeId?: string, place?: PlacePayload) => { setMapFocus({ latitude: lat, longitude: lng, placeId, place }); setCurrentScreen('map'); }}
          onNavigateToUserProfile={(userId: string) => {
            setViewingUserId(userId);
            setCurrentScreen('userProfile');
          }}
        />
      )}
    </>
  );
}

export default App;
