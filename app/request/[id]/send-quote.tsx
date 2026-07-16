// app/request/[id]/send-quote.tsx — Provider envoie un devis (adaptive dark/light)
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { devError } from "@/lib/logger";
import { formatEURCents as fmtEur } from "@/lib/format";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/AuthContext";

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

  // Guard ownership + statut au mount, et gestion de l'erreur du fetch initial.
  const loadRequest = useCallback(async () => {
    if (!id || !user?.id) return;
    setChecking(true);
    setLoadError(false);
    try {
      const res: any = await api.get(`/requests/${id}`);
      const data = res?.data || res;
      if (!data) { setLoadError(true); return; }

      const st = (data.status || "").toUpperCase();
      // Ownership : la demande doit être assignée à ce prestataire.
      if (data.providerId && data.providerId !== user.id) {
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
    } catch (e) {
      devError("SendQuote load error:", e);
      setLoadError(true);
    } finally {
      setChecking(false);
    }
  }, [id, user?.id, router]);

  useEffect(() => { loadRequest(); }, [loadRequest]);

  const laborCents = Math.round(parseAmount(labor) * 100);
  const partsCents = Math.round(parseAmount(parts) * 100);
  const totalCents = laborCents + partsCents;
  const canSend = laborCents > 0;

  // Animated total
  const totalAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(totalAnim, {
      toValue: totalCents > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 80,
      friction: 10,
    }).start();
  }, [totalCents > 0]);

  // Split total for display: integer + decimals
  const totalParts = (totalCents / 100).toFixed(2).split(".");
  const totalInt = parseInt(totalParts[0]).toLocaleString("fr-BE");
  const totalDec = `,${totalParts[1]} €`;

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
      router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      devError("Send quote error:", e);
      feedback.error(e?.message || t('common.error'));
    } finally {
      setSending(false);
    }
  }, [canSend, id, laborCents, partsCents, notes, router]);

  // Vérification en cours (guard ownership/statut) → loader plein écran.
  if (checking) {
    return (
      <View style={[s.root, s.centerFill, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
        <ActivityIndicator size="large" color={theme.accent} />
      </View>
    );
  }

  // Erreur du fetch initial → état dédié avec bouton réessayer.
  if (loadError) {
    return (
      <View style={[s.root, s.centerFill, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />
        <Feather name="alert-circle" size={40} color={theme.textMuted} />
        <Text style={[s.errorText, { color: theme.textSub }]}>Impossible de charger cette demande.</Text>
        <TouchableOpacity
          style={[s.retryBtn, { backgroundColor: theme.accent }]}
          onPress={loadRequest}
          activeOpacity={0.85}
        >
          <Feather name="refresh-cw" size={16} color={theme.accentText} />
          <Text style={[s.retryText, { color: theme.accentText }]}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
        <View style={s.header}>
          <TouchableOpacity
            style={[s.headerBack, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
            activeOpacity={0.75}
          >
            <Feather name="arrow-left" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>{t('quote.send_quote_title')}</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
          <Animated.View style={[
            s.totalBlock,
            { backgroundColor: theme.surface, borderColor: theme.border },
            {
              opacity: totalAnim,
              transform: [{
                translateY: totalAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              }],
            },
          ]}>
            <Text style={[s.totalLabel, { color: theme.textMuted }]}>{t('missions.quote_total')}</Text>
            <View style={s.totalAmountRow}>
              <Text style={[s.totalInt, { color: theme.text }]}>{totalInt}</Text>
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

          <View style={{ height: 24 }} />
        </ScrollView>

      {/* Footer CTA */}
      <SafeAreaView edges={["bottom"]} style={[s.footer, { backgroundColor: theme.bg }]}>
        <TouchableOpacity
          style={[
            s.ctaBtn,
            { backgroundColor: theme.accent },
            (!canSend || sending) && { backgroundColor: theme.surface },
          ]}
          onPress={handleSend}
          disabled={!canSend || sending}
          activeOpacity={0.88}
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
        </TouchableOpacity>
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
    fontFamily: FONTS.bebas,
    fontSize: 22,
    letterSpacing: 2.5,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 4 },

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
  inputUnit: { fontFamily: FONTS.bebas, fontSize: 20 },

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
  totalInt: { fontFamily: FONTS.bebas, fontSize: 40, lineHeight: 44 },
  totalDec: { fontFamily: FONTS.bebas, fontSize: 22, marginLeft: 2 },
  calloutNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10 },
  calloutDot: { width: 6, height: 6, borderRadius: 3 },
  calloutText: { fontFamily: FONTS.sans, fontSize: 12 },

  footer: { paddingHorizontal: 16, paddingTop: 10 },
  ctaBtn: { borderRadius: 100, paddingVertical: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  ctaContent: { alignItems: "center", gap: 2 },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 2 },
  ctaSub: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1, textTransform: "uppercase", opacity: 0.6,
  },
});
