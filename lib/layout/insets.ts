// lib/layout/insets.ts
// Sur l'écran interne de l'iPhone Duo, la Dynamic Island est LATÉRALE et la
// barre système aussi : les insets gauche et droit diffèrent. Apple :
// « avoid assuming that insets on opposite sides are equal ». On les expose
// donc séparément, jamais en `paddingHorizontal: insets.left`.
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface AsymmetricInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function useAsymmetricInsets(): AsymmetricInsets {
  const i = useSafeAreaInsets();
  return { top: i.top, bottom: i.bottom, left: i.left, right: i.right };
}

/** Padding horizontal d'un contenu : base + inset de CHAQUE côté, séparément. */
export function horizontalPadding(insets: AsymmetricInsets, base: number): { paddingLeft: number; paddingRight: number } {
  return { paddingLeft: base + insets.left, paddingRight: base + insets.right };
}
