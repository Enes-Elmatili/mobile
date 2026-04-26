// components/fixed/index.tsx — FIXED Design System shared components
// All screens import from here for zero visual drift.

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import type { AppTheme } from '@/hooks/use-app-theme';
import { resolveAvatarUrl } from '@/lib/avatarUrl';

// ── Display (Bebas) ─────────────────────────────────────────
export function Display({ children, size = 24, color, style }: {
  children: React.ReactNode; size?: number; color?: string; style?: TextStyle;
}) {
  return (
    <Text style={[{
      fontFamily: FONTS.bebas, fontSize: size,
      letterSpacing: size > 30 ? 0 : 0.5,
      color,
    }, style]}>{children}</Text>
  );
}

// ── Price (Bebas + currency) ────────────────────────────────
export function Price({ amount, currency = '€', size = 40, color }: {
  amount: number | string; currency?: string; size?: number; color?: string;
}) {
  return (
    <Text style={{ fontFamily: FONTS.bebas, fontSize: size, color, letterSpacing: 0.4 }}>
      {amount}
      <Text style={{ fontSize: size * 0.55 }}>{currency}</Text>
    </Text>
  );
}

// ── StatusChip ──────────────────────────────────────────────
const CHIP_MAP = (t: AppTheme) => ({
  paid:      { bg: 'rgba(61,139,61,0.14)',  fg: COLORS.greenBrand, label: 'PAYÉ' },
  pending:   { bg: t.badgePendingBg,        fg: t.badgePendingText, label: 'EN ATTENTE' },
  ongoing:   { bg: 'rgba(59,130,246,0.14)', fg: '#3B82F6',          label: 'EN COURS' },
  accepted:  { bg: 'rgba(139,92,246,0.14)', fg: '#8B5CF6',          label: 'ACCEPTÉ' },
  done:      { bg: t.badgeDoneBg,           fg: t.badgeDoneText,    label: 'TERMINÉ' },
  cancelled: { bg: t.badgeCancelledBg,      fg: t.badgeCancelledText, label: 'ANNULÉ' },
  warning:   { bg: 'rgba(232,120,58,0.14)', fg: COLORS.orangeBrand, label: 'URGENT' },
} as Record<string, { bg: string; fg: string; label: string }>);

export function StatusChip({ variant = 'pending', label, t }: {
  variant?: string; label?: string; t: AppTheme;
}) {
  const map = CHIP_MAP(t);
  const v = map[variant] || map.pending;
  return (
    <View style={sc.wrap}>
      <View style={[sc.dot, { backgroundColor: v.bg }]}>
        <View style={[sc.dotInner, { backgroundColor: v.fg }]} />
      </View>
      <Text style={[sc.text, { color: v.fg, backgroundColor: v.bg }]}>
        {label ?? v.label}
      </Text>
    </View>
  );
}
// Flatten: dot inside the chip bg
const sc = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
  },
  dotInner: { width: 6, height: 6, borderRadius: 3 },
  text: {
    fontFamily: FONTS.mono, fontSize: 10.5, letterSpacing: 0.8,
    paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8,
    overflow: 'hidden',
  },
});

// ── VerifiedBadge ───────────────────────────────────────────
export function VerifiedBadge({ size = 16, t }: { size?: number; t: AppTheme }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: t.verifiedBg,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Feather name="check" size={size * 0.68} color={t.verifiedFg} />
    </View>
  );
}

// ── Chip (filter) ───────────────────────────────────────────
export function Chip({ children, selected, onPress, t }: {
  children: React.ReactNode; selected?: boolean; onPress?: () => void; t: AppTheme;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingVertical: 9, paddingHorizontal: 12, borderRadius: 10,
      borderWidth: 1.5, borderColor: selected ? t.accent : t.border,
      backgroundColor: selected ? t.accent : t.surface,
    }}>
      <Text style={{
        fontFamily: FONTS.sansMedium, fontSize: 13,
        color: selected ? t.accentText : t.text,
        letterSpacing: -0.1,
      }}>{children}</Text>
    </TouchableOpacity>
  );
}

// ── Button ──────────────────────────────────────────────────
export function Button({ children, onPress, variant = 'primary', full, icon, iconRight, t, style }: {
  children: React.ReactNode; onPress?: () => void; variant?: string;
  full?: boolean; icon?: React.ReactNode; iconRight?: React.ReactNode;
  t: AppTheme; style?: ViewStyle;
}) {
  const palettes: Record<string, { bg: string; fg: string; bd: string }> = {
    primary:   { bg: t.accent,          fg: t.accentText,    bd: 'transparent' },
    secondary: { bg: 'transparent',     fg: t.text,          bd: t.border },
    ghost:     { bg: 'transparent',     fg: t.textSub,       bd: 'transparent' },
    danger:    { bg: t.danger,          fg: '#fff',          bd: 'transparent' },
    success:   { bg: COLORS.greenBrand, fg: '#fff',          bd: 'transparent' },
  };
  const p = palettes[variant] || palettes.primary;
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={[{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      paddingVertical: 13, paddingHorizontal: 18, borderRadius: 13,
      backgroundColor: p.bg, borderWidth: 1, borderColor: p.bd,
      width: full ? '100%' : undefined,
    }, style]}>
      {icon}
      <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: p.fg, letterSpacing: -0.1 }}>
        {children}
      </Text>
      {iconRight}
    </TouchableOpacity>
  );
}

// ── Card ────────────────────────────────────────────────────
export function Card({ children, t, pad = 16, style }: {
  children: React.ReactNode; t: AppTheme; pad?: number; style?: ViewStyle;
}) {
  return (
    <View style={[{
      backgroundColor: t.cardBg,
      borderWidth: 1, borderColor: t.borderLight,
      borderRadius: 18, padding: pad,
      shadowColor: '#000', shadowOpacity: t.isDark ? 0.02 : t.shadowOpacity,
      shadowOffset: { width: 0, height: 1 }, shadowRadius: 3,
      elevation: 1,
    }, style]}>{children}</View>
  );
}

// ── Avatar ──────────────────────────────────────────────────
export function Avatar({ name = 'A B', size = 40, verified, imageUri, avatarUrl, t }: {
  name?: string;
  size?: number;
  verified?: boolean;
  /** URI déjà résolue (string complète prête pour <Image>). */
  imageUri?: string | null;
  /** Raw avatarUrl venant du backend — résolu automatiquement via resolveAvatarUrl. */
  avatarUrl?: string | null;
  t: AppTheme;
}) {
  const initials = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
  const [imgFailed, setImgFailed] = React.useState(false);
  const resolvedUri = imageUri || resolveAvatarUrl(avatarUrl);
  const showImage = !!resolvedUri && !imgFailed;

  // Reset le state d'erreur quand l'URI change
  React.useEffect(() => { setImgFailed(false); }, [resolvedUri]);

  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      <View style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: t.surface, borderWidth: 1, borderColor: t.border,
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {showImage ? (
          <Image
            source={{ uri: resolvedUri! }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: size * 0.38, color: t.text }}>
            {initials}
          </Text>
        )}
      </View>
      {verified && (
        <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: t.cardBg, borderRadius: 999, padding: 1.5 }}>
          <VerifiedBadge size={14} t={t} />
        </View>
      )}
    </View>
  );
}

// ── StatStrip ───────────────────────────────────────────────
export function StatStrip({ items, t }: {
  items: { label: string; value: string | number; unit?: string }[]; t: AppTheme;
}) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {items.map((it, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={{ width: 1, backgroundColor: t.borderLight, marginVertical: 4 }} />}
          <View style={{ flex: 1, paddingHorizontal: 4 }}>
            <Text style={{
              fontFamily: FONTS.mono, fontSize: 10.5,
              color: t.textMuted, letterSpacing: 0.8,
              textTransform: 'uppercase', marginBottom: 4,
            }}>{it.label}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
              <Text style={{ fontFamily: FONTS.bebas, fontSize: 24, color: t.text }}>{it.value}</Text>
              {it.unit ? <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textSub }}>{it.unit}</Text> : null}
            </View>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

// ── SectionHeader ───────────────────────────────────────────
export function SectionHeader({ label, action, onAction, t }: {
  label: string; action?: string; onAction?: () => void; t: AppTheme;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginBottom: 10 }}>
      <Text style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' }}>
        {label}
      </Text>
      {action ? (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 12, color: t.textSub }}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── IconBtn ─────────────────────────────────────────────────
export function IconBtn({ icon, onPress, t, badge }: {
  icon: string; onPress?: () => void; t: AppTheme; badge?: boolean;
}) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={{
      width: 36, height: 36, borderRadius: 10,
      backgroundColor: t.surface, borderWidth: 1, borderColor: t.borderLight,
      alignItems: 'center', justifyContent: 'center',
      position: 'relative',
    }}>
      <Feather name={icon as any} size={18} color={t.text} />
      {badge && <View style={{
        position: 'absolute', top: 4, right: 4,
        width: 7, height: 7, borderRadius: 4,
        backgroundColor: COLORS.orangeBrand, borderWidth: 1.5, borderColor: t.surface,
      }} />}
    </TouchableOpacity>
  );
}
