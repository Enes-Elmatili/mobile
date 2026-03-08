// components/OfflineBanner.tsx
// Bandeau persistant offline + bandeau fugace reconnexion

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../lib/NetworkContext';
import { useOfflineQueue } from '../lib/OfflineQueueContext';
import { useTranslation } from 'react-i18next';

export function OfflineBanner() {
  const { isOnline, wasOffline } = useNetwork();
  const { pendingCount, isProcessing } = useOfflineQueue();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const reconnectAnim = useRef(new Animated.Value(-80)).current;

  // Slide down quand offline
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: isOnline ? -80 : 0,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [isOnline]);

  // Bandeau "Reconnecte" fugace
  useEffect(() => {
    if (wasOffline) {
      Animated.sequence([
        Animated.spring(reconnectAnim, { toValue: 0, useNativeDriver: true, tension: 100, friction: 10 }),
        Animated.delay(2500),
        Animated.spring(reconnectAnim, { toValue: -80, useNativeDriver: true, tension: 100, friction: 10 }),
      ]).start();
    }
  }, [wasOffline]);

  return (
    <>
      {/* Bandeau offline persistant */}
      <Animated.View
        style={[styles.offlineBanner, { transform: [{ translateY: slideAnim }] }]}
        accessibilityRole="alert"
        accessibilityLabel={t('offline.banner')}
        accessibilityLiveRegion="polite"
        pointerEvents="none"
      >
        <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
        <Text style={styles.bannerText}>
          {isProcessing
            ? t('offline.syncing', { count: pendingCount })
            : pendingCount > 0
              ? t('offline.offline', { count: pendingCount })
              : t('offline.offline_zero')}
        </Text>
      </Animated.View>

      {/* Bandeau reconnexion fugace */}
      <Animated.View
        style={[styles.onlineBanner, { transform: [{ translateY: reconnectAnim }] }]}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        pointerEvents="none"
      >
        <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
        <Text style={styles.bannerText}>{t('offline.reconnected')}</Text>
      </Animated.View>
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
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
  },
  onlineBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9997,
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingTop: Platform.OS === 'ios' ? 54 : 34,
  },
  bannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
