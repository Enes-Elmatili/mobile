// app/onboarding/provider/pending.tsx — Validation : attente ACTIVE (dark design)
// Redesign onboarding : timeline du dossier + ETA 24 h, actions de profil à
// compléter pendant l'attente, et libération explicite (« vous pouvez fermer
// l'app »). Succès animé avant la bascule vers le dashboard.
// Rendu : components/onboarding/pending/* ; dérivations pures (état du dossier,
// timeline, statuts) : lib/onboarding/pendingDossier.ts.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, StyleSheet, StatusBar, ScrollView, Platform, KeyboardAvoidingView,
} from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import type { Href } from "expo-router";
import { MOTION } from "@/lib/motion/springs";
import { useGlow, usePulse } from "@/lib/motion/useLoops";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "../../../lib/api";
import { tokenStorage } from "../../../lib/storage";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useSocket } from "../../../lib/SocketContext";
import { FONTS, COLORS } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { fetchProviderTrades, type ProviderTrades } from "@/lib/providerOnboarding";
import {
  BIO_MIN_LENGTH,
  companyFlagsFromProvider,
  deriveDossier,
  hasBioText,
  incompleteReason,
  pendingFirstName,
  resumeRoute,
  statusFromValidation,
  timelineRows,
  type CompanyFlags,
  type PendingDoc,
  type PendingStatus,
} from "@/lib/onboarding/pendingDossier";
import { useLayoutClass } from "@/lib/layout";
import { C, ps } from "@/components/onboarding/pending/pendingTheme";
import { PendingBackdrop } from "@/components/onboarding/pending/PendingBackdrop";
import { PendingTimeline } from "@/components/onboarding/pending/PendingTimeline";
import { PendingIncompleteCard, PendingRejectedDocs } from "@/components/onboarding/pending/PendingDossierCards";
import { PendingPrepSection } from "@/components/onboarding/pending/PendingPrepSection";
import { PendingFooter, PendingLogoutButton } from "@/components/onboarding/pending/PendingFooter";
import { PendingOutcome } from "@/components/onboarding/pending/PendingOutcome";

/** Charge utile de `provider:validation_updated`. */
interface ValidationUpdate {
  validationStatus?: string;
  rejectionReason?: string | null;
}

export default function PendingValidation() {
  const { width: SCREEN_W } = useLayoutClass();
  const { signOut, user, refreshMe } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<PendingStatus>("pending");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [documents, setDocuments] = useState<PendingDoc[]>([]);
  const stripeConnectedRef = useRef(false);
  // Métiers du prestataire : ils déterminent le nombre de pièces exigées
  // (6 pour un métier non réglementé, 7 sinon). Chargés une fois.
  const [trades, setTrades] = useState<ProviderTrades | null>(null);
  // Entreprise : BCE confirmé VIES + IBAN — exigés par le garde d'activation
  // au même titre que les pièces. null = pas encore lu.
  const [company, setCompany] = useState<CompanyFlags | null>(null);
  const tradesRef = useRef<ProviderTrades | null>(null);

  // Profil : actions « en attendant »
  const [photoDone, setPhotoDone] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioDone, setBioDone] = useState(false);
  const hasPhoto = photoDone || !!user?.avatarUrl;
  const hasBio = bioDone || hasBioText(user?.bio);

  // Entrer dans les onglets une fois validé. Le garde de (tabs)/_layout lit
  // `user.providerStatus` dans AuthContext : tant qu'il dit encore PENDING, les
  // onglets renvoient ici, cet écran voit ACTIVE, renvoie aux onglets… en
  // boucle, jusqu'à ce que l'utilisateur tue l'app. On rafraîchit donc le
  // profil d'abord, et on ne part que si le serveur confirme ACTIVE ; sinon on
  // réessaie quelques fois (la validation vient d'être écrite, /auth/me suit).
  const goingLiveRef = useRef(false);
  const goLive = useCallback(async () => {
    if (goingLiveRef.current) return;
    goingLiveRef.current = true;
    try {
      for (let attempt = 0; attempt < 5; attempt++) {
        const me = await refreshMe().catch(() => null);
        if (me?.providerStatus === "ACTIVE") {
          router.replace("/(tabs)/dashboard");
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      feedback.error(t("onboarding.approved_refresh_failed"));
    } finally {
      goingLiveRef.current = false;
    }
  }, [refreshMe, t]);

  // Validé : succès, puis bascule vers les onglets après l'animation.
  function markApproved() {
    setStatus("approved");
    feedback.haptic('success');
    setTimeout(() => { goLive(); }, 2500);
  }

  async function checkStatus() {
    try {
      const [validationRes, stripeRes, docsRes, tradesRes, meRes] = await Promise.all([
        api.providers.validationStatus(),
        !stripeConnectedRef.current ? api.connect.status() : null,
        api.providerDocs.list(),
        !tradesRef.current ? fetchProviderTrades() : null,
        api.providers.me().catch(() => null),
      ]);

      if (docsRes?.documents) setDocuments(docsRes.documents);
      if (meRes?.provider) setCompany(companyFlagsFromProvider(meRes.provider));

      if (tradesRes) {
        tradesRef.current = tradesRes;
        setTrades(tradesRes);
      }

      if (stripeRes) {
        const connected = !!stripeRes.isStripeReady;
        stripeConnectedRef.current = connected;
        setStripeConnected(connected);
      }

      // PENDING n'est pas un état final : on continue d'interroger.
      const next = statusFromValidation(validationRes?.providerStatus);
      if (next === "approved") {
        markApproved();
        return true;
      } else if (next && next !== "pending") {
        setRejectionReason(validationRes?.rejectionReason ?? null);
        setStatus(next);
        return true;
      }
    } catch {
      // Interrogation périodique : un échec réseau est réessayé au tour suivant.
    }
    return false;
  }

  // Polling fallback (30s)
  useEffect(() => {
    checkStatus();
    const interval = setInterval(async () => {
      const done = await checkStatus();
      if (done) clearInterval(interval);
    }, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vérification unique au montage ; le socket prend le relais
  }, []);

  // Real-time: instant update when admin validates
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = (data: ValidationUpdate) => {
      const next = statusFromValidation(data.validationStatus);
      if (next === 'approved') {
        markApproved();
      } else if (next === 'pending') {
        setRejectionReason(null);
        setStatus('pending');
      } else if (next) {
        setRejectionReason(data.rejectionReason ?? null);
        setStatus(next);
      }
    };
    socket.on('provider:validation_updated', handler);
    return () => { socket.off('provider:validation_updated', handler); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- abonnement au socket seulement
  }, [socket]);

  // ── Actions profil ─────────────────────────────────────────────────────────
  const handleAddPhoto = useCallback(async () => {
    if (photoBusy) return;
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== "granted") {
      feedback.error(t('onboarding.pending_photo_perm'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.6, allowsEditing: true, aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhotoBusy(true);
    try {
      const token = await tokenStorage.getToken();
      if (!token) throw new Error("Not authenticated");
      const formData = new FormData();
      // @ts-ignore
      formData.append("avatar", { uri: asset.uri, name: "avatar.jpg", type: asset.mimeType ?? "image/jpeg" });
      const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, ...(__DEV__ ? { "ngrok-skip-browser-warning": "true" } : {}) },
        body: formData,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      setPhotoDone(true);
      feedback.success(t('onboarding.pending_photo_ok'));
      refreshMe().catch(() => {});
    } catch {
      feedback.error(t('onboarding.pending_photo_fail'));
    } finally {
      setPhotoBusy(false);
    }
  }, [photoBusy, refreshMe, t]);

  const handleSaveBio = useCallback(async () => {
    const bio = bioDraft.trim();
    if (bio.length < BIO_MIN_LENGTH) {
      feedback.error(t('onboarding.pending_bio_short'));
      return;
    }
    setBioSaving(true);
    try {
      await api.patch("/me", { bio });
      setBioDone(true);
      setBioOpen(false);
      feedback.success(t('onboarding.pending_bio_ok'));
      refreshMe().catch(() => {});
    } catch (e: unknown) {
      feedback.error((e as { message?: string } | null)?.message || t('onboarding.pending_bio_fail'));
    } finally {
      setBioSaving(false);
    }
  }, [bioDraft, refreshMe, t]);

  // Animations : halo qui respire, chip « EN VALIDATION » qui pulse, coche
  // de succès qui atterrit (MOTION.land).
  const glowStyle = useGlow();
  const chipPulseStyle = usePulse(status === "pending", { duration: 1100 });
  const successScale = useSharedValue(0);
  useEffect(() => {
    if (status !== "approved") return;
    successScale.value = withSpring(1, MOTION.land);
  }, [status, successScale]);
  const successStyle = useAnimatedStyle(() => ({ transform: [{ scale: successScale.value }] }));

  const firstName = pendingFirstName(user);
  const rejectedDocs = documents.filter(d => d.status === "REJECTED");

  // ── État réel du dossier (cf. lib/onboarding/pendingDossier.ts) ─────────────
  const dossier = deriveDossier({ trades, documents, company });
  const { fileIncomplete } = dossier;

  const resumeOnboarding = () => {
    feedback.haptic('medium');
    router.push(resumeRoute({ trades, company, documents, stripeConnected }) as Href);
  };

  // ── PENDING : attente active ────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" />
        <PendingBackdrop screenWidth={SCREEN_W} glowStyle={glowStyle} />

        <KeyboardAvoidingView
          style={s.flex}
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header : kicker + chip statut */}
          <View style={s.headerRow}>
            <Text style={s.kicker}>{t('onboarding.pending_kicker')}</Text>
            <View style={s.chip}>
              <Animated.View style={[s.chipDot, chipPulseStyle]} />
              <Text style={s.chipText}>
                {fileIncomplete ? t('onboarding.pending_chip_incomplete') : t('onboarding.pending_chip')}
              </Text>
            </View>
          </View>

          <Text style={s.titleLeft}>
            {t('onboarding.pending_title_l1')}{"\n"}
            <Text style={ps.titleOutline}>
              {firstName
                ? t('onboarding.pending_title_l2_name', { name: firstName.toUpperCase() })
                : t('onboarding.pending_title_l2')}
            </Text>
          </Text>
          <Text style={s.subtitleLeft}>
            {fileIncomplete ? t('onboarding.pending_sub_incomplete') : t('onboarding.pending_sub')}
          </Text>

          {/* Timeline du dossier */}
          <PendingTimeline rows={timelineRows(dossier, stripeConnected)} />

          {fileIncomplete && (
            <PendingIncompleteCard reason={incompleteReason(dossier, company)} onResume={resumeOnboarding} />
          )}

          {rejectedDocs.length > 0 && (
            <PendingRejectedDocs
              docs={rejectedDocs}
              onFix={() => { feedback.haptic('medium'); router.push("/onboarding/documents"); }}
            />
          )}

          {/* En attendant : complétez votre profil */}
          <PendingPrepSection
            hasPhoto={hasPhoto}
            photoBusy={photoBusy}
            onAddPhoto={handleAddPhoto}
            hasBio={hasBio}
            bioOpen={bioOpen}
            onToggleBio={() => { feedback.haptic('light'); setBioOpen(o => !o); }}
            bioDraft={bioDraft}
            onChangeBioDraft={setBioDraft}
            bioSaving={bioSaving}
            onSaveBio={handleSaveBio}
          />
        </ScrollView>
        </KeyboardAvoidingView>

        <PendingFooter
          fileIncomplete={fileIncomplete}
          stripeConnected={stripeConnected}
          onResume={resumeOnboarding}
          onStripe={(haptic) => {
            feedback.haptic(haptic);
            router.push("/onboarding/provider/stripe-connect");
          }}
          bottomInset={insets.bottom}
          onSignOut={signOut}
        />
      </View>
    );
  }

  // ── APPROVED / REJECTED / SUSPENDED / BANNED : layouts centrés ─────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" />
      <PendingBackdrop screenWidth={SCREEN_W} glowStyle={glowStyle} />

      <View style={s.content}>
        <PendingOutcome
          status={status}
          rejectionReason={rejectionReason}
          successStyle={successStyle}
          onGoLive={goLive}
          onNavigate={(route) => router.push(route as Href)}
        />
      </View>

      <View style={ps.footer}>
        <PendingLogoutButton bottomInset={insets.bottom} onSignOut={signOut} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  scrollContent: {
    paddingHorizontal: 28,
    paddingBottom: 24,
    zIndex: 2,
  },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  kicker: {
    fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 2.6,
    color: C.grey, textTransform: "uppercase",
  },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100,
    backgroundColor: alpha(COLORS.amber, 0.12),
    borderWidth: 1, borderColor: alpha(COLORS.amber, 0.3),
  },
  chipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.amber },
  chipText: {
    fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1.4,
    color: C.amber, textTransform: "uppercase",
  },

  titleLeft: {
    fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 38, color: C.white,
    letterSpacing: 1, lineHeight: 41,
  },
  subtitleLeft: {
    fontFamily: FONTS.sansLight, fontSize: 13.5, color: C.grey,
    lineHeight: 21, marginTop: 14, marginBottom: 20,
  },

  content: {
    flex: 1, justifyContent: "center", alignItems: "center",
    paddingHorizontal: 28, gap: 16, zIndex: 2,
  },
});
