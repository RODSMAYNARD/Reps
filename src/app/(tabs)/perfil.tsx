import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useShare } from '../../lib/useShare';
import { locale, tr } from '../../lib/i18n';
import { Text } from '../../components/Text';
import { ActiveBar } from '../../components/ActiveBar';
import { WorkoutCard } from '../../components/WorkoutCard';
import { WorkoutMenu } from '../../components/WorkoutMenu';
import { Avatar, Btn, Dialog, Header, HeaderAction, IconButton, ListRow, PillRow, Screen, Section, Sheet, Tile } from '../../components/ui';
import { DateWheels } from '../../components/WheelPicker';
import { barCaption, ProfileChart } from '../../components/ProfileChart';
import { fmtDuration, toDisplayWeight } from '../../lib/format';
import { rangeSeries } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { FEATURES } from '../../lib/constants';
import { colors } from '../../lib/theme';

// Cartões do Painel com metade da altura do Tile padrão (ícone ao lado do texto), iguais a Nova rotina/Explorar do Treino
const half = { flexDirection: 'row', justifyContent: 'center', paddingVertical: 11 } as const;

type Range = '3m' | 'year' | 'all' | 'custom';
const RANGES: { id: Range; label: string }[] = [{ id: '3m', label: 'Last 3 months' }, { id: 'year', label: 'Year' }, { id: 'all', label: 'All time' }, { id: 'custom', label: 'Custom' }];
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

export default function Perfil() {
  const { profile, workouts } = useStore();
  const share = useShare();
  const [metric, setMetric] = useState<'duration' | 'volume' | 'reps'>('duration');
  // ⋯ do treino abre o mesmo menu do Início (Share, Save as Routine, Copy, Edit, Delete)
  const [target, setTarget] = useState<string | null>(null);
  // Período do gráfico (como no Hevy, 2026-11-23): últimos 3 meses (por semana), ano, desde o início e personalizado (por mês acima de ~4 meses)
  const [range, setRange] = useState<Range>('3m');
  const [rangeOpen, setRangeOpen] = useState(false);
  const [custom, setCustom] = useState(() => { const to = new Date(); const from = new Date(); from.setMonth(from.getMonth() - 1); return { from, to }; });
  const [draft, setDraft] = useState<{ from: Date; to: Date; edit: 'from' | 'to' } | null>(null);
  const firstDate = useMemo(() => (workouts.length ? new Date(Math.min(...workouts.map((w) => new Date(w.date).getTime()))) : new Date()), [workouts]);
  const period = useMemo(() => {
    const to = new Date();
    if (range === 'custom') return { from: startOfDay(custom.from), to: endOfDay(custom.to) };
    const from = new Date();
    if (range === '3m') from.setDate(from.getDate() - 7 * 11);
    else if (range === 'year') { from.setMonth(from.getMonth() - 11); from.setDate(1); }
    else return { from: startOfDay(firstDate), to };
    return { from: startOfDay(from), to };
  }, [range, custom, firstDate]);
  const series = rangeSeries(workouts, metric, period.from, period.to);
  const fmtShort = (d: Date) => d.toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : '2-digit' });
  const rangeLabel = range === 'custom' ? `${fmtShort(period.from)} – ${fmtShort(period.to)}` : tr(RANGES.find((r) => r.id === range)!.label);
  // Barra escolhida (toque, como no Hevy); sem toque vale a última. Trocar período ou métrica volta para a última.
  const [pick, setPick] = useState<number | null>(null);
  const [info, setInfo] = useState(false); // "i" ao lado de Reps: como cada estatística é calculada
  const sel = pick != null && pick < series.length ? pick : series.length - 1;
  const bar = series[sel];
  const u = profile.units.weight;
  // volume vem em kg: converte para a unidade do perfil; acima de 10 mil vira "16k kg"
  const compact = (v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : Math.round(v).toLocaleString(locale()));
  const fmtVal = (v: number) => (metric === 'duration' ? (v > 0 ? fmtDuration(Math.round(v * 3600)).replace(/ \d+s$/, '') : '0min') : metric === 'volume' ? `${compact(toDisplayWeight(v, profile.units))} ${u}` : `${Math.round(v)} reps`);
  const fmtAxis = (v: number) => (metric === 'duration' ? `${Math.round(v * 10) / 10} h` : metric === 'volume' ? `${compact(toDisplayWeight(v, profile.units))} ${u}` : `${Math.round(v)} reps`);
  const headline = bar ? fmtVal(bar.value) : '–';
  const name = profile.displayName || profile.username;
  // os treinos vêm em páginas de 1000: lista virtualizada, com o bloco do perfil como cabeçalho
  const header = (
    <>
      <View style={{ flexDirection: 'row', gap: 16, padding: 16, alignItems: 'center' }}>
        <Avatar name={name} size={84} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.text }}>{name}</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {[['Workouts', String(workouts.length), '/profile/calendar'], ...(FEATURES.social ? [['Followers', '0', '/feed/friends'], ['Following', '0', '/feed/friends']] : [])].map(([l, v, to]) => (
              <Text key={l} onPress={() => router.push(to as never)} style={{ color: colors.muted }}>{l}{'\n'}<Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>{v}</Text></Text>
            ))}
          </View>
        </View>
      </View>
      {!!profile.bio && <Text style={{ paddingHorizontal: 16, color: colors.text }}>{profile.bio}</Text>}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ flex: 1, fontSize: 17, color: colors.text }} numberOfLines={1}><Text style={{ fontWeight: '700' }}>{headline}</Text> <Text style={{ color: colors.muted }}>{bar ? barCaption(bar) : ''}</Text></Text>
          <Pressable onPress={() => setRangeOpen(true)} hitSlop={8} testID="profile-range" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ color: colors.primary, fontSize: 16 }} numberOfLines={1}>{rangeLabel}</Text>
            <Ionicons name="chevron-down" size={18} color={colors.primary} />
          </Pressable>
        </View>
        <ProfileChart data={series} fmtAxis={fmtAxis} selected={sel} onPick={setPick} />
      </View>
      <PillRow value={metric} onChange={(m) => { setMetric(m as typeof metric); setPick(null); }} items={[{ id: 'duration', label: 'Duration' }, { id: 'volume', label: 'Volume' }, { id: 'reps', label: 'Reps' }]}
        after={<IconButton name="information-circle-outline" size={22} color={colors.muted} onPress={() => setInfo(true)} testID="chart-info" />} />
      <Section title="Dashboard" />
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="trending-up-outline" label="Statistics" onPress={() => router.push('/profile/stats')} style={half} />
          <Tile icon="barbell-outline" label="Exercises" onPress={() => router.push('/exercises')} style={half} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="body-outline" label="Measures" onPress={() => router.push('/profile/measures')} style={half} />
          <Tile icon="calendar-outline" label="Calendar" onPress={() => router.push('/profile/calendar')} style={half} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="heart-outline" label="Health" onPress={() => router.push('/health')} style={half} />
          <Tile icon="watch-outline" label="Watches & Health" onPress={() => router.push('/settings/integrations')} style={half} />
        </View>
      </View>
      <Section title="Workouts" />
      {workouts.length === 0 && <Text style={{ color: colors.muted, textAlign: 'center', padding: 24 }}>No workouts logged yet.</Text>}
    </>
  );
  return (
    <Screen edges={['top']}>
      <Header left="none" leftNode={<HeaderAction label="Edit Profile" onPress={() => router.push('/profile/edit')} />} title={profile.username}
        right={<>
          <IconButton name="share-outline" onPress={() => share.text(tr('Follow @{u} on Reps').replace('{u}', profile.username))} testID="profile-share" />
          <IconButton name="settings-outline" onPress={() => router.push('/settings')} testID="open-settings" />
        </>} />
      <FlatList data={workouts} keyExtractor={(w) => w.id} ListHeaderComponent={header} renderItem={({ item }) => <WorkoutCard w={item} onMenu={() => setTarget(item.id)} />} />
      <ActiveBar />
      <WorkoutMenu id={target} onClose={() => setTarget(null)} />
      <Dialog visible={info} title={metric === 'duration' ? 'Duration' : metric === 'volume' ? 'Volume' : 'Reps'} onClose={() => setInfo(false)}
        message={metric === 'duration' ? 'Total time of your workouts in each bar, from start to finish (rest included). Each bar is one week (Monday to Sunday) or one month in longer periods. Tap a bar to see its value.'
          : metric === 'volume' ? 'Total weight lifted in each bar: weight × reps of every set. Warm-up sets are not included, and neither are bodyweight-only, time or distance exercises or the help weight of assisted exercises. Tap a bar to see its value.'
          : 'Total repetitions in each bar, from exercises logged with reps. Warm-up sets are not included, and neither are timed exercises like the plank. Tap a bar to see its value.'}
        actions={[{ label: 'OK', primary: true, onPress: () => setInfo(false) }]} />
      <Sheet visible={rangeOpen} onClose={() => setRangeOpen(false)} title="Period">
        {RANGES.map((r, i) => (
          <ListRow key={r.id} label={r.label} testID={`range-${r.id}`} last={i === RANGES.length - 1}
            right={range === r.id ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : <View />}
            onPress={() => { setRangeOpen(false); if (r.id === 'custom') setDraft({ ...custom, edit: 'from' }); else { setRange(r.id); setPick(null); } }} />
        ))}
      </Sheet>
      <Sheet visible={!!draft} onClose={() => setDraft(null)} title="Custom period">
        {draft && (
          <View style={{ gap: 12, paddingBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
              {(['from', 'to'] as const).map((k) => (
                <Pressable key={k} onPress={() => setDraft({ ...draft, edit: k })} testID={`custom-${k}`} style={{ flex: 1, borderRadius: 12, padding: 10, gap: 2, backgroundColor: draft.edit === k ? colors.primarySoft : colors.surface }}>
                  <Text style={{ fontSize: 12, color: draft.edit === k ? colors.primary : colors.muted }}>{k === 'from' ? 'Start date' : 'End date'}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>{draft[k].toLocaleDateString(locale(), { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                </Pressable>
              ))}
            </View>
            <DateWheels key={draft.edit} value={draft[draft.edit]} minYear={Math.min(firstDate.getFullYear(), new Date().getFullYear() - 1)}
              onChange={(d) => setDraft({ ...draft, [draft.edit]: d })} />
            <View style={{ paddingHorizontal: 16 }}>
              {/* início depois do fim: troca os dois de lugar em vez de recusar */}
              <Btn title="Apply" testID="custom-apply" onPress={() => { const a = draft.from, b = draft.to; setCustom(a <= b ? { from: a, to: b } : { from: b, to: a }); setRange('custom'); setPick(null); setDraft(null); }} />
            </View>
          </View>
        )}
      </Sheet>
    </Screen>
  );
}
