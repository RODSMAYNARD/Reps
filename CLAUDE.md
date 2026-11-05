# Reps — app de treino de academia

## Stack
- Expo (React Native) + TypeScript + Expo Router (rotas em `src/app/`)
- Backend: Supabase, projeto `reps` (ref `rulilgblkiwnmoiggjfd`, região sa-east-1). Login por e-mail/senha
- Dados: tabelas `exercises`, `workouts`, `workout_sets`, todas com RLS (cada usuário só vê os próprios dados)
- `src/lib/store.tsx` é a única fonte de dados; o treino em andamento (`draft`) fica no AsyncStorage até finalizar
- `.env` tem só a chave PÚBLICA (publishable). Nunca commitar a service_role key

## Estrutura
- `src/app/(tabs)/` — telas: Treino, Exercícios, Histórico, Progresso
- `src/lib/` — tipos, tema e store (única fonte de dados)
- `src/components/ui.tsx` — Button, Input, Card, Chip, Empty

## Comandos
- `npm install` · `npx expo start` (Expo Go no celular) · `npx expo start --web`
- Antes de concluir qualquer tarefa: `npx tsc --noEmit` e `npx expo lint`
- Instalar pacotes sempre com `npx expo install <pacote>`

## Decisões
- Tema escuro, textos em português do Brasil
- Treino em andamento fica em `draft` até o usuário finalizar
- Progresso = maior carga do exercício em cada treino (últimos 12)

## Roadmap
1. Fichas/rotinas de treino prontas
2. Timer de descanso
3. Recordes pessoais e metas

## Pendências
- Ativar "Leaked password protection" em Supabase > Authentication > Providers > Email
- Decidir se o cadastro exige confirmação de e-mail (Supabase > Authentication)
- Modo offline: hoje o app precisa de internet para carregar e salvar
