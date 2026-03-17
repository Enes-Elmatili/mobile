// components/providers/ProviderMissionCard.tsx
// Reusable incoming mission card — FIXED design system

import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, FONTS, COLORS } from '@/hooks/use-app-theme';

const NET_RATE = 0.85;
const TIMER_DURATION = 15;

// Category slug → Ionicon name
const CATEGORY_ICONS: Record<string, string> = {
  serrurerie:             'lock-closed-outline',
  plomberie:              'water-outline',
  'entretien-chaudiere':  'flame-outline',
  electricite:            'flash-outline',
  bricolage:              'hammer-outline',
  peinture:               'brush-outline',
  menage:                 'home-outline',
  'depannage-informatique': 'laptop-outline',
  vitrier:                'grid-outline',
  'pet-sitting':          'paw-outline',
};

function getCategoryIcon(name?: string): string {
  if (!name) return 'construct-outline';
  const key = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
  const match = Object.keys(CATEGORY_ICONS).find(k => key.includes(k));
  return match ? CATEGORY_ICONS[match] : 'construct-outline';
}

export interface MissionData {
  id: string;
  title: string;
  serviceType?: string;
  description?: string;
  price: number;
  address: string;
  urgent?: boolean;
  distance?: number;
  client?: { name: string };
  category?: { name: string; icon?: string; slug?: string };
  subcategory?: {
    name: string;
    pricingMode?: string;
    durationMinutes?: number;
    basePrice?: number;
  };
}

interface ProviderMissionCardProps {
  mission: MissionData;
  onAccept: () => void;
  onDecline: () => void;
}

export function ProviderMissionCard({ mission, onAccept, onDecline }: ProviderMissionCardProps) {
  const theme = useAppTheme();
  const slideUp   = useRef(new Animated.Value(400)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);

  useEffect(() => {
    Animated.spring(slideUp, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); onDecline(); return 0; }
        return prev - 1;
      });
    }, 1000);
    Animated.timing(timerAnim, { toValue: 0, duration: TIMER_DURATION * 1000, useNativeDriver: false }).start();
    return () => clearInterval(interval);
  }, []);

  const netPrice = Math.round(mission.price * NET_RATE);
  const categoryName = mission.category?.name || mission.serviceType || 'Service';
  const categoryIcon = mission.category?.icon || getCategoryIcon(categoryName);
  const pricingMode = mission.subcategory?.pricingMode;
  const duration = mission.subcategory?.durationMinutes;

  const timerBarColor = timerAnim.interpolate({
    inputRange: [0, 0.33, 1],
    outputRange: [COLORS.red, theme.textMuted, theme.text],
  });
  const countdownColor = timeLeft <= 5 ? COLORS.red : timeLeft <= 10 ? COLORS.amber : theme.text;

  return (
    <Animated.View style={[s.wrap, { backgroundColor: theme.cardBg, shadowOpacity: theme.shadowOpacity > 0.1 ? theme.shadowOpacity : 0.18 }, { transform: [{ translateY: slideUp }] }]}>

      {/* Timer bar */}
      <View style={[s.timerTrack, { backgroundColor: theme.border }]}>
        <Animated.View style={[s.timerFill, {
          width: timerAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          backgroundColor: timerBarColor,
        }]} />
      </View>

      <View style={s.content}>

        {/* Top: category badge + countdown */}
        <View style={s.topRow}>
          <View style={s.titleWrap}>
            <View style={[s.catBadge, { backgroundColor: theme.surface }]}>
              <Ionicons name={categoryIcon as any} size={14} color={theme.text} />
              <Text style={[s.catText, { color: theme.text }]}>{categoryName}</Text>
            </View>
            <Text style={[s.title, { color: theme.textAlt }]} numberOfLines={2}>
              {mission.subcategory?.name || mission.title}
            </Text>
            <View style={s.pillRow}>
              {mission.urgent && (
                <View style={[s.pill, { backgroundColor: COLORS.red }]}>
                  <Ionicons name="flash" size={10} color="#FFF" />
                  <Text style={s.pillTextWhite}>Urgent</Text>
                </View>
              )}
              {pricingMode && (
                <View style={[s.pill, { backgroundColor: pricingMode === 'diagnostic' ? theme.surface : theme.surface }]}>
                  <Ionicons name={pricingMode === 'diagnostic' ? 'search-outline' : 'pricetag-outline'} size={10} color={theme.textSub} />
                  <Text style={[s.pillText, { color: theme.textSub }]}>
                    {pricingMode === 'diagnostic' ? 'Diagnostic' : 'Forfait'}
                  </Text>
                </View>
              )}
              {duration != null && (
                <View style={[s.pill, { backgroundColor: theme.surface }]}>
                  <Ionicons name="time-outline" size={10} color={theme.textSub} />
                  <Text style={[s.pillText, { color: theme.textSub }]}>
                    {duration >= 60 ? `${Math.floor(duration / 60)}h${duration % 60 ? String(duration % 60).padStart(2, '0') : ''}` : `${duration}min`}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={s.countdownWrap}>
            <Text style={[s.countdown, { color: countdownColor }]}>{timeLeft}</Text>
            <Text style={[s.countdownUnit, { color: theme.textMuted }]}>s</Text>
          </View>
        </View>

        {/* Price */}
        <View style={s.priceRow}>
          <Text style={[s.priceNet, { color: theme.textAlt }]}>{netPrice} €</Text>
          <Text style={[s.priceCaption, { color: theme.textMuted }]}>net (brut {mission.price} €)</Text>
        </View>

        {/* Metas */}
        <View style={s.metas}>
          <View style={s.meta}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[s.metaText, { color: theme.textSub }]} numberOfLines={1}>{mission.address}</Text>
          </View>
          {mission.distance != null && (
            <View style={s.meta}>
              <Ionicons name="navigate-outline" size={14} color={theme.textMuted} />
              <Text style={[s.metaText, { color: theme.textSub }]}>~{Math.round(mission.distance * 3)} min · {mission.distance.toFixed(1)} km</Text>
            </View>
          )}
          {mission.client?.name && (
            <View style={s.meta}>
              <Ionicons name="person-outline" size={14} color={theme.textMuted} />
              <Text style={[s.metaText, { color: theme.textSub }]}>{mission.client.name}</Text>
            </View>
          )}
        </View>

        {/* Accept CTA */}
        <TouchableOpacity style={[s.acceptBtn, { backgroundColor: theme.accent }]} onPress={onAccept} activeOpacity={0.88}>
          <Text style={[s.acceptText, { color: theme.accentText }]}>Accepter</Text>
          <Ionicons name="arrow-forward" size={18} color={theme.accentText} />
        </TouchableOpacity>

        {/* Decline */}
        <TouchableOpacity style={s.declineBtn} onPress={onDecline} activeOpacity={0.7}>
          <Text style={[s.declineText, { color: theme.textMuted }]}>Refuser</Text>
        </TouchableOpacity>

      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 83 : 60,
    left: 0, right: 0,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000', shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  timerTrack: { height: 4, overflow: 'hidden' },
  timerFill:  { height: '100%' },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  titleWrap: { flex: 1, gap: 6 },
  catBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    alignSelf: 'flex-start',
  },
  catText: { fontSize: 12, fontFamily: FONTS.sansMedium },
  title: { fontSize: 20, fontFamily: FONTS.sansMedium, letterSpacing: -0.3, lineHeight: 26 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  pillText:      { fontSize: 10, fontFamily: FONTS.sansMedium },
  pillTextWhite: { fontSize: 10, fontFamily: FONTS.sansMedium, color: '#FFF', letterSpacing: 0.5 },
  countdownWrap:  { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  countdown:      { fontSize: 40, fontFamily: FONTS.bebas, letterSpacing: -2, lineHeight: 44 },
  countdownUnit:  { fontSize: 14, fontFamily: FONTS.sansMedium, marginBottom: 2 },

  priceRow:    { marginBottom: 16 },
  priceNet:    { fontSize: 52, fontFamily: FONTS.bebas, letterSpacing: -3, lineHeight: 56 },
  priceCaption:{ fontSize: 12, fontFamily: FONTS.mono, marginTop: 2 },

  metas:   { gap: 10, marginBottom: 24 },
  meta:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText:{ fontSize: 14, fontFamily: FONTS.sans, flex: 1 },

  acceptBtn: {
    height: 55,
    borderRadius: 55, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 10,
    marginBottom: 12,
  },
  acceptText: { fontSize: 16, fontFamily: FONTS.sansMedium, letterSpacing: 0.3 },

  declineBtn:  { alignItems: 'center', paddingVertical: 8 },
  declineText: { fontSize: 14, fontFamily: FONTS.sansMedium },
});
