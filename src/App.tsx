import { useState, useEffect } from 'react';
import { SplashScreen } from './components/SplashScreen';
import { HomeScreen } from './components/HomeScreen';
import ProfileScreen from './components/ProfileScreen';
import { AuthScreen } from './components/AuthScreen';
import { OnboardingScreen } from './components/OnboardingScreen';
import { CreateProfileWizard } from './components/CreateProfileWizard';
import { ProfileCompletionScreen } from './components/ProfileCompletionScreen';
import { CountrySelectionScreen } from './components/CountrySelectionScreen';
import { MapScreen } from './components/MapScreen';
import { AdminDashboard } from './components/AdminDashboard';
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
  type Screen = 'auth' | 'onboarding' | 'createProfile' | 'profileComplete' | 'country' | 'home' | 'profile' | 'map' | 'admin' | 'userProfile' | 'messages' | 'requests' | 'chat' | 'settings' | 'notifications' | 'privacy' | 'about' | 'myEvents';
  const [splashDone, setSplashDone] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [authChecked, setAuthChecked] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [profileBackScreen, setProfileBackScreen] = useState<Screen>('home');
  const [mapFocus, setMapFocus] = useState<{ latitude: number; longitude: number } | null>(null);
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

  // Remember the screen the user came from, so a viewed profile can return there
  useEffect(() => {
    if (currentScreen !== 'userProfile') setProfileBackScreen(currentScreen);
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
          handleAuthSuccess(session.user.id);
        } else {
          setAuthChecked(true); // no session → show auth screen
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        handleAuthSuccess(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUserId(null);
        setCurrentScreen('auth');
        setAuthChecked(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleAuthSuccess = async (userId: string) => {
    setAuthChecked(true);
    try {
      setCurrentUserId(userId);

      const { data: { user } } = await supabase.auth.getUser();
      const isAnonymous = user?.is_anonymous || false;

      if (isAnonymous) {
        setCurrentScreen('onboarding');
        return;
      }

      // For Google/OAuth users — ensure profile exists using their metadata
      const meta = user?.user_metadata || {};
      const googleName    = meta.full_name || meta.name || meta.display_name || '';
      const googleAvatar  = meta.avatar_url || meta.picture || '';
      const googleEmail   = user?.email || '';

      const { data } = await supabase
        .from('users')
        .select('display_name, selected_countries, profile_completed')
        .eq('id', userId)
        .maybeSingle();

      if (!data) {
        // New user — upsert their Google profile data then go to onboarding
        await supabase.from('users').upsert({
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
        onComplete={() => setCurrentScreen('profileComplete')}
        onBack={async () => {
          await supabase.auth.signOut();
          setCurrentScreen('auth');
        }}
      />
    );
  }

  if (currentScreen === 'profileComplete') {
    return (
      <ProfileCompletionScreen
        userId={currentUserId!}
        onContinue={() => setCurrentScreen('country')}
      />
    );
  }

  if (currentScreen === 'country') {
    return (
      <CountrySelectionScreen
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

  if (currentScreen === 'map') {
    return (
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
        onNavigateToCreate={goCreate}
        viewUserId={viewingUserId}
        onMessageUser={handleMessageUser}
      />
    );
  }

  if (currentScreen === 'messages') {
    return (
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

  if (currentScreen === 'chat' && currentConversationId && chatOtherUserId) {
    return (
      <ChatScreen
        conversationId={currentConversationId}
        currentUserId={currentUserId!}
        otherUserId={chatOtherUserId}
        onBack={() => setCurrentScreen('messages')}
      />
    );
  }

  return (
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
      onOpenMapAt={(lat: number, lng: number) => { setMapFocus({ latitude: lat, longitude: lng }); setCurrentScreen('map'); }}
      initialCountries={Array.from(selectedCountries)}
      currentUserId={currentUserId}
      openCreateSignal={openCreate}
      onCreateConsumed={() => setOpenCreate(false)}
    />
  );
}

export default App;
