#!/usr/bin/env python3
"""Gera src/data/catalog.json a partir do dataset hasaneyldrm/exercises-dataset (MIT, só o texto — a mídia NÃO é usada).

Uso: python3 scripts/build-catalog.py <exercises.json> [pasta_com_out_XX.json_de_traducao]
Traduções (opcional): arquivos out_*.json com [{id, nome, passos[]}]. Sem tradução, usa inglês.
"""
import glob, json, os, re, sys

src = sys.argv[1]
tr_dir = sys.argv[2] if len(sys.argv) > 2 else None
data = json.load(open(src))

MUSCLE = {  # target -> grupo muscular do app
    'abs': 'Abs', 'pectorals': 'Chest', 'biceps': 'Biceps', 'glutes': 'Glutes', 'delts': 'Shoulders', 'triceps': 'Triceps',
    'upper back': 'Back', 'lats': 'Back', 'calves': 'Calves', 'quads': 'Quads', 'forearms': 'Forearms',
    'cardiovascular system': 'Cardio', 'hamstrings': 'Hamstrings', 'spine': 'Back', 'traps': 'Back', 'adductors': 'Glutes',
    'abductors': 'Glutes', 'serratus anterior': 'Chest', 'levator scapulae': 'Shoulders',
}
EQUIP = {
    'body weight': 'Body weight', 'dumbbell': 'Dumbbell', 'cable': 'Cable', 'barbell': 'Barbell', 'ez barbell': 'Barbell', 'olympic barbell': 'Barbell', 'trap bar': 'Barbell',
    'leverage machine': 'Machine', 'smith machine': 'Machine', 'sled machine': 'Machine', 'assisted': 'Machine', 'skierg machine': 'Machine',
    'upper body ergometer': 'Machine', 'stationary bike': 'Machine', 'elliptical machine': 'Machine', 'stepmill machine': 'Machine',
    'band': 'Band', 'resistance band': 'Band', 'kettlebell': 'Kettlebell',
}

def refine(e, mus):
    """No dataset, agachamentos e avanços têm alvo 'glutes'; separa por nome para o app."""
    n = e['name'].lower()
    if e['target'] == 'glutes' and e.get('category') not in ('upper legs', None):
        cat = {'chest': 'Chest', 'back': 'Back', 'waist': 'Abs', 'shoulders': 'Shoulders', 'lower legs': 'Calves', 'cardio': 'Cardio', 'lower arms': 'Forearms'}.get(e['category'])
        if e['category'] == 'upper arms': return 'Triceps' if 'tricep' in n else 'Biceps'
        if cat: return cat
    if e['target'] == 'glutes':
        if re.search(r'stretch|pose|adduction|abduction|lift', n): return 'Glutes'
        if re.search(r'hip thrust|glute bridge|bridge|kickback|kick back|pull through|donkey|fire hydrant|hip extension|clam', n): return 'Glutes'
        if re.search(r'deadlift|good morning|stiff|leg curl|hamstring|romanian', n): return 'Hamstrings'
        return 'Quads'
    return mus

def kind(e, mus):
    n = e['name'].lower()
    if mus == 'Cardio' or re.search(r'\b(plank|hold|wall sit|stretch|jog|run|jump rope|bike|walk|treadmill|elliptical)\b', n):
        return 'duration'
    if e['equipment'] == 'body weight':
        return 'reps'
    return 'weight_reps'

tr = {}
if tr_dir:
    for f in sorted(glob.glob(os.path.join(tr_dir, 'out_*.json'))):
        for x in json.load(open(f)):
            tr[x['id']] = x

def cap(s): return s[:1].upper() + s[1:]
def clean(n): return re.sub(r'\s*\((masculino|feminino|male|female)\)', '', n, flags=re.I).replace('в°', '°').strip()
TARGET_EN = {'delts': 'Deltoids', 'abs': 'Abs', 'pectorals': 'Pectorals', 'lats': 'Lats', 'quads': 'Quadriceps', 'cardiovascular system': 'Cardiovascular system'}

out, seen = [], {}
for e in data:
    mus = refine(e, MUSCLE.get(e['target'], 'Full body'))
    en_steps = [x.strip() for x in e['instruction_steps']['en']]
    name = cap(clean(e['name']))
    seen[name] = seen.get(name, 0) + 1
    if seen[name] > 1: name = f"{name} ({seen[name]})"
    item = {
        'id': e['id'], 'n': name, 'en': clean(e['name']).lower(), 'm': mus, 'e': EQUIP.get(e['equipment'], 'Other'), 'k': kind(e, mus),
        't': TARGET_EN.get(e['target'], cap(e['target'])), 's': [cap(x) for x in e['secondary_muscles']], 'i': en_steps,
    }
    t = tr.get(e['id'])
    if t and len(t['passos']) == len(en_steps) and t.get('nome'):  # português (pt-BR), guardado para o futuro seletor de idioma
        item['pt'] = {'n': cap(re.sub(r'\s*\((masculino|feminino|male|female)\)', '', t['nome'], flags=re.I).strip()), 'i': [x.strip() for x in t['passos']]}
    out.append(item)
os.makedirs('src/data', exist_ok=True)
json.dump(out, open('src/data/catalog.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(f'{len(out)} exercises, {sum(1 for x in out if "pt" in x)} with pt-BR, {os.path.getsize("src/data/catalog.json")//1024} KB')
