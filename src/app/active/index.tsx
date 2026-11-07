import { ExerciseLabel } from '../../components/ExerciseLabel';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReorderList } from '../../components/ReorderList';
import { DurationSheet } from '../../components/DurationSheet';
import { BodyMap, regionsOf, type Region } from '../../components/BodyMap';
import { ClockSheet, fmtStopwatch, swMs, type Stopwatch } from '../../components/ClockSheet';
import { RestSheet } from '../../components/pickers';
import { NoteInput } from '../../components/NoteInput';
import { PlateIcon } from '../../components/PlateIcon';
import { SwapPanel } from '../../components/SwapPanel';
import { SwipeRow } from '../../components/SwipeRow';
import { notesOf } from '../../lib/notes';
import { PlateSheet } from '../../components/PlateSheet';
import { hasWeight, weightHeader } from '../../lib/exerciseOptions';
import { Btn, Dialog, Empty, Header, HeaderAction, IconButton, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { SET_TYPES } from '../../lib/constants';
import { fmtClock, fmtDurationLive, fmtRest, fmtVolume, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { setPickHandler } from '../../lib/picker';
import { prFlags, records, setVolume } from '../../lib/stats';
import { elapsedSec, useNow, useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { ActiveEntry, ActiveSet, Exercise, Units } from '../../lib/types';


export default function ActiveWorkoutScreen() {
  const st = useStore();
  const { active, profile, rest } = st;
  const now = useNow(1000, true);
  const [setSheet, setSetSheet] = useState<{ i: number; j: number } | null>(null);
  const [restSheet, setRestSheet] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [durSheet, setDurSheet] = useState(false);
  const [timerSheet, setTimerSheet] = useState(false);
  const [sw, setSw] = useState<Stopwatch>({ acc: 0, startedAt: null });
  const swNow = useNow(100, !!sw.startedAt);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [helpType, setHelpType] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [hiddenSheet, setHiddenSheet] = useState(false);
  const [plate, setPlate] = useState<number | null>(null);
  const [wsheet, setWsheet] = useState<number | null>(null);
  const [unitSheet, setUnitSheet] = useState(false);
  const [swapOpen, setSwapOpen] = useState<Record<string, boolean>>({});
  const [noteSheet, setNoteSheet] = useState<{ i: number; id: string } | null>(null);
  const [focusNote, setFocusNote] = useState<string | null>(null);
  const [statsOff, setStatsOff] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [kgFocus, setKgFocus] = useState<{ i: number; j: number } | null>(null);
  const [plateJ, setPlateJ] = useState<number | null>(null);
  const [ssPick, setSsPick] = useState<number | null>(null);
  const [help, setHelp] = useState<{ title: string; text: string } | null>(null);
  const keepAwake = st.wprefs.keepAwake && !!active;
  useEffect(() => {
    if (!keepAwake) return;
    activateKeepAwakeAsync('reps-workout').catch(() => {});
    return () => { deactivateKeepAwake('reps-workout').catch(() => {}); };
  }, [keepAwake]);
  const u = profile.units;
  const insets = useSafeAreaInsets();

  if (!active)
    return (
      <Screen><Header left="down" title="Log Workout" /><Empty text="No workout in progress." action={<Btn title="Back" onPress={() => router.back()} />} /></Screen>
    );

  const exOf = (id: string): Exercise | undefined => st.findExercise(id);
  const elapsed = elapsedSec(active, now);
  const shown = active.entries.map((e, i) => ({ e, i })).filter((x) => !x.e.hidden);
  const hiddenList = active.entries.map((e, i) => ({ e, i })).filter((x) => x.e.hidden);
  const uidOf = (e: ActiveEntry, i: number) => e.uid ?? `${e.exerciseId}-${i}`;
  const allCollapsed = shown.length > 0 && shown.every((x) => collapsed[uidOf(x.e, x.i)]);
  const setAll = (v: boolean) => setCollapsed(Object.fromEntries(shown.map((x) => [uidOf(x.e, x.i), v])));
  const doneSets = shown.flatMap((x) => x.e.sets.filter((s) => s.done));
  const volume = doneSets.reduce((t, s) => t + setVolume(s), 0);
  const worked = active ? active.entries.filter((e) => !e.hidden && e.sets.some((s) => s.done)).map((e) => exOf(e.exerciseId)) : [];
  const litPrimary = [...new Set(worked.flatMap((x) => [...regionsOf(x?.muscle), ...regionsOf(x?.target)]))] as Region[];
  const litSecondary = [...new Set(worked.flatMap((x) => (x?.secondary ?? []).flatMap(regionsOf)))] as Region[];
  const bodyColors = { body: '#B9C0CB', muscle: '#E3E7ED', on: colors.primary };
  /** Atalho "Calculator" que SOBREPÕE a linha de baixo da série em foco (sem empurrar a lista), como no Hevy.
   * Fica dentro da área da linha seguinte (ou da do "Add Set"), senão o Android não entrega o toque. */
  const calcChip = (i: number, j: number) => {
    const entry = active?.entries[i];
    if (!entry || kgFocus?.i !== i || kgFocus.j !== j || !st.wprefs.plateCalc || !/barbell/i.test(exOf(entry.exerciseId)?.equipment ?? '')) return null;
    return (
      <Pressable testID="kg-calculator" focusable={false} onPress={() => { setPlateJ(j); setPlate(i); }}
        style={{ position: 'absolute', left: 8, top: 2, zIndex: 10, elevation: 6, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10 }}>
        <PlateIcon size={24} color={colors.text} /><Text style={{ color: colors.text, fontSize: 17 }}>Calculator</Text>
      </Pressable>
    );
  };

  const pickFor = (cb: (ids: string[]) => void, single = false) => { setPickHandler(cb); router.push({ pathname: '/exercises/pick', params: single ? { single: '1' } : {} }); };
  const addWarmups = (i: number) => {
    const e = active.entries[i];
    const work = e.sets.filter((x) => x.type !== 'warmup');
    const base = Math.max(0, ...work.map((x) => x.kg ?? 0));
    if (!base) return st.showToast('Enter a working weight first.');
    const eq = exOf(e.exerciseId)?.equipment ?? '';
    const inc = /dumbbell/i.test(eq) ? st.wprefs.dumbbellRounding : st.wprefs.plateRounding;
    const rows = st.wprefs.warmupFormula.map((r) => ({ type: 'warmup' as const, kg: Math.max(inc, Math.round((base * r.pct) / 100 / inc) * inc), reps: r.reps, done: false }));
    st.patchEntry(i, { sets: [...rows, ...e.sets.filter((x) => x.type !== 'warmup' || x.done || (x.kg ?? 0) > 0)] });
  };
  /** Ids de catálogo dos OUTROS exercícios do treino: não são oferecidos como troca. */
  const swapExclude = (i: number) => new Set(active.entries.flatMap((x, k) => (k === i ? [] : [exOf(x.exerciseId)?.catalogId ?? ''])).filter(Boolean) as string[]);
  /** Deixa a variação como exercício principal da rotina (troca definitiva do original por ela). */
  const makeMain = async (i: number) => {
    const e = active.entries[i];
    if (!e?.swappedFrom) return;
    if (!active.fromRoutineId) return st.showToast('Start this workout from a routine to change its main exercise.');
    const r = st.routines.find((x) => x.id === active.fromRoutineId);
    if (!r) return st.showToast('Routine not found.');
    const from = st.realExerciseId(e.swappedFrom);
    const idx = r.exercises.findIndex((x) => st.realExerciseId(x.exerciseId) === from);
    if (idx < 0) return st.showToast('The original exercise is no longer in this routine.');
    const saved = await st.saveRoutine({ id: r.id, title: r.title, notes: r.notes, exercises: r.exercises.map((x, k) => (k === idx ? { ...x, exerciseId: e.exerciseId } : x)) });
    if (saved) { st.patchEntry(i, { swappedFrom: undefined }); st.showToast(`${exOf(e.exerciseId)?.name ?? 'Exercise'} is now the main exercise in ${r.title}.`); }
  };
  const goSave = () => router.push('/active/save');
  const hasTyped = shown.some((x) => x.e.sets.some((s) => !s.done && s.typed && ((s.kg ?? 0) > 0 || (s.reps ?? 0) > 0)));
  const finish = () => {
    if (doneSets.length === 0 && !hasTyped) return st.showToast('Complete at least one set.');
    st.completeTypedSets();
    goSave();
  };
  const restLeft = rest ? Math.max(0, Math.round((rest.endsAt - now) / 1000)) : 0;
  if (rest && restLeft <= 0) setTimeout(() => st.skipRest(), 0);

  const label = (e: ActiveEntry, s: ActiveSet, j: number) => {
    const t = SET_TYPES.find((x) => x.type === s.type)!;
    if (s.type !== 'normal') return { text: t.badge, color: t.color };
    return { text: String(e.sets.slice(0, j + 1).filter((x) => x.type === 'normal').length), color: colors.text };
  };

  return (
    <Screen>
      <Header left="down" titleAlign="left" title={sw.startedAt || sw.acc > 0 ? <Text style={{ color: colors.primary, fontSize: 16, fontVariant: ['tabular-nums'] }} testID="header-stopwatch">{fmtStopwatch(swMs(sw, swNow))}</Text> : statsOff ? <Text style={{ color: colors.primary, fontSize: 16 }} testID="header-duration">{fmtDurationLive(elapsed)}</Text> : 'Log Workout'} right={<>
        <IconButton name="alarm-outline" onPress={() => setTimerSheet(true)} testID="open-timer" />
        <HeaderAction label="Finish" primary onPress={finish} />
      </>} />
      {reordering && (
        <View style={{ flex: 1 }}>
          <ReorderList
            items={shown.map(({ e }) => { const ex = exOf(e.exerciseId); return { key: e.uid ?? e.exerciseId, title: ex?.name ?? 'Removed exercise', subtitle: `${e.sets.filter((s) => s.done).length}/${e.sets.length} sets`, catalogId: ex?.catalogId }; })}
            onMove={(from, to) => st.moveEntry(shown[from].i, shown[to].i)}
          />
          <View style={{ padding: 16 }}><Btn title="Done" onPress={() => setReordering(false)} testID="reorder-done" /></View>
        </View>
      )}
      {/* barra de números fixa (sticky) abaixo do cabeçalho; o ✕ recolhe e o "+" no topo traz de volta, como no Hevy */}
      {!reordering && !statsOff && (
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg }} testID="stats-bar">
          <Pressable onPress={() => setDurSheet(true)} testID="duration" style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Duration</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{fmtDurationLive(elapsed)}</Text></Pressable>
          <View style={{ flex: 1 }}><Stat label="Volume" value={fmtVolume(volume, u)} /></View>
          <View style={{ flex: 0.7 }}><Stat label="Sets" value={String(doneSets.length)} /></View>
          <View style={{ flexDirection: 'row', gap: 4, marginRight: scrolled ? 10 : 0 }}>
            <BodyMap side="front" primary={litPrimary} secondary={litSecondary} width={30} colors={bodyColors} />
            <BodyMap side="back" primary={litPrimary} secondary={litSecondary} width={30} colors={bodyColors} />
          </View>
          {scrolled && <Pressable onPress={() => setStatsOff(true)} hitSlop={8} testID="stats-close" style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={18} color={colors.text} /></Pressable>}
        </View>
      )}
      {!reordering && <View style={{ flex: 1 }}><ScrollView contentContainerStyle={{ paddingBottom: rest ? 100 : 40 }} keyboardShouldPersistTaps="handled" scrollEventThrottle={16}
        onScroll={(ev) => { const y = ev.nativeEvent.contentOffset.y; setScrolled(y > 6); if (y <= 2) setStatsOff(false); }}>
        {shown.length > 1 && (
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 18, paddingHorizontal: 16, paddingTop: 12 }}>
            <Pressable onPress={() => setReordering(true)} testID="reorder-btn" hitSlop={8} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Ionicons name="swap-vertical" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>Reorder</Text>
            </Pressable>
            <Pressable onPress={() => setAll(!allCollapsed)} testID="collapse-all" hitSlop={8} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
              <Ionicons name={allCollapsed ? 'expand-outline' : 'contract-outline'} size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>{allCollapsed ? 'Expand all' : 'Collapse all'}</Text>
            </Pressable>
          </View>
        )}

        {shown.length === 0 && <Empty text={hiddenList.length ? 'All exercises are hidden for this workout.' : 'Start by adding an exercise to your workout.'} />}

        {shown.map(({ e, i }) => {
          const ex = exOf(e.exerciseId);
          const kind = ex?.kind ?? 'weight_reps';
          const uid = uidOf(e, i);
          const isCollapsed = !!collapsed[uid];
          const prevSets = st.previousSets(e.exerciseId);
          const prs = prFlags(records(st.workouts, st.realExerciseId(e.exerciseId)), e.sets);
          const eu: Units = e.unit ? { ...u, weight: e.unit } : u;
          const toggle = () => setCollapsed((c) => ({ ...c, [uid]: !c[uid] }));
          return (
            <View key={uid} style={{ paddingTop: 16 }} testID="entry">
              <Pressable onPress={isCollapsed ? toggle : undefined} onLongPress={() => setReordering(true)} delayLongPress={450} testID="entry-header" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
                <ExerciseThumb catalogId={ex?.catalogId} uri={ex?.assetUri} size={isCollapsed ? 36 : 44} />
                <View style={{ flex: 1 }}>
                  <Text onPress={() => router.push({ pathname: '/exercises/[id]', params: { id: e.exerciseId } })} style={{ color: colors.primary, fontSize: isCollapsed ? 16 : 17, fontWeight: '600' }}>{ex?.name ?? 'Removed exercise'}</Text>
                  {isCollapsed && <Text style={{ color: colors.muted, fontSize: 13 }}>{e.sets.filter((s) => s.done).length}/{e.sets.length} sets</Text>}
                  {!!e.swappedFrom && <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', marginTop: 1 }} numberOfLines={1}>Swapped today · was {exOf(e.swappedFrom)?.name ?? 'original'}</Text>}
                </View>
                <IconButton name={isCollapsed ? 'chevron-down' : 'chevron-up'} onPress={toggle} testID="entry-toggle" />
                <IconButton name="ellipsis-vertical" onPress={() => setMenu(i)} testID="entry-menu" />
              </Pressable>
              {isCollapsed ? <View style={{ height: 8, borderBottomWidth: 1, borderBottomColor: colors.surface }} /> : <>
              {e.superset != null && (
                <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
                  <View testID="superset-badge" style={{ alignSelf: 'flex-start', backgroundColor: colors.purple, borderRadius: radius.md, paddingHorizontal: 16, paddingVertical: 8 }}><Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Superset</Text></View>
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
                <Pressable onPress={() => setRestSheet(i)} testID="rest-chip" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9 }}>
                  <Ionicons name="timer-outline" size={18} color={colors.text} /><Text style={{ color: colors.text, fontSize: 15 }}>Rest: {e.restSec ? fmtRest(e.restSec) : 'Off'}</Text>
                </Pressable>
                <Pressable onPress={() => setFocusNote(st.addNote(i))} testID="note-chip" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9 }}>
                  <Ionicons name="document-text-outline" size={18} color={colors.text} /><Text style={{ color: colors.text, fontSize: 15 }}>Note</Text>
                </Pressable>
              </View>
              {notesOf(e).map((n) => (
                <View key={n.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 2 }}>
                  <Pressable onPress={() => setNoteSheet({ i, id: n.id })} hitSlop={10} testID="note-type" style={{ height: 24, justifyContent: 'center' }}><Ionicons name={NOTE_KINDS.find((k) => k.kind === n.kind)!.icon} size={22} color={colors.text} /></Pressable>
                  <NoteInput value={n.text} autoFocus={focusNote === n.id} onChangeText={(txt) => st.setNote(i, n.id, txt)} onBlur={() => { if (!n.text.trim()) st.deleteNote(i, n.id); }} />
                </View>
              ))}
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6 }}>
                <Pressable onPress={() => setHelp(HELP.sets)} hitSlop={6} style={{ width: 38 }} testID="help-set"><Text style={h.c}>SET</Text></Pressable>
                <Pressable onPress={() => setHelp(HELP.previous)} hitSlop={6} style={{ flex: 1.3 }} testID="help-previous"><Text style={h.c}>PREVIOUS</Text></Pressable>
                {hasWeight(kind) && <Pressable onPress={() => setWsheet(i)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }} testID="weight-header" hitSlop={8}><Ionicons name="barbell-outline" size={14} color={colors.muted} /><Text style={h.c}>{weightHeader(kind, eu.weight)}</Text></Pressable>}
                <Pressable onPress={() => setHelp(kind === 'duration' ? HELP.time : HELP.reps)} hitSlop={6} style={{ flex: 1 }} testID="help-reps"><Text style={h.c}>{kind === 'duration' ? 'SEC' : 'REPS'}</Text></Pressable>
                <Pressable onPress={() => setHelp(HELP.complete)} hitSlop={6} style={{ width: 38 }} testID="help-complete"><Text style={h.c}>✓</Text></Pressable>
              </View>
              {e.sets.map((s, j) => {
                const lb = label(e, s, j);
                const prev = prevSets[j] ?? null;
                return (
                  <SwipeRow key={j} onDelete={() => st.removeSet(i, j)}><View testID="set-row" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: s.done ? colors.successSoft : colors.bg }}>
                    <Pressable onPress={() => setSetSheet({ i, j })} style={{ width: 38, alignItems: 'center', paddingVertical: 6 }} testID="set-type">
                      <View style={{ width: 35, height: 35, borderRadius: 8, backgroundColor: s.done ? colors.bg : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        {prs[j] ? <Ionicons name="ribbon" size={20} color="#F5C400" /> : <Text style={{ color: lb.color, fontWeight: '700', fontSize: 16 }}>{lb.text}</Text>}
                      </View>
                    </Pressable>
                    <Pressable
                      style={{ flex: 1.3, alignItems: 'center' }}
                      onPress={() => prev && st.patchSet(i, j, { kg: prev.kg, reps: prev.reps, typed: true })}>
                      <Text style={{ color: colors.faint, fontSize: 14 }}>{prev ? (hasWeight(kind) ? `${Math.round(toDisplayWeight(prev.kg ?? 0, eu) * 10) / 10}${eu.weight} × ${prev.reps}` : String(prev.reps)) : '-'}</Text>
                    </Pressable>
                    {hasWeight(kind) && (
                      <View style={{ flex: 1, paddingHorizontal: 6 }}>
                        <NumInput decimal style={inputStyle(s.done)} testID="kg" onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setKgFocus({ i, j }); }} onBlur={() => { blurTimer.current = setTimeout(() => setKgFocus((f) => (f && f.i === i && f.j === j ? null : f)), 600); }} value={s.kg == null ? null : Math.round(toDisplayWeight(s.kg, eu) * 10) / 10} onChange={(v) => st.patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, eu), typed: true })} />
                      </View>
                    )}
                    <View style={{ flex: 1, paddingHorizontal: 6 }}><NumInput style={inputStyle(s.done)} testID="reps" value={s.reps} onChange={(v) => st.patchSet(i, j, { reps: v, typed: true })} /></View>
                    <Pressable onPress={() => { st.toggleSet(i, j); if (!s.done) setSwapOpen((o) => (o[uid] ? { ...o, [uid]: false } : o)); }} testID="check" style={{ width: 38, alignItems: 'center' }}>
                      <View style={{ width: 35, height: 35, borderRadius: 8, backgroundColor: s.done ? colors.success : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={18} color={s.done ? '#fff' : colors.faint} />
                      </View>
                    </Pressable>
                    {calcChip(i, j - 1)}
                  </View></SwipeRow>
                );
              })}
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>{calcChip(i, e.sets.length - 1)}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn title="Swap" icon="swap-horizontal" variant="secondary" selected={!!swapOpen[uid]} style={{ flex: 1 }} onPress={() => setSwapOpen((o) => ({ ...o, [uid]: !o[uid] }))} testID="swap-btn" />
                  <Btn title="Add Set" icon="add" variant="secondary" style={{ flex: 1 }} onPress={() => st.addSet(i)} testID="add-set" />
                </View>
              </View>
              {swapOpen[uid] && <SwapPanel currentId={e.exerciseId} originalId={e.swappedFrom ?? e.exerciseId} exclude={swapExclude(i)} onPick={(id) => st.swapEntry(i, id)} onInfo={() => setHelp(HELP.swap)} />}
              </>}
            </View>
          );
        })}

        {hiddenList.length > 0 && (
          <Pressable onPress={() => setHiddenSheet(true)} testID="hidden-row" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16 }}>
            <Ionicons name="eye-off-outline" size={20} color={colors.muted} /><Text style={{ flex: 1, color: colors.muted }}>{hiddenList.length} hidden exercise{hiddenList.length > 1 ? 's' : ''} (this workout only)</Text><Text style={{ color: colors.primary }}>Show</Text>
          </Pressable>
        )}
        <View style={{ padding: 16, gap: 10, marginTop: 16 }}>
          <Btn title="Add Exercise" icon="add" onPress={() => pickFor((ids) => st.addEntries(ids))} testID="add-exercise" />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="Settings" variant="secondary" style={{ flex: 1 }} onPress={() => router.push('/settings/workout')} testID="workout-settings-btn" />
            <Btn title="Discard Workout" variant="secondary" style={{ flex: 1 }} textStyle={{ color: colors.danger }} onPress={() => setCancelAsk(true)} testID="discard-btn" />
          </View>
        </View>
      </ScrollView>
      {statsOff && (
        <Pressable onPress={() => setStatsOff(false)} testID="stats-open" hitSlop={8} style={{ position: 'absolute', top: 0, alignSelf: 'center', width: 46, height: 22, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={18} color={colors.text} />
        </Pressable>
      )}
      </View>}

      {rest && !reordering && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, paddingBottom: insets.bottom }}>
          <View style={{ height: 4, backgroundColor: colors.surfaceAlt }}><View style={{ height: 4, backgroundColor: colors.primary, width: `${Math.min(100, (restLeft / rest.total) * 100)}%` }} /></View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 }}>
            <Btn title="-15" variant="secondary" style={{ minWidth: 54, minHeight: 38, paddingHorizontal: 10 }} onPress={() => st.adjustRest(-15)} />
            <Text numberOfLines={1} adjustsFontSizeToFit style={{ flex: 1, fontSize: 32, fontWeight: '400', textAlign: 'center', color: colors.text }} testID="rest-clock">{fmtClock(restLeft)}</Text>
            <Btn title="+15" variant="secondary" style={{ minWidth: 54, minHeight: 38, paddingHorizontal: 10 }} onPress={() => st.adjustRest(15)} />
            <Btn title="Skip" style={{ minWidth: 64, minHeight: 38, paddingHorizontal: 12 }} onPress={st.skipRest} testID="rest-skip" />
          </View>
        </View>
      )}

      {plate !== null && active.entries[plate] && (() => {
        const pe = active.entries[plate];
        const pu = pe.unit ?? u.weight;
        const next = (plateJ != null ? pe.sets[plateJ] : undefined) ?? pe.sets.find((s) => !s.done && s.type !== 'warmup') ?? pe.sets.at(-1);
        const target = Math.round(toDisplayWeight(next?.kg ?? 0, { ...u, weight: pu }) * 100) / 100;
        return <PlateSheet visible onClose={() => { setPlate(null); setPlateJ(null); }} target={target} unit={pu} sets={st.wprefs.plateSets[pu]} onChange={(s) => st.setWprefs({ plateSets: { ...st.wprefs.plateSets, [pu]: s } })} />;
      })()}

      <Sheet visible={!!help} onClose={() => setHelp(null)} title={help?.title}>
        <Text style={{ color: colors.text, fontSize: 17, lineHeight: 24, paddingHorizontal: 16, paddingBottom: 16 }}>{help?.text}</Text>
        <View style={{ paddingHorizontal: 16 }}><Btn title="Got it!" onPress={() => setHelp(null)} testID="help-ok" /></View>
      </Sheet>

      {/* tipo da nota: fixada no exercício, fixada na rotina ou só deste treino; apagar */}
      <Sheet visible={noteSheet !== null} onClose={() => setNoteSheet(null)} title="Notes type">
        {noteSheet !== null && active.entries[noteSheet.i] && (
          <View style={{ paddingHorizontal: 16, gap: 12 }}>
            <View style={{ backgroundColor: colors.bg, borderRadius: radius.md }}>
              {NOTE_KINDS.map((n) => (
                <Pressable key={n.kind} testID={`note-kind-${n.kind}`} onPress={() => { st.setNoteKind(noteSheet.i, noteSheet.id, n.kind); setNoteSheet(null); }} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 }}>
                  <Ionicons name={n.icon} size={22} color={colors.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>{n.label}</Text>
                    <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{n.text}</Text>
                  </View>
                  {notesOf(active.entries[noteSheet.i]).find((x) => x.id === noteSheet.id)?.kind === n.kind && <Ionicons name="checkmark" size={22} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
            <Pressable testID="note-delete" onPress={() => { st.deleteNote(noteSheet.i, noteSheet.id); setNoteSheet(null); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.bg, borderRadius: radius.md }}>
              <Ionicons name="trash-outline" size={22} color={colors.danger} /><Text style={{ color: colors.danger, fontSize: 16 }}>Delete Note</Text>
            </Pressable>
          </View>
        )}
      </Sheet>

      {/* superset: o usuário escolhe com qual exercício juntar */}
      <Sheet visible={ssPick !== null} onClose={() => setSsPick(null)} title="Superset with...">
        <ScrollView style={{ maxHeight: 360 }}>
          {ssPick !== null && active.entries[ssPick] && active.entries.map((x, j) => ({ x, j })).filter(({ x, j }) => j !== ssPick && !x.hidden && (x.superset == null || x.superset !== active.entries[ssPick].superset)).map(({ x, j }) => (
            <ListRow key={uidOf(x, j)} label={exOf(x.exerciseId)?.name ?? 'Exercise'} detail={x.superset != null ? 'In a superset' : undefined} last testID="superset-option"
              onPress={() => {
                const i = ssPick; setSsPick(null);
                const list = active.entries;
                const id = list[i].superset ?? x.superset ?? (Math.max(0, ...list.map((y) => y.superset ?? 0)) + 1);
                const old = x.superset;
                list.forEach((y, k) => { if (k === i || k === j || (old != null && y.superset === old)) st.patchEntry(k, { superset: id }); });
                if (old != null) return; // juntou dois grupos: não mexe na ordem
                const own = list[i].superset;
                const last = Math.max(...list.map((y, k) => (k === i || (own != null && y.superset === own) ? k : -1)));
                if (j !== last + 1) st.moveEntry(j, j > last ? last + 1 : last);
              }} />
          ))}
        </ScrollView>
      </Sheet>

      {/* Weight Input: unidade só deste exercício neste treino */}
      {wsheet !== null && active.entries[wsheet] && (() => {
        const we = active.entries[wsheet];
        const wex = exOf(we.exerciseId);
        const eq = wex?.equipment ?? '';
        const wk = wex?.kind;
        const hint = wk === 'assisted_bodyweight' ? 'Input the assistance weight (for example the machine counterweight). It is subtracted from your body weight.'
          : wk === 'weighted_bodyweight' ? 'Input the extra weight added to your body weight (belt, vest or dumbbell).'
          : /barbell/i.test(eq) ? 'Input the total weight on the bar, including the bar itself.'
          : /dumbbell/i.test(eq) ? 'We recommend inputting the total combined weight lifted in one rep of the exercise. For dumbbell exercises, input the combined weight of both dumbbells.'
          : 'Input the total weight lifted in one rep of the exercise as indicated by the machine setting.';
        return (
          <>
            <Sheet visible={!unitSheet} onClose={() => setWsheet(null)} title="Weight Input">
              <Text style={{ color: colors.text, fontSize: 17, paddingHorizontal: 16, paddingBottom: 12 }}>{hint}</Text>
              <ListRow label="Weight Unit" detail={we.unit ? (we.unit === 'kg' ? 'kg' : 'lbs') : `Default (${u.weight})`} onPress={() => setUnitSheet(true)} testID="weight-unit-row" last={!(/barbell/i.test(eq) && st.wprefs.plateCalc)} />
              {/barbell/i.test(eq) && st.wprefs.plateCalc && <ListRow icon="calculator-outline" label="Plate Calculator" last onPress={() => { const i = wsheet; setWsheet(null); setPlateJ(null); setPlate(i); }} />}
            </Sheet>
            <Sheet visible={unitSheet} onClose={() => setUnitSheet(false)} title="Weight Units" left={<Ionicons name="arrow-back" size={24} color={colors.text} onPress={() => setUnitSheet(false)} />}>
              <Text style={{ color: colors.muted, fontSize: 16, textAlign: 'center', paddingBottom: 10 }}>{wex?.name}</Text>
              {([[undefined, `Default (${u.weight})`], ['kg', 'kg'], ['lbs', 'lbs']] as const).map(([val, label]) => (
                <ListRow key={label} label={label} last right={we.unit === val ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : undefined}
                  onPress={() => { st.patchEntry(wsheet, { unit: val }); setUnitSheet(false); setWsheet(null); }} />
              ))}
            </Sheet>
          </>
        );
      })()}

      {/* set type */}
      <Sheet visible={!!setSheet} onClose={() => setSetSheet(null)} title="Set Type">
        {SET_TYPES.map((t) => (
          <ListRow key={t.type} label={t.label} last={false}
            right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Text style={{ color: t.color, fontWeight: '700', width: 16 }}>{t.badge || '1'}</Text><Ionicons name="help-circle-outline" size={20} color={colors.faint} onPress={() => setHelpType(t.help)} /></View>}
            onPress={() => { st.patchSet(setSheet!.i, setSheet!.j, { type: t.type }); setSetSheet(null); }} />
        ))}
        <ListRow icon="close" label="Remove Set" danger last onPress={() => { st.removeSet(setSheet!.i, setSheet!.j); setSetSheet(null); }} />
      </Sheet>
      <Dialog visible={!!helpType} message={helpType ?? ''} actions={[{ label: 'Ok', primary: true, onPress: () => setHelpType(null) }]} />

      {/* descanso do exercício */}
      {restSheet !== null && <RestSheet subtitle={exOf(active.entries[restSheet]?.exerciseId ?? '')?.name} value={active.entries[restSheet]?.restSec ?? 0} onDone={(sec) => st.patchEntry(restSheet, { restSec: sec })} onClose={() => setRestSheet(null)} onSettings={() => router.push('/settings/timer')} />}

      {/* menu do exercício */}
      <Sheet visible={menu !== null} onClose={() => setMenu(null)}>
        <ListRow icon="swap-horizontal-outline" label="Replace Exercise" onPress={() => { const i = menu!; setMenu(null); pickFor((ids) => ids[0] && st.replaceEntry(i, ids[0]), true); }} />
        {menu !== null && !!active.entries[menu]?.swappedFrom && <ListRow icon="star-outline" label="Make main exercise" subtitle="Replaces the original in this routine for good" testID="make-main" onPress={() => { const i = menu; setMenu(null); makeMain(i); }} />}
        <ListRow icon="link-outline" label={menu !== null && active.entries[menu]?.superset != null ? 'Add to this superset' : 'Add to superset'} testID="superset-add" onPress={() => { setSsPick(menu); setMenu(null); }} />
        {menu !== null && active.entries[menu]?.superset != null && <ListRow icon="unlink-outline" label="Remove from superset" onPress={() => {
          const i = menu; setMenu(null);
          const gid = active.entries[i].superset;
          st.patchEntry(i, { superset: null });
          const rest = active.entries.map((x, k) => ({ x, k })).filter(({ x, k }) => k !== i && x.superset === gid);
          if (rest.length === 1) st.patchEntry(rest[0].k, { superset: null });
        }} />}
        {st.wprefs.warmupCalc && <ListRow icon="flame-outline" label="Add warm-up sets" testID="add-warmup" onPress={() => { const i = menu!; setMenu(null); addWarmups(i); }} />}
        <ListRow icon="information-circle-outline" label="View Exercise" onPress={() => { const i = menu!; setMenu(null); router.push({ pathname: '/exercises/[id]', params: { id: active.entries[i].exerciseId } }); }} />
        <ListRow icon="eye-off-outline" label="Hide only for this workout" testID="hide-exercise"
          after={<Pressable onPress={() => setHelp(HELP.hide)} hitSlop={12} testID="hide-help"><Ionicons name="help-circle-outline" size={20} color={colors.faint} /></Pressable>}
          onPress={() => { const i = menu; setMenu(null); if (i !== null) { st.patchEntry(i, { hidden: true }); st.showToast('Hidden only for this workout. Nothing was deleted.'); } }} />
        <ListRow icon="remove-circle-outline" label="Reduce sets" testID="reduce-sets" onPress={() => { const i = menu!; setMenu(null); const n = active.entries[i].sets.length; if (n > 1) st.removeSet(i, n - 1); else st.showToast('An exercise needs at least one set.'); }} />
        <ListRow icon="swap-vertical" label="Reorder exercises" onPress={() => { setMenu(null); setReordering(true); }} />
        <ListRow icon="trash-outline" label="Remove Exercise" danger last onPress={() => { st.removeEntry(menu!); setMenu(null); }} />
      </Sheet>

      {/* duração: roda de horas/minutos, dia e hora de início, pausar cronômetro */}
      {durSheet && (
        <DurationSheet
          elapsed={elapsed}
          start={new Date(active.dateAt ?? active.startedAt)}
          paused={!!active.pausedAt}
          onClose={() => setDurSheet(false)}
          onElapsed={st.setElapsed}
          onStart={(d) => st.setStartTime(d.toISOString())}
          onTogglePause={() => { st.pauseToggle(); setDurSheet(false); }}
        />
      )}

      {/* timer manual */}
      <ClockSheet visible={timerSheet} onClose={() => setTimerSheet(false)} onSettings={() => router.push('/settings/timer')} rest={rest ? { left: restLeft, total: rest.total } : null} onStart={(sec) => st.startRest(sec)} onAdjust={st.adjustRest} onCancel={st.skipRest} sw={sw} setSw={setSw} defaultSec={st.wprefs.defaultRestSec} />

      <Sheet visible={hiddenSheet} onClose={() => setHiddenSheet(false)} title="Hidden exercises">
        {hiddenList.map(({ e, i }) => (
          <View key={uidOf(e, i)} style={{ paddingHorizontal: 16, paddingVertical: 8 }}><ExerciseLabel exerciseId={e.exerciseId} right={<Text style={{ color: colors.primary, fontSize: 16 }} onPress={() => { st.patchEntry(i, { hidden: false }); if (hiddenList.length <= 1) setHiddenSheet(false); }}>Show</Text>} /></View>
        ))}
      </Sheet>
      <Dialog visible={cancelAsk} title="Cancel workout?" message="All progress in this workout will be lost." onClose={() => setCancelAsk(false)}
        actions={[{ label: 'Keep going' }, { label: 'Discard', danger: true, onPress: () => { setCancelAsk(false); st.discardActive(); router.back(); } }]} />
    </Screen>
  );
}

const inputStyle = (done: boolean) => ({ borderWidth: 1, borderColor: done ? 'transparent' : colors.border, borderRadius: 8, paddingVertical: 6, fontWeight: done ? ('700' as const) : ('400' as const), fontSize: 17 });

/** Explicações que abrem ao tocar no cabeçalho de cada coluna (como no Hevy). O KG abre o Weight Input, que muda por tipo de exercício. */
const HELP = {
  sets: { title: 'Sets', text: 'Sets are used to indicate in which cycle of the exercise you are in. The options are: warm up, normal, failure and drop set.' },
  previous: { title: 'Previous', text: 'In the "Previous" column, you will find your past performance of that exercise on that specific set.' },
  reps: { title: 'Repetitions', text: 'Repetitions indicate how many times you performed that exercise per set. You should only log completed reps.' },
  time: { title: 'Time', text: 'Time is the number of seconds you held or performed that exercise in the set. Only log the time you completed.' },
  hide: { title: 'Hide only for this workout', text: 'Hides this exercise only in the workout you are doing now. Nothing is deleted: it is not counted in the volume and is not saved with this workout. The next time you do this workout or routine, the exercise appears normally. To bring it back now, tap the hidden exercises row at the bottom of the list.' },
  swap: { title: 'Swap', text: 'Is the gym packed, or do you just want to change the stimulus a little? Pick another exercise that trains the same muscle and use it instead, only in this workout. Your routine does not change, and next time the original comes back. To keep the new exercise for good, open the ⋮ menu of the exercise and choose "Make main exercise".' },
  complete: { title: 'Complete', text: 'The checkmark is a feature to help you keep track of which exercises you have completed.' },
};

const NOTE_KINDS = [
  { kind: 'exercise' as const, icon: 'pin-outline' as const, label: 'Pinned Exercise Note', text: 'Appears every time you log this exercise. Hidden from workout posts.' },
  { kind: 'routine' as const, icon: 'reader-outline' as const, label: 'Pinned Routine Note', text: 'Appears every time you log this routine. Hidden from workout posts.' },
  { kind: 'workout' as const, icon: 'document-outline' as const, label: 'Workout Note', text: 'Appears only in this workout. Visible to friends and followers.' },
];

const h = { c: { color: colors.muted, fontSize: 12, textAlign: 'center' as const } };
