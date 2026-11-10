// components/ui/SheetBackdrop.tsx — le voile de TOUS les bottom sheets.
// BottomSheetBackdrop de gorhom, étendu à la fenêtre entière : sur le Duo
// déplié, le voile d'un sheet posé dans l'écran couvre aussi le rail système
// (lib/layout/sheetFrame → useBackdropBleed). Identique sur iPhone.
import React, { useEffect } from 'react';
import { BottomSheetBackdrop, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { debugSnapshot, useBackdropBleed } from '@/lib/layout';

type Props = BottomSheetBackdropProps & React.ComponentProps<typeof BottomSheetBackdrop>;

export function SheetBackdrop({ style, ...rest }: Props) {
  const bleed = useBackdropBleed();
  // Diagnostic Duo (drapeau FixedHingeLog, sinon rien) : image du sheet ouvert.
  useEffect(() => { debugSnapshot('sheet'); }, []);
  return <BottomSheetBackdrop {...rest} style={[style, bleed]} />;
}
