import { Platform } from "react-native";

// Google n'accepte que le scheme "reverse client ID" comme redirect pour les
// clients OAuth de type iOS — le défaut d'expo-auth-session (bundle ID,
// app.thefixed.client:/oauthredirect) est refusé avec redirect_uri_mismatch.
// Android n'est pas concerné : les clients OAuth Android attendent bien le
// scheme package (<package>:/oauthredirect), le défaut du provider.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const iosRedirectUri =
  Platform.OS === "ios" && IOS_CLIENT_ID
    ? `com.googleusercontent.apps.${IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "")}:/oauthredirect`
    : undefined;

export const GOOGLE_AUTH_CONFIG = {
  iosClientId: IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || undefined,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  scopes: ["openid", "profile", "email"],
  ...(iosRedirectUri ? { redirectUri: iosRedirectUri } : {}),
};
