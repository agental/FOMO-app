import { supabase } from '../lib/supabase';

/*
  Stores the device's Expo push token so the server (send-push Edge Function) can reach the user with
  BACKGROUND notifications. The native wrapper hands us the token via window.__fomoSetPushToken (App.tsx).
  The token can arrive before OR after the Supabase session is ready, so we try immediately and again on
  any auth event that carries a session.
*/

let lastToken: string | null = null;
let lastPlatform: string | null = null;
let saved = false;

async function tryRegister(): Promise<void> {
  if (!lastToken || saved) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return; // not logged in yet — the auth listener below retries after sign-in
    const { error } = await supabase.rpc('register_push_token', { p_token: lastToken, p_platform: lastPlatform });
    if (error) { console.error('register_push_token error:', error.message); return; }
    saved = true;
  } catch (e) {
    console.error('savePushToken failed:', e);
  }
}

export async function savePushToken(token: string, platform?: string | null): Promise<void> {
  if (!token) return;
  if (token !== lastToken) saved = false; // a new token must be (re)saved
  lastToken = token;
  lastPlatform = platform ?? null;
  await tryRegister();
}

// Every auth event that carries a session is another chance to flush a token that arrived early.
supabase.auth.onAuthStateChange((_event, session) => {
  if (session) tryRegister();
});
