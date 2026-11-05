# Reps — app de treino de academia

## Stack
- Expo SDK 58 (React Native 0.88) + TypeScript + Expo Router (rotas em `src/app/`)
- Backend: Supabase, projeto `reps` (ref `rulilgblkiwnmoiggjfd`, sa-east-1). Login e-mail/senha
- Tabelas (todas com RLS por usuário): `profiles`, `exercises`, `workouts`, `workout_sets`, `routines`, `measurements`, `feedback`
- `.env` tem só a chave PÚBLICA (publishable). Nunca commitar a service_role key

## Arquitetura: um fluxo = uma pasta em `src/app/`
- `(auth)` boas-vindas, cadastro, login, recuperar senha
- `(onboarding)` unidades → slides → sobre você → paywall
- `(tabs)` Início (feed), Treino, Perfil
- `active/` registrar treino (index) e salvar treino (save)
- `exercises/` biblioteca, detalhe (resumo/histórico/como fazer/ranking), criar, seletor (`pick`)
- `routines/` explorar, programa, categoria, prévia, detalhe, criar/editar, ajuda
- `feed/` detalhe do treino, reportar, descobrir, amigos, verificar telefone, notificações
- `profile/` editar, estatísticas (+detalhes), calendário, medidas, registrar medidas, fotos
- `settings/` unidades, tema, integrações, exportar, FAQ, guia, contato, sugestão, sobre, coach, Pro

## Código compartilhado
- `src/lib/store.tsx` — única fonte de dados (Supabase + treino ativo no AsyncStorage)
- `src/lib/stats.ts` recordes/volume/gráficos · `format.ts` unidades e datas · `constants.ts` exercícios, programas, categorias
- `src/lib/picker.ts` — canal para o seletor de exercícios devolver o resultado
- `src/components/ui.tsx` — Header, Btn, ListRow, Sheet, Dialog, gráficos etc.

## Comandos
- `npm install` · `npx expo start` (Expo Go) · `npx expo start --web`
- Antes de concluir qualquer tarefa: `npx tsc --noEmit` e `npx expo lint`
- Pacotes sempre com `npx expo install <pacote>`
- Build nas lojas: `npx eas-cli@latest build --profile preview --platform all`

## Decisões
- Layout e fluxos inspirados no Hevy (via Mobbin), com identidade própria: nome Reps, sem logo, ícones nem ilustrações do Hevy
- Textos em português do Brasil; pesos guardados em kg e convertidos na tela
- Reps em exercícios de duração = segundos
- Fotos (progresso/treino) ficam só no aparelho (sem Storage ainda)

## Só interface (sem backend real)
Login Apple/Google/Facebook, verificação de telefone por SMS, Strava/Saúde, relógio, compra do Pro, seguir amigos e comentários, tema escuro (preferência salva, tema ainda não aplicado), importação de dados.

## Pendências
- Supabase > Authentication: ativar "Leaked password protection" e decidir confirmação de e-mail
- Supabase Storage para fotos; Apple/Google sign-in nativos; RevenueCat para o Pro
- Modo offline: hoje o app precisa de internet
