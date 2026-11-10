import { useRef } from 'react';
import { Header, Screen } from '../../components/ui';
import { track } from '../../lib/analytics';
import { Paywall } from '../../components/Paywall';
import { usePro } from '../../lib/purchases';
import { useStore } from '../../lib/store';

export default function OnboardingPaywall() {
  const { saveProfile } = useStore();
  const isPro = usePro();
  const busy = useRef(false);
  /** Conclui o onboarding. Se não gravar (sem internet, erro), o `saveProfile` mostra o erro e a pessoa continua aqui para tentar de novo. */
  const finish = async (plan: 'free' | 'pro') => {
    if (busy.current) return;
    busy.current = true;
    const ok = await saveProfile({ onboarded: true });
    busy.current = false;
    if (ok) track('onboarding_completed', { plan });
  };
  return (
    <Screen>
      <Header title="" />
      <Paywall source="onboarding" onContinueFree={() => finish(isPro ? 'pro' : 'free')} onPurchased={() => finish('pro')} />
    </Screen>
  );
}
