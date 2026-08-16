// app/request/[id]/quote-review.tsx — Client revue de devis (adaptive dark/light)
//
// Hiérarchie de la page (charte FIXED) :
//   1. Contexte éditorial : service + adresse, statut, référence document
//   2. Île héro sombre — LE montant qui décide (Bebas 54, filigrane FIXED, compte à rebours)
//   3. Ledger blanc — détail main d'œuvre / pièces / acompte
//   4. Prestataire (identité) → notes → réassurance paiement
//   5. Footer : UNE action dominante (accepter), refus en lien discret → sheet dédiée
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, StatusBar, Platform,
  TouchableOpacity, TextInput,
  Animated, Easing, KeyboardAvoidingView, Modal,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import { useAppTheme, FONTS, COLORS, alpha } from "@/hooks/use-app-theme";
import Avatar from "@/components/ui/Avatar";
import { RaisedButton } from "@/components/ui/RaisedButton";
import { PulseDot } from "@/components/ui/PulseDot";
import { useAndroidBackClose } from "@/hooks/use-android-back-close";
import { devError } from "@/lib/logger";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSocket } from "@/lib/SocketContext";
import { formatEURCents as fmtEur } from "@/lib/format";
import { cleanName } from "@/lib/displayName";
import { translateRequestServiceRaw } from "@/lib/categoryLabel";
import { useTranslation } from "react-i18next";

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/** Sépare "871,00 €" en { value, cur } pour composer le montant héros en deux tailles. */
function splitAmount(cents: number) {
  const s = fmtEur(cents);
  const m = s.match(/^(.*?)\s*(€)$/);
  return m ? { value: m[1], cur: m[2] } : { value: s, cur: "" };
}

/** Micro-label mono uppercase — signature typographique FIXED. */
function MonoLabel({ children, color, size = 10.5 }: { children: React.ReactNode; color: string; size?: number }) {
  return (
    <Text style={{ fontFamily: FONTS.mono, fontSize: size, letterSpacing: 1.6, textTransform: "uppercase", color }}>
      {children}
    </Text>
  );
}

/** Entrée échelonnée — fade + 14px up, easing charte. */
function Reveal({ delay = 0, children }: { delay?: number; children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 460, delay, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [a, delay]);
  return (
    <Animated.View
      style={{
        opacity: a,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Squelette de chargement — reprend la silhouette réelle de la page (héro + ledger). */
function QuoteSkeleton({ theme }: { theme: any }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, [pulse]);
  const Block = ({ h, w = "100%", r = 14, mt = 0 }: { h: number; w?: any; r?: number; mt?: number }) => (
    <Animated.View style={{ height: h, width: w, borderRadius: r, marginTop: mt, backgroundColor: theme.surface, opacity: pulse }} />
  );
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
      <Block h={16} w={140} r={8} />
      <Block h={30} w={220} r={8} mt={14} />
      <Block h={168} r={26} mt={18} />
      <Block h={150} r={20} mt={12} />
      <Block h={76} r={20} mt={12} />
    </View>
  );
}

export default function QuoteReview() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<any>(null);
  const [request, setRequest] = useState<any>(null);
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [accepting, setAccepting] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [showRefuseInput, setShowRefuseInput] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  // Horloge locale : fait vivre le compte à rebours ET bascule l'écran en "expiré"
  // sans rechargement quand la validité tombe pendant que la page est ouverte.
  const [now, setNow] = useState(() => Date.now());
  // Hauteur RÉELLE du footer épinglé (mesurée) → réserve de scroll exacte. Elle varie
  // selon l'OS (barre gestuelle iOS 34 px vs nav 3 boutons Android ~48) et selon l'état
  // (CTA + lien de refus vs CTA seul) : une constante en dur masquerait du contenu.
  const [footerH, setFooterH] = useState(160);

  const scrollY = useRef(new Animated.Value(0)).current;
  const closeRefuse = useCallback(() => setShowRefuseInput(false), []);
  useAndroidBackClose(showRefuseInput, closeRefuse);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
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
      setRequest(request);
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
      setShowRefuseInput(false);
      router.replace("/(tabs)/dashboard");
    } catch (e: any) {
      devError("Refuse quote error:", e);
      feedback.error(e?.message || t('common.error'));
    } finally {
      setRefusing(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  // ── Header partagé (loading / empty / contenu) ───────────────────────────
  const headerLineOpacity = scrollY.interpolate({ inputRange: [0, 28], outputRange: [0, 1], extrapolate: "clamp" });
  const Header = (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: theme.bg }}>
      <View style={s.header}>
        <TouchableOpacity
          style={[s.headerBack, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          onPress={goBack}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.text }]}>{t('quote.short_label').toUpperCase()}</Text>
        <View style={{ width: 36 }} />
      </View>
      <Animated.View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, opacity: headerLineOpacity }} />
    </SafeAreaView>
  );

  // Loading — squelette plutôt que spinner : la page se dessine avant d'arriver.
  if (loading) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        {Header}
        <QuoteSkeleton theme={theme} />
      </View>
    );
  }

  // Empty
  if (!quote) {
    return (
      <View style={[s.root, { backgroundColor: theme.bg }]}>
        <StatusBar barStyle={theme.statusBar} />
        {Header}
        <View style={[s.center, { flex: 1, paddingHorizontal: 32 }]}>
          <View style={[s.emptyIcon, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Feather name="file-text" size={28} color={theme.textMuted} />
          </View>
          <Text style={[s.emptyText, { color: theme.textSub }]}>{t('quote.empty_no_quote_yet')}</Text>
          <TouchableOpacity style={s.emptyBack} onPress={goBack} accessibilityRole="button" hitSlop={8}>
            <Text style={[s.emptyBackText, { color: theme.text }]}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Badge dérivé du VRAI statut du devis / de la demande (plus de "en attente" affiché
  // sur un devis déjà accepté ou refusé).
  const qStatus = (quote.status || "").toUpperCase();
  const validUntilMs = new Date(quote.validUntil).getTime();
  const expired = qStatus === "EXPIRED" || requestStatus === "QUOTE_EXPIRED" || now > validUntilMs;
  const accepted = qStatus === "ACCEPTED" || requestStatus === "QUOTE_ACCEPTED" || requestStatus === "ONGOING";
  const refused = qStatus === "REFUSED" || requestStatus === "QUOTE_REFUSED";
  const badgeDanger = refused || expired;
  const badgeColor = accepted ? theme.greenText : badgeDanger ? COLORS.red : theme.textSub;
  const badgeLabel = accepted ? t('quote.badge_accepted') : refused ? t('quote.badge_refused') : expired ? t('quote.expired') : t('quote.awaiting_response');
  const terminal = accepted || refused || expired;
  const canAct = !terminal && qStatus === "SENT";

  const hasDeposit = quote.calloutPaid > 0;
  // Sur un devis clos (accepté donc payé, refusé ou expiré), un « reste à payer »
  // n'a plus de sens : le montant qui documente le devis est son TOTAL.
  const heroCents = terminal ? quote.totalAmount : quote.remainingAmount;
  const heroLabel = terminal ? t('ext.invoice_total') : t('quote.remaining_to_pay');
  const hero = splitAmount(heroCents);

  // Compte à rebours de validité — urgence sous 6 h.
  const msLeft = validUntilMs - now;
  const urgent = !terminal && msLeft < 6 * 3600_000;
  const timeLeftLabel = (() => {
    const totalMin = Math.max(0, Math.floor(msLeft / 60_000));
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${t('notifications.time_day', { n: d })} ${t('notifications.time_hour', { n: h })}`;
    if (h > 0) return `${t('notifications.time_hour', { n: h })} ${t('notifications.time_min', { n: m })}`;
    return t('notifications.time_min', { n: m });
  })();

  const provider = request?.provider;
  const providerName = provider
    ? cleanName(provider.name || provider.user?.name, { email: provider.user?.email })
    : "";
  const serviceLabel = translateRequestServiceRaw(request);

  const cardStyle = {
    backgroundColor: theme.cardBg,
    borderColor: theme.borderLight,
    shadowColor: "#000",
    shadowOpacity: theme.shadowOpacity,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: theme.isDark ? 0 : 2,
  };

  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {Header}

      <Animated.ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: footerH + 24 }]}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {/* ── Contexte éditorial : statut · référence · service · adresse ── */}
        <Reveal>
          <View style={s.metaRow}>
            <View style={[
              s.badge,
              { backgroundColor: theme.surface },
              badgeDanger && { backgroundColor: alpha(COLORS.red, 0.12) },
              accepted && { backgroundColor: alpha(COLORS.greenBrand, 0.12) },
            ]}>
              {terminal
                ? <View style={[s.badgeDot, { backgroundColor: badgeColor }]} />
                : <PulseDot size={6} color={badgeColor} />}
              <Text style={[s.badgeText, { color: badgeColor }]} numberOfLines={1}>{badgeLabel}</Text>
            </View>
            <MonoLabel color={theme.textVeryMuted}>{t('quote.doc_label')} #{quote.id}</MonoLabel>
          </View>

          {serviceLabel ? (
            <Text style={[s.pageTitle, { color: theme.text }]} numberOfLines={2}>{serviceLabel}</Text>
          ) : null}
          {request?.address ? (
            <View style={s.addressRow}>
              <Feather name="map-pin" size={12} color={theme.textMuted} />
              <Text style={[s.addressText, { color: theme.textMuted }]} numberOfLines={1}>{request.address}</Text>
            </View>
          ) : null}
        </Reveal>

        {/* ── Île héro — le montant qui décide ── */}
        <Reveal delay={70}>
          <View style={[s.hero, { backgroundColor: theme.heroBg }]}>
            <LinearGradient
              colors={[alpha('#FFFFFF', 0.07), 'transparent', alpha('#000000', 0.22)]}
              locations={[0, 0.5, 1]}
              start={{ x: 1, y: 0 }} end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
              pointerEvents="none"
            />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.heroBorder, { borderColor: alpha('#FFFFFF', 0.08) }]} />

            <View style={s.heroTop}>
              <MonoLabel color={theme.heroSub} size={11}>{heroLabel}</MonoLabel>
              <Text style={[s.heroWatermark, { color: theme.heroSubFaint }]}>FIXED</Text>
            </View>

            <View style={s.heroAmountRow}>
              <Text style={[s.heroAmount, { color: theme.heroText }]}>
                {hero.value}
                <Text style={[s.heroCurrency, { color: theme.heroSub }]}> {hero.cur}</Text>
              </Text>
            </View>

            {hasDeposit && !terminal ? (
              <View style={s.heroSubRow}>
                <Text style={[s.heroSubText, { color: theme.heroSubFaint }]}>
                  {t('ext.invoice_total')} {fmtEur(quote.totalAmount)}
                </Text>
                <View style={[s.heroPill, { backgroundColor: alpha(COLORS.greenBrand, 0.16), borderColor: alpha(COLORS.greenBrand, 0.4) }]}>
                  <Feather name="tag" size={10} color={COLORS.green} />
                  <Text style={[s.heroPillText, { color: COLORS.green }]}>− {fmtEur(quote.calloutPaid)}</Text>
                </View>
              </View>
            ) : null}

            <View style={[s.heroFooter, { borderTopColor: alpha('#FFFFFF', 0.12) }]}>
              {terminal ? (
                <View style={s.heroFooterLeft}>
                  <Feather
                    name={accepted ? "check-circle" : refused ? "slash" : "clock"}
                    size={13}
                    color={accepted ? COLORS.green : theme.heroSubFaint}
                  />
                  <Text style={[s.heroFooterText, { color: accepted ? COLORS.green : theme.heroSub }]} numberOfLines={1}>
                    {badgeLabel}
                  </Text>
                </View>
              ) : (
                <>
                  <View style={s.heroFooterLeft}>
                    <Feather name="clock" size={13} color={theme.heroSubFaint} />
                    <Text style={[s.heroFooterText, { color: theme.heroSub }]} numberOfLines={1}>
                      {t('quote.valid_until', {
                        date: new Date(quote.validUntil).toLocaleDateString(undefined, {
                          day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
                        }),
                      })}
                    </Text>
                  </View>
                  <View style={[
                    s.countdown,
                    { backgroundColor: alpha('#FFFFFF', 0.10) },
                    urgent && { backgroundColor: alpha(COLORS.amber, 0.18) },
                  ]}>
                    <Text style={[s.countdownText, { color: urgent ? COLORS.amber : theme.heroText }]}>
                      {timeLeftLabel}
                    </Text>
                  </View>
                </>
              )}
            </View>
          </View>
        </Reveal>

        {/* ── Ledger : détail du devis ── */}
        <Reveal delay={130}>
          <View style={[s.card, cardStyle]}>
            <MonoLabel color={theme.textMuted}>{t('quote.details')}</MonoLabel>

            <View style={{ marginTop: 12 }}>
              <View style={s.lineRow}>
                <View style={[s.tile, { backgroundColor: theme.surface }]}>
                  <Feather name="tool" size={15} color={theme.text} />
                </View>
                <Text style={[s.lineLabel, { color: theme.text }]} numberOfLines={1}>{t('quote.labor')}</Text>
                <Text style={[s.lineValue, { color: theme.text }]}>{fmtEur(quote.laborAmount)}</Text>
              </View>

              {quote.partsAmount > 0 && (
                <View style={s.lineRow}>
                  <View style={[s.tile, { backgroundColor: theme.surface }]}>
                    <Feather name="package" size={15} color={theme.text} />
                  </View>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[s.lineLabel, { color: theme.text }]} numberOfLines={1}>{t('quote.parts_materials')}</Text>
                    {quote.partsDetail ? (
                      <Text style={[s.lineDetail, { color: theme.textMuted }]} numberOfLines={2}>{quote.partsDetail}</Text>
                    ) : null}
                  </View>
                  <Text style={[s.lineValue, { color: theme.text }]}>{fmtEur(quote.partsAmount)}</Text>
                </View>
              )}
            </View>

            <View style={[s.divider, { backgroundColor: theme.borderLight }]} />

            <View style={s.totalRow}>
              <Text style={[s.totalLabel, { color: theme.text }]}>{t('ext.invoice_total')}</Text>
              <Text style={[s.totalValue, { color: theme.text }]}>{fmtEur(quote.totalAmount)}</Text>
            </View>

            {hasDeposit && (
              <>
                <View style={s.depositRow}>
                  <Text style={[s.depositLabel, { color: theme.greenText }]} numberOfLines={1}>{t('quote.deposit_paid')}</Text>
                  <Text style={[s.depositValue, { color: theme.greenText }]}>− {fmtEur(quote.calloutPaid)}</Text>
                </View>
                <View style={[s.divider, { backgroundColor: theme.border }]} />
                <View style={s.totalRow}>
                  {/* Devis accepté = solde déjà réglé via la PaymentSheet : afficher
                      « reste à payer » ferait croire au client qu'il doit encore. */}
                  <Text style={[s.finalLabel, { color: theme.text }]}>
                    {accepted ? t('ext.invoice_paid') : t('quote.remaining_to_pay')}
                  </Text>
                  <Text style={[s.finalValue, { color: accepted ? theme.greenText : theme.text }]}>
                    {fmtEur(quote.remainingAmount)}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Reveal>

        {/* ── Prestataire ── */}
        {provider ? (
          <Reveal delay={180}>
            <TouchableOpacity
              style={[s.card, s.providerCard, cardStyle]}
              onPress={() => router.push(`/providers/${provider.id}`)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={providerName}
            >
              <Avatar
                size={44}
                name={providerName}
                avatarUrl={provider.avatarUrl}
                verified={provider.validationStatus === 'ACTIVE'}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <MonoLabel color={theme.textMuted}>{t('quote.provider_label')}</MonoLabel>
                <Text style={[s.providerName, { color: theme.text }]} numberOfLines={1}>{providerName}</Text>
                <View style={s.providerMeta}>
                  <Feather name="star" size={11} color={theme.textSub} />
                  <Text style={[s.providerMetaText, { color: theme.textSub }]}>
                    {provider.avgRating > 0 ? Number(provider.avgRating).toFixed(1) : '—'}
                  </Text>
                  <Text style={[s.providerMetaText, { color: theme.textVeryMuted }]}>·</Text>
                  <Text style={[s.providerMetaText, { color: theme.textSub }]} numberOfLines={1}>
                    {t('quote.jobs_count', { count: provider.jobsCompleted || 0 })}
                  </Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color={theme.textMuted} />
            </TouchableOpacity>
          </Reveal>
        ) : null}

        {/* ── Notes du prestataire ── */}
        {quote.notes ? (
          <Reveal delay={220}>
            <View style={[s.card, cardStyle]}>
              <MonoLabel color={theme.textMuted}>{t('quote.notes_from_provider')}</MonoLabel>
              <View style={s.notesRow}>
                <View style={[s.notesRule, { backgroundColor: theme.border }]} />
                <Text style={[s.notesText, { color: theme.textSub }]}>{quote.notes}</Text>
              </View>
            </View>
          </Reveal>
        ) : null}

        {/* ── Réassurance paiement ── */}
        {canAct ? (
          <Reveal delay={260}>
            <View style={s.secureRow}>
              <Feather name="shield" size={12} color={theme.textMuted} />
              <Text style={[s.secureText, { color: theme.textMuted }]}>{t('quote.secure_note')}</Text>
            </View>
          </Reveal>
        ) : null}
      </Animated.ScrollView>

      {/* ── Footer : une action dominante ── */}
      <LinearGradient
        colors={[alpha(theme.bg, 0), theme.bg, theme.bg]}
        locations={[0, 0.45, 1]}
        style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}
        pointerEvents="box-none"
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      >
        {canAct ? (
          <>
            <RaisedButton
              display
              size="lg"
              label={`${t('quote.accept_cta')} · ${fmtEur(quote.remainingAmount)}`}
              iconRight="arrow-right"
              loading={accepting}
              onPress={handleAccept}
              haptic="none"
            />
            <TouchableOpacity
              style={s.refuseLink}
              onPress={() => { feedback.haptic('light'); setShowRefuseInput(true); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('quote.refuse_link')}
              hitSlop={8}
            >
              <Text style={[s.refuseLinkText, { color: theme.textSub }]}>{t('quote.refuse_link')}</Text>
            </TouchableOpacity>
          </>
        ) : accepted ? (
          <RaisedButton
            display
            size="lg"
            label={t('notifications.cta_view_mission')}
            iconRight="arrow-right"
            onPress={() => router.replace({ pathname: "/request/[id]/missionview", params: { id: String(id) } })}
          />
        ) : (
          <RaisedButton
            display
            size="lg"
            label={t('dashboard.back_home')}
            onPress={() => router.replace("/(tabs)/dashboard")}
          />
        )}
      </LinearGradient>

      {/* ── Sheet de refus — sortie du flux de lecture, action destructive isolée ── */}
      <Modal
        visible={showRefuseInput}
        transparent
        animationType="slide"
        onRequestClose={closeRefuse}
        statusBarTranslucent
        navigationBarTranslucent
      >
        {/* behavior="padding" sur LES DEUX plateformes : avec l'edge-to-edge SDK 54,
            adjustResize est inopérant sur Android — `undefined` laisserait le champ
            « raison » derrière le clavier. */}
        <KeyboardAvoidingView style={s.modalRoot} behavior="padding">
          <TouchableOpacity
            style={[StyleSheet.absoluteFill, { backgroundColor: alpha('#000000', 0.55) }]}
            activeOpacity={1}
            onPress={closeRefuse}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <View style={[
            s.sheet,
            {
              backgroundColor: theme.cardBg,
              paddingBottom: Math.max(insets.bottom + 12, Platform.OS === "ios" ? 40 : 28),
            },
          ]}>
            <View style={[s.sheetHandle, { backgroundColor: theme.border }]} />

            <View style={[s.sheetIcon, { backgroundColor: alpha(COLORS.red, 0.12) }]}>
              <Feather name="x" size={20} color={COLORS.red} />
            </View>

            <Text style={[s.sheetTitle, { color: theme.text }]}>{t('quote.refuse_sheet_title')}</Text>
            <Text style={[s.sheetBody, { color: theme.textSub }]}>{t('quote.refuse_sheet_body')}</Text>

            <View style={{ width: "100%", gap: 8 }}>
              <MonoLabel color={theme.textMuted}>{t('quote.refuse_reason_label')}</MonoLabel>
              <TextInput
                style={[s.refuseInput, { backgroundColor: theme.surface, borderColor: theme.border, color: theme.text }]}
                placeholder={t('quote.refuse_reason_placeholder')}
                placeholderTextColor={theme.textMuted}
                value={refuseReason}
                onChangeText={setRefuseReason}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>

            <View style={s.sheetBtns}>
              <TouchableOpacity
                style={[s.sheetCancel, { borderColor: theme.border }]}
                onPress={closeRefuse}
                activeOpacity={0.75}
                accessibilityRole="button"
              >
                <Text style={[s.sheetCancelText, { color: theme.textSub }]}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <RaisedButton
                variant="destructive"
                size="md"
                label={t('quote.confirm_refusal')}
                loading={refusing}
                onPress={handleRefuse}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  headerBack: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 22,
    letterSpacing: 2.5,
  },

  scroll: { paddingHorizontal: 18, paddingTop: 10, gap: 12 },

  // ── Contexte ──
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: 100, flexShrink: 1,
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: {
    fontFamily: FONTS.mono, fontSize: 10.5,
    letterSpacing: 0.8, textTransform: "uppercase", flexShrink: 1,
  },
  pageTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 32, letterSpacing: 0.8, lineHeight: 34, marginTop: 14,
  },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5 },
  addressText: { fontFamily: FONTS.sans, fontSize: 12.5, flexShrink: 1 },

  // ── Héro ──
  hero: {
    position: "relative", borderRadius: 26, overflow: "hidden", padding: 22, marginTop: 6,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 18 }, elevation: 10,
  },
  heroBorder: { borderRadius: 26, borderWidth: 1 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroWatermark: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 3 },
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", marginTop: 10, flexWrap: "wrap" },
  heroAmount: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 54, letterSpacing: 0.5, lineHeight: 56 },
  heroCurrency: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26 },
  heroSubRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  heroSubText: { fontFamily: FONTS.mono, fontSize: 12 },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1,
  },
  heroPillText: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 0.3 },
  heroFooter: {
    marginTop: 16, paddingTop: 14, borderTopWidth: 1,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12,
  },
  heroFooterLeft: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 },
  heroFooterText: { fontFamily: FONTS.sans, fontSize: 12.5, flexShrink: 1 },
  countdown: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, flexShrink: 0 },
  countdownText: { fontFamily: FONTS.monoMedium, fontSize: 11.5, letterSpacing: 0.3 },

  // ── Cartes ──
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },

  lineRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 12 },
  tile: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  lineLabel: { fontFamily: FONTS.sans, fontSize: 14, flex: 1, paddingRight: 10 },
  lineDetail: { fontFamily: FONTS.sans, fontSize: 12, marginTop: 2, lineHeight: 16 },
  lineValue: { fontFamily: FONTS.monoMedium, fontSize: 14, letterSpacing: 0.2, flexShrink: 0 },

  divider: { height: 1, marginVertical: 10 },

  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12 },
  totalLabel: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  totalValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 0.8 },
  depositRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 12, marginTop: 8 },
  depositLabel: { fontFamily: FONTS.sans, fontSize: 13.5, flexShrink: 1 },
  depositValue: { fontFamily: FONTS.monoMedium, fontSize: 13.5, flexShrink: 0 },
  finalLabel: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  finalValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 26, letterSpacing: 0.8 },

  providerCard: { flexDirection: "row", alignItems: "center", gap: 14 },
  providerName: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  providerMeta: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  providerMetaText: { fontFamily: FONTS.monoMedium, fontSize: 11.5, flexShrink: 1 },

  notesRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  notesRule: { width: 2, borderRadius: 2, alignSelf: "stretch" },
  notesText: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, flex: 1 },

  secureRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 4, paddingHorizontal: 8 },
  secureText: { fontFamily: FONTS.sans, fontSize: 11.5, textAlign: "center", flexShrink: 1 },

  // ── Empty ──
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  emptyText: { fontFamily: FONTS.sans, fontSize: 14, textAlign: "center" },
  emptyBack: { paddingHorizontal: 16, paddingVertical: 8 },
  emptyBackText: { fontFamily: FONTS.sansMedium, fontSize: 13, textDecorationLine: "underline" },

  // ── Footer épinglé ──
  // zIndex (et non elevation) : sur Android RN réordonne le rendu sans dessiner
  // d'ombre — une elevation ici tracerait un liseré sombre sur le dégradé.
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10,
    paddingHorizontal: 18, paddingTop: 28, gap: 4,
  },
  refuseLink: { alignSelf: "center", paddingVertical: 10, paddingHorizontal: 16 },
  refuseLinkText: { fontFamily: FONTS.sansMedium, fontSize: 13 },

  // ── Sheet de refus ──
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    paddingHorizontal: 20, paddingTop: 10, gap: 14, alignItems: "center",
  },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, marginBottom: 6 },
  sheetIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  sheetTitle: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 26, letterSpacing: 1, textAlign: "center",
  },
  sheetBody: { fontFamily: FONTS.sans, fontSize: 13.5, lineHeight: 20, textAlign: "center", marginTop: -6 },
  refuseInput: {
    borderRadius: 14, borderWidth: 1, padding: 12, minHeight: 84, width: "100%",
    fontFamily: FONTS.sans, fontSize: 13.5,
  },
  sheetBtns: { flexDirection: "row", gap: 10, width: "100%", alignItems: "center" },
  sheetCancel: {
    flex: 1, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  sheetCancelText: { fontFamily: FONTS.sansMedium, fontSize: 14 },
});
