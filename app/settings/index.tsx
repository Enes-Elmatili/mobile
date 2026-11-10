// app/settings/index.tsx — les réglages, c'est l'app (planche 7, 20/09/2026).
//
// Apparence et langue en tête (ce qui manquait), les notifications de la
// refonte (familles + heures calmes, inline), confidentialité & données, aide
// & support (les tickets ouverts d'abord), à propos, la suppression du compte
// à part, « se déconnecter » en simple lien avec la version.
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import type { Ticket } from '@/lib/types';
import { devWarn, reportError } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthContext';
import { feedback } from '@/lib/feedback/feedback';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { usePrefs, currentLanguage, LANGUAGE_PREFS, type LanguagePref, type ThemePref } from '@/stores/prefs';
import { Group, Row, SectionHead, SwitchRow } from '@/components/settings/rows';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { CascadeItem } from '@/lib/motion/useCascade';
import { LAYOUT } from '@/lib/motion/layout';
import { PressScale } from '@/components/ui/PressScale';
import { SettingsHeader } from '@/components/settings/SettingsHeader';
import { BookSpread, useSplitPane } from '@/lib/layout';

// Codes courts, toujours dans leur propre langue : FR · NL · EN · PL.
const LANGUAGE_OPTIONS = LANGUAGE_PREFS.map((value) => ({ value, label: value.toUpperCase() }));

type Prefs = { message: boolean; money: boolean; account: boolean; news: boolean; quiet: { enabled: boolean; from: string; to: string } };
const DEFAULTS: Prefs = { message: true, money: true, account: true, news: true, quiet: { enabled: false, from: '22:00', to: '07:00' } };

export default function Settings() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isSplit = useSplitPane();
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
    api.notifications.prefs().then((res) => setPrefs({ ...DEFAULTS, ...(res?.data || {}), quiet: { ...DEFAULTS.quiet, ...(res?.data?.quiet || {}) } })).catch((e: any) => { devWarn('[prefs]', e?.message); setPrefs(DEFAULTS); });
  }, []);
  const patch = useCallback(async (p: Partial<Prefs>) => {
    setPrefs((prev) => ({ ...(prev ?? DEFAULTS), ...p, quiet: { ...(prev ?? DEFAULTS).quiet, ...(p.quiet || {}) } }));
    try {
      const res = await api.notifications.updatePrefs(p);
      if (res?.data) setPrefs({ ...DEFAULTS, ...res.data, quiet: { ...DEFAULTS.quiet, ...(res.data.quiet || {}) } });
    } catch {
      feedback.error('notifications.prefs_error');
      api.notifications.prefs().then((res) => res?.data && setPrefs({ ...DEFAULTS, ...res.data })).catch((e) => reportError(e, 'settings.notification_prefs'));
    }
  }, []);

  // ─── Tickets ouverts ─────────────────────────────────────────────────────
  const [tickets, setTickets] = useState<Ticket[]>([]);
  useEffect(() => {
    api.tickets.list().then((res) => { const list = res?.data || res?.tickets || res; if (Array.isArray(list)) setTickets(list.filter((x) => x.status === 'OPEN' || x.status === 'IN_PROGRESS')); }).catch((e) => reportError(e, 'settings.tickets'));
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

  // Apparence : sur la page étroite du Duo, le segment passe sous son libellé
  // (à côté, il écrasait « Thème » en trois lettres).
  const themeSeg = <SegmentedControl<ThemePref> options={[{ value: 'system', label: t('settings.theme_system') }, { value: 'light', label: t('settings.theme_light') }, { value: 'dark', label: t('settings.theme_dark') }]} value={themePref} onChange={(v) => { feedback.haptic('selection'); setTheme(v); }} />;
  const langSeg = <SegmentedControl<LanguagePref> options={LANGUAGE_OPTIONS} value={language} onChange={(v) => { feedback.haptic('selection'); setLanguage(v); }} />;

  const appearanceBlock = (
        <CascadeItem index={0}>
        <SectionHead title={t('settings.appearance')} />
        <Group>
          {isSplit ? (
            <>
              <Row first glyph="◐" title={t('settings.theme')} chevron={false} />
              <View style={s.segBelow}>{themeSeg}</View>
              <Row glyph="Aa" title={t('settings.language')} chevron={false} />
              <View style={s.segBelow}>{langSeg}</View>
            </>
          ) : (
            <>
              <Row first glyph="◐" title={t('settings.theme')} chevron={false} right={
                <View style={s.segWrap}>{themeSeg}</View>
              } />
              <Row glyph="Aa" title={t('settings.language')} chevron={false} right={
                <View style={s.segWrap}>{langSeg}</View>
              } />
            </>
          )}
        </Group>
        </CascadeItem>
  );
  const notificationsBlock = (
        <CascadeItem index={1}>
        <SectionHead title={t('notifications.prefs_title')} />
        <Group>
          <SwitchRow first icon="bell" title={t('notifications.prefs_missions')} sub={t('notifications.prefs_missions_sub')} value disabled onChange={() => {}} />
          <SwitchRow icon="message-square" title={t('notifications.prefs_message')} value={prefs?.message ?? true} onChange={(v) => patch({ message: v })} />
          <SwitchRow icon="credit-card" title={t('notifications.prefs_money')} value={prefs?.money ?? true} onChange={(v) => patch({ money: v })} />
          <SwitchRow icon="star" title={t('notifications.prefs_account')} value={prefs?.account ?? true} onChange={(v) => patch({ account: v })} />
          <SwitchRow icon="clock" title={t('notifications.prefs_quiet')} sub={`${q.from} – ${q.to}`} value={q.enabled} onChange={(v) => patch({ quiet: { ...q, enabled: v } })} />
        </Group>
        </CascadeItem>
  );
  const privacyBlock = (
        <CascadeItem index={2}>
        <SectionHead title={t('settings.privacy_data')} />
        <Group>
          <Row first icon="file-text" title={t('settings.your_data')} sub={t('settings.your_data_sub')} onPress={() => router.push('/settings/privacy')} />
          <Row icon="map-pin" title={t('settings.location')} sub={isProvider ? t('settings.location_sub_provider') : t('settings.location_sub_client')} onPress={() => router.push('/settings/privacy')} />
        </Group>
        </CascadeItem>
  );
  const helpBlock = (
        <CascadeItem index={3}>
        <SectionHead title={t('settings.help_support')} aside={tickets.length ? t('profile.tickets_open_count', { count: tickets.length }) : null} />
        <Group>
          {tickets.slice(0, 2).map((tk, i) => (
            <Animated.View key={tk.id} entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)} layout={LAYOUT}>
              <Row first={i === 0} icon="message-square" title={tk.title} sub={tk.status === 'OPEN' ? t('profile.ticket_open') : t('profile.ticket_in_progress')} onPress={() => router.push({ pathname: '/tickets/[id]', params: { id: String(tk.id) } })} />
            </Animated.View>
          ))}
          <Row first={tickets.length === 0} glyph="?" title={t('settings.faq')} sub={t('settings.faq_sub')} onPress={() => router.push('/settings/help')} />
          <Row glyph="+" title={t('settings.write_us')} sub={t('settings.write_us_sub')} onPress={() => router.push('/settings/help')} />
        </Group>
        </CascadeItem>
  );
  const aboutBlock = (
        <CascadeItem index={4}>
        <SectionHead title={t('settings.about')} />
        <Group>
          <Row first icon="file-text" title={t('profile.terms')} onPress={() => router.push('/settings/cgu')} />
          <Row icon="lock" title={t('profile.privacy')} onPress={() => router.push('/settings/privacy')} />
        </Group>
        </CascadeItem>
  );
  const accountBlock = (
        <CascadeItem index={5}>
        <SectionHead title={t('profile.account')} />
        <Group>
          <Row first icon="x" danger title={t('ext.privacy_delete_account')} sub={t('settings.delete_sub')} onPress={deleteAccount} />
        </Group>

        <PressScale onPress={logout} style={s.out} accessibilityRole="button" accessibilityLabel={t('auth.logout')} hitSlop={8}>
          <Text style={[s.outText, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3}>{t('auth.logout')}</Text>
        </PressScale>
        <Text style={[s.version, { color: theme.textMuted }]} maxFontSizeMultiplier={1.2}>{`FIXED ${version}${build ? ` · BUILD ${build}` : ''}`}</Text>
        </CascadeItem>
  );
  const header = <SettingsHeader title={t('settings.title')} />;
  const scrollBottom = { paddingBottom: Math.max(insets.bottom, 12) + 24 };

  if (isSplit) {
    // Duo déplié : à gauche vos préférences (apparence, notifications,
    // confidentialité), à droite le reste (aide, à propos, compte).
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <BookSpread
          left={
            <>
              {header}
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>
                {appearanceBlock}
                {notificationsBlock}
                {privacyBlock}
              </ScrollView>
            </>
          }
          right={
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.pageTop, scrollBottom]}>
              {helpBlock}
              {aboutBlock}
              {accountBlock}
            </ScrollView>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {header}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={scrollBottom}>
        {/* -- Apparence -- */}
        {appearanceBlock}

        {/* -- Notifications -- */}
        {notificationsBlock}

        {/* -- Confidentialité & données -- */}
        {privacyBlock}

        {/* -- Aide & support -- */}
        {helpBlock}

        {/* -- À propos -- */}
        {aboutBlock}

        {/* -- Compte : la suppression, à part -- */}
        {accountBlock}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  segWrap: { width: 208 },
  // Sous le libellé, calé sur le texte de la ligne (14 + 34 + 12).
  segBelow: { paddingLeft: 60, paddingRight: 14, paddingBottom: 12, marginTop: -4 },
  // Page droite : même marge haute que la page gauche.
  pageTop: { paddingTop: 12 },
  out: { alignItems: 'center', paddingVertical: 14, marginTop: 10 },
  outText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  version: { textAlign: 'center', fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 1.5, marginTop: 2 },
});
