// components/tracking/StageSheet.tsx — la feuille du suivi, qu'on tient au doigt.
// Feuille gorhom sur le moteur de mouvement (ressort critique, élastique,
// haptique au palier, velocity handoff fournis par gorhom). Sa hauteur est
// celle de son contenu (enableDynamicSizing), plafonnée à l'écran moins la
// barre de statut : rien n'est coupé, et tirer vers le haut ne « remonte »
// la feuille que si le contenu dépasse. Un palier « aperçu » optionnel laisse
// voir la carte ; « page » prend tout l'écran. Le pied (CTA) reste collé en
// bas et le contenu défile au-dessus, jamais dessous.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import BottomSheet, { BottomSheetFooter, BottomSheetScrollView, type BottomSheetFooterProps } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useSheetMotion } from '@/lib/motion/sheet';
import { useLayoutClass } from '@/lib/layout';

export type SheetLevel = 'peek' | 'half' | 'full' | 'page';
export const SHEET_RATIOS: Record<Exclude<SheetLevel, 'page'>, number> = { peek: 0.24, half: 0.54, full: 0.9 };

type Props = {
  /** `peek` ajoute un palier bas (la carte respire) ; `page` = tout l'écran. Les autres = hauteur du contenu. */
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
  const [footerH, setFooterH] = useState(0);

  const isPage = level === 'page' || levels.includes('page');
  const hasPeek = !isPage && levels.includes('peek');
  // Plafond : l'écran moins la barre de statut et la rangée des boutons
  // flottants (retour · FIXED #id · menu), qui restent visibles au-dessus.
  const maxContent = windowHeight - insets.top - 64;
  // Paliers fixes : la page entière, ou l'aperçu ; la hauteur du contenu est
  // ajoutée par gorhom (enableDynamicSizing) en dernier. L'aperçu ne descend
  // jamais sous la poignée + le pied : les CTA restent entiers, jamais coupés.
  const peekMin = 28 + footerH + 8;
  const snapPoints = useMemo(() => (isPage ? [windowHeight] : hasPeek ? [Math.max(Math.round(windowHeight * SHEET_RATIOS.peek), peekMin)] : undefined), [isPage, hasPeek, windowHeight, peekMin]);
  const targetIndex = isPage ? 0 : level === 'peek' && hasPeek ? 0 : hasPeek ? 1 : 0;

  useEffect(() => { ref.current?.snapToIndex(targetIndex); }, [targetIndex, level]);

  const onChange = useCallback((_index: number, position: number) => {
    // `position` = distance du bord haut de la feuille au haut de l'écran.
    onHeightChange?.(Math.max(0, Math.round(windowHeight - position)));
  }, [onHeightChange, windowHeight]);

  // Le pied descend jusqu'au bord de l'écran (l'inset bas est DANS le pied) :
  // rien du contenu ne transparaît sous les CTA dans la zone de l'indicateur.
  const renderFooter = useCallback((props: BottomSheetFooterProps) => (
    footer ? (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height)} style={[s.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: theme.cardBg, borderTopColor: theme.borderLight }]}>{footer}</View>
      </BottomSheetFooter>
    ) : null
  ), [footer, insets.bottom, theme.cardBg, theme.borderLight]);

  return (
    <BottomSheet
      ref={ref}
      index={targetIndex}
      snapPoints={snapPoints}
      enableDynamicSizing={!isPage}
      maxDynamicContentSize={maxContent}
      enablePanDownToClose={false}
      enableOverDrag
      overDragResistanceFactor={motion.overDragResistanceFactor}
      animationConfigs={motion.animationConfigs}
      onAnimate={motion.onAnimate}
      onChange={onChange}
      handleComponent={isPage ? null : undefined}
      handleIndicatorStyle={{ backgroundColor: theme.textDisabled, width: 36, height: 4 }}
      backgroundStyle={{ backgroundColor: theme.cardBg, borderTopLeftRadius: isPage ? 0 : 28, borderTopRightRadius: isPage ? 0 : 28 }}
      topInset={isPage ? 0 : insets.top + 64}
      keyboardBehavior={keyboard ? 'extend' : 'interactive'}
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      footerComponent={footer ? renderFooter : undefined}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.content, { paddingTop: isPage ? insets.top + 12 : 4, paddingBottom: (footer ? footerH + 8 : 20 + insets.bottom) }]}
      >
        {children}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20 },
  footer: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1 },
});
