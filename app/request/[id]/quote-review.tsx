// app/request/[id]/quote-review.tsx — Revue de devis (dark premium design)
import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { FONTS } from "@/hooks/use-app-theme";
import { devError } from "@/lib/logger";
import { useAuth } from "@/lib/auth/AuthContext";

const C = {
  bg: "#0A0A0A",
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  green: "#3D8B3D",
  red: "#E53935",
  outlineText: "rgba(255,255,255,0.3)",
};

const fmtEur = (cents: number) => (cents / 100).toFixed(2);

export default function QuoteReview() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [showRefuseInput, setShowRefuseInput] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        // Guard: fetch request to verify ownership and status
        const reqRes: any = await api.requests.get(String(id));
        const request = reqRes?.data || reqRes;
        if (!request || request.clientId !== user?.id) {
          Alert.alert("Accès refusé", "Vous n'êtes pas autorisé à voir ce devis.");
          router.replace("/(tabs)/documents");
          return;
        }
        const allowed = ["QUOTE_SENT", "QUOTE_ACCEPTED", "QUOTE_REFUSED", "QUOTE_EXPIRED"].includes(
          request.status?.toUpperCase()
        );
        if (!allowed) {
          router.replace("/(tabs)/documents");
          return;
        }

        const res: any = await api.get(`/quotes/request/${id}`);
        const latest = res?.quotes?.[0];
        if (latest) setQuote(latest);
      } catch (e) {
        devError("Quote fetch error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user?.id]);

  const handleAccept = async () => {
    if (!quote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAccepting(true);
    try {
      const res: any = await api.post(`/quotes/${quote.id}/accept`);

      if (res.paymentIntent) {
        // Paiement du reste nécessaire
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "Fixed",
          paymentIntentClientSecret: res.paymentIntent.clientSecret,
          applePay: { merchantCountryCode: "BE" },
          googlePay: { merchantCountryCode: "BE", testEnv: false },
        });

        if (initError) {
          devError("Payment init error:", initError);
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== "Canceled") devError("Payment error:", presentError.message);
          return;
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: "/request/[id]/missionview",
        params: {
          id: String(id),
          serviceName: "",
          address: "",
          price: String(quote.totalAmount / 100),
          scheduledLabel: "",
        },
      });
    } catch (e: any) {
      devError("Accept quote error:", e);
      Alert.alert("Erreur", e?.message || "Impossible d'accepter le devis");
    } finally {
      setAccepting(false);
    }
  };

  const handleRefuse = async () => {
    if (!quote) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRefusing(true);
    try {
      await api.post(`/quotes/${quote.id}/refuse`, { reason: refuseReason || undefined });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      devError("Refuse quote error:", e);
      Alert.alert("Erreur", e?.message || "Impossible de refuser le devis");
    } finally {
      setRefusing(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator size="large" color={C.white} />
      </View>
    );
  }

  if (!quote) {
    return (
      <View style={[s.root, s.center]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="document-text-outline" size={48} color={C.grey} />
        <Text style={s.emptyText}>Aucun devis reçu pour le moment</Text>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const expired = new Date() > new Date(quote.validUntil);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>DEVIS</Text>
        <View style={{ width: 20 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Status badge */}
        <View style={[s.statusBadge, expired && { backgroundColor: "rgba(229,57,53,0.1)" }]}>
          <Ionicons
            name={expired ? "time-outline" : "document-text-outline"}
            size={14}
            color={expired ? C.red : C.green}
          />
          <Text style={[s.statusText, expired && { color: C.red }]}>
            {expired ? "Devis expiré" : "En attente de votre réponse"}
          </Text>
        </View>

        {/* Breakdown card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Détail du devis</Text>

          <View style={s.line}>
            <Text style={s.lineLabel}>Main d'œuvre</Text>
            <Text style={s.lineValue}>{fmtEur(quote.laborAmount)} €</Text>
          </View>

          {quote.partsAmount > 0 && (
            <View style={s.line}>
              <View style={{ flex: 1 }}>
                <Text style={s.lineLabel}>Pièces / Matériel</Text>
                {quote.partsDetail && (
                  <Text style={s.lineDetail}>{quote.partsDetail}</Text>
                )}
              </View>
              <Text style={s.lineValue}>{fmtEur(quote.partsAmount)} €</Text>
            </View>
          )}

          <View style={s.sep} />

          <View style={s.line}>
            <Text style={s.totalLabel}>Total</Text>
            <Text style={s.totalValue}>{fmtEur(quote.totalAmount)} €</Text>
          </View>

          {quote.calloutPaid > 0 && (
            <View style={s.line}>
              <Text style={[s.lineLabel, { color: C.green }]}>Acompte déjà payé</Text>
              <Text style={[s.lineValue, { color: C.green }]}>-{fmtEur(quote.calloutPaid)} €</Text>
            </View>
          )}

          <View style={s.sep} />

          <View style={s.line}>
            <Text style={s.totalLabel}>Reste à payer</Text>
            <Text style={[s.totalValue, { fontSize: 22 }]}>{fmtEur(quote.remainingAmount)} €</Text>
          </View>
        </View>

        {/* Notes du provider */}
        {quote.notes && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Notes du prestataire</Text>
            <Text style={s.notesText}>{quote.notes}</Text>
          </View>
        )}

        {/* Validity */}
        <View style={s.validityRow}>
          <Ionicons name="time-outline" size={13} color={C.grey} />
          <Text style={s.validityText}>
            Valable jusqu'au {new Date(quote.validUntil).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
            })}
          </Text>
        </View>

        {/* Refuse reason input */}
        {showRefuseInput && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Raison du refus (optionnel)</Text>
            <TextInput
              style={s.refuseInput}
              placeholder="Expliquez pourquoi..."
              placeholderTextColor="rgba(255,255,255,0.2)"
              value={refuseReason}
              onChangeText={setRefuseReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={s.refuseBtns}>
              <TouchableOpacity
                style={s.refuseCancelBtn}
                onPress={() => setShowRefuseInput(false)}
              >
                <Text style={s.refuseCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.refuseConfirmBtn, refusing && { opacity: 0.5 }]}
                onPress={handleRefuse}
                disabled={refusing}
              >
                {refusing
                  ? <ActivityIndicator size="small" color={C.white} />
                  : <Text style={s.refuseConfirmText}>Confirmer le refus</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Actions footer */}
      {!expired && quote.status === "SENT" && !showRefuseInput && (
        <View style={s.footer}>
          <TouchableOpacity
            style={s.refuseBtn}
            onPress={() => setShowRefuseInput(true)}
            activeOpacity={0.7}
          >
            <Text style={s.refuseBtnText}>Refuser</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.acceptBtn, accepting && { opacity: 0.55 }]}
            onPress={handleAccept}
            disabled={accepting}
            activeOpacity={0.9}
          >
            {accepting ? (
              <ActivityIndicator size="small" color={C.bg} />
            ) : (
              <>
                <Text style={s.acceptBtnText}>ACCEPTER</Text>
                <Text style={s.acceptBtnPrice}>{fmtEur(quote.remainingAmount)} €</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: "center", alignItems: "center", gap: 16 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: Platform.OS === "ios" ? 60 : 40, paddingBottom: 16,
  },
  headerTitle: { fontFamily: FONTS.bebas, fontSize: 20, color: C.white, letterSpacing: 2 },

  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },

  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    alignSelf: "flex-start",
    backgroundColor: "rgba(61,139,61,0.1)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  statusText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: C.green },

  card: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 20, gap: 14,
  },
  cardTitle: {
    fontFamily: FONTS.sansMedium, fontSize: 12, color: C.grey,
    textTransform: "uppercase", letterSpacing: 1, marginBottom: 2,
  },

  line: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  lineLabel: { fontFamily: FONTS.sans, fontSize: 15, color: C.grey },
  lineValue: { fontFamily: FONTS.mono, fontSize: 15, color: C.white },
  lineDetail: { fontFamily: FONTS.sans, fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 },

  sep: { height: 1, backgroundColor: C.border },

  totalLabel: { fontFamily: FONTS.sansMedium, fontSize: 15, color: C.white },
  totalValue: { fontFamily: FONTS.bebas, fontSize: 18, color: C.white, letterSpacing: 0.5 },

  notesText: { fontFamily: FONTS.sansLight, fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 21 },

  validityRow: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "center",
  },
  validityText: { fontFamily: FONTS.sans, fontSize: 12, color: C.grey },

  emptyText: { fontFamily: FONTS.sans, fontSize: 15, color: C.grey },
  backBtn: { paddingHorizontal: 20, paddingVertical: 10 },
  backBtnText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.white, textDecorationLine: "underline" },

  refuseInput: {
    backgroundColor: "#111111", borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 14, minHeight: 80,
    fontFamily: FONTS.sans, fontSize: 14, color: C.white,
  },
  refuseBtns: { flexDirection: "row", gap: 10 },
  refuseCancelBtn: {
    flex: 1, height: 44, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  refuseCancelText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.grey },
  refuseConfirmBtn: {
    flex: 1, height: 44, borderRadius: 12,
    backgroundColor: C.red,
    alignItems: "center", justifyContent: "center",
  },
  refuseConfirmText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: C.white },

  footer: {
    flexDirection: "row", gap: 10,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 12,
  },
  refuseBtn: {
    height: 60, paddingHorizontal: 20,
    borderRadius: 18, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center",
  },
  refuseBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: C.grey },
  acceptBtn: {
    flex: 1, height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  acceptBtnText: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg },
  acceptBtnPrice: { fontFamily: FONTS.mono, fontSize: 15, color: C.bg },
});
