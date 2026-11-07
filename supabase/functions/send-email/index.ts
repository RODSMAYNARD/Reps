import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const shell = (title: string, body: string) => `<!doctype html><html><body style="margin:0;background:#f2f4f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;padding:32px 20px"><div style="background:#fff;border-radius:16px;padding:28px"><div style="font-weight:800;letter-spacing:4px;color:#0b1220;font-size:18px">REPS</div><h1 style="color:#0b1220;font-size:22px;margin:20px 0 12px">${title}</h1><div style="color:#3b4456;font-size:16px;line-height:1.55">${body}</div></div><p style="color:#8a93a6;font-size:12px;text-align:center;margin-top:16px">You are receiving this because you have a Reps account.</p></div></body></html>`;

export const TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: 'Welcome to Reps',
    html: shell('Welcome to Reps', '<p>Your account is ready. Log your first workout, build a routine, and watch your progress add up.</p><p>Tip: start from a routine or let the Trainer build a plan for you.</p>'),
  },
  account_deleted: {
    subject: 'Your Reps account was deleted',
    html: shell('Your account was deleted', '<p>We deleted your Reps account and all of your data. This cannot be undone.</p><p>If this was not you, reply to this email right away.</p>'),
  },
};

export async function sendMail(to: string, type: 'welcome' | 'account_deleted') {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return { skipped: 'RESEND_API_KEY is not set' };
  const t = TEMPLATES[type];
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') ?? 'Reps <onboarding@resend.dev>', to: [to], subject: t.subject, html: t.html, reply_to: Deno.env.get('EMAIL_REPLY_TO') || undefined }),
  });
  if (!r.ok) return { error: await r.text() };
  return { ok: true };
}

// Envia e-mails transacionais para QUEM CHAMA (o destinatário sai do login, nunca do corpo do pedido).
// Segredos (Supabase > Edge Functions > Secrets): RESEND_API_KEY, EMAIL_FROM ("Reps <hello@seudominio.com>"), EMAIL_REPLY_TO (opcional).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user?.email) return json({ error: 'not authenticated' }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.type !== 'welcome') return json({ error: 'unknown type' }, 400);
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const st = await admin.from('user_state').select('welcome_sent_at').eq('user_id', data.user.id).maybeSingle();
  if (st.data?.welcome_sent_at) return json({ skipped: 'already sent' });
  const res = await sendMail(data.user.email, 'welcome');
  if ('ok' in res) await admin.from('user_state').upsert({ user_id: data.user.id, welcome_sent_at: new Date().toISOString() }, { onConflict: 'user_id' });
  return json(res);
});
