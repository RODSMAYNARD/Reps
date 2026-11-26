import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { ActiveBar } from '../../components/ActiveBar';
import { GymIcon } from '../../components/GymIcon';
import { HomeNotices } from '../../components/HomeNotices';
import { RecoveryCard } from '../../components/HealthCards';
import { DayHeader, WeekStrip } from '../../components/WeekStrip';
import { Text } from '../../components/Text';
import { Btn, Dialog, ListRow, Screen, Tile } from '../../components/ui';
import { PROGRAMS } from '../../lib/constants';
import { fmtDate, fmtDuration, fmtVolume, fmtWeight } from '../../lib/format';
import { GPLANS, planSub, setG, useG } from '../../lib/gplan';
import { tr } from '../../lib/i18n';
import { workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { dayId, dayStreak, estMin, fromTemplate } from '../../lib/today';

/** Home alternativa (H2) para o Rodrigo comparar com a Início atual: tudo com os dados reais do app. */

const PAD = 16;
const GAP = 10;

const weekStart = () => { const s = new Date(); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }; // semana começa na segunda

type ExploreTile = { key: string; title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void };

export default function H2() {
  const { session, profile, workouts, routines, trainer, active, wprefs, measurements, startWorkout, startTrainerWorkout, discardActive } = useStore();
  const uid = session?.user.id ?? null;
  const g = useG(uid);
  const { width } = useWindowDimensions();
  const [pending, setPending] = useState<(() => void) | null>(null);
  // Dia escolhido na faixa (como no ProteinWay): hoje mostra o próximo treino; outro dia mostra os treinos daquele dia
  const [selDay, setSelDay] = useState(() => new Date());
  const viewingToday = dayId(selDay) === dayId(new Date());
  const dayList = useMemo(() => workouts.filter((w) => dayId(new Date(w.date)) === dayId(selDay)), [workouts, selDay]);
  const units = profile.units;

  // treino de hoje: em andamento > próximo do Trainer > primeira rotina > modelo Full Body
  const today = useMemo(() => {
    if (active) return { label: 'Workout in progress', title: active.title || tr('Workout'), sub: `${active.entries.length} ${tr('exercises')}`, cta: 'Resume', run: () => router.push('/active'), live: true };
    const tw = trainer && (trainer.workouts.find((w) => w.uid === trainer.nextUid) ?? trainer.workouts[0]);
    if (tw) return { label: 'Next Workout', title: tw.title, sub: `${tw.exercises.length} ${tr('exercises')} · ~${trainer!.settings.duration} min`, cta: 'Start Workout', run: () => { startTrainerWorkout(tw.uid); router.push('/active'); } };
    const r = routines[0];
    if (r) return { label: 'Next Workout', title: r.title, sub: `${r.exercises.length} ${tr('exercises')} · ~${estMin(r.exercises.reduce((a, e) => a + e.sets.length, 0))} min`, cta: 'Start Workout', run: () => { startWorkout({ routine: r }); router.push('/active'); } };
    const t = fromTemplate(PROGRAMS.find((p) => p.id === 'fullbody')!.routines[0]);
    return { label: 'Next Workout', title: 'Full Body', sub: `${t.exercises.length} ${tr('exercises')} · ~${estMin(t.exercises.length * 3)} min`, cta: 'Start Workout', run: () => { startWorkout({ routine: { ...t, title: 'Full Body' } }); router.push('/active'); } };
  }, [active, trainer, routines, startWorkout, startTrainerWorkout]);

  /** Começar outro treino com um já em andamento pergunta antes (igual à aba Workout). */
  const guard = (run: () => void) => (active ? setPending(() => run) : run());

  const streak = dayStreak(workouts);
  const ws = weekStart();
  const weekList = workouts.filter((w) => new Date(w.date) >= ws);
  const goal = wprefs.weeklyGoal > 0 ? wprefs.weeklyGoal : trainer?.settings.frequency ?? 0;
  const weekTime = weekList.reduce((a, w) => a + w.durationSec, 0);
  const weekSets = weekList.reduce((a, w) => a + workoutSets(w), 0);
  const bodyKg = measurements.find((m) => m.values.weight)?.values.weight ?? profile.weightKg;
  const last = workouts[0];
  // planos de 30 dias: os que já estão em andamento vêm primeiro
  const started = (id: string) => { const d = g.done[id] ?? 0; return d > 0 && d < 30; };
  const plans = [...GPLANS].sort((a, b) => Number(started(b.id)) - Number(started(a.id)));

  const preview = (id: string, idx: number) => router.push({ pathname: '/routines/preview', params: { src: 'program', id, idx: String(idx) } });

  // 1ª linha: Trainer, superiores, inferiores · 2ª linha: push, pull, legs (os planos de 30 dias têm a seção própria acima)
  const tiles: ExploreTile[] = [
    { key: 'plan', title: trainer ? 'My Plan' : 'Trainer', icon: 'sparkles-outline', onPress: () => router.navigate('/plano') },
    { key: 'upper', title: 'Upper Body', icon: 'barbell-outline', onPress: () => preview('upperlower', 0) },
    { key: 'lower', title: 'Lower Body', icon: 'walk-outline', onPress: () => preview('upperlower', 1) },
    { key: 'push', title: 'Push', icon: 'arrow-up-circle-outline', onPress: () => preview('ppl', 0) },
    { key: 'pull', title: 'Pull', icon: 'arrow-down-circle-outline', onPress: () => preview('ppl', 1) },
    { key: 'legs', title: 'Legs', icon: 'footsteps-outline', onPress: () => preview('ppl', 2) },
  ];

  // Visual igual ao da tela Perfil (pedido do Rodrigo, 2026-11-23): margens de 16, títulos de seção cinza (Section),
  // cartões cinza sem cores de destaque e ícones na cor do texto (Tile). Sem foto, sem sequência e sem desafios (foram para o Perfil).
  const half = { flexDirection: 'row', justifyContent: 'center', paddingVertical: 11 } as const;
  return (
    <Screen edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 36 }} testID="h2">
        {/* Ritmo (2026-11-23, pedido do Rodrigo: estava apertado): 20 entre os blocos do topo, 32 antes de cada seção, cartões com 16 de folga */}
        <View style={{ paddingHorizontal: PAD, paddingTop: 8, gap: 20 }}>
          {/* Faixa de dias (opção C do Rods-Design-Choices): desliza para os dois lados e escolhe o dia, como no ProteinWay */}
          <View style={{ gap: 6 }}>
            <DayHeader day={selDay} onToday={() => setSelDay(new Date())} testID="h2-day-header" />
            <WeekStrip workouts={workouts} width={width - PAD * 2} selected={selDay} onSelect={setSelDay} testID="h2-week" />
          </View>
          {/* Avisos (relatório do mês, offline) logo abaixo da faixa de dias (pedido do Rodrigo, 2026-11-23) */}
          <HomeNotices />

          {!viewingToday ? (
            // Outro dia escolhido: os treinos daquele dia (toque abre o treino)
            <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' }} testID="h2-day-workouts">
              {dayList.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 15, padding: 16 }}>No workout on this day</Text>
              ) : dayList.map((w, i) => (
                <ListRow key={w.id} icon="barbell-outline" label={w.title} last={i === dayList.length - 1}
                  subtitle={`${fmtDuration(w.durationSec).replace(/ \d+s$/, '')} · ${fmtVolume(workoutVolume(w), units)} · ${workoutSets(w)} ${tr('sets')}`}
                  onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: w.id } })} />
              ))}
            </View>
          ) : (
          /* Próximo treino: em andamento > próximo do Trainer > primeira rotina > Full Body. Sem imagem. */
          <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 14 }} testID="h2-next">
            <View style={{ gap: 4 }}>
              <Text style={{ color: today.live ? colors.primary : colors.muted, fontSize: 13 }} numberOfLines={1}>{today.label}</Text>
              <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }} numberOfLines={1}>{today.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 14 }} numberOfLines={1}>{today.sub}</Text>
            </View>
            <Btn title={today.cta} icon="play" onPress={() => (today.live ? today.run() : guard(today.run))} testID="h2-start" />
          </View>
          )}

          {/* Recuperação do relógio/pulseira (só aparece conectado) */}
          <RecoveryCard />

          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Stat label="Streak" value={String(streak)} unit={streak === 1 ? 'day' : 'days'} icon="flame-outline" onPress={() => router.push('/profile/calendar')} />
            <Stat label="This Week" value={goal ? `${weekList.length}/${goal}` : String(weekList.length)} unit="workouts" icon="stats-chart-outline" onPress={() => router.push('/settings/reminders')} />
          </View>
        </View>

        {/* Planos de 30 dias (os mesmos da aba Treinamento): toque abre o plano */}
        <Head title="30-Day Plans" onSeeAll={() => router.navigate('/g')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: GAP, paddingHorizontal: PAD }}>
          {plans.map((p) => {
            const d = g.done[p.id] ?? 0;
            return (
              <Pressable key={p.id} onPress={() => { setG({ planId: p.id }); router.navigate('/g'); }} testID={`h2-plan-${p.id}`} style={{ width: 196, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 10 }}>
                <GymIcon name={p.icon} size={26} color={colors.text} />
                <View style={{ gap: 2 }}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, lineHeight: 20, minHeight: 40 }} numberOfLines={2}>{p.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{planSub(p)}</Text>
                </View>
                <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' }}>
                  <View style={{ height: 4, borderRadius: 2, width: `${Math.min(100, (d / 30) * 100)}%`, backgroundColor: colors.primary }} />
                </View>
                <Text style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{d >= 30 ? tr('Completed') : d === 0 ? `30 ${tr('days')}` : `${tr('Day')} ${d + 1} ${tr('of')} 30`}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Explorar: cartões meio a meio iguais aos do Painel do Perfil */}
        <Head title="Explore" onSeeAll={() => router.push('/routines/explore')} />
        <View style={{ paddingHorizontal: PAD, gap: GAP }}>
          {[0, 2, 4].map((i) => (
            <View key={i} style={{ flexDirection: 'row', gap: GAP }}>
              {tiles.slice(i, i + 2).map((t) => <Tile key={t.key} icon={t.icon} label={t.title} onPress={t.onPress} style={half} />)}
            </View>
          ))}
        </View>

        {/* "Meu progresso" (título e gráfico de volume) saiu da H2 em 2026-11-23: o gráfico fica no Perfil */}
        <Head title="Your numbers" />
        <View style={{ paddingHorizontal: PAD, gap: GAP }}>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Stat label="Time this week" value={weekTime ? fmtDuration(weekTime).replace(/ \d+s$/, '') : '0min'} icon="time-outline" onPress={() => router.push('/profile/stats')} />
            <Stat label="Sets this week" value={String(weekSets)} icon="layers-outline" onPress={() => router.push('/profile/stats')} />
          </View>
          <View style={{ flexDirection: 'row', gap: GAP }}>
            <Stat label="Workouts" value={String(workouts.length)} unit="total" icon="barbell-outline" onPress={() => router.push('/profile/stats')} />
            <Stat label="Body weight" value={bodyKg ? fmtWeight(bodyKg, units) : '—'} icon="scale-outline" onPress={() => router.push('/profile/measures')} />
          </View>
        </View>
        {last && (
          <View style={{ marginTop: 20, marginHorizontal: PAD, backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' }}>
            <ListRow icon="checkmark-done-outline" label={last.title} subtitle={`${tr('Last workout')} · ${fmtDate(last.date)} · ${fmtDuration(last.durationSec).replace(/ \d+s$/, '')} · ${fmtVolume(workoutVolume(last), units)}`} onPress={() => router.push({ pathname: '/feed/workout/[id]', params: { id: last.id } })} last />
          </View>
        )}
      </ScrollView>
      <ActiveBar />
      <Dialog visible={!!pending} title="A workout is already in progress" message="Discard the current workout and start a new one?" onClose={() => setPending(null)}
        actions={[{ label: 'Back to workout', onPress: () => { setPending(null); router.push('/active'); } }, { label: 'Discard and start', danger: true, onPress: () => { const run = pending; setPending(null); discardActive(); run?.(); } }]} />
    </Screen>
  );
}

function SeeAll({ onPress }: { onPress: () => void }) {
  return <Text onPress={onPress} style={{ color: colors.primary, fontSize: 15 }}>See all</Text>;
}

function Stat({ label, value, unit, icon, onPress }: { label: string; value: string; unit?: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    // 2 por linha (2026-11-23): com 3 por linha o número e a unidade não cabiam ("2/5 trein", "75 kg ú").
    // Rótulo com ícone em cima, número grande embaixo; a unidade só fica ao lado quando é curta.
    <Pressable onPress={onPress} style={{ flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={16} color={colors.muted} />
        <Text style={{ flex: 1, color: colors.muted, fontSize: 13 }} numberOfLines={1}>{label}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }} numberOfLines={1}>{value}</Text>
        {!!unit && <Text style={{ flexShrink: 1, color: colors.muted, fontSize: 14 }} numberOfLines={1}>{unit}</Text>}
      </View>
    </Pressable>
  );
}

/** Título de seção da H2: mais ar em cima (separa os blocos) e 12 até o conteúdo. */
function Head({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: PAD, marginTop: 32, marginBottom: 12 }}>
      <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      {onSeeAll && <SeeAll onPress={onSeeAll} />}
    </View>
  );
}
