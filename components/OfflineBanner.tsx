// components/OfflineBanner.tsx
// Bandeau persistant offline + bandeau "Reconnexion…" (socket) + bandeau fugace reconnexion

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SHEET_SPRING } from '@/lib/motion/sheet';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetwork } from '../lib/NetworkContext';
import { useOfflineQueue } from '../lib/OfflineQueueContext';
import { useSocket } from '../lib/SocketContext';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

const RESTORED_BANNER_MS = 2500;
// Le socket coupe à chaque passage en arrière-plan et se reconnecte en une ou
// deux secondes au retour : sans ce délai, « Reconnexion… » puis « Connexion
// rétablie » s'affichaient à CHAQUE retour dans l'app. Même délai que le réseau
// (NetworkContext, 4 s) : on ne signale qu'une coupure qui dure.
const SOCKET_DOWN_DELAY_MS = 4_000;

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const { connectionStatus } = useSocket();
  const { pendingCount, isProcessing } = useOfflineQueue();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const slideY = useSharedValue(-120);
  const slideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideY.value }] }));
  const [offlineVisible, setOfflineVisible] = useState(false);
  const [restoredVisible, setRestoredVisible] = useState(false);
  const restoredTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Socket down alors que le réseau est OK → "Reconnexion…"
  // ('connecting' initial exclu pour ne pas afficher le bandeau à chaque démarrage)
  const socketDownRaw = isOnline &&
    (connectionStatus === 'disconnected' || connectionStatus === 'reconnecting');
  // Coupure socket confirmée (a duré plus de SOCKET_DOWN_DELAY_MS).
  const [socketDown, setSocketDown] = useState(false);
  const socketTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (socketDownRaw) {
      if (!socketTimerRef.current) {
        socketTimerRef.current = setTimeout(() => { socketTimerRef.current = null; setSocketDown(true); }, SOCKET_DOWN_DELAY_MS);
      }
    } else {
      if (socketTimerRef.current) { clearTimeout(socketTimerRef.current); socketTimerRef.current = null; }
      setSocketDown(false);
    }
    return () => { if (socketTimerRef.current) { clearTimeout(socketTimerRef.current); socketTimerRef.current = null; } };
  }, [socketDownRaw]);
  const prevSocketDownRef = useRef(false);

  const bannerActive = !isOnline || socketDown;

  // Slide down quand offline / socket down, unmount quand tout est rétabli
  useEffect(() => {
    if (bannerActive) {
      setOfflineVisible(true);
      slideY.value = withSpring(0, SHEET_SPRING);
    } else {
      // Sortie sur le même ressort que l'entrée, depuis la position courante.
      slideY.value = withSpring(-120, SHEET_SPRING, (finished) => {
        if (finished) runOnJS(setOfflineVisible)(false);
      });
    }
  }, [bannerActive, slideY]);

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
    : t('offline.reconnecting');

  return (
    <>
      {/* Bandeau offline / reconnexion persistant */}
      {offlineVisible && (
        <Animated.View
          style={[
            styles.offlineBanner,
            { paddingTop: insets.top + 10, backgroundColor: theme.isDark ? theme.surface : theme.accent },
            slideStyle,
          ]}
          accessibilityRole="alert"
          accessibilityLabel={!isOnline ? t('offline.banner') : t('offline.reconnecting')}
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
            {t('offline.reconnected')}
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
