// components/dashboard/ActivityItem.tsx — une ligne de l'activité récente de
// l'accueil client : service, date, référence, prix et badge de statut.
import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { translateRequestServiceRaw, translateCategoryRaw } from '@/lib/categoryLabel';
import { localeFor } from '@/lib/format';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import FixedCard from '@/components/ui/Card';
import FixedPrice from '@/components/ui/PriceDisplay';
import { PressScale } from '@/components/ui/PressScale';
import { getStatusInfo, getServiceIcon, activityBadgeTone } from '@/lib/dashboard/status';
import type { DashboardRequest } from '@/lib/dashboard/types';

/**
 * Le nom localisé : subcategory.nameI18n[lang] (via translateRequestService),
 * sinon traduit le slug de la catégorie. serviceType reste un fallback ultime mais
 * c'est une snapshot FR au moment de la création — à n'utiliser que si rien d'autre.
 */
export const requestServiceName = (request: DashboardRequest) =>
  translateRequestServiceRaw(request) ||
  translateCategoryRaw(request.category) ||
  request.title ||
  request.serviceType ||
  '';

export function ActivityItem({
  request,
  onPress,
  theme,
}: {
  request: DashboardRequest;
  onPress: () => void;
  isLast: boolean;
  theme: AppTheme;
}) {
  const { t, i18n } = useTranslation();
  const locale = localeFor(i18n.language);
  const status = getStatusInfo(request.status, t);
  const serviceName = requestServiceName(request);
  const icon = getServiceIcon(serviceName);
  const date = new Date(request.createdAt).toLocaleDateString(locale, { day: 'numeric', month: 'short' });

  const tone = activityBadgeTone(request.status);
  const badgeBg = tone === 'cancelled' ? theme.badgeCancelledBg : tone === 'pending' ? theme.badgePendingBg : theme.badgeDoneBg;
  const badgeTextColor = tone === 'cancelled' ? theme.badgeCancelledText : tone === 'pending' ? theme.badgePendingText : theme.badgeDoneText;

  return (
    <PressScale accessibilityRole="button" onPress={onPress} style={{ marginBottom: 8 }}>
      <FixedCard pad={14}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
            <Feather name={icon} size={18} color={theme.textSub} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 13.5, color: theme.text }} numberOfLines={1}>
              {serviceName || t('common.service')}
            </Text>
            <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.6, marginTop: 2 }}>
              {date.toUpperCase()} · FIXED #{String(request.id).slice(-4)}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {request.price ? (
              <FixedPrice amount={request.price} size={22} color={theme.text} />
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: badgeBg, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: badgeTextColor }} />
              <Text style={{ fontFamily: FONTS.mono, fontSize: 10, color: badgeTextColor, letterSpacing: 0.5 }}>{status.label}</Text>
            </View>
          </View>
        </View>
      </FixedCard>
    </PressScale>
  );
}
