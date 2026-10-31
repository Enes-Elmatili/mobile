// components/dashboard/UpcomingIslandCard.tsx — demande planifiée future.
// Même layout que MissionIsland.active, mais outlined (pas filled) pour marquer
// que la demande n'est pas encore active — juste planifiée pour plus tard.
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { localeFor } from '@/lib/format';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { cleanName } from '@/lib/displayName';
import { PressScale } from '@/components/ui/PressScale';
import { countdownOf, isTomorrow } from '@/lib/dashboard/time';
import { upcomingKindOf } from '@/lib/dashboard/status';
import type { DashboardRequest } from '@/lib/dashboard/types';
import { requestServiceName } from './ActivityItem';

// Live countdown: "2J 14H", "3H 45M", "45M", "< 1M"
function useCountdown(targetDate: Date | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetDate) return;
    const iv = setInterval(() => setNow(Date.now()), 60_000); // tick every minute
    return () => clearInterval(iv);
  }, [targetDate]);

  return countdownOf(targetDate, now);
}

export function UpcomingIslandCard({
  request,
  onPress,
  theme,
}: {
  request: DashboardRequest;
  onPress: () => void;
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const serviceName = requestServiceName(request);
  const { isQuote, isAccepted, isPendingPayment } = upcomingKindOf(request);

  const scheduledDate = request.preferredTimeStart ? new Date(request.preferredTimeStart) : null;
  const { label: countdownLabel, fraction } = useCountdown(scheduledDate);

  // Date label: "Demain · 09:00" or "Mer 8 avr · 10:00"
  const dayLabel = scheduledDate
    ? (isTomorrow(scheduledDate)
        ? t('dashboard.tomorrow')
        : scheduledDate.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' }))
    : '';
  const timeLabel = scheduledDate
    ? scheduledDate.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : '';

  // Progress bar color: green if accepted, warm accent if waiting
  const barColor = isAccepted ? COLORS.greenBrand : (theme.isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)');
  const barTrack = theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  return (
    <PressScale accessibilityRole="button"
      style={[uc.card, {
        backgroundColor: theme.cardBg,
        borderColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      }]}
      onPress={onPress}
    >
      {/* Top row: service name + countdown */}
      <View style={uc.topRow}>
        <View style={uc.topLeft}>
          {/* Badge paiement en attente/devis/planifiée */}
          <View style={[uc.typeBadge, (isPendingPayment || isQuote)
            ? { backgroundColor: 'rgba(232,168,56,0.10)' }
            : { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }
          ]}>
            <Text style={[uc.typeLabel, { color: (isPendingPayment || isQuote) ? COLORS.amber : theme.textMuted }]}>
              {isPendingPayment ? t('dashboard.badge_payment_pending') : isQuote ? t('dashboard.badge_quote') : t('dashboard.badge_scheduled')}
            </Text>
          </View>
          <Text style={[uc.serviceName, { color: theme.text }]} numberOfLines={1}>
            {serviceName}
          </Text>
        </View>
        {/* Countdown block */}
        <View style={uc.countdownWrap}>
          <Text style={[uc.countdownValue, { color: theme.text }]}>{countdownLabel}</Text>
        </View>
      </View>

      {/* Progress bar (diminishes as time approaches) */}
      <View style={[uc.progressTrack, { backgroundColor: barTrack }]}>
        <View style={[uc.progressFill, { backgroundColor: barColor, width: `${Math.max(2, fraction * 100)}%` }]} />
      </View>

      {/* Bottom row: date + status */}
      <View style={uc.bottomRow}>
        <View style={uc.dateRow}>
          <Feather name="calendar" size={13} color={theme.textMuted} />
          <Text style={[uc.dateText, { color: theme.textSub }]}>
            {dayLabel}{timeLabel ? ` · ${timeLabel}` : ''}
          </Text>
        </View>
        {isPendingPayment ? (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: COLORS.amber }]} />
            <Text style={[uc.statusText, { color: COLORS.amber }]}>{t('dashboard.resume_payment')}</Text>
          </View>
        ) : isAccepted ? (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: COLORS.greenBrand }]} />
            <Text style={[uc.statusText, { color: theme.greenText }]} numberOfLines={1}>
              {request.provider?.name ? cleanName(request.provider.name) : t('dashboard.confirmed')}
            </Text>
          </View>
        ) : (
          <View style={uc.statusBadge}>
            <View style={[uc.statusDot, { backgroundColor: theme.textMuted as string }]} />
            <Text style={[uc.statusText, { color: theme.textMuted }]}>{t('dashboard.status_pending')}</Text>
          </View>
        )}
      </View>
    </PressScale>
  );
}

const uc = StyleSheet.create({
  card: {
    borderRadius: 18, borderWidth: 1,
    padding: 16, gap: 14,
  },

  // Top
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  topLeft: { flex: 1, gap: 6 },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  typeLabel: { fontFamily: FONTS.sansMedium, fontSize: 10, letterSpacing: 1.5 },
  serviceName: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 22, letterSpacing: 0.3, lineHeight: 25 },

  // Countdown
  countdownWrap: { alignItems: 'flex-end', justifyContent: 'center', paddingTop: 2 },
  countdownValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 28, letterSpacing: 1, lineHeight: 30 },

  // Progress bar
  progressTrack: { height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: 1.5 },

  // Bottom
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontFamily: FONTS.sans, fontSize: 13 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, marginRight: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: FONTS.sansMedium, fontSize: 12, flexShrink: 1 },
});
