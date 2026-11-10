"""Folha de contato dos ícones (claro e escuro) para conferir de uma vez.

Uso: python scripts/icons/sheet.py <saida.png>
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'icons'
files = sorted((ROOT / 'equipment').glob('*.png')) + sorted((ROOT / 'muscles').glob('*.png'))
CELL, ICON, COLS = 150, 112, 8
rows = (len(files) + COLS - 1) // COLS
sheet = Image.new('RGB', (COLS * CELL * 2, rows * CELL), '#ffffff')
draw = ImageDraw.Draw(sheet)
for half, bg, fg in ((0, '#f2f4f7', '#222222'), (1, '#1f2430', '#dddddd')):
    draw.rectangle([half * COLS * CELL, 0, (half + 1) * COLS * CELL, rows * CELL], fill=bg)
    for n, f in enumerate(files):
        x = half * COLS * CELL + (n % COLS) * CELL
        y = (n // COLS) * CELL
        im = Image.open(f).convert('RGBA').resize((ICON, ICON), Image.LANCZOS)
        sheet.paste(im, (x + (CELL - ICON) // 2, y + 8), im)
        draw.text((x + 8, y + CELL - 22), f'{f.parent.name[0]}/{f.stem}', fill=fg)
sheet.save(sys.argv[1])
print(len(files), 'icons ->', sys.argv[1])
