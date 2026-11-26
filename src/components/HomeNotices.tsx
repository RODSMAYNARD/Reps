import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { locale, tr } from '../lib/i18n';
import { fmtDuration, toDisplayWeight } from '../lib/format';
import { workoutVolume } from '../lib/stats';
import { useStore } from '../lib/store';
import type { Units } from '../lib/types';
import { colors, radius } from '../lib/theme';
import { Text } from './Text';
import { Btn } from './ui';

/** Avisos da tela inicial (antes só na aba Social, que saiu da v1): sem internet / treinos na fila e o relatório do mês passado. */
export function HomeNotices({ style }: { style?: StyleProp<ViewStyle> }) {
  const { workouts, session, offline, pendingCount } = useStore();
  const pm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
  const pmKey = `${pm.getFullYear()}-${String(pm.getMonth() + 1).padStart(2, '0')}`;
  const pmList = workouts.filter((w) => { const d = new Date(w.date); return d.getFullYear() === pm.getFullYear() && d.getMonth() === pm.getMonth(); });
  const pmCount = pmList.length;
  const { profile } = useStore();
  const uid = session?.user.id;
  const [reportGone, setReportGone] = useState(true);
  useEffect(() => { if (uid) AsyncStorage.getItem(`reps:report-dismissed:${uid}`).then((v) => setReportGone(v === pmKey)).catch(() => setReportGone(false)); }, [uid, pmKey]);
  const dismissReport = () => { setReportGone(true); if (uid) AsyncStorage.setItem(`reps:report-dismissed:${uid}`, pmKey).catch(() => {}); };
  const showOffline = offline || pendingCount > 0;
  const showReport = pmCount > 0 && !reportGone;
  if (!showOffline && !showReport) return null;
  return (
    <View style={[{ gap: 12 }, style]}>
      {showOffline && (
        <View testID="offline-banner" style={{ padding: 12, borderRadius: radius.md, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name={offline ? 'cloud-offline-outline' : 'cloud-upload-outline'} size={22} color={colors.muted} />
          <Text style={{ flex: 1, color: colors.text }}>
            {offline ? 'You are offline. Showing data saved on this device.' : ''}
            {offline && pendingCount > 0 ? ' ' : ''}
            {pendingCount > 0 ? `${pendingCount} ${tr(pendingCount === 1 ? 'workout is waiting to upload.' : 'workouts are waiting to upload.')}` : ''}
          </Text>
        </View>
      )}
      {showReport && (
        // Compacto (mistura de RM3 e RM4 do Rods-Design-Choices, 2026-11-23): "Outubro em resumo", três números do mês e os botões lado a lado
        <View style={{ padding: 16, gap: 12, borderRadius: radius.lg, backgroundColor: colors.surface }} testID="report-card">
          <Text style={{ fontWeight: '700', fontSize: 17, color: colors.text }}>{tr('{m} in review').replace('{m}', cap(pm.toLocaleDateString(locale(), { month: 'long' })))}</Text>
          <View style={{ flexDirection: 'row', gap: 24 }}>
            <Num label="Workouts" value={String(pmCount)} />
            <Num label="Time" value={fmtDuration(pmList.reduce((a, w) => a + w.durationSec, 0)).replace(/ \d+s$/, '')} />
            <Num label="Volume" value={kgShort(pmList.reduce((a, w) => a + workoutVolume(w), 0), profile.units)} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="View Report" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/profile/report', params: { month: pmKey } })} testID="report-view" />
            <Btn title="Dismiss" variant="secondary" style={{ flex: 1, backgroundColor: colors.bg }} onPress={dismissReport} testID="report-dismiss" />
          </View>
        </View>
      )}
    </View>
  );
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
/** Volume curto: "98k kg" a partir de 10 mil, como no gráfico do Perfil. */
const kgShort = (kg: number, u: Units) => { const v = toDisplayWeight(kg, u); return `${v >= 10000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString(locale())} ${u.weight}`; };

function Num({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 1 }}>
      <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}
