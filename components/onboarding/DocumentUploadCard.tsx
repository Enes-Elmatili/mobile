// components/onboarding/DocumentUploadCard.tsx — Carte d'upload KYC (dark design)
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import type { DocumentRequirement, DocumentType } from "../../constants/kycRequirements";

const C = {
  white: "#FAFAFA",
  grey: "#888888",
  border: "rgba(255,255,255,0.08)",
  cardBg: "#141414",
  surface: "rgba(255,255,255,0.04)",
  green: "#3D8B3D",
};

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
      style={[styles.docCard, isUploaded && styles.docCardDone]}
      onPress={() => !isUploaded && !uploading && onUpload(requirement.type)}
      disabled={isUploaded || uploading}
      activeOpacity={0.7}
    >
      <View style={styles.docCardLeft}>
        <Ionicons
          name={isUploaded ? "checkmark-circle" : requirement.required ? "document-outline" : "document-attach-outline"}
          size={24}
          color={isUploaded ? C.green : C.white}
        />
      </View>
      <View style={styles.docCardContent}>
        <View style={styles.docCardHeader}>
          <Text style={[styles.docCardLabel, isUploaded && { color: C.grey }]} numberOfLines={2}>
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
        <ActivityIndicator size="small" color={C.grey} />
      ) : (
        <Ionicons
          name={isUploaded ? "checkmark" : "cloud-upload-outline"}
          size={20}
          color={isUploaded ? C.green : C.grey}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  docCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 12,
  },
  docCardDone: {
    borderColor: "rgba(61,139,61,0.2)",
    backgroundColor: "rgba(61,139,61,0.05)",
  },
  docCardLeft: {
    width: 32,
    alignItems: "center",
  },
  docCardContent: {
    flex: 1,
    gap: 4,
  },
  docCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  docCardLabel: {
    fontFamily: FONTS.sansMedium,
    fontSize: 15,
    color: C.white,
    flexShrink: 1,
  },
  docCardDesc: {
    fontFamily: FONTS.sansLight,
    fontSize: 12,
    lineHeight: 17,
    color: C.grey,
  },
  requiredBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
  },
  requiredBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.grey,
  },
  doneBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: "rgba(61,139,61,0.1)",
  },
  doneBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: C.green,
  },
});
