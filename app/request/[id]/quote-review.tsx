// app/request/[id]/quote-review.tsx — Client revue de devis (adaptive dark/light)
//
// Hiérarchie de la page (charte FIXED) :
//   1. Contexte éditorial : service + adresse, statut, référence document
//   2. Île héro sombre — LE montant qui décide (Bebas 54, filigrane FIXED, compte à rebours)
//   3. Ledger blanc — détail main d'œuvre / pièces / acompte
//   4. Prestataire (identité) → notes → réassurance paiement
//   5. Footer : UNE action dominante (accepter), refus en lien discret → sheet dédiée
//
// Les blocs vivent dans components/quote/, la logique pure dans lib/quote/quoteReview.ts.
import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import type { Quote, ServiceRequest } from '@/lib/types';
import { useAppTheme, COLORS } from "@/hooks/use-app-theme";
import { PhotoGallery } from "@/components/mission/photos";
import { briefOf } from "@/lib/mission/brief";
import { useCallParty } from "@/lib/webrtc/CallContext";
import { useAndroidBackClose } from "@/hooks/use-android-back-close";
import { devError } from "@/lib/logger";
import { useAuth } from "@/lib/auth/AuthContext";
import { useSocket } from "@/lib/SocketContext";
import { cleanName } from "@/lib/displayName";
import { translateRequestServiceRaw } from "@/lib/categoryLabel";
import { useTranslation } from "react-i18next";
import { SplitPane, useSplitPane } from "@/lib/layout";
import {
  confirmPaymentWithRetry, isFolded, isQuoteReviewStatus, isSealed, quotePaymentSheetParams,
  quoteReviewState, splitAmount, timeLeftLabel as formatTimeLeft,
} from "@/lib/quote/quoteReview";
import { Reveal } from "@/components/quote/primitives";
import { QuoteSkeleton } from "@/components/quote/QuoteSkeleton";
import { QuoteHeader, QuoteEmpty } from "@/components/quote/QuoteChrome";
import { QuoteContext } from "@/components/quote/QuoteContext";
import { QuoteHero } from "@/components/quote/QuoteHero";
import { QuoteLedger } from "@/components/quote/QuoteLedger";
import { QuoteProviderCard } from "@/components/quote/QuoteProviderCard";
import { QuoteNotes, QuoteSecureNote } from "@/components/quote/QuoteNotes";
import { QuoteFooter } from "@/components/quote/QuoteFooter";
import { RefuseQuoteSheet } from "@/components/quote/RefuseQuoteSheet";
import { quoteCardStyle } from "@/components/quote/card";
import { useSealFold } from "@/components/quote/useSealFold";

export default function QuoteReview() {
  const router = useRouter();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const isSplit = useSplitPane();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const { user } = useAuth();
  const { socket } = useSocket();
  const callParty = useCallParty();

  const [loading, setLoading] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [request, setRequest] = useState<ServiceRequest | null>(null);
  const [requestStatus, setRequestStatus] = useState<string>("");
  const [accepting, setAccepting] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [showRefuseInput, setShowRefuseInput] = useState(false);
  const [refuseReason, setRefuseReason] = useState("");
  // Horloge locale : fait vivre le compte à rebours ET bascule l'écran en "expiré"
  // sans rechargement quand la validité tombe pendant que la page est ouverte.
  const [now, setNow] = useState(() => Date.now());

  // Moment 9 : à l'acceptation la bordure du héro passe d'ambre à vert et la
  // coche se trace ; au refus la carte se plie et se range, sans rouge.
  // Hissés avant l'early return (squelette) : un hook ne se déclare pas après un return.
  const quoteStatusUpper = (quote?.status || "").toUpperCase();
  const sealOn = isSealed(quoteStatusUpper, requestStatus);
  const foldOn = isFolded(quoteStatusUpper, requestStatus);
  const { heroBorderStyle, foldStyle } = useSealFold(sealOn, foldOn);
  // Hauteur RÉELLE du footer épinglé (mesurée) → réserve de scroll exacte. Elle varie
  // selon l'OS (barre gestuelle iOS 34 px vs nav 3 boutons Android ~48) et selon l'état
  // (CTA + lien de refus vs CTA seul) : une constante en dur masquerait du contenu.
  const [footerH, setFooterH] = useState(160);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { scrollY.value = e.contentOffset.y; });
  const headerLineStyle = useAnimatedStyle(() => ({ opacity: interpolate(scrollY.value, [0, 28], [0, 1], "clamp") }));
  const closeRefuse = useCallback(() => setShowRefuseInput(false), []);
  useAndroidBackClose(showRefuseInput, closeRefuse);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);

  // L'id seul, lu hors callback : c'est lui la dépendance, pas tout `user`.
  const userId = user?.id;
  // Charge la demande + le devis. Réutilisable (mount + rafraîchissement socket).
  // Retourne le statut courant de la demande (ou null si accès refusé/erreur).
  const load = useCallback(async (opts?: { silent?: boolean }): Promise<string | null> => {
    if (!id) return null;
    try {
      const reqRes = await api.requests.get(String(id));
      const request = reqRes?.data || reqRes;
      if (!request || request.clientId !== userId) {
        if (!opts?.silent) {
          feedback.error(t('quote.access_denied'));
          router.replace("/(tabs)/documents");
        }
        return null;
      }
      const status = (request.status || "").toUpperCase();
      setRequest(request);
      setRequestStatus(status);
      if (!isQuoteReviewStatus(status)) {
        if (!opts?.silent) router.replace("/(tabs)/documents");
        return status;
      }

      const res = await api.quotes.forRequest(id);
      const latest = res?.quotes?.[0];
      if (latest) setQuote(latest);
      return status;
    } catch (e) {
      devError("Quote fetch error:", e);
      return null;
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [id, userId, router, t]);

  useEffect(() => { load(); }, [load]);

  // Temps réel : un changement de statut (devis accepté/refusé/expiré depuis un
  // autre appareil, expiration cron 72 h…) rafraîchit l'écran pour que le badge et
  // les CTA reflètent l'état COURANT plutôt qu'un état figé au render.
  useEffect(() => {
    if (!socket || !id) return;
    const handler = (data: { requestId?: string | number }) => {
      if (String(data.requestId) !== String(id)) return;
      load({ silent: true });
    };
    socket.on("request:statusUpdated", handler);
    return () => { socket.off("request:statusUpdated", handler); };
  }, [socket, id, load]);

  const handleAccept = async () => {
    if (!quote) return;
    feedback.haptic('medium');
    setAccepting(true);
    try {
      // Re-vérifier l'état COURANT avant d'accepter : le devis a pu expirer / être
      // traité depuis un autre appareil. Évite une erreur générique côté backend.
      const currentStatus = await load({ silent: true });
      if (currentStatus && currentStatus !== "QUOTE_SENT") {
        feedback.toast(t('tracking.quote_gone'), 'info');
        return;
      }

      const res = await api.quotes.accept(quote.id);

      if (res.paymentIntent) {
        const { error: initError } = await initPaymentSheet(quotePaymentSheetParams(res.paymentIntent.clientSecret));

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
        const confirmed = await confirmPaymentWithRetry(
          (qid, piId) => api.quotes.confirmPayment(qid, piId), quoteId, res.paymentIntent.id,
        );
        if (!confirmed) {
          // Débité mais synchro backend échouée après 3 tentatives : on informe et on
          // laisse quand même passer (le webhook/cron réconciliera le statut).
          feedback.info(t('quote.payment_syncing'));
        }
      }

      feedback.event('quote_accepted');
      // Le suivi lit le montant et la fiche sur le serveur, aucun paramètre à passer.
      router.replace({ pathname: "/request/[id]/missionview", params: { id: String(id) } });
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
      await api.quotes.refuse(quote.id, refuseReason || undefined);
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
  const Header = <QuoteHeader theme={theme} onBack={goBack} lineStyle={headerLineStyle} />;

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
        <QuoteEmpty theme={theme} onBack={goBack} />
      </View>
    );
  }

  // Badge dérivé du VRAI statut du devis / de la demande (plus de "en attente" affiché
  // sur un devis déjà accepté ou refusé).
  const { accepted, refused, badgeDanger, badgeKey, terminal, canAct, msLeft, urgent } = quoteReviewState({
    quoteStatus: quote.status, requestStatus, validUntil: quote.validUntil, now,
  });
  const badgeColor = accepted ? theme.greenText : badgeDanger ? COLORS.red : theme.textSub;
  const badgeLabel = t(badgeKey);

  const hasDeposit = quote.calloutPaid > 0;
  // Sur un devis clos (accepté donc payé, refusé ou expiré), un « reste à payer »
  // n'a plus de sens : le montant qui documente le devis est son TOTAL.
  const heroCents = terminal ? quote.totalAmount : quote.remainingAmount;
  const heroLabel = terminal ? t('ext.invoice_total') : t('quote.remaining_to_pay');
  const hero = splitAmount(heroCents);
  const timeLeftLabel = formatTimeLeft(msLeft, t);

  const provider = request?.provider;
  const providerName = provider
    ? cleanName(provider.name || provider.user?.name, { email: provider.user?.email })
    : "";
  const serviceLabel = translateRequestServiceRaw(request);
  const cardStyle = quoteCardStyle(theme);

  // ── Contexte éditorial : statut · référence · service · adresse ──
  const contextBlock = (
    <Reveal>
      <QuoteContext
        theme={theme} quoteId={quote.id} badgeLabel={badgeLabel} badgeColor={badgeColor} badgeDanger={badgeDanger}
        accepted={accepted} terminal={terminal} serviceLabel={serviceLabel} address={request?.address}
      />
    </Reveal>
  );

  // ── Île héro — le montant qui décide ──
  const heroBlock = (
    <Reveal delay={70}>
      <QuoteHero
        theme={theme} heroLabel={heroLabel} hero={hero} accepted={accepted} refused={refused} terminal={terminal}
        hasDeposit={hasDeposit} totalAmount={quote.totalAmount} calloutPaid={quote.calloutPaid} badgeLabel={badgeLabel}
        validUntil={quote.validUntil} urgent={urgent} timeLeftLabel={timeLeftLabel}
        foldStyle={foldStyle} heroBorderStyle={heroBorderStyle}
      />
    </Reveal>
  );

  // ── Ledger : détail du devis ──
  const ledgerBlock = (
    <Reveal delay={130}>
      <QuoteLedger theme={theme} cardStyle={cardStyle} quote={quote} hasDeposit={hasDeposit} accepted={accepted} />
    </Reveal>
  );

  // ── Prestataire ──
  const providerBlock = (
    provider ? (
      <Reveal delay={180}>
        <QuoteProviderCard
          theme={theme} cardStyle={cardStyle} provider={provider} providerName={providerName}
          onOpen={() => router.push(`/providers/${provider.id}`)}
          onMessage={() => router.push({ pathname: '/messages/[userId]', params: { userId: String(provider.userId || provider.id), name: providerName, requestId: String(id) } })}
          onCall={() => callParty({ userId: provider.userId, name: providerName, requestId: id })}
        />
      </Reveal>
    ) : null
  );

  // ── Les photos de la demande, pour relire le devis face au problème ──
  const photosBlock = (
    request?.photos?.length ? (
      <Reveal delay={200}>
        <View style={{ marginHorizontal: -20 }}>
          <PhotoGallery photos={briefOf(request).photos} title={t('mission.your_photos')} />
        </View>
      </Reveal>
    ) : null
  );

  // ── Notes du prestataire ──
  const notesBlock = (
    quote.notes ? (
      <Reveal delay={220}>
        <QuoteNotes theme={theme} cardStyle={cardStyle} notes={quote.notes} />
      </Reveal>
    ) : null
  );

  // ── Réassurance paiement ──
  const secureBlock = (
    canAct ? (
      <Reveal delay={260}>
        <QuoteSecureNote theme={theme} />
      </Reveal>
    ) : null
  );

  // ── Footer : une action dominante ──
  const footer = (
    <QuoteFooter
      theme={theme} bottomInset={insets.bottom} canAct={canAct} accepted={accepted} accepting={accepting}
      remainingAmount={quote.remainingAmount}
      onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
      onAccept={handleAccept}
      onOpenRefuse={() => { feedback.haptic('light'); setShowRefuseInput(true); }}
      onViewMission={() => router.replace({ pathname: "/request/[id]/missionview", params: { id: String(id) } })}
      onHome={() => router.replace("/(tabs)/dashboard")}
    />
  );

  // Écran déplié (Duo ouvert, Fold, iPad) : le problème à gauche, le devis
  // à droite avec son action — on relit la demande face au montant sans
  // faire défiler. Compact : la colonne unique, dans l'ordre de lecture.
  return (
    <View style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {Header}

      <SplitPane
        master={isSplit ? (
          <Animated.ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 24 }]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {contextBlock}
            {providerBlock}
            {photosBlock}
            {notesBlock}
          </Animated.ScrollView>
        ) : (
          <Animated.ScrollView
            contentContainerStyle={[s.scroll, { paddingBottom: footerH + 24 }]}
            showsVerticalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {contextBlock}
            {heroBlock}
            {ledgerBlock}
            {providerBlock}
            {photosBlock}
            {notesBlock}
            {secureBlock}
          </Animated.ScrollView>
        )}
        detail={isSplit ? (
          <View style={s.root}>
            <Animated.ScrollView
              contentContainerStyle={[s.scroll, { paddingBottom: footerH + 24 }]}
              showsVerticalScrollIndicator={false}
            >
              {heroBlock}
              {ledgerBlock}
              {secureBlock}
            </Animated.ScrollView>
            {footer}
          </View>
        ) : null}
      />

      {isSplit ? null : footer}

      {/* ── Sheet de refus — sortie du flux de lecture, action destructive isolée ── */}
      <RefuseQuoteSheet
        theme={theme} visible={showRefuseInput} bottomInset={insets.bottom}
        reason={refuseReason} onChangeReason={setRefuseReason} refusing={refusing}
        onClose={closeRefuse} onConfirm={handleRefuse}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 18, paddingTop: 10, gap: 12 },
});
