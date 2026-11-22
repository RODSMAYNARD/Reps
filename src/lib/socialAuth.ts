// Login nativo com Apple (iOS). O token da Apple vai direto ao Supabase (signInWithIdToken),
// provedor Apple ligado com Client ID = bundle id. Módulo carregado com try/require:
// build antigo sem o módulo nativo simplesmente não mostra o botão.
import { Platform } from 'react-native';
import { track } from './analytics';
import { supabase } from './supabase';

let Apple: typeof import('expo-apple-authentication') | null = null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
try { Apple = require('expo-apple-authentication'); } catch { Apple = null; }

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
