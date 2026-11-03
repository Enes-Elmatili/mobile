// components/request/stepper/usePaymentFlow.ts
// Étape 4 — paiement : état du paiement, verrouillage du prix, création de la
// demande, PaymentSheet Stripe (prix fixe / callout devis), confirmation avec
// retry, code promo, navigation vers l'écran suivant. Extrait tel quel de
// NewRequestStepper : l'ordre des hooks et les tableaux de dépendances des
// effets sont inchangés (le hook est appelé à l'endroit exact où vivait ce code).
import { useState, useEffect, useMemo, type RefObject } from 'react';
import type { useRouter } from 'expo-router';
import type { useStripe } from '@stripe/stripe-react-native';
import type { TFunction } from 'i18next';
import { feedback } from '@/lib/feedback/feedback';
import { api } from '@/lib/api';
import { devError, reportError } from '@/lib/logger';
import { buildAccessSnapshot } from '@/lib/request/access';
import { chargedParams, fixedAmountsCents } from '@/lib/request/pricing';
import type { ScheduleMode } from '@/lib/request/schedule';
import {
  buildFixedRequestPayload, buildFreeRequestPayload, buildMissionRoute, buildPricingLockPayload, buildQuoteRequestPayload,
  fixedSheetParams, quoteSheetParams, type RequestPayloadBase,
} from '@/lib/request/requestPayload';
import type {
  AppliedPromo, CalloutPaymentResponse, CreatedRequestResponse, PaymentSetupResponse, PriceDetails,
  PricingLockResponse, RequestId, StepperCategory, StepperLocation, StepperSubcategory,
} from '@/lib/request/stepperTypes';

type Stripe = ReturnType<typeof useStripe>;

/** Message d'une erreur levée (API, Stripe, Error) ; undefined sinon. */
const messageOf = (e: unknown): string | undefined => (e as { message?: string } | null | undefined)?.message;

export type PaymentFlowInput = {
  t: TFunction;
  router: ReturnType<typeof useRouter>;
  initPaymentSheet: Stripe['initPaymentSheet'];
  presentPaymentSheet: Stripe['presentPaymentSheet'];
  mountedRef: RefObject<boolean>;
  setLoading: (loading: boolean) => void;
  step: number;
  selectedCategory: StepperCategory | null;
  selectedSubcategory: StepperSubcategory | null;
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  location: StepperLocation | null;
  scheduleMode: ScheduleMode;
  selectedDayIso: string | null;
  selectedTime: string | null;
  scheduledFor: string | null;
  scheduledLabel: string | null;
  serviceName: string | null;
  isUrgent: boolean;
  buildingOver10y: boolean;
  buildingType: string | null;
  floorNum: string;
  hasElevator: boolean | null;
  accessNotes: string;
  clientLanguage: string | null;
  preferred: { id: string; name: string } | null;
  isFreeService: boolean;
  isQuoteFlow: boolean;
  pricingMode: string;
  vatEligible: boolean;
  privateUse: boolean;
  priceDetails: PriceDetails;
  sendPhotos: (rId: number | string) => Promise<void>;
};

export function usePaymentFlow(input: PaymentFlowInput) {
  const {
    t, router, initPaymentSheet, presentPaymentSheet, mountedRef, setLoading, step,
    selectedCategory, selectedSubcategory, categoryId, subcategoryId, description, location,
    scheduleMode, selectedDayIso, selectedTime, scheduledFor, scheduledLabel, serviceName,
    isUrgent, buildingOver10y, buildingType, floorNum, hasElevator, accessNotes, clientLanguage,
    preferred, isFreeService, isQuoteFlow, pricingMode, vatEligible, privateUse, priceDetails, sendPhotos,
  } = input;
  const [requestId,          setRequestId]         = useState<RequestId | null>(null);
  const [paymentReady,       setPaymentReady]       = useState(false);
  // Store-review : le backend (comptes REVIEW_DEMO_EMAILS) renvoie { demo:true } →
  // on saute la PaymentSheet. Inerte pour un vrai utilisateur (demo jamais renvoyé).
  const [bypassPayment,      setBypassPayment]      = useState(false);
  const [paymentInitLoading, setPaymentInitLoading] = useState(false);
  const [serverPrice,        setServerPrice]        = useState<PriceDetails | null>(null);
  const [pricingError,       setPricingError]       = useState<string | null>(null);
  const [confirmedCalloutCents, setConfirmedCalloutCents] = useState<number | null>(null);
  // Incrémenté par le bouton "Réessayer" de la bannière d'erreur → relance l'init paiement.
  const [initAttempt,        setInitAttempt]        = useState(0);
  // Paiement Stripe débité mais /payments/success en échec après 3 tentatives →
  // on affiche un CTA "Réessayer" manuel (jamais de retry récursif infini).
  const [confirmRetryNeeded, setConfirmRetryNeeded] = useState(false);

  // ── Code promo / offre de lancement (mode prix fixe) ──
  // appliedPromo = remise validée 100% serveur (jamais le montant saisi côté app).
  // Le backend supporte aussi CALLOUT_COVERED (mode estimate), mais l'UI promo n'est
  // exposée que sur le flow fixe ; estimate suivra au go-live devis.
  const [promoSheetVisible, setPromoSheetVisible] = useState(false);
  const [promoApplying,     setPromoApplying]     = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  // Reset prix/paiement dès que l'utilisateur change de service, d'adresse,
  // de créneau, d'urgence ou de TVA : le PaymentIntent doit TOUJOURS refléter
  // les valeurs courantes (jamais un ancien prix/RDV/adresse verrouillé).
  // Le retour au step 4 relancera l'init (effet [step, initAttempt] ci-dessous).
  useEffect(() => {
    // Annule la demande PENDING_PAYMENT devenue obsolète pour éviter les
    // demandes orphelines côté client ("reprendre paiement", documents…).
    if (requestId) {
      api.requests.cancel(String(requestId)).catch((e) => reportError(e, 'stepper.cancel_pending'));
    }
    setServerPrice(null);
    setPaymentReady(false);
    setRequestId(null);
    setConfirmedCalloutCents(null);
    setAppliedPromo(null);
    setPricingError(null);
    setConfirmRetryNeeded(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcategoryId, categoryId, location, scheduleMode, selectedDayIso, selectedTime, isUrgent, buildingOver10y, buildingType]);

  // Prix affiché = prix serveur (si disponible) ou estimation client
  const displayPrice = serverPrice || priceDetails;
  const displayTotal = parseFloat(displayPrice.totalTVAC);

  // ── Montants remisés (offre de lancement, mode fixe) — lib/request/pricing.ts ──
  const { nominalCents: nominalCentsFixed, discountedCents: discountedCentsFixed } = fixedAmountsCents(displayTotal, appliedPromo);

  // Snapshot des infos d'accès pour cette mission spécifique (évite que les
  // missions partagent toutes les mêmes valeurs via User.* qui sert de défaut).
  const accessSnapshot = useMemo<Record<string, unknown>>(
    () => buildAccessSnapshot({ buildingType, floorNum, hasElevator, accessNotes, clientLanguage }),
    [buildingType, floorNum, hasElevator, accessNotes, clientLanguage],
  );

  useEffect(() => {
    if (step !== 4 || !selectedCategory || !location || paymentReady) return;
    let cancelled = false;
    (async () => {
      setPaymentInitLoading(true);
      setPricingError(null);
      try {
        // Demande partiellement créée lors d'une tentative précédente (init en
        // échec) → annulée avant d'en recréer une (évite les orphelines).
        if (requestId) {
          api.requests.cancel(String(requestId)).catch((e) => reportError(e, 'stepper.cancel_pending'));
          setRequestId(null);
        }
        const serviceType = selectedSubcategory?.name || selectedCategory.name;
        const base: RequestPayloadBase = {
          serviceType,
          description,
          categoryId:          selectedCategory.id,
          subcategoryId,
          location,
          scheduledFor,
          preferredProviderId: preferred?.id,
          accessSnapshot,
        };

        // ── Service gratuit → skip pricing lock + skip payment ──
        if (isFreeService) {
          const reqRes = await api.post<CreatedRequestResponse>('/requests', buildFreeRequestPayload(base));
          const rId = reqRes.id || reqRes.data?.id;
          if (!rId) throw new Error('Request ID manquant');
          if (cancelled) return;
          setRequestId(rId);
          await sendPhotos(rId);
          setPaymentReady(true);
          return;
        }

        // ── Flow devis : pas de prix à verrouiller — le callout fee vient de la subcategory ──
        if (isQuoteFlow) {
          const reqRes = await api.post<CreatedRequestResponse>('/requests', buildQuoteRequestPayload({ ...base, isUrgent, pricingMode }));
          const rId    = reqRes.id || reqRes.data?.id;
          if (!rId) throw new Error('Request ID manquant');
          if (cancelled) return;
          setRequestId(rId);
          await sendPhotos(rId);
          const calloutRes = await api.post<CalloutPaymentResponse>('/quotes/callout-payment', { requestId: rId });
          if (calloutRes.amount) setConfirmedCalloutCents(calloutRes.amount);
          // Store-review : { demo:true } → le backend a déjà fait QUOTE_PENDING + broadcast
          // (aucune charge). On saute la PaymentSheet ; handlePay navigue directement.
          if (calloutRes.demo) {
            if (!cancelled) { setBypassPayment(true); setPaymentReady(true); }
            return;
          }
          const { error } = await initPaymentSheet(quoteSheetParams(calloutRes.clientSecret));
          if (error) throw new Error(error.message);
          if (!cancelled) setPaymentReady(true);
          return;
        }

        // ── Flow prix fixe : verrouiller le prix côté serveur ──
        const lockRes = await api.post<PricingLockResponse>('/pricing/lock', buildPricingLockPayload({
          categoryId: selectedCategory.id, subcategoryId, isUrgent, scheduledFor, pricingMode,
          vatEligible, buildingOver10y, privateUse,
        }));
        if (cancelled) return;
        setServerPrice(lockRes.price);

        const reqRes = await api.post<CreatedRequestResponse>('/requests', buildFixedRequestPayload({
          ...base, isUrgent, pricingMode,
          price:        parseFloat(lockRes.price.totalTVAC),
          pricingToken: lockRes.pricingToken,
        }));
        const rId    = reqRes.id || reqRes.data?.id;
        if (!rId) throw new Error('Request ID manquant');
        if (cancelled) return;
        setRequestId(rId);
        await sendPhotos(rId);

        // Initialiser le payment sheet — prix fixe (DIRECT_CHARGE flow).
        // Le client est débité immédiatement via PaymentIntent; le backend
        // transfèrera 80% au prestataire à l'acceptation, et refund si aucun
        // prestataire n'accepte dans le TTL du cron.
        // automatic_payment_methods côté backend => Stripe expose Card, Klarna,
        // Bancontact, Apple Pay, Google Pay selon montant/région. On ne force plus
        // d'ordre pour laisser Stripe prioriser la méthode la plus pertinente.
        // (id passé tel que renvoyé par le serveur — souvent numérique — sans String() :
        // le corps de /payments/setup reste identique.)
        const res: PaymentSetupResponse = await api.payments.setup(rId as string);
        // Store-review : { demo:true } → pas de charge, on saute la sheet ; /success
        // (branche démo) fera la transition PUBLISHED + broadcast au tap du CTA.
        if (res.demo) {
          if (!cancelled) { setBypassPayment(true); setPaymentReady(true); }
          return;
        }
        const { error } = await initPaymentSheet(fixedSheetParams(res));
        if (error) throw new Error(error.message);
        if (!cancelled) setPaymentReady(true);
      } catch (e) {
        if (!cancelled) {
          devError('Payment init error:', e);
          setPricingError(messageOf(e) || t('stepper.pricing_error'));
        }
      } finally {
        if (!cancelled) setPaymentInitLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, initAttempt]);

  // Confirme le paiement côté backend avec retry (max 3 tentatives, backoff 1s/2s).
  // Un seul cycle : après 3 échecs on throw — l'appelant affiche un CTA
  // "Réessayer" manuel (pas de récursion infinie, pas de navigation différée).
  const confirmPaymentSuccess = async (rId: RequestId): Promise<void> => {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      if (!mountedRef.current) return;
      try {
        await api.payments.success(String(rId));
        return;
      } catch (e) {
        lastErr = e;
        // Don't retry on auth errors — session is gone, retrying is pointless
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) break;
        if (attempt < 3) await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
    throw lastErr;
  };

  // CTA manuel après échec de confirmation (le débit Stripe a déjà eu lieu :
  // on ne re-présente JAMAIS la PaymentSheet, on rejoue seulement /success).
  const retryConfirmPayment = async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      await confirmPaymentSuccess(requestId);
      if (!mountedRef.current) return;
      setConfirmRetryNeeded(false);
      feedback.haptic('success');
      goToMissionView();
    } catch (e) {
      devError('retryConfirmPayment error:', e);
      if (mountedRef.current) feedback.error(t('stepper.confirm_retry_failed'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const goToMissionView = () => {
    // Montant réellement débité (prix verrouillé, remise déduite) ou callout seul
    // pour un devis — cf. chargedParams. Planifié → page de confirmation (pas de
    // recherche de provider) ; maintenant → suivi de mission.
    const { price, calloutFee: calloutParam } = chargedParams({
      isQuoteFlow, discountedCents: discountedCentsFixed, confirmedCalloutCents,
    });
    router.replace(buildMissionRoute({
      requestId, scheduleMode, serviceName, location, price, calloutFee: calloutParam,
      isQuoteFlow, scheduledLabel, nowLabel: t('stepper.now'),
    }));
  };

  // (Ré)initialise la feuille de paiement prix-fixe avec/sans code promo.
  // code=null → plein tarif. Ne consomme JAMAIS le code (brûlé au paiement réussi
  // seulement). Validation + remise 100% serveur. /setup est idempotent/rejouable.
  const refreshFixedSheet = async (code: string | null) => {
    if (!requestId) return;
    setPromoApplying(true);
    try {
      const res: PaymentSetupResponse = await api.payments.setup(requestId as string, code || undefined);
      const { error } = await initPaymentSheet(fixedSheetParams(res));
      if (error) throw new Error(error.message);
      setAppliedPromo(
        res.promo
          ? { code: res.promo.code, discountCents: res.promo.discountCents, nominalCents: res.promo.nominalCents }
          : null
      );
      setPaymentReady(true);
    } finally {
      setPromoApplying(false);
    }
  };

  const applyPromo = async (raw: string) => {
    const code = raw.trim();
    if (!code || !requestId) return;
    try {
      await refreshFixedSheet(code);
      feedback.haptic('success');
      setPromoSheetVisible(false);
    } catch (e) {
      // e.message = message FR renvoyé par le backend (PROMO_INVALID, _TOO_SMALL, _ALREADY_USED…)
      feedback.error(messageOf(e) || t('stepper.promo_invalid') || 'Code promo invalide.');
    }
  };

  const removePromo = async () => {
    feedback.haptic('light');
    try {
      await refreshFixedSheet(null);
    } catch (e) {
      devError('removePromo error:', e);
    }
  };

  const handlePay = async () => {
    if (!paymentReady || !requestId || confirmRetryNeeded) return;
    setLoading(true);
    try {
      // Service gratuit → pas de payment sheet, publication directe.
      // On ne navigue vers missionview QUE si la publication a réussi.
      if (isFreeService) {
        try {
          await api.payments.success(String(requestId));
        } catch (e) {
          devError('free publish error:', e);
          feedback.error(t('stepper.publish_failed'));
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
        return;
      }

      // Store-review DEMO (prix-fixe uniquement) : pas de PaymentSheet.
      // /success (branche démo) publie la mission + broadcast aux prestataires.
      if (bypassPayment) {
        // Flow devis démo : le backend (callout-payment démo) a déjà fait QUOTE_PENDING
        // + broadcast aux prestas — rien à confirmer, on navigue directement.
        if (isQuoteFlow) {
          if (!mountedRef.current) return;
          feedback.haptic('success');
          goToMissionView();
          return;
        }
        // Flow prix-fixe démo : /success publie la mission + broadcast aux prestataires.
        try {
          await confirmPaymentSuccess(requestId);
        } catch (e) {
          devError('demo confirm error:', e);
          if (mountedRef.current) {
            setConfirmRetryNeeded(true);
            feedback.error(t('stepper.confirm_failed_retry'));
          }
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
        return;
      }

      const { error: presentError } = await presentPaymentSheet();
      if (presentError) {
        if (presentError.code !== 'Canceled') {
          devError('Payment sheet error:', presentError.message);
          feedback.error(t('stepper.payment_failed'));
        }
        return;
      }

      if (isQuoteFlow) {
        // Confirmer le callout et lancer le broadcast aux providers
        try {
          await api.post('/quotes/confirm-callout', { requestId });
        } catch (e) {
          devError('confirm-callout error:', e);
          feedback.error(t('stepper.callout_confirm_failed'));
          return;
        }
        if (!mountedRef.current) return;
        feedback.haptic('success');
        goToMissionView();
      } else {
        try {
          await confirmPaymentSuccess(requestId);
        } catch (e) {
          // Le client a déjà été débité par Stripe → surtout ne pas re-présenter
          // la PaymentSheet : on propose une relance manuelle de la confirmation.
          devError('confirmPaymentSuccess error:', e);
          if (mountedRef.current) {
            setConfirmRetryNeeded(true);
            feedback.error(t('stepper.payment_ok_confirm_failed'));
          }
          return;
        }
        if (!mountedRef.current) return;
        goToMissionView();
      }
    } catch (error) {
      devError('handlePay error:', error);
      feedback.error(t('stepper.payment_generic_error'));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return {
    requestId, paymentReady, paymentInitLoading, pricingError, setPricingError, confirmedCalloutCents,
    setInitAttempt, confirmRetryNeeded, promoSheetVisible, setPromoSheetVisible, promoApplying, appliedPromo,
    displayPrice, nominalCentsFixed, discountedCentsFixed, retryConfirmPayment, applyPromo, removePromo, handlePay,
  };
}
