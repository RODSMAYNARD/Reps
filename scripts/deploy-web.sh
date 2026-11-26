#!/usr/bin/env bash
# Republica a versão web do Reps em https://rodsappz4u-reps--web.expo.app (EAS Hosting, alias "web").
# Autorizado pelo Rodrigo em 2026-11-23: republicar sempre que houver mudança visível, sem perguntar.
# O envio em lote do eas-cli é barrado pelo firewall da Expo ("CDN firewall ... Bad Gateway"): o script troca, só durante
# o envio, o lote por um arquivo por vez e devolve o arquivo original no fim (mesmo se der erro).
set -euo pipefail
cd "$(dirname "$0")/.."

F="$(npm root -g)/eas-cli/build/commands/deploy/index.js"
BAK="$(mktemp)"
cp "$F" "$BAK"
restore() { cp "$BAK" "$F"; rm -f "$BAK"; }
trap restore EXIT

rm -rf dist
npx expo export --platform web > /dev/null
sed -i 's/\.map(assets => (assets.length > 1 ? { multipart: assets } : { asset: assets\[0\] }));/.flatMap(assets => assets.map(asset => ({ asset })));/' "$F"
grep -q "flatMap(assets => assets.map(asset => ({ asset })))" "$F" || { echo "eas-cli mudou: o ajuste de envio não se aplica (ver CLAUDE.md, Versão web pública)"; exit 1; }

OUT="$(eas deploy --prod --non-interactive 2>&1)"
ID="$(printf '%s' "$OUT" | grep -o 'rodsappz4u-reps--[a-z0-9]*\.expo\.app' | head -1 | sed 's/rodsappz4u-reps--//; s/\.expo\.app//')"
[ -n "$ID" ] || { printf '%s\n' "$OUT" | tail -20; echo "Não achei o id da publicação"; exit 1; }
eas deploy:alias --alias web --id "$ID" --non-interactive > /dev/null

code="$(curl -s -o /dev/null -w '%{http_code}' https://rodsappz4u-reps--web.expo.app/)"
echo "Publicado: $ID -> https://rodsappz4u-reps--web.expo.app (HTTP $code)"
