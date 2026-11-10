import { router } from 'expo-router';
import { Header, Screen } from '../../components/ui';
import { Paywall } from '../../components/Paywall';

export default function Pro() {
  return (
    <Screen>
      <Header title="Reps Pro" />
      <Paywall source="settings" freeLabel="Back" onContinueFree={() => router.back()} onPurchased={() => router.back()} />
    </Screen>
  );
}
