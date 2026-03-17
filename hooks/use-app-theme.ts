/**
 * Shared app-wide theme hook — dark/light adaptive palette.
 * Design tokens aligned with the FIXED design system (Bebas Neue / DM Sans / DM Mono).
 * Usage: `const t = useAppTheme();` then `[s.root, { backgroundColor: t.bg }]`
 */
import { useColorScheme } from 'react-native';

// ── Font families (loaded in _layout.tsx) ──────────────────────────────────
export const FONTS = {
  bebas:      'BebasNeue_400Regular',
  sans:       'DMSans_400Regular',
  sansLight:  'DMSans_300Light',
  sansMedium: 'DMSans_500Medium',
  mono:       'DMMono_400Regular',
  monoMedium: 'DMMono_500Medium',
} as const;

// ── Shared semantic colors (mode-independent) ──────────────────────────────
export const COLORS = {
  green:  '#4ADE80',
  amber:  '#F59E0B',
  red:    '#EF4444',
  danger: '#DC2626',
  stripe: '#635BFF',
  verified: '#1D9BF0',
} as const;

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    fonts: FONTS,
    colors: COLORS,
    // ── Backgrounds ──
    bg:           isDark ? '#080808' : '#F2F0EB',
    cardBg:       isDark ? '#141414' : '#FFFFFF',
    headerBg:     isDark ? '#080808' : '#F2F0EB',
    // ── Surfaces (chips, icon bg, inputs) ──
    surface:      isDark ? '#1A1A1A' : '#E9E7E1',
    surfaceAlt:   isDark ? '#222222' : '#E9E7E1',
    // ── Borders / separators ──
    border:       isDark ? '#2A2A2A' : '#DEDAD4',
    borderLight:  isDark ? '#222222' : '#DEDAD4',
    // ── Text ──
    text:         isDark ? '#FFFFFF' : '#1A1A18',
    textAlt:      isDark ? '#FFFFFF' : '#1A1A18',
    textSub:      isDark ? '#999999' : '#8A8880',
    textMuted:    isDark ? '#666666' : '#8A8880',
    textVeryMuted:isDark ? '#555555' : '#CACBCE',
    textDisabled: isDark ? '#444444' : '#DEDAD4',
    // ── Accent / interactive ──
    accent:       isDark ? '#F8F7F4' : '#1A1A18',
    accentText:   isDark ? '#080808' : '#F2F0EB',
    // ── Hero cards (wallet balance, dashboard CTA, mission island) ──
    heroBg:       isDark ? '#1A1A1A' : '#1A1A18',
    heroText:     '#F2F0EB',
    heroSub:      'rgba(255,255,255,0.5)',
    heroSubFaint: 'rgba(255,255,255,0.4)',
    // ── Stripe / special badges ──
    stripeBadgeBg:   isDark ? '#1E1E3F' : '#EEF0FF',
    stripeBadgeText: COLORS.stripe,
    // ── Danger ──
    danger:       COLORS.danger,
    // ── StatusBar ──
    statusBar:    (isDark ? 'light-content' : 'dark-content') as 'light-content' | 'dark-content',
    // ── Shadows (only change opacity for dark) ──
    shadowOpacity: isDark ? 0.3 : 0.06,
    // ── Verified badge ──
    verified:     COLORS.verified,
    // ── Status badges ──
    badgeDoneBg:       isDark ? '#1A2A1A'               : 'rgba(74,222,128,0.1)',
    badgeDoneText:     isDark ? '#4ADE80'               : '#15803d',
    badgeCancelledBg:  isDark ? '#1A1A1A'               : '#E9E7E1',
    badgeCancelledText:isDark ? '#666666'               : '#8A8880',
    badgePendingBg:    isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
    badgePendingText:  isDark ? '#A0A0A0'               : '#b45309',
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
