import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, type ScrollViewInstance, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ActiveBar } from '../../components/ActiveBar';
import { BodyMap } from '../../components/BodyMap';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Text, TextInput } from '../../components/Text';
import { Btn, Dialog, Screen } from '../../components/ui';
import { fmtWeight, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { FOCUS, GPLANS, GState, dayEntries, dayExercises, dayKeyOf, dayNumber, focusLabel, planOf, setG, useG, workoutTitle } from '../../lib/gplan';
import { tr } from '../../lib/i18n';
import { equipImage } from '../../lib/iconImages';
import { setPickHandler } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

/** Aba G (em teste, para o Rodrigo comparar): PLAN = planos de 30 dias; TRAINING = treino do dia gerado (equipamento, 1RM, regenerar, editar). */

const PAD = 16;
const GAP = 10;
const HERO_BG = '#141922'; // cartão escuro nos dois temas, como na referência
type Tab = 'plan' | 'training';

export default function GTab() {
  const st = useStore();
  const g = useG(st.session?.user.id ?? null);
  const [tab, setTab] = useState<Tab>('plan');

  // treino do plano salvo = dia concluído
  useEffect(() => {
    const p = g.pending;
    if (!p) return;
    if (!p.workoutId) { if (st.active && st.active.startedAt >= p.at) setG({ pending: { ...p, workoutId: st.active.id } }); return; }
    if (st.workouts.some((w) => w.id === p.workoutId)) setG((s) => ({ pending: null, done: { ...s.done, [p.planId]: Math.max(s.done[p.planId] ?? 0, p.day + 1) } }));
  }, [g.pending, st.active, st.workouts]);

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', paddingHorizontal: PAD, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {(['plan', 'training'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingTop: 14 }} testID={`g-tab-${t}`}>
            <Text style={{ fontSize: 16, fontWeight: '700', letterSpacing: 0.5, color: tab === t ? colors.text : colors.muted }}>{tr(t === 'plan' ? 'Plan' : 'Training').toUpperCase()}</Text>
            <View style={{ height: 3, width: 56, borderRadius: 2, marginTop: 10, backgroundColor: tab === t ? colors.primary : 'transparent' }} />
          </Pressable>
        ))}
      </View>
      {tab === 'plan' ? <PlanView g={g} onStart={() => setTab('training')} /> : <TrainingView g={g} />}
      <ActiveBar />
    </Screen>
  );
}

function PlanView({ g, onStart }: { g: GState; onStart: () => void }) {
  const st = useStore();
  const { width } = useWindowDimensions();
  const cardW = Math.min(width, 520) - PAD * 2 - 16;
  const step = cardW + GAP;
  const ref = useRef<ScrollViewInstance>(null);
  const idx = Math.max(0, GPLANS.findIndex((p) => p.id === g.planId));
  const first = useRef(true);
  useEffect(() => { if (first.current && idx > 0) ref.current?.scrollTo({ x: idx * step, animated: false }); first.current = false; }, [idx, step]);
  const plan = GPLANS[idx];
  const done = g.done[plan.id] ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" scrollEventThrottle={32}
        style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 14, gap: GAP, paddingRight: PAD + 16 }}
        onScroll={(e) => { const i = Math.max(0, Math.min(GPLANS.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))); if (GPLANS[i].id !== g.planId) setG({ planId: GPLANS[i].id }); }}>
        {GPLANS.map((p) => {
          const d = g.done[p.id] ?? 0;
          return (
            <View key={p.id} style={{ width: cardW, height: 132, borderRadius: radius.lg, backgroundColor: HERO_BG, padding: 16, flexDirection: 'row', alignItems: 'flex-end' }} testID={`g-plan-${p.id}`}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }} numberOfLines={2}>{tr(p.title).toUpperCase()}</Text>
                <Text style={{ color: '#C9D0DB', fontSize: 14, marginTop: 4 }}>{d >= 30 ? tr('Completed') : d === 0 ? `30 ${tr('Days')}` : `${30 - d} ${tr('days left')}`}</Text>
              </View>
              <Image source={equipImage(p.icon)} style={{ width: 84, height: 84, alignSelf: 'center' }} />
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 }}>
        {GPLANS.map((p, i) => <View key={p.id} style={{ height: 5, width: i === idx ? 14 : 5, borderRadius: 3, backgroundColor: i === idx ? colors.primary : colors.dot }} />)}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24, gap: GAP }} testID="g-days">
        {plan.days.map((f, i) => {
          const cur = i === done, past = i < done;
          const title = f ? `${tr('Day')} ${dayNumber(i)}` : tr('Rest Day');
          return (
            <Pressable
              key={i} testID={`g-day-${i}`}
              onPress={() => (cur ? onStart() : past ? undefined : st.showToast(tr('Finish the previous day to unlock this one.')))}
              style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.md, backgroundColor: cur ? colors.primary : colors.surface }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: cur ? colors.onPrimary : colors.text }}>{title}</Text>
                {!!f && <Text style={{ fontSize: 13, marginTop: 2, color: cur ? colors.onPrimary : colors.muted }}>{focusLabel(f)}</Text>}
              </View>
              {cur ? (
                <View style={{ backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: 20, paddingVertical: 9 }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>{f ? 'Start' : 'Open'}</Text>
                </View>
              ) : past ? (
                <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={18} color={colors.primary} /></View>
              ) : <Ionicons name="lock-closed-outline" size={20} color={colors.text} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function TrainingView({ g }: { g: GState }) {
  const st = useStore();
  const plan = planOf(g.planId);
  const day = g.done[plan.id] ?? 0;
  const focus = day < 30 ? plan.days[day] : null;
  const key = dayKeyOf(plan.id, day);
  const list = day < 30 ? dayExercises(g, plan.id, day, st.allExercises, st.findExercise) : [];
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [orm, setOrm] = useState<string | null>(null);
  const units = st.profile.units;

  const setList = (ids: string[]) => setG((s) => ({ custom: { ...s.custom, [key]: ids } }));
  const add = () => { setPickHandler((ids) => setList([...list.map((e) => e.id), ...ids])); router.push('/exercises/pick'); };
  const regenerated = () => {
    setBusy(false); setEditing(false);
    setG((s) => { const custom = { ...s.custom }; delete custom[key]; return { custom, seeds: { ...s.seeds, [key]: (s.seeds[key] ?? 0) + 1 } }; });
    st.showToast(tr('Plan Updated!'));
  };
  const go = () => {
    setG({ pending: { planId: plan.id, day, at: new Date().toISOString() } });
    st.startWorkout({ entries: dayEntries(g, plan.id, list), title: workoutTitle(plan.id, day) });
    router.push('/active');
  };
  const advance = () => setG((s) => ({ done: { ...s.done, [plan.id]: day + 1 } }));

  if (day >= 30)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
        <Ionicons name="trophy-outline" size={48} color={colors.primary} />
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center' }}>Plan completed</Text>
        <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>You finished all 30 days of this plan.</Text>
        <Btn title="Start again" onPress={() => setG((s) => ({ done: { ...s.done, [plan.id]: 0 } }))} testID="g-restart" />
      </View>
    );

  const head = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 18, paddingBottom: 14 }}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>{focus ? `${tr('Day').toUpperCase()} ${dayNumber(day)}` : tr('Rest Day').toUpperCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {!!focus && <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 15 }}>{focusLabel(focus)}</Text></View>}
          <Text style={{ color: colors.muted, fontSize: 13 }}>{tr(plan.title)}</Text>
        </View>
      </View>
      {!!focus && <BodyMap side={FOCUS[focus].side} primary={FOCUS[focus].regions} width={64} colors={{ body: colors.bodyBase, muscle: colors.bodyMuscle, on: colors.primary }} />}
    </View>
  );

  if (!focus)
    return (
      <View style={{ flex: 1 }}>
        {head}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Ionicons name="bed-outline" size={48} color={colors.faint} />
          <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>Rest is part of the plan. Recover today and come back stronger tomorrow.</Text>
          <Btn title="Done" onPress={advance} testID="g-rest-done" />
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 16 }} testID="g-training">
        {head}
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: PAD, paddingVertical: 12 }}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/g/equipment')} testID="g-equipment">
            <Text style={{ color: colors.muted, fontSize: 13 }}>Equipment</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{g.equipment ? `${g.equipment.length} ${tr('Selected')}` : tr('Default')}</Text>
              <Ionicons name="pencil" size={14} color={colors.muted} />
            </View>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setOrm(String(Math.round(toDisplayWeight(g.orm, units) * 10) / 10))} testID="g-orm">
            <Text style={{ color: colors.muted, fontSize: 13 }}>1RM (Bench Press)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>{fmtWeight(g.orm, units)}</Text>
              <Ionicons name="pencil" size={14} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: PAD, paddingTop: 16, paddingBottom: 6 }}>{list.length} {tr('exercises')}</Text>
        {list.map((e, i) => (
          <Pressable key={`${e.id}-${i}`} onPress={() => !editing && router.push(`/exercises/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: PAD, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.surface }} testID={`g-ex-${i}`}>
            <ExerciseThumb catalogId={e.catalogId} size={52} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{e.name}</Text>
              <Text style={{ color: colors.muted, fontSize: 14, marginTop: 2 }}>{plan.sets} {tr('Sets')} x {plan.reps} {tr('reps')}</Text>
            </View>
            {editing && <Pressable hitSlop={10} onPress={() => setList(list.filter((_, j) => j !== i).map((x) => x.id))} testID={`g-ex-del-${i}`}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>}
          </Pressable>
        ))}
        {!list.length && <Text style={{ color: colors.muted, fontSize: 15, padding: PAD }}>No exercises match your equipment. Change the equipment or add exercises with Edit.</Text>}
        {editing && <Btn title="Add exercise" icon="add" variant="secondary" onPress={add} style={{ margin: PAD }} testID="g-add" />}
      </ScrollView>

      <View style={{ paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 4 }}>
        <Btn title={tr('Start').toUpperCase()} onPress={() => (st.active ? setReplace(true) : go())} disabled={!list.length} style={{ minHeight: 46 }} textStyle={{ fontWeight: '800', letterSpacing: 0.5 }} testID="g-start" />
        <View style={{ flexDirection: 'row' }}>
          <Btn title="Regenerate" icon="refresh" variant="ghost" onPress={() => setBusy(true)} style={{ flex: 1 }} textStyle={{ color: colors.text, fontSize: 15 }} testID="g-regen" />
          <Btn title={editing ? 'Done' : 'Edit'} icon={editing ? 'checkmark' : 'pencil'} variant="ghost" onPress={() => setEditing(!editing)} style={{ flex: 1 }} textStyle={{ color: colors.text, fontSize: 15 }} testID="g-edit" />
        </View>
      </View>

      {busy && <Generating onDone={regenerated} />}
      <Dialog visible={replace} title="Replace current workout?" message="You already have a workout in progress. Starting this one discards it." onClose={() => setReplace(false)}
        actions={[{ label: 'Cancel' }, { label: 'Replace', danger: true, onPress: () => { setReplace(false); st.discardActive(); go(); } }]} />
      <Dialog visible={orm != null} hasInput title="1RM (Bench Press)" message="The most you can bench press for one rep. It sets the bench press weight in this plan." onClose={() => setOrm(null)}
        actions={[{ label: 'Cancel' }, { label: 'Save', primary: true, onPress: () => { const v = parseFloat((orm ?? '').replace(',', '.')); if (v > 0) setG({ orm: Math.round(fromDisplayWeight(v, units) * 10) / 10 }); setOrm(null); } }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <TextInput value={orm ?? ''} onChangeText={setOrm} keyboardType="decimal-pad" autoFocus selectTextOnFocus testID="g-orm-input"
            style={{ minWidth: 90, textAlign: 'center', fontSize: 24, fontWeight: '700', color: colors.text, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 6 }} />
          <Text style={{ color: colors.muted, fontSize: 16 }}>{units.weight}</Text>
        </View>
      </Dialog>
    </View>
  );
}

/** Tela cheia "montando o treino": anel de 0 a 100% e volta sozinha. */
function Generating({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; });
  useEffect(() => {
    const t0 = Date.now();
    const id = setInterval(() => {
      const v = Math.min(1, (Date.now() - t0) / 2400);
      setP(v);
      if (v >= 1) { clearInterval(id); setTimeout(() => done.current(), 250); }
    }, 40);
    return () => clearInterval(id);
  }, []);
  const size = 190, sw = 16, r = (size - sw) / 2, c = 2 * Math.PI * r;
  return (
    <Modal visible animationType="fade" onRequestClose={() => {}}>
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', padding: 24, paddingTop: 90 }} testID="g-generating">
        <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="sparkles" size={28} color={colors.primary} /></View>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, textAlign: 'center', marginTop: 18, maxWidth: 260 }}>Your coach is designing your new workout...</Text>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface} strokeWidth={sw} fill="none" />
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.primary} strokeWidth={sw} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} strokeDashoffset={c * (1 - p)} />
            </Svg>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.text }}>{Math.round(p * 100)}%</Text>
          </View>
        </View>
        <Btn title="Please wait..." onPress={() => {}} disabled style={{ alignSelf: 'stretch', minHeight: 46 }} />
      </View>
    </Modal>
  );
}
