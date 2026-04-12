// components/support/ProblemSelector.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

export type Severity = 'low' | 'medium' | 'high';

export interface ProblemOption {
  id: string;
  label: string;
  icon: string;
  severity: Severity;
  resolution: string;
}

interface ProblemSelectorProps {
  missionStatus: string | null; // null = "Autre probleme"
  onSelect: (problem: ProblemOption) => void;
  onBack: () => void;
}

const PROBLEMS_BY_STATUS: Record<string, ProblemOption[]> = {
  // PUBLISHED or ACCEPTED — searching/waiting phase
  SEARCHING: [
    { id: 'provider_late', label: 'Le prestataire est en retard', icon: 'clock', severity: 'medium', resolution: 'Nous allons contacter le prestataire pour vous. S\'il ne répond pas sous 5 minutes, nous vous attribuerons un nouveau prestataire.' },
    { id: 'cannot_find', label: 'Je ne trouve pas le prestataire', icon: 'search', severity: 'medium', resolution: 'Le prestataire a reçu votre adresse et devrait vous contacter. Essayez de le joindre via la messagerie de la mission.' },
    { id: 'want_cancel', label: 'Je veux annuler', icon: 'x-circle', severity: 'low', resolution: 'Vous pouvez annuler cette mission depuis l\'écran de suivi. Des frais d\'annulation peuvent s\'appliquer selon nos CGU.' },
  ],
  // ONGOING — mission in progress
  IN_PROGRESS: [
    { id: 'security', label: 'Problème de sécurité', icon: 'shield', severity: 'high', resolution: 'Votre sécurité est notre priorité absolue. Un membre de notre équipe va être notifié immédiatement.' },
    { id: 'stop_mission', label: 'Je veux arrêter la mission', icon: 'minus-circle', severity: 'medium', resolution: 'Contactez notre support pour interrompre la mission en cours. Le prestataire sera notifié.' },
  ],
  // DONE — completed
  COMPLETED: [
    { id: 'unsatisfactory', label: 'Le travail est insatisfaisant', icon: 'thumbs-down', severity: 'medium', resolution: 'Nous prenons la qualité très au sérieux. Décrivez le problème à notre équipe pour qu\'elle puisse intervenir.' },
    { id: 'damage', label: 'Un dommage a été causé', icon: 'alert-triangle', severity: 'high', resolution: 'Nous allons ouvrir une investigation. Les photos avant/après de la mission seront examinées par notre équipe.' },
    { id: 'payment_issue', label: 'Problème de paiement', icon: 'credit-card', severity: 'medium', resolution: 'Notre équipe financière va examiner votre dossier. Les remboursements sont traités sous 5 jours ouvrables.' },
    { id: 'unknown_mission', label: 'Je ne reconnais pas cette mission', icon: 'alert-circle', severity: 'high', resolution: 'C\'est très important. Nous allons vérifier immédiatement l\'origine de cette mission et sécuriser votre compte.' },
  ],
  // Autre
  OTHER: [
    { id: 'account', label: 'Problème de compte', icon: 'user', severity: 'medium', resolution: 'Contactez notre support pour toute question liée à votre compte, vos données ou vos accès.' },
    { id: 'invoice_question', label: 'Question sur une facture', icon: 'file-text', severity: 'low', resolution: 'Vos factures sont disponibles dans Documents. Pour toute question spécifique, notre équipe peut vous aider.' },
    { id: 'other', label: 'Autre', icon: 'message-circle', severity: 'medium', resolution: 'Décrivez votre situation à notre équipe support. Nous vous répondrons dans les meilleurs délais.' },
  ],
};

function mapStatusToKey(status: string | null): string {
  if (!status) return 'OTHER';
  const s = status.toUpperCase();
  if (['PUBLISHED', 'ACCEPTED'].includes(s)) return 'SEARCHING';
  if (s === 'ONGOING') return 'IN_PROGRESS';
  if (s === 'DONE') return 'COMPLETED';
  return 'OTHER';
}

export default function ProblemSelector({ missionStatus, onSelect, onBack }: ProblemSelectorProps) {
  const theme = useAppTheme();
  const key = mapStatusToKey(missionStatus);
  const problems = PROBLEMS_BY_STATUS[key] || PROBLEMS_BY_STATUS.OTHER;

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.backRow} onPress={onBack} activeOpacity={0.7}>
        <Feather name="arrow-left" size={18} color={theme.textMuted} />
        <Text style={[s.backText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Retour</Text>
      </TouchableOpacity>

      <Text style={[s.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
        Quel est le problème ?
      </Text>

      <View style={s.list}>
        {problems.map((problem) => (
          <TouchableOpacity
            key={problem.id}
            style={[s.option, { backgroundColor: theme.cardBg, borderWidth: 1, borderColor: theme.borderLight }]}
            onPress={() => onSelect(problem)}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
              <Feather name={problem.icon as any} size={20} color={theme.textSub} />
            </View>
            <Text style={[s.optionLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              {problem.label}
            </Text>
            <Feather name="chevron-right" size={16} color={theme.textMuted} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 14 },
  title: { fontSize: 20, lineHeight: 26 },
  list: { gap: 8 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  optionLabel: { flex: 1, fontSize: 15 },
});
