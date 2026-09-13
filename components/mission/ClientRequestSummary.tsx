// components/mission/ClientRequestSummary.tsx
// Côté client, pendant le suivi (planche 4A) : la ligne de sa demande (même
// composant que la liste du prestataire, prix TTC à droite), ses photos, et
// son prestataire (langues, note, missions, message, appel). Le client voit
// exactement ce que le prestataire a reçu.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import type { MissionBrief } from '@/lib/mission/brief';
import { MissionRow } from './MissionRow';
import { PhotoGallery } from './photos';
import { ProviderBlock } from './blocks';

type Props = {
  brief: MissionBrief;
  onOpenRequest?: () => void;
  onMessageProvider?: () => void;
  onCallProvider?: () => void;
  providerPhone?: string | null;
  /** Masquer le bloc prestataire (déjà affiché au-dessus par l'écran). */
  hideProvider?: boolean;
  /** Padding horizontal du conteneur parent, compensé pour aligner les blocs à 24 pt. */
  inset?: number;
};

export function ClientRequestSummary({ brief, onOpenRequest, onMessageProvider, onCallProvider, providerPhone, hideProvider = false, inset = 20 }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View style={{ marginHorizontal: -inset }}>
      <Text style={[s.label, { color: theme.textMuted }]}>{t('mission.your_request').toUpperCase()}</Text>
      <MissionRow brief={brief} amountMode="gross" standalone onPress={onOpenRequest ?? (() => {})} />
      <PhotoGallery photos={brief.photos} title={t('mission.your_photos')} />
      {!hideProvider ? <ProviderBlock brief={brief} onMessage={onMessageProvider} onCall={onCallProvider} phone={providerPhone} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: FONTS.mono, fontSize: 11, letterSpacing: 1.5, paddingHorizontal: 24, paddingTop: 6, paddingBottom: 8 },
});
