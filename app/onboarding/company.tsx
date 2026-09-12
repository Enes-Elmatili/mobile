// app/onboarding/company.tsx — Étape « Entreprise » de l'onboarding prestataire.
//
// Pourquoi cet écran : le garde d'activation (backend/services/providerGate.js)
// exige un BCE confirmé par VIES et un IBAN valide. Jusqu'au 12/09/2026, aucun
// écran ne les demandait — ni à l'inscription e-mail, ni sociale — et le seul
// champ BCE (profil) enregistrait n'importe quoi : aucun prestataire n'était
// activable sans intervention en base. L'étape s'insère entre les métiers et
// les pièces, et s'efface d'elle-même si tout est déjà fourni.
import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TextInput } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "../../lib/api";
import { feedback } from "@/lib/feedback/feedback";
import { OnboardingLayout } from "../../components/onboarding/OnboardingLayout";
import { PROVIDER_FLOW } from "../../constants/onboardingFlows";
import { isValidBce, formatBce, isValidIban, formatIban } from "../../lib/company";
import { AuthInput, alpha } from "@/components/auth";
import { FONTS, COLORS, darkTokens } from "@/hooks/use-app-theme";

const C = {
  white: darkTokens.text,
  grey: darkTokens.textMuted,
  border: alpha(darkTokens.text, 0.08),
  cardBg: darkTokens.cardBg,
  green: COLORS.greenBrand,
};

type Vies = { name: string | null; address: string | null } | null;

export default function OnboardingCompany() {
  const router = useRouter();
  const { t } = useTranslation();

  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bce, setBce] = useState("");
  const [iban, setIban] = useState("");
  const [bceError, setBceError] = useState<string | null>(null);
  const [ibanError, setIbanError] = useState<string | null>(null);
  /** BCE déjà confirmé par VIES côté serveur (on ne le re-soumet pas). */
  const [vatVerified, setVatVerified] = useState(false);
  const [vies, setVies] = useState<Vies>(null);
  const [ibanSaved, setIbanSaved] = useState(false);
  const ibanRef = useRef<TextInput>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Déjà renseigné (parcours repris, profil) ? On préremplit — et si tout
      // est en règle, l'écran n'a rien à demander : on enchaîne.
      try {
        const res: any = await api.providers.me();
        const p = res?.provider;
        if (cancelled) return;
        if (p?.vatNumber) setBce(String(p.vatNumber));
        if (p?.bankIban) { setIban(String(p.bankIban)); setIbanSaved(true); }
        const verified = !!p?.vatVerifiedAt;
        setVatVerified(verified);
        if (verified) setVies({ name: p?.vatLegalName ?? null, address: p?.vatAddress ?? null });
        if (verified && p?.bankIban) {
          router.replace("/onboarding/documents");
          return;
        }
      } catch {
        // 404 = pas encore de fiche prestataire : l'écran se remplit à vide.
      }
      if (!cancelled) setBooting(false);
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- lecture unique au montage, comme activity.tsx

  const bceOk = isValidBce(bce);
  const ibanOk = isValidIban(iban);
  const canSubmit = bceOk && ibanOk && !saving;

  const submit = async () => {
    if (!canSubmit) return;
    feedback.haptic("medium");
    setSaving(true);
    setBceError(null);
    setIbanError(null);

    try {
      // 1. BCE → VIES (sauf s'il est déjà confirmé et inchangé)
      if (!vatVerified) {
        try {
          const res: any = await api.provider.setVat(bce.trim());
          setVatVerified(true);
          setVies({ name: res?.vies?.name ?? null, address: res?.vies?.address ?? null });
          setBce(res?.vatNumber ?? formatBce(bce));
        } catch (e: any) {
          const code = e?.data?.code ?? e?.code;
          if (code === "VIES_INVALID") setBceError(t("onboarding.company_bce_vies_invalid"));
          else if (code === "INVALID_BCE_FORMAT") setBceError(t("onboarding.company_bce_invalid"));
          else if (code === "VIES_UNAVAILABLE") setBceError(t("onboarding.company_vies_unavailable"));
          else setBceError(e?.data?.message || e?.message || t("onboarding.company_save_error"));
          feedback.haptic("error");
          setSaving(false);
          return;
        }
      }

      // 2. IBAN (mod-97 côté serveur aussi)
      if (!ibanSaved || formatIban(iban) !== iban) {
        try {
          const res: any = await api.provider.setIban(iban.trim());
          setIban(res?.iban ?? formatIban(iban));
          setIbanSaved(true);
        } catch (e: any) {
          setIbanError(e?.data?.message || t("onboarding.company_iban_invalid"));
          feedback.haptic("error");
          setSaving(false);
          return;
        }
      }

      feedback.haptic("success");
      router.replace("/onboarding/documents");
    } catch (e: any) {
      feedback.error(e?.message || t("onboarding.company_save_error"));
      setSaving(false);
    }
  };

  if (booting) {
    return (
      <OnboardingLayout
        currentStep={PROVIDER_FLOW.steps.COMPANY}
        totalSteps={PROVIDER_FLOW.totalSteps}
        stepLabel={t("onboarding.company_step_label")}
        title={t("onboarding.company_title")}
        subtitle={t("onboarding.company_loading")}
      >
        <View style={s.centered}><ActivityIndicator size="large" color={C.grey} /></View>
      </OnboardingLayout>
    );
  }

  return (
    <OnboardingLayout
      currentStep={PROVIDER_FLOW.steps.COMPANY}
      totalSteps={PROVIDER_FLOW.totalSteps}
      stepLabel={t("onboarding.company_step_label")}
      title={t("onboarding.company_title")}
      subtitle={t("onboarding.company_sub")}
      showBack
      onBack={() => router.replace("/onboarding/activity")}
      cta={{
        label: t("common.continue"),
        onPress: submit,
        disabled: !canSubmit,
        loading: saving,
        sub: !bce.trim() || !iban.trim()
          ? t("onboarding.company_cta_missing")
          : !bceOk
            ? t("onboarding.company_bce_invalid")
            : !ibanOk
              ? t("onboarding.company_iban_invalid")
              : undefined,
      }}
    >
      {/* BCE */}
      <Text style={s.sectionLabel}>{t("onboarding.company_bce_label")}</Text>
      <AuthInput
        icon="briefcase"
        value={bce}
        onChangeText={(v) => { setBce(v); setBceError(null); if (vatVerified) { setVatVerified(false); setVies(null); } }}
        onBlur={() => { if (bceOk) setBce(formatBce(bce)); }}
        placeholder="BE 0123.456.749"
        keyboardType="numbers-and-punctuation"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => ibanRef.current?.focus()}
        error={bceError}
        editable={!saving}
      />
      {vatVerified && vies ? (
        <View style={s.viesCard}>
          <Feather name="check-circle" size={16} color={C.green} />
          <View style={{ flex: 1 }}>
            <Text style={s.viesTitle}>{t("onboarding.company_vies_ok")}</Text>
            {!!vies.name && <Text style={s.viesLine} numberOfLines={1}>{vies.name}</Text>}
            {!!vies.address && <Text style={s.viesLine} numberOfLines={2}>{vies.address}</Text>}
          </View>
        </View>
      ) : (
        <Text style={s.hint}>{t("onboarding.company_bce_hint")}</Text>
      )}

      {/* IBAN */}
      <Text style={s.sectionLabel}>{t("onboarding.company_iban_label")}</Text>
      <AuthInput
        inputRef={ibanRef}
        icon="credit-card"
        value={iban}
        onChangeText={(v) => { setIban(v); setIbanError(null); }}
        onBlur={() => { if (ibanOk) setIban(formatIban(iban)); }}
        placeholder="BE68 5390 0754 7034"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={submit}
        error={ibanError}
        editable={!saving}
      />
      <Text style={s.hint}>{t("onboarding.company_iban_hint")}</Text>
    </OnboardingLayout>
  );
}

const s = StyleSheet.create({
  centered: { alignItems: "center", paddingVertical: 40, gap: 10 },
  sectionLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    letterSpacing: 1.6,
    color: alpha(darkTokens.text, 0.55),
    textTransform: "uppercase",
    marginBottom: 10,
    marginTop: 18,
  },
  hint: {
    fontFamily: FONTS.sansLight,
    fontSize: 12.5,
    lineHeight: 18,
    color: C.grey,
    marginTop: 8,
  },
  viesCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: C.cardBg,
    borderWidth: 1,
    borderColor: alpha(COLORS.greenBrand, 0.35),
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  viesTitle: { fontFamily: FONTS.sansMedium, fontSize: 13, color: C.white },
  viesLine: { fontFamily: FONTS.sansLight, fontSize: 12.5, color: C.grey, marginTop: 2 },
});
