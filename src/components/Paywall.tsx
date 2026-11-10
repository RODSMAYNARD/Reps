import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';
import { Text } from './Text';
import { track } from '../lib/analytics';
import { SUPPORT_EMAIL } from '../lib/constants';
import { openPrivacy, openTerms } from '../lib/legal';
import { locale, tr } from '../lib/i18n';
import { Offers, Plan, Trials, buy, loadOffers, loadTrials, mockPrices, mockTrials, money, rcEnabled, restore, usePro } from '../lib/purchases';
import { colors, radius } from '../lib/theme';
import { Btn, Dialog, TextLink } from './ui';

const BENEFITS = ['Unlimited routines', 'Personalized Trainer programs', 'Advanced stats and monthly reports', 'Progress charts for every exercise', 'Export all your data'];
const TRIAL_Q = 'How does the free trial work?';
const FAQ = [
  ['What does Reps Pro include?', 'Unlimited routines, the Trainer, advanced stats, per-exercise charts, and data export.'],
  [TRIAL_Q,'The yearly plan starts with 7 days free. You can cancel before it ends and you will not be charged.'],
  ['Can I cancel anytime?', 'Yes. You cancel in the app store and keep access until the end of the paid period.'],
  ['Can I get a refund?', 'Refunds are handled by the app store where the purchase was made.'],
  ['Can I switch plans?', 'Yes, anytime from your app store account.'],
  ['What if I get a new device?', 'Log in with the same account and use “Restore purchases”.'],
];

type Product = NonNullable<Offers['year']>['product'];

/** Valor calculado na moeda da loja (quando a loja não manda o texto pronto). */
const fmt = (n: number, code: string) => { try { return new Intl.NumberFormat(locale(), { style: 'currency', currency: code }).format(n); } catch { return `${code} ${n.toFixed(2)}`; } };

/**
 * Textos de preço. Com o RevenueCat ligado (`rcEnabled`) SÓ o preço real da loja: plano sem pacote = `null` (a tela mostra "carregando"/"indisponível", nunca o preço de exemplo).
 * Preço de exemplo só na prévia (sem chaves). Comparações (anual "se pagar por mês", % de economia, preço riscado da oferta) só com os dois produtos na mesma moeda;
 * sem dar para calcular, somem (nunca misturam preço da loja com preço de exemplo).
 */
function useLabels(offers: Offers | null) {
  const m = mockPrices();
  const mo = offers?.month?.product, yr = offers?.year?.product, of = offers?.offer?.product;
  const one = <T,>(p: Product | undefined, real: (p: Product) => T, mock: T): T | null => (p ? real(p) : rcEnabled ? null : mock);
  /** `real` com os dois produtos na mesma moeda; `mock` sem nenhum dos dois e só na prévia; `null` nos outros casos. */
  const cmp = <T,>(a: Product | undefined, b: Product | undefined, real: (a: Product, b: Product) => T, mock: T): T | null =>
    !a && !b ? (rcEnabled ? null : mock) : a && b && a.currencyCode === b.currencyCode ? real(a, b) : null;
  const perMonth = (p: Product | undefined, n: number) => one(p, (x) => x.pricePerMonthString ?? fmt(x.price / 12, x.currencyCode), money(n / 12, m.region));
  const save = cmp(mo, yr, (a, b) => Math.round((1 - b.price / (a.price * 12)) * 100), Math.round((1 - m.year / (m.month * 12)) * 100));
  const offSave = cmp(yr, of, (a, b) => Math.round((1 - b.price / a.price) * 100), Math.round((1 - m.offer / m.year) * 100));
  return {
    month: one(mo, (p) => p.priceString, money(m.month, m.region)),
    year: one(yr, (p) => p.priceString, money(m.year, m.region)),
    offer: one(of, (p) => p.priceString, money(m.offer, m.region)),
    yearPerMonth: perMonth(yr, m.year),
    offerPerMonth: perMonth(of, m.offer),
    monthFull: cmp(mo, yr, (a) => a.pricePerYearString ?? fmt(a.price * 12, a.currencyCode), money(m.month * 12, m.region)),
    yearFull: cmp(yr, of, (a) => a.priceString, money(m.year, m.region)),
    badge: save && save > 0 ? `${tr('SAVE')} ${save}%` : undefined,
    offerBadge: offSave && offSave > 0 ? `${tr('SAVE')} ${offSave}%` : undefined,
  };
}

/** Duração do teste grátis em texto ("7 dias", "1 mês"). */
const trialLen = (d: number) => (d % 30 === 0 ? (d === 30 ? tr('1 month') : `${d / 30} ${tr('months')}`) : `${d} ${tr('days')}`);
/** Texto de renovação junto do botão de compra (App Store 3.1.2): teste grátis só quando a loja dá a este usuário. */
const renewText = (price: string, per: 'per year' | 'per month', trial = 0) => (trial > 0 ? `${tr('Free for')} ${trialLen(trial)}, ${tr('then')} ${price} ${tr(per)}.` : `${price} ${tr(per)}.`);

const openUrl = (url: string) => { Linking.openURL(url).catch(() => {}); };

export function Paywall({ onContinueFree, onPurchased, freeLabel = 'Continue for free', source = 'paywall' }: { onContinueFree: () => void; onPurchased?: () => void; freeLabel?: string; source?: string }) {
  const [plan, setPlan] = useState<Plan>('year');
  const [open, setOpen] = useState<number | null>(null);
  const [dlg, setDlg] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offers | null>(null);
  /** Com RevenueCat: 'loading' até a loja responder, 'failed' se a carga falhou (botão de tentar de novo). Na prévia já nasce 'ready'. */
  const [load, setLoad] = useState<'loading' | 'ready' | 'failed'>(rcEnabled ? 'loading' : 'ready');
  const [trials, setTrials] = useState<Trials>(rcEnabled ? {} : mockTrials);
  const [exit, setExit] = useState(false);
  const [busy, setBusy] = useState(false);
  const shown = useRef(false);
  /** Roda depois do "Ok" do aviso de compra/restauração bem-sucedida: quem abriu o paywall segue (onboarding conclui, ajustes volta). */
  const after = useRef<(() => void) | null>(null);
  const isPro = usePro();
  const L = useLabels(offers);
  const fetchOffers = useCallback(() => {
    if (!rcEnabled) return;
    loadOffers().then(async (o) => { if (!o) { setLoad('failed'); return; } const t = await loadTrials(o); setOffers(o); setTrials(t); setLoad('ready'); }).catch(() => setLoad('failed'));
  }, []);
  useEffect(() => { track('paywall_viewed', { source, mode: rcEnabled ? 'live' : 'preview' }); fetchOffers(); }, [source, fetchOffers]);
  /** Plano com preço para mostrar e comprar (na prévia, sempre). */
  const has = (p: Plan) => !rcEnabled || !!offers?.[p];
  const ty = trials.year ?? 0, to = trials.offer ?? 0;
  const noPrice = load === 'loading' ? 'Loading prices…' : 'Price unavailable';
  const faq = FAQ.flatMap(([q, a]) => (q !== TRIAL_Q ? [[q, a]] : !ty ? [] : [[q, ty === 7 ? a : 'The yearly plan starts with a free trial. You can cancel before it ends and you will not be charged.']]));

  const pay = async (p: Plan) => {
    setBusy(true);
    const r = await buy(p, offers);
    setBusy(false);
    setExit(false);
    if (r === 'ok') { after.current = onPurchased ?? null; setDlg('Welcome to Reps Pro! 🎉'); return; }
    if (r === 'preview') setDlg(__DEV__ ? 'Preview mode: real purchases turn on as soon as the store products and RevenueCat keys are configured. Prices shown here are examples.' : "Purchases aren't available right now. Please try again later.");
    if (r === 'error') setDlg('The purchase could not be completed. You were not charged.');
  };
  const leave = () => {
    // Oferta de saída só com o preço dela (loja ou prévia); sem "só agora": ela volta em outra visita.
    if (!shown.current && !isPro && load === 'ready' && has('offer') && L.offer) { shown.current = true; track('exit_offer_viewed', { source }); setExit(true); return; }
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
        {card({ id: 'year', title: 'Yearly', price: L.year ? (ty > 0 ? `${tr('Free for')} ${trialLen(ty)}, ${tr('then')} ${L.year} ${tr('/ year')}` : `${L.year} ${tr('/ year')}`) : noPrice, sub: L.yearPerMonth ? `${L.yearPerMonth} ${tr('/ month')}${L.monthFull ? ` · ${L.monthFull} ${tr('if paid monthly')}` : ''}` : '', badge: L.badge })}
        {card({ id: 'month', title: 'Monthly', price: L.month ? `${L.month} ${tr('/ month')}` : noPrice, sub: L.month ? 'No free trial. Cancel anytime.' : '' })}
        {rcEnabled && load !== 'loading' && !has(plan) && (
          <View style={{ alignItems: 'center', gap: 6 }}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Prices are unavailable right now.</Text>
            <TextLink title="Try again" onPress={() => { setLoad('loading'); fetchOffers(); }} />
          </View>
        )}
        <Btn title={plan === 'year' && ty > 0 ? (ty === 7 ? 'Start 7-day free trial' : 'Start free trial') : 'Subscribe'} loading={busy} disabled={!has(plan)} onPress={() => pay(plan)} testID="paywall-subscribe" />
        {plan === 'year' ? !!L.year && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{renewText(L.year, 'per year', ty)} Renews automatically. Cancel anytime in your store settings.</Text>
          : !!L.month && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{renewText(L.month, 'per month')} Renews automatically. Cancel anytime in your store settings.</Text>}
        <Btn title={freeLabel} variant="secondary" onPress={leave} testID="paywall-free" />
        <Text style={{ fontSize: 20, fontWeight: '700', textAlign: 'center', color: colors.text, marginTop: 10 }}>Any questions?</Text>
        {faq.map(([q, a], i) => (
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
          <TextLink title="Contact us" onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}`)} />
          <TextLink title="Restore purchases" onPress={async () => { const r = await restore(); if (r === 'ok') after.current = onPurchased ?? null; setDlg(r === 'ok' ? 'Purchases restored. Welcome back!' : r === 'none' ? 'No purchases found to restore.' : r === 'preview' ? (__DEV__ ? 'Preview mode: nothing to restore yet.' : 'Nothing to restore right now.') : 'Could not restore purchases. Try again.'); }} />
          {/* App Store 3.1.2: termos e privacidade no fluxo de compra (privacidade = página publicada ou a tela do app) */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, paddingTop: 4 }}>
            <TextLink title="Terms of Use" onPress={openTerms} />
            <TextLink title="Privacy Policy" onPress={openPrivacy} />
          </View>
        </View>
      </ScrollView>

      <Modal visible={exit} transparent animationType="fade" onRequestClose={() => setExit(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 22 }}>
          <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: 22, gap: 12, alignItems: 'center' }} testID="exit-offer">
            {!!L.offerBadge && <View style={{ backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 5 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{L.offerBadge}</Text></View>}
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, textAlign: 'center' }}>Wait! Before you go…</Text>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>Get the yearly plan for even less.</Text>
            <View style={{ alignItems: 'center' }}>
              {!!L.yearFull && <Text style={{ color: colors.muted, textDecorationLine: 'line-through', fontSize: 18 }}>{L.yearFull} / year</Text>}
              <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{L.offer}<Text style={{ fontSize: 16, fontWeight: '500' }}> / year</Text></Text>
              {!!L.offerPerMonth && <Text style={{ color: colors.success, fontWeight: '700' }}>{`${tr('only')} ${L.offerPerMonth} ${tr('/ month')}`}</Text>}
            </View>
            {to > 0 && <Text style={{ color: colors.text }}>Includes <Text style={{ fontWeight: '700' }}>{to === 7 ? '7 days free' : `${trialLen(to)} ${tr('free')}`}</Text></Text>}
            <Btn title="Claim my offer" loading={busy} disabled={!has('offer')} onPress={() => { track('exit_offer_accepted', { source }); pay('offer'); }} style={{ alignSelf: 'stretch' }} testID="exit-offer-claim" />
            {/* App Store 3.1.2: renovação automática, preço depois do teste, cobrança pela loja e termos/privacidade junto do botão de compra */}
            {!!L.offer && <Text style={{ color: colors.muted, fontSize: 12, textAlign: 'center' }}>{renewText(L.offer, 'per year', to)} Renews automatically. Cancel anytime in your store settings.</Text>}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
              <TextLink title="Terms of Use" onPress={openTerms} />
              <TextLink title="Privacy Policy" onPress={openPrivacy} />
            </View>
            <Pressable onPress={() => { track('exit_offer_declined', { source }); setExit(false); onContinueFree(); }} hitSlop={10} testID="exit-offer-no"><Text style={{ color: colors.muted, padding: 6 }}>No thanks</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Dialog visible={!!dlg} message={dlg ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => { setDlg(null); const f = after.current; after.current = null; f?.(); } }]} />
    </View>
  );
}
