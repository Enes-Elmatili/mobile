/**
 * DocumentUploader — Upload d'un document KYC prestataire
 *
 * Prérequis : installer expo-image-picker
 *   npx expo install expo-image-picker
 *
 * Props
 *   docKey      — identifiant stable du document (ex: "kbis", "assurance_rc_pro")
 *   label       — libellé affiché à l'utilisateur
 *   mimeTypes   — formats acceptés (affichés à l'utilisateur)
 *   mandatory   — affiche un badge "Obligatoire" si true
 *   categoryId  — id numérique de la Category Prisma (optionnel)
 *   onUploaded  — callback appelé avec { id, fileUrl, status } après upload réussi
 *
 * Comportement
 *   - Affiche la photo en miniature une fois sélectionnée
 *   - Progress bar d'upload
 *   - Badge statut : EN_ATTENTE / APPROUVÉ / REJETÉ (lu depuis API)
 *   - AsyncStorage : mémorise le statut pour éviter un re-upload sur re-rendu
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Platform, Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';

// ── Types ─────────────────────────────────────────────────────────────────────

type DocStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | null;

interface UploadedDoc {
  id: string;
  fileUrl: string;
  status: DocStatus;
}

interface DocumentUploaderProps {
  docKey: string;
  label: string;
  mimeTypes?: string[];
  mandatory?: boolean;
  categoryId?: number;
  onUploaded?: (doc: UploadedDoc) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CACHE_PREFIX = '@fixed:doc:';

function statusLabel(status: DocStatus, t: (k: string) => string): string {
  switch (status) {
    case 'APPROVED': return t('ext.doc_status_approved');
    case 'REJECTED': return t('ext.doc_status_rejected');
    case 'PENDING':  return t('ext.doc_status_pending');
    default:         return '';
  }
}

function acceptsText(mimeTypes?: string[]): string {
  if (!mimeTypes?.length) return 'Photo ou PDF';
  const hasPdf = mimeTypes.includes('application/pdf');
  const hasImg = mimeTypes.some(m => m.startsWith('image/'));
  if (hasPdf && hasImg) return 'Photo ou PDF';
  if (hasPdf) return 'PDF uniquement';
  return 'Photo uniquement';
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function DocumentUploader({
  docKey,
  label,
  mimeTypes,
  mandatory = false,
  categoryId,
  onUploaded,
}: DocumentUploaderProps) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const cacheKey = `${CACHE_PREFIX}${docKey}`;

  const [uploading, setUploading]       = useState(false);
  const [localUri,  setLocalUri]        = useState<string | null>(null);
  const [uploaded,  setUploaded]        = useState<UploadedDoc | null>(null);

  function statusColor(status: DocStatus): { text: string; bg: string } {
    switch (status) {
      case 'APPROVED': return { text: theme.text,      bg: theme.surface };
      case 'REJECTED': return { text: theme.textMuted,  bg: theme.surface };
      case 'PENDING':  return { text: theme.textSub,    bg: theme.surface };
      default:         return { text: theme.textMuted,  bg: theme.surface };
    }
  }

  // Recharger le cache au montage
  useEffect(() => {
    AsyncStorage.getItem(cacheKey).then(raw => {
      if (raw) {
        try { setUploaded(JSON.parse(raw)); } catch { /* ignore */ }
      }
    });
  }, [cacheKey]);

  // Ouvrir le sélecteur d'images/documents
  const pickAndUpload = useCallback(async () => {
    // ── Vérification runtime : expo-image-picker installé ? ────────────────
    let ImagePicker: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      ImagePicker = require('expo-image-picker');
    } catch {
      feedback.error('ext.doc_picker_missing_msg');
      return;
    }

    const acceptsPdfOnly = mimeTypes?.length === 1 && mimeTypes[0] === 'application/pdf';

    // Demander permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      feedback.error('profile.gallery_denied');
      return;
    }

    // Choix : galerie ou appareil photo (PDF → toujours galerie)
    const shouldCamera = !acceptsPdfOnly;

    let action: 'camera' | 'gallery' | 'cancel';
    if (shouldCamera) {
      const idx = await feedback.actionSheet({
        titleKey: 'ext.doc_picker_choose_source',
        options: [
          { labelKey: 'ext.doc_picker_camera' },
          { labelKey: 'ext.doc_picker_gallery' },
        ],
        cancelKey: 'common.cancel',
      });
      action = idx === 0 ? 'camera' : idx === 1 ? 'gallery' : 'cancel';
    } else {
      action = 'gallery';
    }

    if (action === 'cancel') return;

    let result: any;
    const opts = {
      mediaTypes: ImagePicker.MediaTypeOptions?.Images ?? 'Images',
      quality: 0.75,
      allowsEditing: false,
    };

    if (action === 'camera') {
      const camPerm = await ImagePicker.requestCameraPermissionsAsync();
      if (camPerm.status !== 'granted') {
        feedback.error('profile.camera_denied');
        return;
      }
      result = await ImagePicker.launchCameraAsync(opts);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(opts);
    }

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setLocalUri(asset.uri);

    // ── Upload ──────────────────────────────────────────────────────────────
    setUploading(true);
    try {
      const formData = new FormData();
      // @ts-ignore — React Native FormData accepte cet objet
      formData.append('file', {
        uri: asset.uri,
        name: asset.fileName ?? `${docKey}.jpg`,
        type: asset.mimeType ?? 'image/jpeg',
      });
      formData.append('docKey', docKey);
      if (categoryId != null) formData.append('categoryId', String(categoryId));

      const res = await api.providerDocs.upload(formData);
      const doc: UploadedDoc = {
        id: res.document.id,
        fileUrl: res.document.fileUrl,
        status: res.document.status,
      };

      setUploaded(doc);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(doc));
      onUploaded?.(doc);
    } catch (err: any) {
      feedback.error(err?.message || t('profile.upload_error'));
    } finally {
      setUploading(false);
    }
  }, [docKey, categoryId, cacheKey, mimeTypes, onUploaded]);

  // ── Render ────────────────────────────────────────────────────────────────

  const hasDoc = !!uploaded;
  const { text: stText, bg: stBg } = statusColor(uploaded?.status ?? null);

  return (
    <View style={[s.container, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
      {/* En-tête */}
      <View style={s.header}>
        <View style={s.labelRow}>
          <Text style={[s.label, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={2}>{label}</Text>
          {mandatory && <View style={[s.mandatoryBadge, { backgroundColor: theme.accent }]}><Text style={[s.mandatoryText, { color: theme.accentText }]}>{t('common.required')}</Text></View>}
        </View>
        <Text style={[s.accepts, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{acceptsText(mimeTypes)}</Text>
      </View>

      {/* Corps */}
      <View style={s.body}>
        {/* Miniature */}
        {localUri && (
          <Image
            source={{ uri: localUri }}
            style={[s.thumbnail, { backgroundColor: theme.surface, borderColor: theme.borderLight }]}
            resizeMode="cover"
          />
        )}

        {/* Zone d'action */}
        <View style={s.actionArea}>
          {uploading ? (
            <View style={s.uploadingRow}>
              <ActivityIndicator size="small" color={theme.textSub} />
              <Text style={[s.uploadingText, { color: theme.textSub, fontFamily: FONTS.sans }]}>{t('profile.uploading')}</Text>
            </View>
          ) : hasDoc ? (
            <View style={s.doneRow}>
              <View style={[s.statusBadge, { backgroundColor: stBg }]}>
                <Feather
                  name={uploaded?.status === 'APPROVED' ? 'check-circle' : uploaded?.status === 'REJECTED' ? 'x-circle' : 'clock'}
                  size={13}
                  color={stText}
                />
                <Text style={[s.statusText, { color: stText, fontFamily: FONTS.sansMedium }]}>
                  {statusLabel(uploaded?.status ?? null, t)}
                </Text>
              </View>
              <TouchableOpacity onPress={pickAndUpload} style={s.replaceBtn}>
                <Feather name="refresh-cw" size={13} color={theme.textMuted} />
                <Text style={[s.replaceBtnText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>{t('profile.replace_doc')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[s.uploadBtn, { borderColor: theme.borderLight, backgroundColor: theme.surface }]} onPress={pickAndUpload} activeOpacity={0.75}>
              <Feather name="upload" size={18} color={theme.text} />
              <Text style={[s.uploadBtnText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>{t('profile.add_doc')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
    }),
  },

  header: { gap: 3 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 14, fontFamily: FONTS.sansMedium, flex: 1 },

  mandatoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  mandatoryText: { fontSize: 10, fontFamily: FONTS.sansMedium },

  accepts: { fontSize: 12, fontFamily: FONTS.sans },

  body: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  thumbnail: {
    width: 56, height: 56, borderRadius: 10,
    borderWidth: 1,
  },

  actionArea: { flex: 1 },

  uploadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  uploadingText: { fontSize: 13 },

  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8,
  },
  statusText: { fontSize: 12, fontFamily: FONTS.sansMedium },

  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  replaceBtnText: { fontSize: 12, fontFamily: FONTS.sans },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  uploadBtnText: { fontSize: 14, fontFamily: FONTS.sansMedium },
});
