// components/dashboard/DashboardTopBar.tsx — le haut de l'accueil client :
// bannière d'erreur réseau, ville + salut, notifications et messages.
import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import FixedIconBtn from '@/components/ui/IconBtn';
import { PressScale } from '@/components/ui/PressScale';
import { getGreeting } from '@/lib/dashboard/time';

const hapticLight = () => feedback.haptic('light');

// ── Bannière d'erreur réseau + retry ──
export function LoadErrorBanner({ onRetry, theme }: { onRetry: () => void; theme: AppTheme }) {
  const { t } = useTranslation();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginTop: 8, marginBottom: 4,
      borderRadius: 12, padding: 12, backgroundColor: theme.surface,
    }}>
      <Feather name="alert-circle" size={15} color={theme.text} />
      <Text style={{ flex: 1, fontSize: 13, fontFamily: FONTS.sans, color: theme.text }}>
        Impossible de charger vos données.
      </Text>
      <PressScale accessibilityRole="button" onPress={() => { hapticLight(); onRetry(); }}>
        <Text style={{ fontSize: 13, fontFamily: FONTS.sansMedium, color: theme.text }}>{t('common.retry')}</Text>
      </PressScale>
    </View>
  );
}

// ── TOP BAR — always visible, compact ──
// `compact` : une mission occupe l'îlot, le salut se fait plus petit.
export function DashboardTopBar({
  city,
  name,
  compact,
  unreadCount,
  unreadMessages,
  theme,
}: {
  city?: string;
  name: string;
  compact: boolean;
  unreadCount: number;
  unreadMessages: number;
  theme: AppTheme;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: compact ? 12 : 16 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.textMuted, letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>
            {city?.toUpperCase() || t('profile.default_city').toUpperCase()}
          </Text>
          <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: compact ? 22 : 28, color: theme.text, letterSpacing: 0.4 }}>
            {`${getGreeting(t)}, ${name.split(' ')[0]}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <FixedIconBtn icon="bell" accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications'} badge={unreadCount > 0} onPress={() => { hapticLight(); router.push('/notifications'); }} />
          <FixedIconBtn icon="message-square" accessibilityLabel={unreadMessages > 0 ? `Messages, ${unreadMessages} non lus` : 'Messages'} badge={unreadMessages > 0} onPress={() => { hapticLight(); router.push('/messages'); }} />
        </View>
      </View>
    </View>
  );
}
