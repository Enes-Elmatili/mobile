// app/settings/cgu.tsx — Conditions Générales d'Utilisation (v1.0 — 15 mars 2026)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

// ── Accordion Article ─────────────────────────────────────────────────────────

function Article({ n, title, body }: { n: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const theme = useAppTheme();
  return (
    <View style={[s.article, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
      <TouchableOpacity style={s.articleHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={s.articleLeft}>
          <Text style={[s.articleNum, { color: theme.textMuted, fontFamily: FONTS.mono }]}>Art. {n}</Text>
          <Text style={[s.articleTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{title}</Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textMuted} />
      </TouchableOpacity>
      {open && (
        <Text style={[s.articleBody, { color: theme.textSub, fontFamily: FONTS.sans }]}>{body}</Text>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

const ARTICLES = [
  {
    n: '1', title: 'Définitions',
    body: '– "Plateforme" : l\'application mobile et/ou web FIXED, incluant l\'ensemble de ses fonctionnalités, interfaces et services associés.\n– "Client" : toute personne physique ou morale inscrite sur la Plateforme en qualité de demandeur de services.\n– "Prestataire" : tout professionnel indépendant inscrit sur la Plateforme, titulaire d\'un numéro BCE valide, ayant accepté les Conditions Générales Prestataires.\n– "Mission" : la prestation de service commandée par le Client via la Plateforme, réalisée par un Prestataire.\n– "Commission" : la rémunération perçue par FIXED en contrepartie de l\'accès à la Plateforme et des services d\'intermédiation.\n– "Compte" : l\'espace personnel sécurisé créé par le Client sur la Plateforme.',
  },
  {
    n: '2', title: 'Objet',
    body: 'Les présentes CGU ont pour objet de définir les conditions et modalités selon lesquelles FIXED met à disposition des Clients la Plateforme.\n\nFIXED se réserve le droit de modifier les présentes CGU à tout moment. En cas de modification substantielle, FIXED informera les Clients par notification in-app ou e-mail avec un préavis de 15 jours.',
  },
  {
    n: '3', title: 'Inscription et Accès',
    body: '3.1 L\'accès est réservé aux personnes physiques âgées d\'au moins 18 ans disposant de la pleine capacité juridique, ainsi qu\'aux personnes morales régulièrement constituées.\n\n3.2 L\'inscription nécessite des informations exactes : nom, prénom, e-mail valide, numéro de téléphone.\n\n3.3 Le Client est seul responsable de la confidentialité de ses identifiants. En cas d\'utilisation non autorisée, contacter FIXED à support@thefixed.app.\n\n3.4 FIXED se réserve le droit de suspendre ou clôturer un Compte en cas de violation des présentes CGU.',
  },
  {
    n: '4', title: 'Processus de Commande',
    body: '4.1 La commande s\'effectue via la Plateforme : sélection du lieu, choix du service, planification, confirmation avec paiement. La commande est définitivement passée à l\'issue de la validation du paiement.\n\n4.2 FIXED utilise un algorithme d\'attribution en temps réel. La Mission est attribuée au premier Prestataire disponible acceptant la commande.\n\n4.3 Le Client reçoit une notification in-app dès qu\'un Prestataire a accepté.\n\n4.4 Les tarifs applicables sont affichés avant la confirmation. Toute modification ne s\'applique pas aux commandes déjà confirmées.',
  },
  {
    n: '5', title: 'Annulation et Remboursement',
    body: 'Niveau 1 — Annulation avant l\'arrivée : remboursement 100%, aucun frais.\n\nNiveau 2 — Annulation à l\'arrivée (mission non démarrée) : remboursement total déduction faite des frais de déplacement.\n\nNiveau 3 — Litige après exécution partielle : procédure contradictoire, remboursement éventuel partiel.\n\nNiveau 4 — Faute grave avérée du Prestataire : remboursement intégral + activation des garanties d\'assurance.\n\nLes demandes doivent être soumises via l\'application dans les 7 jours calendriers suivant la Mission.',
  },
  {
    n: '6', title: 'Obligations du Client',
    body: 'Le Client s\'engage à :\n– Fournir des informations exactes et complètes lors de la commande.\n– Être présent ou avoir désigné un représentant au moment convenu.\n– Traiter les Prestataires avec respect et dignité.\n– Ne pas solliciter les Prestataires en dehors de la Plateforme pour contourner les commissions.\n– Ne pas utiliser la Plateforme à des fins illicites ou frauduleuses.',
  },
  {
    n: '7', title: 'Paiements',
    body: '7.1 Le paiement s\'effectue exclusivement via la Plateforme par carte bancaire (Visa, Mastercard) ou tout autre moyen rendu disponible. Les paiements sont sécurisés par Stripe.\n\n7.2 Le montant est prélevé au moment de la confirmation. FIXED émet une facture électronique dans les 24h suivant la Mission.\n\n7.3 FIXED prélève une commission à la charge du Prestataire. Le prix affiché au Client est le prix TTC final, sans frais cachés.\n\n7.4 FIXED peut annuler toute transaction suspecte sans préavis.',
  },
  {
    n: '8', title: 'Responsabilité de FIXED',
    body: 'FIXED agit en qualité de prestataire d\'intermédiation au sens du Règlement (UE) 2022/2065 (Digital Services Act). À ce titre, FIXED n\'est pas responsable de la qualité des prestations réalisées par les Prestataires.\n\nLa responsabilité directe de FIXED, si elle était reconnue, serait plafonnée au montant effectivement payé par le Client pour la Mission concernée.\n\nFIXED met en œuvre des procédures de vérification des Prestataires (numéro BCE, attestation RC professionnelle) mais ne peut garantir l\'absence de déclaration frauduleuse.',
  },
  {
    n: '9', title: 'Données Personnelles',
    body: 'Le traitement des données est régi par la Politique de Confidentialité de FIXED, intégrée par référence aux présentes CGU.\n\nConformément au RGPD et à la loi belge du 30 juillet 2018, le Client dispose de droits d\'accès, de rectification, d\'effacement, de portabilité et d\'opposition.\n\nContact : privacy@thefixed.app\n\nDonnées conservées pendant la durée de la relation contractuelle et 5 ans après la clôture du Compte.',
  },
  {
    n: '10', title: 'Propriété Intellectuelle',
    body: 'La Plateforme FIXED (logo, marque, design, code source, algorithmes, textes, images) est la propriété exclusive de FIXED ou de ses concédants. Toute reproduction ou utilisation non autorisée est strictement interdite et constituerait une contrefaçon sanctionnée pénalement.',
  },
  {
    n: '11', title: 'Comportement et Modération',
    body: 'FIXED se réserve le droit de supprimer tout contenu contraire aux présentes CGU, diffamatoire ou portant atteinte à la vie privée.\n\nFIXED dispose d\'un mécanisme de signalement permettant aux Prestataires de signaler tout comportement inapproprié. FIXED peut suspendre ou résilier le Compte concerné.',
  },
  {
    n: '12', title: 'Résolution des Litiges',
    body: '12.1 Service client : support@thefixed.app. Réponse sous 48h ouvrables, résolution sous 10 jours ouvrables.\n\n12.2 En cas d\'échec, les parties peuvent recourir à une procédure d\'arbitrage auprès du Centre Belge d\'Arbitrage et de Médiation (CEPANI).\n\n12.3 Tout litige relève de la compétence exclusive des tribunaux de l\'arrondissement judiciaire de Bruxelles.\n\n12.4 Droit applicable : droit belge, Code civil, Code de droit économique et Règlement (UE) 2022/2065.',
  },
  {
    n: '13', title: 'Droit de Rétractation',
    body: 'Conformément aux articles VI.47 du Code de droit économique belge, le Client dispose d\'un délai de rétractation de 14 jours calendriers.\n\nToutefois, en commandant une Mission à exécution immédiate ou à brève échéance, le Client reconnaît expressément que la prestation commencée avant l\'expiration du délai de rétractation entraîne la perte partielle ou totale de ce droit (art. VI.53, 1° et 9°).',
  },
  {
    n: '14', title: 'Force Majeure',
    body: 'FIXED ne pourra être tenu responsable de l\'inexécution ou du retard en cas de force majeure au sens de l\'article 5.225 du Code civil belge : catastrophe naturelle, acte de terrorisme, panne générale d\'internet ou d\'énergie, pandémie ou acte gouvernemental.',
  },
  {
    n: '15', title: 'Dispositions Générales',
    body: 'Si l\'une des dispositions des présentes CGU était déclarée nulle, cette nullité n\'affecterait pas la validité des autres dispositions.\n\nLes présentes CGU constituent l\'intégralité de l\'accord entre FIXED et le Client et remplacent tous les accords antérieurs portant sur le même objet.',
  },
  {
    n: '16', title: 'Contact',
    body: 'Pour toute question relative aux présentes CGU :\n– E-mail : support@thefixed.app\n– Site web : www.thefixed.app\n– Adresse : Belgique (adresse complète à insérer après constitution de la SRL)\n\nFIXED PLATEFORM SRL — CGU Clients — Version 1.0, 15 mars 2026',
  },
];

export default function CGUScreen() {
  const router = useRouter();
  const theme = useAppTheme();

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>Conditions d'utilisation</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={[s.introCard, { backgroundColor: theme.heroBg }]}>
          <Text style={[s.introVersion, { color: theme.heroSubFaint, fontFamily: FONTS.mono }]}>Version 1.0 — 15 mars 2026</Text>
          <Text style={[s.introTitle, { color: theme.heroText, fontFamily: FONTS.bebas }]}>FIXED PLATEFORM SRL</Text>
          <Text style={[s.introText, { color: theme.heroSub, fontFamily: FONTS.sans }]}>
            Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme FIXED, exploitée par FIXED PLATEFORM SRL, société à responsabilité limitée de droit belge.{'\n\n'}
            FIXED agit exclusivement en qualité de plateforme d'intermédiation et n'est pas partie au contrat de prestation conclu entre le Client et le Prestataire.
          </Text>
        </View>

        <View style={s.articleList}>
          {ARTICLES.map(a => <Article key={a.n} n={a.n} title={a.title} body={a.body} />)}
        </View>

        <Text style={[s.footer, { color: theme.textVeryMuted, fontFamily: FONTS.mono }]}>
          FIXED PLATEFORM SRL · support@thefixed.app{'\n'}v1.0 — 15 mars 2026
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17 },
  scroll: { padding: 16, paddingBottom: 48, gap: 4 },

  introCard: { borderRadius: 18, padding: 20, gap: 8, marginBottom: 12 },
  introVersion: { fontSize: 11 },
  introTitle: { fontSize: 28, letterSpacing: 1 },
  introText: { fontSize: 13, lineHeight: 20 },

  articleList: { gap: 6 },
  article: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  articleHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  articleLeft: { flex: 1, gap: 2 },
  articleNum: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  articleTitle: { fontSize: 14 },
  articleBody: {
    fontSize: 13, lineHeight: 21,
    paddingHorizontal: 16, paddingBottom: 16,
  },

  footer: { textAlign: 'center', fontSize: 11, marginTop: 20, lineHeight: 18 },
});
