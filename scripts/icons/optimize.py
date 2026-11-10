"""Reduz os PNGs de `assets/icons/**` para paleta de 256 cores (com transparência), sem pontilhado.
Se a paleta estragar o degradê (erro médio alto, como na kettlebell), o arquivo fica como estava.

Uso: python scripts/icons/optimize.py  (rodar uma vez, logo depois de gerar os ícones)
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2] / 'assets' / 'icons'
MAX_ERR = 1.6  # erro médio por canal (0-255) aceito
before = after = 0
kept = []
for f in sorted(ROOT.glob('*/*.png')):
    before += f.stat().st_size
    im = Image.open(f).convert('RGBA')
    q = im.quantize(colors=256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
    err = sum(ImageStat.Stat(ImageChops.difference(im, q.convert('RGBA'))).mean) / 4
    if err <= MAX_ERR:
        q.save(f, optimize=True)
    else:
        im.save(f, optimize=True)
        kept.append(f'{f.stem} ({err:.1f})')
    after += f.stat().st_size
print(f'{before // 1024} KB -> {after // 1024} KB; cores completas: {", ".join(kept) or "nenhum"}')
