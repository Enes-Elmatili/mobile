import { Platform } from "react-native";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import { discovery as googleDiscovery } from "expo-auth-session/providers/google";

// Google n'accepte que le scheme "reverse client ID" comme redirect pour les
// clients OAuth de type iOS — le défaut d'expo-auth-session (bundle ID,
// app.thefixed.client:/oauthredirect) est refusé avec redirect_uri_mismatch.
// Android n'est pas concerné : les clients OAuth Android attendent bien le
// scheme package (<package>:/oauthredirect), le défaut du provider.
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

const iosRedirectUri =
  Platform.OS === "ios" && IOS_CLIENT_ID
    ? `com.googleusercontent.apps.${IOS_CLIENT_ID.replace(".apps.googleusercontent.com", "")}:/oauthredirect`
    : undefined;

// Android : on fournit le redirect EXPLICITEMENT au lieu de laisser la
// librairie le déduire via `makeRedirectUri` + `expo-application`. Deux raisons.
// D'abord ça supprime la dernière asymétrie iOS/Android du flux — iOS passait
// déjà son redirect en dur, Android était le seul à dépendre d'un module
// natif tiers pour une valeur qu'on connaît. Ensuite cette valeur est celle
// que Google accepte, vérifiée contre son endpoint d'autorisation le
// 30/08/2026 (un paquet différent y répond `redirect_uri_mismatch`).
const androidPackage =
  Constants.expoConfig?.android?.package ?? "app.thefixed.client";
const androidRedirectUri =
  Platform.OS === "android" ? `${androidPackage}:/oauthredirect` : undefined;

const redirectUri = iosRedirectUri ?? androidRedirectUri;

/** Client OAuth effectivement utilisé sur cette plateforme. */
export const GOOGLE_CLIENT_ID =
  (Platform.select({
    ios: IOS_CLIENT_ID,
    android: ANDROID_CLIENT_ID,
    default: WEB_CLIENT_ID,
  }) ?? WEB_CLIENT_ID) || undefined;

export const GOOGLE_SCOPES = ["openid", "profile", "email"];

export const GOOGLE_AUTH_CONFIG = {
  iosClientId: IOS_CLIENT_ID,
  androidClientId: ANDROID_CLIENT_ID || undefined,
  webClientId: WEB_CLIENT_ID,
  clientId: WEB_CLIENT_ID,
  scopes: GOOGLE_SCOPES,
  ...(redirectUri ? { redirectUri } : {}),
};

export type GoogleDiag =
  | { ok: true }
  | { ok: false; step: "clientId" | "redirectUri" | "pkce"; message: string };

/**
 * Diagnostic de la construction de la requête OAuth.
 *
 * `useAuthRequest` d'expo-auth-session appelle `makeAuthUrlAsync().then(...)`
 * **sans `.catch()`** (AuthRequestHooks.js). Si la construction échoue, la
 * promesse part en rejet non capturé : `request` reste `null` pour toujours,
 * l'écran ne reçoit aucun signal, et le bouton demeure désactivé — sans
 * erreur, sans toast, sans une ligne de log. C'est le bug observé sur Android
 * le 30/08/2026 : appui maintenu sans le moindre changement de pixel, zéro
 * activité lancée, zéro exception sur 32 000 lignes de logcat.
 *
 * On refait donc le même travail en parallèle, uniquement pour capturer
 * l'erreur et pouvoir la nommer. Chaque étape est isolée pour que le message
 * dise LAQUELLE a cédé.
 */
export async function diagnoseGoogleAuth(): Promise<GoogleDiag> {
  let step: "clientId" | "redirectUri" | "pkce" = "clientId";
  try {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error(`aucun client ID Google pour ${Platform.OS}`);
    }

    step = "redirectUri";
    const uri =
      redirectUri ??
      AuthSession.makeRedirectUri({ native: `${androidPackage}:/oauthredirect` });
    if (!uri) throw new Error("redirectUri vide");

    // PKCE : c'est ici que passe expo-crypto (getRandomValues + digest SHA-256).
    // Aucun appel réseau — loadAsync ne fait que construire l'URL.
    step = "pkce";
    await AuthSession.loadAsync(
      {
        clientId,
        redirectUri: uri,
        scopes: GOOGLE_SCOPES,
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
      },
      googleDiscovery,
    );

    return { ok: true };
  } catch (e: any) {
    return { ok: false, step, message: e?.message ? String(e.message) : String(e) };
  }
}
