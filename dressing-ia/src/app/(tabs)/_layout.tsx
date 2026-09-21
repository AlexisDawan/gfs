/**
 * Barre d'onglets.
 *
 * Les icônes sont des glyphes texte : expo-symbols ne rend rien sous
 * react-native-web, et la démo doit être identique dans un navigateur et sur
 * un téléphone.
 */

import { Tabs } from 'expo-router/js-tabs';
import { Platform, StyleSheet, Text, type ColorValue } from 'react-native';

import { useTokens } from '@/theme/tokens';

function TabGlyph({ glyph, color }: { glyph: string; color: ColorValue }) {
  return (
    <Text allowFontScaling={false} style={[styles.glyph, { color }]}>
      {glyph}
    </Text>
  );
}

export default function TabsLayout() {
  const t = useTokens();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.accent,
        tabBarInactiveTintColor: t.colors.textFaint,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          backgroundColor: t.colors.surface,
          borderTopColor: t.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          // La barre par défaut est trop basse pour une cible tactile de 44 px.
          height: Platform.OS === 'web' ? 64 : undefined,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tenue du jour',
          tabBarIcon: ({ color }) => <TabGlyph glyph="✦" color={color} />,
        }}
      />
      <Tabs.Screen
        name="dressing"
        options={{
          title: 'Dressing',
          tabBarIcon: ({ color }) => <TabGlyph glyph="▤" color={color} />,
        }}
      />
      <Tabs.Screen
        name="recette"
        options={{
          title: 'Recette',
          tabBarIcon: ({ color }) => <TabGlyph glyph="✓" color={color} />,
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <TabGlyph glyph="☺" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  glyph: { fontSize: 19, lineHeight: 23, textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '500' },
});
