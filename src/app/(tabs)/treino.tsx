import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text, TextInput } from '../../components/Text';
import { ActiveBar } from '../../components/ActiveBar';
import { Card, Dialog, Header, IconButton, ListRow, Screen, Sheet, Tile } from '../../components/ui';
import { tr } from '../../lib/i18n';
import { useStore } from '../../lib/store';
import { colors, radius } from '../../lib/theme';
import { Routine, RoutineFolder } from '../../lib/types';

// Cartões de rotina com metade da altura do Tile padrão: ícone ao lado do texto
const half = { flexDirection: 'row', justifyContent: 'center', paddingVertical: 11 } as const;

export default function Treino() {
  const { trainer, routines, workouts, active, startWorkout, discardActive, deleteRoutine, saveRoutine, showToast, wprefs, setWprefs } = useStore();
  const [menu, setMenu] = useState<Routine | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; message: string; label: string; run: () => void } | null>(null);
  const [ask, setAsk] = useState<'replace' | null>(null);
  const [pending, setPending] = useState<Routine | null | undefined>(undefined);

  // Pastas de rotinas (como no Hevy): ficam nas preferências (wprefs, sincronizadas). Ids de rotinas apagadas são ignorados.
  const byId = new Map(routines.map((r) => [r.id, r]));
  const folders = wprefs.routineFolders.map((f) => ({ ...f, list: f.ids.map((x) => byId.get(x)).filter((r): r is Routine => !!r) }));
  const filed = new Set(folders.flatMap((f) => f.list.map((r) => r.id)));
  const loose = routines.filter((r) => !filed.has(r.id));
  const closed = new Set(wprefs.closedFolders);
  const toggle = (k: string) => setWprefs({ closedFolders: closed.has(k) ? wprefs.closedFolders.filter((x) => x !== k) : [...wprefs.closedFolders, k] });
  const setFolders = (fs: RoutineFolder[]) => setWprefs({ routineFolders: fs });
  /** Tira a rotina de qualquer pasta e, com `to`, põe no fim dessa pasta. */
  const moveTo = (rid: string, to: string | null) => setFolders(wprefs.routineFolders.map((f) => ({ ...f, ids: f.id === to ? [...f.ids.filter((x) => x !== rid), rid] : f.ids.filter((x) => x !== rid) })));
  const [folderMenu, setFolderMenu] = useState<RoutineFolder | null>(null);
  const [mineMenu, setMineMenu] = useState(false);
  const mineTitle = wprefs.mineName?.trim() || tr('My Routines');
  const [moveOf, setMoveOf] = useState<Routine | null>(null);
  /** Pop-up do nome: pasta nova (com `moveId`, a rotina já entra nela) ou renomear. */
  const [nameAsk, setNameAsk] = useState<{ rename?: string; moveId?: string } | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const askName = (a: { rename?: string; moveId?: string }, current = '') => { setNameDraft(current); setNameAsk(a); };
  const saveName = () => {
    const name = nameDraft.trim();
    if (!name || !nameAsk) return;
    if (nameAsk.rename === 'mine') setWprefs({ mineName: name });
    else if (nameAsk.rename) setFolders(wprefs.routineFolders.map((f) => (f.id === nameAsk.rename ? { ...f, name } : f)));
    else {
      const id = `f${Date.now().toString(36)}`;
      const rest = wprefs.routineFolders.map((f) => ({ ...f, ids: f.ids.filter((x) => x !== nameAsk.moveId) }));
      setFolders([...rest, { id, name, ids: nameAsk.moveId ? [nameAsk.moveId] : [] }]);
    }
    setNameAsk(null);
  };

  const start = (r?: Routine | null) => {
    if (active) { setPending(r ?? null); setAsk('replace'); return; }
    startWorkout({ routine: r ?? null });
    router.push('/active');
  };

  // Quantas vezes cada rotina foi concluída (treinos salvos com routineId)
  const doneCount = new Map<string, number>();
  for (const w of workouts) if (w.routineId) doneCount.set(w.routineId, (doneCount.get(w.routineId) ?? 0) + 1);
  // Cartão compacto (pedido do Rodrigo, 2026-11-23): só o nome, play azul redondo e ⋯
  const card = (r: Routine) => (
    <Card key={r.id} onPress={() => router.push({ pathname: '/routines/[id]', params: { id: r.id } })} testID="routine-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 8 }}>
      <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
        <Text numberOfLines={2} style={{ fontWeight: '700', fontSize: 17, lineHeight: 22, color: colors.text }}>{r.title}</Text>
        <View testID="routine-done" style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
          <Ionicons name="flame" size={13} color="#F97316" />
          <Text style={{ fontSize: 13, lineHeight: 17, color: colors.muted }}>{tr('{n} completed').replace('{n}', String(doneCount.get(r.id) ?? 0))}</Text>
        </View>
      </View>
      <Pressable onPress={() => start(r)} hitSlop={6} accessibilityLabel={tr('Start Routine')} testID="routine-start"
        style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 2 }} />
      </Pressable>
      <IconButton name="ellipsis-horizontal" size={20} onPress={() => setMenu(r)} />
    </Card>
  );
  const check = <Ionicons name="checkmark" size={20} color={colors.primary} />;

  return (
    <Screen edges={['top']}>
      <Header title="Workout" left="none" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Pressable onPress={() => router.navigate('/plano')} testID="open-trainer" style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.black, padding: 16, borderRadius: radius.md, marginBottom: 6 }}>
          <Ionicons name="sparkles" size={26} color="#fff" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: '#fff' }}>Trainer</Text>
            <Text style={{ color: '#C9CFD8' }}>{trainer ? `${tr('Next:')} ${trainer.workouts.find((w) => w.uid === trainer.nextUid)?.title ?? trainer.workouts[0]?.title}` : 'Your personalized program'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="#fff" />
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Quick Start</Text>
        <Pressable onPress={() => start(null)} testID="start-empty" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, paddingHorizontal: 16, height: 48, borderRadius: radius.md }}>
          <Text style={{ fontSize: 22, lineHeight: 26, color: colors.text }}>＋</Text><Text style={{ fontSize: 16, color: colors.text }}>Start Empty Workout</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>Routines</Text>
          <Pressable onPress={() => askName({})} hitSlop={10} accessibilityRole="button" accessibilityLabel={tr('New Folder')} testID="new-folder">
            <MaterialCommunityIcons name="folder-plus-outline" size={26} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Tile icon="clipboard-outline" label="New Routine" onPress={() => router.push('/routines/edit')} style={half} />
          <Tile icon="search-outline" label="Explore" onPress={() => router.push('/routines/explore')} style={half} />
        </View>
        <Pressable onPress={() => router.push('/routines/generate')} testID="open-generate" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.md }}>
          <Text style={{ fontSize: 20 }}>✨</Text><View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '600', color: colors.text }}>Generate workout plan</Text><Text style={{ color: colors.muted }}>Pick a goal, days and equipment</Text></View>
        </Pressable>
        {folders.map((f) => (
          <View key={f.id} testID={`folder-${f.name}`}>
            <FolderHead title={`${f.name} (${f.list.length})`} open={!closed.has(f.id)} onToggle={() => toggle(f.id)} onMenu={() => setFolderMenu(f)} />
            {!closed.has(f.id) && (f.list.length ? f.list.map(card) : <Text style={{ color: colors.muted, paddingHorizontal: 4, paddingBottom: 8 }}>This folder is empty</Text>)}
          </View>
        ))}
        {loose.length > 0 && (
          <View>
            <FolderHead title={`${mineTitle} (${loose.length})`} open={!closed.has('mine')} onToggle={() => toggle('mine')} onMenu={() => setMineMenu(true)} />
            {!closed.has('mine') && loose.map(card)}
          </View>
        )}
        <Pressable onPress={() => router.push('/settings/guide')} style={{ backgroundColor: colors.primarySoft, padding: 16, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', marginTop: 18 }}>
          <Text style={{ flex: 1, color: colors.text, fontSize: 16 }}>How to get started</Text><Text style={{ fontSize: 20 }}>→</Text>
        </Pressable>
      </ScrollView>
      <ActiveBar />
      <Sheet visible={!!menu} onClose={() => setMenu(null)} title={menu?.title}>
        <ListRow icon="play-outline" label="Start Routine" onPress={() => { const r = menu!; setMenu(null); start(r); }} />
        <ListRow icon="create-outline" label="Edit Routine" onPress={() => { const r = menu!; setMenu(null); router.push({ pathname: '/routines/edit', params: { id: r.id } }); }} />
        <ListRow icon="folder-outline" label="Move to Folder" onPress={() => { const r = menu!; setMenu(null); setMoveOf(r); }} testID="move-to-folder" />
        <ListRow icon="copy-outline" label="Duplicate Routine" onPress={async () => {
          const r = menu!; setMenu(null);
          const home = wprefs.routineFolders.find((f) => f.ids.includes(r.id));
          const copy = await saveRoutine({ title: `${r.title} (copy)`, notes: r.notes, exercises: r.exercises });
          if (copy && home) moveTo(copy.id, home.id);
          showToast('Routine duplicated');
        }} />
        <ListRow icon="trash-outline" label="Delete Routine" danger last onPress={() => { const r = menu!; setMenu(null); setConfirm({ title: 'Delete routine?', message: `"${r.title}" will be deleted. This can't be undone.`, label: 'Delete', run: () => { deleteRoutine(r.id); moveTo(r.id, null); showToast('Routine deleted'); } }); }} />
      </Sheet>
      <Sheet visible={!!moveOf} onClose={() => setMoveOf(null)} title="Move to Folder" subtitle={moveOf?.title}>
        {(() => {
          const cur = wprefs.routineFolders.find((f) => !!moveOf && f.ids.includes(moveOf.id))?.id ?? null;
          const pick = (to: string | null) => { if (moveOf) moveTo(moveOf.id, to); setMoveOf(null); };
          return (
            <>
              <ListRow icon="list-outline" label={mineTitle} onPress={() => pick(null)} right={cur === null ? check : undefined} />
              {wprefs.routineFolders.map((f) => (
                <ListRow key={f.id} icon="folder-outline" label={f.name} onPress={() => pick(f.id)} right={cur === f.id ? check : undefined} />
              ))}
              <ListRow icon="add" label="New Folder" last onPress={() => { const r = moveOf!; setMoveOf(null); askName({ moveId: r.id }); }} />
            </>
          );
        })()}
      </Sheet>
      <Sheet visible={!!folderMenu} onClose={() => setFolderMenu(null)} title={folderMenu?.name}>
        <ListRow icon="add" label="Add New Routine" onPress={() => { const f = folderMenu!; setFolderMenu(null); router.push({ pathname: '/routines/edit', params: { folder: f.id } }); }} />
        <ListRow icon="create-outline" label="Rename Folder" onPress={() => { const f = folderMenu!; setFolderMenu(null); askName({ rename: f.id }, f.name); }} />
        <ListRow icon="trash-outline" label="Delete Folder" danger last onPress={() => { const f = folderMenu!; setFolderMenu(null); setConfirm({ title: 'Delete folder?', message: 'The routines in it go back to My Routines. No routine is deleted.', label: 'Delete', run: () => setWprefs({ routineFolders: wprefs.routineFolders.filter((x) => x.id !== f.id), closedFolders: wprefs.closedFolders.filter((x) => x !== f.id) }) }); }} />
      </Sheet>
      <Sheet visible={mineMenu} onClose={() => setMineMenu(false)} title={mineTitle}>
        <ListRow icon="add" label="Add New Routine" onPress={() => { setMineMenu(false); router.push('/routines/edit'); }} />
        <ListRow icon="create-outline" label="Rename" last onPress={() => { setMineMenu(false); askName({ rename: 'mine' }, mineTitle); }} testID="rename-mine" />
      </Sheet>
      <Dialog visible={!!nameAsk} hasInput title={nameAsk?.rename === 'mine' ? 'Rename' : nameAsk?.rename ? 'Rename Folder' : 'New Folder'} onClose={() => setNameAsk(null)}
        actions={[{ label: 'Cancel', onPress: () => setNameAsk(null) }, { label: nameAsk?.rename ? 'Save' : 'Create', primary: true, onPress: saveName }]}>
        <TextInput value={nameDraft} onChangeText={setNameDraft} autoFocus placeholder="Folder name" placeholderTextColor={colors.faint} onSubmitEditing={saveName} maxLength={40}
          style={{ backgroundColor: colors.surface, borderRadius: 10, padding: 12, fontSize: 16, color: colors.text }} testID="folder-name" />
      </Dialog>
      <Dialog visible={ask === 'replace'} title="A workout is already in progress" message="Discard the current workout and start a new one?" onClose={() => setAsk(null)}
        actions={[{ label: 'Back to workout', onPress: () => { setAsk(null); router.push('/active'); } }, { label: 'Discard and start', danger: true, onPress: () => { discardActive(); startWorkout({ routine: pending ?? null }); setAsk(null); router.push('/active'); } }]} />
      <Dialog visible={!!confirm} title={confirm?.title} message={confirm?.message} onClose={() => setConfirm(null)} actions={[{ label: 'Cancel' }, { label: confirm?.label ?? 'OK', danger: true, onPress: () => { const c = confirm; setConfirm(null); c?.run(); } }]} />
    </Screen>
  );
}

/** Cabeçalho de pasta/seção (como no Hevy): ▸/▾ recolhe, ⋯ abre o menu da pasta. */
function FolderHead({ title, open, onToggle, onMenu }: { title: string; open: boolean; onToggle: () => void; onMenu?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44 }}>
      <Pressable onPress={onToggle} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Ionicons name={open ? 'caret-down' : 'caret-forward'} size={14} color={colors.muted} />
        <Text style={{ fontSize: 16, color: colors.muted, flexShrink: 1 }} numberOfLines={1}>{title}</Text>
      </Pressable>
      {onMenu && <IconButton name="ellipsis-horizontal" onPress={onMenu} color={colors.muted} />}
    </View>
  );
}
