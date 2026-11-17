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
 * "Dados de exemplo" (`sample`) gera 30 dias fictícios só para ver as telas; nunca são gravados nem misturados com os reais.
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
export type SleepStageName = 'awake' | 'light' | 'deep' | 'rem';
/** Pedaço da noite (hipnograma): início/fim em ms. */
export type SleepSeg = { s: SleepStageName; a: number; b: number };
export type HrPoint = { t: number; bpm: number };

/** Um dia de saúde. Campos ausentes = sem dado (nunca 0 inventado). */
export type DayHealth = {
  date: string; // AAAA-MM-DD (para o sono: dia em que a noite TERMINOU)
  // Sono
  sleepMin?: number; deepMin?: number; remMin?: number; lightMin?: number; awakeMin?: number;
  bedtime?: number; wakeTime?: number; // ms
  stages?: SleepSeg[]; // só nas últimas 7 noites (economiza espaço)
  // Coração
  restingHr?: number; hrv?: number; avgHr?: number; minHr?: number; maxHr?: number;
  // Atividade
  steps?: number; activeKcal?: number; totalKcal?: number; distanceM?: number; floors?: number; exerciseMin?: number;
  // Sinais vitais e corpo
  spo2?: number; respRate?: number; vo2max?: number; weightKg?: number; bodyFatPct?: number;
};
/** Detalhe do dia de hoje (gráficos ao longo do dia). */
export type Intraday = { date: string; hr: HrPoint[]; stepsByHour: number[] };
export type Goals = { steps: number; moveKcal: number; exerciseMin: number; sleepMin: number; floors: number };
export const DEFAULT_GOALS: Goals = { steps: 8000, moveKcal: 500, exerciseMin: 30, sleepMin: 480, floors: 10 };

export type WorkoutHr = { avg: number; max: number; min: number; points: HrPoint[] };
type Saved = { connected: boolean; writeWorkouts: boolean; sample: boolean; days: DayHealth[]; today: Intraday | null; syncedAt: number | null; goals: Goals };

const KEY = 'reps:health:v1';
const EMPTY: Saved = { connected: false, writeWorkouts: true, sample: false, days: [], today: null, syncedAt: null, goals: DEFAULT_GOALS };
let state: Saved = EMPTY;
let loaded = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
const persist = () => AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
const set = (patch: Partial<Saved>) => { state = { ...state, ...patch }; persist(); emit(); };
const load = async () => {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) { const j = JSON.parse(raw); state = { ...EMPTY, ...j, goals: { ...DEFAULT_GOALS, ...(j.goals ?? {}) } }; }
  } catch {}
  emit();
};

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const todayKey = () => dayKey(new Date());
const mins = (a: Date | string | number, b: Date | string | number) => Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000);
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined);
const r0 = (x: number | undefined) => (x == null || !isFinite(x) ? undefined : Math.round(x));
const r1 = (x: number | undefined) => (x == null || !isFinite(x) ? undefined : Math.round(x * 10) / 10);
const pct = (x: number | undefined) => (x == null ? undefined : x <= 1.5 ? x * 100 : x); // HealthKit devolve fração (0,97)

/** Junta pontos de batimento em médias de `stepMin` minutos (gráfico leve). */
function downsample(points: HrPoint[], stepMin = 5): HrPoint[] {
  const g = new Map<number, number[]>();
  points.forEach((p) => { const k = Math.floor(p.t / (stepMin * 60000)); g.set(k, [...(g.get(k) ?? []), p.bpm]); });
  return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => ({ t: k * stepMin * 60000, bpm: Math.round(avg(v)!) }));
}

/** Monta o resumo da noite a partir dos pedaços (vale para as duas plataformas). */
function applySleep(d: DayHealth, segs: SleepSeg[], keepStages: boolean) {
  if (!segs.length) return;
  segs.sort((x, y) => x.a - y.a);
  const by = (s: SleepStageName) => segs.filter((x) => x.s === s).reduce((m, x) => m + mins(x.a, x.b), 0);
  d.deepMin = r0(by('deep')); d.remMin = r0(by('rem')); d.lightMin = r0(by('light')); d.awakeMin = r0(by('awake'));
  d.sleepMin = r0((d.deepMin ?? 0) + (d.remMin ?? 0) + (d.lightMin ?? 0));
  d.bedtime = segs[0].a; d.wakeTime = Math.max(...segs.map((x) => x.b));
  if (keepStages) d.stages = segs;
}

// ---------- Health Connect (Android) ----------
const HC_READ = [
  'SleepSession', 'HeartRate', 'RestingHeartRate', 'HeartRateVariabilityRmssd', 'Steps', 'ExerciseSession',
  'ActiveCaloriesBurned', 'TotalCaloriesBurned', 'Distance', 'FloorsClimbed', 'OxygenSaturation', 'RespiratoryRate', 'Vo2Max', 'Weight', 'BodyFat',
] as const;
type HcType = (typeof HC_READ)[number];

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

async function hcRead(type: HcType, start: Date, end: Date): Promise<any[]> {
  const out: any[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 30; i++) {
    const r: any = await HC!.readRecords(type as any, { timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() }, pageToken });
    out.push(...r.records);
    pageToken = r.pageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Totais por dia pelo próprio Health Connect (ele tira duplicados entre relógio e celular). */
async function hcDaily(type: 'Steps' | 'ActiveCaloriesBurned' | 'TotalCaloriesBurned' | 'Distance' | 'FloorsClimbed' | 'ExerciseSession', start: Date, end: Date) {
  const rows: any[] = await HC!.aggregateGroupByPeriod({ recordType: type, timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() }, timeRangeSlicer: { period: 'DAYS', length: 1 } } as any);
  return rows.map((r) => ({ date: dayKey(new Date(r.startTime)), res: r.result as any }));
}

const HC_STAGE: Record<number, SleepStageName | null> = { 1: 'awake', 2: 'light', 3: 'awake', 4: 'light', 5: 'deep', 6: 'rem', 7: 'awake', 0: null };

async function hcFetch(start: Date, end: Date): Promise<{ days: DayHealth[]; today: Intraday }> {
  const map = new Map<string, DayHealth>();
  const day = (k: string) => { let d = map.get(k); if (!d) { d = { date: k }; map.set(k, d); } return d; };
  const safe = <T,>(p: Promise<T>, dflt: T) => p.catch(() => dflt); // permissão negada para um tipo não derruba os outros
  const recentNights = new Date(end.getTime() - 7 * 86400000);
  const [sleep, rest, hrv, spo2, resp, vo2, weight, fat, hr, steps, active, total, dist, floors, exer] = await Promise.all([
    safe(hcRead('SleepSession', start, end), []), safe(hcRead('RestingHeartRate', start, end), []),
    safe(hcRead('HeartRateVariabilityRmssd', start, end), []), safe(hcRead('OxygenSaturation', start, end), []),
    safe(hcRead('RespiratoryRate', start, end), []), safe(hcRead('Vo2Max', start, end), []),
    safe(hcRead('Weight', start, end), []), safe(hcRead('BodyFat', start, end), []), safe(hcRead('HeartRate', start, end), []),
    safe(hcDaily('Steps', start, end), []), safe(hcDaily('ActiveCaloriesBurned', start, end), []), safe(hcDaily('TotalCaloriesBurned', start, end), []),
    safe(hcDaily('Distance', start, end), []), safe(hcDaily('FloorsClimbed', start, end), []), safe(hcDaily('ExerciseSession', start, end), []),
  ]);
  // Sono: cada sessão vira pedaços; sem estágios, a sessão inteira conta como "leve" (dormindo sem detalhe)
  const nights = new Map<string, SleepSeg[]>();
  for (const s of sleep) {
    const k = dayKey(new Date(s.endTime));
    const st: any[] = s.stages ?? [];
    const segs: SleepSeg[] = st.length
      ? st.map((x) => ({ s: HC_STAGE[x.stage] ?? null, a: new Date(x.startTime).getTime(), b: new Date(x.endTime).getTime() })).filter((x): x is SleepSeg => !!x.s)
      : [{ s: 'light', a: new Date(s.startTime).getTime(), b: new Date(s.endTime).getTime() }];
    nights.set(k, [...(nights.get(k) ?? []), ...segs]);
  }
  nights.forEach((segs, k) => applySleep(day(k), segs, new Date(`${k}T12:00:00`) >= recentNights));

  const group = (rows: any[], val: (r: any) => number | undefined, at = (r: any) => r.time ?? r.startTime) => {
    const g = new Map<string, number[]>();
    rows.forEach((r) => { const v = val(r); if (v == null || !isFinite(v)) return; const k = dayKey(new Date(at(r))); g.set(k, [...(g.get(k) ?? []), v]); });
    return g;
  };
  group(rest, (r) => r.beatsPerMinute).forEach((v, k) => { day(k).restingHr = r0(avg(v)); });
  group(hrv, (r) => r.heartRateVariabilityMillis).forEach((v, k) => { day(k).hrv = r0(avg(v)); });
  group(spo2, (r) => r.percentage).forEach((v, k) => { day(k).spo2 = r1(avg(v)); });
  group(resp, (r) => r.rate).forEach((v, k) => { day(k).respRate = r1(avg(v)); });
  group(vo2, (r) => r.vo2MillilitersPerMinuteKilogram).forEach((v, k) => { day(k).vo2max = r1(v[v.length - 1]); });
  group(weight, (r) => r.weight?.inKilograms).forEach((v, k) => { day(k).weightKg = r1(v[v.length - 1]); });
  group(fat, (r) => r.percentage).forEach((v, k) => { day(k).bodyFatPct = r1(v[v.length - 1]); });

  const hrPts: HrPoint[] = hr.flatMap((r: any) => (r.samples ?? []).map((s: any) => ({ t: new Date(s.time).getTime(), bpm: s.beatsPerMinute })));
  const hrByDay = new Map<string, number[]>();
  hrPts.forEach((p) => { const k = dayKey(new Date(p.t)); hrByDay.set(k, [...(hrByDay.get(k) ?? []), p.bpm]); });
  hrByDay.forEach((v, k) => { const d = day(k); d.avgHr = r0(avg(v)); d.minHr = Math.min(...v); d.maxHr = Math.max(...v); });

  steps.forEach((x: any) => { if (x.res.COUNT_TOTAL) day(x.date).steps = r0(x.res.COUNT_TOTAL); });
  active.forEach((x: any) => { const v = x.res.ACTIVE_CALORIES_TOTAL?.inKilocalories; if (v) day(x.date).activeKcal = r0(v); });
  total.forEach((x: any) => { const v = x.res.ENERGY_TOTAL?.inKilocalories; if (v) day(x.date).totalKcal = r0(v); });
  dist.forEach((x: any) => { const v = x.res.DISTANCE?.inMeters; if (v) day(x.date).distanceM = r0(v); });
  floors.forEach((x: any) => { if (x.res.FLOORS_CLIMBED_TOTAL) day(x.date).floors = r0(x.res.FLOORS_CLIMBED_TOTAL); });
  exer.forEach((x: any) => { const v = x.res.EXERCISE_DURATION_TOTAL?.inSeconds; if (v) day(x.date).exerciseMin = r0(v / 60); });

  // Hoje: batimentos e passos por hora
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const stepsByHour = new Array(24).fill(0);
  try {
    const rows: any[] = await HC!.aggregateGroupByDuration({ recordType: 'Steps', timeRangeFilter: { operator: 'between', startTime: t0.toISOString(), endTime: end.toISOString() }, timeRangeSlicer: { duration: 'HOURS', length: 1 } } as any);
    rows.forEach((r) => { stepsByHour[new Date(r.startTime).getHours()] = r.result?.COUNT_TOTAL ?? 0; });
  } catch {}
  return { days: [...map.values()], today: { date: dayKey(t0), hr: downsample(hrPts.filter((p) => p.t >= t0.getTime())), stepsByHour } };
}

// ---------- Apple Saúde (iOS) ----------
const HK_READ = [
  'HKCategoryTypeIdentifierSleepAnalysis', 'HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'HKQuantityTypeIdentifierStepCount', 'HKWorkoutTypeIdentifier',
  'HKQuantityTypeIdentifierActiveEnergyBurned', 'HKQuantityTypeIdentifierBasalEnergyBurned', 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierFlightsClimbed', 'HKQuantityTypeIdentifierAppleExerciseTime', 'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierRespiratoryRate', 'HKQuantityTypeIdentifierVO2Max', 'HKQuantityTypeIdentifierBodyMass', 'HKQuantityTypeIdentifierBodyFatPercentage',
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

const HK_STAGE: Record<number, SleepStageName | null> = { 0: null, 1: 'light', 2: 'awake', 3: 'light', 4: 'deep', 5: 'rem' };

async function hkFetch(start: Date, end: Date): Promise<{ days: DayHealth[]; today: Intraday }> {
  const h = HK!;
  const map = new Map<string, DayHealth>();
  const day = (k: string) => { let d = map.get(k); if (!d) { d = { date: k }; map.set(k, d); } return d; };
  const filter = { date: { startDate: start, endDate: end } };
  const safe = <T,>(p: Promise<T>, dflt: T) => p.catch(() => dflt);
  const q = (id: any, unit: string) => safe(h.queryQuantitySamples(id, { limit: 0, filter, unit } as any) as Promise<any>, [] as any[]);
  const stats = (id: any, opts: any[], unit: string, interval: any = { day: 1 }, from = start) =>
    safe(h.queryStatisticsCollectionForQuantity(id, opts, from, interval, { filter: { date: { startDate: from, endDate: end } }, unit } as any) as Promise<any>, [] as any[]);
  const [sleep, rest, hrv, spo2, resp, vo2, weight, fat] = await Promise.all([
    safe(h.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 0, filter }), [] as any[]),
    q('HKQuantityTypeIdentifierRestingHeartRate', 'count/min'), q('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'ms'),
    q('HKQuantityTypeIdentifierOxygenSaturation', '%'), q('HKQuantityTypeIdentifierRespiratoryRate', 'count/min'),
    q('HKQuantityTypeIdentifierVO2Max', 'ml/(kg*min)'), q('HKQuantityTypeIdentifierBodyMass', 'kg'), q('HKQuantityTypeIdentifierBodyFatPercentage', '%'),
  ]);
  const [steps, active, basal, dist, floors, exer, hrDay] = await Promise.all([
    stats('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], 'count'), stats('HKQuantityTypeIdentifierActiveEnergyBurned', ['cumulativeSum'], 'kcal'),
    stats('HKQuantityTypeIdentifierBasalEnergyBurned', ['cumulativeSum'], 'kcal'), stats('HKQuantityTypeIdentifierDistanceWalkingRunning', ['cumulativeSum'], 'm'),
    stats('HKQuantityTypeIdentifierFlightsClimbed', ['cumulativeSum'], 'count'), stats('HKQuantityTypeIdentifierAppleExerciseTime', ['cumulativeSum'], 'min'),
    stats('HKQuantityTypeIdentifierHeartRate', ['discreteAverage', 'discreteMin', 'discreteMax'], 'count/min'),
  ]);

  // Sono: várias fontes (relógio + celular) repetem a mesma noite → fica a fonte com mais minutos dormindo por noite.
  const recentNights = new Date(end.getTime() - 7 * 86400000);
  const perNight = new Map<string, Map<string, SleepSeg[]>>();
  for (const s of sleep as any[]) {
    const st = HK_STAGE[s.value as number];
    if (!st) continue;
    const src = s.sourceRevision?.source?.bundleIdentifier ?? s.sourceRevision?.source?.name ?? 'x';
    const k = dayKey(new Date(s.endDate));
    const m = perNight.get(k) ?? new Map<string, SleepSeg[]>(); perNight.set(k, m);
    m.set(src, [...(m.get(src) ?? []), { s: st, a: new Date(s.startDate).getTime(), b: new Date(s.endDate).getTime() }]);
  }
  perNight.forEach((m, k) => {
    const asleep = (segs: SleepSeg[]) => segs.filter((x) => x.s !== 'awake').reduce((t, x) => t + (x.b - x.a), 0);
    const best = [...m.values()].sort((a, b) => asleep(b) - asleep(a))[0];
    applySleep(day(k), best, new Date(`${k}T12:00:00`) >= recentNights);
  });

  const group = (rows: readonly any[], f = (x: number) => x) => {
    const g = new Map<string, number[]>();
    rows.forEach((r) => { const k = dayKey(new Date(r.startDate)); g.set(k, [...(g.get(k) ?? []), f(r.quantity)]); });
    return g;
  };
  group(rest).forEach((v, k) => { day(k).restingHr = r0(avg(v)); });
  group(hrv).forEach((v, k) => { day(k).hrv = r0(avg(v)); });
  group(spo2, (x) => pct(x)!).forEach((v, k) => { day(k).spo2 = r1(avg(v)); });
  group(resp).forEach((v, k) => { day(k).respRate = r1(avg(v)); });
  group(vo2).forEach((v, k) => { day(k).vo2max = r1(v[v.length - 1]); });
  group(weight).forEach((v, k) => { day(k).weightKg = r1(v[v.length - 1]); });
  group(fat, (x) => pct(x)!).forEach((v, k) => { day(k).bodyFatPct = r1(v[v.length - 1]); });

  const each = (rows: any[], fn: (d: DayHealth, r: any) => void) => rows.forEach((r) => { if (r.startDate) fn(day(dayKey(new Date(r.startDate))), r); });
  each(steps, (d, r) => { if (r.sumQuantity?.quantity) d.steps = r0(r.sumQuantity.quantity); });
  each(active, (d, r) => { if (r.sumQuantity?.quantity) d.activeKcal = r0(r.sumQuantity.quantity); });
  each(basal, (d, r) => { if (r.sumQuantity?.quantity) d.totalKcal = r0(r.sumQuantity.quantity + (d.activeKcal ?? 0)); });
  each(dist, (d, r) => { if (r.sumQuantity?.quantity) d.distanceM = r0(r.sumQuantity.quantity); });
  each(floors, (d, r) => { if (r.sumQuantity?.quantity) d.floors = r0(r.sumQuantity.quantity); });
  each(exer, (d, r) => { if (r.sumQuantity?.quantity) d.exerciseMin = r0(r.sumQuantity.quantity); });
  each(hrDay, (d, r) => { if (r.averageQuantity) { d.avgHr = r0(r.averageQuantity.quantity); d.minHr = r0(r.minimumQuantity?.quantity); d.maxHr = r0(r.maximumQuantity?.quantity); } });

  // Hoje: batimentos e passos por hora
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  const stepsByHour = new Array(24).fill(0);
  (await stats('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], 'count', { hour: 1 }, t0)).forEach((r: any) => {
    if (r.startDate && r.sumQuantity) stepsByHour[new Date(r.startDate).getHours()] = Math.round(r.sumQuantity.quantity);
  });
  const hrRows: any[] = await safe(h.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { limit: 0, ascending: true, unit: 'count/min', filter: { date: { startDate: t0, endDate: end } } }) as Promise<any>, []);
  const hr = downsample(hrRows.map((r) => ({ t: new Date(r.startDate).getTime(), bpm: r.quantity })));
  return { days: [...map.values()], today: { date: dayKey(t0), hr, stepsByHour } };
}

// ---------- Dados de exemplo (só para ver as telas) ----------
function rand(seed: number) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
export function sampleData(daysBack = 30): { days: DayHealth[]; today: Intraday } {
  const rnd = rand(42);
  const days: DayHealth[] = [];
  const now = new Date();
  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    const k = dayKey(d);
    const wake = d.getTime() + (6.5 + rnd() * 1.5) * 3600000;
    const total = 330 + rnd() * 160; // 5h30 a 8h10
    const bed = wake - (total + 20 + rnd() * 25) * 60000;
    const segs: SleepSeg[] = [];
    let t = bed;
    const order: SleepStageName[] = ['light', 'deep', 'light', 'rem'];
    while (t < wake) {
      for (const s of order) {
        const len = (s === 'deep' ? 15 + rnd() * 35 * (t - bed < 3 * 3600000 ? 1 : 0.4) : s === 'rem' ? 10 + rnd() * 30 * (t - bed > 3 * 3600000 ? 1.4 : 0.6) : 20 + rnd() * 30) * 60000;
        const b = Math.min(wake, t + len);
        segs.push({ s, a: t, b }); t = b;
        if (rnd() < 0.18 && t < wake) { const e = Math.min(wake, t + (2 + rnd() * 8) * 60000); segs.push({ s: 'awake', a: t, b: e }); t = e; }
        if (t >= wake) break;
      }
    }
    const day: DayHealth = { date: k };
    applySleep(day, segs, i < 7);
    const isToday = i === 0;
    const frac = isToday ? Math.min(1, (now.getHours() + now.getMinutes() / 60) / 21) : 1;
    day.restingHr = Math.round(54 + rnd() * 8);
    day.hrv = Math.round(38 + rnd() * 30);
    day.avgHr = Math.round(day.restingHr + 14 + rnd() * 10);
    day.minHr = day.restingHr - 4;
    day.maxHr = Math.round(120 + rnd() * 50);
    day.steps = Math.round((4500 + rnd() * 9000) * frac);
    day.activeKcal = Math.round((250 + rnd() * 500) * frac);
    day.totalKcal = Math.round(1750 * Math.max(frac, 0.35) + day.activeKcal);
    day.distanceM = Math.round(day.steps * 0.76);
    day.floors = Math.round((3 + rnd() * 15) * frac);
    day.exerciseMin = Math.round((10 + rnd() * 60) * frac);
    day.spo2 = Math.round((95 + rnd() * 3.5) * 10) / 10;
    day.respRate = Math.round((13 + rnd() * 3) * 10) / 10;
    if (i % 7 === 0) day.vo2max = Math.round((42 + (daysBack - i) * 0.05 + rnd()) * 10) / 10;
    if (i % 2 === 0) { day.weightKg = Math.round((82 - (daysBack - i) * 0.04 + rnd() * 0.6) * 10) / 10; day.bodyFatPct = Math.round((19 - (daysBack - i) * 0.03 + rnd() * 0.5) * 10) / 10; }
    days.push(day);
  }
  const t0 = new Date(now); t0.setHours(0, 0, 0, 0);
  const hr: HrPoint[] = [];
  for (let t = t0.getTime(); t <= now.getTime(); t += 5 * 60000) {
    const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const asleep = h < 7;
    const workout = h >= 18 && h < 19;
    hr.push({ t, bpm: Math.round(asleep ? 52 + rnd() * 6 : workout ? 120 + rnd() * 40 : 68 + rnd() * 22) });
  }
  const stepsByHour = new Array(24).fill(0).map((_, h) => (h < 7 || h > now.getHours() ? 0 : Math.round((h === 8 || h === 12 || h === 18 ? 900 : 250) + rnd() * 500)));
  return { days, today: { date: dayKey(t0), hr, stepsByHour } };
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
    if (ok) { set({ connected: true, sample: false }); await sync(); }
    return ok;
  } catch { return false; }
}

export function disconnect() { set({ connected: false, days: [], today: null, syncedAt: null }); }
export function setWriteWorkouts(v: boolean) { set({ writeWorkouts: v }); }
export function setSample(v: boolean) { set({ sample: v }); }
export function setGoals(g: Partial<Goals>) { set({ goals: { ...state.goals, ...g } }); }

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
      const r = PROVIDER === 'apple' ? await hkFetch(start, end) : await hcFetch(start, end);
      set({ days: r.days.sort((a, b) => a.date.localeCompare(b.date)), today: r.today, syncedAt: Date.now() });
    } catch {} finally { syncing = null; }
  })();
  return syncing;
}

/** Batimentos durante um treino (início/fim). null = sem dados ou sem conexão. */
export async function workoutHeartRate(startMs: number, endMs: number): Promise<WorkoutHr | null> {
  if (!state.connected || (await getStatus()) !== 'ready') return null;
  const start = new Date(startMs), end = new Date(endMs);
  let points: HrPoint[] = [];
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

// ---------- Indicadores calculados (nossos, simples e explicáveis; não são diagnóstico) ----------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const baseline = (days: DayHealth[], date: string, f: (d: DayHealth) => number | undefined, n = 14) =>
  avg(days.filter((d) => d.date < date).slice(-n).map(f).filter((x): x is number => typeof x === 'number'));

/**
 * Nota do sono 0-100: duração (60%), sono restaurador profundo+REM vs 40% da noite (25%), eficiência (15%).
 * A duração conta de 3 h (zero) até a meta (cheia), para 5-6 h não parecerem uma noite boa.
 */
export function sleepScore(d: DayHealth | undefined, goalMin = DEFAULT_GOALS.sleepMin) {
  if (!d?.sleepMin) return null;
  const dur = clamp01((d.sleepMin - 180) / Math.max(60, goalMin - 180));
  const hasStages = (d.deepMin ?? 0) + (d.remMin ?? 0) > 0;
  const rest = hasStages ? clamp01(((d.deepMin ?? 0) + (d.remMin ?? 0)) / d.sleepMin / 0.4) : dur;
  const eff = clamp01(d.sleepMin / (d.sleepMin + (d.awakeMin ?? 0)) / 0.95);
  return Math.round((dur * 0.6 + rest * 0.25 + eff * 0.15) * 100);
}

/**
 * Prontidão 0-100 para "como você está hoje": sono da última noite (45%), VFC (35%) e FC de repouso (20%)
 * comparadas com a média dos 14 dias anteriores. Sem dados suficientes = null.
 */
export function readiness(days: DayHealth[], date = todayKey(), goalMin = DEFAULT_GOALS.sleepMin) {
  const today = days.find((d) => d.date === date);
  if (!today) return null;
  const parts: { w: number; v: number }[] = [];
  const ss = sleepScore(today, goalMin);
  if (ss != null) parts.push({ w: 0.45, v: ss / 100 });
  const bh = baseline(days, date, (d) => d.hrv);
  if (today.hrv && bh) parts.push({ w: 0.35, v: clamp01(0.5 + (today.hrv - bh) / bh) });
  const br = baseline(days, date, (d) => d.restingHr);
  if (today.restingHr && br) parts.push({ w: 0.2, v: clamp01(0.5 - ((today.restingHr - br) / br) * 5) });
  if (!parts.length) return null;
  const w = parts.reduce((s, p) => s + p.w, 0);
  const score = Math.round((parts.reduce((s, p) => s + p.w * p.v, 0) / w) * 100);
  const label = score >= 75 ? 'Ready to push' : score >= 50 ? 'Train normally' : 'Take it easy';
  return { score, label, today, hrvBase: bh, rhrBase: br };
}

/** Diferença de hoje para a média de 14 dias (para setas ↑↓ nos cartões). */
export function vsBaseline(days: DayHealth[], date: string, f: (d: DayHealth) => number | undefined) {
  const cur = f(days.find((d) => d.date === date) ?? { date });
  const base = baseline(days, date, f);
  if (cur == null || base == null) return null;
  return { cur, base, diff: cur - base, pct: base ? (cur - base) / base : 0 };
}

/** Zonas de frequência cardíaca (minutos em cada zona, % da FC máxima = 220 - idade). Pontos a cada 5 min. */
export const HR_ZONES = [
  { id: 1, name: 'Very light', from: 0.5, to: 0.6 }, { id: 2, name: 'Light', from: 0.6, to: 0.7 },
  { id: 3, name: 'Moderate', from: 0.7, to: 0.8 }, { id: 4, name: 'Hard', from: 0.8, to: 0.9 }, { id: 5, name: 'Maximum', from: 0.9, to: 2 },
] as const;
export function hrZones(points: HrPoint[], maxHr: number, stepMin = 5) {
  return HR_ZONES.map((z) => ({ ...z, min: points.filter((p) => p.bpm >= z.from * maxHr && p.bpm < z.to * maxHr).length * stepMin }));
}

/** Regularidade do sono: desvio médio (min) do horário de dormir nas últimas noites. Menor = melhor. */
export function bedtimeConsistency(days: DayHealth[], n = 7) {
  const bt = days.filter((d) => d.bedtime).slice(-n).map((d) => { const x = new Date(d.bedtime!); let m = x.getHours() * 60 + x.getMinutes(); if (m < 12 * 60) m += 24 * 60; return m; });
  if (bt.length < 3) return null;
  const m = avg(bt)!;
  return Math.round(avg(bt.map((x) => Math.abs(x - m)))!);
}

export const fmtSleep = (m?: number) => (m == null ? '–' : `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`);
export const fmtClock = (ms?: number) => (ms == null ? '–' : `${String(new Date(ms).getHours()).padStart(2, '0')}:${String(new Date(ms).getMinutes()).padStart(2, '0')}`);
export const fmtKm = (m?: number) => (m == null ? '–' : `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km`);

export type HealthView = Saved & { isSample: boolean; hasData: boolean };
let sampleCache: { key: string; data: ReturnType<typeof sampleData> } | null = null;
/** Dados de exemplo do dia (gerados uma vez por dia, fora do render). */
function sampleForToday() {
  const key = todayKey();
  if (sampleCache?.key !== key) sampleCache = { key, data: sampleData() };
  return sampleCache.data;
}

/** Estado da integração para as telas. Carrega do aparelho e sincroniza se conectado; com `sample` mostra dados fictícios. */
export function useHealth(): HealthView {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1);
    subs.add(f);
    load().then(() => { if (state.connected && (!state.syncedAt || Date.now() - state.syncedAt > 30 * 60000)) sync(); });
    return () => { subs.delete(f); };
  }, []);
  if (!state.connected && state.sample) {
    const data = sampleForToday();
    return { ...state, days: data.days, today: data.today, isSample: true, hasData: true };
  }
  return { ...state, isSample: false, hasData: state.connected && state.days.length > 0 };
}
