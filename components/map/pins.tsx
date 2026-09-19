// components/map/pins.tsx — la famille des repères de carte.
//
// Une matière commune : un cœur, un anneau clair de 3 pt (le même en clair et
// en sombre), un trait de 1 pt qui découpe le repère sur une rue blanche comme
// sur un parc sombre, une ombre courte (iOS seulement — sur Android elle serait
// carrée). Jamais de halo.
//
// Trois formes, un rôle chacune :
//   PersonPin — une personne = sa photo ; l'état passe par l'anneau
//   DropPin   — un lieu où l'on va : une goutte à pointe (glyphe ou photo)
//   DotPin    — une chose : une demande, l'adresse
//
// Tout se pose dans MapPin (photographié le temps de se poser, puis figé).
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Avatar from '@/components/ui/Avatar';
import { useAppTheme, COLORS, FONTS } from '@/hooks/use-app-theme';
import { pinShadow } from './MapPin';

export type RingTone = 'white' | 'grey' | 'red' | 'green' | 'amber';
const RING: Record<RingTone, string> = { white: '#FFFFFF', grey: '#8A8A8A', red: COLORS.danger, green: COLORS.green, amber: COLORS.amber };
const HAIRLINE = 'rgba(0,0,0,0.32)';
const SQRT2 = Math.SQRT2;

/** L'anneau : 1 pt de trait sombre, 3 pt de couleur, le contenu rond dedans. */
export function Ring({ size, tone = 'white', ring = 3, shadow = 0.4, children, style }: { size: number; tone?: RingTone; ring?: number; shadow?: number; children: React.ReactNode; style?: ViewStyle }) {
  const outer = size + ring * 2 + 2;
  return (
    <View style={[{ width: outer, height: outer, borderRadius: outer / 2, backgroundColor: HAIRLINE, padding: 1 }, pinShadow(shadow), style]}>
      <View style={{ flex: 1, borderRadius: (outer - 2) / 2, backgroundColor: RING[tone], padding: ring }}>
        <View style={{ flex: 1, borderRadius: size / 2, overflow: 'hidden' }}>{children}</View>
      </View>
    </View>
  );
}

/** Une personne : sa photo (repli initiales), l'état dans l'anneau ; `dim` éteint la photo (hors ligne). */
export function PersonPin({ name, avatarUrl, size = 34, tone = 'white', dim = false }: { name?: string | null; avatarUrl?: string | null; size?: number; tone?: RingTone; dim?: boolean }) {
  return (
    <Ring size={size} tone={tone}>
      <Avatar name={name || '?'} size={size} avatarUrl={avatarUrl} />
      {dim ? <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(120,120,120,0.55)', borderRadius: size / 2 }]} /> : null}
    </Ring>
  );
}

/**
 * Une goutte à pointe : un carré aux trois coins ronds tourné de −45° ; le
 * contenu est retourné d'autant. La boîte fait la diagonale du carré, la
 * pointe est en bas au centre — ancre du marqueur `{ x: 0.5, y: 1 }`.
 * `heading` (degrés, 0 = nord) oriente la pointe dans la direction du déplacement.
 */
export function DropPin({ size = 40, color, tone = 'white', heading, shadow = 0.42, children }: { size?: number; color: string; tone?: RingTone; heading?: number | null; shadow?: number; children: React.ReactNode }) {
  const box = Math.ceil(size * SQRT2) + 8;
  const r = size / 2;
  // La pointe est en bas (sud) au repos ; on tourne toute la goutte pour qu'elle pointe le cap.
  const spin = heading != null && Number.isFinite(heading) ? ((heading + 180) % 360) : 0;
  return (
    <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${spin}deg` }] }}>
      <View style={[{ width: size + 8, height: size + 8, transform: [{ rotate: '-45deg' }], backgroundColor: HAIRLINE, borderTopLeftRadius: r + 4, borderTopRightRadius: r + 4, borderBottomRightRadius: r + 4, borderBottomLeftRadius: 2, padding: 1 }, pinShadow(shadow)]}>
        <View style={{ flex: 1, backgroundColor: RING[tone], borderTopLeftRadius: r + 3, borderTopRightRadius: r + 3, borderBottomRightRadius: r + 3, borderBottomLeftRadius: 1, padding: 3 }}>
          <View style={{ flex: 1, backgroundColor: color, borderTopLeftRadius: r, borderTopRightRadius: r, borderBottomRightRadius: r, borderBottomLeftRadius: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <View style={{ transform: [{ rotate: `${45 - spin}deg` }] }}>{children}</View>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Une chose : un disque plein ; `core` pose un cœur blanc (la demande pour vous). */
export function DotPin({ size = 14, color, core = false, tone = 'white' }: { size?: number; color: string; core?: boolean; tone?: RingTone }) {
  return (
    <Ring size={size} tone={tone} shadow={0.35}>
      <View style={{ flex: 1, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
        {core ? <View style={{ width: Math.round(size * 0.36), height: Math.round(size * 0.36), borderRadius: size, backgroundColor: '#FFFFFF' }} /> : null}
      </View>
    </Ring>
  );
}

/** La bulle des minutes, attachée au-dessus d'une personne par une pointe. */
export function EtaBubble({ minutes }: { minutes: number }) {
  const theme = useAppTheme();
  return (
    <View style={s.etaWrap}>
      <View style={[s.eta, { backgroundColor: theme.accent }, pinShadow(0.3)]}>
        <Text style={[s.etaText, { color: theme.accentText }]} maxFontSizeMultiplier={1}>{`${minutes} MIN`}</Text>
      </View>
      <View style={[s.etaTip, { backgroundColor: theme.accent }]} />
    </View>
  );
}

/** Le glyphe d'une goutte (Feather), tourné droit par DropPin. */
export function DropGlyph({ name, color = '#0A0A0A', size = 18 }: { name: React.ComponentProps<typeof Feather>['name']; color?: string; size?: number }) {
  return <Feather name={name} size={size} color={color} />;
}

const s = StyleSheet.create({
  etaWrap: { alignItems: 'center', marginBottom: 6 },
  eta: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 11 },
  etaText: { fontFamily: FONTS.bebas, fontSize: 17, letterSpacing: 1.2, includeFontPadding: false },
  etaTip: { width: 10, height: 10, borderRadius: 2, marginTop: -5, transform: [{ rotate: '45deg' }] },
});
