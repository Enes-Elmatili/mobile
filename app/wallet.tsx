// app/wallet.tsx — Redirection vers l'unique ecran solde.
// L'ancien "Portefeuille v2" standalone a ete fusionne dans l'onglet Gains
// (app/(tabs)/wallet.tsx), qui porte desormais le bouton Retrait + la modale IBAN.
// Un seul ecran de solde existe : on redirige tous les acces /wallet vers l'onglet.
import { Redirect } from 'expo-router';

export default function WalletRedirect() {
  return <Redirect href="/(tabs)/wallet" />;
}
