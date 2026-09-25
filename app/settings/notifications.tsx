// app/settings/notifications.tsx — Préférences de notification.
// Trois familles, un interrupteur chacune ; les missions ne se coupent pas (on
// ne peut pas être en ligne sans les entendre). Une plage de silence pour le
// reste. Branché sur le catalogue serveur (GET/PATCH /notifications/prefs) :
// chaque interrupteur agit vraiment sur ce qui arrive à l'écran verrouillé.
// Tout reste visible dans la cloche. Les réglages de retour (son, haptique,
// animations) restent en bas, locaux à l'appareil.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Platform, StatusBar, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { feedback } from '@/lib/feedback/feedback';
import { api } from '@/lib/api';
import { devWarn } from '@/lib/logger';
import { PressScale } from '@/components/ui/PressScale';

type Prefs = { message: boolean; money: boolean; account: boolean; news: boolean; quiet: { enabled: boolean; from: string; to: string } };
const DEFAULTS: Prefs = { message: true, money: true, account: true, news: true, quiet: { enabled: false, from: '22:00', to: '07:00' } };

function Row({ icon, label, sublabel, value, onToggle, locked = false, trailing, last = false }: {
  icon: React.ComponentProps<typeof Feather>['name']; label: string; sublabel?: string;
  value: boolean; onToggle?: (v: boolean) => void; locked?: boolean; trailing?: React.ReactNode; last?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={[r.row, !last && { borderBottomColor: theme.borderLight, borderBottomWidth: StyleSheet.hairlineWidth }]} accessible accessibilityRole={locked ? 'text' : 'switch'} accessibilityState={{ checked: value, disabled: locked }} accessibilityLabel={`${label}${sublabel ? `. ${sublabel}` : ''}`}>
      <View style={[r.ic, { backgroundColor: theme.surface }]}>
        <Feather name={icon} size={17} color={theme.textSub} />
      </View>
      <View style={r.body}>
        <Text style={[r.label, { color: theme.text }]} maxFontSizeMultiplier={1.3}>{label}</Text>
        {sublabel ? <Text style={[r.sub, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{sublabel}</Text> : null}
      </View>
      {trailing ?? (
        <Switch
          value={value}
          disabled={locked}
          onValueChange={onToggle}
          trackColor={{ false: theme.border as string, true: theme.greenText as string }}
          thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
          ios_backgroundColor={theme.border as string}
          style={locked ? { opacity: 0.55 } : undefined}
        />
      )}
    </View>
  );
}

const r = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 60 },
  ic: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 14.5, lineHeight: 19 },
  sub: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 16, marginTop: 1 },
});

// Défini hors du rendu : un groupe recréé à chaque rendu remonterait ses interrupteurs.
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <>
      <Text style={[s.group, { color: theme.textMuted }]} maxFontSizeMultiplier={1.3} accessibilityRole="header">{title.toUpperCase()}</Text>
      <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>{children}</View>
    </>
  );
}

export default function NotificationsSettingsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const sound = useFeedbackPrefs((s) => s.sound);
  const haptics = useFeedbackPrefs((s) => s.haptics);
  const animations = useFeedbackPrefs((s) => s.animations);
  const setPref = useFeedbackPrefs((s) => s.setPref);

  const [prefs, setPrefs] = useState<Prefs | null>(null);
  useEffect(() => {
    api.notifications.prefs().then((res: any) => setPrefs({ ...DEFAULTS, ...(res?.data || {}), quiet: { ...DEFAULTS.quiet, ...(res?.data?.quiet || {}) } })).catch((e: any) => { devWarn('[prefs]', e?.message); setPrefs(DEFAULTS); });
  }, []);

  // Optimiste : l'interrupteur bouge tout de suite ; si le serveur refuse, il revient.
  const patch = useCallback(async (p: Partial<Prefs>) => {
    feedback.haptic('selection');
    setPrefs((prev) => ({ ...(prev ?? DEFAULTS), ...p, quiet: { ...(prev ?? DEFAULTS).quiet, ...(p.quiet || {}) } }));
    try {
      const res: any = await api.notifications.updatePrefs(p);
      if (res?.data) setPrefs({ ...DEFAULTS, ...res.data, quiet: { ...DEFAULTS.quiet, ...(res.data.quiet || {}) } });
    } catch (e: any) {
      devWarn('[prefs] save failed', e?.message);
      feedback.error('notifications.prefs_error');
      api.notifications.prefs().then((res: any) => res?.data && setPrefs({ ...DEFAULTS, ...res.data })).catch(() => {});
    }
  }, []);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={s.header}>
        <PressScale onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile'); }} style={[s.back, { backgroundColor: theme.cardBg, borderColor: theme.border  }]} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Feather name="arrow-left" size={18} color={theme.text} />
        </PressScale>
        <Text style={[s.title, { color: theme.text }]} maxFontSizeMultiplier={1.2} accessibilityRole="header">{t('notifications.prefs_title').toUpperCase()}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[s.lead, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('notifications.prefs_lead')}</Text>

        {!prefs ? <ActivityIndicator color={theme.textMuted} style={{ marginVertical: 40 }} /> : (
          <>
            <Group title={t('notifications.prefs_group_missions')}>
              <Row icon="map-pin" label={t('notifications.prefs_missions')} sublabel={t('notifications.prefs_missions_sub')} value locked />
              <Row icon="message-square" label={t('notifications.prefs_message')} sublabel={t('notifications.prefs_message_sub')} value={prefs.message} onToggle={(v) => patch({ message: v })} last />
            </Group>
            <Group title={t('notifications.prefs_group_money')}>
              <Row icon="credit-card" label={t('notifications.prefs_money')} sublabel={t('notifications.prefs_money_sub')} value={prefs.money} onToggle={(v) => patch({ money: v })} last />
            </Group>
            <Group title={t('notifications.prefs_group_account')}>
              <Row icon="star" label={t('notifications.prefs_account')} sublabel={t('notifications.prefs_account_sub')} value={prefs.account} onToggle={(v) => patch({ account: v })} />
              <Row icon="bell" label={t('notifications.prefs_news')} sublabel={t('notifications.prefs_news_sub')} value={prefs.news} onToggle={(v) => patch({ news: v })} last />
            </Group>
            <Group title={t('notifications.prefs_group_quiet')}>
              <Row
                icon="moon"
                label={t('notifications.prefs_quiet')}
                sublabel={`${t('notifications.prefs_quiet_sub')} · ${t('notifications.prefs_quiet_range', { from: prefs.quiet.from, to: prefs.quiet.to })}`}
                value={prefs.quiet.enabled}
                onToggle={(v) => patch({ quiet: { ...prefs.quiet, enabled: v } })}
                last
              />
            </Group>
          </>
        )}

        <Group title={t('feedback.settings.section')}>
          <Row icon="volume-2" label={t('feedback.settings.sound')} sublabel={t('feedback.settings.sound_sub')} value={sound} onToggle={(v) => { setPref('sound', v); feedback.haptic('selection'); }} />
          <Row icon="smartphone" label={t('feedback.settings.haptics')} sublabel={t('feedback.settings.haptics_sub')} value={haptics} onToggle={(v) => { setPref('haptics', v); if (v) feedback.haptic('selection'); }} />
          <Row icon="zap" label={t('feedback.settings.animations')} sublabel={t('feedback.settings.animations_sub')} value={animations} onToggle={(v) => { setPref('animations', v); feedback.haptic('selection'); }} last />
        </Group>

        <PressScale onPress={() => Linking.openSettings()} style={[s.sys, { borderColor: theme.border  }]} accessibilityRole="button" accessibilityLabel={t('ext.settings_notif_hint')}>
          <Feather name="settings" size={15} color={theme.textSub} />
          <Text style={[s.sysText, { color: theme.textSub }]} maxFontSizeMultiplier={1.3}>{t('ext.settings_notif_hint')}</Text>
          <Feather name="chevron-right" size={15} color={theme.textMuted} />
        </PressScale>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4 },
  back: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONTS.bebas, fontSize: 30, letterSpacing: 0.5, includeFontPadding: false },
  scroll: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 48 },
  lead: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 18.5, marginBottom: 10 },
  group: { fontFamily: FONTS.monoMedium, fontSize: 10.5, letterSpacing: 2, marginTop: 18, marginBottom: 8 },
  card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sys: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  sysText: { flex: 1, fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 17 },
});
