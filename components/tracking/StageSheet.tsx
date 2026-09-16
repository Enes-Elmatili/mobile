// components/tracking/StageSheet.tsx — la feuille du suivi, qu'on tient au doigt.
// Feuille gorhom à paliers (aperçu / moitié / plein), configurée sur le moteur
// de mouvement (ressort critique, élastique, haptique au palier, velocity
// handoff fournis par gorhom). Le stade impose un palier cible ; l'utilisateur
// reste libre de tirer. Le pied (CTA) reste collé en bas quel que soit le palier.
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetFooter, BottomSheetScrollView, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useLayoutClass } from '@/lib/layout';

export type SheetLevel = 'peek' | 'half' | 'full' | 'page';
export const SHEET_RATIOS: Record<Exclude<SheetLevel, 'page'>, number> = { peek: 0.24, half: 0.54, full: 0.9 };

type Props = {
  /** Paliers proposés, dans l'ordre croissant. `page` = toute la hauteur, sans poignée. */
  levels: SheetLevel[];
  /** Palier imposé par le stade ; l'utilisateur peut ensuite tirer. */
  level: SheetLevel;
  /** Hauteur visible de la feuille (px) à chaque palier atteint : la carte se rembourre avec. */
  onHeightChange?: (px: number) => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** La feuille pousse le contenu au-dessus du clavier (saisie du code). */
  keyboard?: boolean;
};

export function StageSheet({ levels, level, onHeightChange, footer, children, keyboard = false }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useLayoutClass();
  const motion = useSheetMotion();
  const ref = useRef<BottomSheet>(null);

  const snapPoints = useMemo(() => levels.map((l) => (l === 'page' ? windowHeight : Math.round(windowHeight * SHEET_RATIOS[l]))), [levels, windowHeight]);
  const targetIndex = Math.max(0, levels.indexOf(level));

  useEffect(() => { ref.current?.snapToIndex(targetIndex); }, [targetIndex, snapPoints]);

  const onChange = useCallback((index: number) => {
    if (index >= 0) onHeightChange?.(snapPoints[index] ?? 0);
  }, [onHeightChange, snapPoints]);
  useEffect(() => { onHeightChange?.(snapPoints[targetIndex] ?? 0); }, [snapPoints, targetIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const isPage = level === 'page';
  const renderFooter = useCallback((props: BottomSheetFooterProps) => (
    footer ? <BottomSheetFooter {...props} bottomInset={insets.bottom}><View style={[s.footer, { backgroundColor: theme.cardBg, borderTopColor: theme.borderLight }]}>{footer}</View></BottomSheetFooter> : null
  ), [footer, insets.bottom, theme.cardBg, theme.borderLight]);

  return (
    <BottomSheet
      ref={ref}
      index={targetIndex}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableOverDrag
      overDragResistanceFactor={motion.overDragResistanceFactor}
      animationConfigs={motion.animationConfigs}
      onAnimate={motion.onAnimate}
      onChange={onChange}
      handleComponent={isPage ? null : undefined}
      handleIndicatorStyle={{ backgroundColor: theme.textDisabled, width: 36, height: 4 }}
      backgroundStyle={{ backgroundColor: theme.cardBg, borderTopLeftRadius: isPage ? 0 : 28, borderTopRightRadius: isPage ? 0 : 28 }}
      topInset={isPage ? 0 : insets.top + 8}
      keyboardBehavior={keyboard ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      footerComponent={footer ? renderFooter : undefined}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingTop: isPage ? insets.top + 12 : 4, paddingBottom: (footer ? 132 : 24) + insets.bottom }]}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1 },
});
