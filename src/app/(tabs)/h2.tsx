import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, type ImageSourcePropType } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { IconCircle } from '../../components/IconCircle';
import { Text } from '../../components/Text';
import { Dialog, Screen } from '../../components/ui';
import { CAT_BY_EN, catKey } from '../../lib/catalog';
import { PROGRAMS, type Template } from '../../lib/constants';
import { equipImage, muscleImage } from '../../lib/iconImages';
import { tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import type { Routine, RoutineExercise, Workout } from '../../lib/types';

/** Home alternativa (H2) para o Rodrigo comparar com a Início atual: tudo com os dados reais do app. */

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

function thisWeek(workouts: Workout[]) {
  const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); // semana começa na segunda
  return workouts.filter((w) => new Date(w.date) >= s).length;
}

/** Minutos estimados: ~2,5 min por série (execução + descanso). */
const estMin = (sets: number) => Math.max(10, Math.round((sets * 2.5) / 5) * 5);

const fromTemplate = (t: Template): Routine => ({
  id: '', title: t.title, notes: t.notes,
  exercises: t.exercises.flatMap((n) => CAT_BY_EN.get(n) ?? []).map((c): RoutineExercise => ({
    exerciseId: catKey(c), notes: '', restSec: c.k === 'duration' ? 0 : 90,
    sets: [1, 2, 3].map(() => ({ type: 'normal' as const, kg: null, reps: c.k === 'duration' ? 30 : 10 })),
  })),
});

type Tile = { key: string; title: string; sub: string; img?: ImageSourcePropType; tint: string; onPress: () => void };

export default function H2() {
  const { profile, workouts, routines, trainer, active, wprefs, startWorkout, startTrainerWorkout, discardActive } = useStore();
  const [pending, setPending] = useState<(() => void) | null>(null);

  // treino de hoje: em andamento > próximo do Trainer > primeira rotina > modelo Full Body
  const today = useMemo(() => {
    if (active) return { label: 'Workout in progress', title: active.title || tr('Workout'), sub: `${active.entries.length} ${tr('exercises')}`, cta: 'Resume Workout', run: () => router.push('/active'), live: true };
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
  const week = thisWeek(workouts);
  const goal = wprefs.weeklyGoal > 0 ? wprefs.weeklyGoal : trainer?.settings.frequency ?? 0;
  const preview = (id: string, idx: number) => router.push({ pathname: '/routines/preview', params: { src: 'program', id, idx: String(idx) } });
  const ppl = PROGRAMS.find((p) => p.id === 'ppl')!.routines;

  const tiles: Tile[] = [
    { key: 'plan', title: trainer ? 'My Plan' : '30 Days Plan', sub: trainer ? 'Your Trainer program' : 'Build a habit', img: equipImage('dumbbell'), tint: '#34C759', onPress: () => router.navigate('/plano') },
    { key: 'push', title: 'Push', sub: 'Chest, Shoulders, Triceps', img: muscleImage('Chest'), tint: '#FF3B5C', onPress: () => preview('ppl', 0) },
    { key: 'pull', title: 'Pull', sub: 'Back, Biceps', img: muscleImage('Lats'), tint: '#0A84FF', onPress: () => preview('ppl', 1) },
    { key: 'legs', title: 'Legs', sub: 'Quads, Hamstrings', img: muscleImage('Quadriceps'), tint: '#FF9500', onPress: () => preview('ppl', 2) },
    { key: 'upper', title: 'Upper Body', sub: `~${estMin(ppl[0].exercises.length * 3)} min`, img: muscleImage('Shoulders'), tint: '#AF52DE', onPress: () => preview('upperlower', 0) },
    { key: 'lower', title: 'Lower Body', sub: `~${estMin(ppl[2].exercises.length * 3)} min`, img: muscleImage('Glutes'), tint: '#32ADE6', onPress: () => preview('upperlower', 1) },
  ];

  const name = profile?.displayName?.trim() || profile?.username || '';
  const initial = (name[0] ?? '?').toUpperCase();

  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32, gap: 18 }} testID="h2">
        {/* Saudação */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontSize: 17, color: colors.text }}>{name ? `${tr('Hello')}, ${name}` : 'Hello'}</Text>
            <Text style={{ fontSize: 30, fontWeight: '800', color: colors.text }}>Ready to train?</Text>
            <Text style={{ fontSize: 15, color: colors.muted }}>A stronger you, one workout at a time.</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => router.push('/settings/reminders')} testID="h2-bell" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="notifications-outline" size={21} color={colors.text} />
            </Pressable>
            <Pressable onPress={() => router.navigate('/perfil')} testID="h2-avatar" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 17 }}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        {/* Treino de hoje */}
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 18, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: today.live ? colors.primary : colors.muted, fontSize: 14 }}>{today.label}</Text>
            <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }} numberOfLines={2}>{today.title}</Text>
            <Text style={{ color: colors.muted }}>{today.sub}</Text>
            <Pressable onPress={() => (today.live ? today.run() : guard(today.run))} testID="h2-start" style={{ marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.text, paddingVertical: 13, paddingHorizontal: 20, borderRadius: radius.md }}>
              <Ionicons name="play" size={16} color={colors.bg} />
              <Text style={{ color: colors.bg, fontWeight: '700', fontSize: 15 }}>{today.cta}</Text>
            </Pressable>
          </View>
          <IconCircle source={equipImage('barbell')} size={104} />
        </View>

        {/* Números */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat label="Streak" value={String(streak)} unit={streak === 1 ? 'day' : 'days'} icon="flame" color="#FF6B2C" onPress={() => router.push('/profile/calendar')} />
          <Stat label="Workouts" value={String(workouts.length)} unit="total" icon="barbell" color={colors.primary} onPress={() => router.push('/profile/stats')} />
          <Stat label="This Week" value={goal ? `${week} / ${goal}` : String(week)} unit="sessions" icon="stats-chart" color="#34C759" onPress={() => router.push('/settings/reminders')} />
        </View>

        {/* Explorar */}
        <Head title="Explore" onAll={() => router.push('/routines/explore')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {tiles.map((t) => (
            <Pressable key={t.key} onPress={t.onPress} testID={`h2-tile-${t.key}`} style={{ width: '31.5%', minHeight: 116, backgroundColor: `${t.tint}1F`, borderRadius: radius.md, padding: 12, gap: 6 }}>
              <IconCircle source={t.img} size={38} />
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>{t.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }} numberOfLines={2}>{t.sub}</Text>
            </Pressable>
          ))}
        </View>

        {/* Minhas rotinas */}
        <Head title="My Workouts" onAll={() => router.navigate('/treino')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {routines.map((r) => (
            <Pressable key={r.id} onPress={() => router.push({ pathname: '/routines/[id]', params: { id: r.id } })} style={{ width: 200, backgroundColor: colors.surface, borderRadius: radius.md, padding: 14, gap: 6 }}>
              <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }} numberOfLines={1}>{r.title}</Text>
              <Text style={{ color: colors.muted }}>{r.exercises.length} {tr('exercises')} · ~{estMin(r.exercises.reduce((a, e) => a + e.sets.length, 0))} min</Text>
              <Pressable onPress={() => guard(() => { startWorkout({ routine: r }); router.push('/active'); })} style={{ marginTop: 6, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primarySoft, paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.md }}>
                <Ionicons name="play" size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Start</Text>
              </Pressable>
            </Pressable>
          ))}
          <Pressable onPress={() => router.push('/routines/edit')} testID="h2-new-routine" style={{ width: 160, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border, padding: 14, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Ionicons name="add" size={26} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '600' }}>New Routine</Text>
          </Pressable>
        </ScrollView>
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
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={20} color={color} />
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{unit}</Text>
    </Pressable>
  );
}
