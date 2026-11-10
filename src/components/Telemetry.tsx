import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
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
  /** Último usuário ligado: ao abrir o app a sessão começa nula, e isso não é "sair" (zerar criaria ids anônimos novos e o assinante pareceria grátis). */
  const prev = useRef<string | null>(null);
  useEffect(() => {
    if (uid) { identifyUser(uid); setMonitoringUser(uid); rcLogin(uid); }
    else if (prev.current) { resetAnalytics(); setMonitoringUser(null); rcLogout(); }
    prev.current = uid;
  }, [uid]);
  useEffect(() => { if (path) trackScreen(path); }, [path]);
  return null;
}
