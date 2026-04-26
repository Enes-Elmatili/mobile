/**
 * Shared app-wide theme hook — dark/light adaptive palette.
 * Design tokens aligned with the FIXED design system (Bebas Neue / DM Sans / DM Mono).
 *
 * Usage:
 *   • Reactive (recommended) — follows system mode:
 *       const t = useAppTheme();
 *       <View style={{ backgroundColor: t.bg }} />
 *
 *   • Forced dark — for premium onboarding / auth screens that must stay dark:
 *       import { darkTokens as t, FONTS, COLORS } from '@/hooks/use-app-theme';
 *
 *   • Forced light — rarely needed, but available for symmetry:
 *       import { lightTokens as t } from '@/hooks/use-app-theme';
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
  green:       '#4ADE80',
  amber:       '#F59E0B',
  red:         '#EF4444',
  danger:      '#DC2626',
  stripe:      '#635BFF',
  verified:    '#1D9BF0',
  blue:        '#3478F6',
  // ── FIXED brand palette ──
  greenBrand:  '#3D8B3D', // success (paid, accepted, scheduled, net après commission)
  orangeBrand: '#E8783A', // warning (pending, sent, adresse à confirmer)
  // ── Status badge palette (StatusBadge component) ──
  statusOngoing:  '#3B82F6', // ONGOING — blue
  statusAccepted: '#8B5CF6', // ACCEPTED — violet
  statusPending:  '#EC4899', // PENDING_PAYMENT — pink
  // ── Always-white (for text on colored bg like danger buttons) ──
  alwaysWhite: '#FFFFFF',
} as const;

// ── Theme tokens shape — widens all color values to `string` so components can
// pick per-status colors without fighting literal-union types (e.g. ActivityItem
// assigning badgeBg to either badgeDoneBg or badgeCancelledBg).
interface ThemeTokens {
  isDark: boolean;
  fonts: typeof FONTS;
  colors: typeof COLORS;
  bg: string;
  cardBg: string;
  headerBg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderLight: string;
  text: string;
  textAlt: string;
  textSub: string;
  textMuted: string;
  textVeryMuted: string;
  textDisabled: string;
  accent: string;
  accentText: string;
  heroBg: string;
  heroText: string;
  heroSub: string;
  heroSubFaint: string;
  stripeBadgeBg: string;
  stripeBadgeText: string;
  danger: string;
  statusBar: 'light-content' | 'dark-content';
  shadowOpacity: number;
  verified: string;
  verifiedBg: string;
  verifiedFg: string;
  badgeDoneBg: string;
  badgeDoneText: string;
  badgeCancelledBg: string;
  badgeCancelledText: string;
  badgePendingBg: string;
  badgePendingText: string;
}

// ── Theme builder — single source of truth for both modes ──────────────────
function buildTheme(isDark: boolean): ThemeTokens {
  return {
    isDark,
    fonts: FONTS,
    colors: COLORS,
    // ── Backgrounds ──
    bg:           isDark ? '#0A0A0A' : '#F4F4F2',
    cardBg:       isDark ? '#141414' : '#FFFFFF',
    headerBg:     isDark ? '#0A0A0A' : '#F4F4F2',
    // ── Surfaces (chips, icon bg, inputs) ──
    surface:      isDark ? '#1A1A1A' : '#E8E8E8',
    surfaceAlt:   isDark ? '#222222' : '#DCDCDC',
    // ── Borders / separators ──
    border:       isDark ? '#2A2A2A' : '#D8D8D8',
    borderLight:  isDark ? '#222222' : '#E4E4E0',
    // ── Text ──
    text:         isDark ? '#FFFFFF' : '#1A1A18',
    textAlt:      isDark ? '#FFFFFF' : '#1A1A18',
    textSub:      isDark ? '#999999' : '#8A8880',
    textMuted:    isDark ? '#666666' : '#A5A39B',
    textVeryMuted:isDark ? '#555555' : '#CACBCE',
    textDisabled: isDark ? '#444444' : '#C8C6BE',
    // ── Accent / interactive ──
    accent:       isDark ? '#F8F7F4' : '#1A1A18',
    accentText:   isDark ? '#0A0A0A' : '#F4F4F2',
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
    statusBar:    isDark ? 'light-content' : 'dark-content',
    // ── Shadows (only change opacity for dark) ──
    shadowOpacity: isDark ? 0.3 : 0.06,
    // ── Verified badge ──
    verified:     COLORS.verified,
    verifiedBg:   'rgba(61,139,61,0.14)',
    verifiedFg:   COLORS.greenBrand,
    // ── Status badges ──
    badgeDoneBg:       isDark ? '#1A2A1A'               : 'rgba(74,222,128,0.1)',
    badgeDoneText:     isDark ? '#4ADE80'               : '#15803D',
    badgeCancelledBg:  isDark ? '#1A1A1A'               : '#E9E7E1',
    badgeCancelledText:isDark ? '#666666'               : '#8A8880',
    badgePendingBg:    isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)',
    badgePendingText:  isDark ? '#A0A0A0'               : '#B45309',
  };
}

// ── Frozen snapshots for forced-mode components ────────────────────────────
export const darkTokens  = buildTheme(true);
export const lightTokens = buildTheme(false);

export function useAppTheme() {
  const scheme = useColorScheme();
  return scheme === 'dark' ? darkTokens : lightTokens;
}

export type AppTheme = ReturnType<typeof useAppTheme>;
