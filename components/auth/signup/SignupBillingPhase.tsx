// components/auth/signup/SignupBillingPhase.tsx — phase 2 : téléphone + adresse de facturation
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS, useAppTheme, alpha } from "@/hooks/use-app-theme";
import { AuthPhoneInput, AuthAddressAutocomplete } from "@/components/auth";
import type { ParsedAddress } from "@/components/auth";
import { ss } from "./signupStyles";

type Setter = (v: string) => void;

interface Props {
  address: string;
  postalCode: string;
  billingCity: string;
  setPhone: Setter;
  setAddress: Setter;
  setPostalCode: Setter;
  setBillingCity: Setter;
  phoneError: string;
  addressError: string;
  postalCodeError: string;
  billingCityError: string;
  setPhoneError: Setter;
  setAddressError: Setter;
  setPostalCodeError: Setter;
  setBillingCityError: Setter;
}

export function SignupBillingPhase(p: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return (
    <View style={ss.body}>
      <View style={ss.form}>
        <AuthPhoneInput
          themed
          onChangeFormattedText={(e164) => { p.setPhone(e164); if (p.phoneError) p.setPhoneError(""); }}
          onChangeText={() => { if (p.phoneError) p.setPhoneError(""); }}
          error={p.phoneError || undefined}
        />
        <AuthAddressAutocomplete
          themed
          onAddressSelected={(a: ParsedAddress) => {
            p.setAddress(a.street);
            p.setPostalCode(a.postalCode);
            p.setBillingCity(a.city);
            if (p.addressError) p.setAddressError("");
            if (p.postalCodeError) p.setPostalCodeError("");
            if (p.billingCityError) p.setBillingCityError("");
          }}
          onChangeText={() => {
            // L'utilisateur retape après avoir sélectionné une adresse :
            // on invalide la valeur parsée pour éviter une donnée périmée.
            if (p.address || p.postalCode || p.billingCity) {
              p.setAddress("");
              p.setPostalCode("");
              p.setBillingCity("");
            }
          }}
          error={p.addressError || undefined}
        />
        {!!p.postalCode && !!p.billingCity && (
          <View style={s.autofillRow}>
            <Feather name="zap" size={11} color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)} />
            <Text
              style={[s.autofillText, { color: alpha(theme.text, theme.isDark ? 0.3 : 0.45) }]}
              maxFontSizeMultiplier={1.2}
            >
              {p.postalCode} {p.billingCity} — {t('auth.su_autofill_suffix')}
            </Text>
          </View>
        )}
      </View>
      <View style={ss.cguRow}>
        <Feather
          name="lock"
          size={13}
          color={alpha(theme.text, theme.isDark ? 0.3 : 0.45)}
          style={{ marginTop: 1 }}
        />
        <Text
          style={[ss.cguText, { color: alpha(theme.text, theme.isDark ? 0.5 : 0.68) }]}
          maxFontSizeMultiplier={1.2}
        >
          {t('auth.su_billing_note')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  autofillRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 2,
  },
  autofillText: {
    fontFamily: FONTS.mono,
    fontSize: 8.5,
    letterSpacing: 1.2,
  },
});
