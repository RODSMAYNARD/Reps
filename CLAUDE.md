# Reps — app de treino de academia

## Dono do projeto
- Rodrigo Maynard — rodrigo.maynard@gmail.com (usar em contatos, commits e contas de teste reais)

## Contas (já pagas e conectadas — NÃO perguntar de novo)
- Expo: conta `rodsappz4u` (https://expo.dev/accounts/rodsappz4u), conector Expo MCP ligado; Apple Developer já paga
- O conector Expo só lê e dispara builds de projetos existentes: o projeto `@rodsappz4u/reps` precisa existir e estar ligado ao GitHub `RODSMAYNARD/Reps`
- Supabase (projeto `reps`), GitHub e Expo já estão autorizados pelo dono

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
- `src/data/catalog.json` + `src/lib/catalog.ts` — catálogo de 1.324 exercícios embutido no app (texto do dataset MIT hasaneyldrm/exercises-dataset, traduzido para pt-BR por IA; SEM imagens/GIFs, que são © Gym visual). Gerado por `scripts/build-catalog.py`. O exercício do catálogo só vira linha em `exercises` (com `catalog_id`) quando é usado (`ensureExercises` no store); no app ele aparece com id `cat:<id>`
- `src/lib/planner.ts` — gerador de planos (objetivo, dias, nível, equipamento → rotinas) usado em `routines/generate`
- `src/lib/picker.ts` — canal para o seletor de exercícios devolver o resultado
- `src/components/ReorderList.tsx` — arrastar para reordenar exercícios no treino ativo (PanResponder, sem libs nativas)
- `src/components/ui.tsx` — Header, Btn, ListRow, Sheet, Dialog, gráficos etc.

## Comandos
- `npm install` · `npx expo start` (Expo Go) · `npx expo start --web`
- Antes de concluir qualquer tarefa: `npx tsc --noEmit` e `npx expo lint`
- Pacotes sempre com `npx expo install <pacote>`
- Build nas lojas: `npx eas-cli@latest build --profile preview --platform all`

## Decisões
- **App em inglês** (US). A versão em português está no branch git `pt-br-v1` (o push de tags é bloqueado pelo proxy desta sessão); o catálogo guarda também o pt-BR (`pt` em cada item de `catalog.json`) e `data-src/exercises-all-languages.json` tem os 10 idiomas do dataset (en, es, it, tr, ru, zh, hi, pl, ko, fr) para adicionar idiomas depois
- **Mídia dos exercícios (SÓ PARA TESTE):** 1.324 GIFs + miniaturas © Gym visual ficam no bucket PRIVADO `exercise-media` do Supabase (`gif/<id>.gif`, `thumb/<id>.jpg`), lidos por URL assinada (`src/lib/media.ts`). NÃO têm licença para distribuição: remover/trocar antes de qualquer lançamento
- Layout e fluxos inspirados no Hevy (via Mobbin), com identidade própria: nome Reps, sem logo, ícones nem ilustrações do Hevy
- Textos em português do Brasil; pesos guardados em kg e convertidos na tela
- Reps em exercícios de duração = segundos
- Fotos (progresso/treino) ficam só no aparelho (sem Storage ainda)

## Desempenho dos exercícios (arquitetura)
- Catálogo (texto) e miniaturas 96x96 (`assets/thumbs`, `src/data/thumbs.ts`) ficam DENTRO do app: listas e seletor não fazem rede.
- **Escolher um exercício do catálogo é 100% local** (id `cat:<id>` no treino/rotina em andamento). A linha na tabela `exercises` só é criada ao SALVAR o treino ou a rotina (`ensureExercises` dentro de `finishActive`/`saveRoutine`). Telas usam `findExercise(id)` e `realExerciseId(id)` do store para achar o exercício (aceita id real ou `cat:`).
- Único dado remoto de exercício: o GIF do detalhe (URL assinada do bucket privado `exercise-media`, 1 requisição ao abrir). Miniaturas e GIFs © Gym visual: SÓ TESTE, remover antes do lançamento.
- Medido: adicionar exercício ~50-80 ms; salvar treino ~2 s.

## Layout seguro (Android/iOS)
- `Screen` (ui.tsx) respeita a barra de navegação/home indicator embaixo por padrão (`edges=['top','bottom']`); telas das abas usam só `['top']` porque a tab bar já cuida do rodapé. Barras fixas no rodapé (ex.: timer de descanso) somam `useSafeAreaInsets().bottom`. Formulários usam `KeyboardAvoidingView behavior="padding"` nas duas plataformas. A skill 'Rod's Keyboard' do dono não está acessível a esta sessão.

## Treino ativo
- Exercícios recolhíveis (um a um, `Collapse all/Expand all`), reordenáveis (botão Reorder ou segurar o cabeçalho) e ocultáveis só naquele treino (`hidden` na entrada; não conta no volume nem é salvo; some para a rotina original = nada é apagado)

## Só interface (sem backend real)
Login Apple/Google/Facebook, verificação de telefone por SMS, Strava/Saúde, relógio, compra do Pro, seguir amigos e comentários, tema escuro (preferência salva, tema ainda não aplicado), importação de dados.

## Workout Settings (`settings/workout*`, botão "Settings" no treino ativo)
- Preferências em `store.wprefs` (AsyncStorage `reps:wprefs:<uid>`). Funcionam: descanso padrão (novos exercícios), valores anteriores (qualquer treino / mesma rotina; o treino guarda `routineId` em `meta`), calculadora de aquecimento (menu ⋮ do exercício; fórmula e arredondamentos), manter tela ligada (`expo-keep-awake`), calculadora de anilhas (ícone ao lado de KG em exercícios de barra), aviso de recorde pessoal ao marcar a série.
- Só interface (toggle salvo, sem efeito ainda): Sounds, RPE Tracking, Smart Superset Scrolling, Inline Timer.

## Atualizações pelo ar (OTA)
- `expo-updates` + `runtimeVersion: fingerprint`; canais: development/preview/production (eas.json). Android de teste = canal `preview`; iOS TestFlight = `production`.
- Publicar: `workflow_run` com fileName `update.yml` (gitRef `main`) — NÃO precisa de build. Só JS/telas/textos chegam; pacote nativo novo muda o fingerprint e exige build novo (com autorização do Rodrigo).
- O app baixa a atualização ao abrir e aplica na próxima abertura.

## Pendências
- Storage: apagar a pasta `probe/` (1 arquivo de teste) do bucket `exercise-media` pelo painel do Supabase
- Internacionalização: hoje os textos estão fixos em inglês; criar camada de idiomas e reativar pt-BR
- Mídia dos exercícios: exige licença própria da Gym visual (https://gymvisual.com/) ou outra fonte livre
- Conferir amostras das traduções (feitas por IA) e corrigir termos
- Supabase > Authentication: ativar "Leaked password protection" e decidir confirmação de e-mail
- Supabase Storage para fotos; Apple/Google sign-in nativos; RevenueCat para o Pro
- Modo offline: hoje o app precisa de internet

## Regras do dono (builds)
- NÃO disparar builds (Android/iOS) nem enviar ao TestFlight sem autorização expressa do Rodrigo na mensagem. Implementar, validar (`tsc`, lint) e commitar; perguntar antes de buildar.
