import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { PlainText, Text, TextInput } from '../../components/Text';
import { Btn, Dialog, Header, ListRow, Screen, Section, Toggle } from '../../components/ui';
import { clearCoach } from '../../lib/coach';
import { COACH_DAILY_LIMIT } from '../../lib/constants';
import { tr } from '../../lib/i18n';
import { dayKey } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { supabase } from '../../lib/supabase';
import { colors, radius } from '../../lib/theme';
import type { CoachGoal, CoachProfile, CoachTone } from '../../lib/types';

/** Ajustes do Coach (2026-11-23): tom, objetivo, IA (consentimento + uso do dia) e o que o Coach lembra. Tudo em `wprefs.coach` (sincroniza). */

const TONES: { id: CoachTone; label: string; sub: string }[] = [
  { id: 'motivating', label: 'Motivating', sub: 'Warm and energetic' },
  { id: 'technical', label: 'Technical', sub: 'Explains the why, with numbers' },
  { id: 'direct', label: 'Direct', sub: 'Short and to the point' },
];
const GOALS: { id: CoachGoal; label: string }[] = [
  { id: 'muscle', label: 'Build muscle' },
  { id: 'strength', label: 'Get stronger' },
  { id: 'fatloss', label: 'Lose fat' },
  { id: 'health', label: 'Health and fitness' },
];

export default function CoachSettings() {
  const { wprefs, setWprefs, session } = useStore();
  const p: CoachProfile = wprefs.coach ?? {};
  const save = (patch: Partial<CoachProfile>) => setWprefs({ coach: { ...p, ...patch } });
  const [draft, setDraft] = useState('');
  const [used, setUsed] = useState<number | null>(null);
  const [wipe, setWipe] = useState(false);
  const check = <Ionicons name="checkmark" size={20} color={colors.primary} />;

  // quantas perguntas de IA já foram usadas hoje (a tabela só deixa ler a própria linha)
  useEffect(() => {
    if (!session) return;
    let on = true;
    supabase.from('coach_usage').select('count').eq('day', dayKey(new Date())).maybeSingle().then(({ data }) => { if (on) setUsed((data as { count?: number } | null)?.count ?? 0); });
    return () => { on = false; };
  }, [session]);

  const notes = p.notes ?? [];
  const add = () => { const t = draft.trim(); if (!t) return; save({ notes: [...notes.filter((n) => n !== t), t].slice(-20) }); setDraft(''); };

  return (
    <Screen>
      <Header title="Coach settings" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Section title="Tone" />
        {TONES.map((t, i) => <ListRow key={t.id} label={t.label} subtitle={t.sub} onPress={() => save({ tone: t.id })} right={(p.tone ?? 'motivating') === t.id ? check : <View />} last={i === TONES.length - 1} testID={`coach-tone-${t.id}`} />)}

        <Section title="Your goal" />
        {GOALS.map((g, i) => <ListRow key={g.id} label={g.label} onPress={() => save({ goal: g.id })} right={p.goal === g.id ? check : <View />} last={i === GOALS.length - 1} testID={`coach-goal-${g.id}`} />)}

        <Section title="AI answers" />
        <Toggle label="Answer free questions with AI" value={!!p.aiOk} onChange={(v) => save({ aiOk: v })}
          subtitle="When the coach can't answer on its own, it sends your question, the last messages and a summary of your training (and sleep and recovery, if a watch is connected) to Anthropic's AI. Your email is not sent." />
        <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
          <PlainText style={{ color: colors.muted, fontSize: 13 }}>
            {used == null ? '' : `${tr('Used today')}: ${used} / ${COACH_DAILY_LIMIT}`}
          </PlainText>
        </View>

        <Section title="What the coach remembers" />
        <View style={{ paddingHorizontal: 16, gap: 8 }}>
          {notes.length === 0 && <Text style={{ color: colors.muted, fontSize: 14 }}>Nothing yet. Tell the coach things like an injury or an exercise you dislike, or add them here.</Text>}
          {notes.map((n) => (
            <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 10, paddingLeft: 14, paddingRight: 6 }}>
              <PlainText style={{ flex: 1, color: colors.text, fontSize: 15 }}>{n}</PlainText>
              <Pressable onPress={() => save({ notes: notes.filter((x) => x !== n) })} hitSlop={8} accessibilityLabel="Delete" style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="trash-outline" size={19} color={colors.danger} />
              </Pressable>
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TextInput value={draft} onChangeText={setDraft} placeholder="E.g. left shoulder pain" placeholderTextColor={colors.faint} onSubmitEditing={add} maxLength={200} testID="coach-note-input"
              style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text }} />
            <Btn title="Add" onPress={add} disabled={!draft.trim()} testID="coach-note-add" />
          </View>
        </View>

        <Section title="Conversation" />
        <ListRow label="Clear conversation" danger last onPress={() => setWipe(true)} />
      </ScrollView>
      <Dialog visible={wipe} title="Clear this conversation?" message="The messages are deleted from this device. Your workouts are not affected." onClose={() => setWipe(false)}
        actions={[{ label: 'Cancel' }, { label: 'Clear', danger: true, onPress: () => { setWipe(false); clearCoach(); } }]} />
    </Screen>
  );
}

