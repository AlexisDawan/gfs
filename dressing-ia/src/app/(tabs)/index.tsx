/**
 * Tenue du jour : l'écran de démonstration.
 *
 * Tout est calculé en local et de façon déterministe : le bulletin, la cible
 * thermique, les tenues et la phrase d'explication. Changer de bulletin doit
 * suffire à voir la proposition basculer, sans réseau ni attente.
 */

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORIES, CONDITION_GLYPHS, CONDITION_LABELS } from '@/data/taxonomy';
import {
  RATIO_MAX,
  RATIO_MIN,
  SCORE_WEIGHTS,
  generateOutfits,
  hashString,
} from '@/domain/engine';
import type { Garment, Outfit, OutfitSlot } from '@/domain/types';
import { AUTO_WEATHER_KEY, useWardrobe } from '@/store/wardrobe-store';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  GarmentSwatch,
  Meter,
  Screen,
} from '@/theme/components';
import { useTokens } from '@/theme/tokens';
import { describeTarget } from '@/weather/clo-target';
import { DEMO_WEATHER_LIST } from '@/weather/provider';

/* ------------------------------------------------------------------ */
/* Libellés et mise en forme                                           */
/* ------------------------------------------------------------------ */

const SLOT_LABELS: Record<OutfitSlot, string> = {
  robe: 'Robe',
  base: 'Base',
  intermediaire: 'Couche intermédiaire',
  externe: 'Couche externe',
  bas: 'Bas',
  chaussures: 'Chaussures',
  accessoire: 'Accessoire',
};

const BREAKDOWN_ROWS = [
  { key: 'thermal', label: 'Thermique', weight: SCORE_WEIGHTS.thermal },
  { key: 'color', label: 'Couleurs', weight: SCORE_WEIGHTS.color },
  { key: 'formality', label: 'Formalité', weight: SCORE_WEIGHTS.formality },
  { key: 'novelty', label: 'Nouveauté', weight: SCORE_WEIGHTS.novelty },
] as const;

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Décimale à la française, sans dépendre d'Intl (absent de certains moteurs). */
function fr(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

function formatDayFr(isoDay: string): string {
  const parts = isoDay.slice(0, 10).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDay;
  }
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`;
}

/**
 * Série vierge partagée : garder la même référence évite de relancer le moteur
 * à chaque rendu tant que le bulletin n'a pas changé.
 */
const NO_SEEN: string[] = [];

/** Projection du ratio thermique sur la piste 0–100 du Meter (1,00 ⇒ 50). */
function ratioToMeter(ratio: number): number {
  return Math.min(100, Math.max(0, ratio * 50));
}

/* ------------------------------------------------------------------ */
/* État de la session de proposition                                   */
/* ------------------------------------------------------------------ */

interface Cycle {
  /** Bulletin + ville en cours : changer l'un remet la série à zéro. */
  key: string;
  /** Signatures déjà vues, réinjectées dans le moteur pour varier. */
  seen: string[];
  /** Incrément de graine, pour que « Une autre » change vraiment le tirage. */
  bump: number;
  /** Tenue mise en avant parmi les trois proposées. */
  pinned: string | null;
}

export default function TenueDuJourScreen() {
  const t = useTokens();
  const router = useRouter();
  const {
    wardrobe,
    preferences,
    weather,
    selectedDemoWeather,
    setDemoWeather,
    markWorn,
    resetDemo,
    loading,
    today,
  } = useWardrobe();

  const cycleKey = `${selectedDemoWeather}|${weather.city}|${weather.observedAt}`;
  const [cycle, setCycle] = useState<Cycle>({ key: cycleKey, seen: NO_SEEN, bump: 0, pinned: null });
  const [wornSignature, setWornSignature] = useState<string | null>(null);

  // Réinitialisation dérivée plutôt qu'en effet : changer de bulletin repart d'une série vierge.
  const active: Cycle =
    cycle.key === cycleKey ? cycle : { key: cycleKey, seen: NO_SEEN, bump: 0, pinned: null };

  const result = useMemo(
    () =>
      generateOutfits({
        wardrobe,
        weather,
        preferences,
        excludeSignatures: active.seen,
        seed: hashString(`${weather.observedAt}|${weather.city}|${wardrobe.length}|${active.bump}`),
        count: 3,
      }),
    [wardrobe, weather, preferences, active.seen, active.bump],
  );

  const hero: Outfit | null =
    result.outfits.find((outfit) => outfit.signature === active.pinned) ?? result.outfits[0] ?? null;
  const alternatives = result.outfits.filter((outfit) => outfit.signature !== hero?.signature);

  const openGarment = (garment: Garment): void => {
    router.push({ pathname: '/garment/[id]', params: { id: garment.id } });
  };

  const askAnother = (): void => {
    setCycle({
      key: cycleKey,
      seen: [...active.seen, ...result.outfits.map((outfit) => outfit.signature)],
      bump: active.bump + 1,
      pinned: null,
    });
    setWornSignature(null);
  };

  const restart = (): void => {
    setCycle({ key: cycleKey, seen: NO_SEEN, bump: 0, pinned: null });
    setWornSignature(null);
  };

  const wearIt = (): void => {
    if (hero === null) return;
    markWorn(hero);
    // Le compteur de port modifie la note de nouveauté : sans épinglage, la tenue
    // qu'on vient de valider pourrait se faire doubler et disparaître de l'écran.
    setCycle({ ...active, pinned: hero.signature });
    setWornSignature(hero.signature);
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loading}>
          <ActivityIndicator color={t.colors.accent} />
          <AppText tone="muted">Chargement du dressing…</AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <View style={[styles.footerRow, { gap: t.spacing.sm }]}>
          <Button
            label="Une autre"
            icon="↻"
            variant="secondary"
            onPress={askAnother}
            disabled={hero === null}
            fullWidth
            style={styles.footerButton}
          />
          <Button
            label={wornSignature === hero?.signature ? 'Enregistré' : 'Je porte ça'}
            icon={wornSignature === hero?.signature ? '✓' : undefined}
            onPress={wearIt}
            disabled={hero === null}
            fullWidth
            style={styles.footerButton}
          />
        </View>
      }
    >
      <View style={{ paddingTop: t.spacing.lg, gap: t.spacing.xs }}>
        <AppText variant="title">Tenue du jour</AppText>
        <AppText variant="caption" tone="faint">
          {formatDayFr(today)} · {wardrobe.length} pièces dans le dressing
        </AppText>
      </View>

      <WeatherPanel
        selected={selectedDemoWeather}
        onSelect={setDemoWeather}
        targetClo={result.targetClo}
      />

      {hero === null ? (
        <Card style={{ marginTop: t.spacing.lg }}>
          <EmptyState
            icon="⚠"
            title="Aucune tenue possible"
            description={result.shortfall?.reason ?? 'Le moteur n’a rien pu composer.'}
            actionLabel={
              wardrobe.length === 0
                ? 'Recharger la démo'
                : active.seen.length > 0
                  ? 'Repartir des premières idées'
                  : undefined
            }
            onAction={
              wardrobe.length === 0 ? resetDemo : active.seen.length > 0 ? restart : undefined
            }
          />
          {result.shortfall && result.shortfall.missing.length > 0 ? (
            <View style={[styles.chipRow, { gap: t.spacing.sm, marginTop: t.spacing.md }]}>
              <AppText variant="caption" tone="muted">
                Manquant :
              </AppText>
              {result.shortfall.missing.map((category) => (
                <Badge key={category} label={CATEGORIES[category].label} tone="danger" />
              ))}
            </View>
          ) : null}
        </Card>
      ) : (
        <OutfitPanel
          outfit={hero}
          worn={wornSignature === hero.signature}
          onPressGarment={openGarment}
        />
      )}

      {alternatives.length > 0 ? (
        <View style={{ marginTop: t.spacing.xl, gap: t.spacing.sm }}>
          <AppText variant="heading">Autres idées</AppText>
          {alternatives.map((outfit) => (
            <Card
              key={outfit.id}
              onPress={() => setCycle({ ...active, pinned: outfit.signature })}
              style={{ gap: t.spacing.sm }}
            >
              <View style={styles.alternativeHeader}>
                <AppText variant="caption" tone="muted">
                  {outfit.items.length} pièces · {fr(outfit.totalClo, 2)} clo
                </AppText>
                <Badge
                  label={`${Math.round(outfit.score)} / 100`}
                  tone={outfit.score >= 70 ? 'success' : 'warning'}
                />
              </View>
              <View style={[styles.chipRow, { gap: t.spacing.sm }]}>
                {outfit.items.map((item) => (
                  <GarmentSwatch key={item.garment.id} garment={item.garment} size="sm" hideLabel />
                ))}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Bandeau météo                                                       */
/* ------------------------------------------------------------------ */

function WeatherPanel({
  selected,
  onSelect,
  targetClo,
}: {
  selected: string;
  onSelect: (key: string) => void;
  targetClo: number;
}) {
  const t = useTokens();
  const { weather } = useWardrobe();

  return (
    <Card style={{ marginTop: t.spacing.lg, gap: t.spacing.md }}>
      <View style={styles.weatherHeader}>
        <AppText variant="title" style={{ fontSize: 40, lineHeight: 46 }}>
          {CONDITION_GLYPHS[weather.condition]}
        </AppText>
        <View style={styles.weatherText}>
          <AppText variant="title">{Math.round(weather.tempC)} °C</AppText>
          <AppText variant="caption" tone="muted">
            {weather.city} · ressenti {Math.round(weather.feelsLikeC)} °C ·{' '}
            {CONDITION_LABELS[weather.condition]}
          </AppText>
          <AppText variant="caption" tone="faint">
            {Math.round(weather.tempMinC)} / {Math.round(weather.tempMaxC)} °C · vent{' '}
            {Math.round(weather.windKph)} kph · pluie {Math.round(weather.precipitationProbability)} %
          </AppText>
        </View>
      </View>

      <AppText variant="body" tone="muted">
        {describeTarget(weather, targetClo)}
      </AppText>

      <View style={{ gap: t.spacing.sm }}>
        <AppText variant="caption" tone="faint">
          Bulletin de démonstration
        </AppText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: t.spacing.sm, paddingRight: t.spacing.lg }}
        >
          <Chip
            label="Ville et date"
            selected={selected === AUTO_WEATHER_KEY}
            onPress={() => onSelect(AUTO_WEATHER_KEY)}
          />
          {DEMO_WEATHER_LIST.map((entry) => (
            <Chip
              key={entry.key}
              label={entry.label}
              selected={selected === entry.key}
              onPress={() => onSelect(entry.key)}
            />
          ))}
        </ScrollView>
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Tenue proposée                                                      */
/* ------------------------------------------------------------------ */

function OutfitPanel({
  outfit,
  worn,
  onPressGarment,
}: {
  outfit: Outfit;
  worn: boolean;
  onPressGarment: (garment: Garment) => void;
}) {
  const t = useTokens();
  const inRange = outfit.thermalRatio >= RATIO_MIN && outfit.thermalRatio <= RATIO_MAX;

  return (
    <Card style={{ marginTop: t.spacing.lg, gap: t.spacing.lg }}>
      <View style={styles.outfitHeader}>
        <View style={{ gap: t.spacing.xxs }}>
          <AppText variant="heading">La proposition</AppText>
          <AppText variant="caption" tone="faint">
            {outfit.items.length} pièces · {fr(outfit.totalClo, 2)} clo pour une cible de{' '}
            {fr(outfit.targetClo, 1)}
          </AppText>
        </View>
        <Badge
          label={`${Math.round(outfit.score)} / 100`}
          tone={outfit.score >= 70 ? 'success' : 'warning'}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.spacing.md, paddingRight: t.spacing.lg }}
      >
        {outfit.items.map((item) => (
          <GarmentSwatch
            key={item.garment.id}
            garment={item.garment}
            size="md"
            onPress={() => onPressGarment(item.garment)}
          />
        ))}
      </ScrollView>

      <View style={{ gap: t.spacing.xs }}>
        {outfit.items.map((item) => (
          <View key={item.garment.id} style={styles.itemRow}>
            <AppText variant="caption" tone="faint" style={styles.itemSlot}>
              {SLOT_LABELS[item.slot]}
            </AppText>
            <AppText variant="caption" style={styles.itemName} numberOfLines={1}>
              {item.garment.name}
            </AppText>
          </View>
        ))}
      </View>

      <AppText variant="body">{outfit.explanation}</AppText>

      {worn ? <Badge label="Porté aujourd’hui · +1 sur chaque pièce" tone="success" /> : null}

      <View style={{ gap: t.spacing.sm }}>
        <Meter
          label="Isolation par rapport à la cible"
          valueLabel={`${fr(outfit.thermalRatio, 2)} × cible`}
          value={ratioToMeter(outfit.thermalRatio)}
          targetMin={ratioToMeter(RATIO_MIN)}
          targetMax={ratioToMeter(RATIO_MAX)}
        />
        <AppText variant="caption" tone={inRange ? 'muted' : 'danger'}>
          {inRange
            ? `Dans la zone de recette (${fr(RATIO_MIN, 2)} à ${fr(RATIO_MAX, 2)} × cible) : ce bulletin passe.`
            : `Hors de la zone de recette (${fr(RATIO_MIN, 2)} à ${fr(RATIO_MAX, 2)} × cible) : le moteur le dit au lieu de le masquer.`}
        </AppText>
      </View>

      <View style={{ gap: t.spacing.md }}>
        <AppText variant="caption" tone="faint">
          Détail du score
        </AppText>
        {BREAKDOWN_ROWS.map((row) => (
          <Meter
            key={row.key}
            label={`${row.label} · pondération ${Math.round(row.weight * 100)} %`}
            valueLabel={`${Math.round(outfit.breakdown[row.key])} / 100`}
            value={outfit.breakdown[row.key]}
            targetMin={70}
            targetMax={100}
          />
        ))}
      </View>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  footerRow: { flexDirection: 'row' },
  footerButton: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  weatherHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  weatherText: { flex: 1, gap: 2 },
  outfitHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  alternativeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemSlot: { width: 132 },
  itemName: { flex: 1 },
});
