// components/support/ProblemSelector.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    { id: 'provider_late', label: 'Le prestataire est en retard', icon: 'time-outline', severity: 'medium', resolution: 'Nous allons contacter le prestataire pour vous. Si il ne repond pas sous 5 minutes, nous vous attribuerons un nouveau prestataire.' },
    { id: 'cannot_find', label: 'Je ne trouve pas le prestataire', icon: 'search-outline', severity: 'medium', resolution: 'Le prestataire a recu votre adresse et devrait vous contacter. Essayez de le joindre via la messagerie de la mission.' },
    { id: 'want_cancel', label: 'Je veux annuler', icon: 'close-circle-outline', severity: 'low', resolution: 'Vous pouvez annuler cette mission depuis l\'ecran de suivi. Des frais d\'annulation peuvent s\'appliquer selon nos CGU.' },
  ],
  // ONGOING — mission in progress
  IN_PROGRESS: [
    { id: 'security', label: 'Probleme de securite', icon: 'shield-outline', severity: 'high', resolution: 'Votre securite est notre priorite absolue. Un membre de notre equipe va etre notifie immediatement.' },
    { id: 'stop_mission', label: 'Je veux arreter la mission', icon: 'stop-circle-outline', severity: 'medium', resolution: 'Contactez notre support pour interrompre la mission en cours. Le prestataire sera notifie.' },
  ],
  // DONE — completed
  COMPLETED: [
    { id: 'unsatisfactory', label: 'Le travail est insatisfaisant', icon: 'thumbs-down-outline', severity: 'medium', resolution: 'Nous prenons la qualite tres au serieux. Decrivez le probleme a notre equipe pour qu\'elle puisse intervenir.' },
    { id: 'damage', label: 'Un dommage a ete cause', icon: 'warning-outline', severity: 'high', resolution: 'Nous allons ouvrir une investigation. Les photos avant/apres de la mission seront examinees par notre equipe.' },
    { id: 'payment_issue', label: 'Probleme de paiement', icon: 'card-outline', severity: 'medium', resolution: 'Notre equipe financiere va examiner votre dossier. Les remboursements sont traites sous 5 jours ouvrables.' },
    { id: 'unknown_mission', label: 'Je ne reconnais pas cette mission', icon: 'alert-circle-outline', severity: 'high', resolution: 'C\'est tres important. Nous allons verifier immediatement l\'origine de cette mission et securiser votre compte.' },
  ],
  // Autre
  OTHER: [
    { id: 'account', label: 'Probleme de compte', icon: 'person-outline', severity: 'medium', resolution: 'Contactez notre support pour toute question liee a votre compte, vos donnees ou vos accces.' },
    { id: 'invoice_question', label: 'Question sur une facture', icon: 'receipt-outline', severity: 'low', resolution: 'Vos factures sont disponibles dans Documents. Pour toute question specifique, notre equipe peut vous aider.' },
    { id: 'other', label: 'Autre', icon: 'chatbubble-outline', severity: 'medium', resolution: 'Decrivez votre situation a notre equipe support. Nous vous repondrons dans les meilleurs delais.' },
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
        <Ionicons name="arrow-back" size={18} color={theme.textMuted} />
        <Text style={[s.backText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Retour</Text>
      </TouchableOpacity>

      <Text style={[s.title, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
        Quel est le probleme ?
      </Text>

      <View style={s.list}>
        {problems.map((problem) => (
          <TouchableOpacity
            key={problem.id}
            style={[s.option, { backgroundColor: theme.cardBg }]}
            onPress={() => onSelect(problem)}
            activeOpacity={0.7}
          >
            <View style={[s.iconWrap, { backgroundColor: theme.surface }]}>
              <Ionicons name={problem.icon as any} size={20} color={theme.textSub} />
            </View>
            <Text style={[s.optionLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              {problem.label}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
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
