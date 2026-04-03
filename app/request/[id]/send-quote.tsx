// app/request/[id]/send-quote.tsx — Provider envoie un devis (adaptive dark/light)
import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView, Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { devError } from "@/lib/logger";

const fmtEur = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SendQuote() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [labor, setLabor] = useState("");
  const [parts, setParts] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);
  const [calloutFee, setCalloutFee] = useState(0);

  // Fetch callout fee from request
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res: any = await api.get(`/requests/${id}`);
        const data = res?.data || res;
        if (data?.calloutFee) setCalloutFee(data.calloutFee);
      } catch { /* ignore */ }
    })();
  }, [id]);

  const laborCents = Math.round((parseFloat(labor) || 0) * 100);
  const partsCents = Math.round((parseFloat(parts) || 0) * 100);
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      await api.post(`/quotes/${id}`, {
        laborAmount: laborCents,
        partsAmount: partsCents,
        notes: notes || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Devis envoyé",
        "Le client va examiner votre devis. Vous serez notifié de sa réponse.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e: any) {
      devError("Send quote error:", e);
      Alert.alert("Erreur", e?.message || "Impossible d'envoyer le devis");
    } finally {
      setSending(false);
    }
  }, [canSend, id, laborCents, partsCents, notes, router]);

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
        <View style={s.header}>
          <TouchableOpacity
            style={[s.headerBack, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => router.back()}
            activeOpacity={0.75}
          >
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>ENVOYER UN DEVIS</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Main d'oeuvre */}
          <View style={s.field}>
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>{"Main d'œuvre"}</Text>
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
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Pièces / Matériel</Text>
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
            <Text style={[s.sectionLabel, { color: theme.textMuted }]}>Notes pour le client</Text>
            <TextInput
              style={[
                s.notesInput,
                { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text },
                focused === "notes" && { borderColor: theme.borderLight },
              ]}
              placeholder="Diagnostic, durée estimée, remarques…"
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
            <Text style={[s.totalLabel, { color: theme.textMuted }]}>Total du devis</Text>
            <View style={s.totalAmountRow}>
              <Text style={[s.totalInt, { color: theme.text }]}>{totalInt}</Text>
              <Text style={[s.totalDec, { color: theme.textSub }]}>{totalDec}</Text>
            </View>
            {calloutFee > 0 && (
              <View style={s.calloutNote}>
                <View style={[s.calloutDot, { backgroundColor: COLORS.green }]} />
                <Text style={[s.calloutText, { color: theme.textSub }]}>
                  Frais de déplacement {fmtEur(calloutFee)} € déjà encaissés
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

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
            <View style={s.ctaContent}>
              <Text style={[
                s.ctaText,
                { color: canSend ? theme.accentText : theme.textMuted },
              ]}>
                ENVOYER LE DEVIS
              </Text>
              <Text style={[
                s.ctaSub,
                { color: canSend ? theme.accentText : theme.textMuted },
              ]}>
                {canSend ? `${fmtEur(totalCents)} € à facturer` : "Saisissez un montant"}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bebas,
    fontSize: 26,
    letterSpacing: 3,
  },

  scroll: { paddingHorizontal: 24, paddingTop: 4 },

  field: { marginBottom: 4 },
  sectionLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 2.5, textTransform: "uppercase",
    marginBottom: 8, marginTop: 24,
  },

  inputWrap: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 20, height: 60,
  },
  inputAmount: { flex: 1, fontFamily: FONTS.sansLight, fontSize: 28, letterSpacing: 0.5 },
  inputUnit: { fontFamily: FONTS.bebas, fontSize: 22 },

  notesInput: {
    borderRadius: 10, borderWidth: 1, padding: 16, minHeight: 80,
    fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20,
  },

  totalBlock: {
    marginTop: 32, padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center",
  },
  totalLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8,
  },
  totalAmountRow: { flexDirection: "row", alignItems: "baseline" },
  totalInt: { fontFamily: FONTS.bebas, fontSize: 48, lineHeight: 52 },
  totalDec: { fontFamily: FONTS.bebas, fontSize: 24, marginLeft: 2 },
  calloutNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  calloutDot: { width: 6, height: 6, borderRadius: 3 },
  calloutText: { fontFamily: FONTS.sans, fontSize: 12 },

  footer: { paddingHorizontal: 24, paddingTop: 16 },
  ctaBtn: { borderRadius: 14, paddingVertical: 18, alignItems: "center" },
  ctaContent: { alignItems: "center", gap: 2 },
  ctaText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 2 },
  ctaSub: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1, textTransform: "uppercase", opacity: 0.6,
  },
});
