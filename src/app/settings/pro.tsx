import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Btn, Dialog, Header, Screen, TextLink } from '../../components/ui';
import { Paywall } from '../../components/Paywall';
import { SUPPORT_EMAIL } from '../../lib/constants';
import { openPrivacy, openTerms } from '../../lib/legal';
import { manageSubscription, restore, usePro } from '../../lib/purchases';
import { colors } from '../../lib/theme';

/** Assinante ativo: status + gerenciar assinatura (nada de planos nem "Subscribe" para quem já paga). */
function Member() {
  const [dlg, setDlg] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 6, paddingTop: 12 }}>
        <Ionicons name="trophy" size={48} color={colors.warn} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{"You're a Reps Pro member"}</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>All Pro features are unlocked. Thanks for supporting Reps!</Text>
      </View>
      <Btn title="Manage subscription" onPress={async () => { if (!(await manageSubscription())) setDlg('Could not open your subscription settings. Open them in your app store account.'); }} testID="pro-manage" />
      <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>Change plan or cancel in your app store account.</Text>
      <Btn title="Back" variant="secondary" onPress={() => router.back()} />
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <Text style={{ color: colors.muted }}>Problems with your subscription?</Text>
        <TextLink title="Contact us" onPress={() => { Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {}); }} />
        <TextLink title="Restore purchases" onPress={async () => { const r = await restore(); setDlg(r === 'ok' ? 'Purchases restored. Welcome back!' : r === 'none' ? 'No purchases found to restore.' : r === 'preview' ? 'Nothing to restore right now.' : 'Could not restore purchases. Try again.'); }} />
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 4 }}>
          <TextLink title="Terms of Use" onPress={openTerms} />
          <TextLink title="Privacy Policy" onPress={openPrivacy} />
        </View>
      </View>
      <Dialog visible={!!dlg} message={dlg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(null) }]} />
    </ScrollView>
  );
}

export default function Pro() {
  const isPro = usePro();
  return (
    <Screen>
      <Header title="Reps Pro" />
      {isPro ? <Member /> : <Paywall source="settings" freeLabel="Back" onContinueFree={() => router.back()} onPurchased={() => router.back()} />}
    </Screen>
  );
}
