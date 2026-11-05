import { Exercise, ExerciseKind } from './types';

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

const ex = (name: string, muscle: string, equipment: string, kind: ExerciseKind = 'weight_reps') => ({ name, muscle, equipment, kind });
export const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  ex('Supino reto (Barra)', 'Peito', 'Barra'), ex('Supino inclinado (Halter)', 'Peito', 'Halter'), ex('Crucifixo (Máquina)', 'Peito', 'Máquina'),
  ex('Flexão de braço', 'Peito', 'Peso do corpo', 'reps'), ex('Agachamento (Barra)', 'Quadríceps', 'Barra'), ex('Leg press (Máquina)', 'Quadríceps', 'Máquina'),
  ex('Cadeira extensora', 'Quadríceps', 'Máquina'), ex('Mesa flexora', 'Posterior', 'Máquina'), ex('Levantamento terra (Barra)', 'Costas', 'Barra'),
  ex('Stiff (Barra)', 'Posterior', 'Barra'), ex('Avanço (Halter)', 'Quadríceps', 'Halter'), ex('Elevação pélvica (Barra)', 'Glúteos', 'Barra'),
  ex('Panturrilha em pé (Máquina)', 'Panturrilha', 'Máquina'), ex('Remada curvada (Barra)', 'Costas', 'Barra'), ex('Puxada frontal (Cabo)', 'Costas', 'Cabo'),
  ex('Barra fixa', 'Costas', 'Peso do corpo', 'reps'), ex('Remada baixa (Cabo)', 'Costas', 'Cabo'), ex('Desenvolvimento (Halter)', 'Ombros', 'Halter'),
  ex('Elevação lateral (Halter)', 'Ombros', 'Halter'), ex('Rosca direta (Barra)', 'Bíceps', 'Barra'), ex('Rosca martelo (Halter)', 'Bíceps', 'Halter'),
  ex('Tríceps corda (Cabo)', 'Tríceps', 'Cabo'), ex('Tríceps testa (Barra)', 'Tríceps', 'Barra'), ex('Mergulho (Paralelas)', 'Tríceps', 'Peso do corpo', 'reps'),
  ex('Abdominal na máquina', 'Abdômen', 'Máquina'), ex('Prancha', 'Abdômen', 'Peso do corpo', 'duration'), ex('Corrida (Esteira)', 'Cardio', 'Máquina', 'duration'),
  ex('Bicicleta ergométrica', 'Cardio', 'Máquina', 'duration'),
];

export type Program = { id: string; title: string; subtitle: string; routines: { title: string; notes: string; exercises: string[] }[] };
export const PROGRAMS: Program[] = [
  { id: 'ppl', title: 'Push Pull Legs', subtitle: '3 rotinas · academia', routines: [
    { title: 'Push', notes: 'Peito, ombros e tríceps.', exercises: ['Supino reto (Barra)', 'Supino inclinado (Halter)', 'Desenvolvimento (Halter)', 'Elevação lateral (Halter)', 'Tríceps corda (Cabo)'] },
    { title: 'Pull', notes: 'Costas e bíceps.', exercises: ['Barra fixa', 'Remada curvada (Barra)', 'Puxada frontal (Cabo)', 'Rosca direta (Barra)', 'Rosca martelo (Halter)'] },
    { title: 'Legs', notes: 'Pernas completas.', exercises: ['Agachamento (Barra)', 'Leg press (Máquina)', 'Stiff (Barra)', 'Mesa flexora', 'Panturrilha em pé (Máquina)'] },
  ] },
  { id: 'fullbody', title: 'Full Body 3x', subtitle: '2 rotinas · academia', routines: [
    { title: 'Full Body A', notes: 'Corpo todo, foco em básicos.', exercises: ['Agachamento (Barra)', 'Supino reto (Barra)', 'Remada curvada (Barra)', 'Prancha'] },
    { title: 'Full Body B', notes: 'Corpo todo, variação.', exercises: ['Levantamento terra (Barra)', 'Desenvolvimento (Halter)', 'Puxada frontal (Cabo)', 'Abdominal na máquina'] },
  ] },
  { id: 'upperlower', title: 'Upper / Lower', subtitle: '2 rotinas · academia', routines: [
    { title: 'Upper', notes: 'Parte superior.', exercises: ['Supino reto (Barra)', 'Remada baixa (Cabo)', 'Desenvolvimento (Halter)', 'Rosca direta (Barra)', 'Tríceps testa (Barra)'] },
    { title: 'Lower', notes: 'Parte inferior.', exercises: ['Agachamento (Barra)', 'Elevação pélvica (Barra)', 'Cadeira extensora', 'Mesa flexora'] },
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
  home: [{ title: 'Treino em casa', notes: 'Sem equipamento, pode ser feito em qualquer lugar.', exercises: ['Flexão de braço', 'Mergulho (Paralelas)', 'Prancha'] }],
  travel: [{ title: 'Treino de viagem', notes: 'Rápido e sem equipamento, ideal para o quarto do hotel.', exercises: ['Flexão de braço', 'Prancha', 'Mergulho (Paralelas)'] }],
  dumbbell: [{ title: 'Halteres: corpo todo', notes: 'Treino completo usando apenas halteres.', exercises: ['Supino inclinado (Halter)', 'Desenvolvimento (Halter)', 'Avanço (Halter)', 'Rosca martelo (Halter)', 'Elevação lateral (Halter)'] }],
  band: [],
  cardio: [{ title: 'Cardio e HIIT', notes: 'Condicionamento cardiovascular.', exercises: ['Corrida (Esteira)', 'Bicicleta ergométrica', 'Prancha'] }],
  gym: PROGRAMS.flatMap((p) => p.routines),
  body: [{ title: 'Peso do corpo', notes: 'Força usando só o seu corpo.', exercises: ['Flexão de braço', 'Barra fixa', 'Mergulho (Paralelas)', 'Prancha'] }],
};

export const DEMO_ATHLETES = [
  { id: 'a1', name: 'Marina Costa', tag: 'Destaque' }, { id: 'a2', name: 'Lucas Prado', tag: 'Destaque' },
  { id: 'a3', name: 'Bia Nogueira', tag: 'Destaque' }, { id: 'a4', name: 'Rafa Lima', tag: 'Destaque' },
];
