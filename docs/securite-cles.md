# Clés embarquées dans l'app — à restreindre

Ces clés sont **publiques par nature** : elles finissent dans le binaire de
l'app, n'importe qui peut les extraire. Les sortir du dépôt ne protège donc
rien ; ce qui protège, c'est de **restreindre** chaque clé à FIXED. Sans
restriction, quelqu'un peut consommer le quota Google Maps sur ta facture.

| Clé | Où | Sert à |
|---|---|---|
| `AIzaSyCX2…` (Google Maps) | `app.json` (`android.config.googleMaps.apiKey`), `eas.json` (`EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`) | Carte Android, itinéraires et ETA (`lib/mission/route.ts`), autocomplétion d'adresse |
| `AIzaSyDhR…` (Firebase) | `google-services.json` | Notifications push Android |
| `pk_live_…` (Stripe) | `eas.json` | Paiements — clé *publishable* : conçue pour être publique, rien à faire |

## Google Cloud Console → APIs et services → Identifiants

### Clé Google Maps (`AIzaSyCX2…`)

Elle sert à la fois au SDK Android **et** à des appels HTTP depuis le
téléphone (Directions, Places). Une restriction « applications Android »
bloquerait ces appels HTTP. Le plus propre : **deux clés**.

1. **Clé A — SDK Android** : restriction d'application *Applications Android*,
   package `app.thefixed.client` + empreinte SHA-1 du certificat de signature
   (EAS → `eas credentials` → Android → Keystore). Restriction d'API : *Maps SDK
   for Android* uniquement. → la mettre dans `app.json`.
2. **Clé B — appels web depuis l'app** : restriction d'API : *Directions API*,
   *Places API* (et *Geocoding API* si utilisée) uniquement ; quota journalier
   plafonné (ex. 5 000 requêtes/jour) et alerte de facturation. → la mettre
   dans `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` (`eas.json`).

Ensuite : régénérer l'ancienne clé `AIzaSyCX2…` (elle est dans l'historique
git, donc à considérer comme connue).

### Clé Firebase (`AIzaSyDhR…`)

Restriction d'application *Applications Android* (`app.thefixed.client` +
SHA-1) et restriction d'API aux API Firebase utilisées (Firebase Installations,
FCM). Elle est faite pour vivre dans `google-services.json`.

## Après chaque changement

Rebuild EAS (les clés natives sont lues au build), puis vérifier : carte,
itinéraire d'un prestataire, autocomplétion d'adresse, réception d'une
notification push.
