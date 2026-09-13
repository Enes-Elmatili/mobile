# Refonte du stepper de demande — design

Date : 13/09/2026. Choix validés sur les planches (artifact « Planches du stepper ») : **1A, 2A, 3A, 4A**, avec deux amendements d'Enès : pas de montants à l'étape Service (on garde les pastilles « Prix fixe » / « Sur devis »), et le sélecteur de catégories doit accueillir les services qui s'ouvriront plus tard.

## 1. Thèse

Le stepper (`app/request/NewRequestStepper.tsx`, 2 932 lignes) fonctionne mais sa grammaire visuelle est celle d'un assistant générique : trois couches de progression avant le contenu, une liste de prestations qui dévoile ses choix en dépliant la page, un planning en blocs hétérogènes, un bouton en relief sur une charte plate. La refonte remplace ces quatre éléments par des composants extraits, chacun avec une seule responsabilité, et donne au passage d'étape une direction physique. Le contenu métier (états, appels API, paiement, promo, TVA, infos d'accès) ne change pas.

## 2. Périmètre

**Dedans** : en-tête et ligne de progression, transition entre étapes, étape 2 (catégories et prestations), étape 3 (mode, semaine, grille horaire, urgence), bouton principal des quatre étapes, largeur de lecture sur écran regular pour les étapes 2 et 3.

**Dehors** : étape 1 (carte et adresse), étape 4 (récap, carte MONTANT, promo, paiement) hors son bouton, la question TVA et le panneau « Infos d'accès » (conservés tels quels, seulement re-rangés sous des lignes standard), le filtre des catégories ouvertes (`LAUNCH_SLUGS` reste ; le rail est prêt pour N catégories).

## 3. Composants

Tout ce qui suit sort de `NewRequestStepper.tsx` vers `components/request/`. Chaque composant est autonome, typé, sans accès aux states du stepper : il reçoit des props et rend des callbacks.

### 3.1 `StepHeader`
Ligne 1 : bouton retour (36 pt, `theme.surface`). Ligne 2 : titre de l'étape en **Bebas 34** (« Lieu », « Service », « Planning », « Validation », clés `step{n}_label` existantes) et compteur mono 11 `2 / 4` aligné à droite sur la même ligne de base. Ligne 3 : **ligne de progression** 2 pt pleine largeur, `theme.border` en fond, `theme.accent` en remplissage ; largeur = `step / TOTAL_STEPS`, animée par une shared value sur `MOTION.pane` (reduce-motion : `withTiming` 120 ms). Ligne 4, optionnelle : `StepCrumbs`. Puis la bannière « prestataire préféré » existante, inchangée.

Supprimés : `StepIndicator` (pastilles + segments), `LiveSummary`, le compteur « ÉTAPE 2 / 4 » centré.

### 3.2 `StepCrumbs`
Une rangée de puces (`theme.surface`, coche verte 12 pt, texte 12 `textSub`) pour les décisions déjà prises : adresse (dès l'étape 2), prestation (dès l'étape 3). Comme aujourd'hui, rien à l'étape 4 (le récap prend le relais) ni à l'étape 1. Une puce est touchable : elle ramène à son étape (`onJump(step)`), en arrière seulement. Dérivation pure : `deriveCrumbs({ step, address, serviceName })` dans `lib/request/crumbs.ts`, testée.

### 3.3 `StepPager` (transition)
Le contenu de l'étape courante est rendu dans une `Animated.View` de Reanimated avec `key={step}` et des animations de layout : `SlideInRight` / `SlideOutLeft` en avançant, `SlideInLeft` / `SlideOutRight` en reculant, `.springify()` sur les constantes de `MOTION.pane` (damping, stiffness, mass). La direction vient d'une ref mise à jour avant `setStep`. Reduce-motion : `FadeIn` / `FadeOut` 150 ms. `animateStep` et son `setTimeout(cb, 100)` disparaissent : `setStep` est immédiat, c'est l'animation de layout qui sépare sortant et entrant. La ligne de progression avance sur le même ressort, au même instant.

Limite assumée : une animation de layout ne se rattrape pas au doigt (règle 1) ; un changement d'étape est un évènement discret, pas un geste, et un second tap pendant la transition démarre simplement la suivante.

### 3.4 `CategoryRail` (étape 2)
Une rangée horizontale de pilules (`ScrollView` horizontal, `showsHorizontalScrollIndicator` faux). Jusqu'à trois catégories, les pilules se partagent la largeur (aspect segmenté) ; au-delà, elles prennent la largeur de leur libellé et la rangée défile avec un fondu sur le bord droit. Pilule active : `theme.accent` / `accentText` ; inactive : `theme.surface` / `textSub`. Appui : `usePressScale`. Changement : `feedback.haptic('selection')`, la liste en dessous est poussée latéralement (même mécanique que `StepPager`, clé = id de catégorie, direction = ordre des index). Aucune catégorie n'est estompée.

### 3.5 `ServiceRow` (étape 2)
Une ligne par prestation : nom (15 medium), description sur une ligne (12,5 `textSub`, depuis `subcategory.description` quand elle n'est pas vide), à droite la **pastille** « Prix fixe » (vert, `rgba(21,193,110,.15)`) ou « Sur devis » (ambre), puis un **radio** 22 pt (bord `theme.border` ; sélectionné : fond `theme.accent`, coche `accentText`, arrivée sur `MOTION.take`). Sélectionnée : fond `theme.surfaceAlt`. Les autres lignes gardent leur opacité. Appui : `usePressScale(0.98)`, haptique `selection`.

Décision d'Enès : **aucun montant à cette étape**. La ligne « dès X € » de l'en-tête disparaît ; le prix apparaît à l'étape 4, comme aujourd'hui. Le texte « Choisissez une prestation » quitte l'en-tête de liste et devient l'indication du bouton (§ 3.9). Le défilement automatique vers la catégorie touchée est supprimé (le rail est fixe en haut, la liste commence au sommet). Conservés : la note pour le prestataire, la ligne « service indisponible » pour une catégorie sans prestation ni prix.

### 3.6 `SegmentedControl` (générique, `components/ui/`)
Deux ou trois options, piste `theme.surface`, indicateur `theme.accent` qui glisse sous l'option active sur `MOTION.tab` depuis sa position courante, haptique `selection`. Étape 3 : « Maintenant » / « Planifier ». Réutilisable ailleurs (aucun autre usage dans ce chantier).

### 3.7 `WeekStrip` (étape 3, mode Planifier)
Une semaine entière, du lundi au dimanche, en sept colonnes égales : abréviation du jour (10 pt, `day_*` existantes) et numéro en Bebas 20. En-tête : « 15 – 21 septembre » (mois `month_*` existants, en toutes lettres via une nouvelle clé par mois) et deux chevrons ; on va de la semaine courante à +4 semaines, le chevron gauche est inerte sur la semaine courante. Les jours passés sont grisés et inertes ; aujourd'hui porte un point sous le numéro. Jour sélectionné : fond `theme.accent`. Changer de semaine pousse la grille des jours latéralement (`MOTION.pane`). Sélectionner un jour remet le créneau à zéro (comportement actuel).

Données : `buildWeeks(now, 5)` dans `lib/scheduling/weeks.ts` (pur, testé) remplace `buildNextDays(t, 10)`. `selectedDayIso` garde son format `YYYY-MM-DD`.

### 3.8 `SlotGrid` (étape 3, mode Planifier)
Un tableau : une ligne par moment (« Matin », « Après-midi », « Soir », depuis `getTimeGroups`), quatre colonnes égales, l'étiquette du moment en première colonne (64 pt, 11 pt majuscules `textMuted`). Cases 40 pt, `theme.surface`, heure en 13 medium tabulaire ; sélectionnée : `theme.accent`. Les cases manquantes (Soir n'a que deux créneaux) restent vides, jamais comblées. Pour aujourd'hui, les créneaux commençant à moins d'une heure sont inertes (`isSlotDisabled(dayIso, slot, now)`, pur, testé). Tant qu'aucun jour n'est choisi, la grille ne s'affiche pas : la ligne d'indication du bouton dit « Choisissez un jour ».

### 3.9 `StepCTA`
Une pilule **plate** de 52 pt, fond `theme.accent`, sans ombre, liseré, chanfrein, reflet ni halo. Libellé à gauche (DM Sans Medium 17 ; **Bebas 24** à l'étape 4). À droite : une flèche (étapes 1 à 3) ou, à l'étape 4, le montant en Bebas 20 tabulaire dans une capsule `rgba(10,10,10,.08)` (prop `amount`, alimentée par ce que le libellé porte aujourd'hui). Appui : `usePressScale()` et haptique `medium` au `onPress` (inchangé). Chargement : `ActivityIndicator` à la place du contenu.

**Désactivé** : le bouton reste tel quel à 35 % d'opacité et une ligne d'indication (12,5 `textSub`, centrée) s'affiche au-dessus, fournie par la prop `hint` : étape 1 « Sélectionnez une adresse » (clé existante), étape 2 « Choisissez une prestation » (clé existante), étape 3 « Choisissez un jour » puis « Choisissez un créneau » (nouvelles clés). À l'étape 4, la logique de désactivation (paiement en préparation, erreur de prix) est inchangée et n'a pas d'indication : les bandeaux d'erreur existants s'en chargent.

Supprimés : `BottomCTA`, `BrandSheen` (plus aucun usage), le voile d'appui, `tactileShadow`, `glowHalo`, la prop `sheen`.

### 3.10 `SettingRow` (étape 3)
Une ligne standard (icône 36 pt sur `theme.surface`, titre 15 medium, sous-titre 11 `textMuted`, accessoire à droite) pour : « Intervention urgente » avec un **`Switch` natif** (piste active `COLORS.greenBrand`) en mode Maintenant ; « Âge du logement » et « Infos d'accès » avec chevron, dont le contenu (puces, champs) est conservé à l'identique sous la ligne. L'interrupteur fait main disparaît.

## 4. Mouvement

| Élément | Preset | Reduce-motion |
|---|---|---|
| Ligne de progression, pager, rail (poussée de liste), semaine (poussée) | `MOTION.pane` | fondu 120–150 ms |
| Indicateur du segmenté | `MOTION.tab` | saut |
| Radio de `ServiceRow` | `MOTION.take` | saut |
| Appui (rail, lignes, cases, bouton) | `usePressScale` | inerte |

Haptique : `selection` sur rail, lignes, cases, jours et segmenté ; `medium` sur le bouton (inchangé). Aucune boucle décorative ne subsiste dans le stepper.

## 5. Disposition

Tous les nouveaux composants lisent `useLayoutClass` (jamais `Dimensions`). Sur un écran regular, les `ScrollView` des étapes 2 et 3 passent en `AdaptiveScroll` (560 pt), l'en-tête et le bouton restent pleine largeur ; sur compact, rien ne change. Insets : `horizontalPadding(insets, 24)` pour l'en-tête et le bouton.

## 6. Textes

Clés à ajouter dans `locales/{fr,nl,en}.json`, section `stepper` : `hint_choose_day`, `hint_choose_slot`, `week_range` (`{{from}} – {{to}} {{month}}`, et la variante sur deux mois `{{from}} {{monthFrom}} – {{to}} {{monthTo}}`), les douze mois en toutes lettres (`month_long_*`), `today_short` (« Auj. » existe déjà comme `today`). Les clés de jours, de mois abrégés, de mode, de confirmation et de bouton sont réutilisées.

## 7. Erreurs et cas limites

- Catégories en chargement : trois `Skeleton` de ligne (composant existant) à la place de l'indicateur d'activité ; en échec, le bandeau actuel.
- Catégorie sans prestation ni prix : ligne « service indisponible » (inchangé), bouton désactivé avec l'indication de l'étape 2.
- Aujourd'hui après le dernier créneau : toutes les cases du jour sont inertes ; l'utilisateur change de jour, rien n'est présélectionné.
- Retour à l'étape 1 depuis l'étape 2 : état conservé (inchangé) ; puce d'adresse touchée : même chemin que le bouton retour.
- Bouton physique Android : `goBack` inchangé, donc même transition en arrière.
- Reduce-motion : voir § 4.

## 8. Tests

`__tests__/weeks.test.js` : `buildWeeks` commence un lundi, 7 jours par semaine, 5 semaines, `iso` en `YYYY-MM-DD`, jours passés marqués, aujourd'hui marqué, indépendant du fuseau (dates construites en local). `__tests__/slots.test.js` : `isSlotDisabled` pour hier, aujourd'hui à moins d'une heure, aujourd'hui plus tard, demain. `__tests__/crumbs.test.js` : `deriveCrumbs` par étape. Garde-fous existants : `serviceSelection.test.js` (inchangé), lint (`Dimensions`, `Animated`, `Alert`, insets), `tsc`.

Vérification manuelle (non automatisable ici) : iPhone compact, simulateur iPad (regular), Reduce Motion activé ; les quatre étapes en avant et en arrière, catégorie à deux prestations, semaine suivante, aujourd'hui tard le soir.

## 9. Ordre de livraison (un plan, cinq tâches)

1. `StepCTA` avec indications, branché sur les quatre étapes ; suppression de `BottomCTA` et `BrandSheen`.
2. `StepHeader`, `StepCrumbs`, `StepPager` ; suppression de `StepIndicator`, `LiveSummary`, `animateStep`.
3. Étape 2 : `CategoryRail`, `ServiceRow`, `Skeleton` de chargement ; suppression de `CategoryCard`, `SubChip`, de l'auto-scroll et de « dès X € ».
4. Étape 3 : `SegmentedControl`, `WeekStrip`, `SlotGrid`, `SettingRow` avec `Switch` natif ; `lib/scheduling/weeks.ts` et tests ; suppression de `TimeSlot`, `DayChip`, `buildNextDays`.
5. Largeur de lecture sur regular, nettoyage des styles morts (`si`, `ls`, `cc`, `sc`, `tslot`, `dc`, `cta`), lint, `tsc`, jest, build 87 iOS et Android.

Chaque tâche laisse l'app cohérente et livrable seule.
