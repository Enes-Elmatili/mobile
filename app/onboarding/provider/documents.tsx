import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../../lib/api';
import { OnboardingLayout } from '../../../components/onboarding/OnboardingLayout';
import { DocumentUploadCard } from '../../../components/onboarding/DocumentUploadCard';
import { PROVIDER_FLOW } from '../../../constants/onboardingFlows';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import {
  getRequiredDocuments,
  type DocumentRequirement,
  type DocumentType,
} from '../../../constants/kycRequirements';

interface UploadState {
  [type: string]: { uri: string | null; uploading: boolean };
}

export default function ProviderDocuments() {
  const router = useRouter();
  const { selectedSkills, setDocumentUploaded, uploadedDocs } = useOnboardingStore();

  const [requirements, setRequirements] = useState<DocumentRequirement[]>([]);
  const [uploads, setUploads] = useState<UploadState>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const docs = getRequiredDocuments(selectedSkills);
    setRequirements(docs);

    const initialState: UploadState = {};
    docs.forEach((doc) => {
      initialState[doc.type] = { uri: uploadedDocs[doc.type] || null, uploading: false };
    });
    setUploads(initialState);
    setLoading(false);
  }, [selectedSkills]);

  const handleUpload = async (docType: DocumentType | string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Accès refusé', "Autorisez l'accès à la galerie pour téléverser vos documents.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploads((prev) => ({ ...prev, [docType]: { ...prev[docType], uploading: true } }));

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName || `${docType}_${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      } as any);
      formData.append('docKey', docType);

      await api.providerDocs.upload(formData);

      setUploads((prev) => ({ ...prev, [docType]: { uri: asset.uri, uploading: false } }));
      setDocumentUploaded(docType, asset.uri);
    } catch (e: any) {
      setUploads((prev) => ({ ...prev, [docType]: { ...prev[docType], uploading: false } }));
      Alert.alert('Échec du téléversement', e?.message || 'Réessayez.');
    }
  };

  const mandatoryDocs = requirements.filter((d) => d.required);
  const allMandatoryUploaded = mandatoryDocs.every((d) => uploads[d.type]?.uri);
  const uploadedCount = Object.values(uploads).filter((u) => u.uri).length;

  if (loading) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
        totalSteps={PROVIDER_FLOW.totalSteps}
        title="Vos documents."
        subtitle="Chargement des exigences…"
      >
        <View style={s.centered}>
          <ActivityIndicator size="large" color="rgba(255,255,255,0.4)" />
        </View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      title="Vos documents."
      subtitle="Téléversez vos justificatifs pour obtenir le badge de confiance FIXED."
      cta={{
        label: allMandatoryUploaded ? 'Continuer' : 'Passer cette étape',
        onPress: () => router.push('/onboarding/provider/quiz'),
        disabled: false,
      }}
    >
      <Text style={s.docProgress}>
        {uploadedCount} / {requirements.length} envoyé{uploadedCount > 1 ? 's' : ''}
      </Text>

      {requirements.map((req) => (
        <DocumentUploadCard
          key={req.type}
          requirement={req}
          uploadedUri={uploads[req.type]?.uri ?? null}
          uploading={uploads[req.type]?.uploading}
          onUpload={() => handleUpload(req.type)}
        />
      ))}

      <View style={s.securityNote}>
        <Ionicons name="lock-closed-outline" size={12} color="rgba(255,255,255,0.2)" />
        <Text style={s.securityText}>
          Documents chiffrés et stockés de façon sécurisée. Jamais partagés avec les clients.
        </Text>
      </View>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: 'center', paddingVertical: 40 },
  docProgress: { fontSize: 13, color: 'rgba(255,255,255,0.35)', marginBottom: 20 },
  securityNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  securityText: { fontSize: 11, color: 'rgba(255,255,255,0.2)' },
});
