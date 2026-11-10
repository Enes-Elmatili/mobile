// app/settings/addresses.tsx — vos adresses enregistrées : celles que le
// stepper retient à la première demande. On les relit, on en retire.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { SavedAddress } from '@/lib/types';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { Group, Row, SectionHead } from '@/components/settings/rows';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CascadeItem } from '@/lib/motion/useCascade';
import { LAYOUT } from '@/lib/motion/layout';
import { PressScale } from '@/components/ui/PressScale';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BookSpread, useSplitPane } from '@/lib/layout';
import { reportError } from '@/lib/logger';

export default function AddressesSettings() {
  const insets = useSafeAreaInsets();
  const isSplit = useSplitPane();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  useEffect(() => { api.addresses.list().then((res) => setAddresses(Array.isArray(res) ? res : res?.data || [])).catch((e) => reportError(e, 'settings.addresses')); }, []);
  const remove = useCallback(async (id: number) => {
    const ok = await feedback.confirm({ titleKey: 'addresses.delete_confirm', confirmKey: 'common.delete', cancelKey: 'common.cancel', destructive: true });
    if (!ok) return;
    try { await api.addresses.remove(id); setAddresses((prev) => prev.filter((a) => a.id !== id)); feedback.haptic('success'); } catch (e: any) { feedback.error(e?.message || t('common.error')); }
  }, [t]);

  const listBlock = (
        <CascadeItem index={0}>
        <SectionHead title={t('addresses.title')} aside={addresses.length ? String(addresses.length) : null} />
        <Animated.View layout={LAYOUT}>
        <Group>
          {addresses.length ? addresses.map((a, i) => (
            <Animated.View key={a.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(160)} layout={LAYOUT}>
              <Row first={i === 0} icon={/maison|home|huis/i.test(a.label || '') ? 'home' : 'map-pin'} title={a.label || t('addresses.address')} sub={a.address} chevron={false} right={
                <PressScale onPress={() => remove(a.id)} accessibilityRole="button" accessibilityLabel={t('common.delete')} hitSlop={10}><Feather name="trash-2" size={16} color={theme.textMuted as string} /></PressScale>
              } />
            </Animated.View>
          )) : <Row first icon="map-pin" title={t('addresses.empty')} sub={t('addresses.empty_sub')} chevron={false} />}
        </Group>
        </Animated.View>
        </CascadeItem>
  );
  const note = <Text style={[s.note, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('addresses.note')}</Text>;
  const header = <SettingsHeader title={t('addresses.title')} />;
  const scrollBottom = { paddingBottom: Math.max(insets.bottom, 12) + 24 };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {isSplit ? (
        // Duo déplié : à gauche d'où viennent ces adresses, à droite la liste.
        <BookSpread
          left={<>{header}<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>{note}</ScrollView></>}
          right={<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.pageTop, scrollBottom]}>{listBlock}</ScrollView>}
        />
      ) : (
        <>
          {header}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>
            {listBlock}
            {note}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  // Page droite : même marge haute que la page gauche.
  pageTop: { paddingTop: 12 },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 18 },
});
