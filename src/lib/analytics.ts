import PostHog from 'posthog-react-native';

/** Análise de produto (PostHog). Sem chave (EXPO_PUBLIC_POSTHOG_KEY) tudo vira no-op, então o app roda igual em desenvolvimento. */
const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';
export type Props = Record<string, string | number | boolean | null | string[]>;

let client: PostHog | null = null;
const ph = () => {
  if (!KEY) return null;
  if (!client) client = new PostHog(KEY, { host: HOST, captureAppLifecycleEvents: true, flushAt: 10, flushInterval: 15000 });
  return client;
};

export const analyticsOn = !!KEY;
export const track = (event: string, props?: Props) => { try { ph()?.capture(event, props); } catch { /* análise nunca derruba o app */ } };
export const trackScreen = (name: string) => { try { ph()?.screen(name); } catch { /* idem */ } };
/** Usa o id do Supabase (sem e-mail) para ligar PostHog, RevenueCat e Sentry ao mesmo usuário. */
export const identifyUser = (id: string, props?: Props) => { try { ph()?.identify(id, props); } catch { /* idem */ } };
export const resetAnalytics = () => { try { ph()?.reset(); } catch { /* idem */ } };
export const flushAnalytics = () => { try { ph()?.flush(); } catch { /* idem */ } };
