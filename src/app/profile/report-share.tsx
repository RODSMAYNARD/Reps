import { Ionicons } from '@expo/vector-icons';
import { track } from '../../lib/analytics';
import * as MediaLibrary from 'expo-media-library/legacy';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '../../components/Text';
import Svg, { Line, Polygon } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { Header, Screen } from '../../components/ui';
import { fmtDuration, fmtVolume } from '../../lib/format';
import { inMonth, metricValue, Metric, tally } from '../../lib/report';
import { dayKey } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';
import { locale } from '../../lib/i18n';

const THEMES = [
  { bg: '#030A1E', fg: '#FFFFFF', sub: '#8A93A6', dim: '#0E1A33', accent: '#0A84FF', prev: '#9AA3B2' },
  { bg: '#000000', fg: '#FFFFFF', sub: '#8A8A8F', dim: '#1C1C1E', accent: '#34C759', prev: '#8A8A8F' },
  { bg: '#0A84FF', fg: '#FFFFFF', sub: '#CFE6FF', dim: '#3C9BFF', accent: '#FFFFFF', prev: '#CFE6FF' },
];
type Theme = (typeof THEMES)[number];
const AXES = ['Back', 'Chest', 'Core', 'Arms', 'Shoulders', 'Legs'];

function Frame({ t, month, title, user, children }: { t: Theme; month: string; title: string; user: string; children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, borderRadius: 28, padding: 22, justifyContent: 'space-between' }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: t.sub, fontSize: 15 }}>{month}</Text>
        <Text style={{ color: t.fg, fontSize: 26, fontWeight: '800' }}>{title}</Text>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>{children}</View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="barbell" size={22} color={t.fg} /><Text style={{ color: t.fg, fontSize: 20, fontWeight: '900', letterSpacing: 2 }}>REPS</Text></View>
        <Text style={{ color: t.fg, fontSize: 16 }}>@{user}</Text>
      </View>
    </View>
  );
}

function Btn2({ icon, label: l, onPress, children }: { icon?: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 82 }} testID={`rshare-${l}`}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>{children ?? <Ionicons name={icon!} size={24} color={colors.text} />}</View>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{l}</Text>
    </Pressable>
  );
}

export default function ReportShare() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  const st = useStore();
  const { workouts, profile } = st;
  const u = profile.units;
  const { width } = useWindowDimensions();
  const cw = width - 32, ch = Math.round(cw * 0.95);
  const [mY, mM] = (month ?? '').split('-').map(Number);
  const now = new Date();
  const y = mY || now.getFullYear(), m = mY ? mM - 1 : now.getMonth();
  const pd = new Date(y, m - 1, 1);
  const cur = inMonth(workouts, y, m), prev = inMonth(workouts, pd.getFullYear(), pd.getMonth());
  const label = new Date(y, m, 1).toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const prevLabel = pd.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState(0);
  const t = THEMES[bg];
  const refs = useRef<unknown[]>([]);

  const series = Array.from({ length: 12 }, (_, i) => { const d = new Date(y, m - 11 + i, 1); return { l: d.toLocaleDateString(locale(), { month: 'narrow' }), v: inMonth(workouts, d.getFullYear(), d.getMonth()).length }; });
  const smax = Math.max(5, ...series.map((s) => s.v));
  const tc = tally(cur, st.findExercise), tp = tally(prev, st.findExercise);
  const topMuscles = [...tc.muscles].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mMax = Math.max(1, ...topMuscles.map((x) => x[1]));
  const topEx = [...tc.ex.values()].sort((a, b) => b.n - a.n).slice(0, 3);
  const worked = new Set(cur.map((w) => dayKey(w.date)));
  const first = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  const rMax = Math.max(1, ...AXES.flatMap((a) => [tc.groups.get(a) ?? 0, tp.groups.get(a) ?? 0]));
  const R = Math.min(ch * 0.26, 90), cx = (cw - 44) / 2, cy = R + 24;
  const pt = (i: number, f: number) => { const a = (-90 + i * 60) * (Math.PI / 180); return `${cx + R * f * Math.cos(a)},${cy + R * f * Math.sin(a)}`; };
  const poly = (g: Map<string, number>) => AXES.map((a, i) => pt(i, Math.max(0.04, (g.get(a) ?? 0) / rMax))).join(' ');

  const sums: { k: Metric; label: string; fmt: (v: number) => string }[] = [
    { k: 'workouts', label: 'Workouts', fmt: (v) => String(Math.round(v)) }, { k: 'duration', label: 'Duration', fmt: fmtDuration },
    { k: 'volume', label: 'Volume', fmt: (v) => fmtVolume(v, u) }, { k: 'sets', label: 'Sets', fmt: (v) => String(Math.round(v)) },
  ];
  const delta = (k: Metric, fmt: (v: number) => string) => { const d = metricValue(cur, k) - metricValue(prev, k); return d ? <Text style={{ color: d > 0 ? '#4ADE80' : '#F87171', fontSize: 15 }}>{d > 0 ? '↑' : '↓'} {fmt(Math.abs(d))}</Text> : null; };

  const F = (title: string, kids: React.ReactNode) => <Frame t={t} month={label} title={title} user={profile.username}>{kids}</Frame>;
  const cards: React.ReactNode[] = [
    F('Workouts', (
      <View style={{ gap: 8 }}>
        <Text style={{ color: t.fg, fontSize: 40, fontWeight: '800' }}>{cur.length} <Text style={{ fontSize: 16, color: t.sub, fontWeight: '400' }}>workouts</Text></Text>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: ch * 0.38, gap: 6 }}>
          {series.map((s, i) => <View key={i} style={{ flex: 1, height: `${Math.max(3, (s.v / smax) * 100)}%`, backgroundColor: i === 11 ? t.accent : t.dim, borderRadius: 4 }} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>{series.map((s, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.sub, fontSize: 12 }}>{s.l}</Text>)}</View>
      </View>
    )),
    F('Workouts', (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
        {sums.map((s) => <View key={s.k} style={{ width: '50%', gap: 2 }}><Text style={{ color: t.sub, fontSize: 15 }}>{s.label}</Text><Text style={{ color: t.fg, fontSize: 28, fontWeight: '800' }}>{s.fmt(metricValue(cur, s.k))}</Text>{delta(s.k, s.fmt)}</View>)}
      </View>
    )),
    F('Workout Days Log', (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <Text key={`h${i}`} style={{ width: `${100 / 7}%`, textAlign: 'center', color: t.fg, fontWeight: '600', marginBottom: 4 }}>{d}</Text>)}
        {cells.map((c, i) => { const on = c ? worked.has(dayKey(new Date(y, m, c))) : false; return (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 }}>
            {c ? <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.accent : t.dim }}><Text style={{ color: on ? (bg === 2 ? '#0A84FF' : '#fff') : t.sub, fontSize: 13, fontWeight: on ? '800' : '400' }}>{c}</Text></View> : null}
          </View>); })}
      </View>
    )),
    F('Muscle Distribution', (
      <View style={{ alignItems: 'center' }}>
        <Svg width={cw - 44} height={cy * 2 + 4}>
          {[0.25, 0.5, 0.75, 1].map((f) => <Polygon key={f} points={AXES.map((_, i) => pt(i, f)).join(' ')} fill="none" stroke={t.dim} strokeWidth={1.5} />)}
          {AXES.map((_, i) => <Line key={i} x1={cx} y1={cy} x2={Number(pt(i, 1).split(',')[0])} y2={Number(pt(i, 1).split(',')[1])} stroke={t.dim} strokeWidth={1} />)}
          <Polygon points={poly(tp.groups)} fill={t.prev} fillOpacity={0.25} stroke={t.prev} strokeWidth={2} />
          <Polygon points={poly(tc.groups)} fill={t.accent} fillOpacity={0.35} stroke={t.accent} strokeWidth={2.5} />
        </Svg>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="none">
          {AXES.map((a, i) => { const [px, py] = pt(i, 1.28).split(',').map(Number); return <Text key={a} style={{ position: 'absolute', left: px - 30, top: py - 9, width: 60, textAlign: 'center', color: t.sub, fontSize: 13 }}>{a}</Text>; })}
        </View>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
          <Text style={{ color: t.prev, fontSize: 12 }}>● {prevLabel}</Text><Text style={{ color: t.accent, fontSize: 12 }}>● {label}</Text>
        </View>
      </View>
    )),
    F('Main Muscle Groups', (
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: t.sub, fontSize: 15 }}>Muscle</Text><Text style={{ color: t.sub, fontSize: 15 }}>Sets</Text></View>
        {topMuscles.map(([n, s]) => (
          <View key={n} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ width: 96, color: t.fg, fontSize: 16 }} numberOfLines={1}>{n}</Text>
            <View style={{ flex: 1 }}><View style={{ height: 18, width: `${(s / mMax) * 100}%`, backgroundColor: t.accent, borderRadius: 4 }} /></View>
            <Text style={{ width: 34, textAlign: 'right', color: t.fg, fontSize: 16 }}>{s}</Text>
          </View>
        ))}
      </View>
    )),
    F('Top Exercises', (
      <View style={{ gap: 14 }}>
        {topEx.map((e) => (
          <View key={e.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}><ExerciseThumb catalogId={e.catalogId} size={56} /></View>
            <View style={{ flex: 1 }}><Text style={{ color: t.fg, fontSize: 18 }} numberOfLines={1}>{e.name}</Text><Text style={{ color: t.sub, fontSize: 16 }}>{e.n} {e.n === 1 ? 'time' : 'times'}</Text></View>
          </View>
        ))}
      </View>
    )),
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  const capture = async () => { const r = refs.current[page]; if (!r) return null; return captureRef(r as Parameters<typeof captureRef>[0], { format: 'png', quality: 1 }); };
  const doShare = async () => { track('report_card_shared', { card: page }); try { const uri = await capture(); if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/png' }); } catch { st.showToast('Could not share the image.'); } };
  const doDownload = async () => {
    track('report_card_downloaded', { card: page });
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return st.showToast('Permission to save was denied.');
      const uri = await capture();
      if (uri) { await MediaLibrary.saveToLibraryAsync(uri); st.showToast('Saved to your photos!'); }
    } catch { st.showToast('Could not save the image.'); }
  };
  return (
    <Screen>
      <Header title="Share" />
      <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flexGrow: 0 }} testID="share-pager">
          {cards.map((c, i) => (
            <View key={i} style={{ width, padding: 16 }}>
              <View ref={(r) => { refs.current[i] = r; }} collapsable={false} style={{ width: cw, height: ch, borderRadius: 28, overflow: 'hidden' }}>{c}</View>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>{cards.map((_, i) => <View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: i === page ? colors.primary : colors.dot }} />)}</View>
        <Text style={{ textAlign: 'center', color: colors.text, fontSize: 17 }}>Share this image</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
          <Btn2 label="Background" onPress={() => setBg((bg + 1) % THEMES.length)}><View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border }}><Ionicons name="color-palette-outline" size={24} color="#fff" /></View></Btn2>
          <Btn2 icon="share-outline" label="More" onPress={doShare} />
          <Btn2 icon="download-outline" label="Download" onPress={doDownload} />
        </View>
      </View>
    </Screen>
  );
}
