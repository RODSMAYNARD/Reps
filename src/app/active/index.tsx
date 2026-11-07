import { ExerciseLabel } from '../../components/ExerciseLabel';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReorderList } from '../../components/ReorderList';
import { DurationSheet } from '../../components/DurationSheet';
import { RestSheet } from '../../components/pickers';
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
  const [cancelAsk, setCancelAsk] = useState(false);
  const [helpType, setHelpType] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [hiddenSheet, setHiddenSheet] = useState(false);
  const [plate, setPlate] = useState<number | null>(null);
  const [wsheet, setWsheet] = useState<number | null>(null);
  const [unitSheet, setUnitSheet] = useState(false);
  const [help, setHelp] = useState<{ title: string; text: string } | null>(null);
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
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
      <Header left="down" titleAlign="left" title="Log Workout" right={<>
        <IconButton name="timer-outline" onPress={() => setTimerSheet(true)} testID="open-timer" />
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
      {!reordering && <ScrollView contentContainerStyle={{ paddingBottom: rest ? 100 : 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={() => setDurSheet(true)} testID="duration" style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Duration</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{fmtDurationLive(elapsed)}</Text></Pressable>
          <View style={{ flex: 1 }}><Stat label="Volume" value={fmtVolume(volume, u)} /></View>
          <View style={{ flex: 1 }}><Stat label="Sets" value={String(doneSets.length)} /></View>
        </View>

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
                <Pressable onPress={() => setNoteOpen((n) => ({ ...n, [uid]: !n[uid] }))} testID="note-chip" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: e.notes ? colors.primarySoft : colors.surface, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 9 }}>
                  <Ionicons name="document-text-outline" size={18} color={e.notes ? colors.primary : colors.text} /><Text style={{ color: e.notes ? colors.primary : colors.text, fontSize: 15 }}>Note</Text>
                </Pressable>
              </View>
              {(noteOpen[uid] || !!e.notes) && <TextInput value={e.notes} onChangeText={(t) => st.patchEntry(i, { notes: t })} placeholder="Add notes here..." placeholderTextColor={colors.faint} multiline style={{ marginHorizontal: 16, marginBottom: 6, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, color: colors.text, fontSize: 16 }} testID="note-input" />}
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
                  <View key={j} testID="set-row" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: s.done ? colors.successSoft : colors.bg }}>
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
                        <NumInput decimal style={inputStyle(s.done)} testID="kg" value={s.kg == null ? null : Math.round(toDisplayWeight(s.kg, eu) * 10) / 10} onChange={(v) => st.patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, eu), typed: true })} />
                      </View>
                    )}
                    <View style={{ flex: 1, paddingHorizontal: 6 }}><NumInput style={inputStyle(s.done)} testID="reps" value={s.reps} onChange={(v) => st.patchSet(i, j, { reps: v, typed: true })} /></View>
                    <Pressable onPress={() => st.toggleSet(i, j)} testID="check" style={{ width: 38, alignItems: 'center' }}>
                      <View style={{ width: 35, height: 35, borderRadius: 8, backgroundColor: s.done ? colors.success : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={18} color={s.done ? '#fff' : colors.faint} />
                      </View>
                    </Pressable>
                  </View>
                );
              })}
              <View style={{ paddingHorizontal: 16, paddingTop: 10 }}><Btn title="Add Set" icon="add" variant="secondary" onPress={() => st.addSet(i)} testID="add-set" /></View>
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
      </ScrollView>}

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
        const next = pe.sets.find((s) => !s.done && s.type !== 'warmup') ?? pe.sets.at(-1);
        const target = Math.round(toDisplayWeight(next?.kg ?? 0, { ...u, weight: pu }) * 100) / 100;
        return <PlateSheet visible onClose={() => setPlate(null)} target={target} unit={pu} sets={st.wprefs.plateSets[pu]} onChange={(s) => st.setWprefs({ plateSets: { ...st.wprefs.plateSets, [pu]: s } })} />;
      })()}

      <Sheet visible={!!help} onClose={() => setHelp(null)} title={help?.title}>
        <Text style={{ color: colors.text, fontSize: 17, lineHeight: 24, paddingHorizontal: 16, paddingBottom: 16 }}>{help?.text}</Text>
        <View style={{ paddingHorizontal: 16 }}><Btn title="Got it!" onPress={() => setHelp(null)} testID="help-ok" /></View>
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
              {/barbell/i.test(eq) && st.wprefs.plateCalc && <ListRow icon="calculator-outline" label="Plate Calculator" last onPress={() => { const i = wsheet; setWsheet(null); setPlate(i); }} />}
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
      {restSheet !== null && <RestSheet value={active.entries[restSheet]?.restSec ?? 0} onDone={(sec) => st.patchEntry(restSheet, { restSec: sec })} onClose={() => setRestSheet(null)} />}

      {/* menu do exercício */}
      <Sheet visible={menu !== null} onClose={() => setMenu(null)}>
        <ListRow icon="swap-horizontal-outline" label="Replace Exercise" onPress={() => { const i = menu!; setMenu(null); pickFor((ids) => ids[0] && st.replaceEntry(i, ids[0]), true); }} />
        <ListRow icon="link-outline" label={menu !== null && active.entries[menu]?.superset != null ? 'Remove from superset' : 'Superset with next'} onPress={() => {
          const i = menu!; setMenu(null);
          const cur = active.entries[i];
          if (cur.superset != null) return st.patchEntry(i, { superset: null });
          const id = (Math.max(0, ...active.entries.map((x) => x.superset ?? 0)) + 1);
          st.patchEntry(i, { superset: id }); if (active.entries[i + 1]) st.patchEntry(i + 1, { superset: id });
        }} />
        {st.wprefs.warmupCalc && <ListRow icon="flame-outline" label="Add warm-up sets" testID="add-warmup" onPress={() => { const i = menu!; setMenu(null); addWarmups(i); }} />}
        <ListRow icon="information-circle-outline" label="View Exercise" onPress={() => { const i = menu!; setMenu(null); router.push({ pathname: '/exercises/[id]', params: { id: active.entries[i].exerciseId } }); }} />
        <ListRow icon="eye-off-outline" label="Hide for this workout" testID="hide-exercise" onPress={() => { st.patchEntry(menu!, { hidden: true }); setMenu(null); st.showToast('Hidden for this workout. Nothing was deleted.'); }} />
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
      {timerSheet && <RestSheet value={st.wprefs.defaultRestSec || 90} confirm="Start" onDone={(sec) => sec && st.startRest(sec)} onClose={() => setTimerSheet(false)} />}

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
  complete: { title: 'Complete', text: 'The checkmark is a feature to help you keep track of which exercises you have completed.' },
};

const h = { c: { color: colors.muted, fontSize: 12, textAlign: 'center' as const } };
