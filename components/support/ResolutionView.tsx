// components/support/ResolutionView.tsx
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import type { ProblemOption, Severity } from './ProblemSelector';

const WHATSAPP_NUMBER = '+32XXXXXXXXX'; // Replace with real WhatsApp Business number

interface Mission {
  id: number;
  serviceType: string;
  address: string;
  createdAt: string;
}

interface ResolutionViewProps {
  problem: ProblemOption;
  mission: Mission | null;
  userName: string;
  userId: string;
  onBack: () => void;
  onDone: () => void;
}

function buildWhatsAppMessage(mission: Mission | null, problem: ProblemOption, userName: string): string {
  if (mission) {
    const date = new Date(mission.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
    return [
      'Bonjour FIXED Support,',
      `Mission #${mission.id} — ${mission.serviceType}`,
      `Problème : ${problem.label}`,
      `Client : ${userName}`,
      `Adresse : ${mission.address}`,
      `Date : ${date}`,
    ].join('\n');
  }
  return [
    'Bonjour FIXED Support,',
    `Problème : ${problem.label}`,
    `Client : ${userName}`,
  ].join('\n');
}

function openWhatsApp(message: string) {
  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${WHATSAPP_NUMBER.replace(/[^0-9]/g, '')}?text=${encoded}`;
  Linking.openURL(url);
}

const SEVERITY_CONFIG: Record<Severity, { icon: string; btnLabel: string; btnIcon: string }> = {
  low: { icon: 'checkmark-circle-outline', btnLabel: "C'est résolu", btnIcon: 'checkmark' },
  medium: { icon: 'chatbubble-outline', btnLabel: 'Contacter le support', btnIcon: 'logo-whatsapp' },
  high: { icon: 'alert-circle-outline', btnLabel: 'Escalade urgente', btnIcon: 'alert-circle' },
};

export default function ResolutionView({ problem, mission, userName, userId, onBack, onDone }: ResolutionViewProps) {
  const theme = useAppTheme();
  const [escalating, setEscalating] = useState(false);
  const config = SEVERITY_CONFIG[problem.severity];

  const handleAction = async () => {
    if (problem.severity === 'low') {
      onDone();
      return;
    }

    const message = buildWhatsAppMessage(mission, problem, userName);

    if (problem.severity === 'high') {
      // Escalate to backend first, then open WhatsApp
      setEscalating(true);
      try {
        await api.post('/support/escalate', {
          missionId: mission?.id || null,
          problemType: problem.id,
          userId,
        });
      } catch (err) {
        devError('[SUPPORT] Escalation failed:', err);
        // Don't block — still open WhatsApp
      } finally {
        setEscalating(false);
      }
      openWhatsApp(message);
      return;
    }

    // Medium — just open WhatsApp
    openWhatsApp(message);
  };

  return (
    <View style={s.root}>
      <TouchableOpacity style={s.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={18} color={theme.textMuted} />
        <Text style={[s.backText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Retour</Text>
      </TouchableOpacity>

      {/* Resolution card */}
      <View style={[s.card, {
        backgroundColor: theme.cardBg,
        ...Platform.select({
          ios: { shadowColor: '#000', shadowOpacity: theme.shadowOpacity, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
          android: { elevation: 2 },
        }),
      }]}>
        <View style={[s.iconCircle, {
          backgroundColor: problem.severity === 'high'
            ? (theme.isDark ? `${COLORS.red}22` : `${COLORS.red}14`)
            : theme.surface,
        }]}>
          <Ionicons
            name={config.icon as any}
            size={28}
            color={problem.severity === 'high' ? COLORS.red : theme.textSub}
          />
        </View>

        <Text style={[s.problemLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          {problem.label}
        </Text>

        <Text style={[s.resolution, { color: theme.textSub, fontFamily: FONTS.sans }]}>
          {problem.resolution}
        </Text>
      </View>

      {/* Action button */}
      <TouchableOpacity
        style={[
          s.actionBtn,
          problem.severity === 'high'
            ? { backgroundColor: COLORS.red }
            : { backgroundColor: theme.accent },
          escalating && s.btnDisabled,
        ]}
        onPress={handleAction}
        disabled={escalating}
        activeOpacity={0.75}
      >
        {escalating ? (
          <ActivityIndicator color={problem.severity === 'high' ? '#FFF' : theme.accentText} />
        ) : (
          <>
            <Ionicons
              name={config.btnIcon as any}
              size={18}
              color={problem.severity === 'high' ? '#FFF' : theme.accentText}
            />
            <Text style={[
              s.actionBtnText,
              { fontFamily: FONTS.sansMedium },
              problem.severity === 'high'
                ? { color: '#FFF' }
                : { color: theme.accentText },
            ]}>
              {config.btnLabel}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Secondary action for high severity */}
      {problem.severity === 'high' && (
        <TouchableOpacity
          style={[s.secondaryBtn, { backgroundColor: theme.surface }]}
          onPress={() => {
            const message = buildWhatsAppMessage(mission, problem, userName);
            openWhatsApp(message);
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="logo-whatsapp" size={16} color={theme.textSub} />
          <Text style={[s.secondaryBtnText, { color: theme.textSub, fontFamily: FONTS.sansMedium }]}>
            Contacter aussi par WhatsApp
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 16 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: 14 },
  card: {
    borderRadius: 18, padding: 24, alignItems: 'center', gap: 12,
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  problemLabel: { fontSize: 17, textAlign: 'center' },
  resolution: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 55, borderRadius: 14,
  },
  actionBtnText: { fontSize: 16 },
  btnDisabled: { opacity: 0.5 },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 48, borderRadius: 14,
  },
  secondaryBtnText: { fontSize: 14 },
});
