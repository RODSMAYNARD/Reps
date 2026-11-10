import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { Linking, Platform } from 'react-native';
import Purchases, { PurchasesPackage } from 'react-native-purchases';
import { track } from './analytics';
import { reportError } from './monitoring';

/** Assinatura Reps Pro (RevenueCat). Sem chaves (EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY) roda em modo prévia com preços de exemplo. */
const KEY = Platform.select({ ios: process.env.EXPO_PUBLIC_RC_IOS_KEY, android: process.env.EXPO_PUBLIC_RC_ANDROID_KEY });
export const rcEnabled = !!KEY;
export const ENTITLEMENT = 'pro';
// Produtos e ofertas esperados no RevenueCat/lojas (ver CLAUDE.md):
//   reps_pro_monthly (sem teste) · reps_pro_annual (teste grátis de 7 dias) · reps_pro_annual_offer (anual com 30% a menos, teste de 7 dias)
//   Offering "default": $rc_monthly + $rc_annual · Offering "exit_offer": $rc_annual (produto reps_pro_annual_offer)

export type Plan = 'month' | 'year' | 'offer';
type Region = 'US' | 'BR';
export const regionOf = (): Region => (getLocales()[0]?.regionCode === 'BR' ? 'BR' : 'US');

/** Preços de prévia (sem RevenueCat): os mesmos cadastrados na App Store (faixas da Apple, 2026-11-09). Com o RevenueCat ligado, o preço vem da loja. */
const PRICES: Record<Region, { month: number; year: number; offer: number }> = {
  US: { month: 4.99, year: 47.9, offer: 33.49 },
  BR: { month: 19.9, year: 182.9, offer: 127.9 },
};
export const mockPrices = (region: Region = regionOf()) => ({ ...PRICES[region], region });
export const money = (n: number, region: Region = regionOf()) => (region === 'BR' ? `R$ ${n.toFixed(2).replace('.', ',')}` : `$${n.toFixed(2)}`);

// --- estado de assinante (fora do React, com hook) ---
let pro = false;
const subs = new Set<() => void>();
const setPro = (v: boolean) => { if (pro !== v) { pro = v; subs.forEach((f) => f()); } };
export const usePro = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => pro);

let configured = false;
export function setupPurchases() {
  if (!KEY || configured) return;
  try {
    Purchases.configure({ apiKey: KEY });
    Purchases.addCustomerInfoUpdateListener((i) => setPro(!!i.entitlements.active[ENTITLEMENT]));
    configured = true;
  } catch (e) { reportError(e, { where: 'rc-configure' }); }
}
export async function rcLogin(userId: string) {
  if (!configured) return;
  try { const r = await Purchases.logIn(userId); setPro(!!r.customerInfo.entitlements.active[ENTITLEMENT]); } catch (e) { reportError(e, { where: 'rc-login' }); }
}
export async function rcLogout() {
  if (!configured) return;
  try { await Purchases.logOut(); } catch { /* usuário anônimo: ok */ }
  setPro(false);
}

export type Offers = { month?: PurchasesPackage; year?: PurchasesPackage; offer?: PurchasesPackage };
export async function loadOffers(): Promise<Offers | null> {
  if (!configured) return null;
  try {
    const o = await Purchases.getOfferings();
    return { month: o.all.default?.monthly ?? undefined, year: o.all.default?.annual ?? undefined, offer: o.all.exit_offer?.annual ?? undefined };
  } catch (e) { reportError(e, { where: 'rc-offerings' }); return null; }
}

/** Dias de teste grátis que a loja dá a ESTE usuário em cada plano (0 = sem teste). */
export type Trials = Partial<Record<Plan, number>>;
const toDays = (unit: string, n: number) => n * (unit === 'DAY' ? 1 : unit === 'WEEK' ? 7 : unit === 'MONTH' ? 30 : unit === 'YEAR' ? 365 : 0);
/** Só oferta de entrada GRÁTIS conta (oferta paga não é teste grátis). iOS: `introPrice`; Android: `introPrice` ou a fase grátis da opção padrão (o RevenueCat já tira as ofertas que o usuário não pode usar). */
const freeDays = (p: PurchasesPackage['product']) => {
  const i = p.introPrice;
  if (i && i.price === 0) return toDays(i.periodUnit, i.periodNumberOfUnits) * Math.max(1, i.cycles || 1);
  const f = p.defaultOption?.freePhase;
  return f ? toDays(f.billingPeriod.unit, f.billingPeriod.value) * Math.max(1, f.billingCycleCount ?? 1) : 0;
};
/** Prévia (sem RevenueCat): o teste de 7 dias do anual e da oferta, como cadastrado na App Store. */
export const mockTrials: Trials = { month: 0, year: 7, offer: 7 };
/** Teste grátis por plano a partir dos produtos da loja + elegibilidade no iOS (quem já usou o teste no grupo de assinaturas não ganha de novo). UNKNOWN (recibo ilegível) mantém o teste. */
export async function loadTrials(offers: Offers): Promise<Trials> {
  const out: Trials = {};
  const plans: Plan[] = ['month', 'year', 'offer'];
  plans.forEach((k) => { const p = offers[k]?.product; if (p) out[k] = freeDays(p); });
  const ids = plans.filter((k) => out[k]).map((k) => offers[k]!.product.identifier);
  if (Platform.OS !== 'ios' || !configured || !ids.length) return out;
  try {
    const e = await Purchases.checkTrialOrIntroductoryPriceEligibility(ids);
    const S = Purchases.INTRO_ELIGIBILITY_STATUS;
    plans.forEach((k) => { const st = out[k] ? e[offers[k]!.product.identifier]?.status : undefined; if (st === S.INTRO_ELIGIBILITY_STATUS_INELIGIBLE || st === S.INTRO_ELIGIBILITY_STATUS_NO_INTRO_OFFER_EXISTS) out[k] = 0; });
  } catch (err) { reportError(err, { where: 'rc-trial-eligibility' }); }
  return out;
}

export type BuyResult = 'ok' | 'cancelled' | 'preview' | 'error';
export async function buy(plan: Plan, offers: Offers | null): Promise<BuyResult> {
  track('purchase_started', { plan, mode: configured ? 'live' : 'preview' });
  const pkg = offers?.[plan];
  if (!configured || !pkg) return 'preview';
  try {
    const r = await Purchases.purchasePackage(pkg);
    const active = !!r.customerInfo.entitlements.active[ENTITLEMENT];
    setPro(active);
    track('purchase_completed', { plan, price: pkg.product.price, currency: pkg.product.currencyCode });
    return active ? 'ok' : 'error';
  } catch (e) {
    if ((e as { userCancelled?: boolean }).userCancelled) { track('purchase_cancelled', { plan }); return 'cancelled'; }
    track('purchase_failed', { plan });
    reportError(e, { where: 'rc-purchase' });
    return 'error';
  }
}
/** Abre o gerenciamento da assinatura na loja (RevenueCat; sem ele, a página de assinaturas da App Store / Google Play). */
export async function manageSubscription(): Promise<boolean> {
  track('manage_subscription_clicked', { mode: configured ? 'live' : 'preview' });
  if (configured) { try { await Purchases.showManageSubscriptions(); return true; } catch (e) { reportError(e, { where: 'rc-manage' }); } }
  const url = Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions';
  try { await Linking.openURL(url); return true; } catch { return false; }
}
export async function restore(): Promise<'ok' | 'none' | 'preview' | 'error'> {
  track('restore_clicked', { mode: configured ? 'live' : 'preview' });
  if (!configured) return 'preview';
  try { const i = await Purchases.restorePurchases(); const a = !!i.entitlements.active[ENTITLEMENT]; setPro(a); return a ? 'ok' : 'none'; } catch (e) { reportError(e, { where: 'rc-restore' }); return 'error'; }
}
