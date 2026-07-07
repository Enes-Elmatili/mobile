/**
 * AuthAddressAutocomplete — Google Places address picker for the FIXED auth flow.
 *
 * Single field, same visual style as AuthInput. Constrained to Belgium, language fr.
 * On selection, parses address_components and calls onAddressSelected(ParsedAddress).
 *
 * Tracks whether the user has committed to a Place. If the field has text but no
 * Place was selected, shows an inline error on blur / submit attempt.
 *
 * Fallback de saisie manuelle : si l'autocomplete Google échoue (onFail) ou via
 * le lien « Saisir manuellement », un formulaire rue / code postal / ville prend
 * le relais pour ne jamais bloquer l'inscription.
 */
import React, { useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Platform, TouchableOpacity } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import type { GooglePlaceDetail, AddressComponent } from "react-native-google-places-autocomplete";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";
import { AuthInput } from "./AuthInput";

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

export type ParsedAddress = {
  formatted: string;
  street: string;
  postalCode: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
};

function getComponent(
  components: AddressComponent[],
  type: string,
  longName = true
): string {
  // The library types `types` as a fixed enum (PlaceType[]); we accept a wider
  // string here for caller convenience and cast at the comparison.
  const comp = components.find((c) => (c.types as readonly string[]).includes(type));
  return comp ? (longName ? comp.long_name : comp.short_name) : "";
}

function parseAddressComponents(
  details: GooglePlaceDetail,
  formatted: string
): ParsedAddress {
  const comps = details.address_components ?? [];
  const streetNumber = getComponent(comps, "street_number");
  const route = getComponent(comps, "route");
  const street = [streetNumber, route].filter(Boolean).join(" ") || route;

  const postalCode = getComponent(comps, "postal_code");
  const city =
    getComponent(comps, "locality") ||
    getComponent(comps, "postal_town") ||
    getComponent(comps, "administrative_area_level_2");
  const country = getComponent(comps, "country");

  const { lat, lng } = details.geometry.location;

  return { formatted, street, postalCode, city, country, lat, lng };
}

type Props = {
  onAddressSelected: (parsed: ParsedAddress) => void;
  error?: string | null;
  label?: string;
  value?: string;
  /**
   * Appelé quand l'utilisateur retape dans le champ Google après avoir déjà
   * sélectionné une adresse : le parent doit invalider l'adresse parsée
   * (sinon address/postalCode/city gardent l'ancienne valeur).
   */
  onChangeText?: (text: string) => void;
};

export function AuthAddressAutocomplete({
  onAddressSelected,
  error,
  label,
  onChangeText,
}: Props) {
  const { t } = useTranslation();
  const resolvedLabel = label === undefined ? t("auth.address_label") : label;
  const [focused, setFocused] = useState(false);
  const [placeSelected, setPlaceSelected] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  // Saisie manuelle (fallback)
  const [manual, setManual] = useState(false);
  const [mStreet, setMStreet] = useState("");
  const [mPostal, setMPostal] = useState("");
  const [mCity, setMCity] = useState("");

  const effectiveError = error ?? internalError;

  const emitManual = useCallback(
    (street: string, postal: string, city: string) => {
      const formatted = [street, [postal, city].filter(Boolean).join(" ")]
        .filter(Boolean)
        .join(", ");
      onAddressSelected({
        formatted,
        street: street.trim(),
        postalCode: postal.trim(),
        city: city.trim(),
        country: "Belgique",
        lat: 0,
        lng: 0,
      });
    },
    [onAddressSelected]
  );

  const handlePress = useCallback(
    (data: { description: string }, details: GooglePlaceDetail | null) => {
      if (!details) return;
      const parsed = parseAddressComponents(details, data.description);
      setPlaceSelected(true);
      setInternalError(null);
      onAddressSelected(parsed);
    },
    [onAddressSelected]
  );

  const switchToManual = useCallback(() => {
    setManual(true);
    setInternalError(null);
    // Réinitialise l'adresse parsée : on repart d'une saisie vierge
    onChangeText?.("");
  }, [onChangeText]);

  // ── Mode saisie manuelle ────────────────────────────────────────────────────
  if (manual) {
    return (
      <View style={s.wrap}>
        <AuthInput
          label={resolvedLabel}
          icon="map-pin"
          placeholder={t("auth.address_street_placeholder")}
          autoCapitalize="words"
          value={mStreet}
          onChangeText={(v) => {
            setMStreet(v);
            emitManual(v, mPostal, mCity);
          }}
        />
        <View style={s.manualRow}>
          <View style={s.manualPostal}>
            <AuthInput
              label={t("auth.postal_label")}
              icon="hash"
              placeholder="1050"
              keyboardType="number-pad"
              maxLength={4}
              value={mPostal}
              onChangeText={(v) => {
                setMPostal(v);
                emitManual(mStreet, v, mCity);
              }}
            />
          </View>
          <View style={s.manualCity}>
            <AuthInput
              label={t("auth.city_label")}
              icon="map"
              placeholder="Ixelles"
              autoCapitalize="words"
              value={mCity}
              onChangeText={(v) => {
                setMCity(v);
                emitManual(mStreet, mPostal, v);
              }}
            />
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setManual(false)}
          style={s.manualLinkRow}
          activeOpacity={0.7}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t("auth.address_search_a11y")}
        >
          <Feather name="search" size={11} color={alpha(authT.textOnLight, 0.55)} />
          <Text style={s.manualLink}>{t("auth.address_search_a11y")}</Text>
        </TouchableOpacity>

        {effectiveError ? (
          <View style={s.errorRow}>
            <Feather name="alert-circle" size={12} color="#DC2626" />
            <Text style={s.errorText}>{effectiveError}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  // ── Mode autocomplete Google ────────────────────────────────────────────────
  return (
    <View style={s.wrap}>
      {resolvedLabel ? <Text style={s.label}>{resolvedLabel}</Text> : null}
      <View
        style={[
          s.field,
          focused && s.fieldFocused,
          !!effectiveError && s.fieldError,
        ]}
      >
        {/* map-pin icon */}
        <Feather
          name="map-pin"
          size={16}
          color={alpha(authT.textOnDark, focused ? 0.85 : 0.55)}
          style={s.icon}
        />

        <GooglePlacesAutocomplete
          placeholder={t("auth.address_search_placeholder")}
          fetchDetails
          onPress={handlePress}
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: "fr",
            components: "country:be",
          }}
          minLength={2}
          enablePoweredByContainer={false}
          keyboardShouldPersistTaps="always"
          listViewDisplayed="auto"
          // disableScroll: true makes the dropdown render as plain Views (not
          // a VirtualizedList) inside its absolute container. This silences
          // the "VirtualizedLists should never be nested inside ScrollViews"
          // warning AND lets the dropdown render correctly on top of the
          // form ScrollView. We cap maxHeight on listView so a long list
          // doesn't overflow visually.
          disableScroll
          listEmptyComponent={null}
          onFail={() => {
            // API Places indisponible / clé absente → bascule vers la saisie manuelle
            setInternalError(t("auth.address_search_unavailable"));
            switchToManual();
          }}
          textInputProps={{
            placeholderTextColor: alpha(authT.textOnDark, 0.4),
            onFocus: () => setFocused(true),
            onBlur: () => {
              setFocused(false);
            },
            onChangeText: (text: string) => {
              if (text.length === 0) {
                setPlaceSelected(false);
              } else if (placeSelected) {
                // user typed after selecting — reset
                setPlaceSelected(false);
              }
              setInternalError(null);
              // Invalide l'adresse parsée côté parent (donnée périmée sinon)
              onChangeText?.(text);
            },
            selectionColor: authT.textOnDark,
          }}
          styles={{
            container: {
              flex: 1,
              zIndex: 999,
            },
            textInputContainer: {
              backgroundColor: "transparent",
              borderTopWidth: 0,
              borderBottomWidth: 0,
            },
            textInput: {
              height: 44,
              fontSize: 15,
              fontFamily: FONTS.sans,
              color: authT.textOnDark,
              backgroundColor: "transparent",
              paddingVertical: 0,
              paddingHorizontal: 0,
              margin: 0,
            },
            listView: {
              // Dropdown matches the dark auth form aesthetic instead of
              // appearing as a jarring white card. Slightly elevated tone
              // (rgba(255,255,255,0.04) over the dark bg) to read as a panel.
              position: "absolute",
              top: 50,
              left: -38,
              right: -14,
              maxHeight: 220, // ~4 results — keeps it visible above keyboard
              backgroundColor: "#171717",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: alpha(authT.textOnDark, 0.1),
              overflow: "hidden",
              zIndex: 9999,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOpacity: 0.5,
                  shadowRadius: 24,
                  shadowOffset: { width: 0, height: 8 },
                },
                android: { elevation: 24 },
              }),
            },
            row: {
              backgroundColor: "transparent",
              paddingVertical: 14,
              paddingHorizontal: 18,
              minHeight: 48,
            },
            description: {
              fontSize: 14,
              fontFamily: FONTS.sans,
              color: authT.textOnDark,
            },
            predefinedPlacesDescription: {
              color: alpha(authT.textOnDark, 0.5),
            },
            separator: {
              backgroundColor: alpha(authT.textOnDark, 0.06),
              height: 1,
            },
            poweredContainer: { display: "none" },
          }}
        />
      </View>

      <TouchableOpacity
        onPress={switchToManual}
        style={s.manualLinkRow}
        activeOpacity={0.7}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("auth.address_manual_a11y")}
      >
        <Feather name="edit-3" size={11} color={alpha(authT.textOnLight, 0.55)} />
        <Text style={s.manualLink}>{t("auth.address_manual_link")}</Text>
      </TouchableOpacity>

      {effectiveError ? (
        <View style={s.errorRow}>
          <Feather name="alert-circle" size={12} color="#DC2626" />
          <Text style={s.errorText}>{effectiveError}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    width: "100%",
    zIndex: 10,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    letterSpacing: 1.8,
    color: alpha(authT.textOnLight, 0.55),
    marginBottom: 6,
    textTransform: "uppercase",
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: alpha(authT.dark, 0.7),
    borderWidth: 1,
    borderColor: alpha(authT.textOnDark, 0.14),
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 46,
    overflow: "visible",
  },
  fieldFocused: {
    backgroundColor: alpha(authT.dark, 0.92),
    borderColor: alpha(authT.textOnDark, 0.4),
  },
  fieldError: {
    borderColor: "#DC2626",
  },
  icon: {
    marginRight: 10,
  },
  // Saisie manuelle
  manualRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  manualPostal: { flex: 1 },
  manualCity: { flex: 1.6 },
  manualLinkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  manualLink: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: alpha(authT.textOnLight, 0.6),
    textDecorationLine: "underline",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: "#DC2626",
  },
});
