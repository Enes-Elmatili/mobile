// app/settings/help.tsx — Aide et support
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Linking, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

// ── FAQ data ──────────────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'Comment fonctionne Fixed ?',
    a: 'Fixed met en relation des clients avec des prestataires de services à domicile. Publiez une mission, un prestataire qualifié à proximité l\'accepte, et la mission démarre.',
  },
  {
    q: 'Comment sont sécurisés les paiements ?',
    a: 'Tous les paiements sont gérés par Stripe, leader mondial du paiement en ligne. Vos coordonnées bancaires ne sont jamais stockées sur nos serveurs.',
  },
  {
    q: 'Puis-je annuler une mission ?',
    a: 'Oui, vous pouvez annuler une mission tant qu\'elle est en statut "Recherche en cours" ou "Acceptée". Des frais d\'annulation peuvent s\'appliquer selon les conditions générales.',
  },
  {
    q: 'Comment devenir prestataire ?',
    a: 'Rendez-vous dans votre profil et appuyez sur "Devenir prestataire". Complétez les 4 étapes d\'inscription : présentation, zone d\'intervention, catégories et soumission.',
  },
  {
    q: 'Quand suis-je payé pour mes missions ?',
    a: 'Les paiements sont versés sur votre wallet Fixed après validation de la mission. Vous pouvez ensuite retirer vos gains vers votre compte bancaire depuis la section Wallet.',
  },
  {
    q: 'Comment contacter un client / prestataire ?',
    a: 'Utilisez la messagerie intégrée dans l\'application. Accédez-y depuis votre tableau de bord ou l\'onglet Messages du profil.',
  },
  {
    q: 'Mon compte a été suspendu, que faire ?',
    a: 'Si votre compte a été suspendu, contactez notre support à support@fixed.app en indiquant votre adresse e-mail et l\'objet de votre demande.',
  },
  {
    q: 'Comment modifier mon adresse e-mail ?',
    a: 'La modification de l\'e-mail n\'est pas encore disponible en libre-service. Contactez le support pour toute modification de données sensibles.',
  },
];

// ── FAQ Item ──────────────────────────────────────────────────────────────────

function FAQItem({ item }: { item: typeof FAQ[0] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={fi.wrap}>
      <TouchableOpacity
        style={fi.row}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={fi.q}>{item.q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color="#ADADAD" />
      </TouchableOpacity>
      {open && <Text style={fi.a}>{item.a}</Text>}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  q: { flex: 1, fontSize: 14, fontWeight: '700', color: '#1A1A1A', lineHeight: 20 },
  a: {
    fontSize: 13, color: '#555', lineHeight: 20,
    paddingHorizontal: 16, paddingBottom: 14,
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const openEmail = () => Linking.openURL('mailto:support@fixed.app?subject=Support Fixed');

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.help')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* FAQ */}
        <Text style={s.sectionTitle}>Questions fréquentes</Text>
        <View style={s.card}>
          {FAQ.map((item, i) => <FAQItem key={i} item={item} />)}
        </View>

        {/* Contact */}
        <Text style={s.sectionTitle}>Contact</Text>
        <View style={s.card}>
          <TouchableOpacity style={s.contactRow} onPress={openEmail} activeOpacity={0.7}>
            <View style={s.contactIcon}>
              <Ionicons name="mail-outline" size={20} color="#555" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>E-mail support</Text>
              <Text style={s.contactValue}>support@fixed.app</Text>
            </View>
            <Ionicons name="open-outline" size={16} color="#ADADAD" />
          </TouchableOpacity>
          <View style={s.divider} />
          <View style={s.contactRow}>
            <View style={s.contactIcon}>
              <Ionicons name="time-outline" size={20} color="#555" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.contactLabel}>Horaires du support</Text>
              <Text style={s.contactValue}>Lun – Ven, 9h – 18h (CET)</Text>
            </View>
          </View>
        </View>

        <Text style={s.version}>Fixed v1.0.0 · Made with ♥</Text>

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
  scroll: { padding: 16, paddingBottom: 48, gap: 4 },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#ADADAD',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 16, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  contactIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center',
  },
  contactLabel: { fontSize: 12, color: '#ADADAD', fontWeight: '500' },
  contactValue: { fontSize: 14, fontWeight: '700', color: '#1A1A1A', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginLeft: 68 },

  version: { textAlign: 'center', fontSize: 12, color: '#D1D5DB', marginTop: 24 },
});
