import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';
import { catKey, catName, norm } from './catalog';
import { challengeViews, fmtProgress, type CState } from './challenges';
import { MUSCLE_GROUPS, PROGRAMS } from './constants';
import { LB, fmtVolume } from './format';
import { GPLANS, type GState } from './gplan';
import { getLang } from './i18n';
import { dayKey, startOfWeek, weeklySeries } from './stats';
import { substitutesFor } from './substitutes';
import { supabase } from './supabase';
import { dayStreak, estMin, fromTemplate, todayPlan, type TodayPlan } from './today';
import type { ActiveWorkout, Exercise, Routine, SavedEntry, SetRow, TrainerProgram, Units, Workout } from './types';

/**
 * Coach Reps (aba Coach): conversa montada NO APARELHO com os dados do app (treino de hoje, histórico, sono, planos, desafios).
 * Não há IA nem servidor: `reply` reconhece o assunto por palavras-chave (inglês e português) e responde com frases prontas.
 * Os textos ficam aqui nos dois idiomas (`L`), fora do dicionário, porque são frases montadas com variáveis.
 * A conversa fica só no aparelho (`reps:coach:<uid>`).
 */
export const L = (en: string, pt: string) => (getLang() === 'pt' ? pt : en);

/** O que o cartão de uma mensagem faz ao ser tocado (precisa ser serializável: a conversa é salva). */
export type Action =
  | { t: 'today' } // treino de hoje, com as trocas combinadas no chat
  | { t: 'trainer'; uid: string }
  | { t: 'routine'; id: string }
  | { t: 'entries'; title: string; entries: SavedEntry[]; trainerUid?: string }
  | { t: 'resume' }
  | { t: 'nav'; to: string };
export type Card = { icon: string; title: string; sub: string; act: Action };
export type Msg = { id: string; from: 'coach' | 'me'; text: string; card?: Card; at: number };
export type Draft = { text: string; card?: Card };
export type Memory = {
  pending?: 'sore' | 'swap' | 'swapPick';
  swapFrom?: string;
  swapOpts?: { id: string; name: string }[];
  /** Trocas combinadas para o treino de hoje: exercício original → novo. Valem só no dia `swapsDay`. */
  swaps?: Record<string, string>;
  swapsDay?: string;
};
export type CoachState = { msgs: Msg[]; mem: Memory; greeted: string; ready: boolean };

export type Ctx = {
  name: string; units: Units; workouts: Workout[]; routines: Routine[]; trainer: TrainerProgram | null; active: ActiveWorkout | null;
  weeklyGoal: number; find: (id: string) => Exercise | undefined; prev: (id: string) => SetRow[];
  sleepMin?: number; readiness?: number | null; g: GState; ch: CState;
};
export type Out = { msgs: Draft[]; chips?: string[]; mem: Memory; run?: Action; intent: string };

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
  if (uid) AsyncStorage.setItem(`reps:coach:${uid}`, JSON.stringify({ msgs: state.msgs, mem: state.mem, greeted: state.greeted })).catch(() => {});
}
export const pushMsg = (from: Msg['from'], d: Draft) => setCoach((s) => ({ msgs: [...s.msgs, { id: `${Date.now()}-${seq++}`, from, text: d.text, card: d.card, at: Date.now() }] }));
export const getCoach = () => state;
export const clearCoach = () => setCoach({ msgs: [], mem: {}, greeted: '' });

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
const todayCard = (c: Ctx, m: Memory): Card => {
  if (c.active) return { icon: 'play', title: c.active.title || L('Workout', 'Treino'), sub: L('In progress · tap to resume', 'Em andamento · toque para voltar'), act: { t: 'resume' } };
  const p = planFor(c, m);
  return { icon: 'barbell', title: p.title, sub: sub(p.entries.length, p.minutes), act: { t: 'today' } };
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

// ---------- respostas ----------
const B = (s: string) => `**${s}**`;
const hours = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;
const daysAgo = (iso: string) => Math.round((new Date(today()).getTime() - new Date(dayKey(iso)).getTime()) / 86400000);

export function baseChips(c: Ctx): string[] {
  return [
    c.active ? L('Resume workout', 'Voltar ao treino') : L('Start workout', 'Começar treino'),
    L('I only have 30 min', 'Tenho só 30 min'),
    L('Swap an exercise', 'Trocar exercício'),
    L("I'm sore", 'Estou dolorido'),
    L('My progress', 'Meu progresso'),
    L('Plans and challenges', 'Planos e desafios'),
  ];
}

/** Abertura do dia: saudação com o último treino (e o sono, se houver relógio), o treino de hoje e o cartão para começar. */
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

  const p = planFor(c, m);
  const streak = dayStreak(c.workouts);
  let second = ago === 0
    ? L(`If you still have energy, ${B(p.title)} is next on your list. If not, rest: that's when the muscle grows.`, `Se ainda tiver energia, o próximo da lista é ${B(p.title)}. Se não, descanse: é no descanso que o músculo cresce.`)
    : L(`Today is ${B(p.title)} day: ${p.entries.length} exercises, mostly ${focusText(c, p.entries)}.`, `Hoje é dia de ${B(p.title)}: ${p.entries.length} exercícios, com foco em ${focusText(c, p.entries)}.`);
  if (c.readiness != null && c.readiness < 50) second += L(` Your recovery is low today (${c.readiness}/100), so keep the weights a little lighter.`, ` Sua recuperação está baixa hoje (${c.readiness}/100), então pegue um pouco mais leve.`);
  else if (c.readiness != null && c.readiness >= 75) second += L(` Your recovery is high (${c.readiness}/100): a good day to push.`, ` Sua recuperação está alta (${c.readiness}/100): bom dia para apertar.`);
  else if (streak >= 3) second += L(` That makes ${streak} days in a row.`, ` Já são ${streak} dias seguidos.`);
  return [{ text: first }, { text: second }, { text: L(`It takes about ${p.minutes} min. Shall we?`, `Leva uns ${p.minutes} min. Bora?`), card: todayCard(c, m) }];
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
  return { icon: 'barbell', title: best.x.title, sub: sub(best.x.entries.length, estMin(best.x.entries.reduce((a, e) => a + e.sets.length, 0))), act: best.x.act };
}

function sore(t: string, c: Ctx, m: Memory): Out {
  const g = groupIn(t);
  const all = /tudo|todo|all over|everything|geral|inteiro|whole|cansad|tired|exhaust|fatig|moid/.test(t);
  if (!g && !all)
    return { intent: 'sore_ask', mem: { ...m, pending: 'sore' }, msgs: [{ text: L('Where are you sore?', 'Onde está dolorido?') }], chips: [...['Legs', 'Chest', 'Back', 'Shoulders', 'Arms'].map((x) => { const n = groupName(x); return n[0].toUpperCase() + n.slice(1); }), L('All over', 'O corpo todo')] };
  const mem = { ...m, pending: undefined };
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
  if (c.active) return { intent: 'swap', mem: { ...m, pending: undefined }, msgs: [{ text: L(`You are mid-workout: open it and tap ${B('Swap')} under the exercise. I show 3 or 4 options for the same muscle right there.`, `Você está no meio do treino: abra o treino e toque em ${B('Swap')} embaixo do exercício. Eu mostro 3 ou 4 opções para o mesmo músculo ali mesmo.`), card: todayCard(c, m) }] };
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
  const cur = GPLANS.find((p) => { const d = c.g.done[p.id] ?? 0; return d > 0 && d < 30; });
  const tp = (t: string) => t; // os títulos dos planos são traduzidos pela tela; aqui vão como estão
  const one: Draft = cur
    ? { text: L(`You are on day ${(c.g.done[cur.id] ?? 0) + 1} of 30 in ${B(tp(cur.title))}. Keep going.`, `Você está no dia ${(c.g.done[cur.id] ?? 0) + 1} de 30 do plano ${B(tp(cur.title))}. Continue.`), card: { icon: 'calendar', title: L('30-day plans', 'Planos de 30 dias'), sub: L('Open my plan', 'Abrir meu plano'), act: { t: 'nav', to: '/g' } } }
    : { text: L(`There are ${GPLANS.length} plans of 30 days, each with a workout ready for every day: muscle, strength, stamina, legs, core and one for beginners.`, `São ${GPLANS.length} planos de 30 dias, cada um com o treino de cada dia já pronto: massa, força, resistência, pernas, abdômen e um para iniciantes.`), card: { icon: 'calendar', title: L('30-day plans', 'Planos de 30 dias'), sub: L('Choose a plan', 'Escolher um plano'), act: { t: 'nav', to: '/g' } } };
  const views = challengeViews(c.ch, c.workouts, c.units);
  const act = views.find((v) => v.status === 'active'); // desafios são automáticos: sempre valendo na semana/mês
  const card: Card = { icon: 'trophy', title: L('Challenges', 'Desafios'), sub: L('See all challenges', 'Ver todos os desafios'), act: { t: 'nav', to: '/challenges' } };
  const two: Draft = act?.p
    ? { text: L(`Challenge in progress: ${fmtProgress(act.c, act.p, c.units)}, ${act.p.daysLeft} day${act.p.daysLeft === 1 ? '' : 's'} left.`, `Desafio em andamento: ${fmtProgress(act.c, act.p, c.units)}, faltam ${act.p.daysLeft} dia${act.p.daysLeft === 1 ? '' : 's'}.`), card }
    : { text: L('You have completed every challenge this period. They start over automatically next week or month.', 'Você concluiu todos os desafios deste período. Eles recomeçam sozinhos na próxima semana ou mês.'), card };
  return { intent: 'plans', mem: m, msgs: [one, two] };
}

function restDay(c: Ctx, m: Memory): Out {
  const streak = dayStreak(c.workouts);
  const trainedToday = !!c.workouts[0] && daysAgo(c.workouts[0].date) === 0;
  if (trainedToday) return { intent: 'rest', mem: m, msgs: [{ text: L('You already trained today. Rest now: eat well and sleep. The gain happens in recovery.', 'Você já treinou hoje. Agora descanse: coma bem e durma. O ganho acontece na recuperação.') }] };
  if (streak >= 4) return { intent: 'rest', mem: m, msgs: [{ text: L(`You have trained ${streak} days in a row. A day off now helps you come back stronger. If you really want to move, do a light session.`, `Você treinou ${streak} dias seguidos. Um dia de folga agora ajuda a voltar mais forte. Se quiser muito se mexer, faça uma sessão leve.`), card: lightCard(c, m) }] };
  if (c.readiness != null && c.readiness < 50) return { intent: 'rest', mem: m, msgs: [{ text: L(`Your recovery is low today (${c.readiness}/100). Rest, or do a light session.`, `Sua recuperação está baixa hoje (${c.readiness}/100). Descanse ou faça uma sessão leve.`), card: lightCard(c, m) }] };
  return { intent: 'rest', mem: m, msgs: [{ text: L('Nothing in your history says you need a day off. You are good to train today.', 'Nada no seu histórico pede folga. Pode treinar hoje.'), card: todayCard(c, m) }] };
}

/** Perguntas gerais de treino (respostas curtas, regra de bolso; nada de dieta ou diagnóstico). */
const FAQ: [string, RegExp, string, string][] = [
  ['injury', /lesao|lesion|machuqu|injur|sharp pain|dor forte|dor aguda|estalo|torci|hurt bad/, 'Sharp pain is not the same as muscle soreness. Stop the exercise that hurts, do not train through it, and see a doctor or physical therapist if it does not improve in a few days.', 'Dor aguda não é o mesmo que dor muscular. Pare o exercício que dói, não treine por cima da dor e procure um médico ou fisioterapeuta se não melhorar em alguns dias.'],
  ['frequency', /quantas vezes|how often|how many days|quantos dias|vezes por semana|times a week|frequencia/, 'For most people 3 to 5 workouts a week works well. What matters most is training each muscle about twice a week and not missing weeks.', 'Para a maioria, 3 a 5 treinos por semana funciona bem. O que mais conta é treinar cada músculo umas duas vezes por semana e não falhar semanas.'],
  ['rest_sets', /entre (as )?series|between sets|quanto.*descans|how long.*rest|tempo de descanso|rest time/, 'Rest 2 to 3 minutes on heavy compound lifts (squat, bench, deadlift, rows) and 60 to 90 seconds on smaller exercises. Short rests cost you reps.', 'Descanse 2 a 3 minutos nos exercícios pesados e compostos (agachamento, supino, terra, remadas) e 60 a 90 segundos nos menores. Descanso curto demais tira repetições.'],
  ['sets', /quantas series|how many sets|quantas rep|how many reps|series por|sets per|volume ideal/, 'A good range to build muscle is 10 to 20 hard sets per muscle per week, with 6 to 15 reps per set, stopping 1 to 3 reps before failure.', 'Uma boa faixa para ganhar massa é de 10 a 20 séries puxadas por músculo por semana, com 6 a 15 repetições, parando 1 a 3 repetições antes da falha.'],
  ['warmup', /aquec|warm ?up/, 'Do about 5 minutes of light movement, then 2 or 3 lighter sets of the first exercise (around 40%, 60% and 80% of the working weight). In the workout, the exercise menu has a warm-up calculator.', 'Faça uns 5 minutos de movimento leve e depois 2 ou 3 séries mais leves do primeiro exercício (perto de 40%, 60% e 80% do peso de trabalho). No treino, o menu do exercício tem uma calculadora de aquecimento.'],
  ['overload', /aumentar (o )?peso|increase.*weight|add weight|subir (a )?carga|estagn|plateau|progressao|progressive|quando aumentar/, 'When you hit the top of the rep range in every set, add the smallest step next time (2.5 kg or 5 lb on the bar). If you are stuck for 3 weeks, drop the weight 10% and build back up.', 'Quando você bater o topo da faixa de repetições em todas as séries, suba o menor degrau na próxima vez (2,5 kg na barra). Se travar por 3 semanas, baixe 10% e suba de novo.'],
  ['protein', /protein|dieta|diet|comer|\beat\b|aliment|caloria|calorie|suplement|creatin|whey/, 'I am a training coach, so on food I only give the rule of thumb: about 1.6 to 2.2 g of protein per kg of body weight a day, spread over your meals. For a diet plan, see a nutritionist.', 'Sou coach de treino, então de comida eu só passo a regra de bolso: cerca de 1,6 a 2,2 g de proteína por kg de peso por dia, divididos nas refeições. Para um plano alimentar, procure um nutricionista.'],
  ['fatloss', /emagrec|lose (fat|weight)|perder (peso|gordura)|secar|queimar gordura|burn fat/, 'Fat loss comes mostly from eating a little less than you burn. Keep lifting to hold on to muscle, walk more during the day and be patient: about half a kilo a week is a good pace.', 'Emagrecer vem principalmente de comer um pouco menos do que você gasta. Continue treinando com peso para segurar o músculo, caminhe mais no dia e tenha paciência: cerca de meio quilo por semana é um bom ritmo.'],
  ['sleep', /\bsono\b|dormir|dormi|\bsleep|insonia/, 'Sleep is where the training turns into result. Aim for 7 to 9 hours, with a regular bedtime. After a bad night, train lighter instead of skipping.', 'É no sono que o treino vira resultado. Mire em 7 a 9 horas, com horário regular para deitar. Depois de uma noite ruim, treine mais leve em vez de faltar.'],
];

/** Resposta do Coach para o que o usuário escreveu (ou tocou nos atalhos). */
export function reply(raw: string, c: Ctx, m: Memory): Out {
  const t = norm(raw).replace(/[?!.,;]/g, ' ').trim();
  const clear = { ...m, pending: undefined };
  const tc = () => todayCard(c, clear);

  if (m.pending === 'swap' || m.pending === 'swapPick') { const o = swap(t, c, m); if (o) return o; }
  if (m.pending === 'sore' && (groupIn(t) || /tudo|todo|all over|everything|geral|inteiro|whole/.test(t))) return sore(t, c, m);

  for (const [id, re, en, pt] of FAQ) if (re.test(t)) return { intent: `faq_${id}`, mem: clear, msgs: [{ text: L(en, pt) }] };

  const mins = t.match(/(\d+)\s*(min|m\b)/) ?? t.match(/(\d+)\s*(h\b|hora|hour)/);
  if (mins || /pouco tempo|sem tempo|short on time|\bquick|rapid|curto|express|so tenho|only have|pressa|hurry/.test(t)) {
    if (c.active) return { intent: 'time', mem: clear, msgs: [{ text: L('You are mid-workout: finish the sets of the main exercises and hide the rest for today (exercise menu, Hide only for this workout).', 'Você está no meio do treino: termine as séries dos exercícios principais e esconda o resto por hoje (menu do exercício, Hide only for this workout).'), card: tc() }] };
    const n = mins ? parseInt(mins[1], 10) * (/h|hora|hour/.test(mins[2]) && !/min|^m$/.test(mins[2]) ? 60 : 1) : 30;
    const p = planFor(c, clear);
    if (n >= p.minutes) return { intent: 'time', mem: clear, msgs: [{ text: L(`${n} min is enough for the whole ${B(p.title)}.`, `${n} min dá para o ${B(p.title)} inteiro.`), card: tc() }] };
    const card = expressCard(c, clear, Math.max(10, n));
    const count = card.act.t === 'entries' ? card.act.entries.length : 0;
    return { intent: 'time', mem: clear, msgs: [{ text: L(`No problem: a short version with the ${count} main exercises and 60 s of rest.`, `Sem problema: versão curta com os ${count} exercícios principais e descanso de 60 s.`), card }] };
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
    return { intent: 'today', mem: clear, msgs: [{ text: c.active ? L(`You have ${B(c.active.title)} in progress.`, `Você tem ${B(c.active.title)} em andamento.`) : L(`Today is ${B(p.title)}: ${p.entries.length} exercises, mostly ${focusText(c, p.entries)}, about ${p.minutes} min.`, `Hoje é ${B(p.title)}: ${p.entries.length} exercícios, com foco em ${focusText(c, p.entries)}, uns ${p.minutes} min.`), card: tc() }] };
  }
  if (/obrigad|valeu|thanks|thank you|\bthx\b/.test(t)) return { intent: 'thanks', mem: clear, msgs: [{ text: L('Anytime. I am here when you need me.', 'Disponha. Estou aqui quando precisar.') }] };
  if (/^(oi|ola|hello|hi|hey|e ai|bom dia|boa tarde|boa noite|good (morning|afternoon|evening))\b/.test(t)) return { intent: 'hello', mem: clear, msgs: [{ text: L(`Hi${c.name ? `, ${c.name}` : ''}! Want to see today's workout?`, `Oi${c.name ? `, ${c.name}` : ''}! Quer ver o treino de hoje?`), card: tc() }] };
  const help = L('I can set up today\'s workout, make a shorter or lighter version, swap an exercise, show your progress and suggest plans and challenges. I also answer basic training questions: sets, rest, warm-up, when to add weight.', 'Eu monto o treino de hoje, faço uma versão mais curta ou mais leve, troco um exercício, mostro a sua evolução e sugiro planos e desafios. Também respondo dúvidas básicas de treino: séries, descanso, aquecimento, quando subir o peso.');
  if (/ajuda|help|o que voce (faz|sabe)|what can you/.test(t)) return { intent: 'help', mem: clear, msgs: [{ text: help }] };
  return { intent: 'unknown', mem: clear, msgs: [{ text: `${L('I do not know how to answer that yet.', 'Essa eu ainda não sei responder.')} ${help}` }] };
}

// ---------- IA (Edge Function `coach`) ----------
/** Resumo dos dados do usuário que vai junto com a pergunta para a IA (texto curto, sem e-mail nem id). */
export function contextText(c: Ctx, m: Memory): string {
  const p = planFor(c, m);
  const ws = startOfWeek();
  const week = c.workouts.filter((w) => new Date(w.date) >= ws).length;
  const goal = c.weeklyGoal || c.trainer?.settings.frequency || 0;
  const lines = [
    `language: ${getLang()}`,
    `name: ${c.name || 'unknown'}`,
    `weight unit: ${c.units.weight}`,
    `today: ${dayKey(new Date())}`,
    c.active ? `workout in progress: ${c.active.title}` : `today's planned workout: ${p.title} (~${p.minutes} min): ${p.entries.map((e) => `${nameOf(c, e.exerciseId)} ${e.sets.length}x${e.sets[0]?.reps ?? '?'}`).join('; ')}`,
    `workouts this week: ${week}${goal ? ` of a goal of ${goal}` : ''}; day streak: ${dayStreak(c.workouts)}; total workouts: ${c.workouts.length}`,
    `recent workouts: ${c.workouts.slice(0, 6).map((w) => `${dayKey(w.date)} ${w.title} (${Math.round(w.durationSec / 60)} min, ${w.entries.reduce((a, e) => a + e.sets.length, 0)} sets: ${w.entries.slice(0, 6).map((e) => { const top = e.sets.reduce((b, s) => ((s.kg ?? 0) > (b.kg ?? 0) ? s : b), e.sets[0]); return `${nameOf(c, e.exerciseId)}${top?.kg ? ` ${fmtVolume(top.kg, c.units)} x ${top.reps ?? '?'}` : ''}`; }).join(', ')})`).join(' | ') || 'none yet'}`,
  ];
  if (c.trainer) lines.push(`Trainer program: ${c.trainer.name}, goal ${c.trainer.settings.goal}, level ${c.trainer.settings.level}, ${c.trainer.settings.frequency} days a week`);
  const plan = GPLANS.find((x) => { const d = c.g.done[x.id] ?? 0; return d > 0 && d < 30; });
  if (plan) lines.push(`30-day plan in progress: ${plan.title}, day ${(c.g.done[plan.id] ?? 0) + 1} of 30`);
  const act = challengeViews(c.ch, c.workouts, c.units).filter((v) => v.status === 'active' && v.p);
  if (act.length) lines.push(`challenges in progress: ${act.map((v) => `${v.c.title} ${fmtProgress(v.c, v.p!, c.units)}`).join('; ')}`);
  if (c.sleepMin) lines.push(`sleep last night: ${hours(c.sleepMin)}`);
  if (c.readiness != null) lines.push(`recovery score today: ${c.readiness}/100`);
  lines.push('shortcuts under the chat: start workout, 30-minute version, swap an exercise, sore, my progress, plans and challenges');
  return lines.join('\n');
}

/** Pergunta livre para a IA. Devolve o texto, ou null se a função não respondeu (sem chave, sem rede, recusa): aí vale a resposta local. */
export async function askAI(msgs: Msg[], c: Ctx, m: Memory): Promise<string | null> {
  try {
    const messages = msgs.slice(-16).map((x) => ({ role: x.from === 'me' ? 'user' : 'assistant', content: x.text.replace(/\*\*/g, '') }));
    const { data, error } = await supabase.functions.invoke('coach', { body: { messages, context: contextText(c, m) } });
    if (error) return null;
    const text = (data as { text?: string } | null)?.text;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
  } catch { return null; }
}
