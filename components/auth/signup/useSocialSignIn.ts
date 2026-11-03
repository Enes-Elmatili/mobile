// components/auth/signup/useSocialSignIn.ts — inscription Apple / Google du signup
// Extrait de app/(auth)/signup.tsx tel quel. L'ordre des effets est conservé :
// ce hook est appelé à l'endroit où vivait ce code (après l'état de phase), et
// l'effet qui réagit à la réponse OAuth suit toujours ceux de la requête Google.
import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { feedback } from "@/lib/feedback/feedback";
import { api } from "@/lib/api";
import type { AuthResponse, Role } from '@/lib/types';
import { GOOGLE_AUTH_CONFIG } from "@/lib/googleAuth";
import { useGoogleAuthDiagnostic } from "@/lib/useGoogleAuthDiagnostic";
import { useAuth } from "@/lib/auth/AuthContext";
import { isSocialCancel, socialConflictMessage } from "@/lib/auth/signupForm";
import type { SocialProvider } from "./SignupSocialRow";

type ToastType = "success" | "error" | "info";

const showToast = (message: string, type: ToastType = "error") => {
  feedback.toast(message, type);
};

/** @param roleIntentKey clé AsyncStorage du rôle choisi à role-select (déclarée dans signup.tsx). */
export function useSocialSignIn(roleIntentKey: string) {
  const router = useRouter();
  const { refreshMe, signIn } = useAuth();
  const { t } = useTranslation();

  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);

  // Google Auth — native PKCE auth-code flow via the Expo Google provider.
  // Config partagée dans lib/googleAuth : sur iOS le redirect doit être le
  // scheme reverse-client-id, le défaut du provider (bundle ID) est refusé
  // par Google avec redirect_uri_mismatch.
  const [googleRequest, googleResponse, googlePromptAsync] =
    Google.useAuthRequest(GOOGLE_AUTH_CONFIG);
  // Pourquoi Google est indisponible, le cas échéant — la librairie, elle, ne
  // dit jamais rien (cf. lib/useGoogleAuthDiagnostic.ts).
  const googleUnavailable = useGoogleAuthDiagnostic(googleRequest);

  // ── Routage post-authentification sociale ──────────────────────────────────
  // Le rôle choisi à l'étape 1 (role-select) est mémorisé dans AsyncStorage.
  // Faute de le relire ici, une inscription sociale repartait de zéro : le
  // backend ne pose AUCUN rôle sur un compte social, l'app renvoyait donc sur
  // role-select et le prestataire devait re-choisir ce qu'il venait de choisir.
  const routeAfterSocial = async (res: AuthResponse) => {
    let payload: AuthResponse = res;
    let roles: Role[] = res?.roles ?? [];

    if (roles.length === 0) {
      const intent = await AsyncStorage.getItem(roleIntentKey).catch(() => null);
      if (intent !== "PROVIDER" && intent !== "CLIENT") {
        router.replace("/(auth)/role-select");
        return;
      }
      try {
        const assigned = await api.auth.assignRole(intent);
        if (assigned?.token) {
          await signIn(assigned.token, assigned.missingFields ?? []);
          await refreshMe();
        }
        roles = assigned?.roles ?? [intent];
        payload = { ...res, ...assigned, roles };
      } catch {
        // Attribution impossible → écran de choix, mais pré-sélectionné : on ne
        // fait pas repartir le prestataire d'une page blanche.
        router.replace({ pathname: "/(auth)/role-select", params: { role: intent } });
        return;
      }
    }

    // Coordonnées de facturation manquantes (cas normal en social : Apple et
    // Google ne fournissent ni téléphone ni adresse).
    if (payload?.profileIncomplete) {
      router.replace({
        pathname: "/(auth)/complete-profile",
        params: { missingFields: (payload.missingFields ?? []).join(",") },
      });
      return;
    }

    if (roles.includes("PROVIDER")) {
      router.replace("/onboarding/activity");
      return;
    }
    router.replace("/(tabs)/dashboard");
  };


  // Le bouton reste actif même si la requête n'est pas prête : un appui doit
  // toujours produire une réponse. Sans ça, un échec de construction rendait le
  // bouton totalement inerte — ni navigateur, ni message, ni log.
  const handleGooglePress = () => {
    if (googleRequest) {
      googlePromptAsync();
      return;
    }
    if (googleUnavailable) {
      showToast(t('auth.google_unavailable', { reason: googleUnavailable }));
      return;
    }
    showToast(t('auth.google_preparing'), 'info');
  };

  const handleGoogleSignIn = async (tokens: { idToken?: string; accessToken?: string }) => {
    setSocialLoading("google");
    try {
      const res = await api.auth.google(tokens);
      if (!res?.token) throw new Error();
      await signIn(res.token, res.missingFields ?? []);
      await refreshMe();
      await routeAfterSocial(res);
    } catch (e: unknown) {
      const conflict = socialConflictMessage(e);
      // 409 : message serveur tel quel (peut être vide, comme avant)
      if (conflict) showToast(conflict.message as string);
      else showToast(t('auth.su_err_social'));
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading("apple");
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      const res = await api.auth.apple(
        credential.identityToken!,
        credential.fullName
          ? {
              givenName: credential.fullName.givenName ?? undefined,
              familyName: credential.fullName.familyName ?? undefined,
            }
          : undefined,
        credential.email ?? undefined
      );
      if (!res?.token) throw new Error();
      await signIn(res.token, res.missingFields ?? []);
      await refreshMe();
      await routeAfterSocial(res);
    } catch (e: unknown) {
      const conflict = socialConflictMessage(e);
      if (isSocialCancel(e)) {
        // silent cancel
      } else if (conflict) showToast(conflict.message as string);
      else showToast(t('auth.su_err_social'));
    } finally {
      setSocialLoading(null);
    }
  };

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.authentication?.idToken ?? googleResponse.params?.id_token;
      const accessToken = googleResponse.authentication?.accessToken ?? googleResponse.params?.access_token;
      if (idToken || accessToken) handleGoogleSignIn({ idToken, accessToken });
    } else if (googleResponse.type === "error") {
      // Échec OAuth Google — sans ce feedback le bouton redevenait juste actif
      showToast(t('auth.su_err_social'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- réagit à la réponse OAuth seulement
  }, [googleResponse]);

  return { socialLoading, handleGooglePress, handleAppleSignIn };
}
