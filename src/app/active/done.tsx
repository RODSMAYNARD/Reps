import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library/legacy';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Image, Linking, NativeScrollEvent, NativeSyntheticEvent, Pressable, ScrollView, Share, Text, useWindowDimensions, View } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';
import { BodyMap, Region, regionsOf } from '../../components/BodyMap';
import { Confetti } from '../../components/Confetti';
import { Btn, Screen, Sheet } from '../../components/ui';
import { track } from '../../lib/analytics';
import { fmtSet } from '../../lib/exerciseOptions';
import { fmtVolume } from '../../lib/format';
import { workoutSets, workoutVolume } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors } from '../../lib/theme';

const ordinal = (n: number) => { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`; };
const shortDur = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60); return h ? `${h}h ${m}min` : `${m}min`; };

/** Comparação do volume total (kg) com algo do mesmo peso: o maior item que não passa do volume. */
const LIFTS: [number, string, string][] = [
  [4, 'a cat', '🐈'], [30, 'a dog', '🐕'], [100, 'a panda', '🐼'], [300, 'a grand piano', '🎹'], [500, 'a horse', '🐎'], [1500, 'a car', '🚗'],
  [3000, 'a hippo', '🦛'], [6000, 'an elephant', '🐘'], [10000, 'a truck', '🚚'], [15000, 'a bus', '🚌'], [40000, 'a whale', '🐋'], [80000, 'an airplane', '✈️'],
];

type Theme = { bg: string; fg: string; sub: string; accent: string; body: string; muscle: string };
const THEMES: Record<'dark' | 'light' | 'transparent', Theme> = {
  dark: { bg: '#030A1E', fg: '#FFFFFF', sub: '#C7CCD6', accent: '#2D8CFF', body: '#7D8696', muscle: '#D3D8E0' },
  light: { bg: '#FFFFFF', fg: '#0B1220', sub: '#4B5563', accent: '#0A84FF', body: '#B9C0CB', muscle: '#E3E7ED' },
  transparent: { bg: 'transparent', fg: '#FFFFFF', sub: '#E5E7EB', accent: '#2D8CFF', body: '#7D8696', muscle: '#D3D8E0' },
};
type Bg = keyof typeof THEMES;

function Checker({ w, h }: { w: number; h: number }) {
  const n = 14, cols = Math.ceil(w / n), rows = Math.ceil(h / n);
  return (
    <Svg width={w} height={h} style={{ position: 'absolute' }}>
      <Rect width={w} height={h} fill="#9CA3AF" />
      {Array.from({ length: rows * cols }, (_, i) => { const r = Math.floor(i / cols), c = i % cols; return (r + c) % 2 ? <Rect key={i} x={c * n} y={r * n} width={n} height={n} fill="#6B7280" /> : null; })}
    </Svg>
  );
}

function ShareBtn({ label, onPress, bg = colors.surface, children }: { label: string; onPress: () => void; bg?: string; children: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} style={{ alignItems: 'center', gap: 6, width: 74 }} testID={`share-${label}`}>
      <View style={{ width: 57, height: 57, borderRadius: 29, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>{children}</View>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: 'center' }} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

export default function WorkoutDone() {
  const { id, photo } = useLocalSearchParams<{ id: string; photo?: string }>();
  const st = useStore();
  const { workouts, profile } = st;
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const [bg, setBg] = useState<Bg>('dark');
  const [bgSheet, setBgSheet] = useState(false);
  const [party, setParty] = useState(1);
  const refs = useRef<unknown[]>([]);
  const w = workouts.find((x) => x.id === id);
  if (!w) return <Screen><View style={{ flex: 1, justifyContent: 'center', padding: 24 }}><Btn title="Done" onPress={() => router.dismissTo('/')} /></View></Screen>;

  const t = THEMES[bg];
  const u = profile.units;
  const cw = width - 36, ch = cw;
  const k = cw / 340;
  const vol = workoutVolume(w);
  const sets = workoutSets(w);
  const stats: [string, string][] = [['Duration', shortDur(w.durationSec)], ['Volume', fmtVolume(vol, u)], ['Sets', String(sets)]];
  const exs = w.entries.map((e) => ({ n: e.sets.length, ex: st.findExercise(e.exerciseId), sets: e.sets }));
  const primary = [...new Set(exs.flatMap((e) => [...regionsOf(e.ex?.muscle), ...regionsOf(e.ex?.target)]))] as Region[];
  const secondary = [...new Set(exs.flatMap((e) => (e.ex?.secondary ?? []).flatMap(regionsOf)))] as Region[];
  const lift = [...LIFTS].reverse().find(([kg]) => vol >= kg);
  const user = profile.username ? `@${profile.username}` : '';
  const bodyColors = { body: t.body, muscle: t.muscle, on: t.accent };

  const T = (size: number, extra?: object) => ({ color: t.fg, fontSize: size * k, ...extra });
  const title = (center?: boolean) => <Text style={T(28, { fontWeight: '700', textAlign: center ? 'center' : 'left' })} numberOfLines={1}>{w.title}</Text>;
  const brand = (stacked?: boolean) => (
    <View style={stacked ? { alignItems: 'center', gap: 6 * k } : { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="barbell" size={24 * k} color={t.fg} /><Text style={T(24, { fontWeight: '900', letterSpacing: 2 })}>REPS</Text></View>
      {!!user && <Text style={T(19)}>{user}</Text>}
    </View>
  );
  const list = (max: number) => (
    <View style={{ gap: 6 * k }}>
      {exs.slice(0, max).map((e, i) => (
        <Text key={i} numberOfLines={1} style={T(18)}><Text style={{ color: t.accent, fontSize: 20 * k }}>{e.n}x </Text> {e.ex?.name ?? 'Exercise'}</Text>
      ))}
      {exs.length > max && <Text style={T(18)}>...and {exs.length - max} more {exs.length - max === 1 ? 'exercise' : 'exercises'}</Text>}
    </View>
  );
  const frame = (pad = 26) => ({ flex: 1, padding: pad * k, justifyContent: 'space-between' as const });

  const cards: { key: string; node: React.ReactNode }[] = [
    ...(photo ? [{ key: 'photo', node: (
      <View style={{ flex: 1 }}>
        <Image source={{ uri: photo }} style={{ position: 'absolute', width: cw, height: ch }} resizeMode="cover" />
        <View style={{ position: 'absolute', width: cw, height: ch, backgroundColor: 'rgba(0,0,0,0.25)' }} />
        <View style={{ flex: 1, padding: 26 * k, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>{stats.map(([l, v]) => <View key={l}><Text style={{ color: '#fff', fontSize: 16 * k }}>{l}</Text><Text style={{ color: '#fff', fontSize: 19 * k, fontWeight: '700' }}>{v}</Text></View>)}</View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="barbell" size={24 * k} color="#fff" /><Text style={{ color: '#fff', fontSize: 24 * k, fontWeight: '900', letterSpacing: 2 }}>REPS</Text></View>
            {!!user && <Text style={{ color: '#fff', fontSize: 19 * k }}>{user}</Text>}
          </View>
        </View>
      </View>
    ) }] : []),
    { key: 'list-body', node: (
      <View style={frame()}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 * k }}>
          <View style={{ flex: 1, gap: 10 * k }}>{title()}{list(6)}</View>
          <View style={{ alignItems: 'center', gap: 4 * k }}>
            <BodyMap side="front" primary={primary} secondary={secondary} width={66 * k} colors={bodyColors} />
            <BodyMap side="back" primary={primary} secondary={secondary} width={66 * k} colors={bodyColors} />
          </View>
        </View>
        {brand()}
      </View>
    ) },
    { key: 'stats', node: (
      <View style={frame()}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 * k }}>
          {stats.map(([l, v]) => <View key={l} style={{ alignItems: 'center' }}><Text style={T(26, { fontWeight: '800' })}>{v}</Text><Text style={T(19)}>{l}</Text></View>)}
        </View>
        {brand(true)}
      </View>
    ) },
    { key: 'lifted', node: (
      <View style={frame()}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 * k }}>
          <Text style={T(22, { fontWeight: '600' })}>You lifted a total of</Text>
          <Text style={T(54, { fontWeight: '800' })} numberOfLines={1} adjustsFontSizeToFit>{fmtVolume(vol, u)}</Text>
          <Text style={T(19, { fontWeight: '600' })}>{lift ? `That's like lifting ${lift[1]}!` : 'Every rep counts!'}</Text>
          <Text style={{ fontSize: 96 * k, marginTop: 8 * k }}>{lift ? lift[2] : '💪'}</Text>
        </View>
        {brand()}
      </View>
    ) },
    { key: 'stats-list', node: (
      <View style={frame()}>
        <View style={{ gap: 14 * k }}>
          {title()}
          <View style={{ flexDirection: 'row', gap: 26 * k }}>{stats.map(([l, v]) => <View key={l}><Text style={T(18)}>{l}</Text><Text style={T(21, { fontWeight: '800' })}>{v}</Text></View>)}</View>
          {list(4)}
        </View>
        {brand()}
      </View>
    ) },
    { key: 'grid', node: (
      <View style={frame()}>
        {title()}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 26 * k }}>
          {[[shortDur(w.durationSec), 'Duration'], [fmtVolume(vol, u), 'Volume'], [String(exs.length), 'Exercises'], [String(sets), 'Sets']].map(([v, l]) => (
            <View key={l} style={{ width: '50%' }}><Text style={T(32, { fontWeight: '800' })} numberOfLines={1} adjustsFontSizeToFit>{v}</Text><Text style={T(19)}>{l}</Text></View>
          ))}
        </View>
        {brand()}
      </View>
    ) },
    { key: 'body-stats', node: (
      <View style={frame(22)}>
        {title(true)}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18 * k }}>
          <BodyMap side="front" primary={primary} secondary={secondary} width={74 * k} colors={bodyColors} />
          <BodyMap side="back" primary={primary} secondary={secondary} width={74 * k} colors={bodyColors} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>{stats.map(([l, v]) => <View key={l} style={{ alignItems: 'center' }}><Text style={T(18)}>{l}</Text><Text style={T(21, { fontWeight: '800' })}>{v}</Text></View>)}</View>
        {brand()}
      </View>
    ) },
  ];
  const card = cards[page]?.key ?? 'card';

  const text = [
    `${w.title}`,
    `${shortDur(w.durationSec)} · ${fmtVolume(vol, u)} · ${sets} sets`,
    '',
    ...exs.map((e) => `${e.n}x ${e.ex?.name ?? 'Exercise'}`),
    '',
    'Logged with Reps',
  ].join('\n');
  const aiText = [
    'Here is a workout I just finished. Please analyze it: what went well, what I could improve, and what to do next session.',
    '',
    `${w.title} — ${shortDur(w.durationSec)}, ${fmtVolume(vol, u)} total volume, ${sets} sets`,
    ...exs.map((e) => `- ${e.ex?.name ?? 'Exercise'}: ${e.sets.map((s) => fmtSet(s, e.ex?.kind, u)).join(', ')}`),
  ].join('\n');

  const capture = async () => { const r = refs.current[page]; if (!r) return null; return captureRef(r as Parameters<typeof captureRef>[0], { format: 'png', quality: 1 }); };
  const shareImage = async (target: string) => {
    track('card_shared', { card, target, background: bg });
    try { const uri = await capture(); if (uri && (await Sharing.isAvailableAsync())) await Sharing.shareAsync(uri, { mimeType: 'image/png' }); else st.showToast('Sharing is not available here.'); } catch { st.showToast('Could not share the image.'); }
  };
  const download = async () => {
    track('card_downloaded', { card, background: bg });
    try {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm.granted) return st.showToast('Permission to save was denied.');
      const uri = await capture();
      if (uri) { await MediaLibrary.saveToLibraryAsync(uri); st.showToast('Saved to your photos!'); }
    } catch { st.showToast('Could not save the image.'); }
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <Screen>
      <View style={{ flex: 1 }} testID="workout-done">
        <View style={{ alignItems: 'center', paddingTop: 20, paddingHorizontal: 80, gap: 6 }}>
          <Text style={{ fontSize: 30, fontWeight: '700', color: colors.text }}>Good job!</Text>
          <Text style={{ fontSize: 17, color: colors.text }}>This is your {ordinal(workouts.length)} workout</Text>
          <Pressable onPress={() => setParty((n) => n + 1)} testID="done-party" style={{ position: 'absolute', right: 18, top: 16, width: 50, height: 50, borderRadius: 25, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 24 }}>🎉</Text>
          </Pressable>
        </View>

        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flexGrow: 0, marginTop: 20 }} testID="done-pager">
          {cards.map((c, i) => (
            <View key={c.key} style={{ width, paddingHorizontal: 18 }}>
              <View style={{ width: cw, height: ch, borderRadius: 28, overflow: 'hidden', backgroundColor: bg === 'transparent' ? undefined : t.bg, elevation: 4, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}>
                {bg === 'transparent' && c.key !== 'photo' && <Checker w={cw} h={ch} />}
                <View ref={(r) => { refs.current[i] = r; }} collapsable={false} style={{ width: cw, height: ch, backgroundColor: t.bg }} testID={`done-card-${c.key}`}>{c.node}</View>
              </View>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 14 }}>{cards.map((c, i) => <View key={c.key} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: i === page ? colors.primary : colors.dot }} />)}</View>

        <Text style={{ textAlign: 'center', color: colors.text, fontSize: 17, marginTop: 18 }}>Share workout</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 14 }} contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'flex-start' }}>
          <ShareBtn label="Background" onPress={() => setBgSheet(true)} bg={colors.black}>
            <Svg width={30} height={30}>{[0, 8, 16].map((d) => <Line key={d} x1={2 + d} y1={28} x2={14 + d} y2={2} stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />)}</Svg>
          </ShareBtn>
          <View style={{ width: 1, height: 64, backgroundColor: colors.border, marginHorizontal: 4 }} />
          <ShareBtn label="Stories" onPress={() => shareImage('stories')} bg="transparent">
            <Svg width={57} height={57} style={{ position: 'absolute' }}>
              <Defs><LinearGradient id="ig" x1="0" y1="1" x2="1" y2="0"><Stop offset="0" stopColor="#FEDA75" /><Stop offset="0.35" stopColor="#FA7E1E" /><Stop offset="0.65" stopColor="#D62976" /><Stop offset="1" stopColor="#4F5BD5" /></LinearGradient></Defs>
              <Rect width={57} height={57} rx={28.5} fill="url(#ig)" />
            </Svg>
            <Ionicons name="logo-instagram" size={30} color="#fff" />
          </ShareBtn>
          <ShareBtn label="More" onPress={() => shareImage('more')}><Ionicons name="share-outline" size={26} color={colors.text} /></ShareBtn>
          <ShareBtn label="Copy Text" onPress={() => { track('card_shared', { card, target: 'copy_text' }); Clipboard.setStringAsync(text).then(() => st.showToast('Copied!')).catch(() => {}); }}><Ionicons name="copy-outline" size={24} color={colors.text} /></ShareBtn>
          <ShareBtn label="Download" onPress={download}><Ionicons name="download-outline" size={26} color={colors.text} /></ShareBtn>
          <ShareBtn label="Send to AI" onPress={() => { track('card_shared', { card, target: 'ai' }); Share.share({ message: aiText }).catch(() => {}); }}><Ionicons name="sparkles-outline" size={24} color={colors.text} /></ShareBtn>
          <ShareBtn label="Twitter" onPress={() => { track('card_shared', { card, target: 'x' }); Linking.openURL(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`).catch(() => {}); }} bg="#000"><Ionicons name="logo-x" size={26} color="#fff" /></ShareBtn>
        </ScrollView>

        <View style={{ flex: 1 }} />
        <View style={{ paddingHorizontal: 18, paddingBottom: 8 }}><Btn title="Done" onPress={() => router.dismissTo('/')} testID="done-btn" style={{ minHeight: 50 }} /></View>
      </View>
      <Confetti run={party} />
      <Sheet visible={bgSheet} onClose={() => setBgSheet(false)} title="Pick a background">
        <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 16 }}>
          {(['light', 'dark', 'transparent'] as Bg[]).map((b) => (
            <Pressable key={b} onPress={() => { setBg(b); setBgSheet(false); }} style={{ alignItems: 'center', gap: 8 }} testID={`bg-${b}`}>
              <View style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', borderWidth: bg === b ? 3 : 1, borderColor: bg === b ? colors.primary : colors.border, backgroundColor: b === 'transparent' ? undefined : THEMES[b].bg }}>
                {b === 'transparent' && <Checker w={52} h={52} />}
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, textTransform: 'capitalize' }}>{b}</Text>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </Screen>
  );
}
