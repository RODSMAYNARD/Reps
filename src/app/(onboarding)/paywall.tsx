import { Header, Screen } from '../../components/ui';
import { track } from '../../lib/analytics';
import { Paywall } from '../../components/Paywall';
import { useStore } from '../../lib/store';

export default function OnboardingPaywall() {
  const { saveProfile } = useStore();
  return (
    <Screen>
      <Header title="" />
      <Paywall source="onboarding" onContinueFree={() => { track('onboarding_completed', { plan: 'free' }); saveProfile({ onboarded: true }); }} />
    </Screen>
  );
}
