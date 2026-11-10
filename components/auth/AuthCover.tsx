// components/auth/AuthCover.tsx
// La couverture du livre d'accueil, sur le Duo déplié.
//
// Le parcours d'entrée (accueil, connexion, inscription, mot de passe…) se lit
// en deux pages : à gauche une couverture FIXE — l'îlot sombre de la charte,
// wordmark, promesse en Bebas, les trois étapes — à droite la page de l'écran
// courant, celle de l'iPhone, éprouvée. On tourne les pages à droite, la
// couverture ne bouge pas : on sait toujours où l'on est.
//
// Les deux blocs éditoriaux de l'accueil (titre, étapes) vivent ici pour ne
// pas être écrits deux fois : la page d'accueil compacte les réutilise.
import React, { createContext, useContext } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAppTheme, FONTS, alpha, darkTokens } from "@/hooks/use-app-theme";

/** `true` dans la page droite du livre : le wordmark y est déjà sur la couverture. */
export const AuthBookContext = createContext(false);
export const useAuthBook = () => useContext(AuthBookContext);

type Tone = "page" | "island";

/** « UN PRO / CHEZ VOUS / MAINTENANT. » + sous-titre. */
export function WelcomeHeadline({ tone = "page" }: { tone?: Tone }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const island = tone === "island";
  const ink = island ? theme.heroText : theme.text;
  return (
    <>
      <Text style={[s.headline, { color: ink }]} maxFontSizeMultiplier={1.2}>
        {t("auth.welcome_l1")}{"\n"}
        {t("auth.welcome_l2_prefix")}{t("auth.welcome_l2_accent")}{"\n"}
        {t("auth.welcome_l3")}<Text style={{ color: theme.brandDot }}>.</Text>
      </Text>
      <Text style={[s.subhead, { color: island ? theme.heroSub : alpha(theme.text, 0.56) }]} maxFontSizeMultiplier={1.2}>
        {t("auth.welcome_sub")}
      </Text>
    </>
  );
}

/** Les trois étapes sur filet : trois colonnes ÉGALES, numéros verts. */
export function WelcomeSteps({ tone = "page" }: { tone?: Tone }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const island = tone === "island";
  const labels = [t("auth.welcome_step1"), t("auth.welcome_step2"), t("auth.welcome_step3")];
  return (
    <View style={[s.steps, { borderTopColor: island ? alpha(theme.heroText, 0.14) : alpha(theme.text, 0.11) }]}>
      {labels.map((label, i) => (
        <View key={label} style={s.step}>
          <Text style={[s.stepNum, { color: island ? darkTokens.greenText : theme.greenText }]} maxFontSizeMultiplier={1.2}>
            {String(i + 1).padStart(2, "0")}
          </Text>
          <Text style={[s.stepLabel, { color: island ? theme.heroText : theme.text }]} maxFontSizeMultiplier={1.2}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

/** La page gauche : un îlot sombre (rayon 24) posé dans la page, marges égales. */
export function AuthCover() {
  const theme = useAppTheme();
  return (
    <View style={[s.island, { backgroundColor: theme.heroBg }]}>
      <Image
        source={require("@/assets/logo-variants/logo-transparent-white.png")}
        style={s.logo}
        resizeMode="contain"
        accessibilityLabel="FIXED"
      />
      <View style={s.air} />
      <WelcomeHeadline tone="island" />
      <View style={s.airSmall} />
      <WelcomeSteps tone="island" />
    </View>
  );
}

const s = StyleSheet.create({
  island: {
    flex: 1,
    margin: 12,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    overflow: "hidden",
  },
  logo: { height: 22, width: 81 },
  air: { flex: 1, minHeight: 24 },
  airSmall: { flex: 0.6, minHeight: 20 },

  headline: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 52,
    lineHeight: 52,
    letterSpacing: 0.6,
    textAlign: "left",
  },
  subhead: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 20,
    maxWidth: 260,
    textAlign: "left",
  },

  steps: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 18,
    gap: 12,
  },
  step: { flex: 1 },
  stepNum: {
    fontFamily: FONTS.monoMedium,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  stepLabel: {
    fontFamily: FONTS.bebas, includeFontPadding: false,
    fontSize: 16,
    letterSpacing: 1.2,
    marginTop: 5,
  },
});
