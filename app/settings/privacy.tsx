// app/settings/privacy.tsx — Confidentialité
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Supprimer mon compte',
      'Cette action est irréversible. Toutes vos données seront effacées définitivement.',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await api.delete('/me');
              await signOut();
              router.replace('/(auth)/login');
            } catch (e: any) {
              showSocketToast(e?.message || t('common.error'), 'error');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.privacy')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Section title="Données collectées">
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Fixed collecte uniquement les données nécessaires au bon fonctionnement du service :{'\n\n'}
            • Informations d'identification (nom, email){'\n'}
            • Données de localisation (uniquement lors d'une mission active){'\n'}
            • Historique des missions et paiements{'\n'}
            • Préférences de notification{'\n\n'}
            Ces données ne sont jamais revendues à des tiers.
          </Text>
        </Section>

        <Section title="Vos droits (RGPD)">
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Conformément au RGPD, vous disposez des droits suivants :{'\n\n'}
            • Droit d'accès à vos données{'\n'}
            • Droit de rectification{'\n'}
            • Droit à l'effacement («droit à l'oubli»){'\n'}
            • Droit à la portabilité{'\n\n'}
            Pour exercer ces droits, contactez-nous à{' '}
            <Text style={[s.link, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>privacy@fixed.app</Text>.
          </Text>
        </Section>

        <Section title="Cookies et traceurs">
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            L'application utilise uniquement des cookies techniques essentiels (authentification, session). Aucun traceur publicitaire n'est utilisé.
          </Text>
        </Section>

        <Section title="Conservation des données">
          <Text style={[s.body, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            Vos données sont conservées pendant la durée de votre compte, puis 3 ans après sa fermeture à des fins légales. Les données de paiement sont conservées par Stripe conformément à la réglementation financière.
          </Text>
        </Section>

        {/* Danger zone */}
        <View style={[s.dangerZone, { backgroundColor: theme.cardBg, borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : '#FECACA', shadowOpacity: theme.shadowOpacity }]}>
          <Text style={[s.dangerTitle, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>Zone dangereuse</Text>
          <Text style={[s.dangerSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
            La suppression de votre compte est définitive et irréversible.
          </Text>
          <TouchableOpacity
            style={[s.deleteBtn, { borderColor: theme.isDark ? 'rgba(220,38,38,0.3)' : '#FECACA' }]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting
              ? <ActivityIndicator size="small" color={COLORS.danger} />
              : <>
                  <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                  <Text style={[s.deleteBtnText, { color: COLORS.danger, fontFamily: FONTS.sansMedium }]}>Supprimer mon compte</Text>
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
