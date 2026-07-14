import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { AppThemeProvider, useAppTheme } from '@/lib/app-theme';
import { MapThemeProvider } from '@/lib/map-theme-context';
import { flush } from '@/lib/offline-queue';
import { registerForPush } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Replay offline-queued writes on launch and whenever the app foregrounds.
  useEffect(() => {
    void flush();
    void registerForPush();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void flush();
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppThemeProvider>
          <BottomSheetModalProvider>
            <ThemedRoot />
          </BottomSheetModalProvider>
        </AppThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function ThemedRoot() {
  const { mode } = useAppTheme();
  return (
    <ThemeProvider value={mode === 'light' ? DefaultTheme : DarkTheme}>
      <MapThemeProvider>
        <AnimatedSplashOverlay />
        <AppTabs />
      </MapThemeProvider>
    </ThemeProvider>
  );
}
