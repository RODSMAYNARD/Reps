/**
 * Camada única de saúde/wearables.
 *
 * O app NÃO fala com cada relógio/pulseira: lê do "cofre" de saúde do aparelho, que recebe os dados de todos eles.
 * - iOS: Apple Saúde (HealthKit) → Apple Watch, Garmin, Oura, Whoop, Polar, Withings, Samsung (via app), etc.
 * - Android: Health Connect → Fitbit / Pixel Watch, Samsung Galaxy Watch, Garmin, Oura, Whoop, Polar, Xiaomi/Amazfit (Zepp), etc.
 * - Fitbit no iPhone NÃO grava no Apple Saúde: para esse caso será preciso a Google Health API (OAuth + servidor), ver `CLOUD_PROVIDERS`.
 *
 * Os módulos nativos são carregados com try/require: sem eles (build antigo, Expo Go, web) tudo devolve "indisponível", sem erro.
 * Os dados ficam SÓ NO APARELHO (AsyncStorage `reps:health:v1`), nunca vão para o Supabase.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';

/* eslint-disable @typescript-eslint/no-require-imports */
let HK: typeof import('@kingstinct/react-native-healthkit') | null = null;
let HC: typeof import('react-native-health-connect') | null = null;
if (Platform.OS === 'ios') { try { HK = require('@kingstinct/react-native-healthkit'); } catch { HK = null; } }
if (Platform.OS === 'android') { try { HC = require('react-native-health-connect'); } catch { HC = null; } }
/* eslint-enable @typescript-eslint/no-require-imports */

export type Provider = 'apple' | 'healthconnect';
export const PROVIDER: Provider | null = Platform.OS === 'ios' ? 'apple' : Platform.OS === 'android' ? 'healthconnect' : null;
export const PROVIDER_NAME = PROVIDER === 'apple' ? 'Apple Health' : 'Health Connect';

/** Aparelhos que chegam pelo cofre de cada sistema (texto da tela de conexões). */
export const DEVICES: Record<Provider, string[]> = {
  apple: ['Apple Watch', 'Garmin', 'Oura', 'Whoop', 'Polar', 'Withings', 'Samsung Galaxy Watch', 'Amazfit / Zepp'],
  healthconnect: ['Fitbit', 'Pixel Watch', 'Samsung Galaxy Watch', 'Garmin', 'Oura', 'Whoop', 'Polar', 'Withings', 'Amazfit / Zepp', 'Xiaomi'],
};

/** Conexões na nuvem (precisam de servidor + OAuth): só interface por enquanto. */
export const CLOUD_PROVIDERS = [
  { id: 'google-health', name: 'Fitbit (Google Health)', note: 'For Fitbit on iPhone. Needs the Google Health API (the old Fitbit Web API was shut down in 2026).' },
  { id: 'garmin', name: 'Garmin Connect', note: 'Direct Garmin sync, including Garmin on iPhone without Apple Health.' },
] as const;

export type Status = 'unsupported' | 'needs-build' | 'not-installed' | 'needs-update' | 'ready';
export type DayHealth = {
  date: string; // AAAA-MM-DD (dia em que a noite TERMINOU, para o sono)
  sleepMin?: number; deepMin?: number; remMin?: number; awakeMin?: number;
  restingHr?: number; hrv?: number; steps?: number;
};
export type WorkoutHr = { avg: number; max: number; min: number; points: { t: number; bpm: number }[] };
type Saved = { connected: boolean; writeWorkouts: boolean; days: DayHealth[]; syncedAt: number | null };

const KEY = 'reps:health:v1';
const EMPTY: Saved = { connected: false, writeWorkouts: true, days: [], syncedAt: null };
let state: Saved = EMPTY;
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
const set = (patch: Partial<Saved>) => { state = { ...state, ...patch }; persist(); emit(); };
const load = async () => {
  if (loaded) return;
  loaded = true;
  try { const raw = await AsyncStorage.getItem(KEY); if (raw) state = { ...EMPTY, ...JSON.parse(raw) }; } catch {}
  emit();
};

const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const mins = (a: Date | string, b: Date | string) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);

// ---------- Health Connect (Android) ----------
const HC_READ = ['SleepSession', 'HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'Steps', 'ExerciseSession'] as const;

async function hcStatus(): Promise<Status> {
  if (!HC) return 'needs-build';
  try {
    const s = await HC.getSdkStatus();
    if (s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE) return 'not-installed';
    if (s === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'needs-update';
    return (await HC.initialize()) ? 'ready' : 'not-installed';
  } catch { return 'needs-build'; }
}

async function hcConnect(): Promise<boolean> {
  if (!HC || (await hcStatus()) !== 'ready') return false;
  const perms = [...HC_READ.map((recordType) => ({ accessType: 'read' as const, recordType })), { accessType: 'write' as const, recordType: 'ExerciseSession' as const }];
  const granted = await HC.requestPermission(perms);
  return granted.some((p) => p.accessType === 'read');
}

async function hcRead<T extends (typeof HC_READ)[number]>(type: T, start: Date, end: Date) {
  const out: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 20; i++) {
    const r: any = await HC!.readRecords(type, { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() }, pageToken });
    out.push(...r.records);
    pageToken = r.pageToken;
    if (!pageToken) break;
  }
  return out;
}

async function hcDays(start: Date, end: Date): Promise<DayHealth[]> {
  const map = new Map<string, DayHealth>();
  const day = (k: string) => { let d = map.get(k); if (!d) { d = { date: k }; map.set(k, d); } return d; };
  const safe = <T,>(p: Promise<T>, dflt: T) => p.catch(() => dflt); // permissão negada para um tipo não derruba os outros
  const [sleep, rest, hrv, steps] = await Promise.all([
    safe(hcRead('SleepSession', start, end), []), safe(hcRead('RestingHeartRate', start, end), []),
    safe(hcRead('HeartRateVariabilityRmssd', start, end), []), safe(hcRead('Steps', start, end), []),
  ]);
  for (const s of sleep) {
    const d = day(dayKey(new Date(s.endTime)));
    const stages: any[] = s.stages ?? [];
    // Estágios do Health Connect: 1 acordado, 2 dormindo, 3 fora da cama, 4 leve, 5 profundo, 6 REM, 7 acordado na cama
    const by = (types: number[]) => stages.filter((x) => types.includes(x.stage)).reduce((m, x) => m + mins(x.startTime, x.endTime), 0);
    const awake = by([1, 3, 7]);
    d.sleepMin = (d.sleepMin ?? 0) + (stages.length ? by([2, 4, 5, 6]) : mins(s.startTime, s.endTime) - awake);
    d.deepMin = (d.deepMin ?? 0) + by([5]);
    d.remMin = (d.remMin ?? 0) + by([6]);
    d.awakeMin = (d.awakeMin ?? 0) + awake;
  }
  const group = (rows: any[], val: (r: any) => number) => {
    const g = new Map<string, number[]>();
    rows.forEach((r) => { const k = dayKey(new Date(r.time ?? r.startTime)); g.set(k, [...(g.get(k) ?? []), val(r)]); });
    return g;
  };
  group(rest, (r) => r.beatsPerMinute).forEach((v, k) => { day(k).restingHr = Math.round(avg(v)!); });
  group(hrv, (r) => r.heartRateVariabilityMillis).forEach((v, k) => { day(k).hrv = Math.round(avg(v)!); });
  group(steps, (r) => r.count).forEach((v, k) => { day(k).steps = v.reduce((a, b) => a + b, 0); });
  return [...map.values()];
}

// ---------- Apple Saúde (iOS) ----------
const HK_READ = [
  'HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'HKQuantityTypeIdentifierStepCount', 'HKWorkoutTypeIdentifier',
] as const;

async function hkStatus(): Promise<Status> {
  if (!HK) return 'needs-build';
  try { return HK.isHealthDataAvailable() ? 'ready' : 'unsupported'; } catch { return 'needs-build'; }
}

async function hkConnect(): Promise<boolean> {
  if (!HK || (await hkStatus()) !== 'ready') return false;
  // O iOS nunca diz se a LEITURA foi liberada (privacidade): true = a janela foi mostrada.
  return HK.requestAuthorization({ toRead: HK_READ as any, toShare: ['HKWorkoutTypeIdentifier'] as any });
}

async function hkDays(start: Date, end: Date): Promise<DayHealth[]> {
  const h = HK!;
  const map = new Map<string, DayHealth>();
  const day = (k: string) => { let d = map.get(k); if (!d) { d = { date: k }; map.set(k, d); } return d; };
  const filter = { date: { startDate: start, endDate: end } };
  const safe = <T,>(p: Promise<T>, dflt: T) => p.catch(() => dflt);
  const [sleep, rest, hrv] = await Promise.all([
    safe(h.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter }), [] as any[]),
    safe(h.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', { limit: 0, filter, unit: 'count/min' }), [] as any),
    safe(h.queryQuantitySamples('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', { limit: 0, filter, unit: 'ms' }), [] as any),
  ]);
  // Sono: 0 na cama, 1 dormindo (sem estágio), 2 acordado, 3 leve/core, 4 profundo, 5 REM. Várias fontes (relógio + celular)
  // podem repetir a mesma noite: fica a fonte com mais minutos dormindo por noite.
  const perSource = new Map<string, Map<string, DayHealth>>();
  for (const s of sleep as any[]) {
    const src = s.sourceRevision?.source?.bundleIdentifier ?? s.sourceRevision?.source?.name ?? 'x';
    const k = dayKey(new Date(s.endDate));
    const m = perSource.get(k) ?? new Map<string, DayHealth>(); perSource.set(k, m);
    const d = m.get(src) ?? { date: k }; m.set(src, d);
    const len = mins(s.startDate, s.endDate);
    if ([1, 3, 4, 5].includes(s.value)) d.sleepMin = (d.sleepMin ?? 0) + len;
    if (s.value === 4) d.deepMin = (d.deepMin ?? 0) + len;
    if (s.value === 5) d.remMin = (d.remMin ?? 0) + len;
    if (s.value === 2) d.awakeMin = (d.awakeMin ?? 0) + len;
  }
  perSource.forEach((m, k) => {
    const best = [...m.values()].sort((a, b) => (b.sleepMin ?? 0) - (a.sleepMin ?? 0))[0];
    Object.assign(day(k), { sleepMin: best.sleepMin, deepMin: best.deepMin, remMin: best.remMin, awakeMin: best.awakeMin });
  });
  const group = (rows: readonly any[]) => {
    const g = new Map<string, number[]>();
    rows.forEach((r) => { const k = dayKey(new Date(r.startDate)); g.set(k, [...(g.get(k) ?? []), r.quantity]); });
    return g;
  };
  group(rest).forEach((v, k) => { day(k).restingHr = Math.round(avg(v)!); });
  group(hrv).forEach((v, k) => { day(k).hrv = Math.round(avg(v)!); });
  // Passos: estatística por dia (o próprio HealthKit tira duplicados entre relógio e celular)
  try {
    const stats = await h.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], start, { day: 1 }, { filter, unit: 'count' });
    stats.forEach((s: any) => { const q = s.sumQuantity?.quantity; if (q && s.startDate) day(dayKey(new Date(s.startDate))).steps = Math.round(q); });
  } catch {}
  return [...map.values()];
}

// ---------- API pública ----------
export async function getStatus(): Promise<Status> {
  if (PROVIDER === 'apple') return hkStatus();
  if (PROVIDER === 'healthconnect') return hcStatus();
  return 'unsupported';
}

export async function connect(): Promise<boolean> {
  try {
    const ok = PROVIDER === 'apple' ? await hkConnect() : PROVIDER === 'healthconnect' ? await hcConnect() : false;
    if (ok) { set({ connected: true }); await sync(); }
    return ok;
  } catch { return false; }
}

export function disconnect() { set({ connected: false, days: [], syncedAt: null }); }
export function setWriteWorkouts(v: boolean) { set({ writeWorkouts: v }); }

/** Abre o app do sistema para gerenciar as permissões (lá o usuário revoga de verdade). */
export function openSystemSettings() {
  if (PROVIDER === 'healthconnect' && HC) { try { HC.openHealthConnectSettings(); return; } catch {} }
  if (PROVIDER === 'apple') { Linking.openURL('x-apple-health://').catch(() => Linking.openSettings()); return; }
  Linking.openSettings();
}
export function installHealthConnect() {
  Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() => Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'));
}

let syncing: Promise<void> | null = null;
/** Lê os últimos `days` dias (padrão 30) e guarda no aparelho. Uma sincronização por vez. */
export function sync(days = 30): Promise<void> {
  if (!state.connected) return Promise.resolve();
  if (syncing) return syncing;
  syncing = (async () => {
    try {
      if ((await getStatus()) !== 'ready') return;
      const end = new Date();
      const start = new Date(end); start.setDate(start.getDate() - days); start.setHours(0, 0, 0, 0);
      const list = PROVIDER === 'apple' ? await hkDays(start, end) : await hcDays(start, end);
      set({ days: list.sort((a, b) => a.date.localeCompare(b.date)), syncedAt: Date.now() });
    } catch {} finally { syncing = null; }
  })();
  return syncing;
}

/** Batimentos durante um treino (início/fim). null = sem dados ou sem conexão. */
export async function workoutHeartRate(startMs: number, endMs: number): Promise<WorkoutHr | null> {
  if (!state.connected || (await getStatus()) !== 'ready') return null;
  const start = new Date(startMs), end = new Date(endMs);
  let points: { t: number; bpm: number }[] = [];
  try {
    if (PROVIDER === 'apple') {
      const rows = await HK!.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { limit: 0, ascending: true, unit: 'count/min', filter: { date: { startDate: start, endDate: end } } });
      points = rows.map((r: any) => ({ t: new Date(r.startDate).getTime(), bpm: Math.round(r.quantity) }));
    } else {
      const rows = await hcRead('HeartRate', start, end);
      points = rows.flatMap((r: any) => (r.samples ?? []).map((s: any) => ({ t: new Date(s.time).getTime(), bpm: s.beatsPerMinute })));
    }
  } catch { return null; }
  points = points.filter((p) => p.t >= startMs && p.t <= endMs && p.bpm > 25 && p.bpm < 250).sort((a, b) => a.t - b.t);
  if (!points.length) return null;
  const bpms = points.map((p) => p.bpm);
  return { avg: Math.round(avg(bpms)!), max: Math.max(...bpms), min: Math.min(...bpms), points };
}

/** Grava o treino terminado no Apple Saúde / Health Connect (musculação). Falha em silêncio. */
export async function saveWorkout(startMs: number, endMs: number, title: string): Promise<boolean> {
  if (!state.connected || !state.writeWorkouts || endMs <= startMs || (await getStatus()) !== 'ready') return false;
  try {
    if (PROVIDER === 'apple') {
      await HK!.saveWorkoutSample(HK!.WorkoutActivityType.traditionalStrengthTraining, [], new Date(startMs), new Date(endMs), undefined, { HKWorkoutBrandName: title } as any);
    } else {
      // 70 = ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING
      await HC!.insertRecords([{ recordType: 'ExerciseSession', exerciseType: 70, title, startTime: new Date(startMs).toISOString(), endTime: new Date(endMs).toISOString() } as any]);
    }
    return true;
  } catch { return false; }
}

// ---------- Recuperação (prontidão) ----------
/**
 * Nota de 0 a 100 para "como você está hoje", a partir do que existir: sono da última noite (meta 8 h),
 * VFC e frequência de repouso comparadas com a média dos 14 dias anteriores. Sem dados suficientes = null.
 * É um indicador nosso, simples e explicável (não é diagnóstico).
 */
export function readiness(days: DayHealth[], date = dayKey(new Date())) {
  const today = days.find((d) => d.date === date);
  if (!today) return null;
  const prev = days.filter((d) => d.date < date).slice(-14);
  const base = (f: (d: DayHealth) => number | undefined) => avg(prev.map(f).filter((x): x is number => typeof x === 'number'));
  const parts: { w: number; v: number }[] = [];
  if (today.sleepMin) parts.push({ w: 0.45, v: Math.min(1, today.sleepMin / 480) });
  const bh = base((d) => d.hrv);
  if (today.hrv && bh) parts.push({ w: 0.35, v: Math.max(0, Math.min(1, 0.5 + (today.hrv - bh) / bh)) });
  const br = base((d) => d.restingHr);
  if (today.restingHr && br) parts.push({ w: 0.2, v: Math.max(0, Math.min(1, 0.5 - (today.restingHr - br) / br * 5)) });
  if (!parts.length) return null;
  const w = parts.reduce((s, p) => s + p.w, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.w * p.v, 0) / w * 100);
  const label = score >= 75 ? 'Ready to push' : score >= 50 ? 'Train normally' : 'Take it easy';
  return { score, label, today };
}

export const fmtSleep = (m?: number) => (m == null ? '–' : `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`);

/** Estado da integração para as telas (carrega do aparelho na primeira vez e sincroniza se conectado). */
export function useHealth() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    load().then(() => { if (state.connected && (!state.syncedAt || Date.now() - state.syncedAt > 30 * 60000)) sync(); });
    return () => { subs.delete(f); };
  }, []);
  return state;
}
