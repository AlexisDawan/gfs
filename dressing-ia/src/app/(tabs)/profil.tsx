/**
 * Profil : les préférences qui pilotent le moteur, plus les commandes de démo.
 *
 * Les couleurs évitées et les catégories exclues sont impératives côté moteur ;
 * la formalité et la frilosité ne font que déplacer la cible. Le client voit
 * donc l'effet de chaque réglage dès l'onglet « Tenue du jour ».
 */

import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import {
  CATEGORIES,
  CATEGORY_ORDER,
  COLOR_PRESETS,
  FORMALITY_LABELS,
  garmentColor,
} from '@/data/taxonomy';
import type { Category, Formality, Preferences } from '@/domain/types';
import { storageKind } from '@/store/storage';
import { useWardrobe } from '@/store/wardrobe-store';
import { AppText, Button, Card, Chip, Screen } from '@/theme/components';
import { useTokens } from '@/theme/tokens';

const FORMALITIES: readonly Formality[] = [1, 2, 3, 4, 5];

const BIAS_OPTIONS: readonly { value: Preferences['thermalBias']; label: string }[] = [
  { value: -1, label: 'Frileux' },
  { value: 0, label: 'Neutre' },
  { value: 1, label: 'Endurant' },
];

const CITY_SUGGESTIONS: readonly string[] = ['Beauvais', 'Paris', 'Lille', 'Lyon', 'Nice', 'Brest'];

const STORAGE_LABELS: Record<ReturnType<typeof storageKind>, string> = {
  navigateur: 'le stockage local de ce navigateur',
  memoire: 'la mémoire de la session (rien n’est écrit sur le disque)',
};

export default function ProfilScreen() {
  const t = useTokens();
  const {
    preferences,
    setPreferences,
    wardrobe,
    history,
    resetDemo,
    clearWardrobe,
    clearHistory,
  } = useWardrobe();

  const [draftCity, setDraftCity] = useState(preferences.city);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const commitCity = (): void => {
    const city = draftCity.trim();
    if (city === '' || city === preferences.city) {
      setDraftCity(preferences.city);
      return;
    }
    setPreferences({ city });
  };

  const pickCity = (city: string): void => {
    setDraftCity(city);
    setPreferences({ city });
  };

  const toggleColor = (name: string): void => {
    const avoided = preferences.avoidedColors.includes(name)
      ? preferences.avoidedColors.filter((entry) => entry !== name)
      : [...preferences.avoidedColors, name];
    setPreferences({ avoidedColors: avoided });
  };

  const toggleCategory = (category: Category): void => {
    const excluded = preferences.excludedCategories.includes(category)
      ? preferences.excludedCategories.filter((entry) => entry !== category)
      : [...preferences.excludedCategories, category];
    setPreferences({ excludedCategories: excluded });
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: t.spacing.lg, gap: t.spacing.xs }}>
        <AppText variant="title">Profil</AppText>
        <AppText variant="caption" tone="faint">
          Ces réglages entrent directement dans le moteur de proposition.
        </AppText>
      </View>

      <Section title="Formalité visée" hint="Le moteur pénalise les tenues trop éloignées de ce niveau.">
        {FORMALITIES.map((level) => (
          <Chip
            key={level}
            label={`${level} · ${FORMALITY_LABELS[level]}`}
            selected={preferences.formality === level}
            onPress={() => setPreferences({ formality: level })}
          />
        ))}
      </Section>

      <Section
        title="Frilosité"
        hint="Frileux majore la cible d’isolation, endurant la minore. C’est ±0,15 clo."
      >
        {BIAS_OPTIONS.map((option) => (
          <Chip
            key={option.label}
            label={option.label}
            selected={preferences.thermalBias === option.value}
            onPress={() => setPreferences({ thermalBias: option.value })}
          />
        ))}
      </Section>

      <Section
        title="Couleurs évitées"
        hint={
          preferences.avoidedColors.length === 0
            ? 'Aucune couleur écartée : tout le dressing est proposable.'
            : `${preferences.avoidedColors.length} couleur${preferences.avoidedColors.length > 1 ? 's' : ''} écartée${preferences.avoidedColors.length > 1 ? 's' : ''} des propositions.`
        }
      >
        {COLOR_PRESETS.map((preset) => (
          <Chip
            key={preset.name}
            label={preset.name}
            dotColor={garmentColor({
              hue: preset.hue,
              saturation: preset.saturation,
              lightness: preset.lightness,
              colorName: preset.name,
            })}
            selected={preferences.avoidedColors.includes(preset.name)}
            onPress={() => toggleColor(preset.name)}
          />
        ))}
      </Section>

      <Section title="Catégories exclues" hint="Utile pour montrer une démo sans robe, par exemple.">
        {CATEGORY_ORDER.map((category) => (
          <Chip
            key={category}
            label={CATEGORIES[category].labelPlural}
            selected={preferences.excludedCategories.includes(category)}
            onPress={() => toggleCategory(category)}
          />
        ))}
      </Section>

      <View style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
        <AppText variant="heading">Ville</AppText>
        <AppText variant="caption" tone="faint">
          Le bulletin « Ville et date » est simulé à partir de ce nom : même ville, même jour, même
          météo.
        </AppText>
        <TextInput
          value={draftCity}
          onChangeText={setDraftCity}
          onBlur={commitCity}
          onSubmitEditing={commitCity}
          returnKeyType="done"
          autoCorrect={false}
          placeholder="Nom de la ville"
          placeholderTextColor={t.colors.textFaint}
          accessibilityLabel="Ville"
          style={[
            styles.input,
            {
              backgroundColor: t.colors.surface,
              borderColor: t.colors.border,
              borderRadius: t.radius.md,
              color: t.colors.text,
              fontSize: t.fontSize.md,
              paddingHorizontal: t.spacing.lg,
            },
          ]}
        />
        <View style={[styles.wrap, { gap: t.spacing.sm }]}>
          {CITY_SUGGESTIONS.map((city) => (
            <Chip
              key={city}
              label={city}
              selected={preferences.city === city}
              onPress={() => pickCity(city)}
            />
          ))}
        </View>
      </View>

      <View style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
        <AppText variant="heading">Démo</AppText>
        <AppText variant="caption" tone="faint">
          {wardrobe.length} pièce{wardrobe.length > 1 ? 's' : ''} · {history.length} tenue
          {history.length > 1 ? 's' : ''} déjà proposée{history.length > 1 ? 's' : ''} ou portée
          {history.length > 1 ? 's' : ''}
        </AppText>

        <Button
          label="Recharger le dressing de démonstration"
          icon="↺"
          variant="secondary"
          fullWidth
          onPress={resetDemo}
        />
        <Button
          label="Oublier l’historique des tenues"
          icon="⌫"
          variant="ghost"
          fullWidth
          disabled={history.length === 0}
          onPress={clearHistory}
        />

        {confirmingClear ? (
          <Card style={{ gap: t.spacing.md, borderColor: t.colors.danger }}>
            <AppText variant="body" tone="danger">
              Vider le dressing ? Les {wardrobe.length} pièces disparaissent et l’écran de pénurie
              s’affiche — c’est justement ce qu’on veut montrer. « Recharger » les ramène.
            </AppText>
            <View style={[styles.row, { gap: t.spacing.sm }]}>
              <Button
                label="Annuler"
                variant="secondary"
                fullWidth
                style={styles.rowButton}
                onPress={() => setConfirmingClear(false)}
              />
              <Button
                label="Vider"
                fullWidth
                style={styles.rowButton}
                onPress={() => {
                  clearWardrobe();
                  setConfirmingClear(false);
                }}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Vider le dressing"
            icon="✕"
            variant="ghost"
            fullWidth
            disabled={wardrobe.length === 0}
            onPress={() => setConfirmingClear(true)}
          />
        )}
      </View>

      <Card style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
        <AppText variant="heading">Ce que cette maquette ne fait pas</AppText>
        <AppText variant="body" tone="muted">
          Aucune photo, aucun compte, aucun appel réseau, aucune clé d’API. Les pièces sont dessinées
          à partir de leur couleur, la météo est simulée en local et les tenues sont calculées sur
          l’appareil.
        </AppText>
        <AppText variant="caption" tone="faint">
          Les réglages et le dressing sont conservés dans {STORAGE_LABELS[storageKind()]}.
        </AppText>
      </Card>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const t = useTokens();
  return (
    <View style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
      <AppText variant="heading">{title}</AppText>
      {hint === undefined ? null : (
        <AppText variant="caption" tone="faint">
          {hint}
        </AppText>
      )}
      <View style={[styles.wrap, { gap: t.spacing.sm }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  row: { flexDirection: 'row' },
  rowButton: { flex: 1 },
  input: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth },
});
