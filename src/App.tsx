import { useState, useEffect } from 'react';
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
import { supabase } from './lib/supabase';

function App() {
  type Screen = 'auth' | 'onboarding' | 'createProfile' | 'profileComplete' | 'country' | 'home' | 'profile' | 'map' | 'admin' | 'userProfile' | 'messages' | 'requests' | 'chat' | 'settings';
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');
  const [authChecked, setAuthChecked] = useState(false);
  const [previousScreen, setPreviousScreen] = useState<Screen | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [viewingUserId, setViewingUserId] = useState<string | null>(null);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [chatOtherUserId, setChatOtherUserId] = useState<string | null>(null);

  useEffect(() => {
    document.body.style.overflowX = 'hidden';
    document.documentElement.style.overflowX = 'hidden';
    return () => {
      document.body.style.overflowX = '';
      document.documentElement.style.overflowX = '';
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
    return <OnboardingScreen onComplete={() => setCurrentScreen('createProfile')} />;
  }

  if (currentScreen === 'createProfile') {
    return (
      <CreateProfileWizard
        userId={currentUserId!}
        onComplete={() => setCurrentScreen('profileComplete')}
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
        onBack={previousScreen === 'home' ? () => setCurrentScreen('home') : undefined}
      />
    );
  }

  if (currentScreen === 'profile') {
    return (
      <ProfileScreen
        onBack={() => setCurrentScreen('home')}
        currentUserId={currentUserId}
        onNavigateToMap={() => setCurrentScreen('map')}
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
        onNavigateToSettings={() => setCurrentScreen('settings')}
        onNavigateToMessages={() => setCurrentScreen('messages')}
        onNavigateToUserProfile={(userId: string) => {
          setViewingUserId(userId);
          setCurrentScreen('userProfile');
        }}
        onMessageUser={handleMessageUser}
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
        onBack={() => setCurrentScreen('home')}
        currentUserId={currentUserId}
        onNavigateToMap={() => setCurrentScreen('map')}
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
        onCreateClick={() => {}}
        onSettingsClick={() => setCurrentScreen('settings')}
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
        onCreateClick={() => {}}
        onMessagesClick={() => setCurrentScreen('messages')}
        onSettingsClick={() => setCurrentScreen('settings')}
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
        onSignOut={() => setCurrentScreen('auth')}
      />
    );
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
      onNavigateToSettings={() => setCurrentScreen('settings')}
      onNavigateToCountrySelection={navigateToCountrySelection}
      onNavigateToUserProfile={(userId: string) => {
        setViewingUserId(userId);
        setCurrentScreen('userProfile');
      }}
      onMessageUser={handleMessageUser}
      initialCountries={Array.from(selectedCountries)}
      currentUserId={currentUserId}
    />
  );
}

export default App;
