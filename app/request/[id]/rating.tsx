// app/request/[id]/rating.tsx
// Terminé, en page pleine : pour les liens profonds et resolveRequestDestination.
// Dans le parcours normal, le bilan s'ouvre dans la feuille du suivi
// (missionview, stade « done ») sans changer d'écran.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { resolveRequestDestination, navigateToDestination } from '@/lib/requestDestination';
import { showSocketToast } from '@/lib/SocketContext';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { DoneContent } from '@/components/tracking/DoneContent';

export default function DoneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setLoadError(false);
    try {
      const res: any = await api.get(`/requests/${id}`);
      const req = res?.data || res;
      // On ne note que si la mission est terminée et pas encore notée : une
      // notif tardive ne doit jamais rouvrir un formulaire vierge.
      const status = (req?.status || '').toUpperCase();
      if (req?.reviewExists || (status && status !== 'DONE')) {
        if (req?.reviewExists) showSocketToast(t('rating.already_rated'), 'info');
        navigateToDestination({ ...resolveRequestDestination(req), replace: true });
        return;
      }
      setRequest(req);
    } catch (e) {
      devError('[Done] load', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [id, t]);
  useEffect(() => { load(); }, [load]);

  if (loadError) {
    return (
      <View style={[s.center, { backgroundColor: theme.bg, paddingHorizontal: 32 }]}>
        <StatusBar barStyle={theme.statusBar} />
        <Feather name="alert-circle" size={40} color={theme.textMuted as string} />
        <Text style={[s.errText, { color: theme.textSub }]}>{t('tracking.load_error')}</Text>
        <Pressable style={[s.retry, { backgroundColor: theme.accent }]} onPress={load} accessibilityRole="button">
          <Feather name="refresh-cw" size={16} color={theme.accentText as string} />
          <Text style={[s.retryText, { color: theme.accentText }]}>{t('tracking.retry')}</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/(tabs)/dashboard')} accessibilityRole="button" style={s.later}><Text style={[s.laterText, { color: theme.textMuted }]}>{t('tracking.later')}</Text></Pressable>
      </View>
    );
  }
  if (loading || !request) {
    return <View style={[s.center, { backgroundColor: theme.bg }]}><StatusBar barStyle={theme.statusBar} /><ActivityIndicator size="large" color={theme.accent as string} /></View>;
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.cardBg }}>
      <StatusBar barStyle={theme.statusBar} />
      <DoneContent request={request} topInset={insets.top} />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  errText: { fontFamily: FONTS.sans, fontSize: 14, textAlign: 'center' },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 100, paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { fontFamily: FONTS.sansMedium, fontSize: 14 },
  later: { alignItems: 'center', paddingVertical: 10 },
  laterText: { fontFamily: FONTS.sansMedium, fontSize: 13 },
});
