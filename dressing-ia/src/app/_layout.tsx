/**
 * Racine de la navigation.
 *
 * Un seul fournisseur d'état (`WardrobeProvider`) au-dessus de toute
 * l'application : la date du jour y est figée une fois pour toutes, ce qui rend
 * la démonstration rejouable à l'identique.
 */

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { WardrobeProvider } from '@/store/wardrobe-store';
import { useTokens } from '@/theme/tokens';

export default function RootLayout() {
  const t = useTokens();

  // Le thème de navigation reprend les jetons : pas de flash blanc en mode sombre.
  const navigationTheme = useMemo(() => {
    const base = t.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: t.colors.background,
        card: t.colors.surface,
        text: t.colors.text,
        border: t.colors.border,
        primary: t.colors.accent,
        notification: t.colors.accent,
      },
    };
  }, [t]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider value={navigationTheme}>
          <WardrobeProvider>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="garment/[id]"
                options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
              />
            </Stack>
          </WardrobeProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
