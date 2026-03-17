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
  ActivityIndicator, Platform, Image, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/lib/api';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

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

function statusLabel(status: DocStatus): string {
  switch (status) {
    case 'APPROVED': return 'Approuvé';
    case 'REJECTED': return 'Rejeté';
    case 'PENDING':  return 'En attente';
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
      Alert.alert(
        'Module manquant',
        'expo-image-picker n\'est pas installé.\n\nExécutez : npx expo install expo-image-picker',
      );
      return;
    }

    const acceptsPdfOnly = mimeTypes?.length === 1 && mimeTypes[0] === 'application/pdf';

    // Demander permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission refusée', 'Accès à la galerie nécessaire pour envoyer vos documents.');
      return;
    }

    // Choix : galerie ou appareil photo (PDF → toujours galerie)
    const shouldCamera = !acceptsPdfOnly;

    const action = shouldCamera
      ? await new Promise<'camera' | 'gallery' | 'cancel'>(resolve => {
          Alert.alert(
            'Choisir une source',
            '',
            [
              { text: 'Appareil photo', onPress: () => resolve('camera') },
              { text: 'Galerie',        onPress: () => resolve('gallery') },
              { text: 'Annuler', style: 'cancel', onPress: () => resolve('cancel') },
            ],
          );
        })
      : 'gallery';

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
        Alert.alert('Permission refusée', 'Accès à la caméra nécessaire.');
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
      Alert.alert('Erreur upload', err?.message || 'Impossible d\'envoyer le document.');
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
          {mandatory && <View style={[s.mandatoryBadge, { backgroundColor: theme.accent }]}><Text style={[s.mandatoryText, { color: theme.accentText }]}>Requis</Text></View>}
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
              <Text style={[s.uploadingText, { color: theme.textSub, fontFamily: FONTS.sans }]}>Envoi en cours…</Text>
            </View>
          ) : hasDoc ? (
            <View style={s.doneRow}>
              <View style={[s.statusBadge, { backgroundColor: stBg }]}>
                <Ionicons
                  name={uploaded?.status === 'APPROVED' ? 'checkmark-circle' : uploaded?.status === 'REJECTED' ? 'close-circle' : 'time-outline'}
                  size={13}
                  color={stText}
                />
                <Text style={[s.statusText, { color: stText, fontFamily: FONTS.sansMedium }]}>
                  {statusLabel(uploaded?.status ?? null)}
                </Text>
              </View>
              <TouchableOpacity onPress={pickAndUpload} style={s.replaceBtn}>
                <Ionicons name="refresh" size={13} color={theme.textMuted} />
                <Text style={[s.replaceBtnText, { color: theme.textMuted, fontFamily: FONTS.sans }]}>Remplacer</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={[s.uploadBtn, { borderColor: theme.borderLight, backgroundColor: theme.surface }]} onPress={pickAndUpload} activeOpacity={0.75}>
              <Ionicons name="cloud-upload-outline" size={18} color={theme.text} />
              <Text style={[s.uploadBtnText, { color: theme.text, fontFamily: FONTS.sansMedium }]}>Ajouter le document</Text>
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
  label: { fontSize: 14, fontWeight: '600', flex: 1 },

  mandatoryBadge: {
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  mandatoryText: { fontSize: 10, fontWeight: '700' },

  accepts: { fontSize: 12, fontWeight: '500' },

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
  statusText: { fontSize: 12, fontWeight: '600' },

  replaceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
  },
  replaceBtnText: { fontSize: 12, fontWeight: '500' },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  uploadBtnText: { fontSize: 14, fontWeight: '600' },
});
