// app/settings/help.tsx — Aide et support
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, Linking, Platform, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

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
  const theme = useAppTheme();
  return (
    <View style={[fi.wrap, { borderBottomColor: theme.borderLight }]}>
      <TouchableOpacity
        style={fi.row}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
      >
        <Text style={[fi.q, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{item.q}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
      </TouchableOpacity>
      {open && <Text style={[fi.a, { color: theme.textSub, fontFamily: FONTS.sans }]}>{item.a}</Text>}
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { borderBottomWidth: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  q: { flex: 1, fontSize: 14, lineHeight: 20 },
  a: {
    fontSize: 13, lineHeight: 20,
    paddingHorizontal: 16, paddingBottom: 14,
  },
});

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();

  const openEmail = () => Linking.openURL('mailto:support@fixed.app?subject=Support Fixed');
  const openWhatsApp = async () => {
    const waScheme = 'whatsapp://send?phone=32478061330&text=Bonjour%2C%20j%27ai%20besoin%20d%27aide%20avec%20FIXED.';
    const canOpen = await Linking.canOpenURL(waScheme);
    Linking.openURL(canOpen ? waScheme : 'https://wa.me/32478061330');
  };

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.help')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* QCM Support */}
        <TouchableOpacity
          style={[s.supportBanner, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}
          onPress={() => router.push('/support')}
          activeOpacity={0.7}
        >
          <View style={[s.contactIcon, { backgroundColor: theme.surface }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={theme.textSub} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.supportTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Un problème avec une mission ?</Text>
            <Text style={[s.supportSub, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Obtenez de l'aide en quelques clics</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        </TouchableOpacity>

        {/* FAQ */}
        <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>Questions fréquentes</Text>
        <View style={[s.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          {FAQ.map((item, i) => <FAQItem key={i} item={item} />)}
        </View>

        {/* Contact */}
        <Text style={[s.sectionTitle, { color: theme.textMuted, fontFamily: FONTS.mono }]}>Contact</Text>
        <View style={[s.card, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity }]}>
          <TouchableOpacity style={s.contactRow} onPress={openEmail} activeOpacity={0.7}>
            <View style={[s.contactIcon, { backgroundColor: theme.surface }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.contactLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>E-mail support</Text>
              <Text style={[s.contactValue, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>support@fixed.app</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
          <TouchableOpacity style={s.contactRow} onPress={openWhatsApp} activeOpacity={0.7}>
            <View style={[s.contactIcon, { backgroundColor: 'rgba(37,211,102,0.1)' }]}>
              <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.contactLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>WhatsApp</Text>
              <Text style={[s.contactValue, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Contacter le support</Text>
            </View>
            <Ionicons name="open-outline" size={16} color={theme.textMuted} />
          </TouchableOpacity>
          <View style={[s.divider, { backgroundColor: theme.borderLight }]} />
          <View style={s.contactRow}>
            <View style={[s.contactIcon, { backgroundColor: theme.surface }]}>
              <Ionicons name="time-outline" size={20} color={theme.textSub} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.contactLabel, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Horaires du support</Text>
              <Text style={[s.contactValue, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Lun – Ven, 9h – 18h (CET)</Text>
            </View>
          </View>
        </View>

        <Text style={[s.version, { color: theme.textVeryMuted, fontFamily: FONTS.mono }]}>Fixed v1.0.0 · Made with ♥</Text>

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
  scroll: { padding: 16, paddingBottom: 48, gap: 4 },

  sectionTitle: {
    fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6,
    marginBottom: 8, marginTop: 16, paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18, overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  contactIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  contactLabel: { fontSize: 12 },
  contactValue: { fontSize: 14, marginTop: 2 },
  divider: { height: 1, marginLeft: 68 },

  supportBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 18, padding: 16, marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 2 },
    }),
  },
  supportTitle: { fontSize: 15, marginBottom: 2 },
  supportSub: { fontSize: 12 },

  version: { textAlign: 'center', fontSize: 12, marginTop: 24 },
});
