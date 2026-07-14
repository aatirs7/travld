import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { MapThemeProvider } from '@/lib/map-theme-context';
import { flush } from '@/lib/offline-queue';
import { registerForPush } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();

  // Replay any offline-queued writes on launch and whenever the app foregrounds.
  useEffect(() => {
    void flush();
    void registerForPush();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flush();
    });
    return () => sub.remove();
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <MapThemeProvider>
          <AnimatedSplashOverlay />
          <AppTabs />
        </MapThemeProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
