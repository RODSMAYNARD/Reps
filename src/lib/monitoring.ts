import * as Sentry from '@sentry/react-native';

/** Relatório de erros e travamentos (Sentry). Sem DSN (EXPO_PUBLIC_SENTRY_DSN) fica desligado. */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const sentryOn = !!DSN;
Sentry.init({ dsn: DSN, enabled: !!DSN, tracesSampleRate: 0.2, sendDefaultPii: false, debug: false });

export const setMonitoringUser = (id: string | null) => { try { Sentry.setUser(id ? { id } : null); } catch { /* idem */ } };
export const reportError = (e: unknown, ctx?: Record<string, string>) => { try { Sentry.captureException(e, ctx ? { tags: ctx } : undefined); } catch { /* idem */ } };
export const wrapRoot = Sentry.wrap;
