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
- Fotos de PROGRESSO ficam no bucket privado `progress-photos` (`<uid>/<uuid>.jpg`, `measurements.photo_uri = storage:<caminho>`, URL assinada de 7 dias ao carregar); a foto do TREINO (active/save) ainda é só da sessão

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
Login Apple/Google/Facebook, verificação de telefone por SMS, Strava/Saúde, relógio, compra do Pro, seguir amigos e comentários, importação de dados.

## Workout Settings (`settings/workout*`, botão "Settings" no treino ativo)
- Preferências em `store.wprefs` (AsyncStorage `reps:wprefs:<uid>`). Funcionam: descanso padrão (novos exercícios), valores anteriores (qualquer treino / mesma rotina; o treino guarda `routineId` em `meta`), calculadora de aquecimento (menu ⋮ do exercício; fórmula e arredondamentos), manter tela ligada (`expo-keep-awake`), calculadora de anilhas (ícone ao lado de KG em exercícios de barra), aviso de recorde pessoal ao marcar a série.
- Só interface (toggle salvo, sem efeito ainda): Sounds, RPE Tracking, Smart Superset Scrolling, Inline Timer.

## Calculadora de anilhas (`components/PlateSheet.tsx`, `lib/plates.ts`)
- Abre por KG no cabeçalho do exercício > Weight Input > Plate Calculator (exercícios de barra). Como no Hevy: barra desenhada com as anilhas de um lado, "Closest possible weight is X" em vermelho quando não fecha, Available Equipment (anilhas ligadas/desligadas, barra Standard/Short/EZ/No bar) e Manage (lista, + Custom Plate).
- Cálculo (`solvePlates`): anilhas ilimitadas de cada tipo, peso montável mais próximo do alvo (empate: o mais leve), com menos anilhas; troco mínimo por programação dinâmica em centésimos (o método guloso erra com anilhas personalizadas). Pesquisado: sem pacote TS/RN padrão; `plate-calculator` (npm) também devolve o peso mais próximo.
- Preferências por unidade em `wprefs.plateSets` (kg e lbs separados); barras EZ: 7,5 kg / 15 lbs (valor nosso, confirmar com o Hevy).

## Relógio do treino (botão do alarme no cabeçalho, `components/ClockSheet.tsx`)
- Folha "Clock" (ícone de sliders abre Timer Settings): aba **Timer** (anel com a contagem, -15s/+15s, Start/Cancel; usa o mesmo temporizador de descanso do store, então a barra de descanso embaixo também aparece) e aba **Stopwatch** (MM:SS:CC, Start/Stop/Resume/Reset). Com o cronômetro andando/pausado com valor, o título do cabeçalho mostra o tempo em azul.

## Swap (troca de exercício no treino, 2026-11-07)
- Botão **Swap** (esquerda) ao lado de **Add Set** (direita) em cada exercício do treino ativo. Abre `components/SwapPanel.tsx`: cartões com foto (alinhados pelo topo): o original (com ✓ quando é o atual) e 3-4 opções do MESMO alvo muscular (`lib/substitutes.ts`: alvo do catálogo, parecença do nome sem palavras de equipamento, preferência leve por equipamento de academia, no máximo 2 do mesmo equipamento; a primeira é "Closest match"). ⓘ explica (folha "Got it!").
- Tocar numa opção chama `store.swapEntry` (troca só neste treino, guarda `ActiveEntry.swappedFrom`, séries não feitas usam o histórico do novo exercício; tocar no original desfaz). O exercício mostra "Swapped today · was X".
- O botão Swap fica azul claro (`Btn selected`) enquanto o painel está aberto; tocar de novo fecha, e marcar uma série (✓) também fecha.
- ⋮ > **Make main exercise** (só aparece se houve troca): troca o original pelo novo na ROTINA de origem (`saveRoutine`), definitivamente. Funciona em treino iniciado de rotina (`saveRoutine`) ou do Trainer (`saveTrainer`); sem rotina/programa o item nem aparece. Depois de tornar principal, o texto abaixo do nome vira laranja "Now the main exercise" (`ActiveEntry.madeMain`) e o aviso dura 6 s. Escolher uma opção no Swap fecha o painel. Texto das justificativas é genérico por equipamento (sem citar estudos).

## Menu do exercício e séries (treino ativo)
- ⋮ do exercício: Replace, Add to superset, View Exercise, **Hide only for this workout** (com ícone "?" que explica: some só neste treino, nada é apagado, na próxima vez aparece normal), **Reduce sets** (tira a última série; interpretação nossa do pedido, confirmar com o Rodrigo), Reorder, Remove.
- Séries: deslizar a linha para a esquerda mostra "Delete" vermelho (`components/SwipeRow.tsx`, PanResponder puro).

## Notas do exercício e Timer Settings (copiados do Hevy, 2026-11-06)
- **Nota**: toque em "Note" abre uma linha com o ícone do tipo + campo "Add a session note". Tocar no ícone abre "Notes type": Pinned Exercise Note (fica sempre que fizer o exercício), Pinned Routine Note (sempre que fizer a rotina; exige treino iniciado de rotina) e Workout Note (só neste treino, vai no post), mais Delete Note. Pode haver VÁRIAS notas por exercício (cada uma com seu ícone/tipo; `ActiveEntry.noteList`, helpers em `lib/notes.ts`; `entry.notes` = texto das notas do treino, uma por linha, que é o que vai para o banco). Tocar em "Note" acrescenta uma nota; nota deixada em branco some ao sair do campo. Ícone da nota do treino: página simples (`document-outline`).
- As fixadas ficam SÓ NO APARELHO (AsyncStorage `reps:pinned:<uid>`, `pinnedRef` no store; chave canônica `cat:<id>` para exercícios do catálogo) e NÃO vão no post (`finishActive` grava notes vazio para elas). Ao iniciar: nota fixada da rotina > nota fixada do exercício > nota do treino copiado. Ações `addNote`, `setNote`, `setNoteKind`, `deleteNote` (por índice do exercício + id da nota); as fixadas são listas por chave.
- **Rest Timer** do exercício: folha com o nome do exercício e ícone de sliders (aplica o valor e abre `settings/timer`). **Timer Settings** (`settings/timer`): Sounds (`timer-sounds`: Timer Sound, Timer Volume, Check Set, Live Personal Record Volume; opções em `timer-pick`) e Default Rest Timer. Prefs em `wprefs` (`timerSound`, `timerVolume`, `checkVolume`, `prVolume`).
- **Sons (2026-11-06):** 10 WAVs originais gerados por `scripts/build-sounds.py` em `assets/sounds/` (rest_default, alarm, futuristic, ting, boxing + 3 próprios: iron = Iron Clink, marimba = Rack Pop, liftoff = Lift Off; sfx_check e sfx_record). `src/lib/sounds.ts`: `playSound`/`playTimerSound` com `expo-audio` (carregado com try/require: sem o módulo nativo fica mudo, sem erro) e volume High/Normal/Low/Off = 1/0,55/0,25/0. Fim do descanso: com o app aberto toca pelo expo-audio; em segundo plano é a notificação (um canal Android por som, `rest-<id>`, arquivos copiados pelo plugin expo-notifications em `app.json`; o volume NÃO se aplica à notificação, só Off = canal silencioso). Check Set (padrão Off) e recorde tocam do store. Escolher uma opção em `timer-pick` toca uma prévia.
- **Precisa de BUILD NOVO** (expo-audio é módulo nativo e os sons entram no pacote nativo); no app de desenvolvimento atual os sons ficam mudos. Os sons foram sintetizados e NÃO ouvidos por mim: ajustar o gosto do Rodrigo editando o script.
- As notas fixadas do exercício também aparecem e se editam na tela do exercício > How to ("Pinned exercise notes" + Add Note; `pinnedNotes`/`setPinnedNotes` no store). Campo de nota = `components/NoteInput.tsx` (cresce com o texto, sem contorno).
- Nota fixada da rotina: agora também se edita em `routines/edit` (campo "Pinned routine note" por exercício, só com a rotina já salva; `routinePins`/`setRoutinePins` no store). As fixadas agora ficam também no Supabase (tabela `pinned_notes`: user_id, scope exercise|routine, key, texts; RLS por usuário); o banco vence o cache local ao entrar e o que só existia no aparelho sobe sozinho.

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
- O programa fica no Supabase (`user_state.trainer`, jsonb) com cache no AsyncStorage `reps:trainer:<uid>`; o servidor vence ao entrar e o que só existia no aparelho sobe. Treino iniciado pelo Trainer leva `fromTrainer` e, ao salvar, avança o próximo treino.
- Só interface: os ícones de equipamento são genéricos (sem as imagens do Hevy); "Edit" dos pesos dos equipamentos não existe.

## Menu ⋯ do treino salvo (`src/components/WorkoutMenu.tsx`)
- Início e detalhe usam o mesmo menu: Share Workout, Save as Routine, Copy Workout, Edit Workout (`feed/workout/edit`, grava via `store.updateWorkout`: título, descrição, data, local, visibilidade, duração, séries/peso/reps) e Delete Workout (com confirmação). No detalhe entra também "Report workout".

## Análise, erros e assinaturas (PostHog + Sentry + RevenueCat)
- `src/lib/analytics.ts` (PostHog: `track`, `identifyUser`, tela automática por rota em `components/Telemetry.tsx`), `src/lib/monitoring.ts` (Sentry), `src/lib/purchases.ts` (RevenueCat, `usePro`, `buy`, `restore`). Chaves PÚBLICAS no `.env`: `EXPO_PUBLIC_POSTHOG_KEY/HOST`, `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_RC_IOS_KEY`, `EXPO_PUBLIC_RC_ANDROID_KEY`. Vazio = desligado (modo prévia, sem erro). Mesmo id de usuário (Supabase, sem e-mail) nos três.
- Eventos: login/sign_up, onboarding_completed, workout_started/finished/discarded/edited/deleted, set_completed, workout_menu_action, trainer_*, report_viewed/card_shared/card_downloaded, exercise_filters_applied, paywall_viewed/plan_selected/dismissed, exit_offer_viewed/accepted/declined, purchase_started/completed/cancelled/failed, restore_clicked. Funil de onboarding = eventos `$screen`.
- Preços de EXEMPLO (decisão do dono): EUA mensal $4.99 sem teste; anual 20% off ($47.90) com 7 dias grátis; BRL mensal R$19 e anual R$182,40; oferta de saída (ao fechar o X do paywall, 1x por abertura) = anual com mais 30% off ($33.53 / R$127,68) com 7 dias grátis. Preço real vem da loja via RevenueCat (as lojas usam faixas de preço: arredondar na criação dos produtos).
- **Configurado em 2026-11-05 (chaves no `.env`, ligadas por OTA):** PostHog projeto 668957 (US, "Default project"); Sentry org `rodsappz`, projeto `reps` (React Native); RevenueCat projeto `Reps` (fe8ca576) com apps `Reps (iOS)` e `Reps (Android)` (`com.rodrigomaynard.reps`), entitlement `pro`, offerings `default` (atual) e `exit_offer` — ambas SEM pacotes ainda.
- RevenueCat iOS usa a chave de compras (.p8) já existente da equipe Apple; falta a chave da App Store Connect API (importar produtos). Android: falta o JSON da conta de serviço do Google Play.
- **App Store Connect (criado em 2026-11-09):** grupo `Reps Pro` (ID 22561848, nome pt/en) com `reps_pro_annual` ($47.90 / R$182,90, 7 dias grátis), `reps_pro_monthly` ($4.99 / R$19,90, sem teste) e `reps_pro_annual_offer` ($33.49 / R$127,90, 7 dias grátis); os 3 com nome/descrição em inglês e português e disponíveis em 175 países. Status "Preparar para envio": a primeira assinatura só vai para revisão junto com uma versão nova do app. O nome do app na loja ainda aparece como "Reps (b7522e)".
- **RevenueCat (2026-11-09):** produtos iOS `reps_pro_monthly`, `reps_pro_annual`, `reps_pro_annual_offer` cadastrados no app `Reps (iOS)` e ligados ao entitlement `pro`; offering `default` = $rc_monthly + $rc_annual, `exit_offer` = $rc_annual (reps_pro_annual_offer). Preços de prévia em `lib/purchases.ts` = os da loja. Status "Could not check" até existir a chave da App Store Connect API no RevenueCat (só o Rodrigo gera: Usuários e acesso > Integrações > API, acesso App Manager, enviar o .p8 no app iOS do RevenueCat).
- Falta (Google Play + chave da API acima; depois ligar `FEATURES.proGating`): produtos `reps_pro_monthly`, `reps_pro_annual` (intro offer 7 dias), `reps_pro_annual_offer` (idem); pacotes $rc_monthly + $rc_annual na `default` e $rc_annual = reps_pro_annual_offer na `exit_offer`; anexar os produtos ao entitlement `pro`.
- Sentry: `SENTRY_DISABLE_AUTO_UPLOAD=true` nos perfis do `eas.json` até existir o segredo `SENTRY_AUTH_TOKEN` no expo.dev + org `rodsappz`/projeto `reps` no plugin (sem isso o stack trace fica minificado). Exige build novo.
- TestFlight: grupos internos `Internal Testers` (distribuição automática) e `Team (Expo)`; testador = `rodsappz@gmail.com` (único usuário da equipe Apple). `rodrigo.maynard@gmail.com` só entra como testador interno se for convidado em Users and Access. Contratos da Apple em dia (conferido em 2026-11-09): License Agreement aceito em 2026-11-05, acordos de apps pagos e gratuitos ativos até 2026-12-23 (renovação da conta, £79/ano, automática no cartão).
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

## Barra de números do treino ativo (como no Hevy, 2026-11-07)
- Toque em Duration = folha Duration; em Volume e em Sets = pop-up central com a explicação (aquecimento incluído); no boneco = folha "Muscle Distribution" (boneco grande + séries feitas por músculo; principal e secundários contam).

## Tema claro/escuro/automático (2026-11-07)
- `lib/theme.ts`: duas paletas (`light`, `dark`) e `colors` = objeto ÚNICO e mutável; `applyScheme` troca os valores no lugar. `_layout.tsx` (`useScheme`) resolve a preferência `profile.theme` (light | dark | system = `useColorScheme()`), aplica a paleta, chama `refreshStyles()` (recria o `StyleSheet` de `ui.tsx`) e usa `key={scheme}` no `<Stack>` para remontar as telas com as cores novas (o estado do store e a navegação ficam). Tela `settings/theme`.
- REGRA: nunca guardar `colors.x` em constante de módulo (fica na paleta antiga); ler dentro do componente/função. Constantes de módulo que precisam usar `get` (ver `h` em `active/index.tsx`). Cores novas de tema vão nas DUAS paletas. Cartões de compartilhamento (`done.tsx`, `report-share.tsx`) têm paleta própria de propósito.
- Perfil novo começa em `system`. `app.json` `userInterfaceStyle: automatic` (antes `light`): sem isso o aparelho nunca avisa que está no escuro. É config nativa: muda o fingerprint, então builds antigos deixam de receber OTA e o Automático só vale em build novo (no app de desenvolvimento/web já funciona).
- Miniaturas dos exercícios continuam com fundo branco (são JPG), também no escuro.

## Unidade por exercício (2026-11-07, migração `unidade_por_exercicio_e_notas_fixadas`)
- `workout_exercises.weight_unit` e `routine_exercises.weight_unit` ('kg' | 'lbs', nulo = padrão do perfil). O app guarda em `ActiveEntry/SavedEntry/RoutineExercise.unit`; `save_workout` e `sync_routine_children` gravam; iniciar treino de rotina/cópia herda a unidade.

## Auditoria e lotes (2026-11-07) — ver `docs/AUDITORIA.md`
- `FEATURES` em `lib/constants.ts`: social, watch, integrations, coach, dataImport, workoutLink = `false` → tudo isso fica ESCONDIDO (nada de "Coming soon"). Só ligar quando existir backend. `SUPPORT_EMAIL` também em constants.
- Falha de carga → tela "Can't load your data / Try again" (`loadFailed`/`reload` no store). Treino ativo é lido do aparelho ANTES do servidor. `workouts` carrega por páginas de 1000.
- `saveProfile/saveMeasurement/deleteMeasurement/sendFeedback` devolvem boolean; telas só confirmam quando true.
- Recuperar senha = código de 6 dígitos (`forgot.tsx`, `verifyOtp` + `updateUser`). **Precisa do template de e-mail "Reset Password" do Supabase (Authentication > Emails) conter `{{ .Token }}`**.
- Apagar conta: Settings > Delete Account → Edge Function `delete-account` (service role no servidor; tabelas apagam em cascata; limpa `progress-photos/<uid>`). Também limpa AsyncStorage do usuário.
- Migrações: `unidade_por_exercicio_e_notas_fixadas`, `user_state_e_fotos_de_progresso` (tabela `user_state` trainer+wprefs com RLS; bucket `progress-photos` com policies por pasta do usuário).
- Confirmações: remover exercício (treino e rotina), apagar rotina, pular treino do Trainer, sair do editor de rotina com mudanças. Exportar = arquivo CSV/JSON real (`settings/export`).
- Editar exercício criado: ⋮ do detalhe > Edit exercise (reusa `exercises/create?id=`, `store.updateExercise`); salvar tem trava de duplo toque.
- Pro: `lib/gate.ts` (`useGate`, `FREE_LIMITS`: 4 rotinas no grátis; Trainer e Gerar plano exigem Pro) protegido por `FEATURES.proGating` (DESLIGADO: ligar só quando os produtos existirem nas lojas e no RevenueCat). Textos "Preview mode" do paywall só aparecem em `__DEV__`.

## Ícones de equipamento e músculo (2026-11-07)
- Equipamento (`exercises/equipment`) e categorias usam **Hugeicons (MIT)**, embutidos como SVG em `src/lib/gymIcons.ts` (gerado a partir do Iconify; sem rede) e desenhados por `components/GymIcon.tsx` (`react-native-svg` `SvgXml`, cor via `color`). Para trocar/adicionar: regenerar o arquivo com outro nome de ícone do conjunto `hugeicons`.
- Músculos (`exercises/muscle`) mostram o boneco do `react-native-body-highlighter` (`BodyMap`) com o músculo pintado (frente ou costas); Cardio, Full Body e Other usam ícone. Nenhuma biblioteca aberta tem as ilustrações realistas de máquinas do Hevy: só ícones de traço.

## Modo offline (2026-11-09, `lib/offline.ts`)
- Cópia dos dados da última carga em `reps:cache:<uid>` (perfil, exercícios, até 300 treinos, rotinas, medidas). Sem internet ao abrir, o app usa a cópia (`store.offline = true`, aviso no Início); sem cópia, mostra "Can't load your data".
- Treino salvo sem rede vai para a fila `reps:outbox:<uid>` (`Workout.pending`, "Waiting to upload" no cartão). A fila sobe sozinha (a cada 30 s, ao voltar ao app e após a carga); exercícios `cat:` são criados no banco nessa hora. Editar/apagar treino pendente mexe só na fila. Rotinas, medidas e perfil offline: mensagem "You're offline" (sem fila).

## Tempo e distância (2026-11-09)
- Tipos `duration_weight` (kg + segundos), `distance_duration` (distância + minutos) e `weight_distance` (kg + distância). Série: `seconds` → `duration_sec`, `distM` (metros) → `distance_m`. O `duration` antigo continua com os segundos em `reps`. Helpers em `lib/exerciseOptions.ts` (`setCols`, `colValue`, `colPatch`, `fmtSet`, `setHasValue`).
- Migração `tipos_com_distancia` (aplicada em 2026-11-09, cópia em `supabase/migrations/`): CHECK de `exercises.kind` com os 8 tipos e `sync_routine_children` gravando `duration_sec`/`distance_m` (vindos de `seconds`/`distM` do JSON da rotina).

## Idiomas (2026-11-09, `lib/i18n.ts`)
- O código fica em inglês; `components/Text.tsx` (`Text`/`TextInput`) traduz na hora de desenhar pelo dicionário `src/i18n/pt.ts` (chave = texto em inglês exato). Todas as telas importam `Text` de `components/Text`, nunca do `react-native`. Texto montado com variáveis só traduz os pedaços literais; para frases dinâmicas usar `tr()`. Títulos das abas usam `tr()`.
- Preferência no aparelho (`reps:lang`): Automático/English/Português (Settings > Language). A raiz remonta as telas ao trocar (`key` do Stack). Datas usam `locale()`. Nomes e passo a passo do catálogo: `catName`/`catSteps` (pt quando o idioma é pt); a busca acha pelos dois idiomas.
- Termos do catálogo em pt padronizados por `scripts/fix-catalog-pt.py` ("na polia", "bola suíça", "leg press 45°"...). Rodar de novo depois de `build-catalog.py`.

## Lembretes (2026-11-09, `lib/reminders.ts`, Settings > Reminders)
- Locais (expo-notifications, sem servidor), reagendados por `components/ReminderSync.tsx`: dias/horário de treino (pula o dia já treinado), aviso após 3 dias sem treinar e meta semanal (aviso na sexta). Prefs em `wprefs` (`remind`, `remindDays`, `remindHour`, `remindMin`, `nudge`, `weeklyGoal`). Só no aparelho (web não agenda).

## Textos legais
- Rascunhos em `docs/legal/privacy-policy.md` e `docs/legal/terms-of-use.md` (com `[TODO]` para o Rodrigo decidir). Publicar numa URL pública antes de enviar às lojas.
