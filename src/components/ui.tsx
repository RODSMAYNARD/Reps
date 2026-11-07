import { Ionicons } from '@expo/vector-icons';
import { router, useSegments } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleProp, StyleSheet, Switch, Text,
  TextInput, TextInputProps, TextStyle, View, ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../lib/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/** Verdadeiro quando a tela está desenhada dentro das abas: a barra de abas já cuida do rodapé e não existe "voltar". */
export const useInTabs = () => (useSegments() as string[])[0] === '(tabs)';

export function Screen({ children, edges = ['top', 'bottom'], style }: { children: React.ReactNode; edges?: ('top' | 'bottom')[]; style?: StyleProp<ViewStyle> }) {
  const inTabs = useInTabs();
  return (
    <SafeAreaView edges={inTabs ? edges.filter((e) => e !== 'bottom') : edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Header({ title, left = 'back', onLeft, right, subtitle, leftNode, titleAlign = 'center' }: {
  title?: React.ReactNode; left?: 'back' | 'cancel' | 'down' | 'none'; onLeft?: () => void; right?: React.ReactNode; subtitle?: string; leftNode?: React.ReactNode; titleAlign?: 'center' | 'left';
}) {
  const go = onLeft ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  const lefty = titleAlign === 'left';
  const leftKind = useInTabs() && left === 'back' ? 'none' : left;
  return (
    <View style={s.header}>
      <View style={{ minWidth: lefty ? 0 : 70, alignItems: 'flex-start', marginRight: lefty ? 12 : 0 }}>
        {leftNode}
        {leftKind === 'back' && <Pressable onPress={go} hitSlop={12} testID="header-back"><Ionicons name="arrow-back" size={24} color={colors.text} /></Pressable>}
        {leftKind === 'down' && <Pressable onPress={go} hitSlop={12} testID="header-back"><Ionicons name="chevron-down" size={26} color={colors.text} /></Pressable>}
        {leftKind === 'cancel' && <Pressable onPress={go} hitSlop={12} testID="header-back"><Text style={{ color: colors.primary, fontSize: 16 }}>Cancel</Text></Pressable>}
      </View>
      <View style={{ flex: 1, alignItems: lefty ? 'flex-start' : 'center' }}>
        {typeof title === 'string' ? <Text numberOfLines={1} style={s.headerTitle}>{title}</Text> : title}
        {!!subtitle && <Text style={{ color: colors.muted, fontSize: 12 }}>{subtitle}</Text>}
      </View>
      <View style={{ minWidth: lefty ? 0 : 70, alignItems: 'center', flexDirection: 'row', justifyContent: 'flex-end', gap: lefty ? 14 : 16 }}>{right}</View>
    </View>
  );
}

export function HeaderAction({ label, onPress, disabled, primary }: { label: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  if (primary)
    return (
      <Pressable onPress={onPress} disabled={disabled} style={[s.headerPill, disabled && { backgroundColor: colors.surfaceAlt }]}>
        <Text style={{ color: disabled ? colors.faint : colors.onPrimary, fontWeight: '700' }}>{label}</Text>
      </Pressable>
    );
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={10}>
      <Text style={{ color: disabled ? colors.faint : colors.primary, fontSize: 16, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, color = colors.text, size = 24, testID }: { name: IconName; onPress?: () => void; color?: string; size?: number; testID?: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} testID={testID}>
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

export function Btn({ title, onPress, variant = 'primary', disabled, loading, icon, style, testID, textStyle }: {
  textStyle?: StyleProp<TextStyle>; title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'; disabled?: boolean; loading?: boolean; icon?: IconName; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const bg = variant === 'primary' ? colors.primary : variant === 'secondary' ? colors.surface : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' ? colors.onPrimary : variant === 'ghost' ? colors.primary : colors.text;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={[s.btn, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderWidth: variant === 'outline' ? 1 : 0, borderColor: colors.border }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[{ color: fg, fontWeight: '600', fontSize: 16 }, textStyle]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function TextLink({ title, onPress, color = colors.primary, style }: { title: string; onPress: () => void; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={style}>
      <Text style={{ color, fontSize: 15, fontWeight: '500', textAlign: 'center' }}>{title}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label?: string; error?: string }) {
  return (
    <View style={{ gap: 4 }}>
      {!!label && <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>}
      <TextInput placeholderTextColor={colors.faint} {...props} style={[s.field, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]} />
      {!!error && <Text style={{ color: colors.danger, fontSize: 13 }}>{error}</Text>}
    </View>
  );
}

export function SearchBar({ value, onChangeText, placeholder = 'Search', onBack }: { value: string; onChangeText: (t: string) => void; placeholder?: string; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
      {onBack && <IconButton name="arrow-back" onPress={onBack} testID="header-back" />}
      <View style={s.search}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.faint} style={{ flex: 1, fontSize: 16, color: colors.text }} />
      </View>
    </View>
  );
}

export function Section({ title, right, children }: { title?: string; right?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <View>
      {(title || right) && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={{ color: colors.muted, fontSize: 15 }}>{title}</Text>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

export function ListRow({ icon, label, detail, onPress, danger, last, right, subtitle, testID }: {
  icon?: IconName; label: string; detail?: string; onPress?: () => void; danger?: boolean; last?: boolean; right?: React.ReactNode; subtitle?: string; testID?: string;
}) {
  return (
    <Pressable onPress={onPress} testID={testID} style={[s.row, !last && s.rowBorder]}>
      {icon && <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.text} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? colors.danger : colors.text, fontSize: 16 }}>{label}</Text>
        {!!subtitle && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>}
      </View>
      {!!detail && <Text style={{ color: colors.muted, fontSize: 15 }}>{detail}</Text>}
      {right}
      {onPress && !right && <Ionicons name="chevron-forward" size={18} color={colors.faint} />}
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  const C: any = onPress ? Pressable : View;
  return <C onPress={onPress} testID={testID} style={[s.card, style]}>{children}</C>;
}

export function Tile({ icon, label, onPress, style }: { icon: IconName; label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable onPress={onPress} style={[s.tile, style]}>
      <Ionicons name={icon} size={24} color={colors.text} />
      <Text style={{ color: colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function Pill({ label, active, onPress, color }: { label: string; active?: boolean; onPress?: () => void; color?: string }) {
  const bg = active ? color ?? colors.primary : colors.surface;
  return (
    <Pressable onPress={onPress} style={[s.pill, { backgroundColor: bg }]}>
      <Text style={{ color: active ? colors.onPrimary : colors.text, fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function PillRow({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' }}>
      {items.map((i) => <Pill key={i.id} label={i.label} active={value === i.id} onPress={() => onChange(i.id)} />)}
    </ScrollView>
  );
}

export function TopTabs({ items, value, onChange }: { items: { id: string; label: string }[]; value: string; onChange: (id: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border }}>
      {items.map((i) => (
        <Pressable key={i.id} onPress={() => onChange(i.id)} style={{ flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: value === i.id ? colors.primary : 'transparent' }}>
          <Text style={{ color: value === i.id ? colors.primary : colors.muted, fontSize: 15 }}>{i.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {options.map((o) => (
        <Pressable key={o.id} onPress={() => onChange(o.id)} style={[s.segItem, value === o.id && { backgroundColor: colors.primary }]}>
          <Text style={{ color: value === o.id ? colors.onPrimary : colors.text, fontWeight: '500', fontSize: 16 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ label, value, onChange, subtitle }: { label: string; value: boolean; onChange: (v: boolean) => void; subtitle?: string }) {
  return <ListRow label={label} subtitle={subtitle} right={<Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />} />;
}

export function Banner({ text, onClose, onPress }: { text: string; onClose?: () => void; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.banner}>
      <Text style={{ flex: 1, color: colors.text }}>{text}</Text>
      {onClose && <IconButton name="close" size={20} onPress={onClose} />}
    </Pressable>
  );
}

export function Empty({ icon = 'barbell-outline', text, action }: { icon?: IconName; text: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', padding: 32, gap: 12 }}>
      <Ionicons name={icon} size={44} color={colors.faint} />
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 15 }}>{text}</Text>
      {action}
    </View>
  );
}

export function Avatar({ name, size = 44, color = colors.surfaceAlt }: { name?: string; size?: number; color?: string }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      {name ? <Text style={{ color: colors.muted, fontWeight: '700', fontSize: size / 2.4 }}>{name.slice(0, 1).toUpperCase()}</Text> : <Ionicons name="person" size={size / 2} color={colors.faint} />}
    </View>
  );
}

export function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: color ?? colors.text, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

export function Sheet({ visible, onClose, title, subtitle, children, left, right }: { visible: boolean; onClose: () => void; title?: string; subtitle?: string; children: React.ReactNode; left?: React.ReactNode; right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding">
        <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} /></View>
          {!!title && (
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14 }}>
              <View style={{ width: 40 }}>{left}</View>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={{ textAlign: 'center', fontSize: 16, fontWeight: '500', color: colors.text }}>{title}</Text>
                {!!subtitle && <Text numberOfLines={1} style={{ textAlign: 'center', fontSize: 14, color: colors.muted, marginTop: 2 }}>{subtitle}</Text>}
              </View>
              <View style={{ width: 40, alignItems: 'flex-end' }}>{right}</View>
            </View>
          )}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type DialogAction = { label: string; onPress?: () => void; primary?: boolean; danger?: boolean };
export function Dialog({ visible, title, message, actions, onClose, children }: { visible: boolean; title?: string; message?: string; actions: DialogAction[]; onClose?: () => void; children?: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: colors.bg, borderRadius: radius.lg, padding: 20, gap: 14 }}>
          {!!title && <Text style={{ fontSize: 17, fontWeight: '700', textAlign: 'center', color: colors.text }}>{title}</Text>}
          {!!message && <Text style={{ fontSize: 15, textAlign: 'center', color: colors.text }}>{message}</Text>}
          {children}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {actions.map((a) => (
              <Pressable
                key={a.label}
                onPress={() => { a.onPress?.(); if (!a.onPress) onClose?.(); }}
                style={[s.btn, { flex: 1, backgroundColor: a.danger ? colors.danger : a.primary ? colors.primary : colors.surface }]}>
                <Text style={{ color: a.primary || a.danger ? colors.onPrimary : colors.text, fontWeight: '600', fontSize: 16 }}>{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Seletor de valor em lista (substitui os "wheels" do iOS). */
export function WheelPicker({ values, selected, onSelect, format = String }: { values: number[]; selected: number; onSelect: (v: number) => void; format?: (v: number) => string }) {
  return (
    <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ paddingVertical: 4 }}>
      {values.map((v) => (
        <Pressable key={v} onPress={() => onSelect(v)} style={{ paddingVertical: 10, alignItems: 'center', backgroundColor: v === selected ? colors.surface : 'transparent', borderRadius: radius.sm }}>
          <Text style={{ fontSize: 20, color: v === selected ? colors.text : colors.faint }}>{format(v)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function BarChart({ data, height = 140, format = (v: number) => String(Math.round(v * 10) / 10), highlightLast }: { data: { label: string; value: number }[]; height?: number; format?: (v: number) => string; highlightLast?: boolean }) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height, gap: 5 }}>
        {data.map((d, i) => (
          <View key={i} style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}>
            <View style={{ height: `${Math.max(2, (d.value / max) * 100)}%`, backgroundColor: highlightLast && i === data.length - 1 ? '#7DB9FF' : colors.primary, borderRadius: 3 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[0]?.label}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>max {format(max)}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

export function LineChart({ data, height = 150, unit = '' }: { data: { label: string; value: number }[]; height?: number; unit?: string }) {
  const [w, setW] = useState(0);
  if (!data.length) return <Text style={{ color: colors.muted, textAlign: 'center', padding: 30 }}>No data yet</Text>;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min || 1;
  const pts = data.map((d, i) => ({ x: data.length === 1 ? w / 2 : (i / (data.length - 1)) * (w - 16) + 8, y: height - 16 - ((d.value - min) / span) * (height - 32) }));
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <View style={{ height, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {[0, 1, 2].map((i) => <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 16 + (i * (height - 32)) / 2, borderTopWidth: 1, borderTopColor: colors.surface }} />)}
        {pts.slice(1).map((p, i) => {
          const a = pts[i];
          const len = Math.hypot(p.x - a.x, p.y - a.y);
          const ang = Math.atan2(p.y - a.y, p.x - a.x);
          return <View key={i} style={{ position: 'absolute', left: (a.x + p.x) / 2 - len / 2, top: (a.y + p.y) / 2 - 1, width: len, height: 2, backgroundColor: colors.primary, transform: [{ rotate: `${ang}rad` }] }} />;
        })}
        {pts.map((p, i) => <View key={i} style={{ position: 'absolute', left: p.x - 4, top: p.y - 4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />)}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[0].label}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{Math.round(min * 10) / 10}–{Math.round(max * 10) / 10}{unit}</Text>
        <Text style={{ color: colors.muted, fontSize: 11 }}>{data[data.length - 1].label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, backgroundColor: colors.bg },
  headerTitle: { fontSize: 16, fontWeight: '400', color: colors.text },
  headerPill: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.md },
  btn: { minHeight: 40, paddingHorizontal: 18, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  field: { fontSize: 16, color: colors.text, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 12, height: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 15, backgroundColor: colors.bg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  card: { backgroundColor: colors.bg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 14 },
  tile: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.md, paddingVertical: 20, alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.pill },
  segment: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3, gap: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.sm },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warnSoft, paddingHorizontal: 16, paddingVertical: 12 },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16 },
});
