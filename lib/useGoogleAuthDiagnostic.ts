// lib/useGoogleAuthDiagnostic.ts
// ─────────────────────────────────────────────────────────────────────────────
// Un bouton d'authentification ne doit jamais mourir en silence.
//
// `Google.useAuthRequest` renvoie `null` tant que la requête OAuth n'est pas
// construite — et **pour toujours** si sa construction échoue, puisque
// expo-auth-session enchaîne `makeAuthUrlAsync().then(...)` sans `.catch()`.
// Les écrans désactivaient alors le bouton (`disabled={!googleRequest}`) : plus
// aucun retour visuel, aucune erreur, aucun log. Impossible à diagnostiquer
// sans démonter l'APK, ce qu'il a fallu faire le 30/08/2026.
//
// Ce hook rejoue la construction en parallèle pour récupérer l'erreur réelle.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import * as Sentry from "@sentry/react-native";
import { diagnoseGoogleAuth } from "./googleAuth";

/** Délai laissé à la librairie avant de conclure à un échec (elle est asynchrone). */
const GRACE_MS = 2500;

/**
 * @param googleRequest la requête renvoyée par `Google.useAuthRequest`
 * @returns un message d'erreur si Google est indisponible, sinon `null`
 */
export function useGoogleAuthDiagnostic(googleRequest: unknown): string | null {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (googleRequest) {
      setError(null);
      return;
    }
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (cancelled) return;
      const res = await diagnoseGoogleAuth();
      if (cancelled) return;

      if (res.ok) {
        // La construction passe de notre côté mais la librairie n'a toujours
        // rien remonté : l'échec est ailleurs dans son propre chemin.
        const msg = "requête indisponible (construction pourtant valide)";
        setError(msg);
        Sentry.captureMessage(`Google sign-in : ${msg}`, {
          level: "error",
          tags: { flow: "google-signin", step: "library" },
          extra: { platform: Platform.OS },
        });
        return;
      }

      setError(`${res.step} — ${res.message}`);
      Sentry.captureMessage(`Google sign-in indisponible (${res.step})`, {
        level: "error",
        tags: { flow: "google-signin", step: res.step },
        extra: { platform: Platform.OS, message: res.message },
      });
    }, GRACE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [googleRequest]);

  return error;
}
