import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, Share, View } from 'react-native';
import { Text } from '../../components/Text';
import { NoteInput } from '../../components/NoteInput';
import { ExerciseGif } from '../../components/ExerciseThumb';
import { CAT_BY_ID, catSteps } from '../../lib/catalog';
import { Btn, Card, Dialog, Header, IconButton, LineChart, ListRow, PillRow, Screen, Section, Sheet, TopTabs } from '../../components/ui';
import { fmtSet } from '../../lib/exerciseOptions';
import { fmtDate, fmtWeight, toDisplayWeight } from '../../lib/format';
import { canonId, countsLoad, exerciseSeries, isWeightReps, records } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { ExerciseKind } from '../../lib/types';

const METRICS = [{ id: 'heaviest', label: 'Heaviest weight' }, { id: 'orm', label: 'Estimated 1RM' }, { id: 'setVolume', label: 'Set volume' }, { id: 'sessionVolume', label: 'Session volume' }, { id: 'reps', label: 'Reps' }];
/** Gráficos que fazem sentido para o tipo: 1RM e volume só em peso × reps; maior peso só com carga de verdade (no assistido o peso é ajuda);
 * no `duration` antigo as "reps" são segundos. Distância & tempo ainda não tem gráfico. */
const metricsFor = (kind: ExerciseKind) =>
  isWeightReps(kind) ? METRICS
  : countsLoad(kind) ? METRICS.filter((m) => m.id === 'heaviest')
  : kind === 'duration' ? [{ id: 'reps', label: 'Duration' }]
  : kind === 'reps' || kind === 'assisted_bodyweight' ? METRICS.filter((m) => m.id === 'reps')
  : [];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Elite'];
const HOWTO = ['Set up with a neutral posture and a braced core.', 'Move with control and avoid using momentum.', 'Breathe out on the effort and in on the way back.', 'Pick a weight that lets you finish every rep with good form.'];

export default function ExerciseDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { findExercise, workouts, profile, removeExercise, pinnedNotes, setPinnedNotes } = useStore();
  const [pins, setPins] = useState<string[] | null>(null);
  const [focusPin, setFocusPin] = useState<number | null>(null);
  const [tab, setTab] = useState('summary');
  const [metric, setMetric] = useState('heaviest');
  const [menu, setMenu] = useState(false);
  const [del, setDel] = useState(false);
  const ex = findExercise(id);
  const pinList = pins ?? (ex ? pinnedNotes(ex.id) : []);
  const savePins = (next: string[]) => { setPins(next); if (ex) setPinnedNotes(ex.id, next); };
  if (!ex) return <Screen><Header title="Exercise" /></Screen>;
  const cat = ex.catalogId ? CAT_BY_ID.get(ex.catalogId) : undefined;
  const u = profile.units;
  const rec = records(workouts, ex.id);
  const wr = isWeightReps(ex.kind), load = countsLoad(ex.kind);
  const metrics = metricsFor(ex.kind);
  const m = metrics.some((x) => x.id === metric) ? metric : metrics[0]?.id;
  const series = m ? exerciseSeries(workouts, ex.id, m as never).map((p) => ({ label: fmtDate(p.date, { day: '2-digit', month: '2-digit' }), value: m === 'reps' ? p.value : Math.round(toDisplayWeight(p.value, u) * 10) / 10 })) : [];
  // `cat:<id>` de treinos ainda na fila conta como o mesmo exercício
  const mine = (exerciseId: string) => canonId(exerciseId) === ex.id;
  const sessions = workouts.filter((w) => w.entries.some((e) => mine(e.exerciseId)));
  const missing = [profile.sex, profile.birthYear, profile.weightKg].filter((x) => !x).length;
  const ratio = profile.weightKg ? rec.best1rm / profile.weightKg : 0;
  const lvl = ratio >= 2 ? 3 : ratio >= 1.5 ? 2 : ratio >= 0.75 ? 1 : 0;

  return (
    <Screen>
      <Header title={ex.name} right={<><IconButton name="share-outline" onPress={() => Share.share({ message: `${ex.name} on Reps` })} /><IconButton name="ellipsis-horizontal" onPress={() => setMenu(true)} /></>} />
      <TopTabs value={tab} onChange={setTab} items={[{ id: 'summary', label: 'Summary' }, { id: 'history', label: 'History' }, { id: 'how', label: 'How to' }]} />
      <ScrollView>
        {tab === 'summary' && (
          <View>
            <ExerciseGif catalogId={ex.catalogId} />
            {!!m && <View style={{ padding: 16 }}>{series.length ? <LineChart data={series} unit={m !== 'reps' ? ` ${u.weight}` : ex.kind === 'duration' ? ' s' : ''} /> : <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>No data yet</Text>}</View>}
            {!!m && <PillRow items={metrics} value={m} onChange={setMetric} />}
            <Section title="Personal records" />
            {load && <ListRow label="Heaviest weight" detail={rec.heaviest ? fmtWeight(rec.heaviest, u) : '-'} last />}
            {wr && <ListRow label="Best 1RM" detail={rec.best1rm ? fmtWeight(rec.best1rm, u) : '-'} last />}
            <ListRow label={wr ? 'Best set volume' : 'Best set'} detail={rec.bestSet ? fmtSet(rec.bestSet, ex.kind, u) : '-'} last />
            {wr && <ListRow label="Best session volume" detail={rec.bestSession ? fmtWeight(rec.bestSession, u) : '-'} last />}
            {/* nível de força = 1RM ÷ peso do corpo: só em peso × reps (com peso extra no corpo ou ajuda a conta não vale) */}
            {ex.kind === 'weight_reps' && <Section title="Strength level" />}
            {ex.kind === 'weight_reps' && (missing > 0 || !rec.best1rm ? (
              <View style={{ padding: 16 }}>
                <Card onPress={() => router.push('/profile/edit')} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: colors.surface, borderWidth: 0 }}>
                  <Text style={{ borderWidth: 3, borderColor: colors.border, borderRadius: 24, width: 48, height: 48, textAlign: 'center', textAlignVertical: 'center', lineHeight: 42, color: colors.muted }}>{3 - missing}/3</Text>
                  <Text style={{ flex: 1, color: colors.text }}>{missing > 0 ? 'Add your sex, age and weight to see your strength level.' : 'Log a weighted set to see your strength level.'}</Text>
                </Card>
              </View>
            ) : (
              <View style={{ padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: colors.muted }}>Best 1RM{'\n'}<Text style={{ color: colors.text, fontSize: 16 }}>{fmtWeight(rec.best1rm, u)}</Text></Text><Text style={{ color: colors.muted, textAlign: 'right' }}>Level{'\n'}<Text style={{ color: colors.text, fontSize: 16 }}>{LEVELS[lvl]}</Text></Text></View>
                <View style={{ flexDirection: 'row', gap: 3 }}>{LEVELS.map((l, k) => <View key={l} style={{ flex: 1, height: 6, backgroundColor: k <= lvl ? colors.primary : colors.surfaceAlt }} />)}</View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{LEVELS.map((l) => <Text key={l} style={{ color: colors.muted, fontSize: 11 }}>{l}</Text>)}</View>
              </View>
            ))}
          </View>
        )}
        {tab === 'history' && (
          <View>
            {sessions.length === 0 && <Text style={{ color: colors.muted, textAlign: 'center', padding: 30 }}>You haven&apos;t done this exercise yet.</Text>}
            {sessions.map((w) => (
              <View key={w.id} style={{ padding: 16, gap: 4, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} style={{ color: colors.primary, fontWeight: '600' }}>{w.title} · {fmtDate(w.date)}</Text>
                {w.entries.filter((e) => mine(e.exerciseId)).flatMap((e) => e.sets).map((s, i) => <Text key={i} style={{ color: colors.text }}>{i + 1}. {fmtSet(s, ex.kind, u)}</Text>)}
              </View>
            ))}
          </View>
        )}
        {tab === 'how' && (
          <View style={{ padding: 16, gap: 10 }}>
            <ExerciseGif catalogId={ex.catalogId} />
            <Text style={{ color: colors.muted }}>{ex.muscle} · {ex.equipment}</Text>
            {cat && <Text style={{ color: colors.text }}>Target: <Text style={{ fontWeight: '600' }}>{cat.t}</Text>{cat.s.length ? `\nSecondary: ${cat.s.join(', ')}` : ''}</Text>}
            {(cat ? catSteps(cat) : HOWTO).map((t, i) => <Text key={i} style={{ color: colors.text, fontSize: 16 }}>{i + 1}. {t}</Text>)}
          </View>
        )}
        {tab === 'how' && (
          <View style={{ backgroundColor: colors.surface }}>
            <View style={{ height: 14 }} />
            <View style={{ backgroundColor: colors.bg }}>
              <Section title="Pinned exercise notes" right={<Text style={{ color: colors.primary, fontSize: 16 }} onPress={() => { setFocusPin(pinList.length); setPins([...pinList, '']); }} testID="add-pinned-note">Add Note</Text>} />
              <View style={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}>
                {pinList.length === 0 && <Text style={{ color: colors.faint }}>Notes you pin to this exercise show up every time you log it.</Text>}
                {pinList.map((txt, k) => (
                  <View key={k} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                    <View style={{ height: 24, justifyContent: 'center' }}><Ionicons name="pin-outline" size={22} color={colors.text} /></View>
                    <NoteInput value={txt} placeholder="Add a pinned note" autoFocus={focusPin === k}
                      onChangeText={(v) => savePins(pinList.map((x, n) => (n === k ? v : x)))}
                      onBlur={() => { if (!txt.trim()) savePins(pinList.filter((_, n) => n !== k)); }} />
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
        {tab === 'rank' && (
          <View style={{ padding: 24, gap: 12, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, textAlign: 'center' }}>The leaderboard compares you with people you follow. Follow friends to see rankings for this exercise.</Text>
            <Btn title="Discover athletes" variant="secondary" onPress={() => router.push('/feed/discover')} />
          </View>
        )}
      </ScrollView>
      <Sheet visible={menu} onClose={() => setMenu(false)}>
        {ex.catalogId ? <ListRow icon="information-circle-outline" label="Catalog exercise (can't be deleted)" last /> : <><ListRow icon="create-outline" label="Edit exercise" testID="edit-exercise" onPress={() => { setMenu(false); router.push({ pathname: '/exercises/create', params: { id: ex.id } }); }} /><ListRow icon="trash-outline" label="Delete exercise" danger last onPress={() => { setMenu(false); setDel(true); }} /></>}
      </Sheet>
      <Dialog visible={del} title="Delete exercise?" message="It will also be removed from workouts and routines where it appears." onClose={() => setDel(false)}
        actions={[{ label: 'Cancel' }, { label: 'Delete', danger: true, onPress: async () => { setDel(false); await removeExercise(ex.id); router.back(); } }]} />
    </Screen>
  );
}
