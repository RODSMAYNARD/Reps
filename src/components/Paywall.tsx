import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { track } from '../lib/analytics';
import { Offers, Plan, buy, loadOffers, mockPrices, money, rcEnabled, restore, usePro } from '../lib/purchases';
import { colors, radius } from '../lib/theme';
import { Btn, Dialog, TextLink } from './ui';

const BENEFITS = ['Unlimited routines', 'Personalized Trainer programs', 'Advanced stats and monthly reports', 'Progress charts for every exercise', 'Export all your data'];
const FAQ = [
  ['What does Reps Pro include?', 'Unlimited routines, the Trainer, advanced stats, per-exercise charts, and data export.'],
  ['How does the free trial work?', 'The yearly plan starts with 7 days free. You can cancel before it ends and you will not be charged.'],
  ['Can I cancel anytime?', 'Yes. You cancel in the app store and keep access until the end of the paid period.'],
  ['Can I get a refund?', 'Refunds are handled by the app store where the purchase was made.'],
  ['Can I switch plans?', 'Yes, anytime from your app store account.'],
  ['What if I get a new device?', 'Log in with the same account and use “Restore purchases”.'],
];

/** Texto de preço de um plano: usa o preço real da loja (RevenueCat) quando existe, senão o preço de exemplo. */
function useLabels(offers: Offers | null) {
  const m = mockPrices();
  const real = (p: Plan) => offers?.[p]?.product.priceString;
  const per = (p: Plan, n: number) => offers?.[p] ? `${offers[p]!.product.currencyCode} ${(offers[p]!.product.price / 12).toFixed(2)}` : money(n / 12, m.region);
  return {
    month: real('month') ?? money(m.month, m.region),
    year: real('year') ?? money(m.year, m.region),
    offer: real('offer') ?? money(m.offer, m.region),
    yearPerMonth: per('year', m.year),
    offerPerMonth: per('offer', m.offer),
    monthFull: money(m.month * 12, m.region),
    yearFull: money(m.year, m.region),
  };
}

export function Paywall({ onContinueFree, freeLabel = 'Continue for free', source = 'paywall' }: { onContinueFree: () => void; freeLabel?: string; source?: string }) {
  const [plan, setPlan] = useState<Plan>('year');
  const [open, setOpen] = useState<number | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offers | null>(null);
  const [exit, setExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);
  const isPro = usePro();
  const L = useLabels(offers);
  useEffect(() => { track('paywall_viewed', { source, mode: rcEnabled ? 'live' : 'preview' }); loadOffers().then(setOffers); }, [source]);

  const pay = async (p: Plan) => {
    setBusy(true);
    const r = await buy(p, offers);
    setBusy(false);
    setExit(false);
    if (r === 'ok') { setDlg('Welcome to Reps Pro! 🎉'); return; }
    if (r === 'preview') setDlg(__DEV__ ? 'Preview mode: real purchases turn on as soon as the store products and RevenueCat keys are configured. Prices shown here are examples.' : "Purchases aren't available right now. Please try again later.");
    if (r === 'error') setDlg('The purchase could not be completed. You were not charged.');
  };
  const leave = () => {
    if (!shown.current && !isPro) { shown.current = true; track('exit_offer_viewed', { source }); setExit(true); return; }
    track('paywall_dismissed', { source });
    onContinueFree();
  };
  const choose = (p: Plan) => { setPlan(p); track('paywall_plan_selected', { plan: p }); };

  const card = ({ id, title, price, sub, badge }: { id: Plan; title: string; price: string; sub: string; badge?: string }) => (
    <View key={id}>
    <Pressable onPress={() => choose(id)} testID={`plan-${id}`} style={{ borderWidth: 2, borderColor: plan === id ? colors.primary : colors.border, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Ionicons name={plan === id ? 'radio-button-on' : 'radio-button-off'} size={22} color={plan === id ? colors.primary : colors.faint} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{title}</Text>
        <Text style={{ color: colors.text }}>{price}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{sub}</Text>
      </View>
      {!!badge && <View style={{ backgroundColor: colors.success, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{badge}</Text></View>}
    </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={{ alignItems: 'flex-start' }}>
          <Pressable onPress={leave} hitSlop={12} testID="paywall-close" style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={22} color={colors.text} /></Pressable>
        </View>
        <View style={{ alignItems: 'center', gap: 6 }}>
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
        {card({ id: 'year', title: 'Yearly', price: `7 days free, then ${L.year} / year`, sub: `${L.yearPerMonth} / month · ${L.monthFull} if paid monthly`, badge: 'SAVE 20%' })}
        {card({ id: 'month', title: 'Monthly', price: `${L.month} / month`, sub: 'No free trial. Cancel anytime.' })}
        <Btn title={plan === 'year' ? 'Start 7-day free trial' : 'Subscribe'} loading={busy} onPress={() => pay(plan)} testID="paywall-subscribe" />
        <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{plan === 'year' ? `Free for 7 days, then ${L.year} per year.` : `${L.month} per month.`} Renews automatically. Cancel anytime in your store settings.</Text>
        <Btn title={freeLabel} variant="secondary" onPress={leave} testID="paywall-free" />
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
          <TextLink title="Restore purchases" onPress={async () => { const r = await restore(); setDlg(r === 'ok' ? 'Purchases restored. Welcome back!' : r === 'none' ? 'No purchases found to restore.' : r === 'preview' ? (__DEV__ ? 'Preview mode: nothing to restore yet.' : 'Nothing to restore right now.') : 'Could not restore purchases. Try again.'); }} />
        </View>
      </ScrollView>

      <Modal visible={exit} transparent animationType="fade" onRequestClose={() => setExit(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: 22, gap: 12, alignItems: 'center' }} testID="exit-offer">
            <View style={{ backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5 }}><Text style={{ color: '#fff', fontWeight: '800' }}>ONE-TIME OFFER · EXTRA 30% OFF</Text></View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' }}>Wait! Before you go…</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Get the yearly plan for even less. This offer is only available right now.</Text>
            <View style={{ alignItems: 'center' }}>
              <Text style={{ color: colors.muted, textDecorationLine: 'line-through', fontSize: 18 }}>{L.yearFull} / year</Text>
              <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{L.offer}<Text style={{ fontSize: 16, fontWeight: '500' }}> / year</Text></Text>
              <Text style={{ color: colors.success, fontWeight: '700' }}>only {L.offerPerMonth} / month</Text>
            </View>
            <Text style={{ color: colors.text }}>Includes <Text style={{ fontWeight: '700' }}>7 days free</Text>. Cancel anytime.</Text>
            <Btn title="Claim my offer" loading={busy} onPress={() => { track('exit_offer_accepted', { source }); pay('offer'); }} style={{ alignSelf: 'stretch' }} testID="exit-offer-claim" />
            <Pressable onPress={() => { track('exit_offer_declined', { source }); setExit(false); onContinueFree(); }} hitSlop={10} testID="exit-offer-no"><Text style={{ color: colors.muted, padding: 6 }}>No thanks</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Dialog visible={!!dlg} message={dlg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setDlg(null) }]} />
    </View>
  );
}
