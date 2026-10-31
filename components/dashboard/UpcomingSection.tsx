// components/dashboard/UpcomingSection.tsx — « À VENIR » : les demandes
// planifiées futures, chacune en carte outlined. Rien quand la liste est vide.
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import type { AppTheme } from '@/hooks/use-app-theme';
import FixedSectionHeader from '@/components/ui/SectionHeader';
import { upcomingHref } from '@/lib/dashboard/navigation';
import type { DashboardRequest } from '@/lib/dashboard/types';
import { UpcomingIslandCard } from './UpcomingIslandCard';

const hapticLight = () => feedback.haptic('light');

export function UpcomingSection({ requests, theme }: { requests: DashboardRequest[]; theme: AppTheme }) {
  const { t } = useTranslation();
  const router = useRouter();
  if (requests.length === 0) return null;
  return (
    <>
      <View style={{ marginTop: 22 }}>
        <FixedSectionHeader label={t('dashboard.upcoming')} action={String(requests.length)} />
      </View>
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        {requests.map((req) => (
          <UpcomingIslandCard
            key={req.id}
            request={req}
            theme={theme}
            onPress={() => {
              hapticLight();
              router.push(upcomingHref(req));
            }}
          />
        ))}
      </View>
    </>
  );
}
