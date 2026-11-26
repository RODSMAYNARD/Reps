import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Coach Reps com IA (v2, 2026-11-23): recebe as últimas mensagens do chat e um resumo dos dados do usuário (montado no app,
 * só com o consentimento dele) e devolve JSON estruturado: { text, actions[], remember[], remaining, limit }.
 * - Só para usuário logado. Chave no segredo ANTHROPIC_API_KEY; sem ela devolve 503 e o app usa a resposta local.
 * - Limite diário por usuário (segredo COACH_DAILY_LIMIT, padrão 30): a vaga é reservada ANTES de chamar a IA
 *   (rpc coach_usage_bump, atômico) e devolvida se a chamada falhar. Passou do limite = 429 { error: 'limit' }.
 * - Modelo: segredo COACH_MODEL (padrão claude-opus-5-5), esforço baixo, fallback do servidor em recusa.
 * - Resposta estruturada por output_config.format (no Opus 5.5 tool forçada dá 400).
 */
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are Coach Reps, the strength-training coach inside the Reps workout app.

You talk with one person about their training. Each request includes a summary of their data from the app: today's planned workout, the 30-day plan in progress, recent workouts and personal records, sets per muscle group this week, recovery and sleep when they allowed it, what they asked you to remember, their goal and the tone they prefer. Use it when it helps, and never invent data that is not in it.

How to answer:
- Reply in the language named in the user data ("pt" means Brazilian Portuguese, "en" means English).
- This is a phone chat: keep "text" short, usually two to five sentences, plain conversational text. You may use **bold** for an exercise or workout name. No headings, tables or bullet lists.
- Follow the tone in the user data: "motivating" is warm and energetic, "technical" explains the why with numbers, "direct" is brief and to the point. Never flatter.
- Be specific: name exercises, sets, reps and loads from their history. For a load suggestion use double progression: if they hit the target reps in every set last time, add the smallest step (2.5 kg on a barbell or machine, 1 to 2 kg on dumbbells; 5 lb in pounds); otherwise keep the weight. With low recovery or bad sleep, keep the weight and cut one set.

Actions: you cannot change anything yourself, but you can offer up to three buttons in "actions". The app runs them when the person taps. Offer one only when it is the obvious next step:
- start_today: start today's planned workout.
- start_short: a shorter version of today's workout; set "minutes".
- start_light: a light version of today's workout (2 sets, about 20% less weight).
- start_plan_day: start the current day of the 30-day plan in progress.
- start_preset: start a ready-made workout; set "preset" to one of the preset ids listed in the user data.
- start_custom: a workout you design; set "title" and "exercises" (each with name, sets, reps). Use common exercise names in English (for example "barbell bench press", "dumbbell lateral raise") so the app can find them in its library; 3 to 7 exercises.
- open_screen: open a screen; set "screen".
"label" is the button text in the person's language, at most 4 words.

Time: older messages start with a tag like [26 h ago] or [2 days ago], and the user data says when soreness was last reported. Soreness, tiredness and how the person feels are temporary. If soreness was reported more than about 6 hours ago, do not assume it still holds: give the normal, complete workout they ask for and do not mention the old soreness (the app adds its own "still sore?" question with buttons). If it was reported less than 6 hours ago, or they say it now, adapt the workout to it.

Memory: when the person tells you something lasting about themselves (an injury, an exercise they dislike or cannot do, equipment they have, their goal, a schedule constraint), put one short sentence per fact in "remember", in their language. Never put temporary states (soreness, tiredness, mood, today's sleep) in "remember". Otherwise leave it empty.

Safety: you give general training guidance, not medical care. For sharp pain, injury, numbness, chest pain, dizziness, illness or medication, tell them to stop and see a doctor or physical therapist, and offer no workout for that body part. For a diet plan, point them to a nutritionist; give only general rules of thumb about food. If the question has nothing to do with training, health habits or the app, say briefly that you only help with training and offer something you can do.`;

const ACTIONS = ['start_today', 'start_short', 'start_light', 'start_plan_day', 'start_preset', 'start_custom', 'open_screen'];
const SCREENS = ['plans', 'workouts', 'stats', 'calendar', 'health', 'measures', 'routines', 'coach_settings'];
const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'actions', 'remember'],
  properties: {
    text: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'label'],
        properties: {
          type: { type: 'string', enum: ACTIONS },
          label: { type: 'string' },
          minutes: { type: 'integer' },
          preset: { type: 'string' },
          screen: { type: 'string', enum: SCREENS },
          title: { type: 'string' },
          exercises: {
            type: 'array',
            items: { type: 'object', additionalProperties: false, required: ['name', 'sets', 'reps'], properties: { name: { type: 'string' }, sets: { type: 'integer' }, reps: { type: 'integer' } } },
          },
        },
      },
    },
    remember: { type: 'array', items: { type: 'string' } },
  },
};

type Turn = { role: 'user' | 'assistant'; content: string };
type Out = { text: string; actions: Record<string, unknown>[]; remember: string[] };

/** Dia do usuário (YYYY-MM-DD) mandado pelo app; aceito só se estiver a no máximo 1 dia da data UTC (fuso). */
function dayOf(raw: unknown) {
  const utc = new Date().toISOString().slice(0, 10);
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return utc;
  const diff = Math.abs(new Date(`${raw}T00:00:00Z`).getTime() - new Date(`${utc}T00:00:00Z`).getTime());
  return diff <= 86400000 ? raw : utc;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'not authenticated' }, 401);
  const uid = data.user.id;

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not configured' }, 503);

  let body: { messages?: Turn[]; context?: string; day?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const turns = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());
  // conversa curta e limitada: as últimas 16 mensagens, começando por uma do usuário
  const recent = turns.slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (recent.length && recent[0].role !== 'user') recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== 'user') return json({ error: 'bad request' }, 400);
  const context = (body.context ?? '').slice(0, 8000);

  // limite diário: reserva a vaga antes de gastar com a IA
  const limit = Math.max(1, parseInt(Deno.env.get('COACH_DAILY_LIMIT') ?? '30', 10) || 30);
  const day = dayOf(body.day);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: used, error: bumpErr } = await admin.rpc('coach_usage_bump', { p_user: uid, p_day: day, p_limit: limit });
  if (bumpErr) return json({ error: 'usage' }, 500);
  if (used == null) return json({ error: 'limit', limit, remaining: 0 }, 429);
  const refund = () => admin.rpc('coach_usage_refund', { p_user: uid, p_day: day });

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `User data from the app:\n${context}` },
      ],
      messages: recent,
    });
    if (res.stop_reason === 'refusal') { await refund(); return json({ error: 'refused' }, 200); }
    const raw = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('').trim();
    let out: Out;
    try { out = JSON.parse(raw); } catch { await refund(); return json({ error: 'empty' }, 200); }
    if (!out?.text?.trim()) { await refund(); return json({ error: 'empty' }, 200); }
    const actions = (Array.isArray(out.actions) ? out.actions : []).filter((a) => ACTIONS.includes(String(a?.type))).slice(0, 3);
    const remember = (Array.isArray(out.remember) ? out.remember : []).filter((x) => typeof x === 'string' && x.trim()).slice(0, 3).map((x) => x.slice(0, 200));
    return json({ text: out.text.trim(), actions, remember, remaining: Math.max(0, limit - used), limit });
  } catch (e) {
    await refund();
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'invalid key' }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `api ${e.status}` }, 502);
    return json({ error: 'failed' }, 500);
  }
});
