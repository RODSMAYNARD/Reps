// App em inglês. A versão em português está na tag git `pt-br-v1`.
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms', 'Abs', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full body', 'Cardio'];
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Body weight', 'Band', 'Kettlebell', 'Other'];
export const MUSCLE_GROUPS: Record<string, string> = {
  Chest: 'Chest', Back: 'Back', Shoulders: 'Shoulders', Biceps: 'Arms', Triceps: 'Arms', Forearms: 'Arms',
  Abs: 'Core', Quads: 'Legs', Hamstrings: 'Legs', Glutes: 'Legs', Calves: 'Legs', 'Full body': 'Full body', Cardio: 'Cardio',
};
export const MEASURE_FIELDS: { key: string; label: string; unit: 'weight' | 'pct' | 'body' }[] = [
  { key: 'weight', label: 'Body weight', unit: 'weight' },
  { key: 'bodyfat', label: 'Body fat', unit: 'pct' },
  { key: 'waist', label: 'Waist', unit: 'body' },
  { key: 'neck', label: 'Neck', unit: 'body' },
  { key: 'shoulder', label: 'Shoulder', unit: 'body' },
  { key: 'chest', label: 'Chest', unit: 'body' },
  { key: 'leftBicep', label: 'Left bicep', unit: 'body' },
  { key: 'rightBicep', label: 'Right bicep', unit: 'body' },
  { key: 'thigh', label: 'Thigh', unit: 'body' },
  { key: 'calf', label: 'Calf', unit: 'body' },
];
export const SET_TYPES = [
  { type: 'warmup', label: 'Warm-up set', badge: 'W', color: '#F5A524', help: 'A light set to prepare your body. It does not count toward volume.' },
  { type: 'normal', label: 'Normal set', badge: '', color: '', help: 'A standard working set.' },
  { type: 'failure', label: 'Failure set', badge: 'F', color: '#E5484D', help: 'A set taken to muscular failure.' },
  { type: 'drop', label: 'Drop set', badge: 'D', color: '#0A84FF', help: 'Reduce the weight and keep going without rest.' },
] as const;

export type Program = { id: string; title: string; subtitle: string; routines: { title: string; notes: string; exercises: string[] }[] };
// Template exercises use the catalog's English name (field `en`), see src/data/catalog.json.
export const PROGRAMS: Program[] = [
  { id: 'ppl', title: 'Push Pull Legs', subtitle: '3 routines · gym', routines: [
    { title: 'Push', notes: 'Chest, shoulders and triceps.', exercises: ['barbell bench press', 'dumbbell incline bench press', 'dumbbell standing overhead press', 'dumbbell lateral raise', 'cable pushdown'] },
    { title: 'Pull', notes: 'Back and biceps.', exercises: ['pull-up', 'barbell bent over row', 'cable seated row', 'barbell curl', 'dumbbell hammer curl'] },
    { title: 'Legs', notes: 'Complete leg day.', exercises: ['barbell full squat', 'lever alternate leg press', 'barbell romanian deadlift', 'lever lying leg curl', 'barbell standing calf raise'] },
  ] },
  { id: 'fullbody', title: 'Full Body 3x', subtitle: '2 routines · gym', routines: [
    { title: 'Full Body A', notes: 'Whole body, focus on the basics.', exercises: ['barbell full squat', 'barbell bench press', 'barbell bent over row', 'crunch floor'] },
    { title: 'Full Body B', notes: 'Whole body, variation.', exercises: ['barbell deadlift', 'dumbbell standing overhead press', 'chin-up', 'lever leg extension'] },
  ] },
  { id: 'upperlower', title: 'Upper / Lower', subtitle: '2 routines · gym', routines: [
    { title: 'Upper', notes: 'Upper body.', exercises: ['barbell bench press', 'lever seated row', 'dumbbell standing overhead press', 'barbell curl', 'cable pushdown'] },
    { title: 'Lower', notes: 'Lower body.', exercises: ['barbell full squat', 'barbell glute bridge', 'lever leg extension', 'lever lying leg curl'] },
  ] },
];
export const CATEGORIES = [
  { id: 'home', label: 'At home', icon: 'home-outline' },
  { id: 'travel', label: 'Travel', icon: 'briefcase-outline' },
  { id: 'dumbbell', label: 'Dumbbells only', icon: 'barbell-outline' },
  { id: 'band', label: 'Band', icon: 'pulse-outline' },
  { id: 'cardio', label: 'Cardio & HIIT', icon: 'flame-outline' },
  { id: 'gym', label: 'Gym', icon: 'fitness-outline' },
  { id: 'body', label: 'Bodyweight', icon: 'body-outline' },
] as const;

export type Template = { title: string; notes: string; exercises: string[] };
export const CATEGORY_ROUTINES: Record<string, Template[]> = {
  home: [{ title: 'Home workout', notes: 'No equipment needed, do it anywhere.', exercises: ['push-up', 'glute bridge march', 'crunch floor', 'mountain climber'] }],
  travel: [{ title: 'Travel workout', notes: 'Quick and equipment-free, perfect for a hotel room.', exercises: ['push-up', 'burpee', 'jump squat', 'crunch floor'] }],
  dumbbell: [{ title: 'Dumbbells: full body', notes: 'A complete workout using only dumbbells.', exercises: ['dumbbell bench press', 'dumbbell standing overhead press', 'dumbbell lunge', 'dumbbell hammer curl', 'dumbbell lateral raise'] }],
  band: [{ title: 'Band: full body', notes: 'A complete workout with resistance bands.', exercises: ['band bench press', 'band shoulder press', 'band squat', 'band alternating biceps curl', 'resistance band seated straight back row'] }],
  cardio: [{ title: 'Cardio & HIIT', notes: 'Cardiovascular conditioning.', exercises: ['jump rope', 'burpee', 'mountain climber', 'stationary bike walk'] }],
  gym: PROGRAMS.flatMap((p) => p.routines),
  body: [{ title: 'Bodyweight', notes: 'Strength using only your own body.', exercises: ['push-up', 'pull-up', 'chest dip', 'crunch floor'] }],
};

export const DEMO_ATHLETES = [
  { id: 'a1', name: 'Marina Costa', tag: 'Featured' }, { id: 'a2', name: 'Lucas Prado', tag: 'Featured' },
  { id: 'a3', name: 'Bia Nogueira', tag: 'Featured' }, { id: 'a4', name: 'Rafa Lima', tag: 'Featured' },
];

/** Recursos que ainda não têm backend: ficam ESCONDIDOS (e não "Coming soon") até existirem. Ligar uma bandeira só depois de implementar de verdade. */
export const FEATURES = { social: false, watch: false, integrations: false, coach: false, dataImport: false, workoutLink: false };

/** E-mail de suporte (troque aqui quando houver um endereço próprio). */
export const SUPPORT_EMAIL = 'rodrigo.maynard@gmail.com';
