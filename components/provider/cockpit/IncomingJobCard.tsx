// components/provider/cockpit/IncomingJobCard.tsx — la fiche « elle est pour vous »
// de l'accueil prestataire : elle monte, compte 60 s, se teinte à l'acceptation
// puis se replie vers le bas pendant que l'accueil passe en mission.
import React, { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import Reanimated, { Easing, useSharedValue, useAnimatedStyle, withSpring, withTiming, cancelAnimation } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useReduceMotion, dampingFor } from '@/lib/motion/sheet';
import { MOTION } from '@/lib/motion/springs';
import { IncomingMissionCard } from '@/components/mission/IncomingMissionCard';
import { useAppTheme, COLORS, alpha } from '@/hooks/use-app-theme';
import type { IncomingRequest } from '@/lib/cockpit/incoming';

export const TIMER_DURATION = 60;

// Entrée de la carte de mission entrante : spring critique (ζ = 1.0).
// Une notification de mission doit se poser, pas rebondir (règle 2).
const CARD_ENTER_SPRING = {
  damping: dampingFor(1.0, 180, 1),
  stiffness: 180,
  mass: 1,
};

export function IncomingJobCard({
  request,
  onAccept,
  onDecline,
  leaving,
  bottom,
  insetBottom,
  page,
  maxHeight,
}: {
  request: IncomingRequest;
  onAccept: () => void;
  onDecline: () => void;
  /** Le serveur a confirmé : la fiche se replie vers le bas, l'accueil passe en mission. */
  leaving: boolean;
  /** Bord bas de la fiche (0 : elle descend jusqu'au bord ; la barre s'est effacée). */
  bottom: number;
  /** Inset bas du device, DANS la fiche : rien de la carte ne transparaît dessous. */
  insetBottom: number;
  /** Duo déplié : la page où se pose la fiche (repère de l'accueil) — jamais à cheval sur le pli. Toute la largeur sinon. */
  page: { left: number; width: number } | null;
  /** Plafond de la fiche : au-delà, son contenu défile (le glissé reste atteignable, le titre visible). */
  maxHeight: number;
}) {
  const theme = useAppTheme();
  const reduced    = useReduceMotion();
  const slideUp    = useSharedValue(400);
  const fade       = useSharedValue(1);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  // Le moment de l'acceptation, en UN mouvement, sur le même écran, et
  // discret : la fiche se teinte du vert pâle des pastilles (rien ne se
  // superpose, tout reste lisible), l'anneau du compte à rebours s'efface, le
  // curseur prend sa coche verte, le titre passe à « Acceptée » ; on la
  // laisse se lire, puis elle se replie vers le bas — et l'accueil est déjà en
  // mission dessous (carte recadrée, tracé, étiquette ambre, feuille).
  // L'haptique est partie sur la frame du glissé.
  const [accepted, setAccepted] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Le contenu ne défile que s'il dépasse le plafond : sinon le glissé n'a
  // aucun geste vertical en concurrence (même rendu qu'avant).
  const [scrollH, setScrollH] = useState(0);
  const [contentH, setContentH] = useState(0);
  const overflow = scrollH > 0 && contentH > scrollH + 1;
  const tint = useSharedValue(0);
  const accept = useCallback(() => {
    if (accepted) return;
    setAccepted(true);
    tint.set(withTiming(1, { duration: reduced ? 200 : 520, easing: Easing.out(Easing.cubic) }));
    onAccept();
  }, [accepted, reduced, tint, onAccept]);
  useEffect(() => {
    if (!leaving) return;
    // Repli : la fiche descend et s'efface, en partant de sa position courante.
    slideUp.set(reduced ? withTiming(0, { duration: 1 }) : withSpring(Math.max(size.h, 400) + 80, MOTION.pane));
    fade.set(withTiming(0, { duration: reduced ? 200 : 380 }));
  }, [leaving, reduced, slideUp, fade, size.h]);
  const tintStyle = useAnimatedStyle(() => ({ opacity: tint.value }));

  useEffect(() => {
    if (reduced) {
      // Règle 8 : pas de course, on pose l'état final.
      slideUp.set(0);
      return;
    }
    // Entrée : spring critique (ζ = 1.0) — arrive vite, ne dépasse pas.
    slideUp.set(withSpring(0, CARD_ENTER_SPRING));
    return () => { cancelAnimation(slideUp); };
  }, [reduced, slideUp]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slideUp.value }], opacity: fade.value }));

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  // When countdown reaches 0, switch to "last chance" mode instead of dismissing
  // (dérivé : le compte à rebours s'arrête à 0 et n'est jamais relancé).
  const expired = timeLeft === 0;

  const sheetBg = theme.bg;

  return (
    <Reanimated.View style={[jc.wrap, { bottom, maxHeight }, page ? { left: page.left, right: undefined, width: page.width } : null, cardStyle]}>
      {/* Gradient map → sheet */}
      <LinearGradient
        colors={['transparent', `${sheetBg}99`, sheetBg]}
        locations={[0, 0.4, 1]}
        style={jc.topFade}
        pointerEvents="none"
      />
      <View style={[jc.sheet, { backgroundColor: sheetBg, paddingBottom: Math.max(insetBottom, 12) + 12 }]} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {/* Le vert pâle des pastilles, en fondu sous le contenu. */}
        <Reanimated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(COLORS.greenBrand, theme.isDark ? 0.16 : 0.13) }, tintStyle]} pointerEvents="none" />
        <View style={[jc.handle, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.10)' }]} />
        {/* Fiche mission (planche 2A) : quoi, photos, faits, gain, glissé. */}
        <ScrollView
          style={jc.scroll}
          scrollEnabled={overflow}
          bounces={false}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => setScrollH(e.nativeEvent.layout.height)}
          onContentSizeChange={(_w, h) => setContentH(h)}
        >
          <IncomingMissionCard
            brief={request.brief}
            timeLeft={timeLeft}
            total={TIMER_DURATION}
            expired={expired}
            accepted={accepted}
            onAccept={accept}
            onDecline={onDecline}
          />
        </ScrollView>
      </View>
    </Reanimated.View>
  );
}

const jc = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, zIndex: 8,
    shadowColor: '#000', shadowRadius: 40, shadowOffset: { width: 0, height: -12 }, shadowOpacity: 0.3,
    elevation: 28,
  },
  topFade: { height: 56 },
  // La fiche cède sous le plafond : c'est le contenu qui défile, pas la fiche qui sort de l'écran.
  sheet: { overflow: 'hidden', flexShrink: 1 },
  scroll: { flexGrow: 0, flexShrink: 1 },
  handle: { width: 36, height: 3, borderRadius: 2, alignSelf: 'center', marginTop: 14 },
});
