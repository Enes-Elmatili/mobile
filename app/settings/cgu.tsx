// app/settings/cgu.tsx — Conditions Générales d'Utilisation
import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

// ── Section ───────────────────────────────────────────────────────────────────

function Article({ n, title, body }: { n: string; title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={[s.article, { backgroundColor: theme.cardBg }]}>
      <Text style={[s.articleNum, { color: theme.textMuted, fontFamily: FONTS.mono }]}>Article {n}</Text>
      <Text style={[s.articleTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{title}</Text>
      <Text style={[s.articleBody, { color: theme.textSub, fontFamily: FONTS.sans }]}>{body}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CGUScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('profile.terms')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={[s.introCard, { backgroundColor: theme.heroBg }]}>
          <Text style={[s.introDate, { color: theme.heroSubFaint, fontFamily: FONTS.mono }]}>Dernière mise à jour : 1er mars 2026</Text>
          <Text style={[s.introText, { color: theme.heroSub, fontFamily: FONTS.sans }]}>
            Les présentes Conditions Générales d'Utilisation régissent l'accès et l'utilisation de l'application Fixed (ci-après «la Plateforme»), éditée par Fixed SAS, société par actions simplifiée au capital de 10 000 €.
          </Text>
        </View>

        <Article
          n="1" title="Objet"
          body="Fixed est une plateforme de mise en relation entre particuliers (ci-après «Clients») et professionnels indépendants (ci-après «Prestataires») pour la réalisation de services à domicile. Fixed agit en qualité d'intermédiaire et n'est pas partie aux contrats conclus entre Clients et Prestataires."
        />

        <Article
          n="2" title="Inscription et compte utilisateur"
          body="L'accès à la Plateforme nécessite la création d'un compte en fournissant une adresse e-mail valide et un mot de passe. L'utilisateur s'engage à fournir des informations exactes et à maintenir la confidentialité de ses identifiants. Tout compte peut être suspendu ou supprimé en cas de violation des présentes CGU."
        />

        <Article
          n="3" title="Services proposés"
          body="Fixed propose :\n• La mise en relation Client-Prestataire\n• Un système de paiement sécurisé via Stripe\n• Un système de messagerie intégrée\n• Un suivi en temps réel des missions\n\nFixed ne garantit pas la disponibilité permanente d'un Prestataire pour toute demande."
        />

        <Article
          n="4" title="Obligations des utilisateurs"
          body="Les utilisateurs s'engagent à :\n• Ne pas utiliser la Plateforme à des fins illicites\n• Respecter les autres utilisateurs\n• Ne pas tenter de contourner le système de paiement\n• Fournir des informations exactes lors des missions\n• Ne pas partager leurs identifiants"
        />

        <Article
          n="5" title="Paiements et tarification"
          body="Les paiements sont effectués en ligne via Stripe. Les prix sont indiqués en euros TTC. Fixed perçoit une commission sur chaque transaction. Les Prestataires peuvent retirer leurs gains via la fonctionnalité Wallet, sous réserve de la configuration de leur compte bancaire."
        />

        <Article
          n="6" title="Annulations et remboursements"
          body="En cas d'annulation avant le début de la mission, des frais peuvent s'appliquer selon le délai d'annulation. Les remboursements sont traités dans un délai de 5 à 10 jours ouvrés. Aucun remboursement n'est accordé pour les missions déjà réalisées."
        />

        <Article
          n="7" title="Responsabilité"
          body="Fixed n'est pas responsable des dommages causés lors des missions, de l'inexécution des contrats entre Clients et Prestataires, ni des contenus publiés par les utilisateurs. La responsabilité de Fixed est limitée au montant des commissions perçues."
        />

        <Article
          n="8" title="Données personnelles"
          body="Le traitement des données personnelles est régi par notre Politique de Confidentialité, accessible depuis les paramètres de l'application. Conformément au RGPD, vous disposez de droits d'accès, de rectification et d'effacement de vos données."
        />

        <Article
          n="9" title="Modification des CGU"
          body="Fixed se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs seront informés de toute modification substantielle. L'utilisation continue de la Plateforme après notification vaut acceptation des nouvelles conditions."
        />

        <Article
          n="10" title="Droit applicable et juridiction"
          body="Les présentes CGU sont soumises au droit belge. Tout litige relèvera de la compétence exclusive des tribunaux de Bruxelles, sauf disposition légale contraire."
        />

        <View style={s.footer}>
          <Text style={[s.footerText, { color: theme.textVeryMuted, fontFamily: FONTS.mono }]}>Fixed SAS · support@fixed.app</Text>
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

  introCard: {
    borderRadius: 18, padding: 18, gap: 8,
  },
  introDate: { fontSize: 11 },
  introText: { fontSize: 13, lineHeight: 20 },

  article: {
    borderRadius: 16, padding: 16, gap: 6,
  },
  articleNum:   { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  articleTitle: { fontSize: 15 },
  articleBody:  { fontSize: 13, lineHeight: 21 },

  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { fontSize: 12 },
});
