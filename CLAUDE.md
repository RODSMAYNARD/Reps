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
- Catálogo (texto) e miniaturas 96x96 ficam DENTRO do app como recurso nativo de verdade: `src/data/thumbs.ts` tem um `require('../../assets/thumbs/<id>.jpg')` por exercício (gerado por `scripts/build-thumbs.py`), decisão do Rodrigo (2026-11-05) — "deixar o máximo dentro do app". Listas e seletor não fazem rede, sem custo de decodificação (resource id pré-compilado no build).
- **Isso só chega ao usuário por BUILD novo, nunca por atualização OTA**: o EAS Update aceita no máximo 1000 arquivos por atualização e os 1.324 estouram esse limite. Se faltar build e for preciso atualizar algo que usa `ExerciseThumb` por OTA, a saída de emergência é `scripts/build-thumbs-base64.py` (removido; recriar se precisar) embutindo como data URI no JS — funciona, mas é mais pesado e só para emergência, nunca a versão definitiva.
- **Já tentamos uma folha única recortada (`position: absolute` + `overflow: hidden`) e quebrou o layout no Android** (overflow não recortou a imagem em alguns aparelhos, cobrindo telas inteiras) — não repetir essa abordagem.
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

## Calculadora de anilhas (`components/PlateSheet.tsx`, `lib/plates.ts`)
- Abre por KG no cabeçalho do exercício > Weight Input > Plate Calculator (exercícios de barra). Como no Hevy: barra desenhada com as anilhas de um lado, "Closest possible weight is X" em vermelho quando não fecha, Available Equipment (anilhas ligadas/desligadas, barra Standard/Short/EZ/No bar) e Manage (lista, + Custom Plate).
- Cálculo (`solvePlates`): anilhas ilimitadas de cada tipo, peso montável mais próximo do alvo (empate: o mais leve), com menos anilhas; troco mínimo por programação dinâmica em centésimos (o método guloso erra com anilhas personalizadas). Pesquisado: sem pacote TS/RN padrão; `plate-calculator` (npm) também devolve o peso mais próximo.
- Preferências por unidade em `wprefs.plateSets` (kg e lbs separados); barras EZ: 7,5 kg / 15 lbs (valor nosso, confirmar com o Hevy).

## Notas do exercício e Timer Settings (copiados do Hevy, 2026-11-06)
- **Nota**: toque em "Note" abre uma linha com o ícone do tipo + campo "Add a session note". Tocar no ícone abre "Notes type": Pinned Exercise Note (fica sempre que fizer o exercício), Pinned Routine Note (sempre que fizer a rotina; exige treino iniciado de rotina) e Workout Note (só neste treino, vai no post), mais Delete Note. Só UMA nota por exercício por enquanto.
- As fixadas ficam SÓ NO APARELHO (AsyncStorage `reps:pinned:<uid>`, `pinnedRef` no store; chave canônica `cat:<id>` para exercícios do catálogo) e NÃO vão no post (`finishActive` grava notes vazio para elas). Ao iniciar: nota fixada da rotina > nota fixada do exercício > nota do treino copiado. `ActiveEntry.noteKind`; ações `setNote`, `setNoteKind`, `deleteNote`.
- **Rest Timer** do exercício: folha com o nome do exercício e ícone de sliders (aplica o valor e abre `settings/timer`). **Timer Settings** (`settings/timer`): Sounds (`timer-sounds`: Timer Sound, Timer Volume, Check Set, Live Personal Record Volume; opções em `timer-pick`) e Default Rest Timer. Prefs em `wprefs` (`timerSound`, `timerVolume`, `checkVolume`, `prVolume`).
- Efeito real hoje: só Timer Volume = Off silencia o alarme. Tipo de som, volumes e som do check/recorde são interface (faltam arquivos de som e build novo).
- Pendente: nota fixada na rotina ainda não aparece/edita na tela da rotina; gravar as fixadas no Supabase (hoje só no aparelho).

## Atualizações pelo ar (OTA)
- `expo-updates` + `runtimeVersion: fingerprint`; canais: development/preview/production (eas.json). Android de teste = canal `preview`; iOS TestFlight = `production`.
- Publicar: `workflow_run` com fileName `update.yml` (gitRef `main`) — NÃO precisa de build. Só JS/telas/textos chegam; pacote nativo novo muda o fingerprint e exige build novo (com autorização do Rodrigo).
- O app baixa a atualização ao abrir e aplica na próxima abertura.

## Notificações do treino (`src/components/WorkoutNotifier.tsx`, expo-notifications)
- Com o treino ativo e o app em segundo plano: notificação fixa com exercício + "Set 1/3 - 24 kg x 12 reps" e botão "Complete Set"; durante o descanso: "Rest m:ss · Next: ..." com Skip/-15s/+15s. Alarme "Rest is over" agendado no sistema (toca mesmo com o app fechado; respeita Sounds).
- LIMITE: sem serviço em primeiro plano o contador NÃO anda sozinho na notificação (só atualiza quando o app roda) e os botões só respondem enquanto o processo do app estiver vivo. Para contagem ao vivo + botões sempre confiáveis: serviço em primeiro plano nativo (ex.: Notifee) = build novo.
- Não testado em aparelho ainda.

## Próxima versão (aprovado pelo Rodrigo, NÃO fazer agora)
- Wearables: smartwatch (Apple Watch e Wear OS), etc. — registrar treino no relógio, descanso e frequência cardíaca. Hoje só existe a tela de interface em `settings/integrations` e o cartão "Sync with your watch" no Início (sem backend real).
- Considerar junto: Apple Saúde / Health Connect, e serviço em primeiro plano para a notificação do treino com contagem ao vivo.

## Trainer (programa personalizado) — `src/app/trainer/`, `src/lib/trainer.ts`
- Entrada: cartão "Trainer" no topo da aba Workout. Telas: início (meta semanal, próximo treino, programa/semana), `workouts` (treinos do programa, ⋯ Reorder/Skip/Program Settings), `reorder`, `settings` (Modify My Program + Start New Program + Restart/Delete + Science/Feedback), `option/[key]` (level, equipment, focus, duration, rest, variety, cardio, excluded, injuries, split, goal, frequency), `setup`, `science`.
- Gera treinos a partir do catálogo (equipamento, lesões, exercícios excluídos, foco, duração, descanso, meta). Ciclo de 6 semanas (+1 com deload); variedade: balanced renova no fim do ciclo, varied toda semana, consistent não renova.
- O programa fica SÓ NO APARELHO (AsyncStorage `reps:trainer:<uid>`; não sincroniza com o Supabase ainda). Treino iniciado pelo Trainer leva `fromTrainer` e, ao salvar, avança o próximo treino.
- Só interface: os ícones de equipamento são genéricos (sem as imagens do Hevy); "Edit" dos pesos dos equipamentos não existe.

## Menu ⋯ do treino salvo (`src/components/WorkoutMenu.tsx`)
- Início e detalhe usam o mesmo menu: Share Workout, Save as Routine, Copy Workout, Edit Workout (`feed/workout/edit`, grava via `store.updateWorkout`: título, descrição, data, local, visibilidade, duração, séries/peso/reps) e Delete Workout (com confirmação). No detalhe entra também "Report workout".

## Análise, erros e assinaturas (PostHog + Sentry + RevenueCat)
- `src/lib/analytics.ts` (PostHog: `track`, `identifyUser`, tela automática por rota em `components/Telemetry.tsx`), `src/lib/monitoring.ts` (Sentry), `src/lib/purchases.ts` (RevenueCat, `usePro`, `buy`, `restore`). Chaves PÚBLICAS no `.env`: `EXPO_PUBLIC_POSTHOG_KEY/HOST`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`. Vazio = desligado (modo prévia, sem erro). Mesmo id de usuário (Supabase, sem e-mail) nos três.
- Eventos: login/sign_up, onboarding_completed, workout_started/finished/discarded/edited/deleted, set_completed, workout_menu_action, trainer_*, report_viewed/card_shared/card_downloaded, exercise_filters_applied, paywall_viewed/plan_selected/dismissed, exit_offer_viewed/accepted/declined, purchase_started/completed/cancelled/failed, restore_clicked. Funil de onboarding = eventos `$screen`.
- Preços de EXEMPLO (decisão do dono): EUA mensal $4.99 sem teste; anual 20% off ($47.90) com 7 dias grátis; BRL mensal R$19 e anual R$182,40; oferta de saída (ao fechar o X do paywall, 1x por abertura) = anual com mais 30% off ($33.53 / R$127,68) com 7 dias grátis. Preço real vem da loja via RevenueCat (as lojas usam faixas de preço: arredondar na criação dos produtos).
- **Configurado em 2026-11-05 (chaves no `.env`, ligadas por OTA):** PostHog projeto 668957 (US, "Default project"); Sentry org `rodsappz`, projeto `reps` (React Native); RevenueCat projeto `Reps` (fe8ca576) com apps `Reps (iOS)` e `Reps (Android)` (`com.rodrigomaynard.reps`), entitlement `pro`, offerings `default` (atual) e `exit_offer` — ambas SEM pacotes ainda.
- RevenueCat iOS usa a chave de compras (.p8) já existente da equipe Apple; falta a chave da App Store Connect API (importar produtos). Android: falta o JSON da conta de serviço do Google Play.
- Falta criar nas lojas e ligar no RevenueCat: produtos `reps_pro_monthly`, `reps_pro_annual` (intro offer 7 dias), `reps_pro_annual_offer` (idem); pacotes $rc_monthly + $rc_annual na `default` e $rc_annual = reps_pro_annual_offer na `exit_offer`; anexar os produtos ao entitlement `pro`.
- Sentry: `SENTRY_DISABLE_AUTO_UPLOAD=true` nos perfis do `eas.json` até existir o segredo `SENTRY_AUTH_TOKEN` no expo.dev + org `rodsappz`/projeto `reps` no plugin (sem isso o stack trace fica minificado). Exige build novo.
- TestFlight: grupos internos `Internal Testers` (distribuição automática) e `Team (Expo)`; testador = `rodsappz@gmail.com` (único usuário da equipe Apple). `rodrigo.maynard@gmail.com` só entra como testador interno se for convidado em Users and Access. Há um aviso de novo contrato da Apple para o Account Holder aceitar.
- Falta: política de privacidade, apagar conta, consentimento (UE), gravação de sessão (pacote nativo extra do PostHog).

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

## Proporções do treino ativo (medidas em 2026-11-06)
- Referência: Hevy. Mobbin só tem a versão iPhone (fluxo "Logging a workout", 21 telas, https://mobbin.com/apps/hevy-ios-cf2a2ec4-b4c9-4a33-96b3-c316e7165a3b/2e8aa5bb-1d4e-46e1-a60c-43919883fbb7/flows); chips, selos e campos com borda só existem no Hevy do Android (prints do Rodrigo). Medidas batem: espaço entre linhas = 12,5% da largura da tela nos dois; números 17 pt.
- Valores aplicados (pt): selo da série e check 35, campo kg/reps ~35 de altura (padding 6, borda 1), linha 47, chip Rest/Note ~36 (ícone 18, fonte 15, padding 10x9), botão `Btn` minHeight 40, rótulos de Duration/Volume/Sets 11, título do cabeçalho 16 normal (à esquerda no treino ativo: `titleAlign="left"`), barra de descanso: relógio 32, botões 38 de altura.
- Sem faixa cinza alternada nas linhas (como no Hevy do Android).

## Ver mudanças ao vivo (build de desenvolvimento)
- OTA não serve para as telas com `ExerciseThumb` (1.324 miniaturas > limite de 1000 arquivos por atualização): cada mudança visual precisava de build novo (~18 min).
- Alternativa: build `development` (perfil já existe no `eas.json`, expo-dev-client instalado) + `npx expo start --dev-client --lan --port 8091` neste computador, sem `CI=1` (CI desliga o reload). Celular na mesma rede Wi-Fi; no app: "Enter URL manually" → `http://<IP do PC>:8091`. Túnel (`--tunnel`) é bloqueado pelo modo automático.
- O app em modo desenvolvimento é mais lento: serve para visual/tamanhos, nunca para medir velocidade (usar build `preview`).

## Treino ativo e criar exercício: comportamento copiado do Hevy (2026-11-06)
- **Finish** vai direto para `active/save` (sem pop-up). Séries com kg/reps digitados (`typed`) e sem ✓ passam a valer ao finalizar (`completeTypedSets`); séries só pré-preenchidas não.
- **Duration** (toque na duração): `DurationSheet` com roda de horas/minutos (mexer move o início, `setElapsed`) e roda de dia/hora/minuto do início (`setStartTime` → `active.dateAt`, a duração não muda). A data salva é `dateAt ?? startedAt` (início, não o fim). A linha Date de `active/save` usa as mesmas rodas (`WheelPicker.tsx`, JS puro, sem lib nativa).
- **Create Exercise** (`exercises/create` + `equipment`, `muscle` (`?multi=1` = outros músculos), `type`): rascunho em `lib/exerciseDraft.ts`, opções em `lib/exerciseOptions.ts`. Tipos: Weight & Reps, Bodyweight Reps, Weighted Bodyweight (`weighted_bodyweight`, coluna +KG), Assisted Bodyweight (`assisted_bodyweight`, -KG), Duration. **Duration & Weight, Distance & Duration e Weight & Distance aparecem como "Coming soon"**: o treino guarda só kg, reps e tempo (`workout_sets` não tem distância).
- Supabase `exercises` ganhou as colunas `secondary_muscles text[]` e `target text` (migração `exercises_secondary_muscles_and_target`, aditiva). A imagem do exercício (Add Asset) fica só no aparelho (AsyncStorage `reps:exassets`, data URI).
- Abas: Home, Workout, Trainer (`(tabs)/plano`), Exercises (`(tabs)/exercicios`), Profile. `Screen`/`Header` detectam `(tabs)` (`useInTabs`).

## Banco (auditoria 2026-11-06, migração `integridade_indices_updated_at_distancia`)
- CHECKs: `exercises.kind` (5 tipos), `workout_sets.set_type` (normal/warmup/failure/drop) e `reps >= 0`, `workouts.visibility` (everyone/followers/private) e `duration_sec >= 0`, `profiles.theme` (light/dark/system) e `sex` (male/female/null). **Novo valor no app = atualizar o CHECK junto** (migração).
- Índices em `workout_sets.user_id` e `feedback.user_id`; `updated_at` com gatilho `set_updated_at` em workouts, routines, exercises, profiles; `username` único sem diferenciar maiúsculas (`profiles_username_uniq`, vazio não conta).
- `workout_sets` ganhou `distance_m` e `duration_sec` (nulos, ainda NÃO usados pelo app: faltam ligar no store e liberar os tipos "Coming soon").
- **Modelo normalizado (2026-11-06, migração `normalizar_treinos_e_rotinas`):** `workouts` -> `workout_exercises` (posição, notas, descanso, superset) -> `workout_sets` (`workout_exercise_id` obrigatório); `routines` -> `routine_exercises` -> `routine_sets`. `workouts` ganhou `routine_id` (FK, set null), `location`, `from_trainer`. RLS das tabelas filhas exige ser dono da linha E do pai. O mesmo exercício pode aparecer 2x no treino.
- **Gravar treino = `rpc('save_workout', { p_workout, p_entries })`** (uma transação; cria ou substitui). **Gravar rotina = update/insert em `routines` com a coluna `exercises` (JSON)**: o gatilho `routines_sync_children` monta as tabelas filhas na mesma transação. O app LÊ só das tabelas filhas.
- **Compatibilidade com builds antigos** (gravam `workouts.meta` + `workout_sets` sem pai): gatilhos `workouts_legacy_meta`, `workouts_legacy_reset` e `workout_sets_attach_legacy` convertem sozinhos (desligados dentro do `save_workout` por `set_config('reps.rpc','on')`). `workouts.meta` e `routines.exercises` continuam sendo gravados como espelho — só remover quando nenhum build antigo estiver em uso.
- **Cuidado:** `update workouts set meta = ...` fora do `save_workout` APAGA os exercícios/séries do treino (o gatilho de compatibilidade recria a partir das séries inseridas depois). Em SQL manual, rodar antes `select set_config('reps.rpc','on',true)`.
- **Volta atrás:** branch git `backup/antes-reestruturacao-banco` + schema `backup_20261106` no Supabase (cópia de todas as tabelas antes da mudança, sem acesso pela API). Apagar o schema quando o novo modelo estiver validado.

## Treino concluído (`active/done`, cards como no Hevy, 2026-11-06)
- Carrossel de cards (foto do treino quando escolhida em `active/save`, lista + boneco, números, "You lifted… like a truck", números + lista, grade 2x2, boneco + números), fundo Light/Dark/Transparent, comemoração (`components/Confetti.tsx`: dois disparos de anilhas, halteres e bandas sóbrios saindo de baixo, Animated em JS puro, desenho SVG próprio) e botão 🎉 que repete.
- Boneco de músculos (`components/BodyMap.tsx`) usa o `react-native-body-highlighter` (MIT, só SVG, sem build novo; dorsais e costas altas acendem juntas); `regionsOf` converte músculo/target/secondary do catálogo em regiões. Comparação de peso = emojis (sem ilustrações do Hevy).
- Compartilhar: Stories e More abrem a folha do sistema com a imagem (Stories direto no Instagram exige pacote nativo); Copy Text; Download (galeria); Send to AI (texto com séries para colar no ChatGPT/Claude); Twitter (X). **Workout Link = só interface** (não existe página web do treino).
