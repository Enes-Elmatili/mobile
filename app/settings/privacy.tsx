// app/settings/privacy.tsx — Confidentialité
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { showSocketToast } from '@/lib/SocketContext';
import { useAuth } from '@/lib/auth/AuthContext';

// ── Section ───────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PrivacyScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { signOut } = useAuth();
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
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.privacy')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Section title="Données collectées">
          <Text style={s.body}>
            Fixed collecte uniquement les données nécessaires au bon fonctionnement du service :{'\n\n'}
            • Informations d'identification (nom, email){'\n'}
            • Données de localisation (uniquement lors d'une mission active){'\n'}
            • Historique des missions et paiements{'\n'}
            • Préférences de notification{'\n\n'}
            Ces données ne sont jamais revendues à des tiers.
          </Text>
        </Section>

        <Section title="Vos droits (RGPD)">
          <Text style={s.body}>
            Conformément au RGPD, vous disposez des droits suivants :{'\n\n'}
            • Droit d'accès à vos données{'\n'}
            • Droit de rectification{'\n'}
            • Droit à l'effacement («droit à l'oubli»){'\n'}
            • Droit à la portabilité{'\n\n'}
            Pour exercer ces droits, contactez-nous à{' '}
            <Text style={s.link}>privacy@fixed.app</Text>.
          </Text>
        </Section>

        <Section title="Cookies et traceurs">
          <Text style={s.body}>
            L'application utilise uniquement des cookies techniques essentiels (authentification, session). Aucun traceur publicitaire n'est utilisé.
          </Text>
        </Section>

        <Section title="Conservation des données">
          <Text style={s.body}>
            Vos données sont conservées pendant la durée de votre compte, puis 3 ans après sa fermeture à des fins légales. Les données de paiement sont conservées par Stripe conformément à la réglementation financière.
          </Text>
        </Section>

        {/* Danger zone */}
        <View style={s.dangerZone}>
          <Text style={s.dangerTitle}>Zone dangereuse</Text>
          <Text style={s.dangerSub}>
            La suppression de votre compte est définitive et irréversible.
          </Text>
          <TouchableOpacity
            style={s.deleteBtn}
            onPress={handleDeleteAccount}
            disabled={deleting}
            activeOpacity={0.7}
          >
            {deleting
              ? <ActivityIndicator size="small" color="#DC2626" />
              : <>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={s.deleteBtnText}>Supprimer mon compte</Text>
                </>
            }
          </TouchableOpacity>
        </View>

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
  scroll: { padding: 16, paddingBottom: 48, gap: 12 },

  section: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 18, gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  body: { fontSize: 13, color: '#555', lineHeight: 21 },
  link: { color: '#1A1A1A', fontWeight: '600' },

  dangerZone: {
    backgroundColor: '#FFF', borderRadius: 18, padding: 18, gap: 10,
    borderWidth: 1, borderColor: '#FECACA',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8 },
      android: { elevation: 1 },
    }),
  },
  dangerTitle: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  dangerSub:   { fontSize: 13, color: '#ADADAD', lineHeight: 19 },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#FECACA', borderRadius: 12,
    paddingVertical: 12,
  },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
});
