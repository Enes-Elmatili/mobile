// app/settings/cgu.tsx — Conditions Générales d'Utilisation (v1.0 — 15 mars 2026)
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

// ── Accordion Article ─────────────────────────────────────────────────────────

function Article({ n, title, body }: { n: string; title: string; body: string }) {
  const [open, setOpen] = useState(false);
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={[s.article, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
      <TouchableOpacity style={s.articleHeader} onPress={() => setOpen(v => !v)} activeOpacity={0.7}>
        <View style={s.articleLeft}>
          <Text style={[s.articleNum, { color: theme.textMuted, fontFamily: FONTS.mono }]}>{t('ext.cgu_art')} {n}</Text>
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
// Le texte légal de référence est le FRANÇAIS (CGU officielles v1.1). Les
// versions EN/NL ci-dessous sont des traductions de courtoisie affichées quand
// l'app n'est pas en français, avec un bandeau « la version française fait
// foi » (ext.cgu_prevail_note). Toute mise à jour du texte FR doit être
// répercutée dans les trois versions.

const ARTICLES_FR = [
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
    body: 'Pour toute question relative aux présentes CGU :\n– E-mail : support@thefixed.app\n– Site web : www.thefixed.app\n– Adresse : Av. Maeterlinck 54, 1030 Schaerbeek, Belgique\n– TVA / BCE : BE1037.044.717\n\nFIXED PLATEFORM SRL — CGU Clients — Version 1.0, 15 mars 2026',
  },
];

const ARTICLES_EN = [
  {
    n: '1', title: 'Definitions',
    body: '– "Platform": the FIXED mobile and/or web application, including all of its features, interfaces and associated services.\n– "Client": any natural or legal person registered on the Platform as a service requester.\n– "Provider": any independent professional registered on the Platform, holding a valid BCE (Crossroads Bank for Enterprises) number, who has accepted the Provider Terms and Conditions.\n– "Mission": the service ordered by the Client through the Platform and carried out by a Provider.\n– "Commission": the remuneration received by FIXED in exchange for access to the Platform and its intermediation services.\n– "Account": the secure personal space created by the Client on the Platform.',
  },
  {
    n: '2', title: 'Purpose',
    body: 'These Terms of Use define the conditions under which FIXED makes the Platform available to Clients.\n\nFIXED reserves the right to amend these Terms at any time. In the event of a substantial change, FIXED will inform Clients by in-app notification or e-mail with 15 days\' notice.',
  },
  {
    n: '3', title: 'Registration and Access',
    body: '3.1 Access is reserved for natural persons aged 18 or over with full legal capacity, as well as duly incorporated legal entities.\n\n3.2 Registration requires accurate information: surname, first name, valid e-mail address, phone number.\n\n3.3 The Client is solely responsible for the confidentiality of their credentials. In case of unauthorised use, contact FIXED at support@thefixed.app.\n\n3.4 FIXED reserves the right to suspend or close an Account in the event of a breach of these Terms.',
  },
  {
    n: '4', title: 'Ordering Process',
    body: '4.1 Orders are placed through the Platform: selection of the location, choice of service, scheduling, confirmation with payment. The order is final once the payment has been validated.\n\n4.2 FIXED uses a real-time matching algorithm. The Mission is assigned to the first available Provider who accepts the order.\n\n4.3 The Client receives an in-app notification as soon as a Provider has accepted.\n\n4.4 The applicable prices are displayed before confirmation. Any change does not apply to orders already confirmed.',
  },
  {
    n: '5', title: 'Cancellation and Refunds',
    body: 'Level 1 — Cancellation before arrival: 100% refund, no fees.\n\nLevel 2 — Cancellation upon arrival (mission not started): full refund minus travel costs.\n\nLevel 3 — Dispute after partial execution: adversarial procedure, possible partial refund.\n\nLevel 4 — Proven serious misconduct by the Provider: full refund + activation of insurance guarantees.\n\nRequests must be submitted through the application within 7 calendar days of the Mission.',
  },
  {
    n: '6', title: 'Client Obligations',
    body: 'The Client undertakes to:\n– Provide accurate and complete information when ordering.\n– Be present, or have designated a representative, at the agreed time.\n– Treat Providers with respect and dignity.\n– Not solicit Providers outside the Platform in order to bypass commissions.\n– Not use the Platform for unlawful or fraudulent purposes.',
  },
  {
    n: '7', title: 'Payments',
    body: '7.1 Payment is made exclusively through the Platform by bank card (Visa, Mastercard) or any other available method. Payments are secured by Stripe.\n\n7.2 The amount is charged upon confirmation. FIXED issues an electronic invoice within 24 hours of the Mission.\n\n7.3 FIXED charges a commission borne by the Provider. The price shown to the Client is the final price including VAT, with no hidden fees.\n\n7.4 FIXED may cancel any suspicious transaction without notice.',
  },
  {
    n: '8', title: 'FIXED\'s Liability',
    body: 'FIXED acts as an intermediation service provider within the meaning of Regulation (EU) 2022/2065 (Digital Services Act). As such, FIXED is not responsible for the quality of the services performed by Providers.\n\nFIXED\'s direct liability, if established, would be capped at the amount actually paid by the Client for the Mission concerned.\n\nFIXED implements Provider verification procedures (BCE number, professional liability insurance certificate) but cannot guarantee the absence of fraudulent declarations.',
  },
  {
    n: '9', title: 'Personal Data',
    body: 'Data processing is governed by FIXED\'s Privacy Policy, incorporated by reference into these Terms.\n\nIn accordance with the GDPR and the Belgian law of 30 July 2018, the Client has rights of access, rectification, erasure, portability and objection.\n\nContact: privacy@thefixed.app\n\nData is kept for the duration of the contractual relationship and 5 years after the closure of the Account.',
  },
  {
    n: '10', title: 'Intellectual Property',
    body: 'The FIXED Platform (logo, trademark, design, source code, algorithms, texts, images) is the exclusive property of FIXED or its licensors. Any unauthorised reproduction or use is strictly prohibited and would constitute an infringement punishable by law.',
  },
  {
    n: '11', title: 'Conduct and Moderation',
    body: 'FIXED reserves the right to remove any content contrary to these Terms, defamatory or infringing privacy.\n\nFIXED provides a reporting mechanism allowing Providers to report any inappropriate behaviour. FIXED may suspend or terminate the Account concerned.',
  },
  {
    n: '12', title: 'Dispute Resolution',
    body: '12.1 Customer service: support@thefixed.app. Response within 48 working hours, resolution within 10 working days.\n\n12.2 Failing that, the parties may resort to arbitration before the Belgian Centre for Arbitration and Mediation (CEPANI).\n\n12.3 Any dispute falls under the exclusive jurisdiction of the courts of the judicial district of Brussels.\n\n12.4 Applicable law: Belgian law, Civil Code, Code of Economic Law and Regulation (EU) 2022/2065.',
  },
  {
    n: '13', title: 'Right of Withdrawal',
    body: 'In accordance with Article VI.47 of the Belgian Code of Economic Law, the Client has a withdrawal period of 14 calendar days.\n\nHowever, by ordering a Mission for immediate or short-term execution, the Client expressly acknowledges that a service started before the end of the withdrawal period entails the partial or total loss of this right (art. VI.53, 1° and 9°).',
  },
  {
    n: '14', title: 'Force Majeure',
    body: 'FIXED cannot be held liable for non-performance or delay in the event of force majeure within the meaning of Article 5.225 of the Belgian Civil Code: natural disaster, act of terrorism, general internet or power outage, pandemic or governmental act.',
  },
  {
    n: '15', title: 'General Provisions',
    body: 'If any provision of these Terms is declared void, such nullity shall not affect the validity of the remaining provisions.\n\nThese Terms constitute the entire agreement between FIXED and the Client and supersede all prior agreements relating to the same subject matter.',
  },
  {
    n: '16', title: 'Contact',
    body: 'For any question relating to these Terms:\n– E-mail: support@thefixed.app\n– Website: www.thefixed.app\n– Address: Av. Maeterlinck 54, 1030 Schaerbeek, Belgium\n– VAT / BCE: BE1037.044.717\n\nFIXED PLATEFORM SRL — Client Terms of Use — Version 1.0, 15 March 2026',
  },
];

const ARTICLES_NL = [
  {
    n: '1', title: 'Definities',
    body: '– "Platform": de mobiele en/of webapplicatie FIXED, met inbegrip van al haar functies, interfaces en bijbehorende diensten.\n– "Klant": elke natuurlijke of rechtspersoon die op het Platform is ingeschreven als aanvrager van diensten.\n– "Dienstverlener": elke zelfstandige professional die op het Platform is ingeschreven, houder van een geldig KBO-nummer, en die de Algemene Voorwaarden voor Dienstverleners heeft aanvaard.\n– "Opdracht": de dienst die de Klant via het Platform bestelt en die door een Dienstverlener wordt uitgevoerd.\n– "Commissie": de vergoeding die FIXED ontvangt in ruil voor de toegang tot het Platform en de bemiddelingsdiensten.\n– "Account": de beveiligde persoonlijke ruimte die de Klant op het Platform aanmaakt.',
  },
  {
    n: '2', title: 'Voorwerp',
    body: 'Deze gebruiksvoorwaarden bepalen de voorwaarden waaronder FIXED het Platform ter beschikking stelt van de Klanten.\n\nFIXED behoudt zich het recht voor deze voorwaarden op elk moment te wijzigen. Bij een wezenlijke wijziging informeert FIXED de Klanten via een in-app melding of e-mail met een opzegtermijn van 15 dagen.',
  },
  {
    n: '3', title: 'Inschrijving en Toegang',
    body: '3.1 De toegang is voorbehouden aan natuurlijke personen van minstens 18 jaar met volledige handelingsbekwaamheid, evenals aan rechtsgeldig opgerichte rechtspersonen.\n\n3.2 De inschrijving vereist juiste gegevens: naam, voornaam, geldig e-mailadres, telefoonnummer.\n\n3.3 De Klant is als enige verantwoordelijk voor de vertrouwelijkheid van zijn inloggegevens. Bij ongeoorloofd gebruik: contacteer FIXED via support@thefixed.app.\n\n3.4 FIXED behoudt zich het recht voor een Account te schorsen of af te sluiten bij schending van deze voorwaarden.',
  },
  {
    n: '4', title: 'Bestelproces',
    body: '4.1 De bestelling gebeurt via het Platform: keuze van de locatie, keuze van de dienst, planning, bevestiging met betaling. De bestelling is definitief na validatie van de betaling.\n\n4.2 FIXED gebruikt een realtime toewijzingsalgoritme. De Opdracht wordt toegewezen aan de eerste beschikbare Dienstverlener die de bestelling aanvaardt.\n\n4.3 De Klant ontvangt een in-app melding zodra een Dienstverlener heeft aanvaard.\n\n4.4 De geldende tarieven worden vóór de bevestiging weergegeven. Wijzigingen zijn niet van toepassing op reeds bevestigde bestellingen.',
  },
  {
    n: '5', title: 'Annulering en Terugbetaling',
    body: 'Niveau 1 — Annulering vóór aankomst: 100% terugbetaling, geen kosten.\n\nNiveau 2 — Annulering bij aankomst (opdracht niet gestart): volledige terugbetaling na aftrek van de verplaatsingskosten.\n\nNiveau 3 — Geschil na gedeeltelijke uitvoering: tegensprekelijke procedure, eventuele gedeeltelijke terugbetaling.\n\nNiveau 4 — Bewezen zware fout van de Dienstverlener: volledige terugbetaling + activering van de verzekeringsgaranties.\n\nAanvragen moeten via de applicatie worden ingediend binnen 7 kalenderdagen na de Opdracht.',
  },
  {
    n: '6', title: 'Verplichtingen van de Klant',
    body: 'De Klant verbindt zich ertoe:\n– Juiste en volledige informatie te verstrekken bij de bestelling.\n– Aanwezig te zijn of een vertegenwoordiger te hebben aangeduid op het afgesproken tijdstip.\n– De Dienstverleners met respect en waardigheid te behandelen.\n– De Dienstverleners niet buiten het Platform om te benaderen om de commissies te omzeilen.\n– Het Platform niet te gebruiken voor onwettige of frauduleuze doeleinden.',
  },
  {
    n: '7', title: 'Betalingen',
    body: '7.1 De betaling gebeurt uitsluitend via het Platform met bankkaart (Visa, Mastercard) of elk ander beschikbaar middel. De betalingen worden beveiligd door Stripe.\n\n7.2 Het bedrag wordt afgehouden op het moment van de bevestiging. FIXED verstuurt een elektronische factuur binnen 24 uur na de Opdracht.\n\n7.3 FIXED houdt een commissie in ten laste van de Dienstverlener. De aan de Klant getoonde prijs is de definitieve prijs inclusief btw, zonder verborgen kosten.\n\n7.4 FIXED kan elke verdachte transactie zonder voorafgaande kennisgeving annuleren.',
  },
  {
    n: '8', title: 'Aansprakelijkheid van FIXED',
    body: 'FIXED treedt op als aanbieder van bemiddelingsdiensten in de zin van Verordening (EU) 2022/2065 (Digital Services Act). Als zodanig is FIXED niet verantwoordelijk voor de kwaliteit van de door de Dienstverleners uitgevoerde prestaties.\n\nDe rechtstreekse aansprakelijkheid van FIXED, indien erkend, is beperkt tot het bedrag dat de Klant effectief voor de betrokken Opdracht heeft betaald.\n\nFIXED past verificatieprocedures toe voor Dienstverleners (KBO-nummer, attest BA-verzekering) maar kan de afwezigheid van frauduleuze verklaringen niet garanderen.',
  },
  {
    n: '9', title: 'Persoonsgegevens',
    body: 'De gegevensverwerking wordt geregeld door het Privacybeleid van FIXED, dat door verwijzing deel uitmaakt van deze voorwaarden.\n\nOvereenkomstig de AVG en de Belgische wet van 30 juli 2018 beschikt de Klant over rechten van inzage, rectificatie, wissing, overdraagbaarheid en bezwaar.\n\nContact: privacy@thefixed.app\n\nDe gegevens worden bewaard voor de duur van de contractuele relatie en 5 jaar na de afsluiting van het Account.',
  },
  {
    n: '10', title: 'Intellectuele Eigendom',
    body: 'Het FIXED-platform (logo, merk, design, broncode, algoritmen, teksten, afbeeldingen) is de exclusieve eigendom van FIXED of haar licentiegevers. Elke ongeoorloofde reproductie of elk ongeoorloofd gebruik is strikt verboden en vormt een strafbare inbreuk.',
  },
  {
    n: '11', title: 'Gedrag en Moderatie',
    body: 'FIXED behoudt zich het recht voor elke inhoud te verwijderen die strijdig is met deze voorwaarden, lasterlijk is of de privacy schendt.\n\nFIXED beschikt over een meldingsmechanisme waarmee Dienstverleners ongepast gedrag kunnen melden. FIXED kan het betrokken Account schorsen of beëindigen.',
  },
  {
    n: '12', title: 'Geschillenbeslechting',
    body: '12.1 Klantendienst: support@thefixed.app. Antwoord binnen 48 werkuren, oplossing binnen 10 werkdagen.\n\n12.2 Bij gebrek aan een oplossing kunnen de partijen een beroep doen op arbitrage bij het Belgisch Centrum voor Arbitrage en Mediatie (CEPANI).\n\n12.3 Elk geschil valt onder de exclusieve bevoegdheid van de rechtbanken van het gerechtelijk arrondissement Brussel.\n\n12.4 Toepasselijk recht: Belgisch recht, Burgerlijk Wetboek, Wetboek van economisch recht en Verordening (EU) 2022/2065.',
  },
  {
    n: '13', title: 'Herroepingsrecht',
    body: 'Overeenkomstig artikel VI.47 van het Belgisch Wetboek van economisch recht beschikt de Klant over een herroepingstermijn van 14 kalenderdagen.\n\nDoor een Opdracht met onmiddellijke of spoedige uitvoering te bestellen, erkent de Klant echter uitdrukkelijk dat een prestatie die vóór het verstrijken van de herroepingstermijn is begonnen, het gedeeltelijke of volledige verlies van dit recht met zich meebrengt (art. VI.53, 1° en 9°).',
  },
  {
    n: '14', title: 'Overmacht',
    body: 'FIXED kan niet aansprakelijk worden gesteld voor niet-uitvoering of vertraging in geval van overmacht in de zin van artikel 5.225 van het Belgisch Burgerlijk Wetboek: natuurramp, terroristische daad, algemene internet- of stroomstoring, pandemie of overheidsmaatregel.',
  },
  {
    n: '15', title: 'Algemene Bepalingen',
    body: 'Indien een van de bepalingen van deze voorwaarden nietig wordt verklaard, tast deze nietigheid de geldigheid van de overige bepalingen niet aan.\n\nDeze voorwaarden vormen de volledige overeenkomst tussen FIXED en de Klant en vervangen alle eerdere overeenkomsten met hetzelfde voorwerp.',
  },
  {
    n: '16', title: 'Contact',
    body: 'Voor elke vraag over deze voorwaarden:\n– E-mail: support@thefixed.app\n– Website: www.thefixed.app\n– Adres: Av. Maeterlinck 54, 1030 Schaarbeek, België\n– Btw / KBO: BE1037.044.717\n\nFIXED PLATEFORM SRL — Gebruiksvoorwaarden Klanten — Versie 1.0, 15 maart 2026',
  },
];

const ARTICLES_BY_LANG: Record<string, typeof ARTICLES_FR> = {
  fr: ARTICLES_FR,
  en: ARTICLES_EN,
  nl: ARTICLES_NL,
};

export default function CGUScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language || 'fr').slice(0, 2).toLowerCase();
  const articles = ARTICLES_BY_LANG[lang] || ARTICLES_FR;
  const showPrevailNote = lang !== 'fr';

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      <View style={[s.header, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity style={[s.backBtn, { backgroundColor: theme.surface }]} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={8}>
          <Feather name="arrow-left" size={20} color={theme.textAlt} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.textAlt, fontFamily: FONTS.sansMedium }]}>{t('ext.cgu_title')}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <View style={[s.introCard, { backgroundColor: theme.heroBg }]}>
          <Text style={[s.introVersion, { color: theme.heroSubFaint, fontFamily: FONTS.mono }]}>{t('ext.cgu_version')}</Text>
          <Text style={[s.introTitle, { color: theme.heroText, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{t('ext.cgu_company')}</Text>
          <Text style={[s.introText, { color: theme.heroSub, fontFamily: FONTS.sans }]}>
            {t('ext.cgu_intro')}
          </Text>
        </View>

        {showPrevailNote && (
          <View style={[s.prevailNote, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}>
            <Feather name="info" size={14} color={theme.textSub} />
            <Text style={[s.prevailNoteText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
              {t('ext.cgu_prevail_note')}
            </Text>
          </View>
        )}

        <View style={s.articleList}>
          {articles.map(a => <Article key={a.n} n={a.n} title={a.title} body={a.body} />)}
        </View>

        <Text style={[s.footer, { color: theme.textVeryMuted, fontFamily: FONTS.mono }]}>
          {t('ext.cgu_footer')}
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

  introCard: { borderRadius: 24, padding: 20, gap: 8, marginBottom: 12 },
  prevailNote: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 11, marginBottom: 12,
  },
  prevailNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  introVersion: { fontSize: 11 },
  introTitle: { fontSize: 28, letterSpacing: 1 },
  introText: { fontSize: 13, lineHeight: 20 },

  articleList: { gap: 6 },
  article: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
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
