// app/request/NewRequestStepper.tsx
// Flow Intervention — 4 étapes premium + dark mode system-adaptive
// Les étapes sont rendues par components/request/stepper/* ; les calculs purs
// (zone, TVA, promo, planning, payloads) vivent dans lib/request/*.

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { View, ScrollView, StyleSheet, StatusBar, BackHandler } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView from 'react-native-maps';
import { useStripe } from '@stripe/stripe-react-native';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { feedback } from '@/lib/feedback/feedback';
import { translateCategory, translateSubcategory } from '@/lib/categoryLabel';
import i18nInstance from '@/lib/i18n';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAuth } from '@/lib/auth/AuthContext';
import { StepHeader } from '@/components/request/StepHeader';
import { StepPager, type PagerDirection } from '@/components/request/StepPager';
import { deriveCrumbs } from '@/lib/request/crumbs';
import { SplitPane, useSplitPane } from '@/lib/layout';
import { cameraSession } from '@/lib/request/cameraSession';
import { mergeShots, missingRequiredShots, nextQueue, shotsFor, uploadRequestPhotos, type LocalShot } from '@/lib/request/photos';
import { buildWeeks, findDay, type WeekDay } from '@/lib/scheduling/weeks';
import { computePrice } from '@/lib/services/priceService';
import { resolveServiceSelection } from '@/lib/services/serviceSelection';
import { buildProfileUpdate, type AccessProfile } from '@/lib/request/access';
import { extractArrayPayload, filterLaunchCategories, pickInitialCategory } from '@/lib/request/catalog';
import { resolveServiceVat } from '@/lib/request/pricing';
import {
  buildRequestDateIso, buildScheduledFor, buildScheduledLabel, getTimeGroups, isScheduleReady, type ScheduleMode,
} from '@/lib/request/schedule';
import type { PriceDetails, SavedAddress, StepperCategory, StepperLocation } from '@/lib/request/stepperTypes';
import { useStepperTheme } from '@/components/request/stepper/useStepperTheme';
import { DevisInfoModal } from '@/components/request/stepper/DevisInfoModal';
import { PromoSheet } from '@/components/request/stepper/PromoSheet';
import { PreferredBanner } from '@/components/request/stepper/PreferredBanner';
import { SaveAddressSheet } from '@/components/request/stepper/SaveAddressSheet';
import { StepLocation } from '@/components/request/stepper/StepLocation';
import { StepService } from '@/components/request/stepper/StepService';
import { StepPlanning } from '@/components/request/stepper/StepPlanning';
import { StepValidation } from '@/components/request/stepper/StepValidation';
import { AmountBlock, type AmountBlockProps } from '@/components/request/stepper/AmountBlock';
import { RecapBlock, type RecapBlockProps } from '@/components/request/stepper/RecapBlock';
import { usePaymentFlow } from '@/components/request/stepper/usePaymentFlow';

const TOTAL_STEPS = 4;

// Config des étapes
const getStepConfig = (t: TFunction) => [
  { label: t('stepper.step1_label'), sublabel: t('stepper.step1_sub'), icon: 'map-pin'     as const },
  { label: t('stepper.step2_label'), sublabel: t('stepper.step2_sub'), icon: 'tool'        as const },
  { label: t('stepper.step3_label'), sublabel: t('stepper.step3_sub'), icon: 'clock'       as const },
  { label: t('stepper.step4_label'), sublabel: t('stepper.step4_sub'), icon: 'check-circle' as const },
];

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function NewRequestStepper() {
  const router = useRouter();
  const theme  = useStepperTheme();
  const { t }  = useTranslation();
  const { user } = useAuth();
  // Champs d'accès du profil (buildingType, floor…) : renvoyés par /auth/me
  // mais absents du type UserData d'AuthContext.
  const profile = user as (NonNullable<typeof user> & AccessProfile) | null;
  const {
    selectedCategory: preselectedCategory,
    preferredProviderId,
    preferredProviderName,
    forceScheduled,
  } = useLocalSearchParams<{
    selectedCategory?: string;
    preferredProviderId?: string;
    preferredProviderName?: string;
    forceScheduled?: string;
  }>();
  const mapRef    = useRef<MapView | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => { return () => { mountedRef.current = false; }; }, []);
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  // Sens de la prochaine transition d'étape (StepPager) : 1 en avant, -1 en arrière.
  // En état (posé avec setStep, même lot) : il est lu pendant le rendu.
  const [dir, setDir] = useState<PagerDirection>(1);
  // Distance entre le haut de la fenêtre et le contenu de l'étape : inset haut +
  // en-tête mesuré. C'est l'offset exact du KeyboardAvoidingView de l'étape 2 —
  // un « 100 » en dur laissait le bouton trop haut au-dessus du clavier.
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);

  const [step,    setStep]    = useState(1);
  const [loading, setLoading] = useState(false);

  // ── Préférence prestataire (CTA "Demander X" depuis fiche provider) ──
  // Stockée localement pour permettre au client de retirer la préférence en
  // cours de stepper s'il change d'avis (banner avec X).
  const [preferred, setPreferred] = useState<{ id: string; name: string } | null>(
    preferredProviderId ? { id: preferredProviderId, name: preferredProviderName || t('stepper.this_provider') } : null,
  );

  // Étape 1
  const [location, setLocation] = useState<StepperLocation | null>(null);
  const [locationAllowed, setLocationAllowed] = useState<boolean>(true);
  const [addressMissingNumber, setAddressMissingNumber] = useState<boolean>(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [showSaveSheet, setShowSaveSheet] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAddrDropdown, setShowAddrDropdown] = useState(false);

  // ── Saved addresses fetch ──
  useEffect(() => {
    if (step === 1) {
      api.addresses.list().then((res: SavedAddress[] | { data?: SavedAddress[] } | null) => {
        setSavedAddresses(Array.isArray(res) ? res : res?.data || []);
      }).catch(() => {});
    }
  }, [step]);

  // Save new address from "+" button (with label sheet)
  const handleSaveNewAddress = async () => {
    if (!location || !saveLabel.trim()) return;
    setSaving(true);
    try {
      const created: SavedAddress = await api.addresses.create({
        label: saveLabel.trim(),
        address: location.address,
        lat: location.lat,
        lng: location.lng,
      });
      setSavedAddresses(prev => [created, ...prev]);
      setShowSaveSheet(false);
      setSaveLabel('');
      feedback.haptic('success');
    } catch {
      feedback.error(t('addresses.max_reached'));
    } finally {
      setSaving(false);
    }
  };

  // Étape 2
  const [categories,    setCategories]    = useState<StepperCategory[]>([]);
  const [categoryId,    setCategoryId]    = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [description,   setDescription]  = useState('');
  const [noteOpen,      setNoteOpen]      = useState(false);
  // Photos guidées par la prestation (planche 1A) : prises locales, envoyées
  // à l'étape 4 juste après la création de la demande.
  const [shots,         setShots]         = useState<LocalShot[]>([]);

  // Étape 3
  // Semaines du planning (5 semaines à partir du lundi courant) — lib/scheduling/weeks.
  const weeks = useMemo(() => buildWeeks(new Date(), 5), []);
  const DAY_KEYS = ['day_sun', 'day_mon', 'day_tue', 'day_wed', 'day_thu', 'day_fri', 'day_sat'] as const;
  const dayLabel = (d: WeekDay) => (d.isToday ? t('stepper.today') : t(`stepper.${DAY_KEYS[d.dayIndex]}`));
  const monthLabel = (m: number) => t(`stepper.month_long_${m}`);
  // Si l'utilisateur a choisi "Planifier avec X" (preferred busy/offline), on
  // pré-positionne le mode "later" pour qu'il sélectionne directement une date.
  const [scheduleMode,   setScheduleMode]   = useState<ScheduleMode>(
    forceScheduled === '1' ? 'later' : null,
  );
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const selectedDay = findDay(weeks, selectedDayIso);
  const [selectedTime,   setSelectedTime]   = useState<string | null>(null);
  const [isUrgent,       setIsUrgent]       = useState(false);

  // Infos d'accès (profil client enrichi)
  const [accessExpanded,  setAccessExpanded]  = useState(false);
  const [buildingType,    setBuildingType]    = useState<string | null>(profile?.buildingType || null);
  const [floorNum,        setFloorNum]        = useState<string>(profile?.floor != null ? String(profile.floor) : '');
  const [hasElevator,     setHasElevator]     = useState<boolean | null>(profile?.hasElevator ?? null);
  // TVA : logement de +10 ans (cas du taux réduit 6%). Défaut true (bâti ancien majoritaire).
  const [buildingOver10y, setBuildingOver10y] = useState<boolean>(true);
  // accessNotes (digicode/instructions) NE doit PAS être pré-rempli depuis User :
  // c'est une info contextuelle à chaque mission (code change, instructions ponctuelles,
  // « laisser au gardien », etc.). Re-saisie obligatoire à chaque demande pour éviter
  // de propager par erreur les instructions d'une mission précédente.
  const [accessNotes,     setAccessNotes]     = useState<string>('');
  const [clientLanguage,  setClientLanguage]  = useState<string | null>(profile?.language || null);

  // Dérivés
  const selectedCategory    = useMemo(() => categories.find((c) => c.id === categoryId) || null, [categories, categoryId]);
  const selectedSubcategory = useMemo(
    () => selectedCategory?.subcategories?.find((s) => s.id === subcategoryId) || null,
    [selectedCategory, subcategoryId]
  );
  // Flow de paiement + réservabilité du service choisi. Logique extraite dans
  // lib/services/serviceSelection.ts : elle doit rester alignée sur le serveur
  // (un prix inconnu n'est PAS gratuit), sinon l'étape 4 annonce « Service
  // gratuit » et /requests répond 400 PRICING_TOKEN_REQUIRED — le CTA meurt.
  // C'est exactement le rejet Apple 2.1(a) du 18/08/2026.
  const selection = useMemo(
    () => resolveServiceSelection(selectedCategory, selectedSubcategory),
    [selectedCategory, selectedSubcategory],
  );
  const {
    basePrice, pricingMode, calloutFee, isFreeService, isQuoteFlow,
    serviceChosen, categoryUnavailable,
  } = selection;
  // Consignes de la prestation choisie et prises requises encore manquantes.
  const shotSpecs = useMemo(() => shotsFor(selectedSubcategory?.slug), [selectedSubcategory?.slug]);
  const missingShots = useMemo(() => missingRequiredShots(shots, shotSpecs), [shots, shotSpecs]);
  const openCamera = (fromKey: string | null) => {
    cameraSession.start(nextQueue(shotSpecs, shots, fromKey), (taken) => setShots((cur) => mergeShots(cur, taken)));
    router.push('/request/camera');
  };
  const removeFreeShot = (index: number) => setShots((cur) => cur.filter((_, i) => i !== index));
  /** Après la création de la demande : envoi des photos, sans bloquer le paiement. */
  const sendPhotos = async (rId: number | string) => {
    if (shots.length === 0) return;
    const { failed } = await uploadRequestPhotos(rId, shots, (id, form) => api.requestPhotos.upload(id, form));
    if (failed > 0) feedback.toast(t('stepper.photos_upload_failed', { count: failed }), 'info');
  };

  // Sens de la poussée de la liste quand on change de catégorie (ordre des pilules).
  // Index précédent mémorisé en état et mis à jour pendant le rendu (motif React
  // « valeur précédente ») : StepPager lit le sens au rendu où la page change.
  const categoryIndex = Math.max(0, categories.findIndex((c) => c.id === categoryId));
  const [rail, setRail] = useState<{ index: number; dir: PagerDirection }>({ index: categoryIndex, dir: 1 });
  if (rail.index !== categoryIndex) setRail({ index: categoryIndex, dir: categoryIndex >= rail.index ? 1 : -1 });
  const railDirection = rail.dir;

  // TVA service : 6% / 21% — règle dans lib/request/pricing.ts (resolveServiceVat).
  const { vatEligible, privateUse, vatRate } = resolveServiceVat({
    category: selectedCategory, subcategory: selectedSubcategory, buildingType, buildingOver10y,
  });
  // serviceName est passé en param URL aux écrans suivants (missionview, tracking).
  // On le génère dans la langue active i18n via translateSubcategory + translateCategory
  // pour que le titre s'affiche traduit (ex: "Druk bijvullen" en NL au lieu de
  // "Regonflage pression chaudière" en FR).
  const serviceName     = (selectedSubcategory ? translateSubcategory(i18nInstance.language, selectedSubcategory) : null)
                        || (selectedCategory ? translateCategory(t, selectedCategory) : null)
                        || null;
  const scheduledLabel  = buildScheduledLabel({
    mode: scheduleMode, dayIso: selectedDayIso, time: selectedTime, day: selectedDay, dayLabel, nowLabel: t('stepper.now'),
  });
  const scheduledFor = buildScheduledFor(scheduleMode, selectedDayIso, selectedTime);
  // Pour "now", on fixe la date au moment du choix (pas à chaque render)
  const requestDateIso  = useMemo(
    () => buildRequestDateIso(scheduleMode, selectedDayIso, selectedTime),
    [scheduleMode, selectedDayIso, selectedTime],
  );
  const priceDetails    = useMemo<PriceDetails>(() => computePrice({
    baseRate:    basePrice,
    hours:       1,
    isUrgent,
    distanceKm:  0,
    useFlatTravel: true,
    requestDate: new Date(requestDateIso),
    isFlat:      true,
    flatAmount:  basePrice,
    vatRate,
  }), [basePrice, isUrgent, requestDateIso, vatRate]);
  const step3Ready = isScheduleReady(scheduleMode, selectedDayIso, selectedTime);

  // Chargement catégories
  useEffect(() => {
    (async () => {
      try {
        const response = await api.get('/categories');
        // Catalogue actuel — seulement Plomberie et Serrurerie (lib/request/catalog.ts)
        setCategories(filterLaunchCategories(extractArrayPayload<StepperCategory>(response)));
      } catch (e) {
        devError('Categories load error:', e);
      }
    })();
  }, []);

  // Le rail est toujours posé sur une catégorie : celle demandée par le
  // paramètre `selectedCategory` (CTA « Demander » depuis une fiche), sinon la première.
  useEffect(() => {
    if (categories.length === 0 || categoryId !== null) return;
    setCategoryId(pickInitialCategory(categories, preselectedCategory).id);
  }, [categories, categoryId, preselectedCategory]);

  const goNext = () => {
    feedback.haptic('medium');
    // Save access info to user profile when leaving Step 3.
    // ⚠️ accessNotes EXCLU volontairement (cf. buildProfileUpdate) : le snapshot
    // per-mission est géré via accessSnapshot dans le payload de création.
    if (step === 3) {
      const profileUpdate = buildProfileUpdate({ buildingType, floorNum, hasElevator, clientLanguage });
      if (Object.keys(profileUpdate).length > 0) {
        api.patch('/me', profileUpdate).catch(() => {});
      }
    }
    setDir(1);
    setStep((p) => Math.min(p + 1, TOTAL_STEPS));
  };
  const goBack = () => {
    feedback.haptic('light');
    if (step === 1) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/dashboard');
    } else {
      setDir(-1);
      setStep((p) => p - 1);
    }
  };
  /** Puce de l'en-tête : revenir à une étape déjà franchie. */
  const goTo = (target: number) => {
    if (target >= step) return;
    setDir(-1);
    setStep(target);
  };

  // Android : le retour physique revient à l'étape précédente au lieu de
  // quitter le stepper (perte de saisie). À l'étape 1 → confirmation.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step > 1) {
        goBack();
        return true;
      }
      feedback.confirm({
        title:       t('stepper.quit_title'),
        message:     t('stepper.quit_msg'),
        confirm:     t('stepper.quit_confirm'),
        cancel:      t('common.continue'),
        destructive: true,
      }).then((ok) => {
        if (!ok || !mountedRef.current) return;
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/dashboard');
      });
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Étape 4 — paiement
  const [devisModalVisible, setDevisModalVisible] = useState(false);
  const {
    paymentReady, paymentInitLoading, pricingError, setPricingError, confirmedCalloutCents, setInitAttempt,
    confirmRetryNeeded, promoSheetVisible, setPromoSheetVisible, promoApplying, appliedPromo, displayPrice,
    nominalCentsFixed, discountedCentsFixed, retryConfirmPayment, applyPromo, removePromo, handlePay,
  } = usePaymentFlow({
    t, router, initPaymentSheet, presentPaymentSheet, mountedRef, setLoading, step,
    selectedCategory, selectedSubcategory, categoryId, subcategoryId, description, location,
    scheduleMode, selectedDayIso, selectedTime, scheduledFor, scheduledLabel, serviceName,
    isUrgent, buildingOver10y, buildingType, floorNum, hasElevator, accessNotes, clientLanguage,
    preferred, isFreeService, isQuoteFlow, pricingMode, vatEligible, privateUse, priceDetails, sendPhotos,
  });

  const STEPS = getStepConfig(t);
  const TIME_GROUPS = getTimeGroups(t);
  const currentStep = STEPS[step - 1] || STEPS[STEPS.length - 1];

  // Contenu de chaque étape. Le pager (StepPager, keepMounted) garde les pages
  // visitées montées : la carte de l'étape 1 et le défilement des listes
  // survivent aux allers-retours, rien ne se recharge.
  const isSplit = useSplitPane();

  // ── Montant et récapitulatif ─────────────────────────────────────────────
  // Étape 4 sur compact ; volet droit vivant à toutes les étapes une fois
  // déplié (maquette « Le prix qu'on voit bouger », moment 10).
  const amountProps: AmountBlockProps = {
    theme, isFreeService, isQuoteFlow, paymentInitLoading, confirmedCalloutCents, calloutFee,
    subcategory: selectedSubcategory,
    onOpenDevis: () => setDevisModalVisible(true),
    appliedPromo, displayPrice, discountedCentsFixed, nominalCentsFixed,
  };
  const recapProps: RecapBlockProps = {
    theme, location, categoryIcon: selectedCategory?.icon, serviceName, scheduledLabel, isUrgent,
    isFreeService, isQuoteFlow, appliedPromo, promoApplying,
    onRemovePromo: removePromo,
    onOpenPromo: () => setPromoSheetVisible(true),
  };

  const renderStep = (n: number | string) => (
    <>

        {/* ══ ÉTAPE 1 — Lieu ══ */}
        {n === 1 && (
          <StepLocation
            theme={theme}
            mapRef={mapRef}
            location={location}
            setLocation={setLocation}
            locationAllowed={locationAllowed}
            setLocationAllowed={setLocationAllowed}
            addressMissingNumber={addressMissingNumber}
            setAddressMissingNumber={setAddressMissingNumber}
            savedAddresses={savedAddresses}
            showAddrDropdown={showAddrDropdown}
            setShowAddrDropdown={setShowAddrDropdown}
            onOpenSaveSheet={() => setShowSaveSheet(true)}
            onNext={goNext}
          />
        )}

        {/* Rename / Save address sheet */}
        {showSaveSheet && (
          <SaveAddressSheet
            theme={theme}
            address={location?.address}
            saveLabel={saveLabel}
            setSaveLabel={setSaveLabel}
            saving={saving}
            onClose={() => setShowSaveSheet(false)}
            onSave={handleSaveNewAddress}
          />
        )}

        {/* ══ ÉTAPE 2 — Service (planche 2A : rail de catégories, lignes sans montant) ══ */}
        {n === 2 && (
          <StepService
            theme={theme}
            keyboardOffset={insets.top + headerHeight}
            categories={categories}
            categoryId={categoryId}
            onSelectCategory={(id) => { setCategoryId(id); setSubcategoryId(null); }}
            railDirection={railDirection}
            selectedCategory={selectedCategory}
            subcategoryId={subcategoryId}
            setSubcategoryId={setSubcategoryId}
            shotSpecs={shotSpecs}
            shots={shots}
            openCamera={openCamera}
            removeFreeShot={removeFreeShot}
            categoryUnavailable={categoryUnavailable}
            noteOpen={noteOpen}
            setNoteOpen={setNoteOpen}
            description={description}
            setDescription={setDescription}
            isQuoteFlow={isQuoteFlow}
            serviceChosen={serviceChosen}
            missingShots={missingShots}
            onNext={goNext}
          />
        )}

        {/* ══ ÉTAPE 3 — Planning (planche 3A : segmenté, semaine, grille horaire) ══ */}
        {n === 3 && (
          <StepPlanning
            theme={theme}
            weeks={weeks}
            scheduleMode={scheduleMode}
            setScheduleMode={setScheduleMode}
            selectedDayIso={selectedDayIso}
            setSelectedDayIso={setSelectedDayIso}
            selectedDay={selectedDay}
            selectedTime={selectedTime}
            setSelectedTime={setSelectedTime}
            dayLabel={dayLabel}
            monthLabel={monthLabel}
            timeGroups={TIME_GROUPS}
            isUrgent={isUrgent}
            setIsUrgent={setIsUrgent}
            isQuoteFlow={isQuoteFlow}
            vatEligible={vatEligible}
            vatRate={vatRate}
            buildingOver10y={buildingOver10y}
            setBuildingOver10y={setBuildingOver10y}
            accessExpanded={accessExpanded}
            setAccessExpanded={setAccessExpanded}
            access={{
              theme, buildingType, setBuildingType, floorNum, setFloorNum, hasElevator, setHasElevator,
              accessNotes, setAccessNotes, clientLanguage, setClientLanguage,
            }}
            step3Ready={step3Ready}
            onNext={goNext}
          />
        )}

        {/* ══ ÉTAPE 4 — Validation ══ */}
        {n === 4 && (
          <StepValidation
            theme={theme}
            isSplit={isSplit}
            amount={amountProps}
            recap={recapProps}
            pricingError={pricingError}
            paymentInitLoading={paymentInitLoading}
            onRetryInit={() => { setPricingError(null); setInitAttempt(a => a + 1); }}
            confirmRetryNeeded={confirmRetryNeeded}
            loading={loading}
            onRetryConfirm={retryConfirmPayment}
            isFreeService={isFreeService}
            isQuoteFlow={isQuoteFlow}
            confirmedCalloutCents={confirmedCalloutCents}
            calloutFee={calloutFee}
            discountedCentsFixed={discountedCentsFixed}
            paymentReady={paymentReady}
            onPay={handlePay}
          />
        )}

    </>
  );

  return (
    <SafeAreaView style={[s.root, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />

      {/* ── En-tête : retour, titre, ligne de progression, puces (planche 1A) ── */}
      <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
      <StepHeader
        step={step}
        total={TOTAL_STEPS}
        title={currentStep.label}
        onBack={goBack}
        backLabel={t('common.back')}
        crumbs={deriveCrumbs({ step, address: location?.address ?? null, serviceName })}
        onJump={goTo}
      />

      {/* ── Préférence prestataire (CTA "Demander X" depuis fiche) ── */}
      {preferred && (
        <PreferredBanner theme={theme} name={preferred.name} onRemove={() => setPreferred(null)} />
      )}
      </View>

      {/* ── Contenu de l'étape, poussé latéralement à chaque changement ── */}
      {/* Déplié : le récapitulatif vit à droite pendant tout le tunnel, le
          montant compte à chaque choix (urgent, créneau, promo). */}
      <SplitPane
        master={<StepPager page={step} direction={dir} render={renderStep} keepMounted style={s.flex} />}
        detail={isSplit ? (
          <ScrollView contentContainerStyle={s.recapPane} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <RecapBlock {...recapProps} />
            {selectedSubcategory ? <AmountBlock {...amountProps} /> : null}
          </ScrollView>
        ) : null}
      />
      <DevisInfoModal
        visible={devisModalVisible}
        onClose={() => setDevisModalVisible(false)}
        pricingMode={pricingMode}
        theme={theme}
      />
      <PromoSheet
        visible={promoSheetVisible}
        onClose={() => { if (!promoApplying) setPromoSheetVisible(false); }}
        onApply={applyPromo}
        applying={promoApplying}
        theme={theme}
      />
    </SafeAreaView>
  );
}

// ─── Styles globaux — valeurs structurelles seulement ─────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  recapPane: { paddingTop: 16, paddingRight: 20, paddingBottom: 32, gap: 18 },
});
