import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from '../lib/auth/AuthContext';
import { ActivityIndicator, View } from 'react-native';

function RootLayoutNav() {
  const { user, isBooting } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isBooting) {
      console.log('🔄 BOOT IN PROGRESS...');
      return;
    }

    const inAuthGroup = segments[0] === '(auth)';

    console.log('🔍 NAVIGATION CHECK:', {
      user: user?.email || 'null',
      inAuthGroup,
      segments: segments.join('/'),
    });

    if (!user && !inAuthGroup) {
      // Pas de user → forcer login
      console.log('➡️ REDIRECT TO LOGIN (no user)');
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // User connecté mais sur auth → forcer dashboard
      console.log('➡️ REDIRECT TO DASHBOARD (user logged)');
      router.replace('/(tabs)/dashboard');
    } else {
      console.log('✅ No redirect needed');
    }
  }, [user, isBooting, segments, router]);

  if (isBooting) {
    console.log('⏳ Showing boot spinner...');
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#172247" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
