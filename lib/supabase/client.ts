/**
 * Supabase client (React Native / Expo).
 *
 * Single shared client for the customer app. Session is persisted in
 * AsyncStorage and auto-refreshed while the app is foregrounded (RN best
 * practice — see the Supabase Expo guide). `detectSessionInUrl` is off (no
 * web redirect flow on native). URL/anon key come from EXPO_PUBLIC_* env
 * (public by design); the anon key only grants what RLS allows.
 *
 * Reads/writes go through the repository layer (lib/data/*), not this client
 * directly — keep `supabase` imports confined to lib/.
 */

import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — run `npx supabase start` and set them in .env.local',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web OAuth returns to the site with ?code=… — let supabase-js pick it up
    // and complete the PKCE exchange. Native exchanges the code manually.
    detectSessionInUrl: Platform.OS === 'web',
    // PKCE for the mobile OAuth flow (code exchanged via exchangeCodeForSession).
    flowType: 'pkce',
  },
});

// Refresh the session only while the app is in the foreground.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
