import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* welcome est le premier écran — pas de back possible */}
      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="login"
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
      <Stack.Screen
        name="signup"
        options={{ animation: 'slide_from_bottom', gestureEnabled: true }}
      />
    </Stack>
  );
}