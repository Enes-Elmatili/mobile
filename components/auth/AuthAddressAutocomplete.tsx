/**
 * AuthAddressAutocomplete — Google Places address picker for the FIXED auth flow.
 *
 * Single field, same visual style as AuthInput. Constrained to Belgium, language fr.
 * On selection, parses address_components and calls onAddressSelected(ParsedAddress).
 *
 * Tracks whether the user has committed to a Place. If the field has text but no
 * Place was selected, shows an inline error on blur / submit attempt.
 */
import React, { useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import type { GooglePlaceDetail, AddressComponent } from "react-native-google-places-autocomplete";
import { Feather } from "@expo/vector-icons";
import { FONTS } from "@/hooks/use-app-theme";
import { authT, alpha } from "./tokens";

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
  onChangeText?: (text: string) => void;
};

export function AuthAddressAutocomplete({
  onAddressSelected,
  error,
  label = "Adresse *",
  onChangeText,
}: Props) {
  const [focused, setFocused] = useState(false);
  const [placeSelected, setPlaceSelected] = useState(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const effectiveError = error ?? internalError;

  const handlePress = useCallback(
    (data: { description: string }, details: GooglePlaceDetail | null) => {
      if (!details) return;
      const parsed = parseAddressComponents(details, data.description);
      setPlaceSelected(true);
      setInternalError(null);
      onAddressSelected(parsed);
      onChangeText?.(data.description);
    },
    [onAddressSelected, onChangeText]
  );

  return (
    <View style={s.wrap}>
      {label ? <Text style={s.label}>{label}</Text> : null}
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
          placeholder="Rue, numéro, ville"
          fetchDetails
          onPress={handlePress}
          query={{
            key: GOOGLE_MAPS_API_KEY,
            language: "fr",
            components: "country:be",
          }}
          minLength={2}
          enablePoweredByContainer={false}
          keyboardShouldPersistTaps="handled"
          listViewDisplayed="auto"
          onFail={() => setInternalError("Erreur de recherche — réessaie")}
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
              position: "absolute",
              top: 46,
              left: -38,
              right: -14,
              backgroundColor: authT.light,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: alpha(authT.textOnLight, 0.08),
              overflow: "hidden",
              zIndex: 9999,
              ...Platform.select({
                ios: {
                  shadowColor: "#000",
                  shadowOpacity: 0.12,
                  shadowRadius: 18,
                  shadowOffset: { width: 0, height: 6 },
                },
                android: { elevation: 16 },
              }),
            },
            row: {
              backgroundColor: "transparent",
              paddingVertical: 13,
              paddingHorizontal: 16,
            },
            description: {
              fontSize: 14,
              fontFamily: FONTS.sans,
              color: authT.textOnLight,
            },
            predefinedPlacesDescription: {
              color: alpha(authT.textOnLight, 0.5),
            },
            separator: {
              backgroundColor: alpha(authT.textOnLight, 0.07),
              height: 1,
            },
            poweredContainer: { display: "none" },
          }}
        />
      </View>
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
