/**
 * Shared app-wide theme hook — dark/light adaptive palette.
 * Usage: `const t = useAppTheme();` then `[s.root, { backgroundColor: t.bg }]`
 */
import { useColorScheme } from 'react-native';

export function useAppTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    // ── Backgrounds ──
    bg:           isDark ? '#0A0A0A' : '#FFFFFF',
    cardBg:       isDark ? '#1A1A1A' : '#FFFFFF',
    headerBg:     isDark ? '#0A0A0A' : '#FFFFFF',
    // ── Surfaces (chips, icon bg, inputs) ──
    surface:      isDark ? '#1C1C1C' : '#F5F5F5',
    surfaceAlt:   isDark ? '#222222' : '#F8F8F8',
    // ── Borders / separators ──
    border:       isDark ? '#2A2A2A' : '#F0F0F0',
    borderLight:  isDark ? '#252525' : '#EFEFEF',
    // ── Text ──
    text:         isDark ? '#F2F2F2' : '#1A1A1A',
    textAlt:      isDark ? '#E8E8E8' : '#111111',
    textSub:      isDark ? '#999999' : '#888888',
    textMuted:    isDark ? '#666666' : '#ADADAD',
    textVeryMuted:isDark ? '#555555' : '#CACBCE',
    textDisabled: isDark ? '#444444' : '#D0D0D0',
    // ── Accent / interactive ──
    accent:       isDark ? '#FFFFFF' : '#1A1A1A',
    accentText:   isDark ? '#0A0A0A' : '#FFFFFF',
    // ── Hero cards (wallet balance, dashboard CTA) ──
    heroBg:       isDark ? '#1C1C1E' : '#1A1A1A',
    heroText:     '#FFFFFF',
    heroSub:      'rgba(255,255,255,0.5)',
    heroSubFaint: 'rgba(255,255,255,0.4)',
    // ── Stripe / special badges ──
    stripeBadgeBg:   isDark ? '#1E1E3F' : '#EEF0FF',
    stripeBadgeText: '#635BFF',
    // ── Danger ──
    danger:       '#DC2626',
    // ── StatusBar ──
    statusBar:    (isDark ? 'light-content' : 'dark-content') as 'light-content' | 'dark-content',
    // ── Shadows (only change opacity for dark) ──
    shadowOpacity: isDark ? 0.3 : 0.06,
    // ── Verified badge ──
    verified:     '#1D9BF0',
  };
}

export type AppTheme = ReturnType<typeof useAppTheme>;
