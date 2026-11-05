import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Header, ListRow, Screen } from '../../components/ui';
import { fmtDuration } from '../../lib/format';
import { dayKey } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

export default function CalendarScreen() {
  const { workouts } = useStore();
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const first = (cursor.getDay() + 6) % 7;
  const dim = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const byDay = new Map<string, typeof workouts>();
  workouts.forEach((w) => byDay.set(dayKey(w.date), [...(byDay.get(dayKey(w.date)) ?? []), w]));
  const monthList = workouts.filter((w) => { const d = new Date(w.date); return d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear(); });
  const shift = (n: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));
  const today = dayKey(new Date());
  return (
    <Screen>
      <Header title="Calendário" />
      <ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} onPress={() => shift(-1)} testID="cal-prev" />
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>{cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</Text>
          <Ionicons name="chevron-forward" size={24} color={colors.text} onPress={() => shift(1)} />
        </View>
        <View style={{ flexDirection: 'row', paddingHorizontal: 8 }}>{['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: colors.muted }}>{d}</Text>)}</View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 8 }}>
          {cells.map((c, i) => {
            const k = c ? dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), c)) : '';
            const has = c ? byDay.has(k) : false;
            return (
              <Pressable key={i} disabled={!has} onPress={() => { const list = byDay.get(k)!; router.push({ pathname: '/feed/workout/[id]', params: { id: list[0].id } }); }} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 6 }}>
                {c ? <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: has ? colors.primary : 'transparent' }}><Text style={{ color: has ? '#fff' : k === today ? colors.primary : colors.text, fontSize: 16, fontWeight: has || k === today ? '700' : '400' }}>{c}</Text></View> : null}
              </Pressable>
            );
          })}
        </View>
        <Text style={{ color: colors.muted, padding: 16 }}>{monthList.length} treino(s) neste mês</Text>
        {monthList.map((w) => <ListRow key={w.id} label={w.title} subtitle={`${new Date(w.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · ${fmtDuration(w.durationSec)}`} onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} />)}
      </ScrollView>
    </Screen>
  );
}
