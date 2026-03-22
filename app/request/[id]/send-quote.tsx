// app/request/[id]/send-quote.tsx — Provider envoie un devis (dark premium design)
import React, { useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { FONTS } from "@/hooks/use-app-theme";
import { devError } from "@/lib/logger";

const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  inputBg: "#111111",
  green: "#3D8B3D",
  outlineText: "rgba(255,255,255,0.3)",
};

const fmtEur = (cents: number) => (cents / 100).toFixed(2);

export default function SendQuote() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [labor, setLabor] = useState("");
  const [parts, setParts] = useState("");
  const [partsDetail, setPartsDetail] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState<string | null>(null);

  const laborCents = Math.round((parseFloat(labor) || 0) * 100);
  const partsCents = Math.round((parseFloat(parts) || 0) * 100);
  const totalCents = laborCents + partsCents;
  const canSend = laborCents > 0;

  const handleSend = async () => {
    if (!canSend || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSending(true);
    try {
      await api.post(`/quotes/${id}`, {
        laborAmount: laborCents,
        partsAmount: partsCents,
        partsDetail: partsDetail || undefined,
        notes: notes || undefined,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Devis envoyé", "Le client recevra une notification.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      devError("Send quote error:", e);
      Alert.alert("Erreur", e?.message || "Impossible d'envoyer le devis");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>ENVOYER UN DEVIS</Text>
        <View style={{ width: 20 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Main d'oeuvre */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>MAIN D'ŒUVRE</Text>
            <View style={[s.inputRow, focused === "labor" && s.inputFocused]}>
              <TextInput
                style={s.inputAmount}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="decimal-pad"
                value={labor}
                onChangeText={setLabor}
                onFocus={() => setFocused("labor")}
                onBlur={() => setFocused(null)}
              />
              <Text style={s.inputUnit}>€</Text>
            </View>
          </View>

          {/* Pièces / Matériel */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>PIÈCES / MATÉRIEL</Text>
            <View style={[s.inputRow, focused === "parts" && s.inputFocused]}>
              <TextInput
                style={s.inputAmount}
                placeholder="0.00"
                placeholderTextColor="rgba(255,255,255,0.2)"
                keyboardType="decimal-pad"
                value={parts}
                onChangeText={setParts}
                onFocus={() => setFocused("parts")}
                onBlur={() => setFocused(null)}
              />
              <Text style={s.inputUnit}>€</Text>
            </View>
            {partsCents > 0 && (
              <TextInput
                style={[s.textArea, focused === "partsDetail" && s.inputFocused]}
                placeholder="Détail des pièces (ex: vanne thermostatique, joint...)"
                placeholderTextColor="rgba(255,255,255,0.15)"
                value={partsDetail}
                onChangeText={setPartsDetail}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
                onFocus={() => setFocused("partsDetail")}
                onBlur={() => setFocused(null)}
              />
            )}
          </View>

          {/* Notes */}
          <View style={s.field}>
            <Text style={s.fieldLabel}>NOTES POUR LE CLIENT</Text>
            <TextInput
              style={[s.textArea, focused === "notes" && s.inputFocused]}
              placeholder="Diagnostic, durée estimée, remarques..."
              placeholderTextColor="rgba(255,255,255,0.15)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              onFocus={() => setFocused("notes")}
              onBlur={() => setFocused(null)}
            />
          </View>

          {/* Total preview */}
          {totalCents > 0 && (
            <View style={s.totalCard}>
              <View style={s.totalLine}>
                <Text style={s.totalLineLabel}>Main d'œuvre</Text>
                <Text style={s.totalLineVal}>{fmtEur(laborCents)} €</Text>
              </View>
              {partsCents > 0 && (
                <View style={s.totalLine}>
                  <Text style={s.totalLineLabel}>Pièces / Matériel</Text>
                  <Text style={s.totalLineVal}>{fmtEur(partsCents)} €</Text>
                </View>
              )}
              <View style={s.totalSep} />
              <View style={s.totalLine}>
                <Text style={s.totalTotalLabel}>Total devis</Text>
                <Text style={s.totalTotalVal}>{fmtEur(totalCents)} €</Text>
              </View>
              <Text style={s.totalHint}>
                L'acompte du client sera déduit automatiquement.
              </Text>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Footer CTA */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.sendBtn, (!canSend || sending) && { opacity: 0.45 }]}
          onPress={handleSend}
          disabled={!canSend || sending}
          activeOpacity={0.9}
        >
          {sending ? (
            <ActivityIndicator size="small" color={C.bg} />
          ) : (
            <>
              <Text style={s.sendBtnText}>ENVOYER LE DEVIS</Text>
              {totalCents > 0 && <Text style={s.sendBtnPrice}>{fmtEur(totalCents)} €</Text>}
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 16,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 20, color: C.white, letterSpacing: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 12, gap: 20 },

  field: { gap: 8 },
  fieldLabel: {
    fontFamily: FONTS.sans, fontSize: 10, letterSpacing: 3,
    textTransform: "uppercase", color: C.outlineText, paddingLeft: 2,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, height: 56, paddingHorizontal: 18,
  },
  inputFocused: { borderColor: "rgba(255,255,255,0.25)", backgroundColor: "#161616" },
  inputAmount: {
    flex: 1, fontFamily: FONTS.bebas, fontSize: 28, color: C.white,
    letterSpacing: 1,
  },
  inputUnit: { fontFamily: FONTS.sansMedium, fontSize: 18, color: C.grey },
  textArea: {
    backgroundColor: C.inputBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16, minHeight: 60,
    fontFamily: FONTS.sans, fontSize: 14, color: C.white, lineHeight: 20,
  },

  totalCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 20, gap: 10,
  },
  totalLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLineLabel: { fontFamily: FONTS.sans, fontSize: 14, color: C.grey },
  totalLineVal: { fontFamily: FONTS.mono, fontSize: 14, color: C.white },
  totalSep: { height: 1, backgroundColor: C.border },
  totalTotalLabel: { fontFamily: FONTS.sansMedium, fontSize: 16, color: C.white },
  totalTotalVal: { fontFamily: FONTS.bebas, fontSize: 24, color: C.white, letterSpacing: 0.5 },
  totalHint: { fontFamily: FONTS.sansLight, fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 2 },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 8,
  },
  sendBtn: {
    height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  sendBtnText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg },
  sendBtnPrice: { fontFamily: FONTS.mono, fontSize: 15, color: C.bg },
});
