import { ExerciseLabel } from '../../../components/ExerciseLabel';
import { Ionicons } from '@expo/vector-icons';
import { GymIcon } from '../../../components/GymIcon';
import { track } from '../../../lib/analytics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '../../../components/Text';
import { Check, OptionRow } from '../../../components/TrainerParts';
import { Btn, Dialog, Empty, Header, HeaderAction, IconButton, ListRow, Screen, SearchBar, Sheet, Toggle } from '../../../components/ui';
import { setPickHandler } from '../../../lib/picker';
import { useStore } from '../../../lib/store';
import { colors, radius } from '../../../lib/theme';
import { DEFAULT_TRAINER, DURATIONS, EQUIP, FOCUS, GOALS, INJURIES, LEVELS, PRESETS, RESTS, SPLITS, VARIETY, bestSplit, presetIds } from '../../../lib/trainer';
import { TrainerSettings } from '../../../lib/types';
import { useTrainerApply } from '../../../lib/useTrainerApply';

const TITLES: Record<string, string> = { level: 'Level', equipment: 'Equipment', focus: 'Focus Muscle Group', duration: 'Workout Duration', rest: 'Rest Timer Length', variety: 'Program Variety', cardio: 'Cardio', excluded: 'Exclude Exercises', injuries: 'Injuries', split: 'Split Type', goal: 'Goal', frequency: 'Frequency' };
const INTRO: Record<string, string> = {
  level: 'How much training experience do you have? Choose the experience level that best describes you.', focus: 'Your program is balanced by default. If you prefer, you can choose one muscle group for extra focus.',
  duration: 'How long would you like your workouts to be? Choose your preferred workout duration.', rest: 'Choose your rest timer length. Trainer recommends the default to help you recover properly and keep progressing.',
  variety: 'Choose how your training plan should progress.', cardio: 'Choose your preference and the Trainer will add it to your program.', split: 'Choose the type of program you want to follow.',
  goal: 'What is your main goal? The Trainer adjusts sets and reps to match.', frequency: 'How many days per week do you want to train?',
};
const IMMEDIATE = new Set(['excluded', 'injuries']);
const RESTART = new Set(['split', 'goal', 'frequency']);
const FOCUS_ICON: Record<string, string> = { Core: 'body-outline', Chest: 'heart-outline', Arms: 'barbell-outline', Legs: 'walk-outline', Shoulders: 'shirt-outline', Back: 'arrow-undo-outline' };
const dur = (v: number) => (v < 60 ? `${v}min` : `${Math.floor(v / 60)}h ${v % 60}min`);

export default function TrainerOption() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const st = useStore();
  const apply = useTrainerApply();
  const orig = st.trainer?.settings ?? DEFAULT_TRAINER;
  const [draft, setDraft] = useState<TrainerSettings>(() => ({ ...orig, equipment: orig.equipment.length ? orig.equipment : presetIds(orig.preset) }));
  const [ask, setAsk] = useState(false);
  const [presetSheet, setPresetSheet] = useState(false);
  const [injSheet, setInjSheet] = useState(false);
  const [q, setQ] = useState('');
  const k = String(key);
  const baseline = { ...orig, equipment: orig.equipment.length ? orig.equipment : presetIds(orig.preset) };
  const changed = JSON.stringify(draft) !== JSON.stringify(baseline);
  const set = (p: Partial<TrainerSettings>) => setDraft((d) => ({ ...d, ...p }));
  const commit = (s: TrainerSettings) => { setDraft(s); apply(s, false); };
  const update = () => {
    const next = { ...draft };
    if (k === 'frequency' && !SPLITS.find((x) => x.id === next.split)!.days.includes(next.frequency)) next.split = bestSplit(next.frequency);
    apply(next, RESTART.has(k));
    track('trainer_updated', { option: k });
    st.showToast('Program updated');
    router.back();
  };
  const pickExcluded = () => { setPickHandler((ids) => commit({ ...draft, excluded: [...new Set([...draft.excluded, ...ids])] })); router.push('/exercises/pick'); };

  const right = IMMEDIATE.has(k)
    ? <IconButton name="add" onPress={k === 'excluded' ? pickExcluded : () => setInjSheet(true)} testID="opt-add" />
    : <HeaderAction label="Update" primary onPress={update} disabled={!changed} />;

  return (
    <Screen>
      <Header title={TITLES[k] ?? 'Option'} onLeft={() => (changed && !IMMEDIATE.has(k) ? setAsk(true) : router.back())} right={right} />
      <ScrollView keyboardShouldPersistTaps="handled" testID={`trainer-option-${k}`}>
        {!!INTRO[k] && <Text style={{ color: colors.muted, fontSize: 17, padding: 16 }}>{INTRO[k]}</Text>}

        {k === 'level' && LEVELS.map((l) => <OptionRow key={l.id} label={l.label} sub={l.sub} on={draft.level === l.id} onPress={() => set({ level: l.id })} />)}
        {k === 'goal' && GOALS.map((g) => <OptionRow key={g.id} label={g.label} on={draft.goal === g.id} onPress={() => set({ goal: g.id })} />)}
        {k === 'duration' && DURATIONS.map((d) => <OptionRow key={d.v} label={dur(d.v)} badge={'rec' in d ? 'Recommended' : undefined} on={draft.duration === d.v} onPress={() => set({ duration: d.v })} />)}
        {k === 'rest' && RESTS.map((r) => <OptionRow key={r.id} label={r.label} sub={r.sub} badge={r.id === 'medium' ? 'Recommended' : undefined} on={draft.rest === r.id} onPress={() => set({ rest: r.id })} />)}
        {k === 'frequency' && [2, 3, 4, 5, 6].map((n) => <OptionRow key={n} label={`${n} days per week`} on={draft.frequency === n} onPress={() => set({ frequency: n })} />)}

        {k === 'focus' && FOCUS.map((f) => (
          <OptionRow key={f} label={f} on={draft.focus === f} onPress={() => set({ focus: draft.focus === f ? null : f })}
            right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><Ionicons name={FOCUS_ICON[f] as never} size={26} color={colors.primary} /><View style={{ width: 24 }}><Check on={draft.focus === f} /></View></View>} />
        ))}

        {k === 'variety' && (<>
          {VARIETY.map((v) => <OptionRow key={v.id} label={v.label} sub={v.sub} badge={v.id === 'balanced' ? 'Recommended' : undefined} on={draft.variety === v.id} onPress={() => set({ variety: v.id })} />)}
          <View style={{ height: 14, backgroundColor: colors.surface }} />
          <Toggle label="Deload Weeks" subtitle="Turn this on to automatically add a lighter recovery week after each block." value={draft.deload} onChange={(v) => set({ deload: v })} />
        </>)}

        {k === 'cardio' && (<>
          <Toggle label="Cardio Exercises" subtitle="When active, a cardio exercise will be added to your workouts." value={draft.cardio} onChange={(v) => set({ cardio: v })} />
          {draft.cardio && (<>
            <Text style={{ color: colors.muted, fontSize: 17, padding: 16 }}>Add cardio to:</Text>
            <OptionRow label="Beginning of the workout" on={draft.cardioWhere === 'start'} onPress={() => set({ cardioWhere: 'start' })} />
            <OptionRow label="End of the workout" on={draft.cardioWhere === 'end'} onPress={() => set({ cardioWhere: 'end' })} />
          </>)}
        </>)}

        {k === 'split' && (<>
          {SPLITS.map((sp) => {
            const open = sp.days.includes(draft.frequency);
            return (
              <Pressable key={sp.id} disabled={!open} onPress={() => set({ split: sp.id })} style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: colors.surface, opacity: open ? 1 : 0.9 }} testID={`split-${sp.id}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ flex: 1, fontSize: 19, color: colors.text }}>{sp.label}</Text>
                  {sp.id === 'pplul' && <View style={{ borderWidth: 1.5, borderColor: colors.primary, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: colors.primary, fontSize: 13 }}>Recommended</Text></View>}
                  {open ? <Check on={draft.split === sp.id} /> : <Ionicons name="lock-closed-outline" size={26} color={colors.muted} />}
                </View>
                <Text style={{ color: colors.muted, fontSize: 16, marginTop: 4 }}>{sp.sub}</Text>
                {!open && <Text style={{ color: colors.muted, fontSize: 16, marginTop: 6 }}>🔒 Available for {sp.days.join(', ').replace(/, (\d)$/, ' or $1')} days/week  <Text style={{ color: colors.primary }} onPress={() => router.push({ pathname: '/trainer/option/[key]', params: { key: 'frequency' } })}>Update days</Text></Text>}
              </Pressable>
            );
          })}
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 17, padding: 24 }}>Want a different split? <Text style={{ color: colors.primary }} onPress={() => router.push('/settings/feature-request')}>Suggest one</Text></Text>
        </>)}

        {k === 'equipment' && (<>
          <SearchBar value={q} onChangeText={setQ} placeholder="Search equipment" />
          <Pressable onPress={() => setPresetSheet(true)} style={{ marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, flexDirection: 'row', justifyContent: 'center', gap: 8 }} testID="equip-preset">
            <Text style={{ fontSize: 18, color: colors.text }}>{PRESETS.find((p) => p.id === draft.preset)?.label ?? 'Custom'}</Text><Ionicons name="chevron-down" size={20} color={colors.text} />
          </Pressable>
          {[...new Set(EQUIP.map((e) => e.group))].map((g) => {
            const items = EQUIP.filter((e) => e.group === g && e.label.toLowerCase().includes(q.trim().toLowerCase()));
            if (!items.length) return null;
            return (
              <View key={g}>
                <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, padding: 16, paddingBottom: 6 }}>{g}</Text>
                {items.map((it) => {
                  const on = draft.equipment.includes(it.id);
                  return (
                    <Pressable key={it.id} onPress={() => set({ preset: 'custom', equipment: on ? draft.equipment.filter((x) => x !== it.id) : [...draft.equipment, it.id] })} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.surface }} testID={`equip-${it.id}`}>
                      <View style={{ width: 52, alignItems: 'center' }}><GymIcon name={it.icon} size={30} color={colors.text} /></View>
                      <View style={{ flex: 1 }}><Text style={{ fontSize: 18, color: colors.text }}>{it.label}</Text>{!!it.sub && <Text style={{ color: colors.muted }}>{it.sub}</Text>}</View>
                      <View style={{ width: 30, height: 30, borderRadius: 8, borderWidth: on ? 0 : 1.5, borderColor: colors.border, backgroundColor: on ? colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{on && <Ionicons name="checkmark" size={20} color="#fff" />}</View>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </>)}

        {k === 'excluded' && (draft.excluded.length === 0
          ? <Empty icon="ban-outline" text="No exercises excluded. Excluded exercises won't be recommended in your program." action={<Btn title="Add exercises to exclude" onPress={pickExcluded} testID="opt-add-big" />} />
          : draft.excluded.map((id) => <View key={id} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={id} right={<Ionicons name="close" size={24} color={colors.muted} onPress={() => commit({ ...draft, excluded: draft.excluded.filter((x) => x !== id) })} />} /></View>))}

        {k === 'injuries' && (draft.injuries.length === 0
          ? <Empty icon="bandage-outline" text="No injuries. Add your injuries to get safer, more personalized workout recommendations." action={<Btn title="Add Injury" icon="add" onPress={() => setInjSheet(true)} testID="opt-add-big" />} />
          : draft.injuries.map((id) => <ListRow key={id} label={INJURIES.find((x) => x.id === id)?.label ?? id} right={<Ionicons name="close" size={22} color={colors.muted} />} onPress={() => commit({ ...draft, injuries: draft.injuries.filter((x) => x !== id) })} />))}
      </ScrollView>

      <Sheet visible={presetSheet} onClose={() => setPresetSheet(false)}>
        {PRESETS.map((p, i) => <ListRow key={p.id} label={p.label} last={i === PRESETS.length - 1} right={draft.preset === p.id ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : undefined}
          onPress={() => { set({ preset: p.id, equipment: p.id === 'custom' ? draft.equipment : p.ids }); setPresetSheet(false); }} />)}
      </Sheet>
      <Sheet visible={injSheet} onClose={() => setInjSheet(false)} title="Add Injury">
        {INJURIES.filter((x) => !draft.injuries.includes(x.id)).map((x, i, a) => <ListRow key={x.id} label={x.label} last={i === a.length - 1} onPress={() => { setInjSheet(false); commit({ ...draft, injuries: [...draft.injuries, x.id] }); }} />)}
      </Sheet>
      <Dialog visible={ask} message={k === 'equipment' ? 'Are you sure you want to discard all equipment changes?' : 'Are you sure you want to discard your changes?'} onClose={() => setAsk(false)}
        actions={[{ label: 'Discard changes', danger: true, onPress: () => { setAsk(false); router.back(); } }, { label: 'Cancel' }]} />
    </Screen>
  );
}
