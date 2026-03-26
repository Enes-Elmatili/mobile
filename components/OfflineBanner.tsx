// components/OfflineBanner.tsx
// Bandeau persistant offline + bandeau fugace reconnexion

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../lib/NetworkContext';
import { useOfflineQueue } from '../lib/OfflineQueueContext';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS } from '@/hooks/use-app-theme';

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const { pendingCount, isProcessing } = useOfflineQueue();
  const { t } = useTranslation();
  const theme = useAppTheme();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const [offlineVisible, setOfflineVisible] = useState(false);

  // Slide down quand offline, unmount quand online
  useEffect(() => {
    if (!isOnline) {
      setOfflineVisible(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 100,
        friction: 10,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setOfflineVisible(false);
      });
    }
  }, [isOnline]);


  return (
    <>
      {/* Bandeau offline persistant */}
      {offlineVisible && (
        <Animated.View
          style={[styles.offlineBanner, { backgroundColor: theme.isDark ? theme.surface : theme.accent, transform: [{ translateY: slideAnim }] }]}
          accessibilityRole="alert"
          accessibilityLabel={t('offline.banner')}
          accessibilityLiveRegion="polite"
          pointerEvents="none"
        >
          <Ionicons name="cloud-offline-outline" size={16} color={theme.isDark ? theme.text : theme.accentText} />
          <Text style={[styles.bannerText, { color: theme.isDark ? theme.text : theme.accentText, fontFamily: FONTS.sansMedium }]}>
            {isProcessing
              ? t('offline.syncing', { count: pendingCount })
              : pendingCount > 0
                ? t('offline.offline', { count: pendingCount })
                : t('offline.offline_zero')}
          </Text>
        </Animated.View>
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
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
  },
bannerText: {
    fontSize: 13,
  },
});
