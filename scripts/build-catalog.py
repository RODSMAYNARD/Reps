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
    'abs': 'Abdômen', 'pectorals': 'Peito', 'biceps': 'Bíceps', 'glutes': 'Glúteos', 'delts': 'Ombros', 'triceps': 'Tríceps',
    'upper back': 'Costas', 'lats': 'Costas', 'calves': 'Panturrilha', 'quads': 'Quadríceps', 'forearms': 'Antebraço',
    'cardiovascular system': 'Cardio', 'hamstrings': 'Posterior', 'spine': 'Costas', 'traps': 'Costas', 'adductors': 'Glúteos',
    'abductors': 'Glúteos', 'serratus anterior': 'Peito', 'levator scapulae': 'Ombros',
}
TARGET_PT = {
    'abs': 'Abdominais', 'pectorals': 'Peitoral', 'biceps': 'Bíceps', 'glutes': 'Glúteos', 'delts': 'Deltoides', 'triceps': 'Tríceps',
    'upper back': 'Parte superior das costas', 'lats': 'Dorsais', 'calves': 'Panturrilhas', 'quads': 'Quadríceps', 'forearms': 'Antebraços',
    'cardiovascular system': 'Sistema cardiovascular', 'hamstrings': 'Posteriores da coxa', 'spine': 'Coluna', 'traps': 'Trapézio',
    'adductors': 'Adutores', 'abductors': 'Abdutores', 'serratus anterior': 'Serrátil anterior', 'levator scapulae': 'Levantador da escápula',
}
SECONDARY_PT = {
    'hip flexors': 'Flexores do quadril', 'lower back': 'Lombar', 'obliques': 'Oblíquos', 'hamstrings': 'Posteriores da coxa', 'glutes': 'Glúteos',
    'biceps': 'Bíceps', 'rhomboids': 'Romboides', 'ankle stabilizers': 'Estabilizadores do tornozelo', 'forearms': 'Antebraços', 'triceps': 'Tríceps',
    'shoulders': 'Ombros', 'core': 'Core', 'back': 'Costas', 'quadriceps': 'Quadríceps', 'calves': 'Panturrilhas', 'chest': 'Peito',
    'rear deltoids': 'Deltoide posterior', 'traps': 'Trapézio', 'upper back': 'Parte superior das costas', 'trapezius': 'Trapézio', 'ankles': 'Tornozelos',
    'feet': 'Pés', 'deltoids': 'Deltoides', 'brachialis': 'Braquial', 'groin': 'Virilha', 'wrists': 'Punhos', 'rotator cuff': 'Manguito rotador',
    'upper chest': 'Peito superior', 'latissimus dorsi': 'Dorsais', 'wrist flexors': 'Flexores do punho', 'wrist extensors': 'Extensores do punho',
    'abdominals': 'Abdominais', 'grip muscles': 'Músculos da pegada', 'lower abs': 'Abdômen inferior', 'lats': 'Dorsais', 'inner thighs': 'Parte interna da coxa',
    'soleus': 'Sóleo', 'sternocleidomastoid': 'Esternocleidomastóideo', 'hands': 'Mãos', 'shins': 'Canelas',
}
EQUIP = {
    'body weight': 'Peso do corpo', 'dumbbell': 'Halter', 'cable': 'Cabo', 'barbell': 'Barra', 'ez barbell': 'Barra', 'olympic barbell': 'Barra', 'trap bar': 'Barra',
    'leverage machine': 'Máquina', 'smith machine': 'Máquina', 'sled machine': 'Máquina', 'assisted': 'Máquina', 'skierg machine': 'Máquina',
    'upper body ergometer': 'Máquina', 'stationary bike': 'Máquina', 'elliptical machine': 'Máquina', 'stepmill machine': 'Máquina',
    'band': 'Elástico', 'resistance band': 'Elástico', 'kettlebell': 'Kettlebell',
}

def refine(e, mus):
    """No dataset, agachamentos e avanços têm alvo 'glutes'; separa por nome para o app."""
    n = e['name'].lower()
    if e['target'] == 'glutes' and e.get('category') not in ('upper legs', None):
        cat = {'chest': 'Peito', 'back': 'Costas', 'waist': 'Abdômen', 'shoulders': 'Ombros', 'lower legs': 'Panturrilha', 'cardio': 'Cardio', 'lower arms': 'Antebraço'}.get(e['category'])
        if e['category'] == 'upper arms': return 'Tríceps' if 'tricep' in n else 'Bíceps'
        if cat: return cat
    if e['target'] == 'glutes':
        if re.search(r'stretch|pose|adduction|abduction|lift', n): return 'Glúteos'
        if re.search(r'hip thrust|glute bridge|bridge|kickback|kick back|pull through|donkey|fire hydrant|hip extension|clam', n): return 'Glúteos'
        if re.search(r'deadlift|good morning|stiff|leg curl|hamstring|romanian', n): return 'Posterior'
        return 'Quadríceps'
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

out, seen = [], {}
for e in data:
    mus = refine(e, MUSCLE.get(e['target'], 'Corpo todo'))
    en_steps = e['instruction_steps']['en']
    t = tr.get(e['id'])
    ok = t and len(t['passos']) == len(en_steps) and t.get('nome')
    name = cap(t['nome'].strip()) if ok else cap(e['name'])
    name = re.sub(r'\s*\((masculino|feminino|male|female)\)', '', name, flags=re.I).strip()
    seen[name] = seen.get(name, 0) + 1
    if seen[name] > 1: name = f"{name} ({seen[name]})"
    out.append({
        'id': e['id'], 'n': name, 'en': e['name'], 'm': mus, 'e': EQUIP.get(e['equipment'], 'Outro'), 'k': kind(e, mus),
        't': TARGET_PT.get(e['target'], cap(e['target'])), 's': [SECONDARY_PT.get(x, cap(x)) for x in e['secondary_muscles']],
        'i': [s.strip() for s in (t['passos'] if ok else en_steps)], 'l': 'pt' if ok else 'en',
    })
os.makedirs('src/data', exist_ok=True)
json.dump(out, open('src/data/catalog.json', 'w'), ensure_ascii=False, separators=(',', ':'))
pt = sum(1 for x in out if x['l'] == 'pt')
print(f'{len(out)} exercícios, {pt} traduzidos, {os.path.getsize("src/data/catalog.json")//1024} KB')
