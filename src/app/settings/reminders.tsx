import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../components/Text';
import { Header, HeaderAction, ListRow, Screen, Section, Sheet, Toggle } from '../../components/ui';
import { WheelPicker } from '../../components/WheelPicker';
import { askReminderPermission } from '../../lib/reminders';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import type { WorkoutPrefs } from '../../lib/types';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = Array.from({ length: 12 }, (_, m) => String(m * 5).padStart(2, '0'));
const GOALS = [0, 1, 2, 3, 4, 5, 6, 7];

export default function Reminders() {
  const { wprefs: p, setWprefs, showToast } = useStore();
  const [timeOpen, setTimeOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  /** Ligar um lembrete pede a permissão de notificações; sem ela, avisa e não liga. */
  const turnOn = async (patch: Partial<WorkoutPrefs>) => {
    if (!(await askReminderPermission())) return showToast('Allow notifications for Reps in your phone settings.');
    setWprefs(patch);
  };
  const time = `${String(p.remindHour).padStart(2, '0')}:${String(p.remindMin).padStart(2, '0')}`;
  return (
    <Screen>
      <Header title="Reminders" right={<HeaderAction label="Done" primary onPress={() => router.back()} />} />
      <ScrollView testID="reminders">
        <Toggle label="Workout reminder" subtitle="A notification on your training days. Skipped on days you already trained." value={p.remind} onChange={(v) => (v ? turnOn({ remind: true }) : setWprefs({ remind: false }))} />
        {p.remind && (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
            {DAYS.map((d, i) => {
              const on = p.remindDays.includes(i);
              return (
                <Pressable key={i} testID={`rem-day-${i}`} onPress={() => setWprefs({ remindDays: on ? p.remindDays.filter((x) => x !== i) : [...p.remindDays, i].sort() })}
                  style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : colors.surface }}>
                  <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '600' }}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <ListRow label="Time" detail={time} onPress={() => setTimeOpen(true)} testID="rem-time" />
        <Toggle label="Inactivity reminder" subtitle="A nudge when 3 days go by without a workout." value={p.nudge} onChange={(v) => (v ? turnOn({ nudge: true }) : setWprefs({ nudge: false }))} />
        <Section title="Weekly goal" />
        <ListRow label="Workouts per week" detail={p.weeklyGoal ? String(p.weeklyGoal) : 'Off'} onPress={() => setGoalOpen(true)} testID="rem-goal" />
        <Text style={{ color: colors.muted, paddingHorizontal: 16, paddingTop: 4 }}>On Friday, Reps tells you how many workouts are left to hit your goal.</Text>
      </ScrollView>
      {timeOpen && (
        <Sheet visible onClose={() => setTimeOpen(false)} title="Time">
          <View style={{ flexDirection: 'row', paddingHorizontal: 16 }}>
            <WheelPicker items={HOURS} index={p.remindHour} flex={1} onChange={(h) => setWprefs({ remindHour: h })} />
            <WheelPicker items={MINUTES} index={Math.round(p.remindMin / 5)} flex={1} onChange={(m) => setWprefs({ remindMin: m * 5 })} />
          </View>
        </Sheet>
      )}
      {goalOpen && (
        <Sheet visible onClose={() => setGoalOpen(false)} title="Workouts per week">
          {GOALS.map((g) => <ListRow key={g} label={g ? String(g) : 'Off'} last onPress={() => { setGoalOpen(false); if (g) turnOn({ weeklyGoal: g }); else setWprefs({ weeklyGoal: 0 }); }} />)}
        </Sheet>
      )}
    </Screen>
  );
}
