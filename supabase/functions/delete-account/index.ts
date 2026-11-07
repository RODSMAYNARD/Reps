import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// E-mail de confirmação (best-effort: só sai se RESEND_API_KEY existir; nunca impede a exclusão).
async function goodbye(to: string) {
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('EMAIL_FROM') ?? 'Reps <onboarding@resend.dev>', to: [to], subject: 'Your Reps account was deleted', html: '<p>We deleted your Reps account and all of your data. This cannot be undone.</p><p>If this was not you, reply to this email right away.</p>' }),
  }).catch(() => {});
}

// Apaga a conta de quem chama: arquivos do Storage e o usuário do Auth (as tabelas apagam em cascata).
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json({ error: 'not authenticated' }, 401);
  const uid = data.user.id;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  for (const bucket of ['progress-photos']) {
    const list = await admin.storage.from(bucket).list(uid, { limit: 1000 });
    const paths = (list.data ?? []).map((f) => `${uid}/${f.name}`);
    if (paths.length) await admin.storage.from(bucket).remove(paths);
  }
  const del = await admin.auth.admin.deleteUser(uid);
  if (del.error) return json({ error: del.error.message }, 500);
  if (data.user.email) await goodbye(data.user.email);
  return json({ ok: true });
});
