// app/settings/index.tsx — les réglages, c'est l'app (planche 7, 20/09/2026).
//
// Apparence et langue en tête (ce qui manquait), les notifications de la
// refonte (familles + heures calmes, inline), confidentialité & données, aide
// & support (les tickets ouverts d'abord), à propos, la suppression du compte
// à part, « se déconnecter » en simple lien avec la version.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devWarn } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePrefs, currentLanguage, type LanguagePref, type ThemePref } from '@/stores/prefs';
import { Group, Row, SectionHead, SwitchRow } from '@/components/settings/rows';

type Prefs = { message: boolean; money: boolean; account: boolean; news: boolean; quiet: { enabled: boolean; from: string; to: string } };
const DEFAULTS: Prefs = { message: true, money: true, account: true, news: true, quiet: { enabled: false, from: '22:00', to: '07:00' } };

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const isProvider = !!user?.roles?.includes('PROVIDER');

  // ─── Apparence et langue ─────────────────────────────────────────────────
  const themePref = usePrefs((s) => s.theme);
  const setTheme = usePrefs((s) => s.setTheme);
  const langPref = usePrefs((s) => s.language);
  const setLanguage = usePrefs((s) => s.setLanguage);
  const language: LanguagePref = langPref ?? currentLanguage();

  // ─── Notifications (mêmes préférences que l'écran dédié) ─────────────────
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    api.notifications.prefs().then((res: any) => setPrefs({ ...DEFAULTS, ...(res?.data || {}), quiet: { ...DEFAULTS.quiet, ...(res?.data?.quiet || {}) } })).catch((e: any) => { devWarn('[prefs]', e?.message); setPrefs(DEFAULTS); });
  }, []);
  const patch = useCallback(async (p: Partial<Prefs>) => {
    setPrefs((prev) => ({ ...(prev ?? DEFAULTS), ...p, quiet: { ...(prev ?? DEFAULTS).quiet, ...(p.quiet || {}) } }));
    try {
      const res: any = await api.notifications.updatePrefs(p);
      if (res?.data) setPrefs({ ...DEFAULTS, ...res.data, quiet: { ...DEFAULTS.quiet, ...(res.data.quiet || {}) } });
    } catch {
      feedback.error('notifications.prefs_error');
      api.notifications.prefs().then((res: any) => res?.data && setPrefs({ ...DEFAULTS, ...res.data })).catch(() => {});
    }
  }, []);

  // ─── Tickets ouverts ─────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<any[]>([]);
  useEffect(() => {
    api.tickets.list().then((res: any) => { const list = res?.data || res?.tickets || res; if (Array.isArray(list)) setTickets(list.filter((x) => x.status === 'OPEN' || x.status === 'IN_PROGRESS')); }).catch(() => {});
  }, []);

  // ─── Compte ──────────────────────────────────────────────────────────────
  const logout = async () => {
    const ok = await feedback.confirm({ titleKey: 'auth.logout', messageKey: 'auth.logout_confirm', confirmKey: 'profile.logout_destructive', cancelKey: 'common.cancel', destructive: true });
    if (!ok) return;
    await signOut();
    router.replace('/(auth)/login');
  };
  const deleteAccount = async () => {
    const ok = await feedback.confirm({ titleKey: 'ext.privacy_delete_account', messageKey: 'ext.privacy_delete_confirm_msg', confirmKey: 'ext.privacy_delete_definitive', cancelKey: 'common.cancel', destructive: true });
    if (!ok) return;
    try { await api.delete('/me'); await signOut(); router.replace('/(auth)/login'); } catch (e: any) { feedback.error(e?.message || t('common.error')); }
  };

  const version = Constants.expoConfig?.version ?? '';
  const build = (Constants as any).nativeBuildVersion ?? Constants.expoConfig?.ios?.buildNumber ?? null;
  const q = prefs?.quiet ?? DEFAULTS.quiet;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={s.head}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile'); }} style={[s.back, { backgroundColor: theme.cardBg, borderColor: theme.border }]} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
          <Feather name="arrow-left" size={18} color={theme.text as string} />
        </Pressable>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2}>{t('settings.title').toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 24 }}>
        {/* -- Apparence -- */}
        <SectionHead title={t('settings.appearance')} />
        <Group>
          <Row first glyph="◐" title={t('settings.theme')} chevron={false} right={
            <View style={s.segWrap}><SegmentedControl<ThemePref> options={[{ value: 'system', label: t('settings.theme_system') }, { value: 'light', label: t('settings.theme_light') }, { value: 'dark', label: t('settings.theme_dark') }]} value={themePref} onChange={(v) => { feedback.haptic('selection'); setTheme(v); }} /></View>
          } />
          <Row glyph="Aa" title={t('settings.language')} chevron={false} right={
            <View style={s.segWrap}><SegmentedControl<LanguagePref> options={[{ value: 'fr', label: 'FR' }, { value: 'nl', label: 'NL' }, { value: 'en', label: 'EN' }]} value={language} onChange={(v) => { feedback.haptic('selection'); setLanguage(v); }} /></View>
          } />
        </Group>

        {/* -- Notifications -- */}
        <SectionHead title={t('notifications.prefs_title')} />
        <Group>
          <SwitchRow first icon="bell" title={t('notifications.prefs_missions')} sub={t('notifications.prefs_missions_sub')} value disabled onChange={() => {}} />
          <SwitchRow icon="message-square" title={t('notifications.prefs_message')} value={prefs?.message ?? true} onChange={(v) => patch({ message: v })} />
          <SwitchRow icon="credit-card" title={t('notifications.prefs_money')} value={prefs?.money ?? true} onChange={(v) => patch({ money: v })} />
          <SwitchRow icon="star" title={t('notifications.prefs_account')} value={prefs?.account ?? true} onChange={(v) => patch({ account: v })} />
          <SwitchRow icon="clock" title={t('notifications.prefs_quiet')} sub={`${q.from} – ${q.to}`} value={q.enabled} onChange={(v) => patch({ quiet: { ...q, enabled: v } })} />
        </Group>

        {/* -- Confidentialité & données -- */}
        <SectionHead title={t('settings.privacy_data')} />
        <Group>
          <Row first icon="file-text" title={t('settings.your_data')} sub={t('settings.your_data_sub')} onPress={() => router.push('/settings/privacy')} />
          <Row icon="map-pin" title={t('settings.location')} sub={isProvider ? t('settings.location_sub_provider') : t('settings.location_sub_client')} onPress={() => router.push('/settings/privacy')} />
        </Group>

        {/* -- Aide & support -- */}
        <SectionHead title={t('settings.help_support')} aside={tickets.length ? t('profile.tickets_open_count', { count: tickets.length }) : null} />
        <Group>
          {tickets.slice(0, 2).map((tk, i) => (
            <Row key={tk.id} first={i === 0} icon="message-square" title={tk.title} sub={tk.status === 'OPEN' ? t('profile.ticket_open') : t('profile.ticket_in_progress')} onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: String(tk.id) } })} />
          ))}
          <Row first={tickets.length === 0} glyph="?" title={t('settings.faq')} sub={t('settings.faq_sub')} onPress={() => router.push('/settings/help')} />
          <Row glyph="+" title={t('settings.write_us')} sub={t('settings.write_us_sub')} onPress={() => router.push('/settings/help')} />
        </Group>

        {/* -- À propos -- */}
        <SectionHead title={t('settings.about')} />
        <Group>
          <Row first icon="file-text" title={t('profile.terms')} onPress={() => router.push('/settings/cgu')} />
          <Row icon="lock" title={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} />
        </Group>

        {/* -- Compte : la suppression, à part -- */}
        <SectionHead title={t('profile.account')} />
        <Group>
          <Row first icon="x" danger title={t('ext.privacy_delete_account')} sub={t('settings.delete_sub')} onPress={deleteAccount} />
        </Group>

        <Pressable onPress={logout} style={s.out} accessibilityRole="button" accessibilityLabel={t('auth.logout')} hitSlop={8}>
          <Text style={[s.outText, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{t('auth.logout')}</Text>
        </Pressable>
        <Text style={[s.version, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{`FIXED ${version}${build ? ` · BUILD ${build}` : ''}`}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  head: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  segWrap: { width: 190 },
  out: { alignItems: 'center', paddingVertical: 14, marginTop: 10 },
  outText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  version: { textAlign: 'center', fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.5, marginTop: 2 },
});
