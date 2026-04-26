// app/request/[id]/quote-review.tsx — Client revue de devis (adaptive dark/light)
import React, { useEffect, useState, useRef } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput,
  Animated, Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { PulseDot } from '@/components/ui/PulseDot';
import { devError } from "@/lib/logger";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatEURCents as fmtEur } from "@/lib/format";

export default function QuoteReview() {
  const router = useRouter();
  const theme = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [accepting, setAccepting] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [showRefuseInput, setShowRefuseInput] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");

  // Entry animation
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
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
      const res: any = await api.quotes.accept(quote.id);

      if (res.paymentIntent) {
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "Fixed",
          paymentIntentClientSecret: res.paymentIntent.clientSecret,
          applePay: { merchantCountryCode: "BE" },
          googlePay: { merchantCountryCode: "BE", testEnv: false },
          paymentMethodOrder: ['apple_pay', 'card', 'klarna', 'revolut_pay'],
        });

        if (initError) {
          devError("Payment init error:", initError);
          Alert.alert("Erreur", "Impossible d'initialiser le paiement. Réessayez.");
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== "Canceled") {
            devError("Payment error:", presentError.message);
            Alert.alert("Erreur", "Le paiement a échoué. Réessayez.");
          }
          // Payment cancelled or failed — status NOT changed on backend, safe to return
          return;
        }

        // Payment succeeded → confirm on backend to transition status to ONGOING
        const quoteId = res.paymentIntent.quoteId || quote.id;
        await api.quotes.confirmPayment(quoteId);
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

  // Loading
  if (loading) {
    return (
      <View style={[s.root, s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.textSub} />
      </View>
    );
  }

  // Empty
  if (!quote) {
    return (
      <View style={[s.root, s.center, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="file-text" size={48} color={theme.textMuted} />
        <Text style={[s.emptyText, { color: theme.textSub }]}>Aucun devis reçu pour le moment</Text>
        <TouchableOpacity style={s.emptyBack} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}>
          <Text style={[s.emptyBackText, { color: theme.text }]}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const expired = new Date() > new Date(quote.validUntil);
  const canAct = !expired && quote.status === "SENT" && !showRefuseInput;

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} backgroundColor={theme.bg} />

      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
        <View style={s.header}>
          <TouchableOpacity
            style={[s.headerBack, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
            activeOpacity={0.75}
          >
            <Feather name="chevron-left" size={18} color={theme.text} />
          </TouchableOpacity>
          <Text style={[s.headerTitle, { color: theme.text }]}>DEVIS</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

          {/* Status badge */}
          <View style={[
            s.badge,
            { backgroundColor: theme.surface, borderColor: theme.border },
            expired && { backgroundColor: COLORS.red + "18" },
          ]}>
            <PulseDot size={7} color={expired ? COLORS.red : undefined} />
            <Text style={[
              s.badgeText,
              { color: expired ? COLORS.red : theme.textSub },
            ]}>
              {expired ? "Devis expiré" : "En attente de votre réponse"}
            </Text>
          </View>

          {/* Quote detail card */}
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardTitle, { color: theme.textMuted }]}>Détail du devis</Text>

            {/* Labor */}
            <View style={s.row}>
              <Text style={[s.rowLabel, { color: theme.textSub }]}>{"Main d'œuvre"}</Text>
              <Text style={[s.rowValue, { color: theme.text }]}>{fmtEur(quote.laborAmount)}</Text>
            </View>

            {/* Parts */}
            {quote.partsAmount > 0 && (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: theme.textSub }]}>Pièces / Matériel</Text>
                  {quote.partsDetail ? (
                    <Text style={[s.rowDetail, { color: theme.textMuted }]}>{quote.partsDetail}</Text>
                  ) : null}
                </View>
                <Text style={[s.rowValue, { color: theme.text }]}>{fmtEur(quote.partsAmount)}</Text>
              </View>
            )}

            {/* Divider */}
            <View style={[s.divider, { backgroundColor: theme.border }]} />

            {/* Total */}
            <View style={s.row}>
              <Text style={[s.rowTotalLabel, { color: theme.text }]}>Total</Text>
              <Text style={[s.rowTotalValue, { color: theme.text }]}>{fmtEur(quote.totalAmount)}</Text>
            </View>

            {/* Callout credit */}
            {quote.calloutPaid > 0 && (
              <View style={s.row}>
                <Text style={[s.rowLabel, { color: COLORS.green }]}>Acompte déjà payé</Text>
                <Text style={[s.rowValue, { color: COLORS.green }]}>− {fmtEur(quote.calloutPaid)}</Text>
              </View>
            )}

            {/* Strong divider */}
            <View style={[s.dividerStrong, { backgroundColor: theme.borderLight }]} />

            {/* Remaining */}
            <View style={s.row}>
              <Text style={[s.rowFinalLabel, { color: theme.text }]}>Reste à payer</Text>
              <Text style={[s.rowFinalValue, { color: theme.text }]}>{fmtEur(quote.remainingAmount)}</Text>
            </View>
          </View>

          {/* Notes */}
          {quote.notes ? (
            <View style={[s.notesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.cardTitle, { color: theme.textMuted }]}>Notes du prestataire</Text>
              <Text style={[s.notesText, { color: theme.textSub }]}>{quote.notes}</Text>
            </View>
          ) : null}

          {/* Expiry */}
          <View style={s.expiryRow}>
            <Feather name="clock" size={13} color={theme.textMuted} />
            <Text style={[s.expiryText, { color: theme.textMuted }]}>
              {"Valable jusqu'au "}{new Date(quote.validUntil).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
              })}
            </Text>
          </View>

          {/* Refuse reason input */}
          {showRefuseInput && (
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.cardTitle, { color: theme.textMuted }]}>Raison du refus (optionnel)</Text>
              <TextInput
                style={[s.refuseInput, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
                placeholder="Expliquez pourquoi..."
                placeholderTextColor={theme.textMuted}
                value={refuseReason}
                onChangeText={setRefuseReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <View style={s.refuseBtns}>
                <TouchableOpacity
                  style={[s.refuseCancelBtn, { borderColor: theme.border }]}
                  onPress={() => setShowRefuseInput(false)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.refuseCancelText, { color: theme.textSub }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.refuseConfirmBtn, refusing && { opacity: 0.5 }]}
                  onPress={handleRefuse}
                  disabled={refusing}
                  activeOpacity={0.75}
                >
                  {refusing ? (
                    <ActivityIndicator size="small" color={COLORS.alwaysWhite} />
                  ) : (
                    <Text style={s.refuseConfirmText}>Confirmer le refus</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Actions footer */}
      {canAct && (
        <SafeAreaView edges={["bottom"]} style={[s.footer, { backgroundColor: theme.bg }]}>
          <View style={s.footerRow}>
            <TouchableOpacity
              style={[s.refuseBtn, { borderColor: theme.border }]}
              onPress={() => setShowRefuseInput(true)}
              activeOpacity={0.75}
            >
              <Text style={[s.refuseBtnText, { color: theme.textSub }]}>Refuser</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.acceptBtn, { backgroundColor: theme.accent }, accepting && { opacity: 0.55 }]}
              onPress={handleAccept}
              disabled={accepting}
              activeOpacity={0.88}
            >
              {accepting ? (
                <ActivityIndicator size="small" color={theme.accentText} />
              ) : (
                <>
                  <Text style={[s.acceptBtnText, { color: theme.accentText }]}>ACCEPTER</Text>
                  <Text style={[s.acceptBtnPrice, { color: theme.accentText }]}>
                    {fmtEur(quote.remainingAmount)}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", gap: 16 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bebas,
    fontSize: 22,
    letterSpacing: 2.5,
  },

  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },

  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    marginBottom: 4,
  },
  badgeText: { fontFamily: FONTS.sansMedium, fontSize: 12, letterSpacing: 0.5 },

  card: { borderRadius: 14, borderWidth: 1, padding: 14 },
  cardTitle: {
    fontFamily: FONTS.sansMedium, fontSize: 10,
    letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 10,
  },

  row: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "baseline", paddingVertical: 7,
  },
  rowLabel: { fontFamily: FONTS.sans, fontSize: 14 },
  rowValue: { fontFamily: FONTS.sansMedium, fontSize: 14, letterSpacing: 0.5 },
  rowDetail: { fontFamily: FONTS.sans, fontSize: 12, marginTop: 2 },

  divider: { height: 1, marginVertical: 2 },
  dividerStrong: { height: 1, marginVertical: 2 },

  rowTotalLabel: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  rowTotalValue: { fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 1 },

  rowFinalLabel: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  rowFinalValue: { fontFamily: FONTS.bebas, fontSize: 28, letterSpacing: 1 },

  notesCard: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
  notesText: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19 },

  expiryRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginTop: 2,
  },
  expiryText: { fontFamily: FONTS.sans, fontSize: 12 },

  emptyText: { fontFamily: FONTS.sans, fontSize: 14 },
  emptyBack: { paddingHorizontal: 16, paddingVertical: 8 },
  emptyBackText: { fontFamily: FONTS.sansMedium, fontSize: 13, textDecorationLine: "underline" },

  refuseInput: {
    borderRadius: 12, borderWidth: 1, padding: 12, minHeight: 72,
    fontFamily: FONTS.sans, fontSize: 13,
  },
  refuseBtns: { flexDirection: "row", gap: 8, marginTop: 10 },
  refuseCancelBtn: {
    flex: 1, height: 42, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  refuseCancelText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  refuseConfirmBtn: {
    flex: 1, height: 42, borderRadius: 12, backgroundColor: COLORS.red,
    alignItems: "center", justifyContent: "center",
  },
  refuseConfirmText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: COLORS.alwaysWhite },

  footer: { paddingHorizontal: 16, paddingTop: 10 },
  footerRow: { flexDirection: "row", gap: 8 },
  refuseBtn: {
    height: 50, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  refuseBtnText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
  acceptBtn: {
    flex: 1, height: 50, borderRadius: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  acceptBtnText: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 2 },
  acceptBtnPrice: { fontFamily: FONTS.sansMedium, fontSize: 13, opacity: 0.6 },
});
