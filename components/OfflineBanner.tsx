// components/OfflineBanner.tsx
// Bandeau persistant offline + bandeau "Reconnexion…" (socket) + bandeau fugace reconnexion

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../lib/NetworkContext';
import { useOfflineQueue } from '../lib/OfflineQueueContext';
import { useSocket } from '../lib/SocketContext';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

const RESTORED_BANNER_MS = 2500;

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const { connectionStatus } = useSocket();
  const { pendingCount, isProcessing } = useOfflineQueue();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const [offlineVisible, setOfflineVisible] = useState(false);
  const [restoredVisible, setRestoredVisible] = useState(false);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket down alors que le réseau est OK → "Reconnexion…"
  // ('connecting' initial exclu pour ne pas afficher le bandeau à chaque démarrage)
  const socketDown = isOnline &&
    (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting');
  const prevSocketDownRef = useRef(false);

  const bannerActive = !isOnline || socketDown;

  // Slide down quand offline / socket down, unmount quand tout est rétabli
  useEffect(() => {
    if (bannerActive) {
      setOfflineVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setOfflineVisible(false);
      });
    }
  }, [bannerActive]);

  // Bandeau fugace "Connexion rétablie" — réseau revenu OU socket reconnecté
  useEffect(() => {
    const socketRestored = prevSocketDownRef.current && !socketDown && isOnline;
    prevSocketDownRef.current = socketDown;
    const networkRestored = isOnline && wasOffline;
    if (networkRestored || socketRestored) {
      setRestoredVisible(true);
      if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
      restoredTimerRef.current = setTimeout(() => {
        restoredTimerRef.current = null;
        setRestoredVisible(false);
      }, RESTORED_BANNER_MS);
    }
  }, [isOnline, wasOffline, socketDown]);

  useEffect(() => () => {
    if (restoredTimerRef.current) clearTimeout(restoredTimerRef.current);
  }, []);

  const offlineLabel = !isOnline
    ? (isProcessing
        ? t('offline.syncing', { count: pendingCount })
        : pendingCount > 0
          ? t('offline.offline', { count: pendingCount })
          : t('offline.offline_zero'))
    : 'Reconnexion en cours…';

  return (
    <>
      {/* Bandeau offline / reconnexion persistant */}
      {offlineVisible && (
        <Animated.View
          style={[
            styles.offlineBanner,
            { paddingTop: insets.top + 10, backgroundColor: theme.isDark ? theme.surface : theme.accent, transform: [{ translateY: slideAnim }] },
          ]}
          accessibilityRole="alert"
          accessibilityLabel={!isOnline ? t('offline.banner') : 'Reconnexion en cours'}
          accessibilityLiveRegion="polite"
          pointerEvents="none"
        >
          <Feather name={!isOnline ? 'wifi-off' : 'refresh-cw'} size={16} color={theme.isDark ? theme.text : theme.accentText} />
          <Text style={[styles.bannerText, { color: theme.isDark ? theme.text : theme.accentText, fontFamily: FONTS.sansMedium }]}>
            {offlineLabel}
          </Text>
        </Animated.View>
      )}

      {/* Bandeau fugace "Connexion rétablie" */}
      {restoredVisible && !offlineVisible && (
        <View
          style={[styles.offlineBanner, { paddingTop: insets.top + 10, backgroundColor: theme.isDark ? theme.surface : theme.accent }]}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          pointerEvents="none"
        >
          <Feather name="wifi" size={16} color={theme.greenText} />
          <Text style={[styles.bannerText, { color: theme.greenText, fontFamily: FONTS.sansMedium }]}>
            Connexion rétablie
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9997,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  bannerText: {
    fontSize: 13,
  },
});
