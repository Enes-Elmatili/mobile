// app/settings/privacy.tsx — Confidentialité
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Platform, StatusBar,
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

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View style={[s.section, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
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

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.privacy')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Section title={t('ext.privacy_section_data')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_data_body')}
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_rights')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_rights_body')}{' '}
            <Text style={[s.link, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>hello@thefixed.app</Text>.
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_cookies')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_cookies_body')}
          </Text>
        </Section>

        <Section title={t('ext.privacy_section_retention')}>
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_retention_body')}
          </Text>
        </Section>

        {/* Danger zone */}
        <View style={[s.dangerZone, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.2)', shadowOpacity: theme.shadowOpacity }]}>
          <Text style={[s.dangerTitle, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>{t('ext.privacy_danger_zone')}</Text>
          <Text style={[s.dangerSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            {t('ext.privacy_danger_sub')}
          </Text>
          <TouchableOpacity
            style={[s.deleteBtn, { borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : 'rgba(220,38,38,0.2)' }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting
              ? <ActivityIndicator size="small" color={COLORS.danger} />
              : <>
                  <Feather name="trash-2" size={16} color={COLORS.danger} />
                  <Text style={[s.deleteBtnText, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>{t('ext.privacy_delete_account')}</Text>
                </>
            }
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17 },
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },

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
