import { Stack } from 'expo-router';

export default function AuthLayout() {
  // ✅ Juste un Stack simple, SANS logique de redirection
  // La redirection est gérée par app/_layout.tsx
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}