// app/messages/_layout.tsx
import { Stack } from 'expo-router';
import { useReduceMotion } from '@/lib/motion/sheet';

// Même relais que la pile racine : sans animation explicite, Android prenait
// son défaut (montée depuis le bas) — une conversation arrivait autrement que le reste.
export default function MessagesLayout() {
  const reduced = useReduceMotion();
  return (
    <Stack screenOptions={{ headerShown: false, animation: reduced ? 'fade' : 'slide_from_right' }} />
  );
}
