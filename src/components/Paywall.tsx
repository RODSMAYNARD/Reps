import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, radius } from '../lib/theme';
import { Btn, Dialog, TextLink } from './ui';

const BENEFITS = ['Unlimited routines', 'Advanced stats by muscle', 'Progress charts for every exercise', 'Export all your data', 'No ads'];
const PLANS = [
  { id: 'month', title: 'Monthly', price: '$4.99 / month', note: '' },
  { id: 'year', title: 'Yearly', price: '$29.99 / year', note: 'Save 50%' },
  { id: 'life', title: 'Lifetime', price: '$69.99 one-time', note: 'Pay once' },
];
const FAQ = [
  ['What does Reps Pro include?', 'Unlimited routines, advanced stats, per-exercise charts, and data export.'],
  ['Is it a one-time payment or does it renew?', 'Monthly and yearly plans renew automatically. Lifetime is a one-time payment.'],
  ['Can I cancel anytime?', 'Yes. You cancel in the app store and keep access until the end of the paid period.'],
  ['Can I get a refund?', 'Refunds are handled by the app store where the purchase was made.'],
  ['Can I switch plans?', 'Yes, anytime from your app store account.'],
  ['What if I get a new device?', 'Log in with the same account and use “Restore purchases”.'],
];

export function Paywall({ onContinueFree, freeLabel = 'Continue for free' }: { onContinueFree: () => void; freeLabel?: string }) {
  const [plan, setPlan] = useState('year');
  const [open, setOpen] = useState<number | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ alignItems: 'center', gap: 6, paddingVertical: 10 }}>
        <Ionicons name="trophy" size={48} color={colors.warn} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>Reps Pro</Text>
        <Text style={{ color: colors.muted, textAlign: 'center' }}>Unlock everything to track your progress.</Text>
      </View>
      <View style={{ gap: 10 }}>
        {BENEFITS.map((b) => (
          <View key={b} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={{ color: colors.text, fontSize: 15 }}>{b}</Text>
          </View>
        ))}
      </View>
      {PLANS.map((p) => (
        <Pressable key={p.id} onPress={() => setPlan(p.id)} style={{ borderWidth: 2, borderColor: plan === p.id ? colors.primary : colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Ionicons name={plan === p.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={plan === p.id ? colors.primary : colors.faint} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{p.title}</Text>
            <Text style={{ color: colors.muted }}>{p.price}</Text>
          </View>
          {!!p.note && <Text style={{ color: colors.success, fontWeight: '600' }}>{p.note}</Text>}
        </Pressable>
      ))}
      <Btn title="Subscribe" onPress={() => setDlg('Purchases are not active in this version yet. Payments will be enabled once the app is published in the stores.')} />
      <Btn title={freeLabel} variant="secondary" onPress={onContinueFree} />
      <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.text, marginTop: 10 }}>Any questions?</Text>
      {FAQ.map(([q, a], i) => (
        <Pressable key={q} onPress={() => setOpen(open === i ? null : i)} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ flex: 1, color: colors.text, fontSize: 15 }}>{q}</Text>
            <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={18} color={colors.text} />
          </View>
          {open === i && <Text style={{ color: colors.muted }}>{a}</Text>}
        </Pressable>
      ))}
      <View style={{ alignItems: 'center', gap: 8, paddingTop: 6 }}>
        <Text style={{ color: colors.muted }}>Problems with your subscription?</Text>
        <TextLink title="Contact us" onPress={() => Linking.openURL('mailto:rodrigo.maynard@gmail.com')} />
        <TextLink title="Restore purchases" onPress={() => setDlg('No purchases found to restore.')} />
      </View>
      <Dialog visible={!!dlg} message={dlg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(null) }]} />
    </ScrollView>
  );
}
