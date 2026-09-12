// app/onboarding/activity.tsx — Rattrapage : métiers + zone d'intervention.
//
// Pourquoi cet écran : l'inscription par e-mail collecte ville / rayon /
// catégories dans sa phase « zone », mais l'inscription SOCIALE ne les demande
// nulle part. Un prestataire arrivé par Apple ou Google se retrouvait donc avec
// une fiche sans aucune catégorie : non réservable, hors broadcast, et à qui le
// KYC réclame les 7 documents (dont l'accès à la profession) même s'il est
// serrurier — le piège qui a bloqué six serruriers en août.
//
// L'écran est un GATE de rattrapage, pas une étape : il se saute tout seul quand
// l'information est déjà là, et ne s'affiche donc jamais au parcours e-mail.
import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../../lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { toFeatherName } from "@/lib/iconMapper";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { getRequiredDocuments } from "../../constants/kycRequirements";
import { fetchProviderTrades, ONBOARDING_DATA_KEY } from "../../lib/providerOnboarding";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";
import { alpha } from "@/components/auth";

// Forced-dark local palette — sourced from theme tokens so charter updates propagate
const C = {
  white: darkTokens.text,
  grey: darkTokens.textMuted,
  faint: alpha(darkTokens.text, 0.3),
  border: alpha(darkTokens.text, 0.08),
  cardBg: darkTokens.cardBg,
  green: COLORS.greenBrand,
};

// Même périmètre que l'inscription : Région de Bruxelles-Capitale.
const CITY_OPTIONS = [{ value: "Bruxelles", label: "Bruxelles" }];

interface Category {
  id: number;
  name: string;
  icon?: string;
}

export default function OnboardingActivity() {
  const router = useRouter();
  const { t } = useTranslation();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [catsError, setCatsError] = useState(false);
  const [selectedCats, setSelectedCats] = useState<number[]>([]);
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(5);

  const loadCategories = useCallback(async (): Promise<Category[]> => {
    setCatsError(false);
    try {
      const res: any = await api.taxonomies.list();
      const list: Category[] = res?.data ?? res ?? [];
      setCategories(list);
      return list;
    } catch {
      setCatsError(true);
      return [];
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Le profil métier est-il déjà renseigné ? Si oui, cet écran n'a rien à
      // demander : on enchaîne sans le montrer (parcours e-mail).
      const trades = await fetchProviderTrades();
      if (cancelled) return;

      if (trades.known && trades.names.length > 0 && trades.city) {
        router.replace("/onboarding/company");
        return;
      }

      if (trades.city) setCity(trades.city);
      const list = await loadCategories();
      if (cancelled) return;

      // Pré-sélection des métiers déjà connus (cas d'un profil à moitié rempli).
      if (trades.names.length > 0) {
        const preset = list.filter((c) => trades.names.includes(c.name)).map((c) => c.id);
        if (preset.length > 0) setSelectedCats(preset);
      }
      setBooting(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggleCat = (id: number) => {
    feedback.haptic("light");
    setSelectedCats((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const canSubmit = city.trim().length >= 2 && selectedCats.length > 0;

  const submit = async () => {
    if (!canSubmit || saving) return;
    setSaving(true);
    const selectedObjects = categories.filter((c) => selectedCats.includes(c.id));
    const payload = { city: city.trim(), categoryIds: selectedCats };

    try {
      try {
        await api.providers.updateMe(payload);
      } catch (e: any) {
        // 404 = la ligne prestataire n'existe pas encore (parcours où le rôle a
        // été posé sans profil). On la crée alors au lieu d'échouer.
        if (e?.status === 404) {
          let name = "";
          try {
            const me: any = await api.user.me();
            name = me?.user?.name || me?.name || me?.user?.email || "Prestataire";
          } catch {
            name = "Prestataire";
          }
          await api.providers.register({ name, ...payload });
        } else {
          throw e;
        }
      }

      // Cache local : l'écran documents et l'écran Stripe le lisent encore.
      await AsyncStorage.setItem(
        ONBOARDING_DATA_KEY,
        JSON.stringify({
          city: city.trim(),
          radius,
          categoryIds: selectedCats,
          categories: selectedObjects.map((c) => ({ id: c.id, name: c.name })),
        })
      ).catch(() => {});

      feedback.haptic("success");
      router.replace("/onboarding/company");
    } catch (e: any) {
      feedback.error(e?.message || t("onboarding.activity_save_error"));
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
        totalSteps={PROVIDER_FLOW.totalSteps}
        hideStepper
        stepLabel={t("onboarding.phase_activity")}
        title={t("onboarding.activity_title")}
        subtitle={t("onboarding.activity_loading")}
      >
        <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
      </OnboardingLayout>
    );
  }

  const requiredDocsCount = getRequiredDocuments(
    categories.filter((c) => selectedCats.includes(c.id)).map((c) => c.name)
  ).filter((d) => d.required).length;

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.DOCUMENTS}
      totalSteps={PROVIDER_FLOW.totalSteps}
      hideStepper
      stepLabel={t("onboarding.phase_activity")}
      title={t("onboarding.activity_title")}
      subtitle={t("onboarding.activity_sub")}
      cta={{
        label: t("common.continue"),
        onPress: submit,
        disabled: !canSubmit,
        loading: saving,
        sub: !canSubmit ? t("onboarding.activity_cta_missing") : undefined,
      }}
    >
      {/* Ville */}
      <Text style={s.sectionLabel}>{t("onboarding.city_label")}</Text>
      <View style={s.cityList}>
        {CITY_OPTIONS.map((opt) => {
          const sel = city === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[s.cityOption, sel && s.cityOptionSel]}
              onPress={() => { feedback.haptic("selection"); setCity(opt.value); }}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: sel }}
            >
              <Feather name="map-pin" size={15} color={sel ? darkTokens.bg : alpha(darkTokens.text, 0.6)} />
              <Text style={[s.cityOptionText, sel && { color: darkTokens.bg }]}>{opt.label}</Text>
              {sel && <Feather name="check-circle" size={18} color={C.green} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Rayon */}
      <Text style={s.sectionLabel}>{t("onboarding.radius_label")}</Text>
      <View style={s.sliderWrap}>
        <Text style={s.sliderValue}>{radius} km</Text>
        <Slider
          minimumValue={1}
          maximumValue={15}
          step={1}
          value={radius}
          onValueChange={setRadius}
          minimumTrackTintColor={C.white}
          maximumTrackTintColor={alpha(darkTokens.text, 0.15)}
          thumbTintColor={C.white}
          style={{ width: "100%", height: 40 }}
        />
        <View style={s.sliderLabels}>
          <Text style={s.sliderBound}>1 km</Text>
          <Text style={s.sliderBound}>15 km</Text>
        </View>
      </View>

      {/* Métiers */}
      <Text style={s.sectionLabel}>{t("onboarding.categories_label")}</Text>
      {catsError && categories.length === 0 ? (
        <TouchableOpacity style={s.centered} onPress={loadCategories} activeOpacity={0.7}>
          <Feather name="refresh-cw" size={22} color={C.grey} />
          <Text style={s.retryText}>{t("common.retry")}</Text>
        </TouchableOpacity>
      ) : (
        <View style={s.catGrid}>
          {[...categories]
            .sort((a, b) => a.name.localeCompare(b.name, "fr"))
            .map((cat) => {
              const sel = selectedCats.includes(cat.id);
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[s.chip, sel && s.chipSel]}
                  onPress={() => toggleCat(cat.id)}
                  activeOpacity={0.7}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sel }}
                  accessibilityLabel={cat.name}
                >
                  <Feather
                    name={toFeatherName(cat.icon, "briefcase") as any}
                    size={15}
                    color={sel ? darkTokens.bg : alpha(darkTokens.text, 0.55)}
                  />
                  <Text numberOfLines={1} style={[s.chipText, sel && { color: darkTokens.bg }]}>
                    {cat.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
        </View>
      )}

      {selectedCats.length > 0 && (
        <Text style={s.catCount}>
          {t("onboarding.activity_docs_hint", { count: requiredDocsCount })}
        </Text>
      )}
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 40, gap: 10 },
  retryText: { fontFamily: FONTS.sansLight, fontSize: 13, color: C.grey },

  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: alpha(darkTokens.text, 0.55),
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 18,
  },

  cityList: { gap: 8 },
  cityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
  },
  cityOptionSel: { backgroundColor: C.white, borderColor: C.white },
  cityOptionText: {
    flex: 1,
    fontFamily: FONTS.sansMedium,
    fontSize: 14,
    color: alpha(darkTokens.text, 0.85),
  },

  sliderWrap: {
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  sliderValue: { fontFamily: FONTS.bebas, includeFontPadding: false, fontSize: 24, letterSpacing: 1, color: C.white },
  sliderLabels: { flexDirection: "row", justifyContent: "space-between" },
  sliderBound: { fontFamily: FONTS.mono, fontSize: 8.5, letterSpacing: 1.2, color: C.faint },

  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 100,
    paddingHorizontal: 14,
    height: 42,
  },
  chipSel: { backgroundColor: C.white, borderColor: C.white },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: alpha(darkTokens.text, 0.9),
    flexShrink: 1,
  },
  catCount: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    letterSpacing: 1.2,
    color: C.grey,
    textTransform: "uppercase",
    marginTop: 12,
  },
});
