import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReorderList } from '../../components/ReorderList';
import { NumberSheet, range } from '../../components/pickers';
import { Btn, Dialog, Empty, Header, HeaderAction, IconButton, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { SET_TYPES } from '../../lib/constants';
import { fmtClock, fmtDuration, fmtRest, fmtVolume, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { setPickHandler } from '../../lib/picker';
import { records, setVolume } from '../../lib/stats';
import { elapsedSec, useNow, useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { ActiveEntry, ActiveSet, Exercise, Units } from '../../lib/types';

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

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
  const [incomplete, setIncomplete] = useState(false);
  const [helpType, setHelpType] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [reordering, setReordering] = useState(false);
  const [hiddenSheet, setHiddenSheet] = useState(false);
  const [plate, setPlate] = useState<number | null>(null);
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
  const pending = shown.reduce((t, x) => t + x.e.sets.filter((s) => !s.done).length, 0);

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
  const finish = () => (doneSets.length === 0 ? st.showToast('Complete at least one set.') : pending > 0 ? setIncomplete(true) : goSave());
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
          <Pressable onPress={() => setDurSheet(true)} testID="duration" style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Duration</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{fmtDuration(elapsed)}</Text></Pressable>
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
          const heaviest = records(st.workouts, st.realExerciseId(e.exerciseId)).heaviest;
          const isBarbell = /barbell/i.test(ex?.equipment ?? '');
          const toggle = () => setCollapsed((c) => ({ ...c, [uid]: !c[uid] }));
          return (
            <View key={uid} style={{ paddingTop: 16 }} testID="entry">
              <Pressable onPress={isCollapsed ? toggle : undefined} onLongPress={() => setReordering(true)} delayLongPress={450} testID="entry-header" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
                <ExerciseThumb catalogId={ex?.catalogId} size={isCollapsed ? 36 : 44} />
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
                <Text style={[h.c, { width: 38 }]}>SET</Text>
                <Text style={[h.c, { flex: 1.3 }]}>PREVIOUS</Text>
                {kind === 'weight_reps' && (isBarbell && st.wprefs.plateCalc
                  ? <Pressable onPress={() => setPlate(i)} style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 }} testID="plate-calc" hitSlop={8}><Ionicons name="calculator-outline" size={14} color={colors.primary} /><Text style={h.c}>{u.weight.toUpperCase()}</Text></Pressable>
                  : <Text style={[h.c, { flex: 1 }]}>{u.weight.toUpperCase()}</Text>)}
                <Text style={[h.c, { flex: 1 }]}>{kind === 'duration' ? 'SEC' : 'REPS'}</Text>
                <Text style={[h.c, { width: 38 }]}>✓</Text>
              </View>
              {e.sets.map((s, j) => {
                const lb = label(e, s, j);
                const prev = prevSets[j] ?? null;
                return (
                  <View key={j} testID="set-row" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: s.done ? colors.successSoft : colors.bg }}>
                    <Pressable onPress={() => setSetSheet({ i, j })} style={{ width: 38, alignItems: 'center', paddingVertical: 6 }} testID="set-type">
                      <View style={{ width: 35, height: 35, borderRadius: 8, backgroundColor: s.done ? colors.bg : colors.surface, alignItems: 'center', justifyContent: 'center' }}>
                        {isPR(s, heaviest) ? <Ionicons name="ribbon" size={20} color="#F5C400" /> : <Text style={{ color: lb.color, fontWeight: '700', fontSize: 16 }}>{lb.text}</Text>}
                      </View>
                    </Pressable>
                    <Pressable
                      style={{ flex: 1.3, alignItems: 'center' }}
                      onPress={() => prev && st.patchSet(i, j, { kg: prev.kg, reps: prev.reps })}>
                      <Text style={{ color: colors.faint, fontSize: 14 }}>{prev ? (kind === 'weight_reps' ? `${Math.round(toDisplayWeight(prev.kg ?? 0, u) * 10) / 10}${u.weight} × ${prev.reps}` : String(prev.reps)) : '-'}</Text>
                    </Pressable>
                    {kind === 'weight_reps' && (
                      <View style={{ flex: 1, paddingHorizontal: 6 }}>
                        <NumInput decimal style={inputStyle(s.done)} testID="kg" value={s.kg == null ? null : Math.round(toDisplayWeight(s.kg, u) * 10) / 10} onChange={(v) => st.patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, u) })} />
                      </View>
                    )}
                    <View style={{ flex: 1, paddingHorizontal: 6 }}><NumInput style={inputStyle(s.done)} testID="reps" value={s.reps} onChange={(v) => st.patchSet(i, j, { reps: v })} /></View>
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

      <PlateSheet key={plate ?? 'x'} visible={plate !== null} onClose={() => setPlate(null)} kg={plate !== null ? active.entries[plate]?.sets.at(-1)?.kg ?? 0 : 0} u={u} />

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
      <Sheet visible={restSheet !== null} onClose={() => setRestSheet(null)} title="Rest Timer">
        <ScrollView style={{ maxHeight: 320 }}>
          {REST_OPTIONS.map((sec) => (
            <ListRow key={sec} label={sec ? fmtRest(sec) : 'Off'} last right={restSheet !== null && active.entries[restSheet]?.restSec === sec ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : undefined}
              onPress={() => { st.patchEntry(restSheet!, { restSec: sec }); setRestSheet(null); }} />
          ))}
        </ScrollView>
      </Sheet>

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

      {/* duração */}
      {durSheet && (
        <Sheet visible onClose={() => setDurSheet(false)} title="Duration">
          <ListRow label="Duration" detail={fmtDuration(elapsed)} last />
          <NumberSheetInline minutes={Math.floor(elapsed / 60)} onChange={(m) => st.setElapsed(m * 60)} />
          <ListRow label="Start" detail={new Date(active.startedAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} last />
          <Btn title={active.pausedAt ? 'Resume timer' : 'Pause workout timer'} icon={active.pausedAt ? 'play' : 'pause'} onPress={() => { st.pauseToggle(); setDurSheet(false); }} style={{ marginTop: 12 }} />
        </Sheet>
      )}

      {/* timer manual */}
      <Sheet visible={timerSheet} onClose={() => setTimerSheet(false)} title="Rest Timer">
        {[30, 60, 90, 120, 180, 300].map((s) => <ListRow key={s} icon="timer-outline" label={fmtRest(s)} last onPress={() => { st.startRest(s); setTimerSheet(false); }} />)}
      </Sheet>

      <Sheet visible={hiddenSheet} onClose={() => setHiddenSheet(false)} title="Hidden exercises">
        {hiddenList.map(({ e, i }) => (
          <ListRow key={uidOf(e, i)} label={exOf(e.exerciseId)?.name ?? 'Removed exercise'} detail="Show" last onPress={() => { st.patchEntry(i, { hidden: false }); if (hiddenList.length <= 1) setHiddenSheet(false); }} />
        ))}
      </Sheet>
      <Dialog visible={cancelAsk} title="Cancel workout?" message="All progress in this workout will be lost." onClose={() => setCancelAsk(false)}
        actions={[{ label: 'Keep going' }, { label: 'Discard', danger: true, onPress: () => { setCancelAsk(false); st.discardActive(); router.back(); } }]} />
      <Dialog visible={incomplete} title="Incomplete sets" message={`${pending} set(s) without ✓ won't be saved. Finish anyway?`} onClose={() => setIncomplete(false)}
        actions={[{ label: 'Back' }, { label: 'Finish', primary: true, onPress: () => { setIncomplete(false); goSave(); } }]} />
    </Screen>
  );
}

function NumberSheetInline({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const vals = range(0, 360);
  return (
    <View style={{ maxHeight: 200 }}>
      <ScrollView>
        {vals.slice(Math.max(0, minutes - 3), minutes + 8).map((m) => (
          <Pressable key={m} onPress={() => onChange(m)} style={{ alignItems: 'center', paddingVertical: 8, backgroundColor: m === minutes ? colors.surface : 'transparent', borderRadius: radius.sm }}>
            <Text style={{ fontSize: 20, color: m === minutes ? colors.text : colors.faint }}>{m} min</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
void NumberSheet;

const isPR = (s: ActiveSet, heaviest: number) => s.done && s.type === 'normal' && heaviest > 0 && (s.kg ?? 0) > heaviest;
const inputStyle = (done: boolean) => ({ borderWidth: 1, borderColor: done ? 'transparent' : colors.border, borderRadius: 8, paddingVertical: 6, fontWeight: done ? ('700' as const) : ('400' as const), fontSize: 17 });

const h = { c: { color: colors.muted, fontSize: 12, textAlign: 'center' as const } };

const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];
const PLATES_LB = [45, 35, 25, 10, 5, 2.5];
function PlateSheet({ visible, onClose, kg, u }: { visible: boolean; onClose: () => void; kg: number; u: Units }) {
  const [txt, setTxt] = useState<number | null>(null);
  const shown = txt ?? Math.round(toDisplayWeight(kg, u) * 10) / 10;
  const bar = u.weight === 'kg' ? 20 : 45;
  const plates = u.weight === 'kg' ? PLATES_KG : PLATES_LB;
  let side = Math.max(0, (shown - bar) / 2);
  const used: number[] = [];
  for (const p of plates) while (side + 1e-9 >= p) { used.push(p); side -= p; }
  return (
    <Sheet visible={visible} onClose={onClose} title="Plate Calculator">
      <View style={{ gap: 12, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.muted }}>Target weight ({u.weight})</Text>
          <View style={{ width: 110, backgroundColor: colors.surface, borderRadius: radius.sm }}><NumInput decimal value={shown} onChange={(v) => setTxt(v)} /></View>
        </View>
        <Text style={{ color: colors.muted }}>Bar: {bar} {u.weight}</Text>
        {shown < bar ? <Text style={{ color: colors.danger }}>The target is lighter than the bar.</Text> : (
          <View style={{ gap: 6 }}>
            <Text style={{ color: colors.text, fontWeight: '700' }}>Each side</Text>
            <Text style={{ color: colors.text, fontSize: 20 }}>{used.length ? used.join(' + ') : 'Just the bar'}</Text>
            {side > 0.01 && <Text style={{ color: colors.warn }}>{Math.round(side * 100) / 100} {u.weight} per side can&apos;t be made with standard plates.</Text>}
          </View>
        )}
      </View>
    </Sheet>
  );
}
