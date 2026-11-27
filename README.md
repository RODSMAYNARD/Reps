# Reps

App de treino de academia feito com Expo (React Native) e Supabase.

```bash
npm install
npx expo start     # escaneie o QR code com o Expo Go
```

## Pastas
- `src/app/` telas (Expo Router: um fluxo = uma pasta) · `src/components/` peças de tela · `src/lib/` dados e regras · `src/data/` catálogo de exercícios · `src/i18n/` traduções
- `assets/` ícones, sons e miniaturas embutidos no app · `public/` arquivos servidos na versão web
- `supabase/migrations/` todas as migrações do banco · `supabase/functions/` Edge Functions
- `scripts/` geradores (catálogo, miniaturas, sons, ícones) e publicação da web · `data-src/` dados de origem do catálogo
- `docs/` auditoria, textos legais e material de design · `.eas/workflows/` builds e atualizações no EAS

Veja `CLAUDE.md` para a arquitetura e as decisões do projeto.
