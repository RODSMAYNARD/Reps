import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { identifyUser, resetAnalytics, trackScreen } from '../lib/analytics';
import { setMonitoringUser } from '../lib/monitoring';
import { rcLogin, rcLogout, setupPurchases } from '../lib/purchases';
import { useStore } from '../lib/store';

setupPurchases();

/** Liga o mesmo usuário (id do Supabase, sem e-mail) no PostHog, Sentry e RevenueCat e registra as telas. Não desenha nada. */
export function Telemetry() {
  const { session } = useStore();
  const uid = session?.user.id ?? null;
  const path = usePathname();
  useEffect(() => {
    if (uid) { identifyUser(uid); setMonitoringUser(uid); rcLogin(uid); }
    else { resetAnalytics(); setMonitoringUser(null); rcLogout(); }
  }, [uid]);
  useEffect(() => { if (path) trackScreen(path); }, [path]);
  return null;
}
