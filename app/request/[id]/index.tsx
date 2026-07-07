// app/request/[id]/index.tsx — Dispatcher par statut
// Cette route ne rend aucun détail : elle fetch la demande puis redirige vers
// l'écran adapté à son statut COURANT via lib/requestDestination (source de
// vérité unique). Loading + état erreur/retry si le fetch échoue.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { devError } from '@/lib/logger';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth/AuthContext';
import {
  resolveRequestDestination,
  resolveProviderDestination,
  navigateToDestination,
} from '@/lib/requestDestination';

export default function RequestDispatcher() {
  const router = useRouter();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [error, setError] = useState(false);

  const resolve = useCallback(async () => {
    if (!id) {
      router.replace('/(tabs)/dashboard');
      return;
    }
    setError(false);
    try {
      const res: any = await api.requests.get(String(id));
      const req = res?.data ?? res;
      // Client de la demande → résolution client ; sinon prestataire assigné/candidat.
      const asProvider = !!user?.roles?.includes('PROVIDER') && req?.clientId !== user?.id;
      const dest = asProvider ? resolveProviderDestination(req) : resolveRequestDestination(req);
      navigateToDestination({ ...dest, replace: true });
    } catch (e) {
      devError('[request/[id]] resolve error:', e);
      setError(true);
    }
  }, [id, user?.id, user?.roles, router]);

  useEffect(() => { resolve(); }, [resolve]);

  return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.bg }]}>
      <StatusBar barStyle={theme.statusBar} />
      {error ? (
        <View style={styles.errorWrap}>
          <Feather name="alert-circle" size={40} color={theme.textMuted} />
          <Text style={[styles.errorText, { color: theme.textSub, fontFamily: FONTS.sans }]}>
            {t('ext.request_load_error')}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: theme.accent }]}
            onPress={resolve}
            activeOpacity={0.85}
          >
            <Feather name="refresh-cw" size={16} color={theme.accentText} />
            <Text style={[styles.retryText, { color: theme.accentText, fontFamily: FONTS.sansMedium }]}>
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.backText, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>
              {t('common.back')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ActivityIndicator size="large" color={theme.accent} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorWrap: { alignItems: 'center', paddingHorizontal: 32, gap: 12 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 100,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  retryText: { fontSize: 14 },
  backBtn: { paddingVertical: 8, paddingHorizontal: 12 },
  backText: { fontSize: 13, textDecorationLine: 'underline' },
});
