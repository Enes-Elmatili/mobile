// app/onboarding/documents.tsx — Upload documents KYC (dark design)
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { DocumentUploadCard } from "../../components/onboarding/DocumentUploadCard";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { getRequiredDocuments, type DocumentRequirement, type DocumentType } from "../../constants/kycRequirements";
import { FONTS, darkTokens } from "@/hooks/use-app-theme";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = { white: darkTokens.text, grey: darkTokens.textMuted };

function toSlug(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
}

interface UploadState {
  [type: string]: { uri: string | null; uploading: boolean };
}

export default function OnboardingDocuments() {
  const router = useRouter();
  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [uploads, setUploads] = useState<UploadState>({});
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

      setUploads(initialState);
      setLoading(false);
    })();
  }, []);

  const handleUpload = async (docType: DocumentType | string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Accès refusé", "Autorisez l'accès à la galerie pour téléverser vos documents.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploads(prev => ({ ...prev, [docType]: { ...prev[docType], uploading: true } }));
    try {
      const formData = new FormData();
      formData.append("file", { uri: asset.uri, name: asset.fileName || `${docType}_${Date.now()}.jpg`, type: asset.mimeType || "image/jpeg" } as any);
      formData.append("docKey", docType);
      await api.providerDocs.upload(formData);
      setUploads(prev => ({ ...prev, [docType]: { uri: asset.uri, uploading: false } }));
    } catch (e: any) {
      setUploads(prev => ({ ...prev, [docType]: { ...prev[docType], uploading: false } }));
      Alert.alert("Échec du téléversement", e?.message || "Réessayez.");
    }
  };

  const uploadedCount = Object.values(uploads).filter(u => u.uri).length;
  const totalDocs = requirements.length;
  const mandatoryDocs = requirements.filter(d => d.required);
  const allMandatoryUploaded = mandatoryDocs.every(d => uploads[d.type]?.uri);

  if (loading) {
    return (
      <OnboardingLayout currentStep={PROVIDER_FLOW.steps.DOCUMENTS} totalSteps={PROVIDER_FLOW.totalSteps} title={"Vos\ndocuments."} subtitle="Chargement des exigences...">
        <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title={"Vos\ndocuments."}
      subtitle="Téléversez vos justificatifs pour activer votre profil. Les documents requis sont marqués en orange."
      cta={{ label: "Continuer", onPress: () => router.push("/onboarding/stripe"), disabled: !allMandatoryUploaded }}
    >
      <Text style={s.docProgress}>{uploadedCount} / {totalDocs} envoyé{uploadedCount > 1 ? "s" : ""}</Text>

      {requirements.map(req => (
        <DocumentUploadCard key={req.type} requirement={req} uploadedUri={uploads[req.type]?.uri ?? null} uploading={uploads[req.type]?.uploading} onUpload={() => handleUpload(req.type)} />
      ))}

      <View style={s.securityNote}>
        <Feather name="lock" size={12} color="rgba(255,255,255,0.2)" />
        <Text style={s.securityText}>Documents chiffrés et stockés de façon sécurisée. Jamais partagés avec les clients.</Text>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 40 },
  docProgress: { fontFamily: FONTS.sans, fontSize: 13, color: C.grey, marginBottom: 20 },
  securityNote: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 },
  securityText: { fontFamily: FONTS.sansLight, fontSize: 11, color: "rgba(255,255,255,0.2)" },
});
