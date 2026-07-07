// app/request/[id]/quote-review.tsx — Client revue de devis (adaptive dark/light)
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, ScrollView, ActivityIndicator, TextInput,
  Animated, Easing, KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS } from "@/hooks/use-app-theme";
import { PulseDot } from '@/components/ui/PulseDot';
import { devError } from "@/lib/logger";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSocket } from "@/lib/SocketContext";
import { formatEURCents as fmtEur } from "@/lib/format";
import { useTranslation } from "react-i18next";

export default function QuoteReview() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [requestStatus, setRequestStatus] = useState<string>("");
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

  // Charge la demande + le devis. Réutilisable (mount + rafraîchissement socket).
  // Retourne le statut courant de la demande (ou null si accès refusé/erreur).
  const load = useCallback(async (opts?: { silent?: boolean }): Promise<string | null> => {
    if (!id) return null;
    try {
      const reqRes: any = await api.requests.get(String(id));
      const request = reqRes?.data || reqRes;
      if (!request || request.clientId !== user?.id) {
        if (!opts?.silent) {
          feedback.error(t('quote.access_denied'));
          router.replace("/(tabs)/documents");
        }
        return null;
      }
      const status = (request.status || "").toUpperCase();
      setRequestStatus(status);
      const allowed = ["QUOTE_SENT", "QUOTE_ACCEPTED", "QUOTE_REFUSED", "QUOTE_EXPIRED"].includes(status);
      if (!allowed) {
        if (!opts?.silent) router.replace("/(tabs)/documents");
        return status;
      }

      const res: any = await api.get(`/quotes/request/${id}`);
      const latest = res?.quotes?.[0];
      if (latest) setQuote(latest);
      return status;
    } catch (e) {
      devError("Quote fetch error:", e);
      return null;
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [id, user?.id, router, t]);

  useEffect(() => { load(); }, [load]);

  // Temps réel : un changement de statut (devis accepté/refusé/expiré depuis un
  // autre appareil, expiration cron 72 h…) rafraîchit l'écran pour que le badge et
  // les CTA reflètent l'état COURANT plutôt qu'un état figé au render.
  useEffect(() => {
    if (!socket || !id) return;
    const handler = (data: any) => {
      if (String(data.requestId) !== String(id)) return;
      load({ silent: true });
    };
    socket.on("request:statusUpdated", handler);
    return () => { socket.off("request:statusUpdated", handler); };
  }, [socket, id, load]);

  // Confirme le paiement côté backend avec retry x3 + backoff. Le client a DÉJÀ été
  // débité par Stripe : en cas d'échec réseau, on ne le laisse pas dans un état
  // incohérent — on réessaie, et si ça échoue quand même on ne bloque pas.
  const confirmPaymentWithRetry = useCallback(async (quoteId: number, paymentIntentId: string): Promise<boolean> => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await api.quotes.confirmPayment(quoteId, paymentIntentId);
        return true;
      } catch (e: any) {
        if (e?.status === 401 || e?.status === 403) return false;
        if (attempt < 3) await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }
    return false;
  }, []);

  const handleAccept = async () => {
    if (!quote) return;
    feedback.haptic('medium');
    setAccepting(true);
    try {
      // Re-vérifier l'état COURANT avant d'accepter : le devis a pu expirer / être
      // traité depuis un autre appareil. Évite une erreur générique côté backend.
      const currentStatus = await load({ silent: true });
      if (currentStatus && currentStatus !== "QUOTE_SENT") {
        feedback.info("Ce devis n'est plus disponible.");
        return;
      }

      const res: any = await api.quotes.accept(quote.id);

      if (res.paymentIntent) {
        const { error: initError } = await initPaymentSheet({
          merchantDisplayName: "Fixed",
          paymentIntentClientSecret: res.paymentIntent.clientSecret,
          applePay: { merchantCountryCode: "BE" },
          googlePay: { merchantCountryCode: "BE", testEnv: false },
          paymentMethodOrder: ['card', 'klarna', 'revolut_pay', 'bancontact'],
        });

        if (initError) {
          devError("Payment init error:", initError);
          feedback.error(t('common.retry'));
          return;
        }

        const { error: presentError } = await presentPaymentSheet();
        if (presentError) {
          if (presentError.code !== "Canceled") {
            devError("Payment error:", presentError.message);
            feedback.error(t('common.retry'));
          }
          // Payment cancelled or failed — status NOT changed on backend, safe to return
          return;
        }

        // Payment succeeded → confirm on backend to transition status to ONGOING.
        // Passer le paymentIntentId pour qu'il soit persisté sur le Payment
        // (nécessaire pour un refund admin ultérieur).
        const quoteId = res.paymentIntent.quoteId || quote.id;
        const confirmed = await confirmPaymentWithRetry(quoteId, res.paymentIntent.id);
        if (!confirmed) {
          // Débité mais synchro backend échouée après 3 tentatives : on informe et on
          // laisse quand même passer (le webhook/cron réconciliera le statut).
          feedback.info(t('quote.payment_syncing'));
        }
      }

      feedback.event('quote_accepted');
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
      feedback.error(e?.message || t('common.error'));
    } finally {
      setAccepting(false);
    }
  };

  const handleRefuse = async () => {
    if (!quote) return;
    feedback.haptic('medium');
    setRefusing(true);
    try {
      await api.post(`/quotes/${quote.id}/refuse`, { reason: refuseReason || undefined });
      feedback.haptic('warning');
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      devError("Refuse quote error:", e);
      feedback.error(e?.message || t('common.error'));
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
        <Text style={[s.emptyText, { color: theme.textSub }]}>{t('quote.empty_no_quote_yet')}</Text>
        <TouchableOpacity style={s.emptyBack} onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}>
          <Text style={[s.emptyBackText, { color: theme.text }]}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Badge dérivé du VRAI statut du devis / de la demande (plus de "en attente" affiché
  // sur un devis déjà accepté ou refusé).
  const qStatus = (quote.status || "").toUpperCase();
  const expired = qStatus === "EXPIRED" || requestStatus === "QUOTE_EXPIRED" || new Date() > new Date(quote.validUntil);
  const accepted = qStatus === "ACCEPTED" || requestStatus === "QUOTE_ACCEPTED" || requestStatus === "ONGOING";
  const refused = qStatus === "REFUSED" || requestStatus === "QUOTE_REFUSED";
  const badgeDanger = refused || expired;
  const badgeColor = accepted ? theme.greenText : badgeDanger ? COLORS.red : theme.textSub;
  const badgeLabel = accepted ? t('quote.badge_accepted') : refused ? t('quote.badge_refused') : expired ? t('quote.expired') : t('quote.awaiting_response');
  const canAct = !expired && !accepted && !refused && qStatus === "SENT" && !showRefuseInput;

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
          <Text style={[s.headerTitle, { color: theme.text }]}>{t('quote.short_label').toUpperCase()}</Text>
          <View style={{ width: 36 }} />
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }] }}>

          {/* Status badge */}
          <View style={[
            s.badge,
            { backgroundColor: theme.surface, borderColor: theme.border },
            badgeDanger && { backgroundColor: COLORS.red + "18" },
            accepted && { backgroundColor: 'rgba(21,193,110,0.10)' },
          ]}>
            <PulseDot size={7} color={badgeColor} />
            <Text style={[s.badgeText, { color: badgeColor }]}>
              {badgeLabel}
            </Text>
          </View>

          {/* Quote detail card */}
          <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[s.cardTitle, { color: theme.textMuted }]}>{t('quote.details')}</Text>

            {/* Labor */}
            <View style={s.row}>
              <Text style={[s.rowLabel, { color: theme.textSub }]}>{t('quote.labor')}</Text>
              <Text style={[s.rowValue, { color: theme.text }]}>{fmtEur(quote.laborAmount)}</Text>
            </View>

            {/* Parts */}
            {quote.partsAmount > 0 && (
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: theme.textSub }]}>{t('quote.parts_materials')}</Text>
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
              <Text style={[s.rowTotalLabel, { color: theme.text }]}>{t('ext.invoice_total')}</Text>
              <Text style={[s.rowTotalValue, { color: theme.text }]}>{fmtEur(quote.totalAmount)}</Text>
            </View>

            {/* Callout credit */}
            {quote.calloutPaid > 0 && (
              <View style={s.row}>
                <Text style={[s.rowLabel, { color: theme.greenText }]}>{t('quote.deposit_paid')}</Text>
                <Text style={[s.rowValue, { color: theme.greenText }]}>− {fmtEur(quote.calloutPaid)}</Text>
              </View>
            )}

            {/* Strong divider */}
            <View style={[s.dividerStrong, { backgroundColor: theme.borderLight }]} />

            {/* Remaining */}
            <View style={s.row}>
              <Text style={[s.rowFinalLabel, { color: theme.text }]}>{t('quote.remaining_to_pay')}</Text>
              <Text style={[s.rowFinalValue, { color: theme.text }]}>{fmtEur(quote.remainingAmount)}</Text>
            </View>
          </View>

          {/* Notes */}
          {quote.notes ? (
            <View style={[s.notesCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.cardTitle, { color: theme.textMuted }]}>{t('quote.notes_from_provider')}</Text>
              <Text style={[s.notesText, { color: theme.textSub }]}>{quote.notes}</Text>
            </View>
          ) : null}

          {/* Expiry */}
          <View style={s.expiryRow}>
            <Feather name="clock" size={13} color={theme.textMuted} />
            <Text style={[s.expiryText, { color: theme.textMuted }]}>
              {t('quote.valid_until', { date: new Date(quote.validUntil).toLocaleDateString(undefined, {
                day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
              }) })}
            </Text>
          </View>

          {/* Refuse reason input */}
          {showRefuseInput && (
            <View style={[s.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[s.cardTitle, { color: theme.textMuted }]}>{t('quote.refuse_reason_label')}</Text>
              <TextInput
                style={[s.refuseInput, { backgroundColor: theme.cardBg, borderColor: theme.border, color: theme.text }]}
                placeholder={t('quote.refuse_reason_placeholder')}
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
                  <Text style={[s.refuseCancelText, { color: theme.textSub }]}>{t('common.cancel')}</Text>
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
                    <Text style={s.refuseConfirmText}>{t('quote.confirm_refusal')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

        </Animated.View>
        <View style={{ height: 120 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Actions footer */}
      {canAct && (
        <SafeAreaView edges={["bottom"]} style={[s.footer, { backgroundColor: theme.bg }]}>
          <View style={s.footerRow}>
            <TouchableOpacity
              style={[s.refuseBtn, { borderColor: theme.border }]}
              onPress={() => setShowRefuseInput(true)}
              activeOpacity={0.75}
            >
              <Text style={[s.refuseBtnText, { color: theme.textSub }]}>{t('quote.refuse_quote')}</Text>
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
                  <Text style={[s.acceptBtnText, { color: theme.accentText }]}>{t('quote.accept_cta')}</Text>
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
    width: 36, height: 36, borderRadius: 10,
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

  card: { borderRadius: 18, borderWidth: 1, padding: 14 },
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

  notesCard: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12 },
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
    flex: 1, height: 55, borderRadius: 100,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  acceptBtnText: { fontFamily: FONTS.bebas, fontSize: 18, letterSpacing: 2 },
  acceptBtnPrice: { fontFamily: FONTS.sansMedium, fontSize: 13, opacity: 0.6 },
});
