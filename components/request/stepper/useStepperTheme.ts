// components/request/stepper/useStepperTheme.ts
// Pont de thème du stepper de commande : alias locaux des jetons de
// useAppTheme(), partagés par l'écran et ses sous-composants.
import { useAppTheme } from '@/hooks/use-app-theme';

export function useStepperTheme() {
  const t = useAppTheme();
  return {
    isDark:          t.isDark,
    bg:              t.bg,
    surface:         t.surface,
    surfaceAlt:      t.surfaceAlt,
    surfaceBorder:   t.border,
    card:            t.cardBg,
    cardBorder:      t.border,
    sep:             t.borderLight,
    text:            t.text,
    greenText:       t.greenText,
    textSub:         t.textSub,
    textMuted:       t.textMuted,
    textPlaceholder: t.textMuted,
    iconBtnBg:       t.surface,
    progressTrack:   t.isDark ? t.border : t.surface,
    ctaBg:           t.bg,
    ctaBorder:       t.borderLight,
    modeCardBg:      t.surface,
    nowConfirmBg:    t.surface,
    noteInputBg:     t.surface,
    noteInputBorder: t.border,
    searchBoxBg:     t.isDark ? 'rgba(20,20,20,0.92)' : 'rgba(255,255,255,0.92)',
    addrConfirmBg:   t.cardBg,
    addrClearBg:     t.isDark ? t.border : t.surface,
    dropdownBg:      t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownRow:     t.isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.95)',
    dropdownSep:     t.borderLight,
    chipBg:          t.surface,
    v4CardBg:        t.isDark ? t.surface : t.cardBg,
    v4Sep:           t.border,
    gradientBg:      t.isDark ? 'rgba(10,10,10,0.9)' : 'rgba(255,255,255,0.9)',
    // Expose full theme for direct access
    accent:          t.accent,
    accentText:      t.accentText,
    statusBar:       t.statusBar,
    shadowOpacity:   t.shadowOpacity,
    // Premium dark surface (carte noire Direction B — reste sombre dans les 2 thèmes)
    heroBg:          t.heroBg,
    heroText:        t.heroText,
    heroSub:         t.heroSub,
    heroSubFaint:    t.heroSubFaint,
  };
}

export type StepperTheme = ReturnType<typeof useStepperTheme>;
