// app/onboarding/provider/pending.tsx — Validation : attente ACTIVE (dark design)
// Redesign onboarding : timeline du dossier + ETA 24 h, actions de profil à
// compléter pendant l'attente, et libération explicite (« vous pouvez fermer
// l'app »). Succès animé avant la bascule vers le dashboard.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  StatusBar, Dimensions, Animated, Easing, ScrollView, Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Line } from "react-native-svg";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "../../../lib/api";
import { tokenStorage } from "../../../lib/storage";
import { useAuth } from "../../../lib/auth/AuthContext";
import { useSocket } from "../../../lib/SocketContext";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import { PulseDot } from '@/components/ui/PulseDot';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const GRID_SIZE = 40;

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  bg:          darkTokens.bg,
  white:       darkTokens.text,
  grey:        darkTokens.textMuted,
  faint:       alpha(darkTokens.text, 0.3),
  border:      alpha(darkTokens.text, 0.08),
  cardBg:      darkTokens.cardBg,
  green:       COLORS.greenBrand,
  amber:       COLORS.amber,
  red:         COLORS.red,
  outlineText: alpha(darkTokens.text, 0.3),
};

function GridLines() {
  const cols = Math.ceil(SCREEN_W / GRID_SIZE) + 1;
  const rows = Math.ceil(SCREEN_H / GRID_SIZE) + 1;
  const stroke = alpha(darkTokens.text, 0.025);
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H} style={StyleSheet.absoluteFill}>
        {Array.from({ length: cols }, (_, i) => (
          <Line key={`v${i}`} x1={i * GRID_SIZE} y1={0} x2={i * GRID_SIZE} y2={SCREEN_H} stroke={stroke} strokeWidth={1} />
        ))}
        {Array.from({ length: rows }, (_, i) => (
          <Line key={`h${i}`} x1={0} y1={i * GRID_SIZE} x2={SCREEN_W} y2={i * GRID_SIZE} stroke={stroke} strokeWidth={1} />
        ))}
      </Svg>
      <LinearGradient
        colors={["transparent", "transparent", C.bg]}
        locations={[0, 0.35, 0.75]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        pointerEvents="none"
      />
    </View>
  );
}

interface DocStatus {
  id: string;
  docKey: string;
  status: string;
  rejectionReason?: string | null;
}

type TimelineState = "done" | "active" | "idle";

function TimelineRow({ label, state, eta, last }: { label: string; state: TimelineState; eta?: string; last?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (state !== "active") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [state]);

  return (
    <View style={tl.row}>
      <View style={tl.rail}>
        <View
          style={[
            tl.dot,
            state === "done" && tl.dotDone,
            state === "active" && tl.dotActive,
          ]}
        >
          {state === "done" && <Feather name="check" size={11} color={C.bg} />}
          {state === "active" && <Animated.View style={[tl.dotPulse, { opacity: pulse }]} />}
        </View>
        {!last && <View style={[tl.connector, state === "done" && tl.connectorDone]} />}
      </View>
      <View style={[tl.textWrap, last && { paddingBottom: 0 }]}>
        <Text style={[tl.label, state === "idle" && tl.labelIdle]}>{label}</Text>
        {state === "active" && !!eta && <Text style={tl.eta}>{eta}</Text>}
      </View>
    </View>
  );
}

const tl = StyleSheet.create({
  row: { flexDirection: "row", gap: 13 },
  rail: { alignItems: "center" },
  dot: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: alpha(darkTokens.text, 0.05),
    borderWidth: 1.5, borderColor: alpha(darkTokens.text, 0.15),
    alignItems: "center", justifyContent: "center",
  },
  dotDone: { backgroundColor: C.white, borderColor: C.white },
  dotActive: { borderColor: alpha(darkTokens.text, 0.6) },
  dotPulse: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.amber },
  connector: { width: 1.5, flex: 1, minHeight: 14, backgroundColor: alpha(darkTokens.text, 0.12) },
  connectorDone: { backgroundColor: alpha(darkTokens.text, 0.4) },
  textWrap: { flex: 1, paddingTop: 2, paddingBottom: 14, gap: 3 },
  label: { fontFamily: FONTS.sansMedium, fontSize: 13.5, color: C.white },
  labelIdle: { fontFamily: FONTS.sansLight, color: C.grey },
  eta: {
    fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1.4,
    color: C.amber, textTransform: "uppercase",
  },
});

export default function PendingValidation() {
  const { signOut, user, refreshMe } = useAuth();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<"pending" | "approved" | "rejected" | "suspended" | "banned">("pending");
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [documents, setDocuments] = useState<DocStatus[]>([]);
  const stripeConnectedRef = useRef(false);

  // Profil : actions « en attendant »
  const u: any = user ?? {};
  const [photoDone, setPhotoDone] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [bioOpen, setBioOpen] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioDone, setBioDone] = useState(false);
  const hasPhoto = photoDone || !!u?.avatarUrl;
  const hasBio = bioDone || !!(u?.bio && String(u.bio).trim().length > 0);

  async function checkStatus() {
    try {
      const [validationRes, stripeRes, docsRes]: any[] = await Promise.all([
        api.providers.validationStatus(),
        !stripeConnectedRef.current ? api.connect.status() : null,
        api.providerDocs.list(),
      ]);

      if (docsRes?.documents) setDocuments(docsRes.documents);

      if (stripeRes) {
        const connected = !!stripeRes.isStripeReady;
        stripeConnectedRef.current = connected;
        setStripeConnected(connected);
      }

      if (validationRes?.providerStatus === "ACTIVE") {
        setStatus("approved");
        feedback.haptic('success');
        setTimeout(() => router.replace("/(tabs)/provider-dashboard"), 2500);
        return true;
      } else if (validationRes?.providerStatus === "REJECTED") {
        setRejectionReason(validationRes?.rejectionReason ?? null);
        setStatus("rejected");
        return true;
      } else if (validationRes?.providerStatus === "SUSPENDED") {
        setRejectionReason(validationRes?.rejectionReason ?? null);
        setStatus("suspended");
        return true;
      } else if (validationRes?.providerStatus === "BANNED") {
        setRejectionReason(validationRes?.rejectionReason ?? null);
        setStatus("banned");
        return true;
      }
    } catch {}
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
  }, []);

  // Real-time: instant update when admin validates
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      if (data.validationStatus === 'ACTIVE') {
        setStatus('approved');
        feedback.haptic('success');
        setTimeout(() => router.replace('/(tabs)/provider-dashboard'), 2500);
      } else if (data.validationStatus === 'REJECTED') {
        setRejectionReason(data.rejectionReason ?? null);
        setStatus('rejected');
      } else if (data.validationStatus === 'SUSPENDED') {
        setRejectionReason(data.rejectionReason ?? null);
        setStatus('suspended');
      } else if (data.validationStatus === 'BANNED') {
        setRejectionReason(data.rejectionReason ?? null);
        setStatus('banned');
      } else if (data.validationStatus === 'PENDING') {
        setRejectionReason(null);
        setStatus('pending');
      }
    };
    socket.on('provider:validation_updated', handler);
    return () => { socket.off('provider:validation_updated', handler); };
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
  }, [photoBusy, refreshMe]);

  const handleSaveBio = useCallback(async () => {
    const bio = bioDraft.trim();
    if (bio.length < 10) {
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
    } catch (e: any) {
      feedback.error(e?.message || t('onboarding.pending_bio_fail'));
    } finally {
      setBioSaving(false);
    }
  }, [bioDraft, refreshMe]);

  // Animations
  const glowScale = useRef(new Animated.Value(1)).current;
  const glowOp = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(glowScale, { toValue: 1.1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(glowScale, { toValue: 1, duration: 3000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glowOp, { toValue: 1, duration: 3000, useNativeDriver: true }),
          Animated.timing(glowOp, { toValue: 0.5, duration: 3000, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Pulsation du chip « EN VALIDATION »
  const chipPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (status !== "pending") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(chipPulse, { toValue: 0.35, duration: 1100, useNativeDriver: true }),
        Animated.timing(chipPulse, { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [status]);

  // Succès animé (pop du check)
  const successScale = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (status !== "approved") return;
    Animated.spring(successScale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
  }, [status]);

  const firstName = (u?.name || "").trim().split(/\s+/)[0] || "";
  const rejectedDocs = documents.filter(d => d.status === "REJECTED");

  // ── PENDING : attente active ────────────────────────────────────────────────
  if (status === "pending") {
    return (
      <View style={s.root}>
        <StatusBar barStyle="light-content" backgroundColor={C.bg} />
        <GridLines />
        <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
          <LinearGradient
            colors={[alpha(darkTokens.text, 0.025), "transparent"]}
            style={s.glowGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
        </Animated.View>

        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingTop: insets.top + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header : kicker + chip statut */}
          <View style={s.headerRow}>
            <Text style={s.kicker}>{t('onboarding.pending_kicker')}</Text>
            <View style={s.chip}>
              <Animated.View style={[s.chipDot, { opacity: chipPulse }]} />
              <Text style={s.chipText}>{t('onboarding.pending_chip')}</Text>
            </View>
          </View>

          <Text style={s.titleLeft}>
            {t('onboarding.pending_title_l1')}{"\n"}
            <Text style={s.titleOutline}>
              {firstName
                ? t('onboarding.pending_title_l2_name', { name: firstName.toUpperCase() })
                : t('onboarding.pending_title_l2')}
            </Text>
          </Text>
          <Text style={s.subtitleLeft}>{t('onboarding.pending_sub')}</Text>

          {/* Timeline du dossier */}
          <View style={s.timelineCard}>
            <TimelineRow label={t('onboarding.pending_step_received')} state="done" />
            <TimelineRow label={t('onboarding.pending_step_stripe')} state={stripeConnected ? "done" : "active"} eta={!stripeConnected ? t('onboarding.pending_stripe_missing') : undefined} />
            <TimelineRow label={t('onboarding.pending_step_verifying')} state={stripeConnected ? "active" : "idle"} eta={t('onboarding.pending_verifying_eta')} />
            <TimelineRow label={t('onboarding.pending_step_activated')} state="idle" last />
          </View>

          {/* Documents refusés — visibles uniquement si action requise */}
          {rejectedDocs.length > 0 && (
            <View style={s.docsCard}>
              <Text style={s.docsTitle}>{t('onboarding.pending_docs_title')}</Text>
              {rejectedDocs.map(doc => (
                <View key={doc.id} style={s.docRow}>
                  <Feather name="x-circle" size={16} color={C.red} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.docLabel}>{doc.docKey.replace(/_/g, " ")}</Text>
                    {!!doc.rejectionReason && <Text style={s.docReason}>{doc.rejectionReason}</Text>}
                  </View>
                  <Text style={[s.docStatus, { color: C.red }]}>{t('onboarding.pending_doc_refused')}</Text>
                </View>
              ))}
              <TouchableOpacity
                style={s.docsFixBtn}
                onPress={() => { feedback.haptic('medium'); router.replace("/onboarding/documents"); }}
                activeOpacity={0.8}
              >
                <Feather name="upload" size={13} color={C.white} />
                <Text style={s.docsFixText}>{t('onboarding.rejected_cta')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* En attendant : complétez votre profil */}
          <Text style={s.prepTitle}>{t('onboarding.pending_prep_title')}</Text>
          <View style={s.prepList}>
            <TouchableOpacity
              style={s.prepRow}
              onPress={handleAddPhoto}
              disabled={photoBusy || hasPhoto}
              activeOpacity={0.7}
            >
              <Feather name="camera" size={16} color={hasPhoto ? C.green : C.white} />
              <Text style={s.prepLabel}>{t('onboarding.pending_prep_photo')}</Text>
              {photoBusy ? (
                <PulseDot size={5} />
              ) : (
                <Feather name={hasPhoto ? "check" : "chevron-right"} size={14} color={hasPhoto ? C.green : C.faint} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={s.prepRow}
              onPress={() => { feedback.haptic('light'); setBioOpen(o => !o); }}
              disabled={hasBio && !bioOpen}
              activeOpacity={0.7}
            >
              <Feather name="file-text" size={16} color={hasBio ? C.green : C.white} />
              <Text style={s.prepLabel}>{t('onboarding.pending_prep_bio')}</Text>
              <Feather
                name={hasBio ? "check" : bioOpen ? "chevron-down" : "chevron-right"}
                size={14}
                color={hasBio ? C.green : C.faint}
              />
            </TouchableOpacity>

            {bioOpen && !hasBio && (
              <View style={s.bioCard}>
                <TextInput
                  style={s.bioInput}
                  value={bioDraft}
                  onChangeText={setBioDraft}
                  placeholder={t('onboarding.pending_prep_bio_placeholder')}
                  placeholderTextColor={C.faint}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[s.bioSave, bioSaving && { opacity: 0.5 }]}
                  onPress={handleSaveBio}
                  disabled={bioSaving}
                  activeOpacity={0.8}
                >
                  <Text style={s.bioSaveText}>
                    {bioSaving ? t('common.loading') : t('common.save')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          <View style={s.prepHintRow}>
            <Feather name="zap" size={12} color={C.faint} />
            <Text style={s.prepHint}>{t('onboarding.pending_prep_hint')}</Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {!stripeConnected && (
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                feedback.haptic('medium');
                router.push("/onboarding/provider/stripe-connect");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>{t('onboarding.stripe_cta')}</Text>
              <View style={s.arrowPill}>
                <Feather name="arrow-right" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          )}

          <View style={s.notifRow}>
            <Feather name="bell" size={13} color={C.grey} />
            <Text style={s.notifText}>{t('onboarding.pending_notification')}</Text>
          </View>

          <TouchableOpacity
            style={[s.logoutBtn, { paddingBottom: insets.bottom + 16 }]}
            onPress={() => {
              feedback.haptic('light');
              signOut();
            }}
            activeOpacity={0.6}
          >
            <Feather name="log-out" size={16} color={C.grey} />
            <Text style={s.logoutText}>{t('onboarding.signout')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── APPROVED / REJECTED / SUSPENDED : layouts centrés ──────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <GridLines />
      <Animated.View style={[s.glowWrap, { opacity: glowOp, transform: [{ scale: glowScale }] }]}>
        <LinearGradient
          colors={[alpha(darkTokens.text, 0.025), "transparent"]}
          style={s.glowGradient}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </Animated.View>

      <View style={s.content}>
        {status === "approved" && (
          <>
            <Animated.View style={[s.successCircle, { transform: [{ scale: successScale }] }]}>
              <Feather name="check" size={40} color={C.bg} />
            </Animated.View>
            <Text style={s.kickerCenter}>{t('onboarding.approved_kicker')}</Text>
            <Text style={s.title}>
              {t('onboarding.approved_title_l1')}{"\n"}
              <Text style={s.titleOutline}>{t('onboarding.approved_title_l2')}</Text>
            </Text>
            <Text style={s.subtitle}>{t('onboarding.approved_sub')}</Text>
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                feedback.haptic('medium');
                router.replace("/(tabs)/provider-dashboard");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>{t('onboarding.approved_cta')}</Text>
              <View style={s.arrowPill}>
                <Feather name="arrow-right" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {status === "rejected" && (
          <>
            <View style={s.iconCircle}>
              <Feather name="x" size={40} color={C.red} />
            </View>
            <Text style={s.title}>
              {t('onboarding.rejected_title_l1')}{"\n"}
              <Text style={s.titleOutline}>{t('onboarding.rejected_title_l2')}</Text>
            </Text>
            <Text style={s.subtitle}>{t('onboarding.rejected_sub')}</Text>
            {!!rejectionReason && (
              <View style={s.reasonCard}>
                <Text style={s.reasonLabel}>{t('onboarding.rejected_reason_label')}</Text>
                <Text style={s.reasonText}>{rejectionReason}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                feedback.haptic('medium');
                router.replace("/onboarding/documents");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>{t('onboarding.rejected_cta')}</Text>
              <View style={s.arrowPill}>
                <Feather name="arrow-right" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {status === "suspended" && (
          <>
            <View style={s.iconCircle}>
              <Feather name="slash" size={40} color={C.white} />
            </View>
            <Text style={s.title}>
              {t('onboarding.suspended_title_l1')}{"\n"}
              <Text style={s.titleOutline}>{t('onboarding.suspended_title_l2')}</Text>
            </Text>
            <Text style={s.subtitle}>{t('onboarding.suspended_sub')}</Text>
            {!!rejectionReason && (
              <View style={s.reasonCard}>
                <Text style={s.reasonLabel}>{t('onboarding.status_reason_label')}</Text>
                <Text style={s.reasonText}>{rejectionReason}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                feedback.haptic('medium');
                router.push("/support");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>{t('onboarding.suspended_cta')}</Text>
              <View style={s.arrowPill}>
                <Feather name="arrow-right" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}

        {status === "banned" && (
          <>
            <View style={s.iconCircle}>
              <Feather name="slash" size={40} color={C.red} />
            </View>
            <Text style={s.title}>
              {t('onboarding.banned_title_l1')}{"\n"}
              <Text style={s.titleOutline}>{t('onboarding.banned_title_l2')}</Text>
            </Text>
            <Text style={s.subtitle}>{t('onboarding.banned_sub')}</Text>
            {!!rejectionReason && (
              <View style={s.reasonCard}>
                <Text style={s.reasonLabel}>{t('onboarding.status_reason_label')}</Text>
                <Text style={s.reasonText}>{rejectionReason}</Text>
              </View>
            )}
            <TouchableOpacity
              style={s.stripeCta}
              onPress={() => {
                feedback.haptic('medium');
                router.push("/support");
              }}
              activeOpacity={0.9}
            >
              <Text style={s.stripeCtaText}>{t('onboarding.banned_cta')}</Text>
              <View style={s.arrowPill}>
                <Feather name="arrow-right" size={14} color={C.white} />
              </View>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.logoutBtn, { paddingBottom: insets.bottom + 16 }]}
          onPress={() => {
            feedback.haptic('light');
            signOut();
          }}
          activeOpacity={0.6}
        >
          <Feather name="log-out" size={16} color={C.grey} />
          <Text style={s.logoutText}>{t('onboarding.signout')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  glowWrap: {
    position: "absolute", top: -80,
    left: (SCREEN_W - 420) / 2, width: 420, height: 420,
  },
  glowGradient: { width: "100%", height: "100%", borderRadius: 210 },

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
  kickerCenter: {
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
    fontFamily: FONTS.bebas, fontSize: 38, color: C.white,
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

  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  successCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: C.white,
    alignItems: "center", justifyContent: "center", marginBottom: 12,
  },

  title: {
    fontFamily: FONTS.bebas, fontSize: 36, color: C.white,
    letterSpacing: 1, lineHeight: 40, textAlign: "center",
  },
  titleOutline: { color: C.outlineText },

  subtitle: {
    fontFamily: FONTS.sansLight, fontSize: 15, color: C.grey,
    textAlign: "center", lineHeight: 22, paddingHorizontal: 8,
  },

  // Motif de refus (affiché au prestataire pour qu'il sache quoi corriger)
  reasonCard: {
    width: "100%", backgroundColor: C.cardBg,
    borderWidth: 1, borderColor: alpha(COLORS.red, 0.3),
    borderRadius: 16, padding: 16, gap: 6, marginTop: 4,
  },
  reasonLabel: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.red, textTransform: "uppercase",
  },
  reasonText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.white, lineHeight: 20,
  },

  // Timeline
  timelineCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14,
    marginBottom: 18,
  },

  // Docs refusés
  docsCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: alpha(COLORS.red, 0.3),
    borderRadius: 16, padding: 18, gap: 10, marginBottom: 18,
  },
  docsTitle: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.grey, textTransform: "uppercase", marginBottom: 2,
  },
  docRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  docLabel: {
    fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white, textTransform: "capitalize",
  },
  docReason: { fontFamily: FONTS.sans, fontSize: 12, color: C.red, marginTop: 2 },
  docStatus: { fontFamily: FONTS.sansMedium, fontSize: 12, color: C.grey },
  docsFixBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 44, borderRadius: 12, marginTop: 4,
    backgroundColor: alpha(darkTokens.text, 0.07),
    borderWidth: 1, borderColor: alpha(darkTokens.text, 0.2),
  },
  docsFixText: { fontFamily: FONTS.sansMedium, fontSize: 12.5, color: C.white },

  // Préparation profil
  prepTitle: {
    fontFamily: FONTS.mono, fontSize: 9, letterSpacing: 1.8,
    color: C.grey, textTransform: "uppercase", marginBottom: 10,
  },
  prepList: { gap: 9 },
  prepRow: {
    flexDirection: "row", alignItems: "center", gap: 13,
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14,
  },
  prepLabel: { flex: 1, fontFamily: FONTS.sans, fontSize: 12.5, color: C.white },
  bioCard: {
    backgroundColor: C.cardBg, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, padding: 12, gap: 10,
  },
  bioInput: {
    minHeight: 88, fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19,
    color: C.white, textAlignVertical: "top",
  },
  bioSave: {
    alignSelf: "flex-end", paddingHorizontal: 18, height: 38, borderRadius: 10,
    backgroundColor: C.white, alignItems: "center", justifyContent: "center",
  },
  bioSaveText: { fontFamily: FONTS.sansMedium, fontSize: 12.5, color: C.bg },
  prepHintRow: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
  },
  prepHint: { fontFamily: FONTS.sansLight, fontSize: 11, color: C.faint },

  // CTA
  stripeCta: {
    width: "100%", height: 60, backgroundColor: C.white, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12,
    marginTop: 8,
  },
  stripeCtaText: {
    fontFamily: FONTS.bebas, fontSize: 20, letterSpacing: 3, color: C.bg,
  },
  arrowPill: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: C.bg,
    alignItems: "center", justifyContent: "center",
  },

  footer: {
    paddingHorizontal: 28, gap: 12, zIndex: 2,
    paddingTop: 8,
  },
  notifRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  notifText: {
    fontFamily: FONTS.sansLight, fontSize: 12, color: C.grey,
  },
  logoutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingTop: 8,
  },
  logoutText: {
    fontFamily: FONTS.sans, fontSize: 14, color: C.grey,
    textDecorationLine: "underline", textDecorationColor: alpha(darkTokens.text, 0.12),
  },
});
