import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { GymIcon } from '../../components/GymIcon';
import { Text } from '../../components/Text';
import { Dialog, Screen } from '../../components/ui';
import { CAT_BY_EN, catKey } from '../../lib/catalog';
import { PROGRAMS, type Template } from '../../lib/constants';
import { fmtDate, fmtDuration, fmtVolume, fmtWeight } from '../../lib/format';
import type { GymIcon as GymIconName } from '../../lib/gymIcons';
import { tr } from '../../lib/i18n';
import { weeklySeries, workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import type { Routine, RoutineExercise, Workout } from '../../lib/types';

/** Home alternativa (H2) para o Rodrigo comparar com a Início atual: tudo com os dados reais do app. */

const HERO = require('../../../assets/images/h2-hero.jpg');
const HERO_BG = '#E5E8ED'; // mesma cor do fundo da foto (o card fica claro nos dois temas, como na referência)
const PAD = 20;
const GAP = 10;

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Dias seguidos com treino, contando de hoje (ou de ontem, se hoje ainda não treinou). */
function dayStreak(workouts: Workout[]) {
  const days = new Set(workouts.map((w) => dayKey(new Date(w.date))));
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

const weekStart = () => { const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }; // semana começa na segunda

/** Minutos estimados: ~2,5 min por série (execução + descanso). */
const estMin = (sets: number) => Math.max(10, Math.round((sets * 2.5) / 5) * 5);

const fromTemplate = (t: Template): Routine => ({
  id: '', title: t.title, notes: t.notes,
  exercises: t.exercises.flatMap((n) => CAT_BY_EN.get(n) ?? []).map((c): RoutineExercise => ({
    exerciseId: catKey(c), notes: '', restSec: c.k === 'duration' ? 0 : 90,
    sets: [1, 2, 3].map(() => ({ type: 'normal' as const, kg: null, reps: c.k === 'duration' ? 30 : 10 })),
  })),
});

type Tile = { key: string; title: string; sub: string; icon: { gym?: GymIconName; ion?: keyof typeof Ionicons.glyphMap }; tint: string; onPress: () => void };

export default function H2() {
  const { profile, workouts, routines, trainer, active, wprefs, measurements, startWorkout, startTrainerWorkout, discardActive } = useStore();
  const { width } = useWindowDimensions();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const units = profile.units;

  // treino de hoje: em andamento > próximo do Trainer > primeira rotina > modelo Full Body
  const today = useMemo(() => {
    if (active) return { label: 'Workout in progress', title: active.title || tr('Workout'), sub: `${active.entries.length} ${tr('exercises')}`, cta: 'Resume', run: () => router.push('/active'), live: true };
    const tw = trainer && (trainer.workouts.find((w) => w.uid === trainer.nextUid) ?? trainer.workouts[0]);
    if (tw) return { label: "Today's Workout", title: tw.title, sub: `${tw.exercises.length} ${tr('exercises')} · ~${trainer!.settings.duration} min`, cta: 'Start Workout', run: () => { startTrainerWorkout(tw.uid); router.push('/active'); } };
    const r = routines[0];
    if (r) return { label: "Today's Workout", title: r.title, sub: `${r.exercises.length} ${tr('exercises')} · ~${estMin(r.exercises.reduce((a, e) => a + e.sets.length, 0))} min`, cta: 'Start Workout', run: () => { startWorkout({ routine: r }); router.push('/active'); } };
    const t = fromTemplate(PROGRAMS.find((p) => p.id === 'fullbody')!.routines[0]);
    return { label: "Today's Workout", title: 'Full Body', sub: `${t.exercises.length} ${tr('exercises')} · ~${estMin(t.exercises.length * 3)} min`, cta: 'Start Workout', run: () => { startWorkout({ routine: { ...t, title: 'Full Body' } }); router.push('/active'); } };
  }, [active, trainer, routines, startWorkout, startTrainerWorkout]);

  /** Começar outro treino com um já em andamento pergunta antes (igual à aba Workout). */
  const guard = (run: () => void) => (active ? setPending(() => run) : run());

  const streak = dayStreak(workouts);
  const ws = weekStart();
  const weekList = workouts.filter((w) => new Date(w.date) >= ws);
  const goal = wprefs.weeklyGoal > 0 ? wprefs.weeklyGoal : trainer?.settings.frequency ?? 0;
  const vol = useMemo(() => weeklySeries(workouts, 'volume', 8), [workouts]);
  const maxVol = Math.max(1, ...vol.map((v) => v.value));
  const weekTime = weekList.reduce((a, w) => a + w.durationSec, 0);
  const weekSets = weekList.reduce((a, w) => a + workoutSets(w), 0);
  const bodyKg = measurements.find((m) => m.values.weight)?.values.weight ?? profile.weightKg;
  const last = workouts[0];

  const preview = (id: string, idx: number) => router.push({ pathname: '/routines/preview', params: { src: 'program', id, idx: String(idx) } });
  const ul = PROGRAMS.find((p) => p.id === 'upperlower')!.routines;

  // 1ª linha: plano, superiores, inferiores · 2ª linha: push, pull, legs
  const tiles: Tile[] = [
    { key: 'plan', title: trainer ? 'My Plan' : '30 Days Plan', sub: trainer ? 'Your Trainer program' : 'Build a habit', icon: { ion: 'calendar' }, tint: '#22B573', onPress: () => router.navigate('/plano') },
    { key: 'upper', title: 'Upper Body', sub: `~${estMin(ul[0].exercises.length * 3)} min`, icon: { gym: 'dumbbell' }, tint: '#8E5CF6', onPress: () => preview('upperlower', 0) },
    { key: 'lower', title: 'Lower Body', sub: `~${estMin(ul[1].exercises.length * 3)} min`, icon: { gym: 'legpress' }, tint: '#1E9BD7', onPress: () => preview('upperlower', 1) },
    { key: 'push', title: 'Push', sub: 'Chest, Shoulders, Triceps', icon: { gym: 'barbell' }, tint: '#F2405D', onPress: () => preview('ppl', 0) },
    { key: 'pull', title: 'Pull', sub: 'Back, Biceps', icon: { gym: 'pullup' }, tint: '#2F6BFF', onPress: () => preview('ppl', 1) },
    { key: 'legs', title: 'Legs', sub: 'Quads, Hamstrings', icon: { gym: 'bodyweight' }, tint: '#F28A1E', onPress: () => preview('ppl', 2) },
  ];
  const tileW = Math.floor((width - PAD * 2 - GAP * 2) / 3);

  const name = profile.displayName?.trim() || profile.username || '';
  const initial = (name[0] ?? '?').toUpperCase();

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: PAD, paddingBottom: 36, gap: 18 }} testID="h2">
        {/* Saudação */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, color: colors.muted }} numberOfLines={1}>{name ? `${tr('Hello')}, ${name}` : 'Hello'}</Text>
            <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>Ready to train?</Text>
          </View>
          <Pressable onPress={() => router.push('/settings/reminders')} testID="h2-bell" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="notifications-outline" size={21} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => router.navigate('/perfil')} testID="h2-avatar" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>{initial}</Text>
          </Pressable>
        </View>
        <Text style={{ fontSize: 15, color: colors.muted, marginTop: -12 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>A stronger you, one workout at a time.</Text>

        {/* Treino de hoje, com a foto do atleta à direita */}
        <View style={{ backgroundColor: HERO_BG, borderRadius: radius.lg, height: 196, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ flex: 1, padding: 18, justifyContent: 'center', gap: 4, zIndex: 1 }}>
            <Text style={{ color: today.live ? '#0A84FF' : '#5B6472', fontSize: 14 }} numberOfLines={1}>{today.label}</Text>
            <Text style={{ fontSize: 26, fontWeight: '800', color: '#101114' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{today.title}</Text>
            <Text style={{ color: '#5B6472' }} numberOfLines={1}>{today.sub}</Text>
            <Pressable onPress={() => (today.live ? today.run() : guard(today.run))} testID="h2-start" style={{ marginTop: 12, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#101114', paddingVertical: 13, paddingHorizontal: 18, borderRadius: radius.md }}>
              <Ionicons name="play" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{today.cta}</Text>
            </Pressable>
          </View>
          <Image source={HERO} resizeMode="cover" style={{ width: '44%', height: '100%' }} />
        </View>

        {/* Números */}
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Stat label="Streak" value={String(streak)} unit={streak === 1 ? 'day' : 'days'} icon="flame" color="#FF6B2C" onPress={() => router.push('/profile/calendar')} />
          <Stat label="Workouts" value={String(workouts.length)} unit="total" icon="barbell" color={colors.primary} onPress={() => router.push('/profile/stats')} />
          <Stat label="This Week" value={goal ? `${weekList.length}/${goal}` : String(weekList.length)} unit="sessions" icon="stats-chart" color="#22B573" onPress={() => router.push('/settings/reminders')} />
        </View>

        {/* Explorar: 3 por linha */}
        <Head title="Explore" onAll={() => router.push('/routines/explore')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
          {tiles.map((t) => (
            <Pressable key={t.key} onPress={t.onPress} testID={`h2-tile-${t.key}`} style={{ width: tileW, minHeight: 118, backgroundColor: `${t.tint}1A`, borderRadius: radius.md, padding: 12, gap: 8 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: t.tint, alignItems: 'center', justifyContent: 'center' }}>
                {t.icon.gym ? <GymIcon name={t.icon.gym} size={24} color="#fff" /> : <Ionicons name={t.icon.ion!} size={21} color="#fff" />}
              </View>
              <View style={{ gap: 2 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{t.sub}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {/* Meus treinos (rotinas) */}
        <Head title="My Workouts" onAll={() => router.navigate('/treino')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP }} style={{ marginHorizontal: -PAD }}>
          <View style={{ width: PAD - GAP }} />
          {routines.map((r) => (
            <Pressable key={r.id} onPress={() => router.push({ pathname: '/routines/[id]', params: { id: r.id } })} style={{ width: 196, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 6 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <GymIcon name="dumbbell" size={20} color={colors.primary} />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }} numberOfLines={1}>{r.title}</Text>
              <Text style={{ color: colors.muted }} numberOfLines={1}>{r.exercises.length} {tr('exercises')} · ~{estMin(r.exercises.reduce((a, e) => a + e.sets.length, 0))} min</Text>
              <Pressable onPress={() => guard(() => { startWorkout({ routine: r }); router.push('/active'); })} style={{ marginTop: 4, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md }}>
                <Ionicons name="play" size={13} color="#fff" />
                <Text style={{ color: '#fff', fontWeight: '600' }}>Start</Text>
              </Pressable>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/routines/edit')} testID="h2-new-routine" style={{ width: 150, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="add-circle" size={30} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600' }}>New Routine</Text>
          </Pressable>
          <View style={{ width: PAD - GAP }} />
        </ScrollView>

        {/* Meu progresso */}
        <Head title="My Progress" onAll={() => router.push('/profile/stats')} />
        <Pressable onPress={() => router.push('/profile/stats')} style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.muted }}>Weekly volume</Text>
            <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>{fmtVolume(vol[vol.length - 1]?.value ?? 0, units)}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 8 }}>
            {vol.map((v, i) => (
              <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <View style={{ width: '100%', height: Math.max(4, (v.value / maxVol) * 72), borderRadius: 6, backgroundColor: i === vol.length - 1 ? colors.primary : colors.primarySoft }} />
                <Text style={{ fontSize: 10, color: colors.muted }} numberOfLines={1}>{v.label.slice(0, 5)}</Text>
              </View>
            ))}
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: GAP }}>
          <Stat label="Time" value={weekTime ? fmtDuration(weekTime).replace(/ \d+s$/, '') : '0min'} unit="this week" icon="time" color="#8E5CF6" onPress={() => router.push('/profile/stats')} />
          <Stat label="Sets" value={String(weekSets)} unit="this week" icon="layers" color="#F2405D" onPress={() => router.push('/profile/stats')} />
          <Stat label="Body weight" value={bodyKg ? fmtWeight(bodyKg, units) : '—'} unit="latest" icon="scale" color="#1E9BD7" onPress={() => router.push('/profile/measures')} />
        </View>
        {last && (
          <Pressable onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: last.id } })} style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#22B573', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="checkmark-done" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>Last workout</Text>
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 16 }} numberOfLines={1}>{last.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{fmtDate(last.date)} · {fmtDuration(last.durationSec).replace(/ \d+s$/, '')} · {fmtVolume(workoutVolume(last), units)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Pressable>
        )}
      </ScrollView>
      <ActiveBar />
      <Dialog visible={!!pending} title="A workout is already in progress" message="Discard the current workout and start a new one?" onClose={() => setPending(null)}
        actions={[{ label: 'Back to workout', onPress: () => { setPending(null); router.push('/active'); } }, { label: 'Discard and start', danger: true, onPress: () => { const run = pending; setPending(null); discardActive(); run?.(); } }]} />
    </Screen>
  );
}

function Head({ title, onAll }: { title: string; onAll: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -6 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>{title}</Text>
      <Text onPress={onAll} style={{ color: colors.primary, fontSize: 15 }}>See all</Text>
    </View>
  );
}

function Stat({ label, value, unit, icon, color, onPress }: { label: string; value: string; unit: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, padding: 12, gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '800', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{value}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{unit}</Text>
    </Pressable>
  );
}
