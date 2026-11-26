import { Ionicons } from '@expo/vector-icons';
import { type Href, router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, ScrollView, type ScrollViewInstance, View } from 'react-native';
import { useSafeAreaFrame } from 'react-native-safe-area-context';
import { PlainText as RawText, Text, TextInput } from '../../components/Text';
import { Dialog, Screen } from '../../components/ui';
import { track } from '../../lib/analytics';
import { useChallenges } from '../../lib/challenges';
import {
  type Action, type Btn, type Card, type CoachState, type Ctx, type Draft, L, askAI, baseChips, clearCoach, dailyAlert, getCoach, greet, planDayCard,
  pushMsg, reply, resolveName, setCoach, swapList, useCoach, workoutSummary, WORKOUT_INTENTS, asksWorkout, soreCheck,
} from '../../lib/coach';
import { COACH_DAILY_LIMIT } from '../../lib/constants';
import { dayEntries, dayExercises, dayKeyOf, presetEntries, presetExercises, presetOf, setG, useG, workoutTitle } from '../../lib/gplan';
import { readiness, useHealth } from '../../lib/health';
import { getLang, tr } from '../../lib/i18n';
import { useKeyboardHeight } from '../../lib/keyboard';
import { isSample } from '../../lib/sampleWorkouts';
import { dayKey } from '../../lib/stats';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { todayPlan } from '../../lib/today';
import type { CoachProfile, SavedEntry } from '../../lib/types';

/** Aba Coach: conversa com o Coach Reps (respostas locais + IA com consentimento e limite diário, ver `lib/coach.ts`). */

const COACH = '#8E5CF6';
/** Ditado por voz: só na web (Web Speech API). No celular o teclado já tem o microfone; módulo nativo exigiria build novo. */
type Rec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
const SpeechRec: (new () => Rec) | null = Platform.OS === 'web' && typeof window !== 'undefined' ? ((window as unknown as Record<string, new () => Rec>).SpeechRecognition ?? (window as unknown as Record<string, new () => Rec>).webkitSpeechRecognition ?? null) : null;

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
  const [listening, setListening] = useState(false);
  const [gap, setGap] = useState(0); // o que fica abaixo do chat (barra de abas): o teclado cobre isso antes de chegar no campo
  const list = useRef<ScrollViewInstance>(null);
  const root = useRef<React.ComponentRef<typeof View>>(null);
  const rec = useRef<Rec | null>(null);

  const ready = hv.hasData && !hv.isSample ? readiness(hv.days) : null; // dados de exemplo não entram na conversa
  const profile: CoachProfile = st.wprefs.coach ?? {};
  const ctx: Ctx = {
    name: (st.profile.displayName?.trim() || st.profile.username || '').split(' ')[0], units: st.profile.units, workouts: st.workouts.filter((w) => !isSample(w.id)), routines: st.routines,
    trainer: st.trainer, active: st.active, weeklyGoal: st.wprefs.weeklyGoal, find: st.findExercise, prev: st.previousSets,
    sleepMin: ready?.today.sleepMin, readiness: ready?.score ?? null, g, ch, profile, all: st.allExercises,
    health: ready ? { sleepMin: ready.today.sleepMin, restingHr: ready.today.restingHr, hrv: ready.today.hrv, steps: ready.today.steps } : undefined,
  };
  const live = useRef({ ctx, mem: cs.mem });
  useEffect(() => { live.current = { ctx, mem: cs.mem }; });

  const saveProfile = (patch: Partial<CoachProfile>) => st.setWprefs({ coach: { ...live.current.ctx.profile, ...patch } });
  const addNotes = (notes: string[]) => {
    const cur = live.current.ctx.profile.notes ?? [];
    const next = [...cur, ...notes.filter((n) => !cur.includes(n))].slice(-20);
    saveProfile({ notes: next });
  };

  /** O Coach "digita" e solta as mensagens uma a uma. */
  const say = (drafts: Draft[], then?: () => void) => {
    if (!drafts.length) return then?.();
    setTyping(true);
    drafts.forEach((d, i) => setTimeout(() => {
      pushMsg('coach', d);
      if (i === drafts.length - 1) { setTyping(false); then?.(); }
    }, 550 + i * 750));
  };

  const start = (entries: SavedEntry[], title: string) => {
    if (!entries.length) return st.showToast('No exercises match your equipment.');
    st.startWorkout({ entries, title });
    router.push('/active');
  };
  const exec = (a: Action) => {
    const { ctx: c, mem } = live.current;
    track('coach_action', { type: a.t });
    if (a.t === 'resume') return router.push('/active');
    if (a.t === 'nav') return router.navigate(a.to as Href);
    if (a.t === 'say') return send(a.text);
    if (a.t === 'consent') return consent(a.ok);
    if (a.t === 'regen') {
      const key = dayKeyOf(a.planId, a.day);
      setG((s) => { const custom = { ...s.custom }; delete custom[key]; const swapped = { ...s.swapped }; delete swapped[key]; return { custom, swapped, seeds: { ...s.seeds, [key]: (s.seeds[key] ?? 0) + 1 } }; });
      // espera a tela redesenhar com o estado novo do plano para montar o cartão
      setTimeout(() => { const card = planDayCard(live.current.ctx); say([{ text: L('Done: same muscles, other exercises.', 'Pronto: mesmos músculos, outros exercícios.'), card: card ?? undefined }]); }, 120);
      return;
    }
    if (a.t === 'gday') {
      const ex = dayExercises(c.g, a.planId, a.day, c.all, c.find);
      if (!ex.length) return st.showToast('No exercises match your equipment.');
      setG({ pending: { planId: a.planId, day: a.day, at: new Date().toISOString() } });
      return start(dayEntries(c.g, a.planId, ex), workoutTitle(a.planId, a.day));
    }
    if (a.t === 'preset') { const ex = presetExercises(c.g, a.id, c.all, c.find); return start(presetEntries(c.g, a.id, ex), tr(presetOf(a.id).title)); }
    if (a.t === 'custom') {
      const found = a.items.flatMap((x) => { const e = resolveName(c.all, x.name); return e ? [{ e, x }] : []; });
      if (found.length < a.items.length) st.showToast(L(`${a.items.length - found.length} exercise(s) not found in the library were left out.`, `${a.items.length - found.length} exercício(s) que não achei na biblioteca ficaram de fora.`));
      return start(found.map(({ e, x }) => ({ exerciseId: e.id, notes: '', restSec: 90, superset: null, sets: Array.from({ length: x.sets }, () => ({ type: 'normal' as const, kg: null, reps: x.reps })) })), a.title);
    }
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
  const NO_START = ['nav', 'resume', 'regen', 'consent', 'say'];
  const run = (a: Action) => (!NO_START.includes(a.t) && live.current.ctx.active ? setAsk(a) : exec(a));

  /** Resposta da IA para `q` (a pergunta já está na conversa). Sem resposta: vale a local. */
  const aiAnswer = (q: string) => {
    setTyping(true);
    // a mensagem de permissão não vai para a IA (a conversa tem de terminar na pergunta)
    const msgs = getCoach().msgs.filter((x) => !x.buttons?.some((b) => b.act.t === 'consent'));
    askAI(msgs, live.current.ctx, live.current.mem).then((r) => {
      setTyping(false);
      const day = dayKey(new Date());
      if (r.ok) {
        track('coach_ai', { result: 'ok' });
        pushMsg('coach', { text: r.text, buttons: r.buttons.length ? r.buttons : undefined });
        // dor relatada há mais de 6 h: o treino veio completo; pergunta se ainda dói
        const chk = asksWorkout(q) ? soreCheck(live.current.mem) : null;
        if (chk) pushMsg('coach', chk);
        if (r.remember.length) { addNotes(r.remember); pushMsg('coach', { text: L(`Noted: ${r.remember.join('; ')}.`, `Anotado: ${r.remember.join('; ')}.`) }); }
        if (r.remaining != null) setCoach({ ai: { day, remaining: r.remaining, limit: r.limit ?? COACH_DAILY_LIMIT } });
        return;
      }
      track('coach_ai', { result: r.reason });
      if (r.reason === 'limit') {
        const lim = r.limit ?? COACH_DAILY_LIMIT;
        setCoach({ ai: { day, remaining: 0, limit: lim } });
        return say([{ text: L(`You used today's ${lim} AI questions. They reset tomorrow; until then I answer with the quick replies below.`, `Você usou as ${lim} perguntas de IA de hoje. Amanhã renova; até lá eu respondo com os atalhos abaixo.`) }]);
      }
      say(reply(q, live.current.ctx, live.current.mem).msgs);
    });
  };
  const consent = (ok: boolean) => {
    saveProfile({ aiOk: ok });
    track('coach_ai_consent', { ok });
    const q = getCoach().pendingAsk;
    setCoach({ pendingAsk: undefined });
    if (ok) { if (q) aiAnswer(q); else say([{ text: L('AI answers are on. Ask me anything about training.', 'IA ligada. Pode perguntar qualquer coisa de treino.') }]); return; }
    say([{ text: L('All right, I keep to the quick answers. You can change this in Coach settings.', 'Tudo bem, fico nas respostas rápidas. Dá para mudar em Ajustes do Coach.') }, ...(q ? reply(q, live.current.ctx, live.current.mem).msgs : [])]);
  };

  // proativo: abertura do dia, resumo do treino salvo e um aviso por dia
  useEffect(() => {
    if (!cs.ready || !st.ready) return;
    const c = live.current.ctx, m = live.current.mem;
    const day = dayKey(new Date());
    const drafts: Draft[] = [];
    const patch: Partial<CoachState> = {};
    if (cs.greeted !== day) { patch.greeted = day; drafts.push(...greet(c, m)); }
    const latest = c.workouts.find((w) => !w.pending);
    if (latest && latest.id !== cs.summarized) {
      patch.summarized = latest.id;
      const recent = Date.now() - new Date(latest.date).getTime() < 2 * 86400000;
      if (cs.summarized !== undefined && recent) drafts.push(workoutSummary(c, latest)); // na 1ª vez só marca (não resume treino antigo)
    }
    if (cs.alerted !== day && (patch.greeted || cs.greeted === day)) { patch.alerted = day; const a = dailyAlert(c, m); if (a) drafts.push(a); }
    if (!Object.keys(patch).length) return;
    setCoach(patch);
    // fora do efeito (o "digitando" é estado); sem cancelar: o efeito roda de novo com o patch e não pode apagar as mensagens
    setTimeout(() => say(drafts), 0);
  }, [cs.ready, cs.greeted, cs.summarized, cs.alerted, st.ready, st.workouts]);

  const send = (raw: string) => {
    const msg = raw.trim();
    if (!msg || typing) return;
    setText('');
    setChips(null);
    pushMsg('me', { text: msg });
    const out = reply(msg, live.current.ctx, live.current.mem);
    track('coach_message', { intent: out.intent });
    setCoach({ mem: out.mem });
    if (out.remember?.length) addNotes(out.remember);
    const local = (extra: Draft[] = []) => say([...out.msgs, ...extra], () => {
      setChips(out.chips ?? null);
      if (out.run) { const a = out.run; setTimeout(() => run(a), 500); }
    });
    const chk = WORKOUT_INTENTS.includes(out.intent) ? soreCheck(out.mem) : null;
    if (out.intent !== 'unknown') return local(chk ? [chk] : []);
    // assunto que o Coach local não conhece: IA, com a permissão da pessoa
    const ok = live.current.ctx.profile.aiOk;
    if (ok === false) return local([{ text: L('Free questions use AI, which is off. You can turn it on in Coach settings.', 'Perguntas livres usam a IA, que está desligada. Dá para ligar em Ajustes do Coach.'), buttons: [{ label: L('Coach settings', 'Ajustes do Coach'), act: { t: 'nav', to: '/settings/coach-ai' } }] }]);
    if (ok === undefined) {
      setCoach({ pendingAsk: msg });
      return say([{
        text: L(`That one needs the AI. To answer, I send your question, the last messages and a summary of your training (and sleep and recovery, if you have a watch connected) to Anthropic's AI. Your email is not sent. Up to ${COACH_DAILY_LIMIT} questions a day. Allow it?`,
          `Essa precisa da IA. Para responder, eu mando a sua pergunta, as últimas mensagens e um resumo dos seus treinos (e do sono e da recuperação, se houver relógio conectado) para a IA da Anthropic. Seu e-mail não vai. São até ${COACH_DAILY_LIMIT} perguntas por dia. Permite?`),
        buttons: [{ label: L('Allow', 'Permitir'), act: { t: 'consent', ok: true } }, { label: L('Not now', 'Agora não'), act: { t: 'consent', ok: false } }],
      }]);
    }
    aiAnswer(msg);
  };
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; });

  const listen = () => {
    if (!SpeechRec) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new SpeechRec();
    r.lang = getLang() === 'pt' ? 'pt-BR' : 'en-US';
    r.interimResults = true;
    r.onresult = (e) => {
      let t = '';
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setText(t);
      if (e.results[e.results.length - 1].isFinal) { r.stop(); setTimeout(() => sendRef.current(t), 200); }
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  };

  const measure = () => root.current?.measureInWindow((_x: number, y: number, _w: number, h: number) => { const v = Math.max(0, Math.round(frame.height - (y + h))); setGap((g) => (g === v ? g : v)); });
  useEffect(() => { const t = setTimeout(measure, 0); return () => clearTimeout(t); });
  const toEnd = (animated = true) => list.current?.scrollToEnd({ animated });
  useEffect(() => { const t = setTimeout(() => toEnd(), 60); return () => clearTimeout(t); }, [kb, typing, cs.msgs.length]);

  const n = ctx.workouts.length;
  const todayKey = dayKey(new Date());
  const aiLeft = cs.ai?.day === todayKey ? cs.ai : null;
  const status = aiLeft && profile.aiOk
    ? L(`online · AI: ${aiLeft.remaining} of ${aiLeft.limit} left today`, `online · IA: ${aiLeft.remaining} de ${aiLeft.limit} hoje`)
    : n === 0 ? L('online · ready for your first workout', 'online · pronto para o seu primeiro treino') : L(`online · knows your ${n} workout${n === 1 ? '' : 's'}`, `online · conhece ${n === 1 ? 'o seu treino' : `os seus ${n} treinos`}`);
  const shown = chips ?? baseChips(ctx);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const canSend = !!text.trim() && !typing;
  const showMic = !!SpeechRec && !text.trim();

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
          <Pressable onPress={() => setWipe(true)} hitSlop={8} testID="coach-clear" accessibilityLabel="Clear conversation" style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="trash-outline" size={21} color={colors.muted} />
          </Pressable>
        )}
        <Pressable onPress={() => router.push('/settings/coach-ai')} hitSlop={8} testID="coach-settings" accessibilityLabel="Coach settings" style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={22} color={colors.muted} />
        </Pressable>
      </View>

      <View ref={root} onLayout={measure} style={{ flex: 1, paddingBottom: Math.max(0, kb - gap) }}>
        <ScrollView ref={list} keyboardShouldPersistTaps="handled" onContentSizeChange={() => toEnd(false)} contentContainerStyle={{ padding: 16, gap: 8 }} testID="coach-messages">
          {cs.msgs.map((m) => {
            const old = m.at < todayStart;
            return (
              <View key={m.id} testID={m.from === 'me' ? 'coach-msg-me' : 'coach-msg'} style={{ alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start', maxWidth: '86%', backgroundColor: m.from === 'me' ? colors.primary : colors.surface, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderBottomRightRadius: m.from === 'me' ? 5 : 18, borderBottomLeftRadius: m.from === 'me' ? 18 : 5, gap: 10 }}>
                <Rich text={m.text} color={m.from === 'me' ? colors.onPrimary : colors.text} />
                {!!m.card && <CardRow card={m.card} old={old} onPress={() => run(m.card!.act)} />}
                {!!m.buttons?.length && <Buttons list={m.buttons} old={old} onPress={run} />}
              </View>
            );
          })}
          {typing && (
            <View testID="coach-typing" style={{ alignSelf: 'flex-start', backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 18, borderBottomLeftRadius: 5 }}>
              <Dots />
            </View>
          )}
        </ScrollView>

        {/* Atalhos: o primeiro em destaque */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 8 }}>
          {shown.map((c, i) => (
            <Pressable key={c} onPress={() => send(c)} disabled={typing} testID={`coach-chip-${i}`} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: i === 0 ? colors.primary : colors.surface, opacity: typing ? 0.5 : 1 }}>
              <RawText style={{ color: i === 0 ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{c}</RawText>
            </Pressable>
          ))}
        </ScrollView>

        {/* Campo da conversa (com microfone na web) */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 }}>
          <TextInput
            value={text} onChangeText={setText} placeholder={listening ? 'Listening…' : 'Message Coach Reps'} placeholderTextColor={colors.faint} multiline rows={1} testID="coach-input"
            onFocus={() => setTimeout(() => toEnd(), 250)}
            onKeyPress={(e: any) => { if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) { e.preventDefault(); send(text); } }}
            style={{ flex: 1, minHeight: 46, maxHeight: 120, backgroundColor: colors.surface, borderRadius: 23, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 12, fontSize: 16, color: colors.text }} />
          {showMic ? (
            <Pressable onPress={listen} testID="coach-mic" accessibilityLabel={listening ? 'Stop listening' : 'Speak'} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: listening ? colors.danger : colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={listening ? 'stop' : 'mic'} size={22} color={listening ? '#fff' : colors.primary} />
            </Pressable>
          ) : (
            <Pressable onPress={() => send(text)} disabled={!canSend} testID="coach-send" accessibilityLabel="Send" style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: canSend ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-up" size={22} color={canSend ? colors.onPrimary : colors.faint} />
            </Pressable>
          )}
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

/** Cartão de treino: ícone, título, resumo e a lista dos exercícios. */
function CardRow({ card, old, onPress }: { card: Card; old: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={old} testID="coach-card" style={{ backgroundColor: colors.bg, borderRadius: radius.md, padding: 10, minWidth: 230, gap: 8, opacity: old ? 0.5 : 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 }}>
        <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={card.icon as keyof typeof Ionicons.glyphMap} size={19} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <RawText style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{card.title}</RawText>
          <RawText style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{card.sub}</RawText>
        </View>
        {!old && <Ionicons name="play-circle" size={26} color={colors.primary} />}
      </View>
      {!!card.lines?.length && (
        <View style={{ gap: 3, paddingLeft: 46 }}>
          {card.lines.map((l, i) => <RawText key={i} style={{ color: colors.muted, fontSize: 13 }} numberOfLines={1}>{l}</RawText>)}
        </View>
      )}
    </Pressable>
  );
}

/** Botões que executam (versão curta, leve, cargas sugeridas, ajustes, permitir a IA…). */
function Buttons({ list, old, onPress }: { list: Btn[]; old: boolean; onPress: (a: Action) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {list.map((b, i) => (
        <Pressable key={`${b.label}-${i}`} onPress={() => onPress(b.act)} disabled={old} testID={`coach-btn-${i}`}
          style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12, borderRadius: radius.pill, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, opacity: old ? 0.5 : 1 }}>
          <RawText style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }} numberOfLines={1}>{b.label}</RawText>
        </Pressable>
      ))}
    </View>
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
