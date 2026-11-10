// app/settings/privacy.tsx — Confidentialité
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, StatusBar, type LayoutChangeEvent, type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { feedback } from '@/lib/feedback/feedback';
import { showSocketToast } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import { LegalHeader, LegalIndex, useAnchors } from '@/components/settings/legal';
import { BookSpread, useSplitPane } from '@/lib/layout';

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children, onLayout }: { title: string; children: React.ReactNode; onLayout?: (e: LayoutChangeEvent) => void }) {
  const theme = useAppTheme();
  return (
    <View onLayout={onLayout} style={[s.section, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
      <Text style={[s.sectionTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{title}</Text>
      {children}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const theme = useAppTheme();
  const [deleting, setDeleting] = useState(false);
  const isSplit = useSplitPane();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const { register, scrollTo } = useAnchors(scrollRef);

  const handleDeleteAccount = async () => {
    const ok = await feedback.confirm({
      titleKey: 'ext.privacy_delete_account',
      messageKey: 'ext.privacy_delete_confirm_msg',
      confirmKey: 'ext.privacy_delete_definitive',
      cancelKey: 'common.cancel',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await api.delete('/me');
      await signOut();
      router.replace('/(auth)/login');
    } catch (e: any) {
      showSocketToast(e?.message || t('common.error'), 'error');
      setDeleting(false);
    }
  };

  // Sur le Duo déplié, chaque section s'enregistre comme ancre du sommaire.
  const anchor = (key: string) => (isSplit ? register(key) : undefined);
  const sections = (
    <>
        <Section title={t('ext.privacy_section_data')} onLayout={anchor('data')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_data_body')}
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_rights')} onLayout={anchor('rights')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_rights_body')}{' '}
            <Text style={[s.link, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>hello@thefixed.app</Text>.
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_cookies')} onLayout={anchor('cookies')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_cookies_body')}
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_retention')} onLayout={anchor('retention')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_retention_body')}
          </Text>
        </Section>
    </>
  );
  const dangerZone = (
        <View style={[s.dangerZone, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.2)', shadowOpacity: theme.shadowOpacity }]}>
          <Text style={[s.dangerTitle, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>{t('ext.privacy_danger_zone')}</Text>
          <Text style={[s.dangerSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_danger_sub')}
          </Text>
          <PressScale accessibilityRole="button"
            style={[s.deleteBtn, { borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.2)' }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
          >
            {deleting
              ? <ActivityIndicator size="small" color={COLORS.danger} />
              : <>
                  <Feather name="trash-2" size={16} color={COLORS.danger} />
                  <Text style={[s.deleteBtnText, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>{t('ext.privacy_delete_account')}</Text>
                </>
            }
          </PressScale>
        </View>
  );
  const header = <LegalHeader title={t('profile.privacy')} />;

  if (isSplit) {
    // Duo déplié : à gauche le sommaire et la suppression du compte (à part,
    // hors du fil de lecture), à droite le texte en colonne de lecture.
    const index = [
      { key: 'data', title: t('ext.privacy_section_data') },
      { key: 'rights', title: t('ext.privacy_section_rights') },
      { key: 'cookies', title: t('ext.privacy_section_cookies') },
      { key: 'retention', title: t('ext.privacy_section_retention') },
    ];
    return (
      <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <BookSpread
          left={
            <>
              {header}
              <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
                <LegalIndex items={index} onSelect={scrollTo} />
                {dangerZone}
              </ScrollView>
            </>
          }
          right={
            <ScrollView ref={scrollRef} contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
              {sections}
            </ScrollView>
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {header}

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {sections}

        {/* Danger zone */}
        {dangerZone}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },
  // Duo déplié : marges de page (20 de côté, 12 en haut).
  page: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48, gap: 12 },

  section: {
    borderRadius: 18, padding: 18, gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  sectionTitle: { fontSize: 15 },
  body: { fontSize: 13, lineHeight: 21 },
  link: { fontSize: 13 },

  dangerZone: {
    borderRadius: 18, padding: 18, gap: 10,
    borderWidth: 1,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  dangerTitle: { fontSize: 15 },
  dangerSub:   { fontSize: 13, lineHeight: 19 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderRadius: 12,
    paddingVertical: 12,
  },
  deleteBtnText: { fontSize: 14 },
});
