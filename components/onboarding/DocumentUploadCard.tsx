// components/onboarding/DocumentUploadCard.tsx — Checklist KYC à statuts (dark design)
// Redesign onboarding : chaque pièce affiche son état (envoyé / requis / refusé /
// validé), une vignette, et le bouton Téléverser vit DANS la carte requise.
import React from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";
import type { DocumentRequirement, DocumentType } from "../../constants/kycRequirements";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  white:   darkTokens.text,
  grey:    darkTokens.textMuted,
  faint:   alpha(darkTokens.text, 0.3),
  border:  alpha(darkTokens.text, 0.08),
  cardBg:  darkTokens.cardBg,
  surface: alpha(darkTokens.text, 0.05),
  green:   COLORS.greenBrand,
  amber:   COLORS.amber,
  red:     COLORS.red,
};

export type DocServerStatus = "PENDING" | "APPROVED" | "REJECTED";

interface DocumentUploadCardProps {
  requirement: DocumentRequirement;
  uploadedUri: string | null;
  uploading?: boolean;
  /** Statut renvoyé par le backend si le document existe déjà côté serveur */
  serverStatus?: DocServerStatus | null;
  rejectionReason?: string | null;
  onUpload: (type: DocumentType) => void;
}

export function DocumentUploadCard({
  requirement,
  uploadedUri,
  uploading,
  serverStatus,
  rejectionReason,
  onUpload,
}: DocumentUploadCardProps) {
  const { t } = useTranslation();
  // Libellés/descriptions traduits — fallback sur les constantes FR canoniques
  const docLabel = t(`kyc.${requirement.type}_label`, { defaultValue: requirement.label });
  const docDesc = t(`kyc.${requirement.type}_desc`, { defaultValue: requirement.description });
  const rejected = serverStatus === "REJECTED" && !uploadedUri;
  const approved = serverStatus === "APPROVED";
  const sent = !rejected && (!!uploadedUri || serverStatus === "PENDING" || approved);
  const needsUpload = !sent && !uploading;

  const chip = approved
    ? { label: t('onboarding.doc_chip_approved'), color: C.green, bg: alpha(C.green, 0.13) }
    : rejected
      ? { label: t('onboarding.doc_chip_refused'), color: C.red, bg: alpha(C.red, 0.13) }
      : sent
        ? { label: t('onboarding.doc_chip_sent'), color: C.green, bg: alpha(C.green, 0.13) }
        : requirement.required
          ? { label: t('onboarding.doc_chip_required'), color: C.amber, bg: alpha(C.amber, 0.13) }
          : { label: t('onboarding.doc_chip_optional'), color: C.grey, bg: alpha(C.white, 0.07) };

  const borderColor = rejected
    ? alpha(C.red, 0.4)
    : needsUpload && requirement.required
      ? alpha(C.amber, 0.4)
      : C.border;

  return (
    <View style={[styles.docCard, { borderColor }]}>
      <View style={styles.row}>
        {/* Vignette */}
        {sent ? (
          <View style={styles.thumb}>
            {uploadedUri ? (
              <Image source={{ uri: uploadedUri }} style={styles.thumbImage} />
            ) : (
              <Feather name="file-text" size={17} color={C.grey} />
            )}
            <View style={styles.thumbBadge}>
              <Feather name="check" size={9} color={darkTokens.bg} />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.thumbEmpty,
              { borderColor: rejected ? alpha(C.red, 0.5) : requirement.required ? alpha(C.amber, 0.5) : alpha(C.white, 0.25) },
            ]}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={C.white} />
            ) : (
              <Feather
                name="file-text"
                size={17}
                color={rejected ? C.red : requirement.required ? C.amber : C.grey}
              />
            )}
          </View>
        )}

        {/* Texte */}
        <View style={styles.content}>
          <Text style={styles.label} numberOfLines={2}>{docLabel}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {rejected && rejectionReason ? rejectionReason : docDesc}
          </Text>
        </View>

        {/* Chip statut */}
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.color }]}>{chip.label}</Text>
        </View>
      </View>

      {/* Bouton principal — pièce manquante, refusée, ou premier envoi en cours */}
      {!sent && (
        <TouchableOpacity
          style={styles.uploadBtn}
          onPress={() => onUpload(requirement.type)}
          disabled={uploading}
          activeOpacity={0.7}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={C.white} />
              <Text style={styles.uploadBtnText}>{t('onboarding.doc_uploading')}</Text>
            </>
          ) : (
            <>
              <Feather name="upload" size={14} color={C.white} />
              <Text style={styles.uploadBtnText}>{rejected ? t('onboarding.doc_reupload') : t('onboarding.doc_upload')}</Text>
              <Text style={styles.uploadHint}>{t('onboarding.doc_hint')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Remplacer — doc envoyé mais pas encore validé : le presta peut corriger
          une photo floue/illisible tant que l'admin ne l'a pas approuvé.
          Une pièce APPROUVÉE reste verrouillée (pas de bouton). */}
      {sent && !approved && (
        <TouchableOpacity
          style={styles.replaceBtn}
          onPress={() => onUpload(requirement.type)}
          disabled={uploading}
          activeOpacity={0.6}
        >
          {uploading ? (
            <>
              <ActivityIndicator size="small" color={C.grey} />
              <Text style={styles.replaceText}>{t('onboarding.doc_uploading')}</Text>
            </>
          ) : (
            <>
              <Feather name="refresh-cw" size={12} color={C.grey} />
              <Text style={styles.replaceText}>{t('onboarding.doc_replace')}</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  docCard: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 11,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: alpha(darkTokens.text, 0.18),
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
    borderRadius: 10,
  },
  thumbBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: C.green,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: darkTokens.bg,
  },
  thumbEmpty: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: 3,
  },
  label: {
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: C.white,
  },
  meta: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 0.6,
    lineHeight: 13,
    color: C.faint,
    textTransform: "uppercase",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  chipText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
  },
  uploadBtn: {
    marginTop: 13,
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: alpha(darkTokens.text, 0.07),
    borderWidth: 1,
    borderColor: alpha(darkTokens.text, 0.2),
  },
  uploadBtnText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: C.white,
  },
  uploadHint: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1,
    color: C.faint,
  },
  replaceBtn: {
    marginTop: 11,
    alignSelf: "flex-start",
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
  },
  replaceText: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1,
    color: C.grey,
    textTransform: "uppercase",
  },
});
