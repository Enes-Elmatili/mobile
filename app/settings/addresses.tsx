// app/settings/addresses.tsx — vos adresses enregistrées : celles que le
// stepper retient à la première demande. On les relit, on en retire.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { Group, Row, SectionHead } from '@/components/settings/rows';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CascadeItem } from '@/lib/motion/useCascade';
import { LAYOUT } from '@/lib/motion/layout';
import { PressScale } from '@/components/ui/PressScale';

export default function AddressesSettings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const [addresses, setAddresses] = useState<any[]>([]);
  useEffect(() => { api.addresses.list().then((res: any) => setAddresses(Array.isArray(res) ? res : res?.data || [])).catch(() => {}); }, []);
  const remove = useCallback(async (id: number) => {
    const ok = await feedback.confirm({ titleKey: 'addresses.delete_confirm', confirmKey: 'common.delete', cancelKey: 'common.cancel', destructive: true });
    if (!ok) return;
    try { await api.addresses.remove(id); setAddresses((prev) => prev.filter((a) => a.id !== id)); feedback.haptic('success'); } catch (e: any) { feedback.error(e?.message || t('common.error')); }
  }, [t]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={s.head}>
        <PressScale onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile'); }} style={[s.back, { backgroundColor: theme.cardBg, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
          <Feather name="arrow-left" size={18} color={theme.text as string} />
        </PressScale>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('addresses.title').toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 24 }}>
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
        <Text style={[s.note, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('addresses.note')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  note: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginTop: 18 },
});
