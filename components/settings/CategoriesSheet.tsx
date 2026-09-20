// components/settings/CategoriesSheet.tsx — les métiers du prestataire, en
// chips à cocher dans une feuille ; au moins un, enregistré d'un coup.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useAndroidBackClose } from '@/hooks/use-android-back-close';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { translateCategoryRaw } from '@/lib/categoryLabel';
import { toFeatherName } from '@/lib/iconMapper';
import { Cta } from '@/components/tracking';
import { BarLock } from '@/stores/nav';
import { Chip, type FeatherName } from './rows';

type Cat = { id: number; name: string; slug?: string | null; icon?: string | null };

async function loadCategories(): Promise<Cat[]> {
  try {
    const cached = await AsyncStorage.getItem('taxonomies_cache');
    if (cached) { const { data, ts } = JSON.parse(cached); if (Date.now() - ts < 24 * 60 * 60 * 1000) return data; }
  } catch { /* cache absent */ }
  const res: any = await api.taxonomies.list();
  const cats = res?.data ?? res ?? [];
  const arr = Array.isArray(cats) ? cats : [];
  AsyncStorage.setItem('taxonomies_cache', JSON.stringify({ data: arr, ts: Date.now() })).catch(() => {});
  return arr;
}

export function CategoriesSheet({ selectedIds, onClose, onSave }: { selectedIds: number[]; onClose: () => void; onSave: (ids: number[]) => Promise<void> }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const motion = useSheetMotion();
  const ref = useRef<BottomSheet>(null);
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [ids, setIds] = useState<number[]>(selectedIds);
  const [saving, setSaving] = useState(false);
  useEffect(() => { loadCategories().then(setCats).catch(() => { feedback.error('profile.categories_load_error'); setCats([]); }); }, []);
  const close = useCallback(() => ref.current?.close(), []);
  useAndroidBackClose(true, close);
  const renderBackdrop = useCallback((p: BottomSheetBackdropProps) => <BottomSheetBackdrop {...p} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.45} />, []);
  const toggle = (id: number) => setIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const changed = ids.length !== selectedIds.length || ids.some((id) => !selectedIds.includes(id));
  const save = async () => {
    if (!ids.length) { feedback.error('profile.select_service_required'); return; }
    setSaving(true);
    try { await onSave(ids); feedback.haptic('success'); ref.current?.close(); } catch (e: any) { feedback.error(e?.message || 'profile.save_error'); } finally { setSaving(false); }
  };
  return (
    <BottomSheet ref={ref} index={0} enableDynamicSizing enablePanDownToClose onClose={onClose} backdropComponent={renderBackdrop} animationConfigs={motion.animationConfigs} overDragResistanceFactor={motion.overDragResistanceFactor} backgroundStyle={{ backgroundColor: theme.cardBg, borderTopLeftRadius: 28, borderTopRightRadius: 28 }} handleIndicatorStyle={{ backgroundColor: theme.textDisabled, width: 36, height: 4 }}>
      <BottomSheetView style={[s.body, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
        <BarLock />
        <Text style={[s.kicker, { color: theme.textSub }]} maxFontSizeMultiplier={1.2}>{t('profile.trades').toUpperCase()}</Text>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('profile.trades_title')}</Text>
        {cats === null ? <ActivityIndicator color={theme.textMuted as string} style={{ marginVertical: 24 }} /> : (
          <View style={s.chips}>
            {cats.map((c) => <SelectableChip key={c.id} label={translateCategoryRaw(c)} icon={toFeatherName(c.icon) as FeatherName} on={ids.includes(c.id)} onPress={() => { feedback.haptic('selection'); toggle(c.id); }} />)}
          </View>
        )}
        <Text style={[s.hint, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('profile.trades_hint')}</Text>
        <View style={{ marginTop: 16 }}><Cta label={t('common.save')} onPress={save} disabled={!changed || !ids.length} loading={saving} /></View>
      </BottomSheetView>
    </BottomSheet>
  );
}

function SelectableChip({ label, icon, on, onPress }: { label: string; icon?: React.ComponentProps<typeof Chip>['icon']; on: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  return (
    <View style={on ? [s.on, { backgroundColor: theme.accent, borderColor: theme.accent }] : undefined}>
      <Chip label={label} icon={icon} onPress={onPress} />
      {on ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.onCover, { backgroundColor: theme.accent }]}><Text style={[s.onText, { color: theme.accentText }]} maxFontSizeMultiplier={1.2}>{label}</Text></View> : null}
    </View>
  );
}

const s = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingTop: 4 },
  kicker: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2 },
  title: { fontFamily: FONTS.bebas, fontSize: 26, letterSpacing: 0.5, marginTop: 8, marginBottom: 12, includeFontPadding: false },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 17, marginTop: 12 },
  on: { borderRadius: 999 },
  onCover: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  onText: { fontFamily: FONTS.sansMedium, fontSize: 12.5 },
});
