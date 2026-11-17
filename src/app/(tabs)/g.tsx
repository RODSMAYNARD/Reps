import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, type ScrollViewInstance, View, useWindowDimensions } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ActiveBar } from '../../components/ActiveBar';
import { BodyMap } from '../../components/BodyMap';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { GymIcon } from '../../components/GymIcon';
import { Text, TextInput } from '../../components/Text';
import { Btn, Dialog, Screen } from '../../components/ui';
import { fmtWeight, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { FOCUS, GPLANS, GState, dayEntries, dayExercises, dayKeyOf, dayNumber, focusLabel, planOf, planSub, planTint, setG, useG, workoutTitle } from '../../lib/gplan';
import { tr } from '../../lib/i18n';
import { setPickHandler } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

/** Aba G (em teste, para o Rodrigo comparar): PLAN = planos de 30 dias; TRAINING = treino do dia gerado (equipamento, 1RM, regenerar, editar). */

const PAD = 20;
const GAP = 10;
const GREEN = '#22B573';
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
      {/* Plan | Training: seletor em pílula, no estilo dos cartões da H2 */}
      <View style={{ flexDirection: 'row', marginHorizontal: PAD, marginTop: 10, marginBottom: 4, padding: 4, gap: 4, backgroundColor: colors.surface, borderRadius: radius.md }}>
        {(['plan', 'training'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, backgroundColor: tab === t ? colors.primary : 'transparent' }} testID={`g-tab-${t}`}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: tab === t ? '#fff' : colors.muted }}>{t === 'plan' ? 'Plan' : 'Training'}</Text>
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
  // plano escolhido fora do carrossel (ao abrir, ou vindo da H2): leva o carrossel até ele
  const shown = useRef(0);
  useEffect(() => { if (shown.current !== idx) { shown.current = idx; ref.current?.scrollTo({ x: idx * step, animated: false }); } }, [idx, step]);
  // a aba escondida não rola: ao ganhar foco, confere de novo
  useFocusEffect(useCallback(() => { shown.current = idx; ref.current?.scrollTo({ x: idx * step, animated: false }); }, [idx, step]));
  const plan = GPLANS[idx];
  const tint = planTint(plan);
  const done = g.done[plan.id] ?? 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={ref} horizontal showsHorizontalScrollIndicator={false} snapToInterval={step} decelerationRate="fast" scrollEventThrottle={32}
        style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 12, gap: GAP, paddingRight: PAD + 16 }}
        onScroll={(e) => { const i = Math.max(0, Math.min(GPLANS.length - 1, Math.round(e.nativeEvent.contentOffset.x / step))); shown.current = i; if (GPLANS[i].id !== g.planId) setG({ planId: GPLANS[i].id }); }}>
        {GPLANS.map((p) => {
          const d = Math.min(30, g.done[p.id] ?? 0);
          const c = planTint(p);
          return (
            <View key={p.id} style={{ width: cardW, borderRadius: radius.lg, backgroundColor: `${c}1A`, padding: 16, gap: 12 }} testID={`g-plan-${p.id}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: c, alignItems: 'center', justifyContent: 'center' }}><GymIcon name={p.icon} size={28} color="#fff" /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{p.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{planSub(p)}</Text>
                </View>
              </View>
              <View style={{ gap: 6 }}>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: `${c}33` }}><View style={{ height: 6, borderRadius: 3, width: `${(d / 30) * 100}%`, backgroundColor: c }} /></View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>{d >= 30 ? tr('Completed') : d === 0 ? `30 ${tr('Days')}` : `${30 - d} ${tr('days left')}`}</Text>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700' }}>{d}/30</Text>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, paddingVertical: 10 }}>
        {GPLANS.map((p, i) => <View key={p.id} style={{ height: 5, width: i === idx ? 14 : 5, borderRadius: 3, backgroundColor: i === idx ? tint : colors.dot }} />)}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 28, gap: GAP }} testID="g-days">
        {plan.days.map((f, i) => {
          const cur = i === done, past = i < done;
          return (
            <Pressable
              key={i} testID={`g-day-${i}`}
              onPress={() => (cur ? onStart() : past ? undefined : st.showToast(tr('Finish the previous day to unlock this one.')))}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: cur ? `${tint}1A` : colors.surface }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: past ? GREEN : cur ? tint : colors.surfaceAlt }}>
                {past ? <Ionicons name="checkmark-done" size={22} color="#fff" /> : f ? <Text style={{ fontSize: 16, fontWeight: '800', color: cur ? '#fff' : colors.muted }}>{dayNumber(i)}</Text> : <Ionicons name="bed" size={19} color={cur ? '#fff' : colors.muted} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: !cur && !past ? colors.muted : colors.text }} numberOfLines={1}>{f ? focusLabel(f) : tr('Rest Day')}</Text>
                <Text style={{ fontSize: 13, marginTop: 1, color: colors.muted }} numberOfLines={1}>{f ? `${tr('Day')} ${dayNumber(i)} · ${plan.sets} x ${plan.reps}` : `${tr('Day')} ${dayNumber(i)}`}</Text>
              </View>
              {cur ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: tint, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md }}>
                  {!!f && <Ionicons name="play" size={13} color="#fff" />}
                  <Text style={{ color: '#fff', fontWeight: '600' }}>{f ? 'Start' : 'Open'}</Text>
                </View>
              ) : past ? null : <Ionicons name="lock-closed" size={17} color={colors.faint} />}
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
  const tint = planTint(plan);
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
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD, paddingTop: 14, paddingBottom: 16 }}>
      <View style={{ flex: 1, gap: 8 }}>
        <Text style={{ fontSize: 16, color: colors.muted }} numberOfLines={1}>{tr(plan.title)}</Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text, marginTop: -6 }}>{focus ? `${tr('Day')} ${dayNumber(day)}` : tr('Rest Day')}</Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          {!!focus && <View style={{ backgroundColor: `${tint}1A`, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: tint, fontWeight: '700', fontSize: 14 }}>{focusLabel(focus)}</Text></View>}
          {!!focus && <Text style={{ color: colors.muted, fontSize: 13 }}>{plan.sets} x {plan.reps} · ~{Math.max(10, Math.round((list.length * plan.sets * 2.5) / 5) * 5)} min</Text>}
        </View>
      </View>
      {!!focus && <BodyMap side={FOCUS[focus].side} primary={FOCUS[focus].regions} width={64} colors={{ body: colors.bodyBase, muscle: colors.bodyMuscle, on: tint }} />}
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
        <View style={{ flexDirection: 'row', gap: GAP, paddingHorizontal: PAD }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 }} onPress={() => router.push('/g/equipment')} testID="g-equipment">
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>Equipment</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="barbell" size={20} color="#1E9BD7" />
              <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{g.equipment ? `${g.equipment.length} ${tr('Selected')}` : tr('Default')}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
          <Pressable style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 }} onPress={() => setOrm(String(Math.round(toDisplayWeight(g.orm, units) * 10) / 10))} testID="g-orm">
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>1RM (Bench Press)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trophy" size={19} color="#F28A1E" />
              <Text style={{ flex: 1, color: colors.text, fontSize: 18, fontWeight: '800' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmtWeight(g.orm, units)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </View>
          </Pressable>
        </View>

        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 10 }}>{list.length} {tr('exercises')}</Text>
        <View style={{ paddingHorizontal: PAD, gap: GAP }}>
          {list.map((e, i) => (
            <Pressable key={`${e.id}-${i}`} onPress={() => !editing && router.push(`/exercises/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surface }} testID={`g-ex-${i}`}>
              <ExerciseThumb catalogId={e.catalogId} size={48} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }} numberOfLines={2}>{e.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{plan.sets} {tr('Sets')} x {plan.reps} {tr('reps')}</Text>
              </View>
              {editing ? <Pressable hitSlop={10} onPress={() => setList(list.filter((_, j) => j !== i).map((x) => x.id))} testID={`g-ex-del-${i}`}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable> : <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
            </Pressable>
          ))}
          {editing && (
            <Pressable onPress={add} testID="g-add" style={{ borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Add exercise</Text>
            </Pressable>
          )}
        </View>
        {!list.length && <Text style={{ color: colors.muted, fontSize: 15, padding: PAD }}>No exercises match your equipment. Change the equipment or add exercises with Edit.</Text>}
      </ScrollView>

      <View style={{ paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 10, gap: GAP }}>
        <Pressable onPress={() => (st.active ? setReplace(true) : go())} disabled={!list.length} testID="g-start"
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.primary, paddingVertical: 14, borderRadius: radius.md, opacity: list.length ? 1 : 0.45 }}>
          <Ionicons name="play" size={15} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Start Workout</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Btn title="Regenerate" icon="refresh" variant="secondary" onPress={() => setBusy(true)} style={{ flex: 1 }} textStyle={{ fontSize: 15 }} testID="g-regen" />
          <Btn title={editing ? 'Done' : 'Edit'} icon={editing ? 'checkmark' : 'pencil'} variant="secondary" onPress={() => setEditing(!editing)} style={{ flex: 1 }} textStyle={{ fontSize: 15 }} testID="g-edit" />
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
