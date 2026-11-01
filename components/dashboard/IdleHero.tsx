// components/dashboard/IdleHero.tsx — l'îlot noir au repos : « Besoin d'un
// pro ? » et le grand bouton de commande.
import React from 'react';
import { View, Text } from 'react-native';
import Reanimated from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { feedback } from '@/lib/feedback/feedback';
import type { usePressScale } from '@/lib/motion/press';
import { FONTS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';

const hapticMedium = () => feedback.haptic('medium');

// `ctaPress` reste créé par l'écran (usePressScale) : l'îlot bascule entre
// repos et mission sans recréer l'échelle du bouton.
export function IdleHero({ ctaPress, theme }: { ctaPress: ReturnType<typeof usePressScale>; theme: AppTheme }) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View style={{ padding: 22 }}>
      <Text style={{ fontFamily: FONTS.mono, fontSize: 10.5, color: theme.heroSubFaint, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        {t('dashboard.available_24_7')}
      </Text>
      <Text style={{ fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 30, color: theme.heroText, letterSpacing: 0.4, marginBottom: 20, lineHeight: 32 }}>
        {t('dashboard.hero_title')}
      </Text>
      <PressScale
        testID="dashboard-order"
        {...ctaPress.handlers}
        onPress={() => { hapticMedium(); router.push('/request/NewRequestStepper'); }}
      >
        {/* CTA pill blanche pleine — signature du kit fixed-design (hero island) */}
        <Reanimated.View style={[{
          flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8,
          borderRadius: 100, paddingVertical: 11, paddingHorizontal: 18,
          backgroundColor: '#F4F4F2',
        }, ctaPress.style]}>
          <Feather name="plus" size={17} color="#0A0A0A" />
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: '#0A0A0A' }}>
            {t('dashboard.new_request')}
          </Text>
        </Reanimated.View>
      </PressScale>
    </View>
  );
}
