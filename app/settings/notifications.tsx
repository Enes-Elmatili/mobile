// app/settings/notifications.tsx — Préférences notifications
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Switch, Platform, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showSocketToast } from '@/lib/SocketContext';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ── Storage key ────────────────────────────────────────────────────────────────

const NOTIF_PREFS_KEY = '@fixed:notif:prefs';

// ── Default prefs ─────────────────────────────────────────────────────────────

interface NotifPrefs {
  newMissions:  boolean;
  messages:     boolean;
  payments:     boolean;
  reminders:    boolean;
  promotions:   boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  newMissions: true,
  messages:    true,
  payments:    true,
  reminders:   true,
  promotions:  false,
};

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
        <Ionicons name={icon as any} size={18} color={theme.textSub} />
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
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    AsyncStorage.getItem(NOTIF_PREFS_KEY).then(raw => {
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    });
  }, []);

  const toggle = (key: keyof NotifPrefs) => (value: boolean) => {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    AsyncStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next)).catch(() => {});
    showSocketToast(value ? 'Activé' : 'Désactivé', 'success');
  };

  const ITEMS: {
    key: keyof NotifPrefs; icon: string;
    label: string; sublabel: string;
  }[] = [
    {
      key: 'newMissions', icon: 'briefcase-outline',
      label: t('settings.notif_new_missions'),
      sublabel: 'Quand une nouvelle mission est disponible',
    },
    {
      key: 'messages', icon: 'chatbubbles-outline',
      label: t('settings.notif_messages'),
      sublabel: 'Nouveaux messages de clients',
    },
    {
      key: 'payments', icon: 'card-outline',
      label: t('settings.notif_payments'),
      sublabel: 'Confirmations de paiement',
    },
    {
      key: 'reminders', icon: 'time-outline',
      label: t('settings.notif_reminders'),
      sublabel: 'Rappels avant une mission',
    },
    {
      key: 'promotions', icon: 'pricetag-outline',
      label: t('settings.notif_promotions'),
      sublabel: 'Offres et actualités Fixed',
    },
  ];

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.notifications')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={[s.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          {ITEMS.map((item) => (
            <ToggleRow
              key={item.key}
              icon={item.icon}
              label={item.label}
              sublabel={item.sublabel}
              value={prefs[item.key]}
              onToggle={toggle(item.key)}
            />
          ))}
        </View>
        <Text style={[s.hint, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          Ces préférences contrôlent les notifications push. Vous pouvez également les gérer dans les réglages de votre appareil.
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
});
