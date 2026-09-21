/**
 * Fiche d'une pièce, présentée en modale.
 *
 * Toutes les valeurs affichées sont celles que le moteur consomme réellement :
 * la fiche sert aussi à montrer au client que rien n'est décoratif.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  CATEGORIES,
  FORMALITY_LABELS,
  PATTERN_LABELS,
  SEASON_LABELS,
  garmentColor,
} from '@/data/taxonomy';
import { cloForGarment } from '@/domain/clo';
import type { Garment, Layer } from '@/domain/types';
import { useWardrobe } from '@/store/wardrobe-store';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  GarmentSwatch,
  Screen,
} from '@/theme/components';
import { useTokens } from '@/theme/tokens';

const LAYER_LABELS: Record<Layer, string> = {
  0: 'base, au contact de la peau',
  1: 'couche intermédiaire',
  2: 'couche externe',
};

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

function fr(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

function formatDayFr(iso: string): string {
  const parts = iso.slice(0, 10).split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return iso;
  }
  return `${day} ${MONTHS[month - 1] ?? ''} ${year}`;
}

/** Le paramètre d'URL peut arriver en tableau : on ne fait jamais confiance à sa forme. */
function readId(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === 'string') {
    return value[0];
  }
  return '';
}

export default function GarmentScreen() {
  const t = useTokens();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const { wardrobe, toggleFavorite, removeGarment, loading } = useWardrobe();
  const [confirming, setConfirming] = useState(false);

  const id = readId(params.id);
  const garment: Garment | undefined = useMemo(
    () => wardrobe.find((entry) => entry.id === id),
    [wardrobe, id],
  );

  const close = (): void => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/dressing');
    }
  };

  const confirmRemoval = (): void => {
    if (garment === undefined) return;
    removeGarment(garment.id);
    setConfirming(false);
    close();
  };

  if (garment === undefined) {
    return (
      <Screen edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <EmptyState
            icon="?"
            title={loading ? 'Chargement…' : 'Pièce introuvable'}
            description={
              loading
                ? 'Le dressing finit de se charger.'
                : 'Cette pièce a été supprimée ou le lien est périmé. Rien n’est perdu : le reste du dressing est intact.'
            }
            actionLabel="Retour au dressing"
            onAction={close}
          />
        </View>
      </Screen>
    );
  }

  const seasons =
    garment.seasons.length === 0
      ? 'toutes saisons'
      : garment.seasons.map((season) => SEASON_LABELS[season]).join(', ');

  return (
    <Screen scroll edges={['top', 'left', 'right']}>
      <View style={[styles.topBar, { paddingTop: t.spacing.md }]}>
        <AppText variant="caption" tone="faint">
          Fiche pièce
        </AppText>
        <Button label="Fermer" variant="ghost" onPress={close} />
      </View>

      <Card style={{ gap: t.spacing.lg, alignItems: 'center' }}>
        <GarmentSwatch garment={garment} size="lg" hideLabel />
        <View style={{ gap: t.spacing.xxs, alignItems: 'center' }}>
          <AppText variant="title" align="center">
            {garment.name}
          </AppText>
          <AppText variant="caption" tone="muted" align="center">
            {CATEGORIES[garment.category].label} · {garment.subcategory}
          </AppText>
        </View>
        <View style={[styles.badges, { gap: t.spacing.sm }]}>
          <Badge label={garment.colorName} />
          <Badge label={PATTERN_LABELS[garment.pattern]} />
          <Badge label={FORMALITY_LABELS[garment.formality]} />
          {garment.waterproof === true ? <Badge label="imperméable" tone="success" /> : null}
          {garment.favorite ? <Badge label="★ favori" tone="warning" /> : null}
        </View>
      </Card>

      <Card style={{ marginTop: t.spacing.lg }} flush>
        <Row label="Sous-catégorie" value={garment.subcategory} first />
        <Row
          label="Couleur"
          value={garment.colorName}
          swatchColor={garmentColor(garment)}
        />
        <Row label="Motif" value={PATTERN_LABELS[garment.pattern]} />
        <Row
          label="Isolation"
          value={`${fr(cloForGarment(garment), 2)} clo`}
          hint="Valeur ISO 9920 retenue par le moteur pour cette pièce seule."
        />
        <Row
          label="Formalité"
          value={`${garment.formality} sur 5 · ${FORMALITY_LABELS[garment.formality]}`}
        />
        <Row label="Saisons" value={seasons} />
        <Row
          label="Couche"
          value={`${garment.layer} — ${LAYER_LABELS[garment.layer]}`}
          hint={garment.standalone === true ? 'Portable seule, sans rien par-dessus.' : undefined}
        />
        <Row label="Imperméable" value={garment.waterproof === true ? 'oui' : 'non'} />
        <Row
          label="Portée"
          value={`${garment.wearCount} fois`}
          hint="Le moteur s’en sert pour la note de nouveauté."
        />
        <Row label="Ajoutée le" value={formatDayFr(garment.createdAt)} />
        <Row label="Identifiant" value={garment.id} mono />
      </Card>

      <View style={{ marginTop: t.spacing.lg, gap: t.spacing.sm }}>
        <Button
          label={garment.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          icon={garment.favorite ? '★' : '☆'}
          variant="secondary"
          fullWidth
          onPress={() => toggleFavorite(garment.id)}
        />

        {confirming ? (
          <Card style={{ gap: t.spacing.md, borderColor: t.colors.danger }}>
            <AppText variant="body" tone="danger">
              Supprimer « {garment.name} » du dressing ? Cette pièce ne sera plus proposée.
            </AppText>
            <View style={[styles.confirmRow, { gap: t.spacing.sm }]}>
              <Button
                label="Annuler"
                variant="secondary"
                fullWidth
                style={styles.confirmButton}
                onPress={() => setConfirming(false)}
              />
              <Button
                label="Oui, supprimer"
                fullWidth
                style={styles.confirmButton}
                onPress={confirmRemoval}
              />
            </View>
          </Card>
        ) : (
          <Button
            label="Supprimer la pièce"
            icon="✕"
            variant="ghost"
            fullWidth
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </Screen>
  );
}

/* ------------------------------------------------------------------ */

function Row({
  label,
  value,
  hint,
  mono = false,
  first = false,
  swatchColor,
}: {
  label: string;
  value: string;
  hint?: string;
  mono?: boolean;
  first?: boolean;
  swatchColor?: string;
}) {
  const t = useTokens();
  const right: ReactNode = (
    <AppText variant={mono ? 'mono' : 'body'} align="right" style={styles.rowValue}>
      {value}
    </AppText>
  );

  return (
    <View
      style={{
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.md,
        borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
        borderTopColor: t.colors.border,
      }}
    >
      <View style={styles.rowMain}>
        <AppText variant="caption" tone="muted" style={styles.rowLabel}>
          {label}
        </AppText>
        <View style={[styles.rowRight, { gap: t.spacing.sm }]}>
          {swatchColor === undefined ? null : (
            <View
              style={[styles.dot, { backgroundColor: swatchColor, borderColor: t.colors.border }]}
            />
          )}
          {right}
        </View>
      </View>
      {hint === undefined ? null : (
        <AppText variant="caption" tone="faint" style={{ marginTop: t.spacing.xs }}>
          {hint}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  rowMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowLabel: { flexShrink: 0 },
  rowRight: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  rowValue: { flexShrink: 1 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  confirmRow: { flexDirection: 'row' },
  confirmButton: { flex: 1 },
});
