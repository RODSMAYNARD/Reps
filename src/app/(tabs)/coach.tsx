import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, Text as RawText, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { Text, TextInput } from '../../components/Text';
import { Dialog, Screen } from '../../components/ui';
import { track } from '../../lib/analytics';
import { useChallenges } from '../../lib/challenges';
import { type Action, type Card, type Ctx, type Draft, L, askAI, baseChips, clearCoach, getCoach, greet, pushMsg, reply, setCoach, swapList, useCoach } from '../../lib/coach';
import { useG } from '../../lib/gplan';
import { readiness, useHealth } from '../../lib/health';
import { useKeyboardHeight } from '../../lib/keyboard';
import { dayKey } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { todayPlan } from '../../lib/today';

/** Aba Coach: um espaço só para conversar com o Coach Reps (respostas montadas no aparelho, ver `lib/coach.ts`). */

const COACH = '#8E5CF6';

export default function CoachTab() {
  const st = useStore();
  const uid = st.session?.user.id ?? null;
  const cs = useCoach(uid);
  const g = useG(uid);
  const ch = useChallenges(uid);
  const hv = useHealth();
  const kb = useKeyboardHeight();
  const frame = useSafeAreaFrame();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [chips, setChips] = useState<string[] | null>(null);
  const [ask, setAsk] = useState<Action | null>(null);
  const [wipe, setWipe] = useState(false);
  const [gap, setGap] = useState(0); // o que fica abaixo do chat (barra de abas): o teclado cobre isso antes de chegar no campo
  const list = useRef<ScrollViewInstance>(null);
  const root = useRef<React.ComponentRef<typeof View>>(null);

  const ready = hv.hasData && !hv.isSample ? readiness(hv.days) : null; // dados de exemplo não entram na conversa
  const ctx: Ctx = {
    name: (st.profile.displayName?.trim() || st.profile.username || '').split(' ')[0], units: st.profile.units, workouts: st.workouts, routines: st.routines,
    trainer: st.trainer, active: st.active, weeklyGoal: st.wprefs.weeklyGoal, find: st.findExercise, prev: st.previousSets,
    sleepMin: ready?.today.sleepMin, readiness: ready?.score ?? null, g, ch,
  };
  const live = useRef({ ctx, mem: cs.mem });
  useEffect(() => { live.current = { ctx, mem: cs.mem }; });

  const exec = (a: Action) => {
    const { ctx: c, mem } = live.current;
    track('coach_action', { type: a.t });
    if (a.t === 'resume') return router.push('/active');
    if (a.t === 'nav') return router.navigate(a.to as Href);
    if (a.t === 'trainer') st.startTrainerWorkout(a.uid);
    else if (a.t === 'routine') { const r = c.routines.find((x) => x.id === a.id); if (!r) return st.showToast('This routine no longer exists.'); st.startWorkout({ routine: r }); }
    else if (a.t === 'entries') st.startWorkout({ entries: a.entries, title: a.title, trainerUid: a.trainerUid });
    else {
      const p = todayPlan(c.trainer, c.routines);
      if (p.trainerUid) st.startTrainerWorkout(p.trainerUid); else st.startWorkout({ routine: p.routine });
      // trocas combinadas no chat: entram como "Swapped today" (só neste treino)
      swapList(c, mem).forEach(([i, id]) => st.swapEntry(i, id));
    }
    router.push('/active');
  };
  /** Começar outro treino com um já em andamento pergunta antes (igual à Home). */
  const run = (a: Action) => (a.t !== 'nav' && a.t !== 'resume' && live.current.ctx.active ? setAsk(a) : exec(a));

  /** O Coach "digita" e solta as mensagens uma a uma. */
  const say = (drafts: Draft[], then?: () => void) => {
    if (!drafts.length) return then?.();
    setTyping(true);
    drafts.forEach((d, i) => setTimeout(() => {
      pushMsg('coach', d);
      if (i === drafts.length - 1) { setTyping(false); then?.(); }
    }, 550 + i * 750));
  };

  // abertura do dia (uma vez por dia)
  useEffect(() => {
    if (!cs.ready || !st.ready) return;
    const day = dayKey(new Date());
    if (cs.greeted === day) return;
    setCoach({ greeted: day });
    say(greet(live.current.ctx, live.current.mem));
  }, [cs.ready, cs.greeted, st.ready]);

  const send = (raw: string) => {
    const msg = raw.trim();
    if (!msg || typing) return;
    setText('');
    setChips(null);
    pushMsg('me', { text: msg });
    const out = reply(msg, live.current.ctx, live.current.mem);
    track('coach_message', { intent: out.intent });
    setCoach({ mem: out.mem });
    const local = () => say(out.msgs, () => {
      setChips(out.chips ?? null);
      if (out.run) { const a = out.run; setTimeout(() => run(a), 500); }
    });
    if (out.intent !== 'unknown') return local();
    // assunto que o Coach local não conhece: pergunta para a IA; se ela não responder, vale a resposta local
    setTyping(true);
    askAI(getCoach().msgs, live.current.ctx, out.mem).then((answer) => {
      if (!answer) return local();
      pushMsg('coach', { text: answer });
      setTyping(false);
    });
  };

  const measure = () => root.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => { const v = Math.max(0, Math.round(frame.height - (y + h))); setGap((g) => (g === v ? g : v)); });
  useEffect(() => { const t = setTimeout(measure, 0); return () => clearTimeout(t); });
  const toEnd = (animated = true) => list.current?.scrollToEnd({ animated });
  useEffect(() => { const t = setTimeout(() => toEnd(), 60); return () => clearTimeout(t); }, [kb, typing, cs.msgs.length]);

  const n = st.workouts.length;
  const status = n === 0 ? L('online · ready for your first workout', 'online · pronto para o seu primeiro treino') : L(`online · knows your ${n} workout${n === 1 ? '' : 's'}`, `online · conhece ${n === 1 ? 'o seu treino' : `os seus ${n} treinos`}`);
  const shown = chips ?? baseChips(ctx);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const canSend = !!text.trim() && !typing;

  return (
    <Screen edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: COACH, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="sparkles" size={21} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Coach Reps</Text>
          <RawText style={{ fontSize: 13, color: colors.muted }} numberOfLines={1}>{status}</RawText>
        </View>
        {!!cs.msgs.length && (
          <Pressable onPress={() => setWipe(true)} hitSlop={8} testID="coach-clear" accessibilityLabel="Clear conversation" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={21} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View ref={root} onLayout={measure} style={{ flex: 1, paddingBottom: Math.max(0, kb - gap) }}>
        <ScrollView ref={list} keyboardShouldPersistTaps="handled" onContentSizeChange={() => toEnd(false)} contentContainerStyle={{ padding: 16, gap: 8 }} testID="coach-messages">
          {cs.msgs.map((m) => (
            <View key={m.id} testID={m.from === 'me' ? 'coach-msg-me' : 'coach-msg'} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: m.from === 'me' ? colors.primary : colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: m.from === 'me' ? 5 : 18, borderBottomLeftRadius: m.from === 'me' ? 18 : 5, gap: 10 }}>
              <Rich text={m.text} color={m.from === 'me' ? colors.onPrimary : colors.text} />
              {!!m.card && <CardRow card={m.card} old={m.at < todayStart} onPress={() => run(m.card!.act)} />}
            </View>
          ))}
          {typing && (
            <View testID="coach-typing" style={{ alignSelf: 'flex-start', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderBottomLeftRadius: 5 }}>
              <Dots />
            </View>
          )}
        </ScrollView>

        {/* Atalhos: o primeiro em destaque, como no card "Coach conversa" */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
          {shown.map((c, i) => (
            <Pressable key={c} onPress={() => send(c)} disabled={typing} testID={`coach-chip-${i}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: i === 0 ? colors.primary : colors.surface, opacity: typing ? 0.5 : 1 }}>
              <RawText style={{ color: i === 0 ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{c}</RawText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Campo da conversa */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 }}>
          <TextInput
            value={text} onChangeText={setText} placeholder="Message Coach Reps" placeholderTextColor={colors.faint} multiline rows={1} testID="coach-input"
            onFocus={() => setTimeout(() => toEnd(), 250)}
            onKeyPress={(e: any) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); send(text); } }}
            style={{ flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: colors.surface, borderRadius: 23, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.text }} />
          <Pressable onPress={() => send(text)} disabled={!canSend} testID="coach-send" accessibilityLabel="Send" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: canSend ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-up" size={22} color={canSend ? colors.onPrimary : colors.faint} />
          </Pressable>
        </View>
      </View>

      <Dialog visible={!!ask} title="A workout is already in progress" message="Discard the current workout and start a new one?" onClose={() => setAsk(null)}
        actions={[{ label: 'Back to workout', onPress: () => { setAsk(null); router.push('/active'); } }, { label: 'Discard and start', danger: true, onPress: () => { const a = ask; setAsk(null); st.discardActive(); if (a) exec(a); } }]} />
      <Dialog visible={wipe} title="Clear this conversation?" message="The messages are deleted from this device. Your workouts are not affected." onClose={() => setWipe(false)}
        actions={[{ label: 'Cancel' }, { label: 'Clear', danger: true, onPress: () => { setWipe(false); setChips(null); clearCoach(); } }]} />
    </Screen>
  );
}

/** Texto da mensagem com **negrito**. Usa o Text puro: a conversa já está no idioma do usuário e não passa pelo dicionário. */
function Rich({ text, color }: { text: string; color: string }) {
  return (
    <RawText style={{ color, fontSize: 16, lineHeight: 22 }}>
      {text.split('**').map((part, i) => (i % 2 ? <RawText key={i} style={{ fontWeight: '700' }}>{part}</RawText> : part))}
    </RawText>
  );
}

function CardRow({ card, old, onPress }: { card: Card; old: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={old} testID="coach-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, minHeight: 56, minWidth: 230, opacity: old ? 0.5 : 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={card.icon as keyof typeof Ionicons.glyphMap} size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <RawText style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{card.title}</RawText>
        <RawText style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{card.sub}</RawText>
      </View>
      {!old && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
}

/** Três pontinhos pulsando enquanto o Coach "digita". */
function Dots() {
  const [v] = useState(() => [0, 1, 2].map(() => new Animated.Value(0.3)));
  useEffect(() => {
    const loops = v.map((x, i) => Animated.loop(Animated.sequence([Animated.delay(i * 160), Animated.timing(x, { toValue: 1, duration: 320, useNativeDriver: true }), Animated.timing(x, { toValue: 0.3, duration: 320, useNativeDriver: true }), Animated.delay((2 - i) * 160)])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [v]);
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {v.map((x, i) => <Animated.View key={i} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.muted, opacity: x }} />)}
    </View>
  );
}
