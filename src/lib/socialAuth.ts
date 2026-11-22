// Login nativo com Apple (iOS). O token da Apple vai direto ao Supabase (signInWithIdToken),
// provedor Apple ligado com Client ID = bundle id. Módulo carregado com try/require:
// build antigo sem o módulo nativo simplesmente não mostra o botão.
import { Platform } from 'react-native';
import { track } from './analytics';
import { supabase } from './supabase';

let Apple: typeof import('expo-apple-authentication') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { Apple = require('expo-apple-authentication'); } catch { Apple = null; }

let G: typeof import('@react-native-google-signin/google-signin') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { G = require('@react-native-google-signin/google-signin'); } catch { G = null; }

// IDs públicos do projeto Google Cloud "Reps" (infra-filament-473001-j9). Web = o que o Supabase confere.
const GOOGLE_WEB_CLIENT = '344092833336-2jepsbs9j6jf22bq10hss4estctduboi.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT = '344092833336-gkn0bpmf87jhmmfrhfbnl85asq32unpf.apps.googleusercontent.com';
let gReady = false;
try { if (G && Platform.OS !== 'web') { G.GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT, iosClientId: GOOGLE_IOS_CLIENT }); gReady = true; } } catch { gReady = false; }

export const googleAvailable = gReady;

/** null = entrou; '' = cancelado; texto = erro. */
export async function signInWithGoogle(): Promise<string | null> {
  if (!G || !gReady) return 'Google sign-in needs the latest app version.';
  try {
    await G.GoogleSignin.hasPlayServices();
    const res = await G.GoogleSignin.signIn();
    if (res.type !== 'success') return '';
    const token = res.data.idToken;
    if (!token) return 'Google did not return a sign-in token.';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token });
    if (error) { track('login_failed', { method: 'google' }); return error.message; }
    track('login', { method: 'google' });
    return null;
  } catch (e: any) {
    if (G.isErrorWithCode?.(e) && e.code === G.statusCodes.SIGN_IN_CANCELLED) return '';
    return e?.message ?? 'Google sign-in failed.';
  }
}

export const appleAvailable = Platform.OS === 'ios' && !!Apple;

/** null = entrou; '' = cancelado pelo usuário; texto = erro para mostrar. */
export async function signInWithApple(): Promise<string | null> {
  if (!Apple) return 'Sign in with Apple needs the latest app version.';
  try {
    const cred = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
    });
    if (!cred.identityToken) return 'Apple did not return a sign-in token.';
    const { error } = await supabase.auth.signInWithIdToken({ provider: 'apple', token: cred.identityToken });
    if (error) { track('login_failed', { method: 'apple' }); return error.message; }
    track('login', { method: 'apple' });
    return null;
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED') return '';
    return e?.message ?? 'Sign in with Apple failed.';
  }
}
