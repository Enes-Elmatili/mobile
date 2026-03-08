// components/onboarding/DocumentUploadCard.tsx — Carte d'upload KYC (thème sombre)
import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DocumentRequirement, DocumentType } from '../../constants/kycRequirements';

interface DocumentUploadCardProps {
  requirement: DocumentRequirement;
  uploadedUri: string | null;
  uploading?: boolean;
  onUpload: (type: DocumentType) => void;
}

export function DocumentUploadCard({ requirement, uploadedUri, uploading, onUpload }: DocumentUploadCardProps) {
  const isUploaded = !!uploadedUri;

  return (
    <TouchableOpacity
      style={[styles.docCard, isUploaded && styles.docCardUploaded]}
      onPress={() => !isUploaded && !uploading && onUpload(requirement.type)}
      disabled={isUploaded || uploading}
      accessibilityRole="button"
      accessibilityLabel={`${requirement.label} — ${isUploaded ? 'Téléversé' : 'Appuyer pour téléverser'}`}
    >
      <View style={styles.docCardLeft}>
        <Ionicons
          name={isUploaded ? 'checkmark-circle' : requirement.required ? 'document-outline' : 'document-attach-outline'}
          size={24}
          color={isUploaded ? '#fff' : requirement.required ? '#fff' : 'rgba(255,255,255,0.4)'}
        />
      </View>
      <View style={styles.docCardContent}>
        <View style={styles.docCardHeader}>
          <Text style={[styles.docCardLabel, isUploaded && styles.docCardLabelDone]} numberOfLines={2}>
            {requirement.label}
          </Text>
          {requirement.required && !isUploaded && (
            <View style={styles.requiredBadge}>
              <Text style={styles.requiredBadgeText}>Requis</Text>
            </View>
          )}
          {isUploaded && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>Téléversé</Text>
            </View>
          )}
        </View>
        <Text style={styles.docCardDesc} numberOfLines={2}>{requirement.description}</Text>
      </View>
      {uploading ? (
        <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" />
      ) : (
        <Ionicons
          name={isUploaded ? 'checkmark' : 'cloud-upload-outline'}
          size={20}
          color={isUploaded ? '#fff' : 'rgba(255,255,255,0.3)'}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  docCardUploaded: {
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  docCardLeft: {
    width: 32,
    alignItems: 'center',
  },
  docCardContent: {
    flex: 1,
    gap: 4,
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  docCardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    flexShrink: 1,
  },
  docCardLabelDone: {
    color: 'rgba(255,255,255,0.6)',
  },
  docCardDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    lineHeight: 17,
  },
  requiredBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  requiredBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
  doneBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  doneBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.6)',
  },
});
