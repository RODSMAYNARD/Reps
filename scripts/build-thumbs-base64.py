"""Embute as miniaturas como data URIs base64 em src/data/thumbs.ts, reduzidas para 56x56
(a tela nunca mostra acima de 56px) e recomprimidas: reduz o peso do pacote JS pela metade.
Evita o limite de 1000 arquivos por atualização OTA (não cria assets separados: as imagens
viram string no bundle JS) e evita bug de recorte com overflow no Android.
Uso: python scripts/build-thumbs-base64.py  (© Gym visual — SÓ PARA TESTE)"""
import base64
import io
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'thumbs'
SIZE, QUALITY = 56, 70

files = sorted(SRC.glob('*.jpg'))
lines = [
    '// Gerado por scripts/build-thumbs-base64.py (miniaturas 56x56 embutidas como data URI, sem criar assets separados).',
    '// © Gym visual — SÓ PARA TESTE, remover antes do lançamento.',
    'export const THUMBS: Record<string, string> = {',
]
for f in files:
    img = Image.open(f).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, 'JPEG', quality=QUALITY, optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode('ascii')
    lines.append(f"  '{f.stem}': 'data:image/jpeg;base64,{b64}',")
lines.append('};')
lines.append('')

(ROOT / 'src' / 'data' / 'thumbs.ts').write_text('\n'.join(lines), encoding='utf-8')
print(len(files), 'miniaturas embutidas em src/data/thumbs.ts')
