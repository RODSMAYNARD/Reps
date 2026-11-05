import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { NumInput } from '../../components/NumInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReorderList } from '../../components/ReorderList';
import { NumberSheet, range } from '../../components/pickers';
import { Btn, Dialog, Empty, Header, HeaderAction, IconButton, ListRow, Screen, Sheet, Stat } from '../../components/ui';
import { SET_TYPES } from '../../lib/constants';
import { fmtClock, fmtDuration, fmtRest, fmtVolume, fromDisplayWeight, toDisplayWeight } from '../../lib/format';
import { setPickHandler } from '../../lib/picker';
import { setVolume } from '../../lib/stats';
import { elapsedSec, useNow, useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { ActiveEntry, ActiveSet, Exercise, Workout } from '../../lib/types';

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300];

function previousOf(workouts: Workout[], exerciseId: string, j: number) {
  const w = workouts.find((x) => x.entries.some((e) => e.exerciseId === exerciseId));
  const s = w?.entries.find((e) => e.exerciseId === exerciseId)?.sets[j];
  return s ?? null;
}

export default function ActiveWorkoutScreen() {
  const st = useStore();
  const { active, exercises, workouts, profile, rest } = st;
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
  const u = profile.units;
  const insets = useSafeAreaInsets();

  if (!active)
    return (
      <Screen><Header left="down" title="Log Workout" /><Empty text="No workout in progress." action={<Btn title="Back" onPress={() => router.back()} />} /></Screen>
    );

  const exOf = (id: string): Exercise | undefined => exercises.find((e) => e.id === id);
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
      <Header left="down" title="Log Workout" right={<>
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
      {!reordering && <ScrollView contentContainerStyle={{ paddingBottom: rest ? 180 : 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Pressable onPress={() => setDurSheet(true)} testID="duration"><Text style={{ color: colors.muted, fontSize: 13 }}>Duration</Text><Text style={{ color: colors.primary, fontSize: 16 }}>{fmtDuration(elapsed)}</Text></Pressable>
          <Stat label="Volume" value={fmtVolume(volume, u)} />
          <Stat label="Sets" value={String(doneSets.length)} />
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
              <TextInput value={e.notes} onChangeText={(t) => st.patchEntry(i, { notes: t })} placeholder="Add notes here..." placeholderTextColor={colors.faint} style={{ paddingHorizontal: 16, paddingVertical: 10, color: colors.text }} />
              <Pressable onPress={() => setRestSheet(i)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingBottom: 10 }}>
                <Ionicons name="timer-outline" size={18} color={colors.primary} /><Text style={{ color: colors.primary }}>Rest Timer: {fmtRest(e.restSec)}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6 }}>
                <Text style={[h.c, { width: 44 }]}>SET</Text>
                <Text style={[h.c, { flex: 1.3 }]}>PREVIOUS</Text>
                {kind === 'weight_reps' && <Text style={[h.c, { flex: 1 }]}>{u.weight.toUpperCase()}</Text>}
                <Text style={[h.c, { flex: 1 }]}>{kind === 'duration' ? 'SEC' : 'REPS'}</Text>
                <Text style={[h.c, { width: 44 }]}>✓</Text>
              </View>
              {e.sets.map((s, j) => {
                const lb = label(e, s, j);
                const prev = previousOf(workouts, e.exerciseId, j);
                return (
                  <View key={j} testID="set-row" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: s.done ? colors.successSoft : j % 2 === 1 ? colors.surface : colors.bg }}>
                    <Pressable onPress={() => setSetSheet({ i, j })} style={{ width: 44, alignItems: 'center', paddingVertical: 10 }} testID="set-type"><Text style={{ color: lb.color, fontWeight: '700', fontSize: 16 }}>{lb.text}</Text></Pressable>
                    <Pressable
                      style={{ flex: 1.3, alignItems: 'center' }}
                      onPress={() => prev && st.patchSet(i, j, { kg: prev.kg, reps: prev.reps })}>
                      <Text style={{ color: colors.faint, fontSize: 14 }}>{prev ? (kind === 'weight_reps' ? `${Math.round(toDisplayWeight(prev.kg ?? 0, u) * 10) / 10}${u.weight} × ${prev.reps}` : String(prev.reps)) : '-'}</Text>
                    </Pressable>
                    {kind === 'weight_reps' && (
                      <View style={{ flex: 1 }}>
                        <NumInput decimal testID="kg" value={s.kg == null ? null : Math.round(toDisplayWeight(s.kg, u) * 10) / 10} onChange={(v) => st.patchSet(i, j, { kg: v == null ? null : fromDisplayWeight(v, u) })} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}><NumInput testID="reps" value={s.reps} onChange={(v) => st.patchSet(i, j, { reps: v })} /></View>
                    <Pressable onPress={() => st.toggleSet(i, j)} testID="check" style={{ width: 44, alignItems: 'center' }}>
                      <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: s.done ? colors.success : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="checkmark" size={20} color={s.done ? '#fff' : colors.faint} />
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
          <Btn title="Cancel Workout" variant="ghost" onPress={() => setCancelAsk(true)} style={{ borderWidth: 0 }} />
        </View>
      </ScrollView>}

      {rest && !reordering && (
        <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border, padding: 16, paddingBottom: 16 + insets.bottom, gap: 10 }}>
          <View style={{ height: 4, backgroundColor: colors.surfaceAlt, borderRadius: 2 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: colors.primary, width: `${Math.min(100, (restLeft / rest.total) * 100)}%` }} /></View>
          <Text style={{ fontSize: 44, fontWeight: '300', textAlign: 'center', color: colors.text }} testID="rest-clock">{fmtClock(restLeft)}</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="-15" variant="secondary" style={{ flex: 1 }} onPress={() => st.adjustRest(-15)} />
            <Btn title="+15" variant="secondary" style={{ flex: 1 }} onPress={() => st.adjustRest(15)} />
            <Btn title="Skip" style={{ flex: 1 }} onPress={st.skipRest} testID="rest-skip" />
          </View>
        </View>
      )}

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

const h = { c: { color: colors.muted, fontSize: 12, textAlign: 'center' as const } };
