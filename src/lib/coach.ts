import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { CAT_BY_ID, catKey, catName, norm } from './catalog';
import type { CState } from './challenges';
import { MUSCLE_GROUPS, PROGRAMS } from './constants';
import { LB, fmtVolume, fmtWeight } from './format';
import { FOCUS, GPLANS, PRESETS, type GState, buildWorkout, dayExercises, focusLabel, planOf } from './gplan';
import { getLang, tr } from './i18n';
import { canonId, dayKey, startOfWeek, weeklySeries, workoutSets, workoutVolume } from './stats';
import { substitutesFor } from './substitutes';
import { supabase } from './supabase';
import { dayStreak, estMin, fromTemplate, todayPlan, type TodayPlan } from './today';
import type { ActiveWorkout, CoachProfile, Exercise, Routine, SavedEntry, SetRow, TrainerProgram, Units, Workout } from './types';

/**
 * Coach Reps (aba Coach). Duas camadas:
 * 1. Local (grátis, offline): `reply` reconhece o assunto por palavras-chave (inglês e português) e responde com os dados do app,
 *    com cartões e botões que executam (começar, versão curta/leve, cargas sugeridas, treino sob pedido, dia do plano, treino pronto).
 * 2. IA (Edge Function `coach`, só com o consentimento da pessoa e até N mensagens por dia): assuntos que o local não conhece.
 *    Volta texto + botões estruturados + fatos para lembrar.
 * Proativo: abertura do dia (com carga sugerida e ajuste pela recuperação), resumo depois de cada treino salvo e um aviso por dia
 * (volta depois de dias parado, desequilíbrio entre músculos, carga travada).
 * Os textos ficam aqui nos dois idiomas (`L`), fora do dicionário. A conversa fica só no aparelho (`reps:coach:<uid>`);
 * o perfil do Coach (tom, objetivo, memória, consentimento) fica em `wprefs.coach` e sincroniza.
 */
export const L = (en: string, pt: string) => (getLang() === 'pt' ? pt : en);

/** O que o cartão ou botão de uma mensagem faz ao ser tocado (precisa ser serializável: a conversa é salva). */
export type Action =
  | { t: 'today' } // treino de hoje, com as trocas combinadas no chat
  | { t: 'trainer'; uid: string }
  | { t: 'routine'; id: string }
  | { t: 'entries'; title: string; entries: SavedEntry[]; trainerUid?: string }
  | { t: 'resume' }
  | { t: 'nav'; to: string }
  | { t: 'gday'; planId: string; day: number } // dia do plano de 30 dias
  | { t: 'preset'; id: string } // treino pronto da aba Treinamento
  | { t: 'regen'; planId: string; day: number } // gerar de novo o dia do plano
  | { t: 'custom'; title: string; items: { name: string; sets: number; reps: number }[] } // treino desenhado pela IA
  | { t: 'consent'; ok: boolean } // permissão para usar a IA
  | { t: 'say'; text: string }; // manda uma mensagem pronta
export type Btn = { label: string; act: Action };
export type Card = { icon: string; title: string; sub: string; act: Action; lines?: string[] };
export type Msg = { id: string; from: 'coach' | 'me'; text: string; card?: Card; buttons?: Btn[]; at: number };
export type Draft = { text: string; card?: Card; buttons?: Btn[] };
export type Memory = {
  pending?: 'sore' | 'swap' | 'swapPick';
  swapFrom?: string;
  swapOpts?: { id: string; name: string }[];
  /** Trocas combinadas para o treino de hoje: exercício original → novo. Valem só no dia `swapsDay`. */
  swaps?: Record<string, string>;
  swapsDay?: string;
  /** Última dor relatada: grupo (ou 'all' = o corpo todo) e quando. Depois de 6 h o Coach pergunta se ainda dói; depois de 4 dias esquece. */
  sore?: { where: string; at: number };
};
export type CoachState = {
  msgs: Msg[]; mem: Memory; greeted: string; ready: boolean;
  /** Último treino que já ganhou resumo. */
  summarized?: string;
  /** Dia do último aviso proativo (no máximo um por dia). */
  alerted?: string;
  /** Pergunta esperando a pessoa permitir a IA. */
  pendingAsk?: string;
  /** Mensagens de IA que ainda restam hoje (vem do servidor). */
  ai?: { day: string; remaining: number; limit: number };
};

export type HealthToday = { sleepMin?: number; restingHr?: number; hrv?: number; steps?: number };
export type Ctx = {
  name: string; units: Units; workouts: Workout[]; routines: Routine[]; trainer: TrainerProgram | null; active: ActiveWorkout | null;
  weeklyGoal: number; find: (id: string) => Exercise | undefined; prev: (id: string) => SetRow[];
  sleepMin?: number; readiness?: number | null; g: GState; ch: CState;
  /** Perfil do Coach (tom, objetivo, memória, consentimento). */
  profile: CoachProfile;
  /** Todos os exercícios (biblioteca + catálogo), para montar treinos. */
  all: Exercise[];
  health?: HealthToday;
};
/** `remember`: fatos que a pessoa pediu para guardar (vão para `wprefs.coach.notes`). */
export type Out = { msgs: Draft[]; chips?: string[]; mem: Memory; run?: Action; intent: string; remember?: string[] };

// ---------- estado (só no aparelho) ----------
const EMPTY: CoachState = { msgs: [], mem: {}, greeted: '', ready: false };
let uid: string | null = null;
let state: CoachState = EMPTY;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
let seq = 0;

export function setCoach(patch: Partial<CoachState> | ((s: CoachState) => Partial<CoachState>)) {
  state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
  if (state.msgs.length > 80) state = { ...state, msgs: state.msgs.slice(-80) };
  emit();
  if (uid) {
    AsyncStorage.setItem(`reps:coach:${uid}`, JSON.stringify({ ...state, ready: undefined })).catch(() => {});
  }
}
export const pushMsg = (from: Msg['from'], d: Draft) => setCoach((s) => ({ msgs: [...s.msgs, { id: `${Date.now()}-${seq++}`, from, text: d.text, card: d.card, buttons: d.buttons, at: Date.now() }] }));
export const getCoach = () => state;
export const clearCoach = () => setCoach({ msgs: [], mem: {}, greeted: '', pendingAsk: undefined });

export function useCoach(userId: string | null) {
  useEffect(() => {
    if (userId === uid) return;
    uid = userId; state = EMPTY; emit();
    if (!userId) return;
    AsyncStorage.getItem(`reps:coach:${userId}`).then((raw) => {
      if (uid !== userId) return;
      let saved: Partial<CoachState> = {};
      try { if (raw) saved = JSON.parse(raw); } catch { /* cópia estragada: começa do zero */ }
      state = { ...EMPTY, ...saved, ready: true };
      // conversas de antes da dor ter data: acha a última dor relatada nos últimos 4 dias
      if (!state.mem.sore) {
        const last = [...state.msgs].reverse().find((x) => x.from === 'me' && Date.now() - x.at < 96 * 3600000 && /dolorid|doendo|dores?|sore/.test(norm(x.text)) && !/passou|sem dor|not sore/.test(norm(x.text)));
        if (last) state = { ...state, mem: { ...state.mem, sore: { where: groupIn(norm(last.text)) ?? 'all', at: last.at } } };
      }
      emit();
    }).catch(() => { if (uid === userId) { state = { ...EMPTY, ready: true }; emit(); } });
  }, [userId]);
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
}

// ---------- treino de hoje ----------
const today = () => dayKey(new Date());
const swapsOf = (m: Memory) => (m.swapsDay === today() ? m.swaps ?? {} : {});
const nameOf = (c: Ctx, id: string) => c.find(id)?.name ?? L('exercise', 'exercício');
const sub = (n: number, min: number) => L(`${n} exercises · ~${min} min`, `${n} exercícios · ~${min} min`);

const GROUP_EN: Record<string, string> = { Chest: 'chest', Back: 'back', Shoulders: 'shoulders', Arms: 'arms', Core: 'core', Legs: 'legs', 'Full body': 'full body', Cardio: 'cardio' };
const GROUP_PT: Record<string, string> = { Chest: 'peito', Back: 'costas', Shoulders: 'ombros', Arms: 'braços', Core: 'abdômen', Legs: 'pernas', 'Full body': 'corpo todo', Cardio: 'cardio' };
const groupName = (g: string) => (getLang() === 'pt' ? GROUP_PT[g] : GROUP_EN[g]) ?? g.toLowerCase();
const groupOf = (c: Ctx, id: string) => { const m = c.find(id)?.muscle ?? ''; return MUSCLE_GROUPS[m] ?? m; };

/** Parte das séries de cada grupo muscular (0 a 1). */
function shares(c: Ctx, entries: SavedEntry[]) {
  const out: Record<string, number> = {};
  let total = 0;
  entries.forEach((e) => { const g = groupOf(c, e.exerciseId); out[g] = (out[g] ?? 0) + e.sets.length; total += e.sets.length; });
  Object.keys(out).forEach((k) => { out[k] /= total || 1; });
  return out;
}
const focusText = (c: Ctx, entries: SavedEntry[]) => {
  const top = Object.entries(shares(c, entries)).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => groupName(g));
  return top.join(L(' and ', ' e '));
};

/** Treino de hoje com as trocas combinadas no chat já aplicadas (para mostrar e para versões curta/leve). */
export function planFor(c: Ctx, m: Memory): TodayPlan {
  const p = todayPlan(c.trainer, c.routines);
  const sw = swapsOf(m);
  return { ...p, entries: p.entries.map((e) => (sw[e.exerciseId] ? { ...e, exerciseId: sw[e.exerciseId], sets: e.sets.map((s) => ({ ...s, kg: null })) } : e)) };
}
/** Trocas na ordem dos exercícios do treino de hoje (índice → novo exercício), para aplicar depois de iniciar. */
export function swapList(c: Ctx, m: Memory): [number, string][] {
  const sw = swapsOf(m);
  return todayPlan(c.trainer, c.routines).entries.flatMap((e, i) => (sw[e.exerciseId] ? [[i, sw[e.exerciseId]] as [number, string]] : []));
}
const linesOf = (c: Ctx, entries: SavedEntry[]) => entries.slice(0, 6).map((e) => `${nameOf(c, e.exerciseId)} · ${e.sets.length}×${e.sets[0]?.reps ?? '?'}`);
const todayCard = (c: Ctx, m: Memory): Card => {
  if (c.active) return { icon: 'play', title: c.active.title || L('Workout', 'Treino'), sub: L('In progress · tap to resume', 'Em andamento · toque para voltar'), act: { t: 'resume' } };
  const p = planFor(c, m);
  return { icon: 'barbell', title: p.title, sub: sub(p.entries.length, p.minutes), act: { t: 'today' }, lines: linesOf(c, p.entries) };
};

const lighter = (kg: number | null, u: Units) => {
  if (!kg) return null;
  return u.weight === 'lbs' ? Math.max(5, Math.round((kg * LB * 0.8) / 5) * 5) / LB : Math.max(2.5, Math.round((kg * 0.8) / 2.5) * 2.5);
};
/** Versão leve: 2 séries por exercício com ~20% menos peso que da última vez. */
const lightCard = (c: Ctx, m: Memory): Card => {
  const p = planFor(c, m);
  const entries = p.entries.map((e) => {
    const last = c.prev(e.exerciseId).filter((s) => s.type !== 'warmup');
    return { ...e, sets: e.sets.filter((s) => s.type !== 'warmup').slice(0, 2).map((s, j) => { const l = last[Math.min(j, last.length - 1)]; return { ...s, kg: lighter(s.kg ?? l?.kg ?? null, c.units), reps: s.reps ?? l?.reps ?? null }; }) };
  });
  const title = `${p.title} ${L('Light', 'Leve')}`;
  return { icon: 'leaf', title, sub: sub(entries.length, estMin(entries.length * 2)), act: { t: 'entries', title, entries, trainerUid: p.trainerUid } };
};
/** Versão curta: os primeiros exercícios que cabem no tempo, descanso de até 60 s. */
const expressCard = (c: Ctx, m: Memory, minutes: number): Card => {
  const p = planFor(c, m);
  let n = 0, used = 0;
  for (const e of p.entries) { const t = e.sets.length * 2.3; if (n >= 2 && used + t > minutes) break; used += t; n++; }
  const entries = p.entries.slice(0, n).map((e) => ({ ...e, restSec: Math.min(e.restSec || 60, 60) }));
  const title = `${p.title} Express`;
  return { icon: 'flash', title, sub: sub(entries.length, minutes), act: { t: 'entries', title, entries, trainerUid: p.trainerUid } };
};
/** Botões de sempre embaixo do treino de hoje. */
const todayButtons = (c: Ctx, m: Memory): Btn[] => (c.active ? [] : [
  { label: L('With suggested loads', 'Com cargas sugeridas'), act: loadedCard(c, m).act },
  { label: L('30-min version', 'Versão 30 min'), act: expressCard(c, m, 30).act },
  { label: L('Light version', 'Versão leve'), act: lightCard(c, m).act },
]);

// ---------- progressão de carga ----------
/** Próxima carga (dupla progressão): bateu as reps-alvo em todas as séries da última vez → sobe o menor degrau; senão repete.
 * Recuperação baixa (< 50) → repete o peso. Sem histórico com peso → null. */
export function nextLoad(c: Ctx, id: string, target?: number | null): { kg: number; reps: number; up: boolean } | null {
  const last = c.prev(id).filter((s) => s.type !== 'warmup' && (s.kg ?? 0) > 0);
  if (!last.length) return null;
  const top = Math.max(...last.map((s) => s.kg ?? 0));
  const goal = target || Math.max(...last.map((s) => s.reps ?? 0)) || 8;
  const hit = last.every((s) => (s.reps ?? 0) >= goal);
  if (!hit || (c.readiness != null && c.readiness < 50)) return { kg: top, reps: goal, up: false };
  const eq = c.find(id)?.equipment;
  const step = c.units.weight === 'lbs' ? 5 / LB : eq === 'Dumbbell' || eq === 'Kettlebell' ? 2 : 2.5;
  return { kg: Math.round((top + step) * 100) / 100, reps: goal, up: true };
}
const lowRecovery = (c: Ctx) => c.readiness != null && c.readiness < 50;
/** Treino de hoje com a carga sugerida em cada série; com recuperação baixa tira uma série (mínimo 2). */
function loadedCard(c: Ctx, m: Memory): Card {
  const p = planFor(c, m);
  const entries = p.entries.map((e) => {
    const work = e.sets.filter((s) => s.type !== 'warmup');
    const nl = nextLoad(c, e.exerciseId, work[0]?.reps ?? null);
    const sets = lowRecovery(c) && work.length > 2 ? work.slice(0, work.length - 1) : work;
    return { ...e, sets: sets.map((s) => ({ ...s, kg: nl ? nl.kg : s.kg })) };
  });
  const title = p.title;
  return { icon: 'trending-up', title, sub: L('Suggested loads', 'Cargas sugeridas'), act: { t: 'entries', title, entries, trainerUid: p.trainerUid } };
}
/** "Supino 62,5 kg × 8 (+2,5)" dos primeiros exercícios do treino de hoje. */
function loadsText(c: Ctx, m: Memory, max = 3): string {
  const p = planFor(c, m);
  const step = (kg: number) => fmtWeight(kg, c.units).replace(/ (kg|lbs)$/, '');
  return p.entries.flatMap((e) => {
    const nl = nextLoad(c, e.exerciseId, e.sets.find((s) => s.type !== 'warmup')?.reps ?? null);
    if (!nl) return [];
    const prevTop = Math.max(...c.prev(e.exerciseId).filter((s) => s.type !== 'warmup').map((s) => s.kg ?? 0));
    return [`${B(nameOf(c, e.exerciseId))} ${fmtWeight(nl.kg, c.units)} × ${nl.reps}${nl.up ? ` (+${step(nl.kg - prevTop)})` : ''}`];
  }).slice(0, max).join('\n');
}

// ---------- plano de 30 dias e treinos prontos ----------
/** Plano de 30 dias em andamento (começado e não terminado). */
function planNow(c: Ctx) {
  const p = GPLANS.find((x) => { const d = c.g.done[x.id] ?? 0; return d > 0 && d < 30; });
  return p ? { plan: p, day: c.g.done[p.id] ?? 0 } : null;
}
export function planDayCard(c: Ctx): Card | null {
  const n = planNow(c);
  if (!n) return null;
  const f = n.plan.days[n.day];
  const list = f ? dayExercises(c.g, n.plan.id, n.day, c.all, c.find) : [];
  return {
    icon: 'calendar', title: `${tr(n.plan.title)} · ${L('Day', 'Dia')} ${n.day + 1}`,
    sub: f ? `${focusLabel(f)} · ${sub(list.length, Math.max(10, Math.round((list.length * n.plan.sets * 2.5) / 5) * 5))}` : L('Rest day', 'Dia de descanso'),
    act: f ? { t: 'gday', planId: n.plan.id, day: n.day } : { t: 'nav', to: '/g' },
    lines: list.slice(0, 6).map((e) => `${e.name} · ${n.plan.sets}×${n.plan.reps}`),
  };
}
const presetTitle = (id: string) => tr(PRESETS.find((p) => p.id === id)?.title ?? '');

// ---------- respostas ----------
const B = (s: string) => `**${s}**`;
const hours = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
const daysAgo = (iso: string) => Math.round((new Date(today()).getTime() - new Date(dayKey(iso)).getTime()) / 86400000);
const toneOf = (c: Ctx) => c.profile.tone ?? 'motivating';
/** Fecho da abertura conforme o tom escolhido. */
const shallWe = (c: Ctx, min: number) => ({
  motivating: L(`It takes about ${min} min. Let's go?`, `Leva uns ${min} min. Bora?`),
  technical: L(`About ${min} min. Suggested loads below, based on your last session.`, `Uns ${min} min. Cargas sugeridas abaixo, com base na última sessão.`),
  direct: L(`~${min} min.`, `~${min} min.`),
}[toneOf(c)]);

export function baseChips(c: Ctx): string[] {
  return [
    c.active ? L('Resume workout', 'Voltar ao treino') : L('Start workout', 'Começar treino'),
    L('What weight today?', 'Que carga hoje?'),
    L('I only have 30 min', 'Tenho só 30 min'),
    L('Build me a workout', 'Monta um treino'),
    L('Swap an exercise', 'Trocar exercício'),
    L("I'm sore", 'Estou dolorido'),
    L('My progress', 'Meu progresso'),
    L('30-day plans', 'Planos de 30 dias'),
  ];
}

/** Abertura do dia: saudação com o último treino (e o sono), o treino de hoje com a carga sugerida, ajuste pela recuperação e o plano de 30 dias em andamento. */
export function greet(c: Ctx, m: Memory): Draft[] {
  const h = new Date().getHours();
  const hi = h < 12 ? L('Good morning', 'Bom dia') : h < 18 ? L('Good afternoon', 'Boa tarde') : L('Good evening', 'Boa noite');
  const who = c.name ? `, ${c.name}` : '';
  const last = c.workouts[0];
  const ago = last ? daysAgo(last.date) : -1;
  let first = `${hi}${who}! `;
  if (!last) first += L("I'm your coach here in Reps. I look at your workouts and help you decide the next step.", 'Sou o seu coach aqui no Reps. Eu olho os seus treinos e ajudo a decidir o próximo passo.');
  else if (ago <= 0) first += L(`You already trained today: ${B(last.title)}. Nice work.`, `Você já treinou hoje: ${B(last.title)}. Mandou bem.`);
  else if (ago === 1) first += L(`Yesterday you did ${B(last.title)}.`, `Ontem você fez ${B(last.title)}.`);
  else first += L(`Your last workout was ${B(last.title)}, ${ago} days ago.`, `Seu último treino foi ${B(last.title)}, há ${ago} dias.`);
  if (c.sleepMin) first += L(` You slept ${hours(c.sleepMin)}.`, ` Você dormiu ${hours(c.sleepMin)}.`);

  if (c.active) return [{ text: first }, { text: L(`You have a workout in progress: ${B(c.active.title)}.`, `Você tem um treino em andamento: ${B(c.active.title)}.`), card: todayCard(c, m) }];

  const out: Draft[] = [{ text: first }];
  const pd = planDayCard(c);
  const n = planNow(c);
  if (pd && n) out.push({ text: L(`Your 30-day plan: today is day ${n.day + 1} of ${B(tr(n.plan.title))}.`, `Seu plano de 30 dias: hoje é o dia ${n.day + 1} de ${B(tr(n.plan.title))}.`), card: pd });

  const p = planFor(c, m);
  const streak = dayStreak(c.workouts);
  let second = ago === 0
    ? L(`If you still have energy, ${B(p.title)} is next on your list. If not, rest: that's when the muscle grows.`, `Se ainda tiver energia, o próximo da lista é ${B(p.title)}. Se não, descanse: é no descanso que o músculo cresce.`)
    : L(`${pd ? 'Or your routine' : 'Today'}: ${B(p.title)}, ${p.entries.length} exercises, mostly ${focusText(c, p.entries)}.`, `${pd ? 'Ou a sua rotina' : 'Hoje é dia de'} ${B(p.title)}: ${p.entries.length} exercícios, com foco em ${focusText(c, p.entries)}.`);
  if (lowRecovery(c)) second += L(` Your recovery is low today (${c.readiness}/100): keep last week's weights and do one set less per exercise.`, ` Sua recuperação está baixa hoje (${c.readiness}/100): mantenha os pesos da última vez e faça uma série a menos por exercício.`);
  else if (c.readiness != null && c.readiness >= 75) second += L(` Your recovery is high (${c.readiness}/100): a good day to add weight.`, ` Sua recuperação está alta (${c.readiness}/100): bom dia para subir o peso.`);
  else if (streak >= 3) second += L(` That makes ${streak} days in a row.`, ` Já são ${streak} dias seguidos.`);
  out.push({ text: second });
  const loads = ago === 0 ? '' : loadsText(c, m);
  out.push({ text: loads ? `${L('Suggested loads:', 'Cargas sugeridas:')}\n${loads}\n${shallWe(c, p.minutes)}` : shallWe(c, p.minutes), card: todayCard(c, m), buttons: todayButtons(c, m) });
  return out;
}

/** Resumo depois de um treino salvo: números, comparação com a última vez, recordes e a dica para a próxima. */
export function workoutSummary(c: Ctx, w: Workout): Draft {
  const older = c.workouts.filter((x) => x.id !== w.id && x.date < w.date);
  const best = new Map<string, number>();
  older.forEach((x) => x.entries.forEach((e) => { const k = canonId(e.exerciseId); const top = Math.max(0, ...e.sets.filter((s) => s.type !== 'warmup').map((s) => s.kg ?? 0)); if (top > (best.get(k) ?? 0)) best.set(k, top); }));
  const prs = w.entries.flatMap((e) => {
    const top = Math.max(0, ...e.sets.filter((s) => s.type !== 'warmup').map((s) => s.kg ?? 0));
    const before = best.get(canonId(e.exerciseId)) ?? 0;
    return top > 0 && before > 0 && top > before ? [`${B(nameOf(c, e.exerciseId))} ${fmtWeight(top, c.units)}`] : [];
  });
  const vol = workoutVolume(w);
  const prev = older.find((x) => x.title === w.title);
  let text = L(`Workout saved: ${B(w.title)}. ${Math.round(w.durationSec / 60)} min, ${workoutSets(w)} sets, ${fmtVolume(vol, c.units)}.`, `Treino salvo: ${B(w.title)}. ${Math.round(w.durationSec / 60)} min, ${workoutSets(w)} séries, ${fmtVolume(vol, c.units)}.`);
  if (prev) { const pv = workoutVolume(prev); if (pv > 0 && vol > 0) { const d = Math.round(((vol - pv) / pv) * 100); text += L(` Volume ${d >= 0 ? '+' : ''}${d}% versus last time.`, ` Volume ${d >= 0 ? '+' : ''}${d}% em relação à última vez.`); } }
  if (prs.length) text += L(` New records: ${prs.slice(0, 3).join(', ')}.`, ` Recordes novos: ${prs.slice(0, 3).join(', ')}.`);
  // dica: o primeiro exercício em que bateu as reps em todas as séries → sobe na próxima
  const tip = w.entries.find((e) => { const work = e.sets.filter((s) => s.type !== 'warmup' && (s.kg ?? 0) > 0); return work.length >= 2 && work.every((s) => (s.reps ?? 0) >= (work[0].reps ?? 0)); });
  if (tip) {
    const work = tip.sets.filter((s) => s.type !== 'warmup');
    const eq = c.find(tip.exerciseId)?.equipment;
    const top = Math.max(...work.map((s) => s.kg ?? 0));
    const step = c.units.weight === 'lbs' ? 5 / LB : eq === 'Dumbbell' || eq === 'Kettlebell' ? 2 : 2.5;
    text += L(` Next time try ${fmtWeight(top + step, c.units)} on ${B(nameOf(c, tip.exerciseId))}.`, ` Na próxima, tente ${fmtWeight(top + step, c.units)} no ${B(nameOf(c, tip.exerciseId))}.`);
  }
  return { text, buttons: [{ label: L('See workout', 'Ver treino'), act: { t: 'nav', to: `/feed/workout/${w.id}` } }] };
}

/** Um aviso por dia, o mais importante: volta depois de dias parado > desequilíbrio entre músculos > carga travada. */
export function dailyAlert(c: Ctx, m: Memory): Draft | null {
  const last = c.workouts[0];
  if (!last) return null;
  const ago = daysAgo(last.date);
  if (ago >= 5 && !c.active) return { text: L(`It has been ${ago} days since your last workout. Coming back with a light session is the easiest way to restart: 2 sets per exercise, a bit less weight.`, `Faz ${ago} dias desde o último treino. Voltar com uma sessão leve é o jeito mais fácil de retomar: 2 séries por exercício, um pouco menos de peso.`), card: lightCard(c, m) };
  // séries por grupo nos últimos 14 dias
  const since = Date.now() - 14 * 86400000;
  const sets: Record<string, number> = {};
  c.workouts.filter((w) => new Date(w.date).getTime() >= since).forEach((w) => w.entries.forEach((e) => { const g = groupOf(c, e.exerciseId); sets[g] = (sets[g] ?? 0) + e.sets.filter((s) => s.type !== 'warmup').length; }));
  const chest = sets.Chest ?? 0, back = sets.Back ?? 0, legs = sets.Legs ?? 0;
  const upper = chest + back + (sets.Shoulders ?? 0) + (sets.Arms ?? 0);
  if (chest >= 8 && back < chest * 0.6) return { text: L(`In the last 2 weeks you did ${chest} sets of chest and only ${back} of back. Balancing them protects the shoulders and improves posture.`, `Nas últimas 2 semanas você fez ${chest} séries de peito e só ${back} de costas. Equilibrar protege os ombros e melhora a postura.`), buttons: [{ label: presetTitle('back'), act: { t: 'preset', id: 'back' } }] };
  if (upper >= 20 && legs < upper * 0.35) return { text: L(`Legs are behind: ${legs} sets in 2 weeks against ${upper} for the upper body.`, `As pernas ficaram para trás: ${legs} séries em 2 semanas contra ${upper} da parte de cima.`), buttons: [{ label: presetTitle('lower'), act: { t: 'preset', id: 'lower' } }] };
  // carga travada: mesmo exercício 3+ vezes em 5 semanas sem subir o maior peso nas últimas 2
  const now = Date.now(), recentCut = now - 14 * 86400000, oldCut = now - 35 * 86400000;
  const hist = new Map<string, { recent: number; old: number; n: number; id: string }>();
  c.workouts.forEach((w) => {
    const t = new Date(w.date).getTime();
    if (t < oldCut) return;
    w.entries.forEach((e) => {
      const top = Math.max(0, ...e.sets.filter((s) => s.type !== 'warmup').map((s) => s.kg ?? 0));
      if (!top) return;
      const k = canonId(e.exerciseId);
      const h = hist.get(k) ?? { recent: 0, old: 0, n: 0, id: e.exerciseId };
      h.n++;
      if (t >= recentCut) h.recent = Math.max(h.recent, top); else h.old = Math.max(h.old, top);
      hist.set(k, h);
    });
  });
  const stuck = [...hist.values()].find((h) => h.n >= 3 && h.old > 0 && h.recent > 0 && h.recent <= h.old);
  if (stuck) return { text: L(`Your ${B(nameOf(c, stuck.id))} has been stuck at ${fmtWeight(stuck.old, c.units)} for 3 weeks. Drop it 10% for a week and build back up: it usually breaks the plateau.`, `Seu ${B(nameOf(c, stuck.id))} está parado em ${fmtWeight(stuck.old, c.units)} há 3 semanas. Baixe 10% por uma semana e suba de novo: costuma destravar.`) };
  return null;
}

const GROUP_RE: [string, RegExp][] = [
  ['Legs', /pern|coxa|quadr|glute|bumbum|panturr|posterior|\bleg|\bquad|hamstring|\bcal[fv]/],
  ['Chest', /peit|chest|\bpec/],
  ['Back', /costas|dorsal|lombar|\bback|\blats?\b/],
  ['Shoulders', /ombro|shoulder|delt/],
  ['Arms', /brac|bicep|tricep|\barms?\b/],
  ['Core', /abd|barriga|\bcore|\babs\b/],
];
const groupIn = (t: string) => GROUP_RE.find(([, re]) => re.test(t))?.[0];

/** Outro treino que poupe o grupo dolorido: do Trainer, das rotinas ou dos modelos. */
function alternative(c: Ctx, group: string, avoidTitle: string): Card | null {
  const cands: { title: string; entries: SavedEntry[]; act: Action }[] = [];
  c.trainer?.workouts.forEach((w) => cands.push({ title: w.title, entries: w.exercises.map((e) => ({ exerciseId: e.exerciseId, notes: '', restSec: e.restSec, sets: Array.from({ length: e.sets }, () => ({ type: 'normal' as const, kg: null, reps: e.repMax })) })), act: { t: 'trainer', uid: w.uid } }));
  c.routines.forEach((r) => cands.push({ title: r.title, entries: r.exercises, act: { t: 'routine', id: r.id } }));
  PROGRAMS.filter((p) => p.id !== 'fullbody').flatMap((p) => p.routines).forEach((t) => { const r = fromTemplate(t); cands.push({ title: r.title, entries: r.exercises, act: { t: 'entries', title: r.title, entries: r.exercises } }); });
  const best = cands.filter((x) => x.title !== avoidTitle && x.entries.length).map((x) => ({ x, s: (shares(c, x.entries)[group] ?? 0) + (shares(c, x.entries)['Full body'] ?? 0) / 2 })).sort((a, b) => a.s - b.s)[0];
  if (!best || best.s > 0.2) return null;
  return { icon: 'barbell', title: best.x.title, sub: sub(best.x.entries.length, estMin(best.x.entries.reduce((a, e) => a + e.sets.length, 0))), act: best.x.act, lines: linesOf(c, best.x.entries) };
}

function sore(t: string, c: Ctx, m: Memory): Out {
  const g = groupIn(t);
  const all = /tudo|todo|all over|everything|geral|inteiro|whole|cansad|tired|exhaust|fatig|moid/.test(t);
  if (!g && !all)
    return { intent: 'sore_ask', mem: { ...m, pending: 'sore' }, msgs: [{ text: L('Where are you sore?', 'Onde está dolorido?') }], chips: [...['Legs', 'Chest', 'Back', 'Shoulders', 'Arms'].map((x) => { const n = groupName(x); return n[0].toUpperCase() + n.slice(1); }), L('All over', 'O corpo todo')] };
  const mem: Memory = { ...m, pending: undefined, sore: { where: g ?? 'all', at: Date.now() } };
  if (c.active) return { intent: 'sore', mem, msgs: [{ text: L('You are mid-workout: drop the weight about 20% and stop each set 2 or 3 reps before failure. If it hurts instead of just feeling heavy, stop that exercise.', 'Você está no meio do treino: baixe o peso uns 20% e pare cada série 2 ou 3 repetições antes da falha. Se doer em vez de só pesar, pare esse exercício.'), card: todayCard(c, m) }] };
  const p = planFor(c, m);
  const light: Draft = { text: L('Or keep the plan in a light version: 2 sets per exercise with about 20% less weight.', 'Ou mantenha o plano numa versão leve: 2 séries por exercício com uns 20% menos peso.'), card: lightCard(c, m) };
  if (!g) return { intent: 'sore', mem, msgs: [{ text: L('When everything feels heavy, a lighter session works better than forcing a hard one.', 'Quando tudo pesa, uma sessão mais leve rende mais do que forçar um treino pesado.'), card: lightCard(c, m) }, { text: L('Or take the day off. A walk and a good night of sleep also count.', 'Ou tire o dia de folga. Uma caminhada e uma boa noite de sono também contam.') }] };
  const share = (shares(c, p.entries)[g] ?? 0) + (shares(c, p.entries)['Full body'] ?? 0) / 2;
  const gn = groupName(g);
  if (share < 0.25) return { intent: 'sore', mem, msgs: [{ text: L(`Good news: today's ${B(p.title)} barely works your ${gn}. Mild soreness usually eases once you warm up.`, `Boa notícia: o ${B(p.title)} de hoje quase não pega ${gn}. Dor muscular leve costuma aliviar depois do aquecimento.`), card: todayCard(c, m) }] };
  const alt = alternative(c, g, p.title);
  const why = L(`Soreness a day or two after training is normal, but it is better not to hit the same muscle hard again. Today's ${B(p.title)} works your ${gn} a lot.`, `Dor muscular um ou dois dias depois do treino é normal, mas é melhor não castigar o mesmo músculo de novo. O ${B(p.title)} de hoje pega bastante ${gn}.`);
  if (!alt) return { intent: 'sore', mem, msgs: [{ text: why }, { ...light, text: L('Do it in a light version: 2 sets per exercise with about 20% less weight.', 'Faça numa versão leve: 2 séries por exercício com uns 20% menos peso.') }] };
  return { intent: 'sore', mem, msgs: [{ text: `${why} ${L(`I would switch to ${B(alt.title)}, which gives them a break.`, `Eu trocaria por ${B(alt.title)}, que dá uma folga para essa região.`)}`, card: alt }, light] };
}

const matchName = (t: string, list: { id: string; name: string }[]) => {
  const n = parseInt(t, 10);
  if (/^\d+$/.test(t.trim()) && list[n - 1]) return list[n - 1];
  return list.map((x) => ({ x, k: norm(x.name) })).filter(({ k }) => k && (t.includes(k) || (t.length >= 4 && k.includes(t)))).sort((a, b) => b.k.length - a.k.length)[0]?.x;
};

function swap(t: string, c: Ctx, m: Memory): Out | null {
  if (c.active) return { intent: 'swap', mem: { ...m, pending: undefined }, msgs: [{ text: L(`You are mid-workout: open it and tap ${B('Swap')} under the exercise. I show 3 or 4 options for the same muscle right there.`, `Você está no meio do treino: abra o treino e toque em ${B('Trocar')} embaixo do exercício. Eu mostro 3 ou 4 opções para o mesmo músculo ali mesmo.`), card: todayCard(c, m) }] };
  const p = planFor(c, m);
  const list = p.entries.map((e) => ({ id: e.exerciseId, name: nameOf(c, e.exerciseId) }));
  if (m.pending === 'swapPick' && m.swapFrom && m.swapOpts) {
    if (/manter|deixa|keep|nenhum|none|cancel/.test(t)) return { intent: 'swap_keep', mem: { ...m, pending: undefined, swapFrom: undefined, swapOpts: undefined }, msgs: [{ text: L(`OK, ${B(nameOf(c, m.swapFrom))} stays.`, `Certo, ${B(nameOf(c, m.swapFrom))} fica.`), card: todayCard(c, m) }] };
    const pick = matchName(t, m.swapOpts);
    if (pick) {
      // se o exercício já era uma troca, a nova troca vale para o original
      const sw = swapsOf(m);
      const original = Object.keys(sw).find((k) => sw[k] === m.swapFrom) ?? m.swapFrom;
      const mem: Memory = { ...m, pending: undefined, swapFrom: undefined, swapOpts: undefined, swaps: { ...sw, [original]: pick.id }, swapsDay: today() };
      return { intent: 'swap_done', mem, msgs: [{ text: L(`Done. Today ${B(pick.name)} replaces ${B(nameOf(c, m.swapFrom))}. It is only for this workout: your routine stays the same.`, `Feito. Hoje ${B(pick.name)} entra no lugar de ${B(nameOf(c, m.swapFrom))}. Vale só para este treino: a sua rotina continua igual.`), card: todayCard(c, mem) }] };
    }
  }
  const from = matchName(t, list);
  if (!from) {
    if (m.pending === 'swap') return null; // não era um exercício: deixa os outros assuntos tentarem
    return { intent: 'swap_ask', mem: { ...m, pending: 'swap' }, msgs: [{ text: L(`Which exercise of ${B(p.title)} do you want to swap?`, `Qual exercício do ${B(p.title)} você quer trocar?`) }], chips: list.slice(0, 8).map((x) => x.name) };
  }
  const ex = c.find(from.id);
  const taken = new Set(p.entries.flatMap((e) => c.find(e.exerciseId)?.catalogId ?? []));
  const opts = ex ? substitutesFor(ex, taken, 3).map((s) => ({ id: catKey(s.c), name: catName(s.c) })) : [];
  if (!opts.length) return { intent: 'swap_none', mem: { ...m, pending: undefined }, msgs: [{ text: L(`I could not find a good replacement for ${B(from.name)}.`, `Não achei uma boa troca para ${B(from.name)}.`) }] };
  const lines = opts.map((o, i) => `${i + 1}. ${B(o.name)}${i === 0 ? L(' (closest match)', ' (a mais parecida)') : ''}`).join('\n');
  return { intent: 'swap_options', mem: { ...m, pending: 'swapPick', swapFrom: from.id, swapOpts: opts }, msgs: [{ text: `${L(`Instead of ${B(from.name)}, same muscle:`, `No lugar de ${B(from.name)}, para o mesmo músculo:`)}\n${lines}\n${L('Which one?', 'Qual delas?')}` }], chips: [...opts.map((o) => o.name), L('Keep it', 'Manter')] };
}

function progress(c: Ctx, m: Memory): Out {
  if (!c.workouts.length) return { intent: 'progress', mem: m, msgs: [{ text: L('No workouts logged yet. Do the first one and I start tracking your progress.', 'Ainda não há treinos registrados. Faça o primeiro e eu começo a acompanhar a sua evolução.'), card: todayCard(c, m) }] };
  const ws = startOfWeek();
  const n = c.workouts.filter((w) => new Date(w.date) >= ws).length;
  const [prevV, curV] = weeklySeries(c.workouts, 'volume', 2).map((x) => x.value);
  const streak = dayStreak(c.workouts);
  const goal = c.weeklyGoal || c.trainer?.settings.frequency || 0;
  const count = goal ? L(`${n} of ${goal} workouts`, `${n} de ${goal} treinos`) : L(`${n} workout${n === 1 ? '' : 's'}`, `${n} treino${n === 1 ? '' : 's'}`);
  let text = L(`This week: ${B(count)} and ${B(fmtVolume(curV, c.units))} lifted.`, `Nesta semana: ${B(count)} e ${B(fmtVolume(curV, c.units))} levantados.`);
  if (prevV > 0 && curV > 0) { const d = Math.round(((curV - prevV) / prevV) * 100); text += L(` That is ${d >= 0 ? '+' : ''}${d}% versus last week.`, ` Isso dá ${d >= 0 ? '+' : ''}${d}% em relação à semana passada.`); }
  text += L(`\nStreak: ${B(`${streak} day${streak === 1 ? '' : 's'}`)}. Since you started: ${B(String(c.workouts.length))} workouts.`, `\nSequência: ${B(`${streak} dia${streak === 1 ? '' : 's'}`)}. Desde o começo: ${B(String(c.workouts.length))} treinos.`);
  if (goal && n < goal) text += L(` ${goal - n} to go to hit this week's goal.`, ` Faltam ${goal - n} para bater a meta da semana.`);
  return { intent: 'progress', mem: m, msgs: [{ text, card: { icon: 'stats-chart', title: L('Statistics', 'Estatísticas'), sub: L('Charts, records and muscles', 'Gráficos, recordes e músculos'), act: { t: 'nav', to: '/profile/stats' } } }] };
}

function plans(c: Ctx, m: Memory): Out {
  const pd = planDayCard(c);
  const n = planNow(c);
  const one: Draft = pd && n
    ? { text: L(`You are on day ${n.day + 1} of 30 in ${B(tr(n.plan.title))}. Keep going.`, `Você está no dia ${n.day + 1} de 30 do plano ${B(tr(n.plan.title))}. Continue.`), card: pd, buttons: n.plan.days[n.day] ? [{ label: L('Regenerate today', 'Gerar outro hoje'), act: { t: 'regen', planId: n.plan.id, day: n.day } }] : undefined }
    : { text: L(`There are ${GPLANS.length} plans of 30 days, each with a workout ready for every day: muscle, strength, stamina, legs, core and one for beginners.`, `São ${GPLANS.length} planos de 30 dias, cada um com o treino de cada dia já pronto: massa, força, resistência, pernas, abdômen e um para iniciantes.`), card: { icon: 'calendar', title: L('30-day plans', 'Planos de 30 dias'), sub: L('Choose a plan', 'Escolher um plano'), act: { t: 'nav', to: '/g' } } };
  return { intent: 'plans', mem: m, msgs: [one] };
}

function restDay(c: Ctx, m: Memory): Out {
  const streak = dayStreak(c.workouts);
  const trainedToday = !!c.workouts[0] && daysAgo(c.workouts[0].date) === 0;
  if (trainedToday) return { intent: 'rest', mem: m, msgs: [{ text: L('You already trained today. Rest now: eat well and sleep. The gain happens in recovery.', 'Você já treinou hoje. Agora descanse: coma bem e durma. O ganho acontece na recuperação.') }] };
  if (streak >= 4) return { intent: 'rest', mem: m, msgs: [{ text: L(`You have trained ${streak} days in a row. A day off now helps you come back stronger. If you really want to move, do a light session.`, `Você treinou ${streak} dias seguidos. Um dia de folga agora ajuda a voltar mais forte. Se quiser muito se mexer, faça uma sessão leve.`), card: lightCard(c, m) }] };
  if (lowRecovery(c)) return { intent: 'rest', mem: m, msgs: [{ text: L(`Your recovery is low today (${c.readiness}/100). Rest, or do a light session.`, `Sua recuperação está baixa hoje (${c.readiness}/100). Descanse ou faça uma sessão leve.`), card: lightCard(c, m) }] };
  return { intent: 'rest', mem: m, msgs: [{ text: L('Nothing in your history says you need a day off. You are good to train today.', 'Nada no seu histórico pede folga. Pode treinar hoje.'), card: todayCard(c, m) }] };
}

/** "Que carga hoje?": carga sugerida dos exercícios do treino de hoje (dupla progressão, ajustada pela recuperação). */
function weights(c: Ctx, m: Memory): Out {
  if (c.active) return { intent: 'loads', mem: m, msgs: [{ text: L('In the workout, each set already shows the weight from last time. If you hit all the reps in every set, add the smallest step next set.', 'No treino, cada série já mostra o peso da última vez. Se bater todas as reps em todas as séries, suba o menor degrau na próxima.'), card: todayCard(c, m) }] };
  const t = loadsText(c, m, 6);
  if (!t) return { intent: 'loads', mem: m, msgs: [{ text: L('I still have no weights from you on these exercises. Do this workout once with a weight you can lift with 2 reps to spare, and from then on I suggest the next step.', 'Ainda não tenho os seus pesos nesses exercícios. Faça este treino uma vez com um peso que sobrem 2 reps, e daí em diante eu sugiro o próximo passo.'), card: todayCard(c, m) }] };
  const why = lowRecovery(c)
    ? L('Your recovery is low, so I kept the weights and cut one set.', 'Sua recuperação está baixa, então mantive os pesos e tirei uma série.')
    : L('Rule: if you hit every rep last time, add the smallest step; if not, repeat the weight.', 'A regra: se bateu todas as reps da última vez, sobe o menor degrau; se não, repete o peso.');
  return { intent: 'loads', mem: m, msgs: [{ text: `${L(`For ${B(planFor(c, m).title)}:`, `Para o ${B(planFor(c, m).title)}:`)}\n${t}\n${why}`, card: loadedCard(c, m) }] };
}

/** Grupo pedido → vagas do gerador. */
const SLOTS: Record<string, [string, number][]> = {
  Chest: [['Chest', 5], ['Triceps', 2]], Back: [['Back', 5], ['Biceps', 2]], Shoulders: [['Shoulders', 5]], Arms: [['Biceps', 3], ['Triceps', 3]],
  Core: [['Abs', 6]], Legs: [['Quads', 3], ['Hamstrings', 2], ['Glutes', 1], ['Calves', 1]],
  'Full body': [['Quads', 1], ['Chest', 1], ['Back', 1], ['Shoulders', 1], ['Hamstrings', 1], ['Biceps', 1], ['Abs', 1]],
};
const EQUIP_RE: [string, RegExp][] = [
  ['Dumbbell', /halter|dumbbell/], ['Barbell', /\bbarra\b|barbell/], ['Machine', /maquina|machine/], ['Cable', /polia|cabo|cable/],
  ['Kettlebell', /kettle/], ['Band', /elastic|faixa|band\b/], ['Body weight', /em casa|\bcasa\b|at home|peso (do )?corpo|bodyweight|body weight|sem equip|no equipment/],
];
/** "Monta um treino de peito de 40 min com halteres": monta com o gerador da aba Treinamento. */
function build(t: string, c: Ctx, m: Memory): Out {
  const g = groupIn(t) ?? 'Full body';
  const mins = t.match(/(\d+)\s*(min|m\b)/);
  const minutes = mins ? Math.max(15, Math.min(120, parseInt(mins[1], 10))) : 45;
  const n = Math.max(3, Math.min(7, Math.round(minutes / 8)));
  const equip = EQUIP_RE.filter(([, re]) => re.test(t)).map(([e]) => e);
  const goal = c.profile.goal;
  const sets = goal === 'strength' ? 4 : 3, reps = goal === 'strength' ? 6 : goal === 'fatloss' ? 12 : 10;
  const list = buildWorkout(c.g, SLOTS[g], c.all, n, equip, Date.now() % 997);
  if (!list.length) return { intent: 'build', mem: m, msgs: [{ text: L('I could not find exercises for that with this equipment. Try another equipment or muscle.', 'Não achei exercícios para isso com esse equipamento. Tente outro equipamento ou músculo.') }] };
  const entries: SavedEntry[] = list.map((e) => ({ exerciseId: e.id, notes: '', restSec: goal === 'strength' ? 150 : 75, superset: null, sets: Array.from({ length: sets }, () => ({ type: 'normal' as const, kg: null, reps })) }));
  const title = `${L('Workout', 'Treino')} ${groupName(g)} · ${minutes} min`;
  const eqTxt = equip.length ? L(` with ${equip.join(', ').toLowerCase()}`, ' com o equipamento que você pediu') : '';
  return {
    intent: 'build', mem: m,
    msgs: [{ text: L(`Here it is: ${list.length} exercises for ${groupName(g)}${eqTxt}, ${sets}×${reps}, about ${minutes} min. The weights come from your last time on each one.`, `Pronto: ${list.length} exercícios de ${groupName(g)}${eqTxt}, ${sets}×${reps}, uns ${minutes} min. Os pesos vêm da sua última vez em cada um.`),
      card: { icon: 'construct', title, sub: sub(list.length, minutes), act: { t: 'entries', title, entries }, lines: list.map((e) => `${e.name} · ${sets}×${reps}`) },
      buttons: [{ label: L('Make another', 'Montar outro'), act: { t: 'say', text: t } }] }],
  };
}

/** Frases que a pessoa quer que o Coach guarde ("lembre que…", "tenho dor no ombro", "odeio leg press"). */
function remember(raw: string, t: string, m: Memory): Out | null {
  const ask = /^(lembr|anot|guard|remember|note that|keep in mind|nao esquec)/.test(t);
  const injury = /(tenho|i have|estou com|i've got).{0,20}(lesao|tendinite|hernia|dor cronica|problema|injur|tendinit|bad (knee|back|shoulder))/.test(t);
  const dislike = /(odeio|detesto|nao gosto d|nao consigo fazer|i hate|i can't do|i cannot do|i don't like doing)/.test(t);
  if (!ask && !injury && !dislike) return null;
  const note = raw.replace(/^\s*(lembre(-se)?( de)?( que)?|anote( que)?|guarde( que)?|remember( that)?|note that|keep in mind( that)?)\s*[:,]?\s*/i, '').trim().replace(/\.$/, '');
  if (!note) return null;
  const text = L(`Noted: "${note}". I will take it into account in suggestions. You can see and delete it in Coach settings.`, `Anotado: "${note}". Vou levar isso em conta nas sugestões. Você vê e apaga em Ajustes do Coach.`)
    + (injury ? L(' If it hurts during an exercise, stop it and see a physical therapist.', ' Se doer durante um exercício, pare e procure um fisioterapeuta.') : '');
  const btn: Btn[] = [{ label: L('Coach settings', 'Ajustes do Coach'), act: { t: 'nav', to: '/settings/coach-ai' } }];
  if (dislike) btn.unshift({ label: L('Swap an exercise', 'Trocar exercício'), act: { t: 'say', text: L('Swap an exercise', 'Trocar exercício') } });
  return { intent: 'remember', mem: m, remember: [note], msgs: [{ text, buttons: btn }] };
}

/** Perguntas gerais de treino (respostas curtas, regra de bolso; nada de dieta ou diagnóstico). */
const FAQ: [string, RegExp, string, string][] = [
  ['injury', /lesao|lesion|machuqu|injur|sharp pain|dor forte|dor aguda|estalo|torci|hurt bad|dor no peito|chest pain|tontura|dizz|formig|numb/, 'Sharp pain, numbness, chest pain or dizziness are not normal training soreness. Stop, do not train through it, and see a doctor or physical therapist. If it is chest pain or you feel faint, get medical help now.', 'Dor aguda, formigamento, dor no peito ou tontura não são dor normal de treino. Pare, não treine por cima, e procure um médico ou fisioterapeuta. Se for dor no peito ou sensação de desmaio, procure atendimento agora.'],
  ['frequency', /quantas vezes|how often|how many days|quantos dias|vezes por semana|times a week|frequencia/, 'For most people 3 to 5 workouts a week works well. What matters most is training each muscle about twice a week and not missing weeks.', 'Para a maioria, 3 a 5 treinos por semana funciona bem. O que mais conta é treinar cada músculo umas duas vezes por semana e não falhar semanas.'],
  ['rest_sets', /entre (as )?series|between sets|quanto.*descans|how long.*rest|tempo de descanso|rest time/, 'Rest 2 to 3 minutes on heavy compound lifts (squat, bench, deadlift, rows) and 60 to 90 seconds on smaller exercises. Short rests cost you reps.', 'Descanse 2 a 3 minutos nos exercícios pesados e compostos (agachamento, supino, terra, remadas) e 60 a 90 segundos nos menores. Descanso curto demais tira repetições.'],
  ['sets', /quantas series|how many sets|quantas rep|how many reps|series por|sets per|volume ideal/, 'A good range to build muscle is 10 to 20 hard sets per muscle per week, with 6 to 15 reps per set, stopping 1 to 3 reps before failure.', 'Uma boa faixa para ganhar massa é de 10 a 20 séries puxadas por músculo por semana, com 6 a 15 repetições, parando 1 a 3 repetições antes da falha.'],
  ['warmup', /aquec|warm ?up/, 'Do about 5 minutes of light movement, then 2 or 3 lighter sets of the first exercise (around 40%, 60% and 80% of the working weight). In the workout, the exercise menu has a warm-up calculator.', 'Faça uns 5 minutos de movimento leve e depois 2 ou 3 séries mais leves do primeiro exercício (perto de 40%, 60% e 80% do peso de trabalho). No treino, o menu do exercício tem uma calculadora de aquecimento.'],
  ['overload', /aumentar (o )?peso|increase.*weight|add weight|subir (a )?carga|estagn|plateau|progressao|progressive|quando aumentar|destrav/, 'When you hit the top of the rep range in every set, add the smallest step next time (2.5 kg or 5 lb on the bar). If you are stuck for 3 weeks, drop the weight 10% and build back up.', 'Quando você bater o topo da faixa de repetições em todas as séries, suba o menor degrau na próxima vez (2,5 kg na barra). Se travar por 3 semanas, baixe 10% e suba de novo.'],
  ['protein', /protein|dieta|diet|comer|\beat\b|aliment|caloria|calorie|suplement|creatin|whey/, 'I am a training coach, so on food I only give the rule of thumb: about 1.6 to 2.2 g of protein per kg of body weight a day, spread over your meals. For a diet plan, see a nutritionist.', 'Sou coach de treino, então de comida eu só passo a regra de bolso: cerca de 1,6 a 2,2 g de proteína por kg de peso por dia, divididos nas refeições. Para um plano alimentar, procure um nutricionista.'],
  ['fatloss', /emagrec|lose (fat|weight)|perder (peso|gordura)|secar|queimar gordura|burn fat/, 'Fat loss comes mostly from eating a little less than you burn. Keep lifting to hold on to muscle, walk more during the day and be patient: about half a kilo a week is a good pace.', 'Emagrecer vem principalmente de comer um pouco menos do que você gasta. Continue treinando com peso para segurar o músculo, caminhe mais no dia e tenha paciência: cerca de meio quilo por semana é um bom ritmo.'],
  ['sleep', /\bsono\b|dormir|dormi|\bsleep|insonia/, 'Sleep is where the training turns into result. Aim for 7 to 9 hours, with a regular bedtime. After a bad night, train lighter instead of skipping.', 'É no sono que o treino vira resultado. Mire em 7 a 9 horas, com horário regular para deitar. Depois de uma noite ruim, treine mais leve em vez de faltar.'],
];

/** Horas desde a última dor relatada (nada se não houve ou se passou de 4 dias). */
export const soreAgeH = (m: Memory) => { if (!m.sore) return undefined; const h = (Date.now() - m.sore.at) / 3600000; return h < 96 ? h : undefined; };
const soreWhere = (m: Memory) => (m.sore?.where === 'all' || !m.sore ? L('all over', 'o corpo todo') : groupName(m.sore.where));
const agoText = (h: number) => (h < 24 ? L(`${Math.round(h)} hours ago`, `há ${Math.round(h)} horas`) : h < 48 ? L('yesterday', 'ontem') : L(`${Math.floor(h / 24)} days ago`, `há ${Math.floor(h / 24)} dias`));
/** Dor relatada há mais de 6 h: o treino sai completo, e o Coach pergunta se ainda dói (botões). */
export function soreCheck(m: Memory): Draft | null {
  const h = soreAgeH(m);
  if (h == null || h < 6) return null;
  const w = soreWhere(m);
  return {
    text: L(`You told me ${agoText(h)} you were sore (${w}). If it still hurts, I'll adapt the workout.`, `Você me disse ${agoText(h)} que estava com dor (${w}). Se ainda estiver, eu adapto o treino.`),
    buttons: [
      { label: L('Still sore', 'Ainda estou com dor'), act: { t: 'say', text: L(`I'm still sore: ${w}`, `Ainda estou dolorido: ${w}`) } },
      { label: L("It's gone", 'Já passou'), act: { t: 'say', text: L('The soreness is gone', 'Já passou a dor') } },
    ],
  };
}
/** Pedidos que viram treino: recebem a pergunta da dor antiga. */
export const WORKOUT_INTENTS = ['build', 'today', 'time', 'weights', 'regen'];
export const asksWorkout = (raw: string) => /treino|workout|treinar|train|exercic|exercis|perna|leg|peito|chest|costas|back|ombro|shoulder|braco|arm/.test(norm(raw));

/** Resposta do Coach para o que o usuário escreveu (ou tocou nos atalhos). */
export function reply(raw: string, c: Ctx, m: Memory): Out {
  const t = norm(raw).replace(/[?!.,;]/g, ' ').trim();
  const clear = { ...m, pending: undefined };
  const tc = () => todayCard(c, clear);

  if (m.pending === 'swap' || m.pending === 'swapPick') { const o = swap(t, c, m); if (o) return o; }
  if (m.pending === 'sore' && (groupIn(t) || /tudo|todo|all over|everything|geral|inteiro|whole/.test(t))) return sore(t, c, m);

  if (m.sore && /(ja )?passou|nao (estou|to|sinto) mais|sem dor|melhorei|to melhor|estou melhor|no longer sore|not sore|is gone|feel(ing)? better|all good/.test(t) && !/dolorid|doendo|ainda/.test(t))
    return { intent: 'sore_gone', mem: { ...clear, sore: undefined }, msgs: [{ text: L('Great! Then the full workout is on.', 'Ótimo! Então vale o treino completo.'), card: tc(), buttons: todayButtons(c, { ...clear, sore: undefined }) }] };

  const mem = remember(raw, t, clear);
  if (mem) return mem;
  for (const [id, re, en, pt] of FAQ) if (re.test(t)) return { intent: `faq_${id}`, mem: clear, msgs: [{ text: L(en, pt) }] };

  if (/(mont|cri|ger|faz|faca|prepar|build|make|create|design).{0,12}(treino|workout)|treino (de|para) .{2,20}(min|halter|barra|casa|maquina)/.test(t) && !/(gera|gerar) (outro|de novo)|regenerat/.test(t)) return build(t, c, clear);
  if (/(quanto|que|qual|quais) (peso|carga)|carga (de )?hoje|cargas sugeridas|suggested load|what weight|how much weight|which weight/.test(t)) return weights(c, clear);
  if (/(gera|gerar|gere|outro|novo) (treino )?(de novo|outro|diferente)|regenerat|outro treino (para )?hoje|trocar o treino de hoje/.test(t)) {
    const n = planNow(c);
    if (n && n.plan.days[n.day]) return { intent: 'regen', mem: clear, msgs: [{ text: L(`I can redo day ${n.day + 1} of ${B(tr(n.plan.title))} with other exercises for the same muscles.`, `Posso refazer o dia ${n.day + 1} de ${B(tr(n.plan.title))} com outros exercícios para os mesmos músculos.`), buttons: [{ label: L('Regenerate today', 'Gerar outro hoje'), act: { t: 'regen', planId: n.plan.id, day: n.day } }] }] };
    return build(t, c, clear);
  }
  const mins = t.match(/(\d+)\s*(min|m\b)/) ?? t.match(/(\d+)\s*(h\b|hora|hour)/);
  if (mins || /pouco tempo|sem tempo|short on time|\bquick|rapid|curto|express|so tenho|only have|pressa|hurry/.test(t)) {
    if (c.active) return { intent: 'time', mem: clear, msgs: [{ text: L('You are mid-workout: finish the sets of the main exercises and hide the rest for today (exercise menu, Hide only for this workout).', 'Você está no meio do treino: termine as séries dos exercícios principais e esconda o resto por hoje (menu do exercício, Esconder só neste treino).'), card: tc() }] };
    const n = mins ? parseInt(mins[1], 10) * (/h|hora|hour/.test(mins[2]) && !/min|^m$/.test(mins[2]) ? 60 : 1) : 30;
    const p = planFor(c, clear);
    if (n >= p.minutes) return { intent: 'time', mem: clear, msgs: [{ text: L(`${n} min is enough for the whole ${B(p.title)}.`, `${n} min dá para o ${B(p.title)} inteiro.`), card: tc() }] };
    const card = expressCard(c, clear, Math.max(10, n));
    const count = card.act.t === 'entries' ? card.act.entries.length : 0;
    return { intent: 'time', mem: clear, msgs: [{ text: L(`No problem: a short version with the ${count} main exercises and 60 s of rest.`, `Sem problema: versão curta com os ${count} exercícios principais e descanso de 60 s.`), card: { ...card, lines: card.act.t === 'entries' ? linesOf(c, card.act.entries) : undefined } }] };
  }
  if (/dolorid|dor muscular|\bsore|doendo|\bdoi\b|\bdores\b|quebrad|cansad|tired|exhaust|fatig|moid/.test(t)) return sore(t, c, clear);
  if (/troc|substitu|swap|replace|nao gosto|dont like|don't like|ocupad|\bbusy|outro exercicio|another exercise|alternativ/.test(t)) return swap(t, c, clear) ?? { intent: 'swap', mem: clear, msgs: [] };
  if (/continuar|retomar|resume|voltar ao treino/.test(t) && c.active) return { intent: 'resume', mem: clear, msgs: [{ text: L('Back to it.', 'De volta ao treino.') }], run: { t: 'resume' } };
  if (/^(start|comecar|comeca|iniciar|inicia|bora|vamos|lets go|let's go|go|partiu|yes|sim|ok|claro|pode ser|treinar)\b|start workout|comecar treino|iniciar treino|treinar agora/.test(t)) {
    if (c.active) return { intent: 'start', mem: clear, msgs: [{ text: L(`You already have ${B(c.active.title)} in progress. Opening it.`, `Você já tem ${B(c.active.title)} em andamento. Abrindo.`) }], run: { t: 'resume' } };
    return { intent: 'start', mem: clear, msgs: [{ text: L(`Let's go. Setting up ${B(planFor(c, clear).title)} with the weights from last time.`, `Bora. Montando ${B(planFor(c, clear).title)} com os pesos da última vez.`) }], run: { t: 'today' } };
  }
  if (/progress|evolu|como estou|how am i|resultado|estatistic|\bstats\b|desempenho|\bsemana\b|\bweek\b|sequencia|streak|volume|recorde|record/.test(t)) return progress(c, clear);
  if (/plano|\bplans?\b|30 dias|30 days|desafio|challenge|\bmeta\b|\bgoal/.test(t)) return plans(c, clear);
  if (/descans|rest day|folga|day off|devo treinar|should i train|pular|\bskip/.test(t)) return restDay(c, clear);
  if (/hoje|today|qual treino|o que treinar|what.*(train|workout)|treino do dia|proximo treino|next workout/.test(t)) {
    const p = planFor(c, clear);
    return { intent: 'today', mem: clear, msgs: [{ text: c.active ? L(`You have ${B(c.active.title)} in progress.`, `Você tem ${B(c.active.title)} em andamento.`) : L(`Today is ${B(p.title)}: ${p.entries.length} exercises, mostly ${focusText(c, p.entries)}, about ${p.minutes} min.`, `Hoje é ${B(p.title)}: ${p.entries.length} exercícios, com foco em ${focusText(c, p.entries)}, uns ${p.minutes} min.`), card: tc(), buttons: todayButtons(c, clear) }] };
  }
  if (/obrigad|valeu|thanks|thank you|\bthx\b/.test(t)) return { intent: 'thanks', mem: clear, msgs: [{ text: L('Anytime. I am here when you need me.', 'Disponha. Estou aqui quando precisar.') }] };
  if (/^(oi|ola|hello|hi|hey|e ai|bom dia|boa tarde|boa noite|good (morning|afternoon|evening))\b/.test(t)) return { intent: 'hello', mem: clear, msgs: [{ text: L(`Hi${c.name ? `, ${c.name}` : ''}! Want to see today's workout?`, `Oi${c.name ? `, ${c.name}` : ''}! Quer ver o treino de hoje?`), card: tc() }] };
  if (/ajuda|help|o que voce (faz|sabe)|what can you/.test(t)) return { intent: 'help', mem: clear, msgs: [{ text: helpText() }] };
  return { intent: 'unknown', mem: clear, msgs: [{ text: `${L('I do not know how to answer that yet.', 'Essa eu ainda não sei responder.')} ${helpText()}` }] };
}
export const helpText = () => L('I set up today\'s workout with suggested loads, make a shorter or lighter version, build a workout for a muscle and time, swap an exercise, follow your 30-day plan and progress, and remember what you tell me (injuries, exercises you dislike). With AI turned on, I also answer free questions.', 'Eu monto o treino de hoje com cargas sugeridas, faço uma versão mais curta ou mais leve, monto um treino para um músculo e um tempo, troco um exercício, acompanho o seu plano de 30 dias e a sua evolução, e lembro do que você me conta (lesões, exercícios que não gosta). Com a IA ligada, também respondo perguntas livres.');

// ---------- IA (Edge Function `coach`) ----------
/** Séries por grupo muscular na semana (sem aquecimento). */
function weekSets(c: Ctx) {
  const ws = startOfWeek();
  const out: Record<string, number> = {};
  c.workouts.filter((w) => new Date(w.date) >= ws).forEach((w) => w.entries.forEach((e) => { const g = groupOf(c, e.exerciseId); out[g] = (out[g] ?? 0) + e.sets.filter((s) => s.type !== 'warmup').length; }));
  return out;
}
/** Resumo dos dados do usuário que vai junto com a pergunta para a IA (texto curto, sem e-mail nem id; só com consentimento). */
export function contextText(c: Ctx, m: Memory): string {
  const p = planFor(c, m);
  const ws = startOfWeek();
  const week = c.workouts.filter((w) => new Date(w.date) >= ws).length;
  const goal = c.weeklyGoal || c.trainer?.settings.frequency || 0;
  const pr = c.profile;
  const lines = [
    `language: ${getLang()}`,
    `name: ${c.name || 'unknown'}`,
    `tone: ${pr.tone ?? 'motivating'}`,
    `goal: ${pr.goal ?? 'not set'}`,
    `remembered about the person: ${(pr.notes ?? []).join(' | ') || 'nothing yet'}`,
    `weight unit: ${c.units.weight}`,
    `today: ${dayKey(new Date())}`,
    c.active ? `workout in progress: ${c.active.title}` : `today's planned workout: ${p.title} (~${p.minutes} min): ${p.entries.map((e) => `${nameOf(c, e.exerciseId)} ${e.sets.length}x${e.sets[0]?.reps ?? '?'}`).join('; ')}`,
    `suggested loads for today (double progression): ${loadsText(c, m, 6).replace(/\*\*/g, '').replace(/\n/g, '; ') || 'no history yet'}`,
    `workouts this week: ${week}${goal ? ` of a goal of ${goal}` : ''}; day streak: ${dayStreak(c.workouts)}; total workouts: ${c.workouts.length}`,
    `sets per muscle group this week: ${Object.entries(weekSets(c)).map(([g, n]) => `${g} ${n}`).join(', ') || 'none'}`,
    `recent workouts: ${c.workouts.slice(0, 6).map((w) => `${dayKey(w.date)} ${w.title} (${Math.round(w.durationSec / 60)} min, ${w.entries.reduce((a, e) => a + e.sets.length, 0)} sets: ${w.entries.slice(0, 6).map((e) => { const top = e.sets.reduce((b, s) => ((s.kg ?? 0) > (b.kg ?? 0) ? s : b), e.sets[0]); return `${nameOf(c, e.exerciseId)}${top?.kg ? ` ${fmtWeight(top.kg, c.units)} x ${top.reps ?? '?'}` : ''}`; }).join(', ')})`).join(' | ') || 'none yet'}`,
    `ready-made workouts (preset ids for start_preset): ${PRESETS.map((x) => `${x.id} = ${x.title}`).join(', ')}`,
  ];
  if (c.trainer) lines.push(`Trainer program: ${c.trainer.name}, goal ${c.trainer.settings.goal}, level ${c.trainer.settings.level}, ${c.trainer.settings.frequency} days a week`);
  const n = planNow(c);
  if (n) {
    const f = n.plan.days[n.day];
    const list = f ? dayExercises(c.g, n.plan.id, n.day, c.all, c.find) : [];
    lines.push(`30-day plan in progress: ${n.plan.title}, day ${n.day + 1} of 30, today ${f ? `${FOCUS[f].label}: ${list.map((e) => e.name).join(', ')} (${n.plan.sets}x${n.plan.reps})` : 'rest day'} (start_plan_day starts it)`);
  } else lines.push(`30-day plans available (none started): ${GPLANS.map((x) => planOf(x.id).title).join(', ')}`);
  const sh = soreAgeH(m);
  if (sh != null) lines.push(`soreness last reported: ${m.sore?.where === 'all' ? 'all over the body' : m.sore?.where} ${Math.round(sh)} hours ago${sh >= 6 ? ' (may be gone: do not assume it)' : ' (assume it still holds)'}`);
  const h = c.health;
  if (h?.sleepMin) lines.push(`sleep last night: ${hours(h.sleepMin)}`);
  if (h?.restingHr) lines.push(`resting heart rate: ${h.restingHr} bpm`);
  if (h?.hrv) lines.push(`HRV: ${h.hrv} ms`);
  if (h?.steps) lines.push(`steps today: ${h.steps}`);
  if (c.readiness != null) lines.push(`recovery score today: ${c.readiness}/100`);
  lines.push('screens for open_screen: plans, workouts, stats, calendar, health, measures, routines, coach_settings');
  return lines.join('\n');
}

export type AiResult =
  | { ok: true; text: string; buttons: Btn[]; remember: string[]; remaining?: number; limit?: number }
  | { ok: false; reason: 'limit' | 'error'; limit?: number };

const SCREEN_TO: Record<string, string> = { plans: '/g', workouts: '/g', stats: '/profile/stats', calendar: '/profile/calendar', health: '/health', measures: '/profile/measures', routines: '/treino', coach_settings: '/settings/coach-ai' };
/** Botões que a IA pediu → ações do app (só os tipos conhecidos; o resto é ignorado). */
function aiButtons(c: Ctx, m: Memory, acts: Record<string, unknown>[]): Btn[] {
  return acts.flatMap((a): Btn[] => {
    const label = String(a.label ?? '').slice(0, 40);
    if (!label) return [];
    const n = planNow(c);
    switch (a.type) {
      case 'start_today': return [{ label, act: { t: 'today' } }];
      case 'start_short': return [{ label, act: expressCard(c, m, Math.max(10, Math.min(90, Number(a.minutes) || 30))).act }];
      case 'start_light': return [{ label, act: lightCard(c, m).act }];
      case 'start_plan_day': return n && n.plan.days[n.day] ? [{ label, act: { t: 'gday', planId: n.plan.id, day: n.day } }] : [];
      case 'start_preset': return PRESETS.some((p) => p.id === a.preset) ? [{ label, act: { t: 'preset', id: String(a.preset) } }] : [];
      case 'start_custom': {
        const items = (Array.isArray(a.exercises) ? a.exercises : []).flatMap((x: { name?: unknown; sets?: unknown; reps?: unknown }) => (typeof x?.name === 'string' ? [{ name: x.name, sets: Math.max(1, Math.min(8, Number(x.sets) || 3)), reps: Math.max(1, Math.min(30, Number(x.reps) || 10)) }] : [])).slice(0, 8);
        return items.length ? [{ label, act: { t: 'custom', title: String(a.title || label).slice(0, 60), items } }] : [];
      }
      case 'open_screen': return SCREEN_TO[String(a.screen)] ? [{ label, act: { t: 'nav', to: SCREEN_TO[String(a.screen)] } }] : [];
      default: return [];
    }
  });
}

/** Acha o exercício pelo nome que a IA mandou (inglês do catálogo ou nome mostrado). */
export function resolveName(all: Exercise[], name: string): Exercise | undefined {
  const q = norm(name).trim();
  if (!q) return undefined;
  let best: Exercise | undefined, score = 0;
  for (const e of all) {
    const en = e.catalogId ? (CAT_BY_ID.get(e.catalogId)?.en ?? '').toLowerCase() : '';
    for (const k of [norm(e.name), en]) {
      if (!k) continue;
      const s = k === q ? 100 : k.includes(q) ? 60 - Math.min(40, k.length - q.length) : q.includes(k) && k.length > 5 ? 30 : 0;
      if (s > score) { score = s; best = e; }
    }
  }
  return score >= 30 ? best : undefined;
}

/** Pergunta livre para a IA. `ok: false` com 'limit' quando acabou a cota do dia; 'error' quando a função não respondeu (vale a resposta local). */
export async function askAI(msgs: Msg[], c: Ctx, m: Memory): Promise<AiResult> {
  try {
    const now = Date.now();
    const tag = (at: number) => { const h = (now - at) / 3600000; return h < 3 ? '' : h < 48 ? `[${Math.round(h)} h ago] ` : `[${Math.floor(h / 24)} days ago] `; };
    const messages = msgs.slice(-16).map((x) => ({ role: x.from === 'me' ? 'user' : 'assistant', content: tag(x.at) + x.text.replace(/\*\*/g, '') }));
    const { data, error } = await supabase.functions.invoke('coach', { body: { messages, context: contextText(c, m), day: dayKey(new Date()) } });
    if (error) {
      const res = (error as { context?: Response }).context;
      if (res?.status === 429) {
        let body: { error?: string; limit?: number } = {};
        try { body = await res.json(); } catch { /* corpo vazio */ }
        if (body.error === 'limit') return { ok: false, reason: 'limit', limit: body.limit };
      }
      return { ok: false, reason: 'error' };
    }
    const d = data as { text?: string; actions?: Record<string, unknown>[]; remember?: string[]; remaining?: number; limit?: number } | null;
    if (!d?.text?.trim()) return { ok: false, reason: 'error' };
    return { ok: true, text: d.text.trim(), buttons: aiButtons(c, m, d.actions ?? []), remember: (d.remember ?? []).filter((x) => typeof x === 'string'), remaining: d.remaining, limit: d.limit };
  } catch { return { ok: false, reason: 'error' }; }
}
