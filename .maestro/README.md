# Tests de bout en bout (Maestro)

Les chemins où un bug coûte de l'argent, joués sur un vrai binaire de l'app,
dans l'ordre — chaque flux prépare le suivant :

| Flux | Ce qu'il prouve |
|---|---|
| `01-client-commande-prix-fixe` | connexion → Commander → adresse → service → maintenant → **paiement Stripe** → recherche lancée |
| `02-client-commande-sur-devis` | même parcours sur un service sur devis : **frais de déplacement** payés → recherche |
| `03-prestataire-accepte` | GO (en ligne) → Nouvelles demandes → **glisser pour accepter** → mission en route |
| `04-client-accepte-devis` | devis préparé → **accepter et payer le solde** → retour au suivi |

Les éléments sont visés par `testID` (jamais par texte, sauf la PaymentSheet de
Stripe, dont l'interface n'est pas la nôtre). Les repères vivent dans le code :
`dashboard-order`, `stepper-*`, `category-<slug>`, `service-<slug>`,
`mission-<stade>`, `action-disc-<état>`, `tab-<onglet>`, `opportunity-*`,
`provider-mission-<stade>`, `quote-*`, `login-*`.

## Environnement de test — jamais la production

- **Build** : profil EAS `e2e` (simulateur iOS), environnement EAS
  `development`. Y définir `EXPO_PUBLIC_API_URL` / `EXPO_PUBLIC_SOCKET_URL`
  vers le backend de **test** et `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` en
  **`pk_test_…`** (les profils `preview` / `production` portent la clé live).
- **Backend de test**, avec Stripe en mode test :
  - un compte **client** (e-mail vérifié) avec **au moins une adresse
    enregistrée** à Bruxelles — le flux la choisit au lieu de taper une adresse
    (pas d'appel Google Places) ;
  - un compte **prestataire** validé (ACTIVE, Stripe Connect test terminé),
    dans le métier de la catégorie testée, dont la zone couvre cette adresse ;
  - le catalogue avec un service **à prix fixe** et un service **sur devis**
    (slugs par défaut `plomberie` / `fuite-eau` et `debouchage-canalisation` —
    à ajuster avec les variables de dépôt `E2E_*_CATEGORY` / `E2E_*_SERVICE`) ;
  - une demande du client de test avec un **devis envoyé** (statut
    QUOTE_SENT), dont l'id va dans `E2E_QUOTE_REQUEST_ID`. Le flux 04 la
    consomme : la recréer (seed) avant chaque exécution.

## Lancer

En local (simulateur ouvert, build `e2e` installé) :

```bash
maestro test .maestro \
  --env E2E_CLIENT_EMAIL=… --env E2E_CLIENT_PASSWORD=… \
  --env E2E_PROVIDER_EMAIL=… --env E2E_PROVIDER_PASSWORD=… \
  --env E2E_QUOTE_REQUEST_ID=… \
  --env E2E_FIXED_CATEGORY=plomberie --env E2E_FIXED_SERVICE=fuite-eau \
  --env E2E_QUOTE_CATEGORY=plomberie --env E2E_QUOTE_SERVICE=debouchage-canalisation
```

Un flux seul : `maestro test .maestro/01-client-commande-prix-fixe.yaml --env …`.
Mettre au point un sélecteur : `maestro studio`.

En CI : workflow **E2E** (`.github/workflows/e2e.yml`), à la main ou chaque
nuit ; secrets `EXPO_TOKEN`, `E2E_CLIENT_EMAIL`, `E2E_CLIENT_PASSWORD`,
`E2E_PROVIDER_EMAIL`, `E2E_PROVIDER_PASSWORD`, `E2E_QUOTE_REQUEST_ID`. Rapport
JUnit et captures d'écran en artefact.

## Premier passage

Ces flux n'ont pas encore tourné sur un appareil. Le premier passage sert à
caler deux choses, avec `maestro studio` :
- `subflows/payer-stripe.yaml` : les libellés de la PaymentSheet dépendent de
  la version de Stripe et de la langue du simulateur ;
- les délais (`timeout`) selon la vitesse du backend de test.
