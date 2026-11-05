export const MUSCLES = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Antebraço', 'Abdômen', 'Quadríceps', 'Posterior', 'Glúteos', 'Panturrilha', 'Corpo todo', 'Cardio'];
export const EQUIPMENT = ['Barra', 'Halter', 'Máquina', 'Cabo', 'Peso do corpo', 'Elástico', 'Kettlebell', 'Outro'];
export const MUSCLE_GROUPS: Record<string, string> = {
  Peito: 'Peito', Costas: 'Costas', Ombros: 'Ombros', Bíceps: 'Braços', Tríceps: 'Braços', Antebraço: 'Braços',
  Abdômen: 'Core', Quadríceps: 'Pernas', Posterior: 'Pernas', Glúteos: 'Pernas', Panturrilha: 'Pernas', 'Corpo todo': 'Corpo todo', Cardio: 'Cardio',
};
export const MEASURE_FIELDS: { key: string; label: string; unit: 'weight' | 'pct' | 'body' }[] = [
  { key: 'weight', label: 'Peso corporal', unit: 'weight' },
  { key: 'bodyfat', label: 'Gordura corporal', unit: 'pct' },
  { key: 'waist', label: 'Cintura', unit: 'body' },
  { key: 'neck', label: 'Pescoço', unit: 'body' },
  { key: 'shoulder', label: 'Ombro', unit: 'body' },
  { key: 'chest', label: 'Peito', unit: 'body' },
  { key: 'leftBicep', label: 'Bíceps esquerdo', unit: 'body' },
  { key: 'rightBicep', label: 'Bíceps direito', unit: 'body' },
  { key: 'thigh', label: 'Coxa', unit: 'body' },
  { key: 'calf', label: 'Panturrilha', unit: 'body' },
];
export const SET_TYPES = [
  { type: 'warmup', label: 'Série de aquecimento', badge: 'A', color: '#F5A524', help: 'Série leve para preparar o corpo. Não conta no volume.' },
  { type: 'normal', label: 'Série normal', badge: '', color: '#0B1220', help: 'Série de trabalho padrão.' },
  { type: 'failure', label: 'Série até a falha', badge: 'F', color: '#E5484D', help: 'Série levada até a falha muscular.' },
  { type: 'drop', label: 'Drop set', badge: 'D', color: '#0A84FF', help: 'Reduza a carga e continue sem descanso.' },
] as const;

export type Program = { id: string; title: string; subtitle: string; routines: { title: string; notes: string; exercises: string[] }[] };
// Os exercícios dos modelos usam o nome em inglês do catálogo (campo `en`), ver src/data/catalog.json.
export const PROGRAMS: Program[] = [
  { id: 'ppl', title: 'Push Pull Legs', subtitle: '3 rotinas · academia', routines: [
    { title: 'Push', notes: 'Peito, ombros e tríceps.', exercises: ['barbell bench press', 'dumbbell incline bench press', 'dumbbell standing overhead press', 'dumbbell lateral raise', 'cable pushdown'] },
    { title: 'Pull', notes: 'Costas e bíceps.', exercises: ['pull-up', 'barbell bent over row', 'cable seated row', 'barbell curl', 'dumbbell hammer curl'] },
    { title: 'Legs', notes: 'Pernas completas.', exercises: ['barbell full squat', 'lever alternate leg press', 'barbell romanian deadlift', 'lever lying leg curl', 'barbell standing calf raise'] },
  ] },
  { id: 'fullbody', title: 'Full Body 3x', subtitle: '2 rotinas · academia', routines: [
    { title: 'Full Body A', notes: 'Corpo todo, foco em básicos.', exercises: ['barbell full squat', 'barbell bench press', 'barbell bent over row', 'crunch floor'] },
    { title: 'Full Body B', notes: 'Corpo todo, variação.', exercises: ['barbell deadlift', 'dumbbell standing overhead press', 'chin-up', 'lever leg extension'] },
  ] },
  { id: 'upperlower', title: 'Upper / Lower', subtitle: '2 rotinas · academia', routines: [
    { title: 'Upper', notes: 'Parte superior.', exercises: ['barbell bench press', 'lever seated row', 'dumbbell standing overhead press', 'barbell curl', 'cable pushdown'] },
    { title: 'Lower', notes: 'Parte inferior.', exercises: ['barbell full squat', 'barbell glute bridge', 'lever leg extension', 'lever lying leg curl'] },
  ] },
];
export const CATEGORIES = [
  { id: 'home', label: 'Em casa', icon: 'home-outline' },
  { id: 'travel', label: 'Viagem', icon: 'briefcase-outline' },
  { id: 'dumbbell', label: 'Só halteres', icon: 'barbell-outline' },
  { id: 'band', label: 'Elástico', icon: 'pulse-outline' },
  { id: 'cardio', label: 'Cardio e HIIT', icon: 'flame-outline' },
  { id: 'gym', label: 'Academia', icon: 'fitness-outline' },
  { id: 'body', label: 'Peso do corpo', icon: 'body-outline' },
] as const;

export type Template = { title: string; notes: string; exercises: string[] };
export const CATEGORY_ROUTINES: Record<string, Template[]> = {
  home: [{ title: 'Treino em casa', notes: 'Sem equipamento, pode ser feito em qualquer lugar.', exercises: ['push-up', 'glute bridge march', 'crunch floor', 'mountain climber'] }],
  travel: [{ title: 'Treino de viagem', notes: 'Rápido e sem equipamento, ideal para o quarto do hotel.', exercises: ['push-up', 'burpee', 'jump squat', 'crunch floor'] }],
  dumbbell: [{ title: 'Halteres: corpo todo', notes: 'Treino completo usando apenas halteres.', exercises: ['dumbbell bench press', 'dumbbell standing overhead press', 'dumbbell lunge', 'dumbbell hammer curl', 'dumbbell lateral raise'] }],
  band: [{ title: 'Elástico: corpo todo', notes: 'Treino completo com faixas elásticas.', exercises: ['band bench press', 'band shoulder press', 'band squat', 'band alternating biceps curl', 'resistance band seated straight back row'] }],
  cardio: [{ title: 'Cardio e HIIT', notes: 'Condicionamento cardiovascular.', exercises: ['jump rope', 'burpee', 'mountain climber', 'stationary bike walk'] }],
  gym: PROGRAMS.flatMap((p) => p.routines),
  body: [{ title: 'Peso do corpo', notes: 'Força usando só o seu corpo.', exercises: ['push-up', 'pull-up', 'chest dip', 'crunch floor'] }],
};

export const DEMO_ATHLETES = [
  { id: 'a1', name: 'Marina Costa', tag: 'Destaque' }, { id: 'a2', name: 'Lucas Prado', tag: 'Destaque' },
  { id: 'a3', name: 'Bia Nogueira', tag: 'Destaque' }, { id: 'a4', name: 'Rafa Lima', tag: 'Destaque' },
];
