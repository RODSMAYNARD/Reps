import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Delta, DayLine, HCard, HealthNotice, HTitle, LegendRow, MC, RangeTabs, TrendChart, type TrendPoint } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { dayKey, fmtClock, hrZones, HR_ZONES, setSample, todayKey, useHealth, vsBaseline, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

/** Coração (como Apple Saúde / Whoop / Garmin): batimentos de hoje, zonas, FC de repouso, VFC, FC média e VO2 máx. */

const ZONE_COLORS = ['#5AC8FA', '#30D158', '#FFD60A', '#FF9F0A', '#FF375F'];
/** FC máxima usada quando não há ano de nascimento no perfil. */
const DEFAULT_MAX_HR = 190;
/** Faixas aproximadas de VO2 máx. (ml/kg/min); variam com idade e sexo, por isso só "guia". */
const VO2_BANDS = [
  { label: 'Low', color: '#FF453A' },
  { label: 'Below average', color: '#FF9F0A' },
  { label: 'Average', color: '#FFD60A' },
  { label: 'Good', color: '#30D158' },
  { label: 'Excellent', color: '#0A84FF' },
] as const;
/** Nomes das zonas nesta tela ('Light' sozinho já é "Claro" no dicionário, por isso 'Easy'). */
const ZONE_NAMES: Record<number, string> = { 1: 'Very light', 2: 'Easy', 3: 'Moderate', 4: 'Hard', 5: 'Maximum' };
type Range = '7' | '30';
type Zone = (typeof HR_ZONES)[number];

const parseKey = (k: string) => new Date(`${k}T12:00:00`);
const shortDate = (k: string) => parseKey(k).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const fmt1 = (v: number) => v.toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtMin = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`);
const isNum = (v: unknown): v is number => typeof v === 'number' && isFinite(v);

/** "Hoje", "Ontem" ou a data curta. */
function dayLabel(k: string) {
  if (k === todayKey()) return tr('Today');
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (k === dayKey(y)) return tr('Yesterday');
  return shortDate(k);
}

/** Último dia com valor para a métrica (mais recente primeiro). */
function latest(days: DayHealth[], f: (d: DayHealth) => number | undefined) {
  for (let i = days.length - 1; i >= 0; i--) {
    const v = f(days[i]);
    if (isNum(v)) return { date: days[i].date, value: v };
  }
  return null;
}

/** Faixa de batimentos da zona, igual ao corte de `hrZones` (>= início, < fim). */
function zoneRange(z: Zone, maxHr: number) {
  const lo = Math.ceil(z.from * maxHr);
  if (z.to >= 2) return `${lo}+ bpm`;
  return `${lo}–${Math.ceil(z.to * maxHr) - 1} bpm`;
}

function vo2Band(v: number) {
  return v < 35 ? 0 : v < 42 ? 1 : v < 50 ? 2 : v <= 55 ? 3 : 4;
}

/** Valor principal do cartão (data, número grande e variação contra a média de 14 dias). */
function MetricHead({ date, value, unit, delta }: { date: string; value: string; unit: string; delta?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{date}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 30, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
          <Text numberOfLines={1} style={{ fontSize: 14, color: colors.muted }}>{unit}</Text>
        </View>
      </View>
      {delta ? (
        <View style={{ alignItems: 'flex-end', gap: 2, paddingBottom: 4 }}>
          {delta}
          <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>vs 14-day avg</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Coluna Mín./Média/Máx. */
function StatCol({ label, value, color }: { label: string; value: number | undefined; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20, fontWeight: '800', color: color ?? colors.text, fontVariant: ['tabular-nums'] }}>{isNum(value) ? String(Math.round(value)) : '–'}</Text>
        {isNum(value) && <Text style={{ fontSize: 12, color: colors.muted }}>bpm</Text>}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
    </View>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 12, lineHeight: 17, color: colors.muted }}>{children}</Text>;
}

export default function Heart() {
  const h = useHealth();
  const { profile } = useStore();
  const [range, setRange] = useState<Range>('7');
  const openConnect = () => router.push('/settings/integrations');

  if (!h.hasData) {
    return (
      <Screen>
        <Header title="Heart" />
        <ScrollView testID="health-heart" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
          <HealthNotice isSample={false} onPress={openConnect} />
          <HCard style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: MC.heart + '22', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="heart" size={32} color={MC.heart} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' }}>No heart data yet</Text>
            <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 20 }}>See your heart rate through the day, resting heart rate, HRV, heart rate zones and cardio fitness from your watch or band.</Text>
            <Btn title="Connect watch" icon="watch-outline" onPress={openConnect} style={{ alignSelf: 'stretch' }} testID="health-heart-connect" />
            <Btn title="Try with sample data" variant="outline" icon="flask-outline" onPress={() => setSample(true)} style={{ alignSelf: 'stretch' }} testID="health-heart-sample" />
          </HCard>
        </ScrollView>
      </Screen>
    );
  }

  // Hoje: batimentos do dia (só se a leitura do dia for de hoje mesmo)
  const todayK = todayKey();
  const dayRec = h.days.find((d) => d.date === todayK);
  const pts = h.today?.date === todayK ? h.today.hr : [];
  const bpms = pts.map((p) => p.bpm);
  const minHr = dayRec?.minHr ?? (bpms.length ? Math.min(...bpms) : undefined);
  const maxHrToday = dayRec?.maxHr ?? (bpms.length ? Math.max(...bpms) : undefined);
  const avgHrToday = dayRec?.avgHr ?? (bpms.length ? Math.round(bpms.reduce((s, x) => s + x, 0) / bpms.length) : undefined);
  const last = pts.length ? pts[pts.length - 1] : null;

  // Zonas: FC máxima = 220 - idade (sem ano de nascimento, 190)
  const age = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null;
  const hasAge = age != null && age >= 10 && age <= 100;
  const maxHr = hasAge ? 220 - age : DEFAULT_MAX_HR;
  const zones = hrZones(pts, maxHr);
  const topZone = Math.max(0, ...zones.map((z) => z.min));

  // Tendências: um ponto por dia do período (dia sem dado fica vazio, sem zero falso)
  const n = range === '7' ? 7 : 30;
  const keys = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return dayKey(d); });
  const byDate = new Map(h.days.map((d) => [d.date, d] as const));
  const series = (f: (d: DayHealth) => number | undefined): TrendPoint[] => keys.map((k) => ({ label: shortDate(k), value: f(byDate.get(k) ?? { date: k }) }));

  const rhr = latest(h.days, (d) => d.restingHr);
  const rhrVs = rhr ? vsBaseline(h.days, rhr.date, (d) => d.restingHr) : null;
  const hrv = latest(h.days, (d) => d.hrv);
  const hrvVs = hrv ? vsBaseline(h.days, hrv.date, (d) => d.hrv) : null;
  const avgAny = h.days.some((d) => isNum(d.avgHr));
  const vo2 = latest(h.days, (d) => d.vo2max);
  const vo2Series = series((d) => d.vo2max);
  const vo2Count = vo2Series.filter((p) => isNum(p.value)).length;
  const band = vo2 ? vo2Band(vo2.value) : 0;
  const hasTrends = !!(rhr || hrv || avgAny || vo2);

  return (
    <Screen>
      <Header title="Heart" />
      <ScrollView testID="health-heart" contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        {h.isSample && <HealthNotice isSample onPress={openConnect} />}

        {pts.length > 0 && (
          <>
            <HTitle title="Today" />
            <HCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                  <Ionicons name="heart" size={16} color={MC.heart} />
                  <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: MC.heart }}>Heart rate</Text>
                </View>
                {last && (
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] }}>
                    {tr('Latest')} {last.bpm} bpm · {fmtClock(last.t)}
                  </Text>
                )}
              </View>
              <DayLine points={pts.map((p) => ({ t: p.t, v: p.bpm }))} color={MC.heart} unit=" bpm" />
              <View style={{ flexDirection: 'row', gap: 10, paddingTop: 4 }}>
                <StatCol label="Min" value={minHr} />
                <StatCol label="Avg" value={avgHrToday} />
                <StatCol label="Max" value={maxHrToday} color={MC.heart} />
              </View>
            </HCard>

            <HTitle title="Heart rate zones" />
            <HCard>
              <Muted>Time in each zone today</Muted>
              {zones.map((z, i) => (
                <LegendRow key={z.id} color={ZONE_COLORS[i]} label={`${tr(ZONE_NAMES[z.id] ?? z.name)} · ${zoneRange(z, maxHr)}`} value={fmtMin(z.min)} frac={topZone > 0 ? z.min / topZone : 0} />
              ))}
              <Muted>
                {tr('Based on a max heart rate of')} {maxHr} bpm{hasAge ? ` (${tr('220 minus your age')})` : ''}.
              </Muted>
              {!hasAge && (
                <Pressable onPress={() => router.push('/profile/edit')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }} testID="health-heart-birthyear">
                  <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                  <Text style={{ flex: 1, fontSize: 13, color: colors.primary }}>Add your birth year in your profile for accurate zones</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </Pressable>
              )}
            </HCard>
          </>
        )}

        {hasTrends && (
          <RangeTabs<Range> value={range} onChange={setRange} options={[{ id: '7', label: '7 days' }, { id: '30', label: '30 days' }]} />
        )}

        {rhr && (
          <>
            <HTitle title="Resting HR" />
            <HCard>
              <MetricHead
                date={dayLabel(rhr.date)}
                value={String(Math.round(rhr.value))}
                unit="bpm"
                delta={rhrVs ? <Delta diff={rhrVs.diff} unit=" bpm" higherIsBetter={false} /> : undefined}
              />
              <TrendChart key={range} data={series((d) => d.restingHr)} kind="line" color={MC.heart} unit=" bpm" />
              <Muted>Your heart rate while fully at rest. A lower trend usually comes with better fitness.</Muted>
            </HCard>
          </>
        )}

        {hrv && (
          <>
            <HTitle title="HRV" />
            <HCard>
              <MetricHead
                date={dayLabel(hrv.date)}
                value={String(Math.round(hrv.value))}
                unit="ms"
                delta={hrvVs ? <Delta diff={hrvVs.diff} unit=" ms" higherIsBetter /> : undefined}
              />
              <TrendChart key={range} data={series((d) => d.hrv)} kind="line" color={MC.hrv} unit=" ms" />
              <Muted>Higher than your usual usually means you recovered well.</Muted>
              <Muted>iPhone measures HRV as SDNN and Android as RMSSD, so numbers differ between devices. Compare only with yourself.</Muted>
            </HCard>
          </>
        )}

        {avgAny && (
          <>
            <HTitle title="Daily average HR" />
            <HCard>
              <TrendChart key={range} data={series((d) => d.avgHr)} kind="bar" color={MC.heart} unit=" bpm" />
            </HCard>
          </>
        )}

        {vo2 && (
          <>
            <HTitle title="Cardio fitness" right={<Text style={{ fontSize: 13, color: colors.muted }}>VO2 max</Text>} />
            <HCard>
              <MetricHead date={dayLabel(vo2.date)} value={fmt1(vo2.value)} unit="ml/kg/min" />
              <View style={{ gap: 6 }}>
                <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: VO2_BANDS[band].color }}>{VO2_BANDS[band].label}</Text>
                <View style={{ flexDirection: 'row', gap: 3 }}>
                  {VO2_BANDS.map((b, i) => (
                    <View key={b.label} style={{ flex: 1, height: 8, borderRadius: radius.sm, backgroundColor: b.color, opacity: i === band ? 1 : 0.25 }} />
                  ))}
                </View>
                <Muted>Rough guide, varies by age and sex.</Muted>
              </View>
              {vo2Count >= 2 && <TrendChart key={range} data={vo2Series} kind="line" color={MC.vo2} format={fmt1} unit=" ml/kg/min" />}
            </HCard>
          </>
        )}

        {!pts.length && !hasTrends && (
          <HCard style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="heart-outline" size={28} color={colors.muted} />
            <Text style={{ color: colors.muted, textAlign: 'center' }}>No heart data from your watch yet.</Text>
          </HCard>
        )}

        <Text style={{ fontSize: 11, color: colors.muted, textAlign: 'center', marginTop: 4 }}>Not a medical device. Talk to a doctor about concerns.</Text>
      </ScrollView>
    </Screen>
  );
}
