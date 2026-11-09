import { getLocales } from 'expo-localization';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
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
export async function restore(): Promise<'ok' | 'none' | 'preview' | 'error'> {
  track('restore_clicked', { mode: configured ? 'live' : 'preview' });
  if (!configured) return 'preview';
  try { const i = await Purchases.restorePurchases(); const a = !!i.entitlements.active[ENTITLEMENT]; setPro(a); return a ? 'ok' : 'none'; } catch (e) { reportError(e, { where: 'rc-restore' }); return 'error'; }
}
