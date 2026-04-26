// components/support/ResolutionView.tsx
// Étape 3 : résolution. Trois branches selon la sévérité :
//   • low    → résolution affichée, action « C'est résolu » + escape vers WhatsApp
//   • medium → ouverture WhatsApp avec message pré-rempli + numéro support
//   • high   → escalade backend (création ticket + notif admin) PUIS WhatsApp
// Le bug historique : `buildWhatsAppMessage` construisait un message qui n'était
// jamais transmis à WhatsApp (le code utilisait `wa.me/message/...` sans paramètre
// `text`). On utilise désormais `buildWhatsAppUrl()` qui encode le message dans
// l'URL — l'agent reçoit le contexte complet à l'ouverture.

import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import {
  SUPPORT_CHANNELS,
  RESPONSE_SLA,
  buildWhatsAppUrl,
  buildSupportMessage,
  shortTicketRef,
} from '@/lib/support';
import type { ProblemOption, Severity } from './ProblemSelector';

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

interface SeverityConfig {
  toneIcon: string;
  toneColor: (theme: ReturnType<typeof useAppTheme>) => string;
  primaryLabel: string;
  primaryIcon: string;
}

const SEVERITY: Record<Severity, SeverityConfig> = {
  low: {
    toneIcon: 'check-circle',
    toneColor: t => t.text as string,
    primaryLabel: 'C\'est résolu, merci',
    primaryIcon: 'check',
  },
  medium: {
    toneIcon: 'message-circle',
    toneColor: () => COLORS.amber,
    primaryLabel: 'Ouvrir WhatsApp',
    primaryIcon: 'message-circle',
  },
  high: {
    toneIcon: 'alert-octagon',
    toneColor: () => COLORS.red,
    primaryLabel: 'Demander une intervention urgente',
    primaryIcon: 'alert-octagon',
  },
};

interface EscalationResult {
  ticketRef: string | null;
  ok: boolean;
}

export default function ResolutionView({
  problem, mission, userName, userId, onBack, onDone,
}: ResolutionViewProps) {
  const theme = useAppTheme();
  const [submitting, setSubmitting] = useState(false);
  const [escalation, setEscalation] = useState<EscalationResult | null>(null);

  const cfg = SEVERITY[problem.severity];
  const tone = cfg.toneColor(theme);
  const sla = RESPONSE_SLA[problem.severity];

  const openWhatsAppPrefilled = useCallback(async (ticketRef: string | null) => {
    const message = buildSupportMessage({
      ticketRef: ticketRef ?? undefined,
      missionId: mission?.id,
      serviceType: mission?.serviceType,
      address: mission?.address,
      createdAt: mission?.createdAt,
      userName,
      problemLabel: problem.label,
    });
    const url = buildWhatsAppUrl(message);
    try {
      await WebBrowser.openBrowserAsync(url);
    } catch {
      // Fallback en cas d'échec WebBrowser : tentative de Linking direct.
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else await Linking.openURL(SUPPORT_CHANNELS.whatsappFallback);
    }
  }, [mission, problem.label, userName]);

  const callEmergency = useCallback(async () => {
    const tel = `tel:${SUPPORT_CHANNELS.emergencyPhone.replace(/\s/g, '')}`;
    const can = await Linking.canOpenURL(tel);
    if (can) await Linking.openURL(tel);
    else Alert.alert('Appel impossible', `Composez manuellement : ${SUPPORT_CHANNELS.emergencyPhone}`);
  }, []);

  const submit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Low : pas d'escalade backend, l'utilisateur valide juste que c'est résolu.
    if (problem.severity === 'low') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onDone();
      return;
    }

    // Medium : on ouvre WhatsApp directement, sans bloquer sur le backend
    // (l'agent verra le contexte du message). On enregistre l'escalade en
    // arrière-plan pour traçabilité.
    if (problem.severity === 'medium') {
      api.post('/support/escalate', {
        missionId: mission?.id || null,
        problemType: problem.id,
        severity: 'medium',
      }).catch(err => devError('[SUPPORT] medium escalate (background) failed:', err));
      await openWhatsAppPrefilled(null);
      return;
    }

    // High : escalade SYNCHRONE — on attend le ticketId avant d'ouvrir WhatsApp,
    // et on affiche un état de confirmation persistant à l'écran.
    setSubmitting(true);
    try {
      const res: any = await api.post('/support/escalate', {
        missionId: mission?.id || null,
        problemType: problem.id,
        severity: 'high',
      });
      const ticketId = res?.ticketId || res?.data?.ticketId;
      const ref = ticketId ? shortTicketRef(String(ticketId)) : null;
      setEscalation({ ticketRef: ref, ok: true });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Ouvre WhatsApp avec le ticketRef pour que l'agent retrouve le ticket en DB.
      await openWhatsAppPrefilled(ref);
    } catch (err) {
      devError('[SUPPORT] high escalation failed:', err);
      // Backend KO mais on N'EMPÊCHE PAS le contact WhatsApp — l'urgence prime.
      setEscalation({ ticketRef: null, ok: false });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await openWhatsAppPrefilled(null);
    } finally {
      setSubmitting(false);
    }
  }, [problem, mission, onDone, openWhatsAppPrefilled]);

  // ─── Rendu confirmation post-escalade (high severity uniquement) ──────────
  if (escalation && problem.severity === 'high') {
    return (
      <ConfirmationView
        ok={escalation.ok}
        ticketRef={escalation.ticketRef}
        sla={sla.label}
        onCallSupport={callEmergency}
        onWhatsApp={() => openWhatsAppPrefilled(escalation.ticketRef)}
        onDone={onDone}
        theme={theme}
      />
    );
  }

  return (
    <View style={{ gap: 16 }}>
      {/* Carte résolution */}
      <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
        <View style={[s.iconCircle, { backgroundColor: `${tone}1A` }]}>
          <Feather name={cfg.toneIcon as any} size={26} color={tone} />
        </View>

        <Text style={[s.problemLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          {problem.label}
        </Text>

        <Text style={[s.resolution, { color: theme.textSub, fontFamily: FONTS.sans }]}>
          {problem.resolution}
        </Text>

        {/* SLA */}
        <View style={[s.slaPill, { backgroundColor: theme.surface }]}>
          <Feather name="clock" size={12} color={theme.textSub} />
          <Text style={[s.slaText, { color: theme.textSub, fontFamily: FONTS.monoMedium }]}>
            RÉPONSE {sla.label.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* CTA principal */}
      <TouchableOpacity
        style={[
          s.actionBtn,
          { backgroundColor: problem.severity === 'high' ? COLORS.red : theme.text },
          submitting && { opacity: 0.55 },
        ]}
        onPress={submit}
        disabled={submitting}
        activeOpacity={0.85}
      >
        {submitting ? (
          <ActivityIndicator color={problem.severity === 'high' ? '#FFF' : theme.bg} />
        ) : (
          <>
            <Feather
              name={cfg.primaryIcon as any}
              size={17}
              color={problem.severity === 'high' ? '#FFF' : theme.bg}
            />
            <Text
              style={[
                s.actionBtnText,
                {
                  color: problem.severity === 'high' ? '#FFF' : theme.bg,
                  fontFamily: FONTS.sansMedium,
                },
              ]}
            >
              {cfg.primaryLabel}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* CTA secondaires */}
      {problem.severity !== 'low' && (
        <View style={s.secondaryRow}>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={callEmergency}
            activeOpacity={0.8}
          >
            <Feather name="phone" size={15} color={theme.text} />
            <Text style={[s.secondaryBtnText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              Appeler
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_CHANNELS.email}?subject=${encodeURIComponent(`Support — ${problem.label}`)}`)}
            activeOpacity={0.8}
          >
            <Feather name="mail" size={15} color={theme.text} />
            <Text style={[s.secondaryBtnText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
              Email
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Retour */}
      <TouchableOpacity
        style={s.backBtn}
        onPress={onBack}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="arrow-left" size={14} color={theme.textMuted} />
        <Text style={[s.backText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          Choisir un autre problème
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Vue confirmation (post-escalade high) ───────────────────────────────────

function ConfirmationView({ ok, ticketRef, sla, onCallSupport, onWhatsApp, onDone, theme }: {
  ok: boolean;
  ticketRef: string | null;
  sla: string;
  onCallSupport: () => void;
  onWhatsApp: () => void;
  onDone: () => void;
  theme: ReturnType<typeof useAppTheme>;
}) {
  const tint = ok ? COLORS.greenBrand : COLORS.amber;
  return (
    <View style={{ gap: 16 }}>
      <View style={[s.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, alignItems: 'center' }]}>
        <View style={[s.iconCircle, { backgroundColor: `${tint}1A` }]}>
          <Feather name={ok ? 'check-circle' : 'alert-triangle'} size={28} color={tint} />
        </View>
        <Text style={[s.problemLabel, { color: theme.text, fontFamily: FONTS.sansMedium }]}>
          {ok ? 'Signalement transmis' : 'Signalement en cours'}
        </Text>
        <Text style={[s.resolution, { color: theme.textSub, fontFamily: FONTS.sans }]}>
          {ok
            ? `Notre équipe a été notifiée. Réponse garantie ${sla.toLowerCase()}.`
            : 'Nous n\'avons pas pu créer le ticket automatiquement. Contactez le support directement — votre demande sera traitée immédiatement.'}
        </Text>
        {ticketRef && (
          <View style={[s.ticketRow, { backgroundColor: theme.surface }]}>
            <Feather name="hash" size={13} color={theme.textSub} />
            <Text style={[s.ticketText, { color: theme.text, fontFamily: FONTS.monoMedium }]}>
              {ticketRef}
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[s.actionBtn, { backgroundColor: theme.text }]}
        onPress={onWhatsApp}
        activeOpacity={0.85}
      >
        <Feather name="message-circle" size={17} color={theme.bg} />
        <Text style={[s.actionBtnText, { color: theme.bg, fontFamily: FONTS.sansMedium }]}>
          Continuer sur WhatsApp
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.secondaryBtn, { backgroundColor: theme.surface, borderColor: theme.borderLight, height: 50 }]}
        onPress={onCallSupport}
        activeOpacity={0.8}
      >
        <Feather name="phone" size={16} color={theme.text} />
        <Text style={[s.secondaryBtnText, { color: theme.text, fontFamily: FONTS.sansMedium, fontSize: 15 }]}>
          Appeler le support
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={s.backBtn}
        onPress={onDone}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[s.backText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>
          Retour à l'accueil
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 18, padding: 22, gap: 12, borderWidth: 1, alignItems: 'center',
  },
  iconCircle: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  problemLabel: { fontSize: 17, textAlign: 'center', lineHeight: 22 },
  resolution: { fontSize: 13.5, lineHeight: 20, textAlign: 'center', maxWidth: 320 },

  slaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 999, marginTop: 4,
  },
  slaText: { fontSize: 10, letterSpacing: 1.2 },

  ticketRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 999, marginTop: 4,
  },
  ticketText: { fontSize: 13, letterSpacing: 0.5 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    height: 54, borderRadius: 14,
  },
  actionBtnText: { fontSize: 15.5, letterSpacing: 0.2 },

  secondaryRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    height: 46, borderRadius: 12, borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 13.5, letterSpacing: 0.2 },

  backBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  backText: { fontSize: 13 },
});
