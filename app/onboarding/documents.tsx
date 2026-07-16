// app/onboarding/documents.tsx — Checklist KYC à statuts (dark design)
// Redesign onboarding : chaque pièce affiche son état, la progression est
// matérialisée (barre + « X / N envoyés ») et le CTA désactivé explique pourquoi.
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform, ActionSheetIOS, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
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

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem("onboarding_data");
      const data = raw ? JSON.parse(raw) : {};
      const categories: { id: number; name: string }[] = data.categories ?? [];
      const categoryNames = categories.map(c => c.name);
      const localDocs = getRequiredDocuments(categoryNames);
      setRequirements(localDocs);

      const initialState: UploadState = {};
      localDocs.forEach(doc => { initialState[doc.type] = { uri: null, uploading: false }; });

      if (categories.length > 0) {
        const seenKeys = new Set<string>(localDocs.map(d => d.type));
        await Promise.allSettled(
          categories.map(async (cat) => {
            const slug = toSlug(cat.name);
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
      feedback.error(e?.message || t('onboarding.docs_upload_error'));
    }
  };

  const pickImage = async (docType: DocumentType | string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      feedback.error(t('onboarding.docs_perm_error'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;
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
    if (result.canceled || !result.assets?.[0]) return;
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
  const handleUpload = (docType: DocumentType | string) => {
    const photoLabel = t('onboarding.doc_source_photo');
    const pdfLabel = t('onboarding.doc_source_pdf');
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: t('onboarding.doc_source_title'),
          options: [photoLabel, pdfLabel, t('common.cancel')],
          cancelButtonIndex: 2,
          userInterfaceStyle: "dark",
        },
        (idx) => {
          if (idx === 0) pickImage(docType);
          else if (idx === 1) pickPdf(docType);
        },
      );
    } else {
      Alert.alert(t('onboarding.doc_source_title'), undefined, [
        { text: photoLabel, onPress: () => pickImage(docType) },
        { text: pdfLabel, onPress: () => pickPdf(docType) },
        { text: t('common.cancel'), style: "cancel" },
      ]);
    }
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
        onPress: () => router.push("/onboarding/stripe"),
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
