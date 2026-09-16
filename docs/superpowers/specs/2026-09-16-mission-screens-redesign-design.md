# Refonte des écrans de mission (client et prestataire)

Date : 16/09/2026 · Validé par Enès (« Applique la recommandation ») · Planches : artefacts « Refonte du suivi » et « Refonte de la mission prestataire ».

## Socle partagé (`components/tracking`, `lib/mission`)

- **`StageSheet`** : feuille gorhom à paliers (`peek` 24 % · `half` 54 % · `full` 90 % · `page`), configurée par `useSheetMotion` (ressort critique, élastique, haptique au palier, velocity handoff). Le stade impose un palier, l'utilisateur tire librement. Le pied (`footer`) reste collé en bas. `onHeightChange` rembourre la carte.
- **`useMapCamera`** : un seul pilote de caméra — `search` (adresse + quatre prestataires les plus proches, garde-fou 40 km), `follow` / `me` (deux points, cadrés au-dessus de la feuille), `door` (0,004), `band` (0,006), `none`.
- **`providerStageOf`** (`lib/mission/providerStage.ts`) : `en_route → on_site → code → (quote_write | quote_wait) → working → closing → done | gone`, faits : rayon 60 m ou « je suis arrivé », photo avant, code vérifié, photo après, devis.
- Blocs : `TimerHero` (mm:ss en rouleau), `Rail` (chronologie à points), `PhotoCard` (photo pleine largeur, étiquette mono, emplacement vide), `Cta` (56 pt, accent / vert / fantôme), `AccessChips` (puces mono + note du client), `NetLine` (net au taux figé sur la mission), `CodeEntry` (quatre cases, champ invisible), `ProviderRow` (avec `meta` pour un client).

## Client (`missionview.tsx`)

Une carte, une feuille qu'on tient. Marqueur prestataire avec avatar 40 pt et bulle de minutes (atterrit sur `MOTION.land`). En cours : kicker « {Prénom} · chez vous · depuis hh:mm », chrono, prestataire, rail, photos avant / après en cartes, montant, demande. Terminé : la feuille disparaît, le bilan (`DoneContent`) monte depuis le bas sur la même page.

## Prestataire (`ongoing.tsx`, réécrit)

Une action en pied par stade : Itinéraire (+ « Je suis arrivé ») → Prendre la photo avant → Vérifier le code (+ appeler) → Rédiger le devis / attendre → Photo après → Terminer (vert, éteint tant que la photo après manque). Feuille : minutes en héros, adresse + prestation + puces d'accès + note, client (message avec non-lus, appel), photos du problème, net au taux figé ; sur place : bande « Vous y êtes » sur la carte réduite ; intervention : chrono depuis `startedAt`, fin prévue, rail, cartes avant / après. GPS honnête : `LIVE GPS` / `GPS PERDU` (30 s sans position) / `GPS REFUSÉ`. Erreurs photo traduites par code, vignette retirée en cas d'échec.

## Règles serveur inchangées

Photo avant (ACCEPTED) → code (3 essais, 4 h, 10/min) → intervention → photo après (ONGOING) → clôture (photo après obligatoire). Abandon : confirmation destructive, attente serveur, retry. Chemin argent intouché. Aucun changement serveur.

## Non fait, à dessein

- Luminosité maximale à la porte : demanderait `expo-brightness` (nouvelle dépendance native) ; à décider.
- File d'attente hors-ligne des photos : l'envoi échoue proprement (vignette retirée, message traduit) ; pas de renvoi automatique.
- Cap (orientation) du marqueur prestataire : les positions arrivent toutes les 10 s / 30 m, un cap serait bruité.
