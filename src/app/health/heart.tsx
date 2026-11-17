import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Delta, DayLine, fmtNum, HCard, HealthNotice, HTitle, LegendRow, MC, RangeTabs, TrendChart, type TrendPoint } from '../../components/HealthKit';
import { Text } from '../../components/Text';
import { Btn, Header, Screen } from '../../components/ui';
import { dayKey, fmtClock, hrZones, HR_ZONES, setSample, todayKey, useHealth, type DayHealth } from '../../lib/health';
import { locale, tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

/**
 * Coração (como Apple Saúde / Whoop / Garmin / Eight Sleep): batimentos de hoje, zonas (tempo e % do tempo nas zonas),
 * FC de repouso e VFC (hoje ao lado da média de 30 dias, com a faixa típica sombreada no gráfico), FC média e VO2 máx.
 */

const ZONE_COLORS = ['#5AC8FA', '#30D158', '#FFD60A', '#FF9F0A', '#FF375F'];
/** FC máxima usada quando não há ano de nascimento no perfil. */
const DEFAULT_MAX_HR = 190;
/** Faixa típica = média de 30 dias ± esta fração (a FC de repouso muda pouco de um dia para o outro; a VFC muda bem mais). */
const RHR_BAND = 0.05;
const HRV_BAND = 0.15;
/** Dias com valor necessários para mostrar a média de 30 dias e para desenhar a faixa típica. */
const MIN_AVG_DAYS = 2;
const MIN_BAND_DAYS = 5;
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
/** Média de 30 dias (`avg` some com poucos dias) e quantos dias tinham valor. */
type Avg = { avg?: number; n: number };

const parseKey = (k: string) => new Date(`${k}T12:00:00`);
const shiftKey = (k: string, days: number) => { const d = parseKey(k); d.setDate(d.getDate() + days); return dayKey(d); };
const shortDate = (k: string) => parseKey(k).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
const fmt0 = (v: number) => fmtNum(v);
const fmt1 = (v: number) => fmtNum(v, 1);
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

/** Média dos 30 dias até `end` (o dia da leitura mais recente, inclusive), ignorando os dias sem valor. */
function avg30(days: DayHealth[], end: string, f: (d: DayHealth) => number | undefined): Avg {
  const from = shiftKey(end, -29);
  const xs = days.filter((d) => d.date >= from && d.date <= end).map(f).filter(isNum);
  return { avg: xs.length >= MIN_AVG_DAYS ? xs.reduce((s, x) => s + x, 0) / xs.length : undefined, n: xs.length };
}

/** Faixa típica sombreada no gráfico (média ± fração, arredondada); some com menos de MIN_BAND_DAYS dias. */
function typicalBand(a: Avg | null, frac: number): [number, number] | undefined {
  if (!a || a.avg == null || a.n < MIN_BAND_DAYS) return undefined;
  return [Math.round(a.avg * (1 - frac)), Math.round(a.avg * (1 + frac))];
}

/** Porcentagens inteiras que somam 100 (maior resto), para a lista de zonas não dar 99% ou 101%. Total 0 = null. */
function sharePct(xs: number[]): (number | null)[] {
  const total = xs.reduce((s, x) => s + x, 0);
  if (total <= 0) return xs.map(() => null);
  const raw = xs.map((x) => (x / total) * 100);
  const out = raw.map((r) => Math.floor(r));
  let left = 100 - out.reduce((s, x) => s + x, 0);
  raw.map((r, i) => ({ i, rest: r - Math.floor(r) })).sort((a, b) => b.rest - a.rest).forEach(({ i }) => {
    if (left > 0) { out[i] += 1; left -= 1; }
  });
  return out;
}

/** "30 min · 18%" (parte do tempo nas zonas hoje); sem tempo nas zonas, só os minutos. */
const zoneValue = (min: number, pct: number | null) => (pct == null ? fmtMin(min) : `${fmtMin(min)} · ${min > 0 && pct === 0 ? '<1' : pct}%`);

/** Faixa de batimentos da zona, igual ao corte de `hrZones` (>= início, < fim). */
function zoneRange(z: Zone, maxHr: number) {
  const lo = Math.ceil(z.from * maxHr);
  if (z.to >= 2) return `${fmtNum(lo)}+ bpm`;
  return `${fmtNum(lo)}–${fmtNum(Math.ceil(z.to * maxHr) - 1)} bpm`;
}

function vo2Band(v: number) {
  return v < 35 ? 0 : v < 42 ? 1 : v < 50 ? 2 : v <= 55 ? 3 : 4;
}

/** Número grande + unidade pequena em Texts separados (na web o adjustsFontSizeToFit não encolhe nada). */
function BigNum({ value, unit, size = 28 }: { value: string; unit?: string; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: size, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      {!!unit && <Text numberOfLines={1} style={{ fontSize: 14, color: colors.muted }}>{unit}</Text>}
    </View>
  );
}

/** Hoje (ou a leitura mais recente) ao lado da média de 30 dias, como no Eight Sleep; a seta compara os dois. */
function TodayVsAvg({ date, value, avg, unit, higherIsBetter, testID }: {
  date: string; value: number; avg?: number; unit: string; higherIsBetter: boolean; testID?: string;
}) {
  const diff = avg != null ? Math.round(value) - Math.round(avg) : null;
  return (
    <View testID={testID} style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{dayLabel(date)}</Text>
        <BigNum value={fmtNum(value)} unit={unit} />
        {diff != null && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Delta diff={diff} unit={` ${unit}`} higherIsBetter={higherIsBetter} />
            {diff !== 0 && <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: colors.muted }}>vs avg</Text>}
          </View>
        )}
      </View>
      <View style={{ width: 1, backgroundColor: colors.border }} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>30-day average</Text>
        <BigNum value={fmtNum(avg)} unit={avg != null ? unit : undefined} />
      </View>
    </View>
  );
}

/** Valor principal do cartão (data e número grande). */
function MetricHead({ date, value, unit }: { date: string; value: string; unit: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text numberOfLines={1} style={{ fontSize: 12, color: colors.muted }}>{date}</Text>
      <BigNum value={value} unit={unit} size={30} />
    </View>
  );
}

/** Coluna Mín./Média/Máx. */
function StatCol({ label, value, color }: { label: string; value: number | undefined; color?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
        <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 20, fontWeight: '800', color: color ?? colors.text, fontVariant: ['tabular-nums'] }}>{fmtNum(value)}</Text>
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

  // Zonas: FC máxima = 220 - idade (sem ano de nascimento, 190); % = parte do tempo de hoje nas zonas (as 5 somam 100%)
  const age = profile.birthYear ? new Date().getFullYear() - profile.birthYear : null;
  const hasAge = age != null && age >= 10 && age <= 100;
  const maxHr = hasAge ? 220 - age : DEFAULT_MAX_HR;
  const zones = hrZones(pts, maxHr);
  const zoneTotal = zones.reduce((s, z) => s + z.min, 0);
  const zonePct = sharePct(zones.map((z) => z.min));

  // Tendências: um ponto por dia do período (dia sem dado fica vazio, sem zero falso)
  const n = range === '7' ? 7 : 30;
  const keys = Array.from({ length: n }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (n - 1 - i)); return dayKey(d); });
  const byDate = new Map(h.days.map((d) => [d.date, d] as const));
  const series = (f: (d: DayHealth) => number | undefined): TrendPoint[] => keys.map((k) => ({ label: shortDate(k), value: f(byDate.get(k) ?? { date: k }) }));

  // FC de repouso e VFC: leitura mais recente vs média de 30 dias + faixa típica sombreada (como no Eight Sleep)
  const rhr = latest(h.days, (d) => d.restingHr);
  const rhrAvg = rhr ? avg30(h.days, rhr.date, (d) => d.restingHr) : null;
  const rhrBand = typicalBand(rhrAvg, RHR_BAND);
  const hrv = latest(h.days, (d) => d.hrv);
  const hrvAvg = hrv ? avg30(h.days, hrv.date, (d) => d.hrv) : null;
  const hrvBand = typicalBand(hrvAvg, HRV_BAND);
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
                    {tr('Latest')} {fmtNum(last.bpm)} bpm · {fmtClock(last.t)}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12, color: colors.muted }}>Time in each zone today</Text>
                <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>
                  {fmtMin(zoneTotal)} {tr('total')}
                </Text>
              </View>
              {zones.map((z, i) => (
                <LegendRow
                  key={z.id}
                  color={ZONE_COLORS[i]}
                  label={`${tr(ZONE_NAMES[z.id] ?? z.name)} · ${zoneRange(z, maxHr)}`}
                  value={zoneValue(z.min, zonePct[i])}
                  frac={zoneTotal > 0 ? z.min / zoneTotal : 0}
                />
              ))}
              <Muted>
                {tr('Based on a max heart rate of')} {fmtNum(maxHr)} bpm{hasAge ? ` (${tr('220 minus your age')})` : ''}.
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
              <TodayVsAvg date={rhr.date} value={rhr.value} avg={rhrAvg?.avg} unit="bpm" higherIsBetter={false} testID="health-heart-rhr-vs-avg" />
              <TrendChart key={range} data={series((d) => d.restingHr)} kind="line" color={MC.heart} band={rhrBand} format={fmt0} unit=" bpm" />
              <Muted>Your heart rate while fully at rest. A lower trend usually comes with better fitness.</Muted>
              {rhrBand && <Muted>{tr('Typical range: your 30-day average')} ±{Math.round(RHR_BAND * 100)}%.</Muted>}
            </HCard>
          </>
        )}

        {hrv && (
          <>
            <HTitle title="HRV" />
            <HCard>
              <TodayVsAvg date={hrv.date} value={hrv.value} avg={hrvAvg?.avg} unit="ms" higherIsBetter testID="health-heart-hrv-vs-avg" />
              <TrendChart key={range} data={series((d) => d.hrv)} kind="line" color={MC.hrv} band={hrvBand} format={fmt0} unit=" ms" />
              <Muted>Higher than your usual often means you recovered well.</Muted>
              {hrvBand && <Muted>{tr('Typical range: your 30-day average')} ±{Math.round(HRV_BAND * 100)}%.</Muted>}
              <Muted>iPhone measures HRV as SDNN and Android as RMSSD, so numbers differ between devices. Compare only with yourself.</Muted>
            </HCard>
          </>
        )}

        {avgAny && (
          <>
            <HTitle title="Daily average HR" />
            <HCard>
              <TrendChart key={range} data={series((d) => d.avgHr)} kind="bar" color={MC.heart} format={fmt0} unit=" bpm" />
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
