import { Redirect } from 'expo-router';

export default function Index() {
  // Le root layout s'occupe de la navigation
  // Ici on redirige juste vers dashboard par défaut
  return <Redirect href="/(tabs)/dashboard" />;
}
