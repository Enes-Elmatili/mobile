import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      {/* welcome est le premier écran — pas de back possible */}
      <Stack.Screen name="welcome" options={{ gestureEnabled: false, animation: 'none' }} />
      <Stack.Screen name="auth-choice" options={{ gestureEnabled: true }} />
      <Stack.Screen name="login" options={{ gestureEnabled: true }} />
      <Stack.Screen name="signup" options={{ gestureEnabled: true }} />
      <Stack.Screen name="role-select" options={{ gestureEnabled: true }} />
      <Stack.Screen name="verify-email" options={{ gestureEnabled: true }} />
    </Stack>
  );
}
