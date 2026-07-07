// app/settings/notifications.tsx — Préférences notifications
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Switch, Platform, TouchableOpacity, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useFeedbackPrefs } from '@/stores/feedbackPrefs';
import { feedback } from '@/lib/feedback/feedback';

// ── Toggle Row ────────────────────────────────────────────────────────────────

function ToggleRow({
  icon, label, sublabel, value, onToggle,
}: {
  icon: string;
  label: string; sublabel?: string;
  value: boolean; onToggle: (v: boolean) => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={[tr.row, { borderBottomColor: theme.borderLight }]}>
      <View style={[tr.iconBox, { backgroundColor: theme.surface }]}>
        <Feather name={icon as any} size={18} color={theme.textSub} />
      </View>
      <View style={tr.content}>
        <Text style={[tr.label, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{label}</Text>
        {sublabel && <Text style={[tr.sublabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.borderLight, true: theme.accent }}
        thumbColor={Platform.OS === 'android' ? '#FFF' : undefined}
      />
    </View>
  );
}

const tr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  content: { flex: 1 },
  label:   { fontSize: 15 },
  sublabel:{ fontSize: 12, marginTop: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();

  const sound = useFeedbackPrefs((s) => s.sound);
  const haptics = useFeedbackPrefs((s) => s.haptics);
  const animations = useFeedbackPrefs((s) => s.animations);
  const setPref = useFeedbackPrefs((s) => s.setPref);

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.notifications')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Notifications push : gérées au niveau du système ──
            Les préférences fines par type ne sont pas encore branchées au
            backend d'envoi ; plutôt qu'afficher des interrupteurs sans effet,
            on renvoie vers le seul réglage réellement opérant (l'OS). ── */}
        <View style={[s.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <View style={s.systemRow}>
            <View style={[s.systemIcon, { backgroundColor: theme.surface }]}>
              <Feather name="bell" size={18} color={theme.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.systemTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Notifications push</Text>
              <Text style={[s.systemSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                Les notifications (missions, messages, paiements) sont gérées par votre téléphone.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[s.systemBtn, { borderTopColor: theme.borderLight }]}
            onPress={() => Linking.openSettings()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir les réglages système"
          >
            <Feather name="settings" size={16} color={theme.accent} />
            <Text style={[s.systemBtnText, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Ouvrir les réglages système</Text>
            <Feather name="chevron-right" size={16} color={theme.textVeryMuted} />
          </TouchableOpacity>
        </View>
        {/* ── Feedback & sound ── */}
        <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{t('feedback.settings.section')}</Text>
        <View style={[s.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <ToggleRow
            icon="volume-2"
            label={t('feedback.settings.sound')}
            sublabel={t('feedback.settings.sound_sub')}
            value={sound}
            onToggle={(v) => { setPref('sound', v); feedback.haptic('selection'); }}
          />
          <ToggleRow
            icon="smartphone"
            label={t('feedback.settings.haptics')}
            sublabel={t('feedback.settings.haptics_sub')}
            value={haptics}
            onToggle={(v) => { setPref('haptics', v); if (v) feedback.haptic('selection'); }}
          />
          <ToggleRow
            icon="zap"
            label={t('feedback.settings.animations')}
            sublabel={t('feedback.settings.animations_sub')}
            value={animations}
            onToggle={(v) => { setPref('animations', v); feedback.haptic('selection'); }}
          />
        </View>

        <Text style={[s.hint, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          {t('ext.settings_notif_hint')}
        </Text>
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
  scroll: { padding: 16, paddingBottom: 48 },
  card: {
    borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  hint: { fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  sectionTitle: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2,
    marginBottom: 8, marginTop: 8, paddingHorizontal: 4,
  },

  // Notifications système
  systemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
  },
  systemIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  systemTitle: { fontSize: 15, marginBottom: 3 },
  systemSub: { fontSize: 12, lineHeight: 17 },
  systemBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopWidth: 1,
  },
  systemBtnText: { flex: 1, fontSize: 14 },
});
