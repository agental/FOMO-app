import { useState, useEffect, useRef } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { HomeScreen } from './components/HomeScreen';
import ProfileScreen from './components/ProfileScreen';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { CreateProfileWizard } from './components/CreateProfileWizard';
import { CountrySelectionScreen } from './components/CountrySelectionScreen';
import { MapScreen } from './components/MapScreen';
import { useRealtimeNotifications } from './hooks/useRealtimeNotifications';
import { savePushToken } from './services/pushToken';
import { preloadAppData } from './boot/preload';
import { fetchChatList } from './services/chatListService';
import type { PlacePayload } from './utils/placeMessage';
import { AdminDashboard } from './components/AdminDashboard';
import { BanScreen } from './components/BanScreen';
import { isBanned, type BanInfo } from './services/banService';
import { MessagesScreen } from './components/MessagesScreen';
import { RequestsScreen } from './components/RequestsScreen';
import { ChatScreen } from './components/ChatScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { NotificationsScreen } from './components/NotificationsScreen';
import { PrivacyScreen } from './components/PrivacyScreen';
import { AboutScreen } from './components/AboutScreen';
import { MyEventsScreen } from './components/MyEventsScreen';
import { supabase } from './lib/supabase';

function App() {
  type Screen = 'auth' | 'onboarding' | 'createProfile' | 'country' | 'home' | 'profile' | 'map' | 'admin' | 'userProfile' | 'messages' | 'requests' | 'chat' | 'settings' | 'notifications' | 'privacy' | 'about' | 'myEvents';
  const [splashDone, setSplashDone] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [authChecked, setAuthChecked] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null); // set when the signed-in user is banned
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [profileBackScreen, setProfileBackScreen] = useState<Screen>('home');
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number; placeId?: string; place?: PlacePayload } | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatOtherUserId, setChatOtherUserId] = useState<string | null>(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);

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
    if (currentScreen === 'map') setMapMounted(true);
  }, [currentScreen]);

  // Refresh session silently when the user returns to the app after being in background
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        supabase.auth.getSession().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
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
          setCurrentScreen('home');
        } else {
          setCurrentScreen('country');
        }
      } else {
        setCurrentScreen('onboarding');
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

        setPreviousScreen(null);
        setCurrentScreen('home');
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
                setCurrentScreen('home');
                return;
              }
            } catch { /* fall through */ }
          }
          setCurrentScreen('country');
        }}
        onBack={async () => {
          await supabase.auth.signOut();
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
      />
    );
  }

  if (currentScreen === 'admin') {
    return (
      <AdminDashboard
        currentUserId={currentUserId!}
        onBack={() => setCurrentScreen('home')}
      />
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
      {mapMounted && (
        <div style={{
          position: 'fixed', inset: 0,
          zIndex: currentScreen === 'map' ? 100 : -1,
          visibility: currentScreen === 'map' ? 'visible' : 'hidden',
          pointerEvents: currentScreen === 'map' ? 'auto' : 'none',
        }}>
          <MapScreen
            userId={currentUserId!}
            selectedCountries={Array.from(selectedCountries)}
            onBack={() => setCurrentScreen('home')}
            onNavigateToHome={() => setCurrentScreen('home')}
            onNavigateToMyEvents={() => setCurrentScreen('myEvents')}
            onNavigateToMessages={() => setCurrentScreen('messages')}
            onNavigateToUserProfile={(userId: string) => {
              setViewingUserId(userId);
              setCurrentScreen('userProfile');
            }}
            onMessageUser={handleMessageUser}
            focusLocation={mapFocus}
            onFocusHandled={() => setMapFocus(null)}
          />
        </div>
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
