import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Text } from './Text';
import { fmtSleep, readiness, useHealth, workoutHeartRate, type WorkoutHr } from '../lib/health';
import { colors, radius } from '../lib/theme';

const scoreColor = (s: number) => (s >= 75 ? colors.success : s >= 50 ? colors.warn : colors.danger);

function Metric({ icon, label, value, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string; color: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 16, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
    </View>
  );
}

/** Cartão "Recovery" (Início/H2): só aparece com relógio/pulseira conectado e dados de hoje. */
export function RecoveryCard({ style }: { style?: object }) {
  const h = useHealth();
  if (!h.hasData) return null;
  const r = readiness(h.days, undefined, h.goals.sleepMin);
  const today = r?.today ?? h.days[h.days.length - 1];
  if (!today) return null;
  return (
    <Pressable onPress={() => router.push('/health')} testID="recovery-card" style={[{ borderRadius: radius.lg, backgroundColor: colors.surface, padding: 16, gap: 14 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {r ? (
          <View style={{ width: 54, height: 54, borderRadius: 27, borderWidth: 4, borderColor: scoreColor(r.score), alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>{r.score}</Text>
          </View>
        ) : <Ionicons name="pulse" size={36} color={colors.primary} />}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>{h.isSample ? 'Recovery · sample' : 'Recovery'}</Text>
          <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{r ? r.label : 'From your watch'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Metric icon="moon" label="Sleep" value={fmtSleep(today.sleepMin)} color="#8E7CF0" />
        <Metric icon="heart" label="Resting HR" value={today.restingHr ? `${today.restingHr}` : '–'} color={colors.danger} />
        <Metric icon="pulse" label="HRV" value={today.hrv ? `${today.hrv} ms` : '–'} color={colors.success} />
        <Metric icon="footsteps" label="Steps" value={today.steps ? today.steps.toLocaleString() : '–'} color={colors.primary} />
      </View>
    </Pressable>
  );
}

/** Batimentos do treino (detalhe do treino salvo): média, máxima e o gráfico. Some sem dados. */
export function WorkoutHeartRateCard({ startMs, durationSec }: { startMs: number; durationSec: number }) {
  const h = useHealth();
  const [hr, setHr] = useState<WorkoutHr | null>(null);
  useEffect(() => {
    let on = true;
    if (h.connected && durationSec > 0) workoutHeartRate(startMs, startMs + durationSec * 1000).then((x) => { if (on) setHr(x); });
    return () => { on = false; };
  }, [h.connected, startMs, durationSec]);
  if (!hr) return null;
  const W = 300, H = 70;
  const t0 = hr.points[0].t, t1 = hr.points[hr.points.length - 1].t || t0 + 1;
  const lo = hr.min - 5, hi = hr.max + 5;
  const pts = hr.points.map((p) => `${((p.t - t0) / Math.max(1, t1 - t0)) * W},${H - ((p.bpm - lo) / (hi - lo)) * H}`).join(' ');
  return (
    <View style={{ marginHorizontal: 16, marginTop: 8, borderRadius: radius.lg, backgroundColor: colors.surface, padding: 14, gap: 10 }} testID="workout-hr">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="heart" size={18} color={colors.danger} />
        <Text style={{ fontWeight: '700', color: colors.text, flex: 1 }}>Heart rate</Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>bpm</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <View><Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{hr.avg}</Text><Text style={{ fontSize: 11, color: colors.muted }}>Average</Text></View>
        <View><Text style={{ fontSize: 20, fontWeight: '800', color: colors.danger }}>{hr.max}</Text><Text style={{ fontSize: 11, color: colors.muted }}>Max</Text></View>
        <View><Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{hr.min}</Text><Text style={{ fontSize: 11, color: colors.muted }}>Min</Text></View>
      </View>
      {hr.points.length > 1 && (
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <Polyline points={pts} fill="none" stroke={colors.danger} strokeWidth={2} strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}
