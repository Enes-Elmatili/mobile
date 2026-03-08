// app/settings/cgu.tsx — Conditions Générales d'Utilisation
import React from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';

// ── Section ───────────────────────────────────────────────────────────────────

function Article({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <View style={s.article}>
      <Text style={s.articleNum}>Article {n}</Text>
      <Text style={s.articleTitle}>{title}</Text>
      <Text style={s.articleBody}>{body}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function CGUScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color="#1A1A1A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('profile.terms')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={s.introCard}>
          <Text style={s.introDate}>Dernière mise à jour : 1er mars 2026</Text>
          <Text style={s.introText}>
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
          <Text style={s.footerText}>Fixed SAS · support@fixed.app</Text>
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

  introCard: {
    backgroundColor: '#1A1A1A', borderRadius: 18, padding: 18, gap: 8,
  },
  introDate: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
  introText: { fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 20 },

  article: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, gap: 6,
  },
  articleNum:   { fontSize: 10, fontWeight: '700', color: '#ADADAD', textTransform: 'uppercase', letterSpacing: 0.5 },
  articleTitle: { fontSize: 15, fontWeight: '800', color: '#1A1A1A' },
  articleBody:  { fontSize: 13, color: '#555', lineHeight: 21 },

  footer: { alignItems: 'center', paddingTop: 8 },
  footerText: { fontSize: 12, color: '#D1D5DB' },
});
