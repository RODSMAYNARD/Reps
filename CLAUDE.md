# Reps — app de treino de academia

## Stack
- Expo (React Native) + TypeScript + Expo Router (rotas em `src/app/`)
- Dados: AsyncStorage local (`src/lib/store.tsx`), tudo salvo no aparelho
- Sem backend por enquanto. Próximo passo planejado: Supabase (login + sincronização)

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
1. Supabase: login e sincronização
2. Fichas/rotinas de treino prontas
3. Timer de descanso
4. Recordes pessoais e metas
