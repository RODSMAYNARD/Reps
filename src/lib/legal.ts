import { router } from 'expo-router';
import { Linking } from 'react-native';
import { PRIVACY_URL, TERMS_URL } from './constants';

/** Termos de uso: o EULA padrão da Apple (página da Apple). */
export const openTerms = () => { Linking.openURL(TERMS_URL).catch(() => {}); };

/** Política de privacidade: a página publicada quando existir (`PRIVACY_URL`); até lá, a tela do próprio app (`/privacy`), que abre também sem conta. */
export const openPrivacy = () => { if (PRIVACY_URL) Linking.openURL(PRIVACY_URL).catch(() => {}); else router.push('/privacy'); };
