"""Gera src/data/thumbs.ts com um require() por miniatura (assets/thumbs/<id>.jpg) — cada uma vira
um recurso nativo pré-compilado no build (sem custo de decodificação em tempo real, sem inflar o
pacote JS). Requer um BUILD novo pra valer (não dá pra mandar por atualização OTA: 1.324 arquivos
passam do limite de 1000 por atualização do EAS Update — por isso usamos data URI nas atualizações
rápidas; este é o jeito definitivo, só funciona a partir de um build).
Uso: python scripts/build-thumbs.py  (© Gym visual — SÓ PARA TESTE)"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'thumbs'

files = sorted(SRC.glob('*.jpg'))
lines = [
    '// Gerado por scripts/build-thumbs.py (miniaturas 96x96 embutidas no app). © Gym visual — SÓ PARA TESTE, remover antes do lançamento.',
    'export const THUMBS: Record<string, number> = {',
    *[f"  '{f.stem}': require('../../assets/thumbs/{f.name}')," for f in files],
    '};',
    '',
]
(ROOT / 'src' / 'data' / 'thumbs.ts').write_text('\n'.join(lines), encoding='utf-8')
print(len(files), 'miniaturas embutidas (require) em src/data/thumbs.ts')
