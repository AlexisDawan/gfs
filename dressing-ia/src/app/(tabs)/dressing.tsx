/**
 * Dressing : grille filtrable des pièces.
 *
 * Aucune photo : chaque pièce est rendue par son aplat de couleur et son motif,
 * dessinés en Views. C'est ce qui permet à la maquette de tourner sans le
 * moindre asset binaire ni appel réseau.
 */

import { useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CATEGORIES, CATEGORY_ORDER, SEASON_LABELS } from '@/data/taxonomy';
import type { Category, Garment, Season } from '@/domain/types';
import { useWardrobe } from '@/store/wardrobe-store';
import { AppText, Chip, EmptyState, GarmentSwatch, Screen } from '@/theme/components';
import { useTokens } from '@/theme/tokens';

const COLUMNS = 3;
const SEASONS: readonly Season[] = ['printemps', 'ete', 'automne', 'hiver'];

type CategoryFilter = Category | 'toutes';
type SeasonFilter = Season | 'toutes';
type SortKey = 'recentes' | 'nom' | 'peu-portees' | 'chaudes';

const SORT_OPTIONS: readonly { key: SortKey; label: string }[] = [
  { key: 'recentes', label: 'Plus récentes' },
  { key: 'nom', label: 'Nom' },
  { key: 'peu-portees', label: 'Peu portées' },
  { key: 'chaudes', label: 'Plus chaudes' },
];

function fr(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

/** Tri alphabétique sans Intl : les accents ne doivent pas passer après le z. */
function fold(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûùü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/œ/g, 'oe');
}

function compare(a: Garment, b: Garment, sort: SortKey): number {
  switch (sort) {
    case 'nom': {
      const left = fold(a.name);
      const right = fold(b.name);
      if (left === right) return a.id < b.id ? -1 : 1;
      return left < right ? -1 : 1;
    }
    case 'peu-portees':
      if (a.wearCount !== b.wearCount) return a.wearCount - b.wearCount;
      return a.id < b.id ? -1 : 1;
    case 'chaudes':
      if (a.clo !== b.clo) return b.clo - a.clo;
      return a.id < b.id ? -1 : 1;
    default:
      if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
      return a.id < b.id ? -1 : 1;
  }
}

export default function DressingScreen() {
  const t = useTokens();
  const router = useRouter();
  const { wardrobe, loading, resetDemo } = useWardrobe();

  const [category, setCategory] = useState<CategoryFilter>('toutes');
  const [season, setSeason] = useState<SeasonFilter>('toutes');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>('recentes');

  const visible = useMemo(() => {
    const kept = wardrobe.filter((garment) => {
      if (category !== 'toutes' && garment.category !== category) return false;
      // Une pièce sans saison est intemporelle : elle passe tous les filtres de saison.
      if (season !== 'toutes' && garment.seasons.length > 0 && !garment.seasons.includes(season)) {
        return false;
      }
      if (favoritesOnly && !garment.favorite) return false;
      return true;
    });
    return kept.sort((a, b) => compare(a, b, sort));
  }, [wardrobe, category, season, favoritesOnly, sort]);

  const resetFilters = (): void => {
    setCategory('toutes');
    setSeason('toutes');
    setFavoritesOnly(false);
    setSort('recentes');
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.centered}>
          <ActivityIndicator color={t.colors.accent} />
          <AppText tone="muted">Chargement du dressing…</AppText>
        </View>
      </Screen>
    );
  }

  if (wardrobe.length === 0) {
    return (
      <Screen>
        <View style={styles.centered}>
          <EmptyState
            icon="◌"
            title="Ton dressing est vide"
            description="Recharge les 42 pièces de démonstration pour reprendre la présentation là où elle s’était arrêtée."
            actionLabel="Recharger la démo"
            onAction={resetDemo}
          />
        </View>
      </Screen>
    );
  }

  const header = (
    <View style={{ paddingTop: t.spacing.lg, gap: t.spacing.md }}>
      <View style={{ gap: t.spacing.xs }}>
        <AppText variant="title">Dressing</AppText>
        <AppText variant="caption" tone="faint">
          {visible.length} pièce{visible.length > 1 ? 's' : ''} affichée
          {visible.length > 1 ? 's' : ''} sur {wardrobe.length}
        </AppText>
      </View>

      <FilterRow label="Catégorie">
        <Chip
          label="Toutes"
          selected={category === 'toutes'}
          onPress={() => setCategory('toutes')}
        />
        {CATEGORY_ORDER.map((entry) => (
          <Chip
            key={entry}
            label={CATEGORIES[entry].labelPlural}
            selected={category === entry}
            onPress={() => setCategory(entry)}
          />
        ))}
      </FilterRow>

      <FilterRow label="Saison">
        <Chip label="Toutes" selected={season === 'toutes'} onPress={() => setSeason('toutes')} />
        {SEASONS.map((entry) => (
          <Chip
            key={entry}
            label={SEASON_LABELS[entry]}
            selected={season === entry}
            onPress={() => setSeason(entry)}
          />
        ))}
        <Chip
          label="★ Favoris"
          selected={favoritesOnly}
          onPress={() => setFavoritesOnly(!favoritesOnly)}
        />
      </FilterRow>

      <FilterRow label="Tri">
        {SORT_OPTIONS.map((option) => (
          <Chip
            key={option.key}
            label={option.label}
            selected={sort === option.key}
            onPress={() => setSort(option.key)}
          />
        ))}
      </FilterRow>
    </View>
  );

  return (
    <Screen>
      <FlatList
        data={visible}
        keyExtractor={(garment) => garment.id}
        numColumns={COLUMNS}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: t.spacing.lg, paddingBottom: t.spacing.xxxl }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="⌕"
            title="Aucune pièce ne correspond"
            description="Ces filtres ne laissent rien passer. Élargis la catégorie ou la saison."
            actionLabel="Réinitialiser les filtres"
            onAction={resetFilters}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.colorName}`}
            onPress={() => router.push({ pathname: '/garment/[id]', params: { id: item.id } })}
            style={({ pressed }) => [styles.cell, pressed ? styles.cellPressed : null]}
          >
            <GarmentSwatch garment={item} size="md" hideLabel />
            <AppText variant="caption" align="center" numberOfLines={2}>
              {item.name}
            </AppText>
            <AppText variant="caption" tone="faint" align="center">
              {fr(item.clo, 2)} clo
            </AppText>
          </Pressable>
        )}
      />
    </Screen>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  const t = useTokens();
  return (
    <View style={{ gap: t.spacing.sm }}>
      <AppText variant="caption" tone="faint">
        {label}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: t.spacing.sm, paddingRight: t.spacing.lg }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  // Base fixe plutôt que flex : une dernière rangée incomplète reste alignée à gauche.
  cell: {
    flexBasis: '33.33%',
    flexGrow: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  cellPressed: { opacity: 0.7 },
});
