// app/request/[id]/ongoing.tsx — route héritée (notifications, onglet
// Missions, anciens liens) : la mission vit désormais sur l'accueil
// prestataire (components/provider/MissionFlow). On y renvoie, en désignant
// la mission voulue.
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function MissionOngoingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/(tabs)/dashboard', params: { mission: String(id) } }} />;
}
