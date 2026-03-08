// app/settings/notifications.tsx — Préférences notifications
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  Switch, Platform, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showSocketToast } from '@/lib/SocketContext';

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
  icon, iconColor, iconBg, label, sublabel, value, onToggle,
}: {
  icon: string; iconColor: string; iconBg: string;
  label: string; sublabel?: string;
  value: boolean; onToggle: (v: boolean) => void;
}) {
  return (
    <View style={tr.row}>
      <View style={[tr.iconBox, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={tr.content}>
        <Text style={tr.label}>{label}</Text>
        {sublabel && <Text style={tr.sublabel}>{sublabel}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E5E5E5', true: '#1A1A1A' }}
        thumbColor={Platform.OS === 'android' ? (value ? '#FFF' : '#FFF') : undefined}
      />
    </View>
  );
}

const tr = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  content: { flex: 1 },
  label:   { fontSize: 15, fontWeight: '600', color: '#1A1A1A' },
  sublabel:{ fontSize: 12, color: '#ADADAD', marginTop: 1 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
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
    key: keyof NotifPrefs; icon: string; iconColor: string; iconBg: string;
    label: string; sublabel: string;
  }[] = [
    {
      key: 'newMissions', icon: 'briefcase-outline', iconColor: '#555', iconBg: '#F5F5F5',
      label: t('settings.notif_new_missions'),
      sublabel: 'Quand une nouvelle mission est disponible',
    },
    {
      key: 'messages', icon: 'chatbubbles-outline', iconColor: '#555', iconBg: '#F5F5F5',
      label: t('settings.notif_messages'),
      sublabel: 'Nouveaux messages de clients',
    },
    {
      key: 'payments', icon: 'card-outline', iconColor: '#555', iconBg: '#F5F5F5',
      label: t('settings.notif_payments'),
      sublabel: 'Confirmations de paiement',
    },
    {
      key: 'reminders', icon: 'time-outline', iconColor: '#555', iconBg: '#F5F5F5',
      label: t('settings.notif_reminders'),
      sublabel: 'Rappels avant une mission',
    },
    {
      key: 'promotions', icon: 'pricetag-outline', iconColor: '#ADADAD', iconBg: '#F5F5F5',
      label: t('settings.notif_promotions'),
      sublabel: 'Offres et actualités Fixed',
    },
  ];

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.notifications')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.card}>
          {ITEMS.map((item, i) => (
            <ToggleRow
              key={item.key}
              icon={item.icon}
              iconColor={item.iconColor}
              iconBg={item.iconBg}
              label={item.label}
              sublabel={item.sublabel}
              value={prefs[item.key]}
              onToggle={toggle(item.key)}
            />
          ))}
        </View>
        <Text style={s.hint}>
          Ces préférences contrôlent les notifications push. Vous pouvez également les gérer dans les réglages de votre appareil.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#1A1A1A' },
  scroll: { padding: 16, paddingBottom: 48 },
  card: {
    backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden', marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  hint: { fontSize: 12, color: '#ADADAD', lineHeight: 18, paddingHorizontal: 4 },
});
