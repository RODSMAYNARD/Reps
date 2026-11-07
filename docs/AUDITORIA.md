# Auditoria dos fluxos (2026-11-07)

Leitura do código por 3 agentes (sem rodar o app). Status: COMPLETO / PARCIAL / SÓ INTERFACE / QUEBRADO.

## Plano de execução (ordem decidida)
**Lote 1 — robustez (feito):** tela "Try again" quando a carga inicial falha (antes caía no onboarding), `saveProfile/saveMeasurement/deleteMeasurement/sendFeedback` devolvem sucesso e as telas só mostram "salvo/enviado" quando é verdade.
**Lote 2 — sem depender de conta externa:** recuperar senha (redirectTo + tela de nova senha), confirmações destrutivas (remover exercício/série no treino, sair do editor de rotina com mudanças), aviso ao finalizar com séries não marcadas, esconder o "social falso" (atletas demo, Discover, like/comentário, notificações, verificar telefone, Followers 0), tirar "Coming soon" (Integrations, Coach, Import, Workout Link, Leaderboard), exportar CSV como arquivo, editar exercício criado, URLs/e-mail de suporte configuráveis.
**Lote 3 — banco/servidor (pede aprovação):** apagar conta (Edge Function com service role), Trainer e preferências no Supabase, fotos no Storage (progresso e treino), fila offline, treino ativo restaurado offline, paginação de `workouts`, `.env` fora do git, migrations versionadas.
**Lote 4 — lançamento (depende do Rodrigo):** Apple/Google sign-in, produtos RevenueCat e gating do Pro, política de privacidade/termos publicados, consentimento de telemetria, mídia licenciada, idioma (i18n).

## Por pasta (resumo)
- **(auth):** e-mail/senha real; Apple/Google/Facebook = "Coming soon"; recuperação de senha sem tela de destino; e-mail não confirmado sem reenvio; mensagens cruas do Supabase.
- **(onboarding):** completo; paywall não avança sozinho após a compra.
- **(tabs):** Home = só "My Workouts" (feed social inexistente, atletas demo fixos); Followers/Following = 0 fixo; excluir rotina sem confirmação.
- **settings:** Units/Theme/Workout/Timer completos; Export só texto e sempre em kg; Import, Integrations e Coach = só interface; About com example.com; Pro sem gating nem estado "você é Pro".
- **active:** completo no essencial; remover exercício/série sem confirmação; superset só rótulo; descanso/cronômetro não sobrevivem ao fechar; foto do treino só local; "Workout Link" só toast.
- **exercises:** criar completo (sem anti-duplo-toque); editar não existe; 3 tipos "Coming soon" (distância); aba Leaderboard estática; imagem custom só no aparelho.
- **routines:** CRUD completo; editor sem reordenar/superset, descarta alterações sem avisar; gerar plano não trata falha parcial.
- **trainer:** funciona, mas só no aparelho; Skip sem confirmação; nenhum gating de Pro.
- **feed:** tudo social é só interface (Discover, Friends, Verify phone, Notifications, like/comentário); Report mostrava "obrigado" mesmo com erro (corrigido no lote 1).
- **profile:** estatísticas/relatório/calendário completos; editar perfil sem validar username; fotos de progresso só locais; medidas sem retorno de erro (corrigido no lote 1).
- **lib:** `load` sem try/catch (corrigido no lote 1); sem paginação (limite ~1000 linhas); `.env` (só chaves públicas) está no git; PostHog sem consentimento; mídia de exercício sem licença (`lib/media.ts`).

## Bloqueios de loja (Apple)
Apagar conta in-app · Sign in with Apple se houver login social · política de privacidade e termos reais · paywall sem texto de "preview" e com links legais · sem conteúdo "coming soon"/perfis falsos · consentimento/Privacy Labels.
