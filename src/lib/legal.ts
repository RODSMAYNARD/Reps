import { router } from 'expo-router';
import { Linking, Platform } from 'react-native';
import { OWN_TERMS_URL, PRIVACY_URL, TERMS_URL } from './constants';

/** Termos de uso: no iOS, o EULA padrão da Apple (App Store 3.1.2); no Android/web, os termos próprios (`OWN_TERMS_URL` quando publicado; até lá, a tela `/terms`, que abre também sem conta). */
export const openTerms = () => {
  if (Platform.OS === 'ios') { Linking.openURL(TERMS_URL).catch(() => {}); return; }
  if (OWN_TERMS_URL) Linking.openURL(OWN_TERMS_URL).catch(() => {}); else router.push('/terms');
};

/** Política de privacidade: a página publicada quando existir (`PRIVACY_URL`); até lá, a tela do próprio app (`/privacy`), que abre também sem conta. */
export const openPrivacy = () => { if (PRIVACY_URL) Linking.openURL(PRIVACY_URL).catch(() => {}); else router.push('/privacy'); };
