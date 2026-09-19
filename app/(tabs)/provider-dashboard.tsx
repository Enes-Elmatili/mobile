// app/(tabs)/provider-dashboard.tsx — route héritée, conservée pour les liens
// existants : l'accueil prestataire vit dans l'onglet Accueil (dashboard.tsx),
// qui rend components/provider/ProviderDashboard. Deux routes qui montaient
// le même écran = deux instances, deux « en ligne » qui se contredisaient.
import { Redirect } from 'expo-router';

export default function ProviderDashboardRoute() {
  return <Redirect href="/(tabs)/dashboard" />;
}
