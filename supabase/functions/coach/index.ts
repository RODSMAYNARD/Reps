import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Coach Reps com IA: recebe as últimas mensagens do chat e um resumo dos dados do usuário (montado no app) e devolve a resposta.
 * Só para usuário logado. A chave fica no segredo ANTHROPIC_API_KEY do Supabase; sem ela devolve 503 e o app usa a resposta local.
 * Modelo: segredo COACH_MODEL (padrão claude-opus-5-5).
 */
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const SYSTEM = `You are Coach Reps, the strength-training coach inside the Reps workout app.

You talk with one person about their training. Each request includes a summary of their data from the app (today's planned workout, recent workouts, weekly numbers, plans and challenges). Use it when it helps the answer, and never invent data that is not in it.

How to answer:
- Reply in the language named in the user data ("pt" means Brazilian Portuguese, "en" means English).
- This is a phone chat: keep replies short, usually two to five sentences, in plain conversational text. You may use **bold** for an exercise or workout name. Do not use headings, tables or bullet lists.
- Be specific and practical, the way a good personal trainer talks, and warm without flattery.
- You cannot start workouts, change routines or change settings. When that is what the person needs, tell them which shortcut under the chat or which screen of the app does it.
- You give general training guidance, not medical care. For sharp pain, injury, illness or medication, tell them to stop and see a doctor or physical therapist. For a diet plan, point them to a nutritionist, and give only general rules of thumb about food.
- If the question has nothing to do with training, health habits or the app, say briefly that you only help with training and offer something you can do.`;

type Turn = { role: 'user' | 'assistant'; content: string };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'not authenticated' }, 401);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'not configured' }, 503);

  let body: { messages?: Turn[]; context?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad request' }, 400); }
  const turns = (body.messages ?? []).filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim());
  // conversa curta e limitada: as últimas 16 mensagens, começando por uma do usuário
  const recent = turns.slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  while (recent.length && recent[0].role !== 'user') recent.shift();
  if (!recent.length || recent[recent.length - 1].role !== 'user') return json({ error: 'bad request' }, 400);
  const context = (body.context ?? '').slice(0, 6000);

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.beta.messages.create({
      model: Deno.env.get('COACH_MODEL') ?? 'claude-opus-5-5',
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `User data from the app:\n${context}` },
      ],
      messages: recent,
    });
    if (res.stop_reason === 'refusal') return json({ error: 'refused' }, 200);
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n').trim();
    if (!text) return json({ error: 'empty' }, 200);
    return json({ text });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return json({ error: 'invalid key' }, 503);
    if (e instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429);
    if (e instanceof Anthropic.APIError) return json({ error: `api ${e.status}` }, 502);
    return json({ error: 'failed' }, 500);
  }
});
