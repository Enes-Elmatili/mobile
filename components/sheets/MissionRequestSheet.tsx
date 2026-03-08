// components/sheets/MissionRequestSheet.tsx
// ─── Bottom Sheet animée "Nouvelle Mission" — zéro Alert, zéro friction ───────
//
// Ce composant est monté globalement via MissionRequestLayer dans SocketContext.
// Il s'affiche automatiquement quand le socket reçoit l'event `new_request`.
// Aucun import nécessaire dans le ProviderDashboard.

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
  Vibration,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

const SHEET_HEIGHT      = 360;
const COUNTDOWN_SECONDS = 25;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface MissionRequest {
  requestId:       string | number;
  service?:        string;   // ex: "Plomberie"
  distance?:       string;   // ex: "1.2 km"
  estimatedPrice?: number;   // ex: 65
  clientName?:     string;   // ex: "Sophie M."
  address?:        string;   // ex: "14 Rue de la Paix, Paris"
  scheduledAt?:    string;   // ex: "Aujourd'hui à 15h00"
}

interface Props {
  request:   MissionRequest | null;
  onAccept:  (requestId: string) => void;
  onDecline: () => void;
}

// ─── Icônes par service ───────────────────────────────────────────────────────
const SERVICE_ICONS: Record<string, string> = {
  plomberie:    '🔧',
  ménage:       '🧹',
  bricolage:    '🔨',
  électricité:  '⚡',
  jardinage:    '🌿',
  default:      '⚡',
};

function getServiceIcon(service?: string): string {
  if (!service) return SERVICE_ICONS.default;
  return SERVICE_ICONS[service.toLowerCase()] ?? SERVICE_ICONS.default;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function MissionRequestSheet({ request, onAccept, onDecline }: Props) {
  const { t } = useTranslation();
  const translateY    = useRef(new Animated.Value(SHEET_HEIGHT + 60)).current;
  const backdropAnim  = useRef(new Animated.Value(0)).current;
  const progressAnim  = useRef(new Animated.Value(1)).current;
  const pulseAnim     = useRef(new Animated.Value(1)).current;
  const pulseLoop     = useRef<Animated.CompositeAnimation | null>(null);
  const progressTimer = useRef<Animated.CompositeAnimation | null>(null);
  const isHiding      = useRef(false);

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Haptics ───────────────────────────────────────────────────────────────
  const triggerArrivalHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 320);
    } else {
      Vibration.vibrate([0, 120, 80, 120]);
    }
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Vibration.vibrate([0, 60, 40, 60]);
    }
  }, []);

  const triggerDeclineHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Vibration.vibrate(180);
    }
  }, []);

  // ── Hide ──────────────────────────────────────────────────────────────────
  const hide = useCallback((cb?: () => void) => {
    if (isHiding.current) return;
    isHiding.current = true;

    if (timerRef.current) clearInterval(timerRef.current);
    progressTimer.current?.stop();
    pulseLoop.current?.stop();

    Animated.parallel([
      Animated.timing(translateY, {
        toValue:  SHEET_HEIGHT + 60,
        duration: 320,
        easing:   Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue:  0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      isHiding.current = false;
      cb?.();
    });
  }, []);

  // ── Show ──────────────────────────────────────────────────────────────────
  const show = useCallback(() => {
    isHiding.current = false;
    setIsVisible(true);
    setCountdown(COUNTDOWN_SECONDS);
    progressAnim.setValue(1);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue:  0,
        duration: 440,
        easing:   Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue:  1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start(() => triggerArrivalHaptic());

    // Pulsation bouton Accept
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 680, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 680, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();

    // Barre progress countdown
    progressTimer.current = Animated.timing(progressAnim, {
      toValue:  0,
      duration: COUNTDOWN_SECONDS * 1000,
      easing:   Easing.linear,
      useNativeDriver: false, // width ne peut pas utiliser native driver
    });
    progressTimer.current.start(({ finished }) => {
      if (finished) hide(() => onDecline());
    });
  }, [onDecline]);

  // ── Countdown numérique ───────────────────────────────────────────────────
  useEffect(() => {
    if (!isVisible) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timerRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isVisible]);

  // ── Réactivité prop request ───────────────────────────────────────────────
  useEffect(() => {
    if (request) {
      show();
    } else if (isVisible) {
      hide();
    }
  }, [request]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    triggerSuccessHaptic();
    hide(() => onAccept(String(request?.requestId)));
  }, [request, onAccept]);

  const handleDecline = useCallback(() => {
    triggerDeclineHaptic();
    hide(() => onDecline());
  }, [onDecline]);

  if (!isVisible && !request) return null;

  const icon         = getServiceIcon(request?.service);
  const isUrgent     = countdown <= 8;
  const urgencyColor = isUrgent ? '#EF4444' : '#0A0A0A';

  const progressWidth = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0%', '100%'],
  });

  const backdropOpacity = backdropAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <View style={styles.wrapper} pointerEvents="box-none">

      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="none"
      />

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>

        {/* Barre countdown */}
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: urgencyColor }]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Text style={styles.iconEmoji}>{icon}</Text>
          </View>
          <View style={styles.headerText}>
            <Text style={styles.overline}>{t('mission_sheet.new_mission')}</Text>
            <Text style={styles.serviceTitle} numberOfLines={1}>
              {request?.service ?? t('common.service')}
            </Text>
          </View>
          <View style={[styles.countdownBubble, { borderColor: urgencyColor }]}>
            <Text style={[styles.countdownNum, { color: urgencyColor }]}>{countdown}</Text>
            <Text style={[styles.countdownSuffix, { color: urgencyColor }]}>s</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Détails mission */}
        <View style={styles.details}>
          {request?.address    && <DetailRow emoji="📍" value={request.address} />}
          {request?.distance   && <DetailRow emoji="🛣"  value={`${request.distance} ${t('mission_sheet.from_you')}`} />}
          {request?.scheduledAt && <DetailRow emoji="🕐" value={request.scheduledAt} />}
          {request?.clientName && <DetailRow emoji="👤" value={request.clientName} />}
        </View>

        {/* Prix estimé */}
        {request?.estimatedPrice != null && (
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('mission_sheet.estimated_earning')}</Text>
            <Text style={styles.priceValue}>{request.estimatedPrice} €</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.declineBtn} onPress={handleDecline} activeOpacity={0.7} accessibilityLabel={t('mission_sheet.decline')} accessibilityRole="button">
            <Text style={styles.declineTxt}>{t('mission_sheet.decline')}</Text>
          </TouchableOpacity>

          <Animated.View style={[styles.acceptWrap, { transform: [{ scale: pulseAnim }] }]}>
            <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} activeOpacity={0.85} accessibilityLabel={t('mission_sheet.accept')} accessibilityRole="button">
              <Text style={styles.acceptTxt}>{t('mission_sheet.accept')}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

      </Animated.View>
    </View>
  );
}

// ─── Detail Row helper ────────────────────────────────────────────────────────
function DetailRow({ emoji, value }: { emoji: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailEmoji}>{emoji}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 8000,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    backgroundColor:      '#FFFFFF',
    borderTopLeftRadius:  26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 38 : 26,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOpacity: 0.28,
        shadowRadius:  28,
        shadowOffset:  { width: 0, height: -10 },
      },
      android: { elevation: 28 },
    }),
  },

  // Progress bar
  progressTrack: { height: 3, backgroundColor: '#EFEFEF' },
  progressFill:  { height: 3 },

  // Header
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 22,
    paddingTop:        22,
    paddingBottom:     16,
    gap: 14,
  },
  iconBadge: {
    width:           50,
    height:          50,
    borderRadius:    14,
    backgroundColor: '#F5F5F5',
    alignItems:      'center',
    justifyContent:  'center',
  },
  iconEmoji:  { fontSize: 24 },
  headerText: { flex: 1 },
  overline: {
    fontSize:      10,
    fontWeight:    '800',
    color:         '#AAAAAA',
    letterSpacing: 1.4,
    marginBottom:  3,
  },
  serviceTitle: {
    fontSize:      21,
    fontWeight:    '800',
    color:         '#0A0A0A',
    letterSpacing: -0.4,
  },

  // Countdown
  countdownBubble: {
    width:          54,
    height:         54,
    borderRadius:   27,
    borderWidth:    2.5,
    alignItems:     'center',
    justifyContent: 'center',
    flexDirection:  'row',
    gap: 1,
  },
  countdownNum: {
    fontSize:   19,
    fontWeight: '900',
    lineHeight: 23,
  },
  countdownSuffix: {
    fontSize:     10,
    fontWeight:   '700',
    alignSelf:    'flex-end',
    marginBottom: 3,
  },

  // Divider
  divider: {
    height:           1,
    backgroundColor:  '#F2F2F2',
    marginHorizontal: 22,
    marginBottom:     16,
  },

  // Details
  details: {
    paddingHorizontal: 22,
    gap:         10,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap: 10,
  },
  detailEmoji: { fontSize: 14, width: 22, textAlign: 'center' },
  detailValue: {
    fontSize:   14,
    color:      '#3A3A3A',
    fontWeight: '500',
    flex: 1,
  },

  // Price
  priceRow: {
    flexDirection:    'row',
    justifyContent:   'space-between',
    alignItems:       'center',
    marginHorizontal: 22,
    paddingVertical:  14,
    borderTopWidth:   1,
    borderTopColor:   '#F2F2F2',
    marginBottom:     20,
  },
  priceLabel: { fontSize: 14, color: '#999', fontWeight: '600' },
  priceValue: {
    fontSize:      26,
    color:         '#0A0A0A',
    fontWeight:    '900',
    letterSpacing: -0.6,
  },

  // Actions
  actions: {
    flexDirection:     'row',
    paddingHorizontal: 22,
    gap: 12,
  },
  declineBtn: {
    width:           88,
    height:          56,
    borderRadius:    16,
    backgroundColor: '#F2F2F2',
    alignItems:      'center',
    justifyContent:  'center',
  },
  declineTxt: { fontSize: 15, fontWeight: '700', color: '#777' },
  acceptWrap: { flex: 1 },
  acceptBtn: {
    flex:            1,
    height:          56,
    borderRadius:    16,
    backgroundColor: '#0A0A0A',
    alignItems:      'center',
    justifyContent:  'center',
    ...Platform.select({
      ios: {
        shadowColor:   '#000',
        shadowOpacity: 0.4,
        shadowRadius:  14,
        shadowOffset:  { width: 0, height: 7 },
      },
      android: { elevation: 12 },
    }),
  },
  acceptTxt: {
    fontSize:      16,
    fontWeight:    '800',
    color:         '#FFF',
    letterSpacing: 0.3,
  },
});