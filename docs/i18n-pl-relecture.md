# Polonais — fiche de relecture

`locales/pl.json` : 2 544 clés (toutes celles de l'anglais, les 23 pluriels en
quatre formes, 39 noms de services). Traduit depuis le français et l'anglais
avec un glossaire commun ; tutoiement (« Ty »), formes neutres en genre.

## Glossaire retenu

prestataire → **fachowiec** · mission / demande → **zlecenie** · devis →
**wycena** · facture → **faktura** · frais de déplacement → **opłata za
dojazd** · gains → **zarobki** · Wallet → **Portfel** · virement → **wypłata** ·
Accueil → **Start** · Opportunités → **Nowe zlecenia** · Glisser pour accepter
→ **Przesuń, aby przyjąć** · code d'arrivée → **kod przybycia** · TTC / HT →
**brutto / netto**.

## À relire en priorité (argent et engagements)

- `quote.*`, `stepper.*` (montant, TVA, « Débité uniquement quand… »), `ext.wallet_*`,
  `ext.support_*`, `formules.*`, `subscription.*`, `faq.*`, `ext.cgu_*`.

## Choix des traducteurs à valider

| Clé | Choix | Question |
|---|---|---|
| `auth.welcome_l1…l3` | FACHOWIEC / POD TWOIMI / DRZWIAMI / OD RAZU | Rythme du titre d'accueil |
| `profile.trades`, `auth.su_cat_count_*` | branża / branże | ou « zawód » ? |
| `notifications.go_to_space` | Przejdź do konta | « espace » = compte |
| `cockpit.busy` / `cockpit.invisible` | W trakcie zlecenia / Nikt Cię nie widzi | évite « zajęty/zajęta » |
| `cockpit.m_working` | Realizacja | étape « Intervention » |
| `quote.pending_title` + `_diagnostic` / `_quote` | CZEKAMY NA + DIAGNOZĘ. / WYCENĘ. | accusatif : les trois s'assemblent |
| `dashboard.fixed_in` | Naprawione w | délai moyen d'intervention |
| `provider.callout_guaranteed` | Gwarantowana po przyjeździe | ou « po przyjęciu zlecenia » ? |
| `rating.your_mission_with` | Twoje zlecenie z: | deux-points pour éviter de décliner le nom |
| `onboarding.approved_title_*` | JESTEŚ / ONLINE. | |
| `ext.wallet_tx_released` | Uwolnione | ou « Dostępne » (fonds disponibles) ? |
| `ext.cgu_prevail_note` | « Niniejszy regulamin udostępniamy po polsku dla wygody… » | la version française prévaut |
| `searching.wave_n` | Tura {{n}} | vagues de notifications |
| `services.*.name` | noms déduits du slug et de la description | à comparer aux noms affichés en FR |

## Ce qui reste côté serveur

- `Subcategory.nameI18n.pl` : tant qu'il manque, l'app prend `services.<slug>.name`
  de `pl.json`, sinon l'anglais.
- Factures PDF : modèles fr/nl/en seulement ; une facture demandée en polonais
  sort en anglais (`lib/api.ts`, `PDF_LANGS`).
- E-mails et notifications push : générés par le serveur (en-têtes
  `Accept-Language` / `X-Client-Lang` : l'app envoie déjà `pl`).
