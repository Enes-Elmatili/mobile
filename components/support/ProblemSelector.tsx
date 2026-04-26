// components/support/ProblemSelector.tsx
// Étape 2 : choix du problème, contextualisé par le statut de la mission.
// Les options sont enrichies d'une sévérité visible (low/medium/high) qui
// préfigure la réponse côté ResolutionView (auto-résolu / WhatsApp / escalade).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

export type Severity = 'low' | 'medium' | 'high';

export interface ProblemOption {
  id: string;
  label: string;
  icon: string;
  severity: Severity;
  resolution: string;
  /** Hint optionnel affiché sous le label pour clarifier le scope. */
  hint?: string;
}

interface ProblemSelectorProps {
  missionStatus: string | null;
  onSelect: (problem: ProblemOption) => void;
}

const PROBLEMS_BY_STATUS: Record<string, ProblemOption[]> = {
  // Mission acceptée mais pas encore démarrée — provider en route ou en attente.
  SEARCHING: [
    {
      id: 'provider_late',
      label: 'Le prestataire est en retard',
      hint: 'L\'heure de rendez-vous est dépassée',
      icon: 'clock',
      severity: 'medium',
      resolution: 'Nous contactons le prestataire pour vous. S\'il ne répond pas sous 5 minutes, nous vous proposons un autre prestataire qualifié.',
    },
    {
      id: 'cannot_find',
      label: 'Je ne trouve pas le prestataire',
      hint: 'Il n\'est pas à l\'adresse indiquée',
      icon: 'search',
      severity: 'medium',
      resolution: 'Le prestataire a votre adresse exacte. Essayez la messagerie ou l\'appel direct depuis l\'écran de suivi. Sinon notre équipe intervient.',
    },
    {
      id: 'want_cancel',
      label: 'Je veux annuler la mission',
      hint: 'Avant que le prestataire arrive',
      icon: 'x-circle',
      severity: 'low',
      resolution: 'Vous pouvez annuler depuis l\'écran de suivi. Le remboursement est automatique sous 3-5 jours ouvrés selon votre moyen de paiement.',
    },
  ],
  // Mission en cours d'exécution — prestataire sur place.
  IN_PROGRESS: [
    {
      id: 'security',
      label: 'Problème de sécurité',
      hint: 'Comportement inapproprié, danger, urgence',
      icon: 'shield',
      severity: 'high',
      resolution: 'Votre sécurité est notre priorité absolue. Notre équipe est notifiée immédiatement et vous rappelle dans les minutes qui suivent.',
    },
    {
      id: 'stop_mission',
      label: 'Je veux arrêter la mission',
      hint: 'Le travail ne se passe pas comme prévu',
      icon: 'minus-circle',
      severity: 'medium',
      resolution: 'Notre support peut interrompre la mission en cours. Le prestataire sera notifié et un règlement équitable sera négocié pour le travail déjà réalisé.',
    },
  ],
  // Mission terminée.
  COMPLETED: [
    {
      id: 'unsatisfactory',
      label: 'Le travail est insatisfaisant',
      hint: 'Qualité, finitions, conformité',
      icon: 'thumbs-down',
      severity: 'medium',
      resolution: 'Nous prenons la qualité très au sérieux. Décrivez le problème à notre équipe — elle peut organiser un retour du prestataire ou un geste commercial.',
    },
    {
      id: 'damage',
      label: 'Un dommage a été causé',
      hint: 'Casse, dégât des eaux, autre',
      icon: 'alert-triangle',
      severity: 'high',
      resolution: 'Investigation immédiate. Les photos avant/après sont examinées par notre équipe et notre assurance pro couvre les dégâts éligibles.',
    },
    {
      id: 'payment_issue',
      label: 'Problème de paiement',
      hint: 'Montant, facture, prélèvement',
      icon: 'credit-card',
      severity: 'medium',
      resolution: 'Notre équipe financière examine votre dossier. Tout remboursement éligible est traité sous 5 jours ouvrés.',
    },
    {
      id: 'unknown_mission',
      label: 'Je ne reconnais pas cette mission',
      hint: 'Compte potentiellement compromis',
      icon: 'alert-circle',
      severity: 'high',
      resolution: 'Sécurisation immédiate de votre compte. Vérification du paiement et investigation sur l\'origine de la mission.',
    },
  ],
  // Hors mission — questions générales.
  OTHER: [
    {
      id: 'account',
      label: 'Problème de compte',
      hint: 'Connexion, données, accès',
      icon: 'user',
      severity: 'medium',
      resolution: 'Notre support peut investiguer votre compte, restaurer un accès ou corriger des données.',
    },
    {
      id: 'invoice_question',
      label: 'Question sur une facture',
      hint: 'Téléchargement, contenu, TVA',
      icon: 'file-text',
      severity: 'low',
      resolution: 'Vos factures sont disponibles dans Documents → Factures. Pour toute question spécifique, notre équipe peut vous aider.',
    },
    {
      id: 'other',
      label: 'Autre demande',
      hint: 'Je ne trouve pas mon problème',
      icon: 'message-circle',
      severity: 'medium',
      resolution: 'Décrivez votre situation à notre équipe. Nous vous répondons dans la journée ouvrée — souvent en moins d\'une heure.',
    },
  ],
};

function mapStatusToKey(status: string | null): keyof typeof PROBLEMS_BY_STATUS {
  if (!status) return 'OTHER';
  const s = status.toUpperCase();
  if (['PUBLISHED', 'ACCEPTED'].includes(s)) return 'SEARCHING';
  if (s === 'ONGOING') return 'IN_PROGRESS';
  if (s === 'DONE') return 'COMPLETED';
  return 'OTHER';
}

const SEVERITY_LABEL: Record<Severity, string> = {
  low: 'Auto-résolu',
  medium: 'Support',
  high: 'Urgent',
};

function severityColor(sev: Severity, theme: ReturnType<typeof useAppTheme>) {
  if (sev === 'high') return COLORS.red;
  if (sev === 'medium') return COLORS.amber;
  return theme.textSub as string;
}

export default function ProblemSelector({ missionStatus, onSelect }: ProblemSelectorProps) {
  const theme = useAppTheme();
  const key = mapStatusToKey(missionStatus);
  const problems = PROBLEMS_BY_STATUS[key] || PROBLEMS_BY_STATUS.OTHER;

  return (
    <View style={{ gap: 8 }}>
      {problems.map(problem => {
        const tone = severityColor(problem.severity, theme);
        return (
          <TouchableOpacity
            key={problem.id}
            style={[s.option, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
            onPress={() => onSelect(problem)}
            activeOpacity={0.78}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
              <Feather name={problem.icon as any} size={18} color={theme.textSub} />
            </View>

            <View style={s.body}>
              <Text style={[s.label, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
                {problem.label}
              </Text>
              {!!problem.hint && (
                <Text style={[s.hint, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
                  {problem.hint}
                </Text>
              )}
            </View>

            <View style={[s.sevPill, { backgroundColor: `${tone}1A` }]}>
              <View style={[s.sevDot, { backgroundColor: tone }]} />
              <Text style={[s.sevText, { color: tone, fontFamily: FONTS.monoMedium }]}>
                {SEVERITY_LABEL[problem.severity]}
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14, borderWidth: 1,
  },
  iconWrap: {
    width: 38, height: 38, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 14 },
  hint: { fontSize: 11.5 },

  sevPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },
  sevDot: { width: 5, height: 5, borderRadius: 2.5 },
  sevText: { fontSize: 9.5, letterSpacing: 0.8 },
});
