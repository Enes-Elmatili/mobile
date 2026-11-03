// components/dashboard/RecentActivity.tsx — « ACTIVITÉ RÉCENTE » : l'en-tête
// (compteur, tap = rafraîchir), les lignes ou l'état vide, et « Voir plus ».
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import FixedSectionHeader from '@/components/ui/SectionHeader';
import { PressScale } from '@/components/ui/PressScale';
import type { DashboardRequest } from '@/lib/dashboard/types';
import { ActivityItem } from './ActivityItem';

const hapticLight = () => feedback.haptic('light');

export function RecentActivity({
  isEmpty,
  displayed,
  totalCount,
  hasMore,
  showAll,
  onToggleShowAll,
  onRefresh,
  onRequestPress,
  theme,
}: {
  /** Aucune demande du tout (pas seulement aucune ligne affichée). */
  isEmpty: boolean;
  displayed: DashboardRequest[];
  totalCount: number;
  hasMore: boolean;
  showAll: boolean;
  onToggleShowAll: () => void;
  onRefresh: () => void;
  onRequestPress: (requestId: string) => void;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  return (
    <>
      <View style={{ marginTop: 26 }}>
        <FixedSectionHeader label={t('dashboard.recent_activity').toUpperCase()} action={totalCount ? String(totalCount) : undefined} onAction={() => { hapticLight(); onRefresh(); }} />
      </View>

      <View style={s.activityList}>
        {isEmpty ? (
          <View style={s.emptyActivity}>
            <View style={[s.emptyActivityIcon, { backgroundColor: theme.surface }]}>
              <Feather name="file-text" size={22} color={theme.textDisabled} />
            </View>
            <Text style={[s.emptyTitle, { color: theme.text }]}>{t('dashboard.no_missions')}</Text>
            <Text style={[s.emptySub, { color: theme.textMuted }]}>{t('dashboard.missions_appear_here')}</Text>
          </View>
        ) : (
          <>
            {displayed.map((req, i) => (
              <ActivityItem
                key={req.id}
                request={req}
                onPress={() => { hapticLight(); onRequestPress(req.id); }}
                isLast={i === displayed.length - 1 && (!hasMore || showAll)}
                theme={theme}
              />
            ))}
          </>
        )}
      </View>

      {/* See all button */}
      {hasMore && (
        <PressScale accessibilityRole="button"
          style={s.seeAllBtn}
          onPress={() => { hapticLight(); onToggleShowAll(); }}
        >
          <Text style={[s.seeAllText, { color: theme.textMuted }]}>
            {showAll ? t('dashboard.collapse') : t('dashboard.see_more')}
          </Text>
          <Feather name={showAll ? 'chevron-up' : 'chevron-down'} size={11} color={theme.textMuted} />
        </PressScale>
      )}
    </>
  );
}

const s = StyleSheet.create({
  // ── Activity list ──
  activityList: { paddingHorizontal: 16 },

  emptyActivity: { padding: 44, alignItems: 'center', gap: 10 },
  emptyActivityIcon: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontFamily: FONTS.sansMedium, fontSize: 15 },
  emptySub: { fontFamily: FONTS.sans, fontSize: 13, textAlign: 'center' },

  // ── See all button ──
  seeAllBtn: {
    marginHorizontal: 16, marginTop: 4,
    paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  seeAllText: { fontFamily: FONTS.mono, fontSize: 10, letterSpacing: 0.2 },
});
