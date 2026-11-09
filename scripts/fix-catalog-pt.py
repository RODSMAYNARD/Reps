"""Padroniza termos do português do catálogo (src/data/catalog.json, campo `pt`), como se fala nas academias do Brasil.

Rodar depois de `build-catalog.py`. Só mexe no texto em português; o inglês fica igual.
"""
import json
import re

PATH = 'src/data/catalog.json'

# (padrão, troca) aplicados nos NOMES
NAME_RULES = [
    (r'\bno cabo\b', 'na polia'),
    (r'\bcom cabo\b', 'na polia'),
    (r' no trenó\b', ''),
    (r'\bno trenó na leg press\b', 'no leg press'),
    (r'\bna leg press\b', 'no leg press'),
    (r'^Alavanca frontal\b', 'Front lever'),
    (r'^Alavanca dorsal\b', 'Back lever'),
    (r'\bPanturrilha no burro\b', 'Panturrilha burrinho'),
    (r'\bplanche completo\b', 'planche completa'),
]
# aplicados em nomes e instruções
TEXT_RULES = [
    (r'\bbola de estabilidade\b', 'bola suíça'),
    (r'\bhaltere\b', 'halter'),
]


def fix(s, rules):
    for pat, rep in rules:
        s = re.sub(pat, rep, s)
    return re.sub(r'\s{2,}', ' ', s).strip()


cat = json.load(open(PATH, encoding='utf-8'))
changed = 0
for x in cat:
    pt = x.get('pt')
    if not pt:
        continue
    before = json.dumps(pt, ensure_ascii=False)
    pt['n'] = fix(fix(pt['n'], NAME_RULES), TEXT_RULES)
    pt['n'] = pt['n'][:1].upper() + pt['n'][1:]
    pt['i'] = [fix(s, TEXT_RULES) for s in pt['i']]
    changed += before != json.dumps(pt, ensure_ascii=False)
json.dump(cat, open(PATH, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(changed, 'exercícios ajustados')
