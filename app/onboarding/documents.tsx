// app/onboarding/documents.tsx — Checklist KYC à statuts (dark design)
// Redesign onboarding : chaque pièce affiche son état, la progression est
// matérialisée (barre + « X / N envoyés ») et le CTA désactivé explique pourquoi.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform, Linking } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Sentry from "@sentry/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
import { resumeRoute } from "@/lib/onboardingResume";
import { fetchProviderTrades } from "../../lib/providerOnboarding";
import { feedback } from "@/lib/feedback/feedback";
import { useTranslation } from "react-i18next";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { DocumentUploadCard, type DocServerStatus } from "../../components/onboarding/DocumentUploadCard";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { getRequiredDocuments, type DocumentRequirement, type DocumentType } from "../../constants/kycRequirements";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = { white: darkTokens.text, grey: darkTokens.textMuted };

// Pièce visée par un sélecteur en cours d'ouverture. Sur Android, l'OS peut
// tuer l'activité pendant la sélection : au redémarrage, c'est la seule trace
// permettant de rattacher le fichier orphelin au bon document.
const PENDING_DOC_KEY = "@fixed:kyc:pending-doc";

function toSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

interface UploadState {
  [type: string]: { uri: string | null; uploading: boolean };
}

interface ServerDocState {
  [docKey: string]: { status: DocServerStatus; rejectionReason?: string | null };
}

export default function OnboardingDocuments() {
  const router = useRouter();
  const { t } = useTranslation();
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [uploads, setUploads] = useState<UploadState>({});
  const [serverDocs, setServerDocs] = useState<ServerDocState>({});
  const [loading, setLoading] = useState(true);
  const pendingCheckedRef = useRef(false);

  useEffect(() => {
    (async () => {
      // Métiers : serveur d'abord, cache d'inscription en repli. MÊME source que
      // l'écran d'attente — sinon les deux écrans peuvent exiger un nombre de
      // pièces différent et se renvoyer la balle indéfiniment.
      const trades = await fetchProviderTrades();
      const categoryNames = trades.names;
      const localDocs = getRequiredDocuments(categoryNames);
      setRequirements(localDocs);

      const initialState: UploadState = {};
      localDocs.forEach(doc => { initialState[doc.type] = { uri: null, uploading: false }; });

      if (categoryNames.length > 0) {
        const seenKeys = new Set<string>(localDocs.map(d => d.type));
        await Promise.allSettled(
          categoryNames.map(async (name) => {
            const slug = toSlug(name);
            try {
              const res: any = await api.providerDocs.config(slug);
              const requiredDocs: { key: string; label: string; mandatory: boolean }[] = res?.requiredDocs ?? [];
              for (const doc of requiredDocs) {
                if (!seenKeys.has(doc.key)) {
                  seenKeys.add(doc.key);
                  initialState[doc.key] = { uri: null, uploading: false };
                }
              }
            } catch {}
          })
        );
      }

      // Pièces déjà envoyées (retour sur l'écran, rejet admin…) — statut serveur
      try {
        const res: any = await api.providerDocs.list();
        const docs: { docKey: string; status: string; rejectionReason?: string | null }[] = res?.documents ?? [];
        const byKey: ServerDocState = {};
        for (const d of docs) {
          byKey[d.docKey] = { status: d.status as DocServerStatus, rejectionReason: d.rejectionReason };
        }
        setServerDocs(byKey);
      } catch {}

      setUploads(initialState);
      setLoading(false);
    })();
  }, []);

  // Envoi effectif d'un fichier (image OU pdf) vers le backend.
  // isImage=false → on NE stocke PAS d'uri locale : la carte afficherait sinon
  // une <Image> cassée pour un PDF. Le statut « envoyé » vient de serverDocs.
  const doUpload = async (
    docType: DocumentType | string,
    file: { uri: string; name: string; type: string; isImage: boolean },
  ) => {
    setUploads(prev => ({ ...prev, [docType]: { ...prev[docType], uploading: true } }));
    try {
      const formData = new FormData();
      formData.append("file", { uri: file.uri, name: file.name, type: file.type } as any);
      formData.append("docKey", docType);
      await api.providerDocs.upload(formData);
      feedback.success(t('onboarding.docs_sent_toast'));
      setUploads(prev => ({ ...prev, [docType]: { uri: file.isImage ? file.uri : null, uploading: false } }));
      setServerDocs(prev => ({ ...prev, [docType]: { status: "PENDING" } }));
    } catch (e: any) {
      setUploads(prev => ({ ...prev, [docType]: { ...prev[docType], uploading: false } }));
      Sentry.captureException(e, {
        tags: { flow: "kyc-upload", step: "post" },
        extra: { docType, status: e?.status, mime: file.type },
      });
      feedback.error(e?.message || t('onboarding.docs_upload_error'));
    }
  };

  // ─── Android : récupération d'un fichier perdu ─────────────────────────────
  // Même classe de bug que les photos de mission (régression connue n°6, non
  // couverte ici jusqu'ici) : l'OS tue l'activité pendant que la galerie est
  // ouverte, la promesse de launchImageLibraryAsync est perdue, et la pièce
  // semble n'avoir jamais existé — aucun POST n'atteint le serveur, aucun
  // message n'est affiché. C'est exactement ce que montrent les logs du
  // 25/08/2026 : écran documents monté à 07:37:52, aucun envoi, redémarrage à
  // froid à 07:43:13. getPendingResultAsync rend le fichier orphelin ; la clé
  // stockée dit à quelle pièce il appartient.
  useEffect(() => {
    if (Platform.OS !== "android" || loading || pendingCheckedRef.current) return;
    pendingCheckedRef.current = true;
    (async () => {
      try {
        const docType = await AsyncStorage.getItem(PENDING_DOC_KEY);
        const pending = await ImagePicker.getPendingResultAsync();
        await AsyncStorage.removeItem(PENDING_DOC_KEY).catch(() => {});
        if (!docType) return;

        const first = (Array.isArray(pending) ? pending[0] : null) as ImagePicker.ImagePickerResult | null;
        const asset = first && !(first as any).code && !first.canceled ? first.assets?.[0] : null;
        if (!asset?.uri) return;

        Sentry.addBreadcrumb({ category: "kyc-upload", message: `recovered:${docType}`, level: "info" });
        await doUpload(docType, {
          uri: asset.uri,
          name: asset.fileName || `${docType}_${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
          isImage: true,
        });
      } catch {
        Sentry.addBreadcrumb({ category: "kyc-upload", message: "pending-result-failed", level: "warning" });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  /**
   * Accès à la galerie.
   *
   * iOS : `launchImageLibraryAsync` passe par le sélecteur système, hors
   * process — aucune permission n'est requise. La demander ne servait qu'à
   * fabriquer une impasse : un « Ne pas autoriser » posé une seule fois
   * interdisait à vie le dépôt des pièces, sans même un chemin vers les
   * Réglages, et donc sans dossier possible.
   *
   * Android : la permission reste nécessaire selon la version, mais un refus
   * définitif ouvre désormais les Réglages au lieu d'un toast sans issue. Le
   * PDF, lui, n'a jamais besoin de permission : il reste toujours ouvert.
   */
  const ensureLibraryAccess = async (): Promise<boolean> => {
    if (Platform.OS === "ios") return true;
    try {
      const current = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (current.granted) return true;

      if (current.canAskAgain) {
        const asked = await ImagePicker.requestMediaLibraryPermissionsAsync();
        Sentry.addBreadcrumb({ category: "kyc-upload", message: `perm:${asked.status}`, level: "info" });
        if (asked.granted) return true;
        if (asked.canAskAgain) {
          feedback.error(t('onboarding.docs_perm_error'));
          return false;
        }
      }

      const ok = await feedback.confirm({
        title: t('onboarding.docs_perm_title'),
        message: t('onboarding.docs_perm_error'),
        confirm: t('onboarding.docs_perm_settings'),
        cancel: t('common.cancel'),
      });
      if (ok) Linking.openSettings().catch(() => {});
      return false;
    } catch {
      // Module de permission indisponible : on tente quand même le sélecteur
      // plutôt que de bloquer sur une vérification accessoire.
      Sentry.addBreadcrumb({ category: "kyc-upload", message: "perm:check-failed", level: "warning" });
      return true;
    }
  };

  const pickImage = async (docType: DocumentType | string) => {
    if (!(await ensureLibraryAccess())) return;
    // Noter la pièce visée AVANT d'ouvrir : après, il peut être trop tard.
    await AsyncStorage.setItem(PENDING_DOC_KEY, String(docType)).catch(() => {});
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    await AsyncStorage.removeItem(PENDING_DOC_KEY).catch(() => {});
    if (result.canceled || !result.assets[0]) {
      Sentry.addBreadcrumb({ category: "kyc-upload", message: "picker:image-canceled", level: "info" });
      return;
    }
    const asset = result.assets[0];
    await doUpload(docType, {
      uri: asset.uri,
      name: asset.fileName || `${docType}_${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
      isImage: true,
    });
  };

  const pickPdf = async (docType: DocumentType | string) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets?.[0]) {
      Sentry.addBreadcrumb({ category: "kyc-upload", message: "picker:pdf-canceled", level: "info" });
      return;
    }
    const asset = result.assets[0];
    await doUpload(docType, {
      uri: asset.uri,
      name: asset.name || `${docType}_${Date.now()}.pdf`,
      type: asset.mimeType || "application/pdf",
      isImage: false,
    });
  };

  // Laisse le presta choisir la source : photo (galerie) ou document PDF.
  // Un scan PDF propre règle le problème des photos floues/illisibles.
  const handleUpload = async (docType: DocumentType | string) => {
    Sentry.addBreadcrumb({ category: "kyc-upload", message: `tap:${docType}`, level: "info" });
    const idx = await feedback.actionSheet({
      titleKey: 'onboarding.doc_source_title',
      options: [
        { labelKey: 'onboarding.doc_source_photo' },
        { labelKey: 'onboarding.doc_source_pdf' },
      ],
      cancelKey: 'common.cancel',
    });
    Sentry.addBreadcrumb({ category: "kyc-upload", message: `sheet:${idx}`, level: "info" });
    if (idx === 0) await pickImage(docType);
    else if (idx === 1) await pickPdf(docType);
  };

  const isSent = (type: string) => {
    if (uploads[type]?.uri) return true;
    const srv = serverDocs[type]?.status;
    return srv === "PENDING" || srv === "APPROVED";
  };

  const totalDocs = requirements.length;
  const sentCount = requirements.filter(d => isSent(d.type)).length;
  const mandatoryDocs = requirements.filter(d => d.required);
  const allMandatorySent = mandatoryDocs.every(d => isSent(d.type));
  const anyUploading = Object.values(uploads).some(u => u.uploading);
  const progress = totalDocs > 0 ? sentCount / totalDocs : 0;

  if (loading) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
        totalSteps={PROVIDER_FLOW.totalSteps}
        stepLabel={t('onboarding.docs_step_label')}
        title={t('onboarding.docs_title')}
        subtitle={t('onboarding.docs_loading')}
      >
        <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      stepLabel={t('onboarding.docs_step_label')}
      title={t('onboarding.docs_title')}
      subtitle={t('onboarding.docs_sub', { count: mandatoryDocs.length })}
      cta={{
        label: t('common.continue'),
        onPress: async () => { router.push(await resumeRoute() as any); },
        disabled: !allMandatorySent || anyUploading,
        sub: anyUploading
          ? t('onboarding.docs_cta_uploading')
          : !allMandatorySent
            ? t('onboarding.docs_cta_missing')
            : undefined,
      }}
    >
      {/* Progression */}
      <View style={s.progressRow}>
        <View style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={s.progressLabel}>
          {t('onboarding.docs_progress', { count: sentCount, total: totalDocs })}
        </Text>
      </View>

      {requirements.map(req => (
        <DocumentUploadCard
          key={req.type}
          requirement={req}
          uploadedUri={uploads[req.type]?.uri ?? null}
          uploading={uploads[req.type]?.uploading}
          serverStatus={serverDocs[req.type]?.status ?? null}
          rejectionReason={serverDocs[req.type]?.rejectionReason}
          onUpload={() => handleUpload(req.type)}
        />
      ))}

      <View style={s.securityNote}>
        <Feather name="lock" size={12} color={alpha(darkTokens.text, 0.2)} />
        <Text style={s.securityText}>{t('onboarding.docs_security')}</Text>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 40 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 18,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: alpha(darkTokens.text, 0.12),
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: COLORS.greenBrand,
  },
  progressLabel: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.5,
    color: C.grey,
    textTransform: "uppercase",
  },
  securityNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  securityText: { fontFamily: FONTS.sansLight, fontSize: 11, color: alpha(darkTokens.text, 0.2) },
});
