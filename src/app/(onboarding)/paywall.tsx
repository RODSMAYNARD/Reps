import { Header, Screen } from '../../components/ui';
import { Paywall } from '../../components/Paywall';
import { useStore } from '../../lib/store';

export default function OnboardingPaywall() {
  const { saveProfile } = useStore();
  return (
    <Screen>
      <Header title="" />
      <Paywall onContinueFree={() => saveProfile({ onboarded: true })} />
    </Screen>
  );
}
