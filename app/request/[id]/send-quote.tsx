// app/request/[id]/send-quote.tsx — Provider envoie un devis (adaptive dark/light)
// Déplié (Duo) : la demande à gauche (en-tête, ce qu'a demandé le client),
// le devis à droite (montants, notes, total) avec l'envoi en bas de page.
import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, StatusBar, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import type { ServiceRequest } from "@/lib/types";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { devError } from "@/lib/logger";
import { formatEURCents as fmtEur } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/AuthContext";
import Animated from "react-native-reanimated";
import { MOTION, useCountingValue, usePresence } from "@/lib/motion";
import { ReText } from "@/components/ui/ReText";
import { BookSpread, useLayoutClass } from "@/lib/layout";
import { briefOf } from "@/lib/mission/brief";
import { MissionFacts, MissionTitle } from "@/components/mission/blocks";
import { goBack } from '@/lib/nav/back';
import { PressScale } from '@/components/ui/PressScale';

// Normalise la virgule décimale (clavier FR/BE) avant parseFloat.
const parseAmount = (value: string): number => parseFloat(value.replace(",", ".")) || 0;

// Statuts pour lesquels l'envoi d'un devis est légitime (mission assignée en cours
// de diagnostic / d'estimation). Un devis déjà envoyé ou une demande terminée sortent.
const QUOTE_ELIGIBLE = ["ONGOING", "QUOTE_PENDING", "ACCEPTED"];

export default function SendQuote() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const [labor, setLabor] = useState("");
  const [parts, setParts] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [calloutFee, setCalloutFee] = useState(0);
  const [checking, setChecking] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // La demande, pour le rappel de la page gauche (déplié) — affichage seul.
  const [request, setRequest] = useState<ServiceRequest | null>(null);

  // Guard ownership + statut au mount, et gestion de l'erreur du fetch initial.
  // L'id seul, lu hors callback : c'est lui la dépendance, pas tout `user`.
  const userId = user?.id;
  const loadRequest = useCallback(async () => {
    if (!id || !userId) return;
    setChecking(true);
    setLoadError(false);
    try {
      const res = await api.requests.get(String(id));
      const data = res?.data || res;
      if (!data) { setLoadError(true); return; }

      const st = (data.status || "").toUpperCase();
      // Ownership : la demande doit être assignée à ce prestataire.
      // ⚠️ `request.providerId` est l'id du PROFIL Provider (relation
      // Provider.id), PAS l'id du User — les deux ne sont jamais égaux, donc
      // comparer providerId à user.id renvoyait TOUJOURS vers Missions et
      // rendait l'écran de rédaction inatteignable. L'id utilisateur du
      // prestataire assigné est porté par `provider.userId`, que le backend
      // inclut dans la réponse et utilise lui-même pour ce contrôle
      // (routes/requests.js : `request.provider?.userId === req.user?.id`).
      const assignedUserId = data.provider?.userId ?? null;
      if (assignedUserId && assignedUserId !== userId) {
        feedback.error(t("ext.sendquote_not_assigned"));
        router.replace("/(tabs)/missions");
        return;
      }
      // Statut : sinon on ne peut pas (encore) envoyer de devis.
      if (!QUOTE_ELIGIBLE.includes(st)) {
        if (st === "QUOTE_SENT") feedback.info(t("ext.sendquote_already_sent"));
        router.replace("/(tabs)/missions");
        return;
      }
      if (data.calloutFee) setCalloutFee(data.calloutFee);
      setRequest(data);
    } catch (e) {
      devError("SendQuote load error:", e);
      setLoadError(true);
    } finally {
      setChecking(false);
    }
  }, [id, userId, router, t]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  const laborCents = Math.round(parseAmount(labor) * 100);
  const partsCents = Math.round(parseAmount(parts) * 100);
  const totalCents = laborCents + partsCents;
  const canSend = laborCents > 0;

  // Le bloc total apparaît par le bas (usePresence) et son montant COMPTE
  // (useCountingValue) au lieu de sauter — moment 8. Décimales et devise
  // restent fixes, seul l'entier roule.
  const { isRegular } = useLayoutClass();
  const totalPresence = usePresence(totalCents > 0, { from: "bottom", preset: MOTION.pane });
  const totalCounter = useCountingValue(Math.floor(totalCents / 100), { preset: MOTION.count });
  const totalDec = `,${(totalCents / 100).toFixed(2).split(".")[1]} €`;
  const brief = useMemo(() => (request ? briefOf(request) : null), [request]);

  const handleSend = useCallback(async () => {
    if (!canSend || !id) return;
    feedback.haptic('medium');
    setSending(true);
    try {
      await api.post(`/quotes/${id}`, {
        laborAmount: laborCents,
        partsAmount: partsCents,
        notes: notes || undefined,
      });
      feedback.success(t('quote.sent_msg'));
      goBack(router, '/(tabs)/dashboard');
    } catch (e: any) {
      devError("Send quote error:", e);
      feedback.error(e?.message || t('common.error'));
    } finally {
      setSending(false);
    }
  }, [canSend, id, laborCents, partsCents, notes, router, t]);

  // Vérification en cours (guard ownership/statut) → loader plein écran.
  if (checking) {
    const spinner = <ActivityIndicator size="large" color={theme.accent} />;
    if (isRegular) {
      // Déplié : jamais centré sur le pli — la page gauche attend.
      return (
        <View style={[s.root, { backgroundColor: theme.bg }]}>
          <StatusBar barStyle={theme.statusBar} />
          <BookSpread left={<View style={[s.root, s.centerFill]}>{spinner}</View>} right={null} />
        </View>
      );
    }
    return (
      <View style={[s.root, s.centerFill, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        {spinner}
      </View>
    );
  }

  // Erreur du fetch initial → état dédié avec bouton réessayer.
  if (loadError) {
    const failed = (
      <>
        <Feather name="alert-circle" size={40} color={theme.textMuted} />
        <Text style={[s.errorText, { color: theme.textSub }]}>Impossible de charger cette demande.</Text>
        <PressScale accessibilityRole="button"
          style={[s.retryBtn, { backgroundColor: theme.accent }]}
          onPress={loadRequest}
        >
          <Feather name="refresh-cw" size={16} color={theme.accentText} />
          <Text style={[s.retryText, { color: theme.accentText }]}>Réessayer</Text>
        </PressScale>
      </>
    );
    if (isRegular) {
      return (
        <View style={[s.root, { backgroundColor: theme.bg }]}>
          <StatusBar barStyle={theme.statusBar} />
          <BookSpread left={<View style={[s.root, s.centerFill]}>{failed}</View>} right={null} />
        </View>
      );
    }
    return (
      <View style={[s.root, s.centerFill, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        {failed}
      </View>
    );
  }

  const backBtn = (
    <PressScale
      style={[s.headerBack, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
      onPress={() => { goBack(router, '/(tabs)/dashboard'); }}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={8}
    >
      <Feather name="arrow-left" size={18} color={theme.text} />
    </PressScale>
  );
  const title = <Text style={[s.headerTitle, { color: theme.text }]}>{t('quote.send_quote_title')}</Text>;

  const fields = (
    <>
      {/* Main d'oeuvre */}
      <View style={s.field}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{t('quote.labor')}</Text>
        <View style={[
          s.inputWrap,
          { backgroundColor: theme.surface, borderColor: theme.border },
          focused === "labor" && { borderColor: theme.borderLight },
        ]}>
          <TextInput
            style={[s.inputAmount, { color: theme.text }]}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            testID="quote-labor"
            value={labor}
            onChangeText={setLabor}
            onFocus={() => setFocused("labor")}
            onBlur={() => setFocused(null)}
          />
          <Text style={[s.inputUnit, { color: theme.textMuted }]}>€</Text>
        </View>
      </View>

      {/* Pièces / Matériel */}
      <View style={s.field}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{t('missions.parts_materials')}</Text>
        <View style={[
          s.inputWrap,
          { backgroundColor: theme.surface, borderColor: theme.border },
          focused === "parts" && { borderColor: theme.borderLight },
        ]}>
          <TextInput
            style={[s.inputAmount, { color: theme.text }]}
            placeholder="0.00"
            placeholderTextColor={theme.textMuted}
            keyboardType="decimal-pad"
            testID="quote-parts"
            value={parts}
            onChangeText={setParts}
            onFocus={() => setFocused("parts")}
            onBlur={() => setFocused(null)}
          />
          <Text style={[s.inputUnit, { color: theme.textMuted }]}>€</Text>
        </View>
      </View>

      {/* Notes */}
      <View style={s.field}>
        <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{t('missions.notes_for_client')}</Text>
        <TextInput
          style={[
            s.notesInput,
            { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
            focused === "notes" && { borderColor: theme.borderLight },
          ]}
          placeholder={t('quote.send_quote_notes_placeholder')}
          placeholderTextColor={theme.textMuted}
          testID="quote-notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          onFocus={() => setFocused("notes")}
          onBlur={() => setFocused(null)}
        />
      </View>

      {/* Live total block */}
      <Animated.View style={[s.totalBlock, { backgroundColor: theme.surface, borderColor: theme.border }, totalPresence.style]}>
        <Text style={[s.totalLabel, { color: theme.textMuted }]}>{t('missions.quote_total')}</Text>
        <View style={s.totalAmountRow}>
          <ReText animatedProps={totalCounter.animatedProps} style={[s.totalInt, { color: theme.text }]} accessibilityLabel={fmtEur(totalCents)} />
          <Text style={[s.totalDec, { color: theme.textSub }]}>{totalDec}</Text>
        </View>
        {calloutFee > 0 && (
          <View style={s.calloutNote}>
            <View style={[s.calloutDot, { backgroundColor: COLORS.green }]} />
            <Text style={[s.calloutText, { color: theme.textSub }]}>
              {t('quote.send_quote_callout_paid', { fee: fmtEur(calloutFee) })}
            </Text>
          </View>
        )}
      </Animated.View>
    </>
  );

  const cta = (
    <PressScale accessibilityRole="button"
      testID="quote-send"
      style={[
        s.ctaBtn,
        { backgroundColor: theme.accent },
        (!canSend || sending) && { backgroundColor: theme.surface },
      ]}
      onPress={handleSend}
      disabled={!canSend || sending}
    >
      {sending ? (
        <ActivityIndicator size="small" color={theme.accentText} />
      ) : (
        <>
          <View style={s.ctaContent}>
            <Text style={[
              s.ctaText,
              { color: canSend ? theme.accentText : theme.textMuted },
            ]}>
              {t('quote.send_quote_cta')}
            </Text>
            <Text style={[
              s.ctaSub,
              { color: canSend ? theme.accentText : theme.textMuted },
            ]}>
              {canSend ? t('quote.send_quote_amount_to_invoice', { amount: fmtEur(totalCents) }) : t('quote.send_quote_cta_disabled')}
            </Text>
          </View>
          <Feather name="arrow-right" size={18} color={canSend ? theme.accentText : theme.textMuted} />
        </>
      )}
    </PressScale>
  );

  // Déplié : deux pages. Gauche = en-tête (retour + titre, à gauche) et la
  // demande du client ; droite = le devis, l'envoi épinglé en bas de page.
  if (isRegular) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <BookSpread
          left={(
            <SafeAreaView edges={["top", "bottom"]} style={s.root}>
              <View style={[s.header, s.headerPage]}>
                {backBtn}
                {title}
              </View>
              <ScrollView contentContainerStyle={s.pageScroll} showsVerticalScrollIndicator={false}>
                {brief ? (
                  <>
                    <MissionTitle brief={brief} big />
                    <View style={s.recapFacts}><MissionFacts brief={brief} /></View>
                  </>
                ) : null}
              </ScrollView>
            </SafeAreaView>
          )}
          right={(
            <KeyboardAvoidingView style={s.root} behavior="padding">
              <SafeAreaView edges={["top"]} style={s.root}>
                <ScrollView
                  style={s.root}
                  contentContainerStyle={s.pageScroll}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {fields}
                </ScrollView>
              </SafeAreaView>
              <SafeAreaView edges={["bottom"]} style={[s.footer, s.footerPage, { backgroundColor: theme.bg }]}>
                {cta}
              </SafeAreaView>
            </KeyboardAvoidingView>
          )}
        />
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
        <View style={s.header}>
          {backBtn}
          {title}
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {fields}

          <View style={{ height: 24 }} />
        </ScrollView>

      {/* Footer CTA */}
      <SafeAreaView edges={["bottom"]} style={[s.footer, { backgroundColor: theme.bg }]}>
        {cta}
      </SafeAreaView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  centerFill: { justifyContent: "center", alignItems: "center", gap: 14, paddingHorizontal: 32 },
  errorText: { fontFamily: FONTS.sans, fontSize: 14, textAlign: "center" },
  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 100, paddingHorizontal: 20, paddingVertical: 12,
  },
  retryText: { fontFamily: FONTS.sansMedium, fontSize: 14 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 22,
    letterSpacing: 2.5,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },
  // Déplié : 20 pt de marge dans chaque page, titre aligné à gauche.
  headerPage: { justifyContent: "flex-start", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  pageScroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  recapFacts: { marginTop: 16 },
  footerPage: { paddingHorizontal: 20 },

  field: { marginBottom: 4 },
  sectionLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1.4, textTransform: "uppercase",
    marginBottom: 6, marginTop: 16,
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  inputAmount: { flex: 1, fontFamily: FONTS.sansLight, fontSize: 24, letterSpacing: 0.5 },
  inputUnit: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20 },

  notesInput: {
    borderRadius: 10, borderWidth: 1, padding: 12, minHeight: 72,
    fontFamily: FONTS.sans, fontSize: 14, lineHeight: 19,
  },

  totalBlock: {
    marginTop: 18, padding: 16, borderRadius: 18, borderWidth: 1, alignItems: "center",
  },
  totalLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6,
  },
  totalAmountRow: { flexDirection: "row", alignItems: "baseline" },
  totalInt: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 40, lineHeight: 44 },
  totalDec: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, marginLeft: 2 },
  calloutNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  calloutDot: { width: 6, height: 6, borderRadius: 3 },
  calloutText: { fontFamily: FONTS.sans, fontSize: 12 },

  footer: { paddingHorizontal: 16, paddingTop: 10 },
  ctaBtn: { borderRadius: 100, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaContent: { alignItems: "center", gap: 2 },
  ctaText: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 20, letterSpacing: 2 },
  ctaSub: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1, textTransform: "uppercase", opacity: 0.6,
  },
});
