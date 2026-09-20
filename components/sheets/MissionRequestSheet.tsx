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
  TouchableOpacity,
  Platform,
  Vibration,
  Pressable,
} from 'react-native';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SHEET_SPRING } from '@/lib/motion/sheet';
import { SlideToConfirm } from '@/components/ui/SlideToConfirm';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { feedback } from '@/lib/feedback/feedback';
import { cleanName } from '@/lib/displayName';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

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

// ─── Icônes par service (Feather — charter: no emoji) ─────────────
type FeatherName = React.ComponentProps<typeof Feather>['name'];
const SERVICE_ICONS: Record<string, FeatherName> = {
  plomberie:    'droplet',
  ménage:       'home',
  bricolage:    'tool',
  électricité:  'zap',
  jardinage:    'feather',
  default:      'tool',
};

function getServiceIcon(service?: string): FeatherName {
  if (!service) return SERVICE_ICONS.default;
  return SERVICE_ICONS[service.toLowerCase()] ?? SERVICE_ICONS.default;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export function MissionRequestSheet({ request, onAccept, onDecline }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  // Thread UI : le sheet arrive sur un ressort critique, la barre de compte à
  // rebours file en linéaire ; les callbacks JS passent par runOnJS.
  const translateY = useSharedValue(SHEET_HEIGHT + 60);
  const backdrop   = useSharedValue(0);
  const progress   = useSharedValue(1);
  const isHiding   = useRef(false);
  const hideCb     = useRef<(() => void) | undefined>(undefined);

  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Haptics ───────────────────────────────────────────────────────────────
  const triggerArrivalHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      feedback.haptic('warning');
      setTimeout(() => feedback.haptic('heavy'), 320);
    } else {
      Vibration.vibrate([0, 120, 80, 120]);
    }
  }, []);

  const triggerSuccessHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      feedback.haptic('success');
    } else {
      Vibration.vibrate([0, 60, 40, 60]);
    }
  }, []);

  const triggerDeclineHaptic = useCallback(() => {
    if (Platform.OS === 'ios') {
      feedback.haptic('medium');
    } else {
      Vibration.vibrate(180);
    }
  }, []);

  // ── Hide ──────────────────────────────────────────────────────────────────
  const finishHide = useCallback(() => {
    setIsVisible(false);
    isHiding.current = false;
    const cb = hideCb.current;
    hideCb.current = undefined;
    cb?.();
  }, []);

  const hide = useCallback((cb?: () => void) => {
    if (isHiding.current) return;
    isHiding.current = true;
    hideCb.current = cb;

    if (timerRef.current) clearInterval(timerRef.current);
    // Interrompre la barre : sa valeur reste où elle est, sans callback.
    progress.value = progress.value;

    translateY.value = withTiming(SHEET_HEIGHT + 60, { duration: 320, easing: Easing.in(Easing.quad) });
    backdrop.value = withTiming(0, { duration: 280 }, (finished) => {
      if (finished) runOnJS(finishHide)();
    });
  }, [backdrop, finishHide, progress, translateY]);

  // ── Show ──────────────────────────────────────────────────────────────────
  const onTimeout = useCallback(() => { hide(() => onDecline()); }, [hide, onDecline]);

  const show = useCallback(() => {
    isHiding.current = false;
    setIsVisible(true);
    setCountdown(COUNTDOWN_SECONDS);

    // Ressort critique (plus de « back » qui dépasse) ; l'haptique d'arrivée
    // tombe sur la frame où le sheet se pose (règle 6).
    translateY.value = withSpring(0, SHEET_SPRING, (finished) => {
      if (finished) runOnJS(triggerArrivalHaptic)();
    });
    backdrop.value = withTiming(1, { duration: 360 });

    // Barre de compte à rebours : linéaire, et refus automatique au bout.
    progress.value = 1;
    progress.value = withTiming(0, { duration: COUNTDOWN_SECONDS * 1000, easing: Easing.linear }, (finished) => {
      if (finished) runOnJS(onTimeout)();
    });
  }, [backdrop, onTimeout, progress, translateY, triggerArrivalHaptic]);

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

  // ── Global cleanup on unmount ─────────────────────────────────────────────
  // Stops any in-flight animations and intervals so callbacks can't fire
  // after the sheet (or its parent) is torn down.
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── Réactivité prop request ───────────────────────────────────────────────
  useEffect(() => {
    if (request) {
      show();
    } else if (isVisible) {
      hide();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- réagit à la demande seulement ; show/hide sont stables
  }, [request]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleAccept = useCallback(() => {
    triggerSuccessHaptic();
    hide(() => onAccept(String(request?.requestId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hide et l'haptique sont stables
  }, [request, onAccept]);

  const handleDecline = useCallback(() => {
    triggerDeclineHaptic();
    hide(() => onDecline());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hide et l'haptique sont stables
  }, [onDecline]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value * 0.45 }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const progressStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  if (!isVisible && !request) return null;

  const icon         = getServiceIcon(request?.service);
  const isUrgent     = countdown <= 8;
  const urgencyColor = isUrgent ? COLORS.red : theme.text;


  return (
    <View style={styles.wrapper}>

      {/* Backdrop bloquant : absorbe les taps pour que l'écran derrière ne soit pas
          cliquable pendant l'affichage de la sheet. Un tap sur le fond ne fait rien —
          le prestataire doit choisir explicitement Accepter ou Refuser. */}
      <Pressable style={StyleSheet.absoluteFill} onPress={() => {}}>
        <Animated.View
          style={[styles.backdrop, backdropStyle]}
          pointerEvents="none"
        />
      </Pressable>

      {/* Sheet */}
      <Animated.View style={[styles.sheet, { backgroundColor: theme.cardBg, paddingBottom: Math.max(insets.bottom, 16) + 12 }, sheetStyle]}>

        {/* Barre countdown */}
        <View style={[styles.progressTrack, { backgroundColor: theme.borderLight }]}>
          <Animated.View style={[styles.progressFill, { backgroundColor: urgencyColor }, progressStyle]} />
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconBadge, { backgroundColor: theme.surfaceAlt }]}>
            <Feather name={icon} size={22} color={theme.text} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.overline, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('mission_sheet.new_mission')}</Text>
            <Text style={[styles.serviceTitle, { color: theme.text, fontFamily: FONTS.sansMedium }]} numberOfLines={1}>
              {request?.service ?? t('common.service')}
            </Text>
          </View>
          <View style={[styles.countdownBubble, { borderColor: urgencyColor }]}>
            <Text style={[styles.countdownNum, { color: urgencyColor, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{countdown}</Text>
            <Text style={[styles.countdownSuffix, { color: urgencyColor, fontFamily: FONTS.sansMedium }]}>s</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

        {/* Détails mission */}
        <View style={styles.details}>
          {request?.address    && <DetailRow icon="map-pin"     value={request.address} textColor={theme.textSub} />}
          {request?.distance   && <DetailRow icon="navigation"  value={`${request.distance} ${t('mission_sheet.from_you')}`} textColor={theme.textSub} />}
          {request?.scheduledAt && <DetailRow icon="clock"       value={request.scheduledAt} textColor={theme.textSub} />}
          {request?.clientName && <DetailRow icon="user"         value={cleanName(request.clientName)} textColor={theme.textSub} />}
        </View>

        {/* Prix estimé */}
        {request?.estimatedPrice != null && (
          <View style={[styles.priceRow, { borderTopColor: theme.borderLight }]}>
            <Text style={[styles.priceLabel, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('mission_sheet.estimated_earning')}</Text>
            <Text style={[styles.priceValue, { color: theme.text, fontFamily: FONTS.bebas, includeFontPadding: false }]}>{request.estimatedPrice} €</Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.declineBtn, { backgroundColor: theme.surfaceAlt }]} onPress={handleDecline} activeOpacity={0.7} accessibilityLabel={t('mission_sheet.decline')} accessibilityRole="button">
            <Text style={[styles.declineTxt, { color: theme.textMuted, fontFamily: FONTS.sansMedium }]}>{t('mission_sheet.decline')}</Text>
          </TouchableOpacity>

          {/* Moment 6 : accepter est un geste — glisser, pas taper. */}
          <View style={styles.acceptWrap}>
            <SlideToConfirm label={t('mission_sheet.accept')} onConfirm={handleAccept} />
          </View>
        </View>

      </Animated.View>
    </View>
  );
}

// ─── Detail Row helper ────────────────────────────────────────────────────────
function DetailRow({ icon, value, textColor }: { icon: FeatherName; value: string; textColor: string }) {
  return (
    <View style={styles.detailRow}>
      <Feather name={icon} size={14} color={textColor} style={styles.detailIcon} />
      <Text style={[styles.detailValue, { color: textColor, fontFamily: FONTS.sans }]} numberOfLines={1}>{value}</Text>
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
    borderTopLeftRadius:  26,
    borderTopRightRadius: 26,
    // paddingBottom appliqué inline via useSafeAreaInsets (home bar).
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
  progressTrack: { height: 3 },
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
    alignItems:      'center',
    justifyContent:  'center',
  },
  headerText: { flex: 1 },
  overline: {
    fontSize:      10,
    letterSpacing: 1.4,
    marginBottom:  3,
  },
  serviceTitle: {
    fontSize:      21,
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
    lineHeight: 23,
  },
  countdownSuffix: {
    fontSize:     10,
    alignSelf:    'flex-end',
    marginBottom: 3,
  },

  // Divider
  divider: {
    height:           1,
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
  detailIcon: { width: 22, textAlign: 'center' },
  detailValue: {
    fontSize:   14,
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
    marginBottom:     20,
  },
  priceLabel: { fontSize: 14 },
  priceValue: {
    fontSize:      26,
    letterSpacing: -0.6,
  },

  // Actions
  actions: {
    flexDirection:     'row',
    paddingHorizontal: 22,
    gap: 12,
  },
  // Raised tactile : top highlight + bottom chamfer donnent l'illusion d'épaisseur
  // physique. Combiné à activeOpacity 0.7-0.85 + ombre déjà présente sur accept,
  // ça suffit à transformer le bouton plat en truc qu'on a "envie de presser".
  declineBtn: {
    width:           88,
    height:          56,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    borderTopWidth:    1,
    borderTopColor:    'rgba(255,255,255,0.08)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.25)',
  },
  declineTxt: { fontSize: 15 },
  acceptWrap: { flex: 1 },
  acceptBtn: {
    flex:            1,
    height:          56,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    borderTopWidth:    1.5,
    borderTopColor:    'rgba(255,255,255,0.45)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.18)',
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
    letterSpacing: 0.3,
  },
});
