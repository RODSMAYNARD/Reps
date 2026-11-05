import { router } from 'expo-router';
import { track } from '../../lib/analytics';
import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Dialog, Header, ListRow, Screen, Section } from '../../components/ui';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { LEVELS, PRESETS, RESTS, VARIETY, goalLabel, programSummary, splitLabel } from '../../lib/trainer';
import { useTrainerApply } from '../../lib/useTrainerApply';

export default function ProgramSettings() {
  const st = useStore();
  const apply = useTrainerApply();
  const [ask, setAsk] = useState<'restart' | 'delete' | null>(null);
  const t = st.trainer;
  if (!t) return <Screen><Header title="Program Settings" /></Screen>;
  const s = t.settings;
  const go = (k: string) => () => router.push({ pathname: '/trainer/option/[key]', params: { key: k } });
  const R = (icon: string, label: string, detail: string, k: string, last = false) => <ListRow icon={icon as never} label={label} subtitle={detail} onPress={go(k)} last={last} testID={`set-${k}`} />;
  return (
    <Screen>
      <Header title="Program Settings" />
      <ScrollView testID="trainer-settings">
        <Text style={{ fontSize: 26, fontWeight: '700', color: colors.text, padding: 16, paddingBottom: 6 }}>{t.name}</Text>
        <Text style={{ color: colors.muted, fontSize: 17, paddingHorizontal: 16, paddingBottom: 14 }}>{programSummary(s)}</Text>
        <Section title="Modify My Program" />
        {R('speedometer-outline', 'Level', LEVELS.find((x) => x.id === s.level)!.label, 'level')}
        {R('barbell-outline', 'Equipment', PRESETS.find((p) => p.id === s.preset)?.label ?? 'Custom', 'equipment')}
        {R('body-outline', 'Focus Muscle Group', s.focus ?? 'Balanced', 'focus')}
        {R('alarm-outline', 'Workout Duration', `${s.duration}min`, 'duration')}
        {R('timer-outline', 'Rest Timer Length', RESTS.find((r) => r.id === s.rest)!.label, 'rest')}
        {R('git-network-outline', 'Program Variety', VARIETY.find((v) => v.id === s.variety)!.label, 'variety')}
        {R('pulse-outline', 'Cardio', s.cardio ? 'Active' : 'Inactive', 'cardio')}
        {R('ban-outline', 'Excluded Exercises', s.excluded.length ? `${s.excluded.length} excluded` : 'None', 'excluded')}
        {R('bandage-outline', 'Injuries', s.injuries.length ? `${s.injuries.length} injur${s.injuries.length > 1 ? 'ies' : 'y'}` : 'None', 'injuries', true)}
        <Section title="Start New Program" />
        {R('git-branch-outline', 'Split Type', splitLabel(s.split), 'split')}
        {R('trophy-outline', 'Goal', goalLabel(s.goal), 'goal')}
        {R('calendar-outline', 'Frequency', `${s.frequency} per week`, 'frequency')}
        <ListRow icon="refresh-outline" label="Restart Program" onPress={() => setAsk('restart')} testID="trainer-restart" />
        <ListRow icon="trash-outline" label="Delete Program" danger onPress={() => setAsk('delete')} testID="trainer-delete" last />
        <Section title="About Trainer" />
        <ListRow icon="flask-outline" label="Science Behind Trainer" onPress={() => router.push('/trainer/science')} />
        <ListRow icon="mail-outline" label="Send Feedback" onPress={() => router.push('/settings/feature-request')} last />
      </ScrollView>
      <Dialog visible={ask === 'restart'} title="Restart program?" message="Your progress in this program goes back to week 1 and the workouts are rebuilt." onClose={() => setAsk(null)}
        actions={[{ label: 'Cancel' }, { label: 'Restart', primary: true, onPress: () => { setAsk(null); apply(s, true); track('trainer_restarted'); st.showToast('Program restarted'); router.dismissTo('/trainer'); } }]} />
      <Dialog visible={ask === 'delete'} title="Delete program?" message="Your program is removed. Workouts you already logged are kept." onClose={() => setAsk(null)}
        actions={[{ label: 'Cancel' }, { label: 'Delete', danger: true, onPress: () => { setAsk(null); st.saveTrainer(null); track('trainer_deleted'); router.dismissTo('/trainer'); } }]} />
    </Screen>
  );
}
