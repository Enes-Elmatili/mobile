// components/request/stepper/RecapTile.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS } from '@/hooks/use-app-theme';
import { PressScale } from '@/components/ui/PressScale';
import type { StepperTheme } from './useStepperTheme';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

/** Ligne récap en tuile-icône (Direction B). Touchable seulement avec `onPress`. */
export function RecapTile({
  theme, icon, title, sub, right, onPress,
}: {
  theme: StepperTheme; icon: FeatherName; title: string; sub?: string;
  right?: React.ReactNode; onPress?: () => void;
}) {
  const rowStyle = { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 13, paddingHorizontal: 16 } as const;
  const content = (
    <>
      <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' }}>
        <Feather name={icon} size={17} color={theme.text as string} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontFamily: FONTS.sansMedium, color: theme.text as string }} numberOfLines={1}>{title}</Text>
        {sub ? <Text style={{ fontSize: 12.5, fontFamily: FONTS.sans, color: theme.textSub as string, marginTop: 1 }} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {right != null ? right : null}
    </>
  );
  return onPress
    ? <PressScale onPress={onPress} style={rowStyle}>{content}</PressScale>
    : <View style={rowStyle}>{content}</View>;
}
