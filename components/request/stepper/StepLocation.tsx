// components/request/stepper/StepLocation.tsx
// Étape 1 — Lieu : carte plein écran, recherche Google Places, adresses
// enregistrées, avertissements zone / numéro de rue, CTA flottant.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import MapView from 'react-native-maps';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin } from '@/components/map/MapPin';
import { DotPin } from '@/components/map/pins';
import { StepCTA } from '@/components/request/StepCTA';
import { PressScale } from '@/components/ui/PressScale';
import { feedback } from '@/lib/feedback/feedback';
import { FONTS, COLORS } from '@/hooks/use-app-theme';
import { MAP_PROVIDER, mapAppearance } from '@/lib/map/appearance';
import { addressHasStreetNumber, checkLocation } from '@/lib/request/zone';
import { canSaveAddress, savedAddressIcon } from '@/lib/request/catalog';
import type { SavedAddress, StepperLocation } from '@/lib/request/stepperTypes';
import type { StepperTheme } from './useStepperTheme';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

const DEFAULT_REGION = {
  latitude:      50.8503,
  longitude:     4.3517,
  latitudeDelta: 0.015,
  longitudeDelta: 0.0121,
};

type Props = {
  theme: StepperTheme;
  mapRef: React.RefObject<MapView | null>;
  location: StepperLocation | null;
  setLocation: (loc: StepperLocation) => void;
  locationAllowed: boolean;
  setLocationAllowed: (allowed: boolean) => void;
  addressMissingNumber: boolean;
  setAddressMissingNumber: (missing: boolean) => void;
  savedAddresses: SavedAddress[];
  showAddrDropdown: boolean;
  setShowAddrDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenSaveSheet: () => void;
  onNext: () => void;
};

export function StepLocation({
  theme, mapRef, location, setLocation, locationAllowed, setLocationAllowed,
  addressMissingNumber, setAddressMissingNumber, savedAddresses, showAddrDropdown,
  setShowAddrDropdown, onOpenSaveSheet, onNext,
}: Props) {
  const { t } = useTranslation();
  return (
    <View style={s.flex}>
      <MapView
        ref={mapRef}
        provider={MAP_PROVIDER}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        {...mapAppearance(theme.isDark)}
        showsUserLocation
        showsMyLocationButton={false}
        showsPointsOfInterests={false}
        showsBuildings={false}
      >
        {location && (
          <MapPin coordinate={{ latitude: location.lat, longitude: location.lng }}>
            <DotPin size={16} color={COLORS.greenBrand} />
          </MapPin>
        )}
      </MapView>

      {/* Barre de recherche flottante */}
      <View style={s.searchFloat}>
        <View style={[s.searchBox, { backgroundColor: theme.searchBoxBg }]}>
          <Feather name="search" size={18} color={theme.textSub as string} />
          <GooglePlacesAutocomplete
            placeholder={t('stepper.enter_address')}
            fetchDetails
            onPress={(data, details = null) => {
              if (details) {
                const { lat, lng } = details.geometry.location;
                const allowed = checkLocation(data.description, details.address_components);
                const hasStreetNumber = addressHasStreetNumber(details.address_components);
                setLocation({ address: data.description, lat, lng });
                setLocationAllowed(allowed);
                setAddressMissingNumber(!hasStreetNumber);
                mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                feedback.haptic(allowed && hasStreetNumber ? 'success' : 'error');
              }
            }}
            query={{ key: GOOGLE_MAPS_API_KEY, language: 'fr', components: 'country:be', location: '50.8333,4.3333', radius: 15000, strictbounds: true }}
            styles={{
              container:          { flex: 1, marginLeft: 8, overflow: 'visible', zIndex: 999 },
              textInputContainer: { backgroundColor: 'transparent' },
              textInput: {
                height:          36,
                fontSize:        15,
                fontFamily:      FONTS.sansMedium,
                color:           theme.text as string,
                backgroundColor: 'transparent',
                padding:         0,
                margin:          0,
              },
              listView: {
                position:      'absolute',
                top:           54,
                left:          -42,
                right:         -16,
                backgroundColor: theme.dropdownBg as string,
                borderRadius:  20,
                shadowColor:   '#000',
                shadowOpacity: 0.15,
                shadowRadius:  24,
                shadowOffset:  { width: 0, height: 8 },
                elevation:     20,
                zIndex:        999,
              },
              row:         { backgroundColor: theme.dropdownRow as string, paddingVertical: 14, paddingHorizontal: 18 },
              description: { fontSize: 14, color: theme.text as string, fontFamily: FONTS.sans },
              separator:   { backgroundColor: theme.dropdownSep as string, height: 1 },
            }}
            textInputProps={{
              testID: 'stepper-address-input',
              placeholderTextColor: theme.textPlaceholder as string,
              onFocus: () => setShowAddrDropdown(false),
            }}
            enablePoweredByContainer={false}
            listViewDisplayed="auto"
            keyboardShouldPersistTaps="handled"
          />
          {/* Saved addresses / save actions */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0 }}>
            {savedAddresses.length > 0 && (
              <PressScale
                testID="stepper-saved-addresses"
                onPress={() => setShowAddrDropdown(prev => !prev)}
                style={{ padding: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('stepper.saved_addresses_a11y')}
                accessibilityState={{ expanded: showAddrDropdown }}
              >
                <Feather name="bookmark" size={18} color={showAddrDropdown ? (theme.text as string) : (theme.textMuted as string)} />
              </PressScale>
            )}
            {savedAddresses.length > 0 && canSaveAddress(savedAddresses, location) && (
              <View style={{ width: 1, height: 16, backgroundColor: theme.sep as string, marginHorizontal: 2 }} />
            )}
            {canSaveAddress(savedAddresses, location) && (
              <PressScale
                onPress={onOpenSaveSheet}
                style={{ padding: 8 }}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
              >
                <Feather name="plus-circle" size={18} color={theme.textMuted as string} />
              </PressScale>
            )}
          </View>
        </View>

        {/* Saved addresses dropdown */}
        {showAddrDropdown && savedAddresses.length > 0 && (
          <View style={{
            position: 'absolute', top: 62, left: 0, right: 0, zIndex: 60,
            backgroundColor: theme.dropdownBg as string,
            borderRadius: 16, overflow: 'hidden',
            borderWidth: 1, borderColor: theme.surfaceBorder as string,
            shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
          }}>
            {savedAddresses.map((addr, i) => {
              const icon = savedAddressIcon(addr.label);
              return (
                <PressScale accessibilityRole="button"
                  key={addr.id}
                  testID={`stepper-saved-address-${i}`}
                  onPress={() => {
                    setLocation({ address: addr.address, lat: addr.lat, lng: addr.lng });
                    setLocationAllowed(checkLocation(addr.address));
                    setAddressMissingNumber(false);
                    setShowAddrDropdown(false);
                    mapRef.current?.animateToRegion({ latitude: addr.lat, longitude: addr.lng, latitudeDelta: 0.006, longitudeDelta: 0.006 });
                    feedback.haptic('light');
                  }}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderBottomWidth: i < savedAddresses.length - 1 ? 1 : 0,
                    borderBottomColor: theme.dropdownSep as string,
                  }}
                >
                  <Feather name={icon} size={16} color={theme.textMuted as string} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.sansMedium, fontSize: 14, color: theme.text as string }}>{addr.label}</Text>
                    <Text style={{ fontFamily: FONTS.sans, fontSize: 12, color: theme.textMuted as string, marginTop: 1 }} numberOfLines={1}>{addr.address}</Text>
                  </View>
                </PressScale>
              );
            })}
          </View>
        )}

        {location && !locationAllowed && (
          <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
            <Feather name="alert-triangle" size={16} color={COLORS.orangeBrand} />
            <Text style={[s.addrText, { color: COLORS.orangeBrand, flex: 1 }]} numberOfLines={2}>
              {t('stepper.zone_notice')}
            </Text>
          </View>
        )}
        {location && addressMissingNumber && (
          <View style={[s.addrConfirm, { backgroundColor: 'rgba(232,120,58,0.12)', marginTop: 6 }]}>
            <Feather name="alert-circle" size={16} color={COLORS.orangeBrand} />
            <Text style={[s.addrText, { color: COLORS.orangeBrand, flex: 1 }]} numberOfLines={2}>
              {t('ext.stepper_addr_missing_number')}
            </Text>
          </View>
        )}
      </View>

      <LinearGradient
        colors={[`${theme.bg}00`, theme.bg as string, theme.bg as string]}
        locations={[0, 0.35, 1]}
        style={s.ctaFloating}
        pointerEvents="box-none"
      >
        <StepCTA
          testID="stepper-next-location"
          floating
          label={t('stepper.confirm_address')}
          onPress={onNext}
          disabled={!location || !locationAllowed || addressMissingNumber}
          hint={!location ? t('stepper.select_address') : undefined}
          style={{ paddingHorizontal: 0, paddingTop: 0, paddingBottom: 0 }}
        />
      </LinearGradient>

    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  searchFloat: { position: 'absolute', top: 16, left: 16, right: 16, zIndex: 10, gap: 8, overflow: 'visible' },
  searchBox:   { flexDirection: 'row', alignItems: 'center', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 2, minHeight: 28, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3, overflow: 'visible', zIndex: 999 },
  addrConfirm: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  addrText:    { flex: 1, fontSize: 13, fontFamily: FONTS.sansMedium },
  ctaFloating: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5, paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 },
});
