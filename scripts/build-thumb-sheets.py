"""Junta as miniaturas 96x96 de assets/thumbs em folhas (sprites) para caber no limite
de 1000 arquivos por atualização OTA. Gera assets/thumb-sheets/sheet-N.jpg e src/data/thumbs.ts.
Uso: python scripts/build-thumb-sheets.py  (© Gym visual — SÓ PARA TESTE)"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'thumbs'
OUT = ROOT / 'assets' / 'thumb-sheets'
TILE, COLS = 96, 20
PER_SHEET = COLS * COLS

files = sorted(SRC.glob('*.jpg'))
OUT.mkdir(exist_ok=True)
for old in OUT.glob('*.jpg'):
    old.unlink()

entries = []
for s in range(0, len(files), PER_SHEET):
    chunk = files[s:s + PER_SHEET]
    rows = (len(chunk) + COLS - 1) // COLS
    sheet = Image.new('RGB', (COLS * TILE, rows * TILE), 'white')
    for i, f in enumerate(chunk):
        img = Image.open(f).convert('RGB').resize((TILE, TILE))
        sheet.paste(img, ((i % COLS) * TILE, (i // COLS) * TILE))
        entries.append((f.stem, s // PER_SHEET, i % COLS, i // COLS))
    sheet.save(OUT / f'sheet-{s // PER_SHEET}.jpg', quality=85, optimize=True)

sheets = sorted({e[1] for e in entries})
rows_by_sheet = {n: max(e[3] for e in entries if e[1] == n) + 1 for n in sheets}
lines = [
    '// Gerado por scripts/build-thumb-sheets.py (miniaturas 96x96 em folhas). © Gym visual — SÓ PARA TESTE, remover antes do lançamento.',
    f'export const THUMB_COLS = {COLS};',
    'export const THUMB_SHEETS: { src: number; rows: number }[] = [',
    *[f"  {{ src: require('../../assets/thumb-sheets/sheet-{n}.jpg'), rows: {rows_by_sheet[n]} }}," for n in sheets],
    '];',
    '/** id do catálogo -> [folha, coluna, linha] */',
    'export const THUMBS: Record<string, [number, number, number]> = {',
    *[f"  '{k}': [{n}, {c}, {r}]," for k, n, c, r in entries],
    '};',
    '',
]
(ROOT / 'src' / 'data' / 'thumbs.ts').write_text('\n'.join(lines), encoding='utf-8')
print(len(entries), 'miniaturas em', len(sheets), 'folhas')
