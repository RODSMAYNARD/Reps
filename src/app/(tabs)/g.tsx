import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, Image, Modal, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ActiveBar } from '../../components/ActiveBar';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { GymIcon } from '../../components/GymIcon';
import { SwapPanel } from '../../components/SwapPanel';
import { Text, TextInput } from '../../components/Text';
import { Btn, Dialog, Screen, Sheet } from '../../components/ui';
import { fmtWeight, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import {
  type FocusId, GPLANS, type GPlan, GState, type PresetGroup, PRESETS, dayEntries, dayExercises, dayKeyOf, focusLabel, planOf, planSub,
  presetCount, presetEntries, presetExercises, presetKey, presetOf, presetSetsOf, setG, useG, workoutTitle,
} from '../../lib/gplan';
import { getLang, tr } from '../../lib/i18n';
import { equipImage, muscleImage } from '../../lib/iconImages';
import { setPickHandler } from '../../lib/picker';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';

/** Aba Treinamento (antes "G"). Duas seções separadas (pedido do Rodrigo, 2026-11-23, opções TR1 + TR3 do Rods-Design-Choices):
 * Planos = os planos de 30 dias em sanfona (tocar abre os dias em 3 colunas; o dia abre e se faz ali mesmo);
 * Treinos = treinos prontos agrupados (Por músculo, Por região, Força 5×5). Os dois abrem a mesma tela de detalhe
 * (Equipamento, 1RM, exercícios com Trocar, Iniciar, Gerar de novo, Editar). */

const PAD = 16;
const GAP = 8;
const GREEN = '#22B573';
type Tab = 'plan' | 'train';
type View_ = { kind: 'day'; planId: string; day: number } | { kind: 'wk'; id: string };

/** Desenho 3D do músculo de cada foco do plano. */
const FOCUS_IMG: Record<FocusId, string> = { chest: 'Chest', back: 'Lats', lower: 'Quadriceps', shoulders: 'Shoulders', abs: 'Abdominals', arm: 'Biceps', upper: 'Upper Back', full: 'Full Body' };

export default function GTab() {
  const st = useStore();
  const g = useG(st.session?.user.id ?? null);
  const [tab, setTab] = useState<Tab>('plan');
  const [view, setView] = useState<View_ | null>(null);

  // treino do plano salvo = dia concluído
  useEffect(() => {
    const p = g.pending;
    if (!p) return;
    if (!p.workoutId) { if (st.active && st.active.startedAt >= p.at) setG({ pending: { ...p, workoutId: st.active.id } }); return; }
    if (st.workouts.some((w) => w.id === p.workoutId)) setG((s) => ({ pending: null, done: { ...s.done, [p.planId]: Math.max(s.done[p.planId] ?? 0, p.day + 1) } }));
  }, [g.pending, st.active, st.workouts]);

  return (
    <Screen edges={['top']}>
      {view ? <Detail g={g} view={view} onBack={() => setView(null)} /> : (
        <>
          {/* Planos | Treinos ("Treino" sozinho já é o nome de outra aba) */}
          <View style={{ flexDirection: 'row', marginHorizontal: PAD, marginTop: 10, marginBottom: 4, padding: 4, gap: 4, backgroundColor: colors.surface, borderRadius: radius.md }}>
            {(['plan', 'train'] as Tab[]).map((t) => (
              <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.sm, backgroundColor: tab === t ? colors.primary : 'transparent' }} testID={`g-tab-${t}`}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: tab === t ? '#fff' : colors.muted }}>{t === 'plan' ? '30-Day Plans' : 'AI Workouts'}</Text>
              </Pressable>
            ))}
          </View>
          {tab === 'plan'
            ? <PlanList g={g} onOpen={(planId, day) => setView({ kind: 'day', planId, day })} />
            : <PresetList onOpen={(id) => setView({ kind: 'wk', id })} />}
        </>
      )}
      <ActiveBar />
    </Screen>
  );
}

/** Imagem 3D do plano (equipamento) num quadrado de cantos arredondados. */
function PlanThumb({ p }: { p: GPlan }) {
  const src = equipImage(p.icon);
  return src ? <Image source={src} style={{ width: 46, height: 46 }} /> : (
    <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}><GymIcon name={p.icon} size={26} color={colors.text} /></View>
  );
}

/** Planos (opção TR1): lista em sanfona; o plano aberto mostra os 30 dias em 3 colunas. */
function PlanList({ g, onOpen }: { g: GState; onOpen: (planId: string, day: number) => void }) {
  const st = useStore();
  // aberto = plano escolhido (g.planId, que a H2 também muda), a não ser que a pessoa o tenha fechado
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const openId = g.planId !== closedFor ? g.planId : null;
  const toggle = (id: string) => { if (id === openId) setClosedFor(id); else { setClosedFor(null); setG({ planId: id }); } };

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 6, paddingBottom: 28 }} testID="g-plans">
      <Intro icon="calendar-outline" text="Follow a plan day by day for 30 days. Finish a day to unlock the next one." />
      {GPLANS.map((p, pi) => {
        const open = p.id === openId;
        const done = Math.min(30, g.done[p.id] ?? 0);
        const status = done >= 30 ? tr('Completed') : done ? tr('Day {n} of 30').replace('{n}', String(done + 1)) : tr('30 days');
        return (
          <View key={p.id} style={{ borderBottomWidth: pi < GPLANS.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
            <Pressable onPress={() => toggle(p.id)} testID={`g-plan-${p.id}`} accessibilityRole="button" accessibilityState={{ expanded: open }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
              <PlanThumb p={p} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }} numberOfLines={1}>{p.title}</Text>
                <Text style={{ fontSize: 13, color: colors.muted, marginTop: 1 }} numberOfLines={1}>{`${status} · ${p.sets} x ${p.reps}`}</Text>
                {done > 0 && done < 30 && (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 6 }}><View style={{ height: 4, borderRadius: 2, width: `${(done / 30) * 100}%`, backgroundColor: colors.primary }} /></View>
                )}
              </View>
              <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.faint} />
            </Pressable>
            {open && (
              <View style={{ paddingBottom: 14, gap: 10 }}>
                <Text style={{ fontSize: 13, color: colors.muted }}>{planSub(p)}</Text>
                {done >= 30 && <Btn title="Start again" variant="secondary" onPress={() => setG((s) => ({ done: { ...s.done, [p.id]: 0 } }))} testID="g-restart" />}
                {/* 3 colunas em linhas com flex: 1 (largura fixa estourava quando a barra de rolagem da web rouba espaço) */}
                {Array.from({ length: Math.ceil(p.days.length / 3) }, (_, r) => (
                <View key={r} style={{ flexDirection: 'row', gap: GAP }}>
                  {[0, 1, 2].map((c) => {
                    const i = r * 3 + c;
                    if (i >= p.days.length) return <View key={c} style={{ flex: 1 }} />;
                    const f = p.days[i];
                    const cur = i === done, past = i < done, lock = i > done;
                    return (
                      <Pressable key={c} testID={`g-day-${i}`} style={{ flex: 1, minWidth: 0, minHeight: 64, padding: 9, gap: 3, borderRadius: radius.md, borderWidth: 1.5, borderColor: cur ? colors.primary : 'transparent', backgroundColor: cur ? colors.primarySoft : colors.surface, opacity: lock ? 0.55 : 1 }}
                        onPress={() => (lock ? st.showToast(tr('Finish the previous day to unlock this one.')) : f || cur ? onOpen(p.id, i) : undefined)}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Text style={{ fontSize: 12, fontWeight: '600', color: cur ? colors.primary : colors.muted }}>{`${tr('Day')} ${i + 1}`}</Text>
                          {past ? <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark" size={11} color="#fff" /></View>
                            : lock ? <Ionicons name="lock-closed" size={12} color={colors.faint} /> : null}
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: f ? colors.text : colors.muted }} numberOfLines={1}>{f ? focusLabel(f) : tr('Rest')}</Text>
                        {cur && (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name={f ? 'play' : 'bed'} size={10} color={colors.primary} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{f ? 'Start' : 'Open'}</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

/** Linha de explicação no topo de cada lista. */
function Intro({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: 12, marginTop: 6, marginBottom: 4 }}>
      <Ionicons name={icon} size={18} color={colors.primary} style={{ marginTop: 1 }} />
      <Text style={{ flex: 1, color: colors.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

/** Treinos (opção TR3): treinos prontos em grupos, no estilo dos Ajustes. */
function PresetList({ onOpen }: { onOpen: (id: string) => void }) {
  const groups: [PresetGroup, string][] = [['muscle', 'By muscle'], ['region', 'By region'], ['strength', 'Strength 5×5']];
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: PAD, paddingTop: 6, paddingBottom: 28 }} testID="g-presets">
      <Intro icon="sparkles" text="Workouts generated for you from your equipment. Open one to swap or add exercises, or tap Regenerate for a new version." />
      {groups.map(([grp, label], gi) => (
        <View key={grp}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginTop: gi ? 20 : 6, marginBottom: 8 }}>{label}</Text>
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 14 }}>
            {PRESETS.filter((p) => p.group === grp).map((p, i, a) => {
              const src = p.equip ? equipImage(p.equip) : muscleImage(p.muscle);
              return (
                <Pressable key={p.id} onPress={() => onOpen(p.id)} testID={`g-wk-${p.id}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: i < a.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
                  {src ? <Image source={src} style={{ width: 44, height: 44 }} /> : <View style={{ width: 44, height: 44 }} />}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }} numberOfLines={1}>{p.title}</Text>
                    <Text style={{ fontSize: 13, color: colors.muted, marginTop: 1 }}>{`${presetCount(p)} ${tr('exercises')} · ${p.sets} x ${p.reps}`}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

/** Tela do dia do plano ou do treino pronto: tudo acontece aqui, sem pular de seção. */
function Detail({ g, view, onBack }: { g: GState; view: View_; onBack: () => void }) {
  const st = useStore();
  const isDay = view.kind === 'day';
  const plan = isDay ? planOf(view.planId) : null;
  const preset = view.kind === 'wk' ? presetOf(view.id) : null;
  const day = view.kind === 'day' ? view.day : 0;
  const focus = plan ? plan.days[day] : null;
  const key = plan ? dayKeyOf(plan.id, day) : presetKey(preset!.id);
  const list = plan ? (focus ? dayExercises(g, plan.id, day, st.allExercises, st.findExercise) : []) : presetExercises(g, preset!.id, st.allExercises, st.findExercise);
  const sets = (plan ?? preset)!.sets, reps = (plan ?? preset)!.reps;
  const done = plan ? g.done[plan.id] ?? 0 : 0;
  const img = plan ? (focus ? muscleImage(FOCUS_IMG[focus]) : undefined) : preset!.equip ? equipImage(preset!.equip) : muscleImage(preset!.muscle);

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [replace, setReplace] = useState(false);
  const [orm, setOrm] = useState<string | null>(null);
  const units = st.profile.units;
  // Swap (como no treino ativo): troca um exercício só aqui; Gerar de novo refaz o treino todo.
  const [swapAt, setSwapAt] = useState<number | null>(null);
  const [swapHelp, setSwapHelp] = useState(false);
  const [swapAsk, setSwapAsk] = useState(false);
  const scroll = useRef<ScrollViewInstance>(null);
  const listY = useRef(0);
  const rowY = useRef<number[]>([]);
  const openSwap = (i: number) => {
    setSwapAsk(false); setEditing(false); setSwapAt(i);
    setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, listY.current + (rowY.current[i] ?? 0) - 12), animated: true }), 80);
  };
  const swapMap = g.swapped?.[key] ?? {};
  const swapExclude = (i: number) => new Set(list.flatMap((x, k) => (k === i || !x.catalogId ? [] : [x.catalogId])));
  const swap = (i: number, picked: string) => {
    const cur = list[i].id;
    const map = { ...swapMap };
    const orig = map[cur] ?? cur;
    delete map[cur];
    if (picked !== orig) map[picked] = orig;
    const ids = list.map((x, j) => (j === i ? picked : x.id));
    setG((s) => ({ custom: { ...s.custom, [key]: ids }, swapped: { ...s.swapped, [key]: map } }));
    setSwapAt(null);
  };

  // voltar do Android fecha o detalhe (não sai da aba)
  const back = useRef(onBack);
  useEffect(() => { back.current = onBack; });
  useEffect(() => { const sub = BackHandler.addEventListener('hardwareBackPress', () => { back.current(); return true; }); return () => sub.remove(); }, []);

  /** Último cartão do Swap: escolher qualquer exercício da biblioteca no lugar deste. */
  const swapAny = (i: number) => { setPickHandler((ids) => { if (ids[0]) swap(i, ids[0]); }); router.push('/exercises/pick?single=1'); };
  const setList = (ids: string[]) => setG((s) => ({ custom: { ...s.custom, [key]: ids } }));
  const add = () => { setPickHandler((ids) => setList([...list.map((e) => e.id), ...ids])); router.push('/exercises/pick'); };
  const regenerated = () => {
    setBusy(false); setEditing(false);
    setSwapAt(null);
    setG((s) => { const custom = { ...s.custom }; delete custom[key]; const swapped = { ...s.swapped }; delete swapped[key]; return { custom, swapped, seeds: { ...s.seeds, [key]: (s.seeds[key] ?? 0) + 1 } }; });
    st.showToast(tr(plan ? 'Plan Updated!' : 'Workout updated!'));
  };
  const go = () => {
    if (plan) {
      setG({ pending: { planId: plan.id, day, at: new Date().toISOString() } });
      st.startWorkout({ entries: dayEntries(g, plan.id, list), title: workoutTitle(plan.id, day) });
    } else st.startWorkout({ entries: presetEntries(g, preset!.id, list), title: tr(preset!.title) });
    router.push('/active');
  };

  const head = (
    <View style={{ paddingHorizontal: PAD, paddingTop: 8, paddingBottom: 14 }}>
      <Pressable onPress={onBack} hitSlop={8} testID="g-back" style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 10 }}>
        <Ionicons name="chevron-back" size={22} color={colors.primary} />
        <Text style={{ color: colors.primary, fontSize: 16 }} numberOfLines={1}>{plan ? plan.title : 'AI Workouts'}</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{plan ? (focus ? `${tr('Day')} ${day + 1}` : tr('Rest Day')) : preset!.title}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {!!focus && <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 }}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{focusLabel(focus)}</Text></View>}
            {(!plan || !!focus) && <Text style={{ color: colors.muted, fontSize: 13 }}>{plan ? `${sets} x ${reps} · ~${Math.max(10, Math.round((list.length * sets * 2.5) / 5) * 5)} min` : `${list.length} ${tr('exercises')} · ${sets} x ${reps}`}</Text>}
            {plan && day < done && <Ionicons name="checkmark-circle" size={18} color={GREEN} />}
          </View>
        </View>
        {!!img && <Image source={img} style={{ width: 64, height: 64 }} />}
      </View>
    </View>
  );

  if (plan && !focus)
    return (
      <View style={{ flex: 1 }}>
        {head}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 }}>
          <Ionicons name="bed-outline" size={48} color={colors.faint} />
          <Text style={{ color: colors.muted, fontSize: 15, textAlign: 'center' }}>Rest is part of the plan. Recover today and come back stronger tomorrow.</Text>
          {day === done && <Btn title="Done" onPress={() => { setG((s) => ({ done: { ...s.done, [plan.id]: day + 1 } })); onBack(); }} testID="g-rest-done" />}
        </View>
      </View>
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView ref={scroll} contentContainerStyle={{ paddingBottom: 16 }} testID="g-training">
        {head}
        <View style={{ flexDirection: 'row', gap: GAP, paddingHorizontal: PAD }}>
          <Pressable style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 }} onPress={() => router.push('/g/equipment')} testID="g-equipment">
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>Equipment</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{g.equipment ? `${g.equipment.length} ${tr('Selected')}` : tr('Default')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </View>
          </Pressable>
          <Pressable style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 }} onPress={() => setOrm(String(Math.round(toDisplayWeight(g.orm, units) * 10) / 10))} testID="g-orm">
            <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>1RM (Bench Press)</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{fmtWeight(g.orm, units)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.faint} />
            </View>
          </Pressable>
        </View>

        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, paddingHorizontal: PAD, paddingTop: 20, paddingBottom: 10 }}>{`${list.length} ${tr('exercises')}`}</Text>
        <View style={{ paddingHorizontal: PAD, gap: GAP }} onLayout={(ev) => { listY.current = ev.nativeEvent.layout.y; }}>
          {list.map((e, i) => {
            const was = swapMap[e.id] ? st.findExercise(swapMap[e.id])?.name : undefined;
            const open = swapAt === i && !editing;
            return (
              <View key={`${e.id}-${i}`} onLayout={(ev) => { rowY.current[i] = ev.nativeEvent.layout.y; }} style={{ borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: open ? colors.primary : 'transparent' }}>
                <Pressable onPress={() => !editing && router.push(`/exercises/${e.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }} testID={`g-ex-${i}`}>
                  <ExerciseThumb catalogId={e.catalogId} size={48} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{e.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{`${preset ? presetSetsOf(preset, e) : sets} ${tr('Sets')} x ${reps} ${tr('reps')}`}</Text>
                    {!!was && <Text style={{ color: '#F28A1E', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{`${tr('Swapped · was')} ${was}`}</Text>}
                  </View>
                  {editing ? (
                    <Pressable hitSlop={10} onPress={() => setList(list.filter((_, j) => j !== i).map((x) => x.id))} testID={`g-ex-del-${i}`}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
                  ) : open ? (
                    <Pressable onPress={() => setSwapAt(null)} hitSlop={10} accessibilityLabel={tr('Close')} testID={`g-swap-close-${i}`}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
                  ) : (
                    <Pressable onPress={() => openSwap(i)} hitSlop={10} accessibilityLabel={tr('Swap')} testID={`g-ex-swap-${i}`}><Ionicons name="swap-horizontal" size={20} color={colors.primary} /></Pressable>
                  )}
                </Pressable>
                {open && (
                  <SwapPanel currentId={e.id} originalId={swapMap[e.id] ?? e.id} exclude={swapExclude(i)} onPick={(id) => swap(i, id)} onInfo={() => setSwapHelp(true)} onMore={() => swapAny(i)}
                    hint={plan ? 'Tap another exercise to use it instead, only on this day of the plan.' : 'Tap another exercise to use it instead in this workout.'}
                    style={{ marginHorizontal: 0, marginTop: 0, backgroundColor: 'transparent', paddingTop: 0 }} />
                )}
              </View>
            );
          })}
          {(
            <Pressable onPress={add} testID="g-add" style={{ borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Ionicons name="add-circle" size={24} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>Add exercise</Text>
            </Pressable>
          )}
        </View>
        {!list.length && <Text style={{ color: colors.muted, fontSize: 15, padding: PAD }}>No exercises match your equipment. Change the equipment or add exercises.</Text>}
      </ScrollView>

      <View style={{ paddingHorizontal: PAD, paddingTop: 10, paddingBottom: 10, gap: GAP, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}>
        <Btn title="Start Workout" icon="play" onPress={() => (st.active ? setReplace(true) : go())} disabled={!list.length} testID="g-start" />
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Btn title={getLang() === 'pt' ? 'Gerar outro' : 'Regenerate'} icon="refresh" variant="secondary" onPress={() => setBusy(true)} style={{ flex: 1, paddingHorizontal: 6 }} textStyle={{ fontSize: 14 }} testID="g-regen" />
          <Btn title={editing ? 'Done' : 'Edit'} icon={editing ? 'checkmark' : 'pencil'} variant="secondary" onPress={() => { setSwapAt(null); setEditing(!editing); }} style={{ flex: 1, paddingHorizontal: 6 }} textStyle={{ fontSize: 14 }} testID="g-edit" />
          <Btn title="Swap" icon="swap-horizontal" variant="secondary" selected={swapAt != null} onPress={() => setSwapAsk(true)} disabled={!list.length} style={{ flex: 1, paddingHorizontal: 6 }} textStyle={{ fontSize: 14 }} testID="g-swap" />
        </View>
      </View>

      {busy && <Generating onDone={regenerated} />}
      <Sheet visible={swapAsk} onClose={() => setSwapAsk(false)} title="Which exercise do you want to swap?">
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 8 }} testID="g-swap-ask">
          {list.map((e, i) => (
            <Pressable key={`${e.id}-${i}`} onPress={() => openSwap(i)} testID={`g-swap-pick-${i}`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: i < list.length - 1 ? StyleSheet.hairlineWidth : 0, borderBottomColor: colors.border }}>
              <ExerciseThumb catalogId={e.catalogId} size={44} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 16 }} numberOfLines={2}>{e.name}</Text>
              <Ionicons name="swap-horizontal" size={18} color={colors.primary} />
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
      <Dialog visible={swapHelp} title="Swap" message="Pick another exercise that trains the same muscle. It replaces this one only here; tap the original to undo. For a completely different workout, use Regenerate." onClose={() => setSwapHelp(false)}
        actions={[{ label: 'Got it!', primary: true, onPress: () => setSwapHelp(false) }]} />
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
