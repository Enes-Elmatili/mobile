import { Stack } from 'expo-router';

export default function CallLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
  );
}