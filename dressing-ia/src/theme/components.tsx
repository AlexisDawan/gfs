/**
 * Bibliothèque de composants de la maquette.
 * Tous lisent `useTokens()` : le rendu suit le thème clair/sombre du système.
 * Aucune image, aucun asset binaire — les pièces sont dessinées en Views.
 */

import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edges } from 'react-native-safe-area-context';

import type { Garment, Pattern } from '@/domain/types';
import { useTokens, type ColorTokens, type Tokens } from '@/theme/tokens';

/* ------------------------------------------------------------------ Screen */

export interface ScreenProps {
  children: ReactNode;
  /** Enveloppe le contenu dans un ScrollView. */
  scroll?: boolean;
  edges?: Edges;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Barre d'action ancrée en bas, hors de la zone défilante. */
  footer?: ReactNode;
}

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'left', 'right'],
  style,
  contentStyle,
  footer,
}: ScreenProps) {
  const t = useTokens();
  const centered: ViewStyle = { maxWidth: t.maxContentWidth, width: '100%', alignSelf: 'center' };

  return (
    <SafeAreaView
      edges={edges}
      style={[styles.screenRoot, { backgroundColor: t.colors.background }, style]}
    >
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            centered,
            { paddingHorizontal: t.spacing.lg, paddingBottom: t.spacing.xxxl },
            contentStyle,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, centered, { paddingHorizontal: t.spacing.lg }, contentStyle]}>
          {children}
        </View>
      )}
      {footer ? (
        <View
          style={[
            centered,
            styles.footer,
            {
              borderTopColor: t.colors.border,
              backgroundColor: t.colors.background,
              paddingHorizontal: t.spacing.lg,
              paddingVertical: t.spacing.md,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/* ----------------------------------------------------------------- AppText */

export type TextVariant = 'title' | 'heading' | 'body' | 'caption' | 'mono';
export type TextTone = 'default' | 'muted' | 'faint' | 'accent' | 'danger';

export interface AppTextProps {
  children: ReactNode;
  variant?: TextVariant;
  tone?: TextTone;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}

function toneColor(colors: ColorTokens, tone: TextTone): string {
  switch (tone) {
    case 'muted':
      return colors.textMuted;
    case 'faint':
      return colors.textFaint;
    case 'accent':
      return colors.accent;
    case 'danger':
      return colors.danger;
    default:
      return colors.text;
  }
}

function variantStyle(t: Tokens, variant: TextVariant): TextStyle {
  switch (variant) {
    case 'title':
      return {
        fontSize: t.fontSize.xxl,
        lineHeight: Math.round(t.fontSize.xxl * t.lineHeight.tight),
        fontWeight: t.fontWeight.bold,
        letterSpacing: -0.6,
      };
    case 'heading':
      return {
        fontSize: t.fontSize.lg,
        lineHeight: Math.round(t.fontSize.lg * t.lineHeight.normal),
        fontWeight: t.fontWeight.semibold,
        letterSpacing: -0.2,
      };
    case 'caption':
      return {
        fontSize: t.fontSize.xs,
        lineHeight: Math.round(t.fontSize.xs * t.lineHeight.normal),
        fontWeight: t.fontWeight.medium,
        letterSpacing: 0.1,
      };
    case 'mono':
      return {
        fontSize: t.fontSize.sm,
        lineHeight: Math.round(t.fontSize.sm * t.lineHeight.normal),
        fontWeight: t.fontWeight.medium,
        fontFamily: t.monoFontFamily,
      };
    default:
      return {
        fontSize: t.fontSize.md,
        lineHeight: Math.round(t.fontSize.md * t.lineHeight.relaxed),
        fontWeight: t.fontWeight.regular,
      };
  }
}

export function AppText({
  children,
  variant = 'body',
  tone = 'default',
  align,
  numberOfLines,
  style,
}: AppTextProps) {
  const t = useTokens();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        variantStyle(t, variant),
        { color: toneColor(t.colors, tone), textAlign: align },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ Button */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  /** Glyphe textuel optionnel affiché avant le libellé. */
  icon?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  fullWidth = false,
  style,
}: ButtonProps) {
  const t = useTokens();

  const surface = (pressed: boolean): ViewStyle => {
    if (variant === 'primary') {
      return {
        backgroundColor: t.colors.accent,
        borderColor: t.colors.accent,
        opacity: pressed ? 0.85 : 1,
      };
    }
    if (variant === 'secondary') {
      return {
        backgroundColor: pressed ? t.colors.surfaceAlt : t.colors.surface,
        borderColor: t.colors.border,
      };
    }
    return {
      backgroundColor: pressed ? t.colors.surfaceAlt : 'transparent',
      borderColor: 'transparent',
    };
  };

  const labelColor = variant === 'primary' ? t.colors.accentText : t.colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          paddingHorizontal: t.spacing.lg,
          borderRadius: t.radius.md,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        surface(pressed && !disabled),
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {icon ? (
        <Text style={[styles.buttonIcon, { color: labelColor, fontSize: t.fontSize.md }]}>
          {icon}
        </Text>
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          color: labelColor,
          fontSize: t.fontSize.md,
          fontWeight: t.fontWeight.semibold,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Chip */

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  /** Pastille de couleur à gauche du libellé (filtres par couleur). */
  dotColor?: string;
  style?: StyleProp<ViewStyle>;
}

export function Chip({ label, selected = false, onPress, disabled = false, dotColor, style }: ChipProps) {
  const t = useTokens();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled || !onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: t.radius.pill,
          paddingHorizontal: t.spacing.md,
          gap: t.spacing.sm,
          backgroundColor: selected
            ? t.colors.accent
            : pressed
              ? t.colors.surfaceAlt
              : t.colors.surface,
          borderColor: selected ? t.colors.accent : t.colors.border,
        },
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      {dotColor ? (
        <View
          style={[
            styles.chipDot,
            { backgroundColor: dotColor, borderColor: selected ? t.colors.accentText : t.colors.border },
          ]}
        />
      ) : null}
      <Text
        numberOfLines={1}
        style={{
          color: selected ? t.colors.accentText : t.colors.text,
          fontSize: t.fontSize.sm,
          fontWeight: t.fontWeight.medium,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/* -------------------------------------------------------------------- Card */

export interface CardProps {
  children: ReactNode;
  /** Retire le rembourrage interne (utile pour un contenu qui gère le sien). */
  flush?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function Card({ children, flush = false, onPress, style }: CardProps) {
  const t = useTokens();
  const base: StyleProp<ViewStyle> = [
    styles.card,
    t.shadow.sm,
    {
      backgroundColor: t.colors.surface,
      borderColor: t.colors.border,
      borderRadius: t.radius.lg,
      padding: flush ? 0 : t.spacing.lg,
    },
    style,
  ];

  if (!onPress) {
    return <View style={base}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [base, pressed ? { opacity: 0.94 } : null]}
    >
      {children}
    </Pressable>
  );
}

/* ----------------------------------------------------------- GarmentSwatch */

export type SwatchSize = 'sm' | 'md' | 'lg';

const SWATCH_PX: Record<SwatchSize, number> = { sm: 48, md: 76, lg: 116 };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** `hue === null` ⇒ neutre : on garde une teinte chaude très faible, jamais un gris mort. */
function garmentHue(garment: Garment): number {
  return garment.hue ?? 32;
}

function garmentFill(garment: Garment): string {
  const h = Math.round(garmentHue(garment));
  const s = Math.round(clamp(garment.saturation, 0, 100));
  const l = Math.round(clamp(garment.lightness, 0, 100));
  return `hsl(${h}, ${s}%, ${l}%)`;
}

/** Couleur du motif : assombrie sur les pièces claires, éclaircie sur les pièces sombres. */
function garmentMotif(garment: Garment, alpha: number): string {
  const h = Math.round(garmentHue(garment));
  const s = Math.round(clamp(garment.saturation, 0, 100));
  const l = clamp(garment.lightness, 0, 100);
  const shifted = l > 52 ? clamp(l - 26, 0, 100) : clamp(l + 24, 0, 100);
  return `hsla(${h}, ${s}%, ${Math.round(shifted)}%, ${alpha})`;
}

function StripeLayer({
  count,
  color,
  horizontal,
}: {
  count: number;
  color: string;
  horizontal: boolean;
}) {
  const bands: ReactNode[] = [];
  for (let i = 0; i < count; i += 1) {
    bands.push(
      <View
        key={i}
        style={{ flex: 1, backgroundColor: i % 2 === 1 ? color : 'transparent' }}
      />,
    );
  }
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { flexDirection: horizontal ? 'column' : 'row' }]}
    >
      {bands}
    </View>
  );
}

function DotLayer({ color, dot }: { color: string; dot: number }) {
  const rows: ReactNode[] = [];
  for (let r = 0; r < 3; r += 1) {
    const cells: ReactNode[] = [];
    for (let c = 0; c < 3; c += 1) {
      cells.push(
        <View
          key={c}
          style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }}
        />,
      );
    }
    rows.push(
      // Décalage d'une rangée sur deux : un semis régulier fait « imprimé », pas « grille ».
      <View
        key={r}
        style={[styles.dotRow, { paddingHorizontal: r % 2 === 1 ? dot * 2 : 0 }]}
      >
        {cells}
      </View>,
    );
  }
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dotLayer]}>
      {rows}
    </View>
  );
}

function PatternLayer({
  pattern,
  garment,
  px,
}: {
  pattern: Pattern;
  garment: Garment;
  px: number;
}) {
  switch (pattern) {
    case 'raye':
      return <StripeLayer count={px < 60 ? 7 : 11} color={garmentMotif(garment, 0.85)} horizontal />;
    case 'carreaux':
      return (
        <>
          <StripeLayer count={px < 60 ? 5 : 7} color={garmentMotif(garment, 0.55)} horizontal />
          <StripeLayer count={px < 60 ? 5 : 7} color={garmentMotif(garment, 0.45)} horizontal={false} />
        </>
      );
    case 'imprime':
      return <DotLayer color={garmentMotif(garment, 0.7)} dot={Math.max(3, Math.round(px / 14))} />;
    case 'chine':
      // Chiné : hachures fines et peu contrastées, lues comme un grain de laine.
      return <StripeLayer count={px < 60 ? 15 : 23} color={garmentMotif(garment, 0.28)} horizontal={false} />;
    default:
      return null;
  }
}

export interface GarmentSwatchProps {
  garment: Garment;
  size?: SwatchSize;
  /** Masque le libellé de sous-catégorie sous l'aplat. */
  hideLabel?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Représentation d'une pièce sans photo : aplat HSL, motif dessiné, liseré,
 * libellé de sous-catégorie. C'est le substitut d'image de toute la démo.
 */
export function GarmentSwatch({ garment, size = 'md', hideLabel = false, onPress, style }: GarmentSwatchProps) {
  const t = useTokens();
  const px = SWATCH_PX[size];
  const labelWidth = size === 'sm' ? px + 16 : px;

  const body = (
    <View style={[styles.swatchColumn, { width: labelWidth, gap: t.spacing.xs }, style]}>
      <View
        accessibilityRole="image"
        accessibilityLabel={`${garment.name}, ${garment.colorName}`}
        style={[
          styles.swatchBox,
          {
            width: px,
            height: px,
            borderRadius: t.radius.md,
            backgroundColor: garmentFill(garment),
            borderColor: t.colors.border,
          },
        ]}
      >
        <PatternLayer pattern={garment.pattern} garment={garment} px={px} />
        {garment.favorite ? (
          <View
            style={[
              styles.swatchFavorite,
              { backgroundColor: t.colors.surface, borderColor: t.colors.border },
            ]}
          >
            <Text style={{ fontSize: 9, color: t.colors.accent }}>★</Text>
          </View>
        ) : null}
      </View>
      {hideLabel ? null : (
        <Text
          numberOfLines={1}
          style={{
            width: labelWidth,
            textAlign: 'center',
            color: t.colors.textMuted,
            fontSize: t.fontSize.xs,
            fontWeight: t.fontWeight.medium,
          }}
        >
          {garment.subcategory}
        </Text>
      )}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => (pressed ? { opacity: 0.8 } : null)}
    >
      {body}
    </Pressable>
  );
}

/* ------------------------------------------------------------------- Meter */

function pct(value: number): DimensionValue {
  return `${clamp(value, 0, 100)}%` as DimensionValue;
}

export interface MeterProps {
  /** Valeur affichée, 0–100. */
  value: number;
  /** Bornes de la zone cible, 0–100. */
  targetMin: number;
  targetMax: number;
  label?: string;
  /** Valeur lisible affichée à droite du libellé (ex. « 1,02 × cible »). */
  valueLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function Meter({ value, targetMin, targetMax, label, valueLabel, style }: MeterProps) {
  const t = useTokens();
  const v = clamp(value, 0, 100);
  const lo = clamp(Math.min(targetMin, targetMax), 0, 100);
  const hi = clamp(Math.max(targetMin, targetMax), 0, 100);
  const inTarget = v >= lo && v <= hi;
  const fillColor = inTarget ? t.colors.success : t.colors.warning;

  return (
    <View style={style}>
      {label || valueLabel ? (
        <View style={[styles.meterHeader, { marginBottom: t.spacing.sm }]}>
          {label ? (
            <Text
              style={{ color: t.colors.textMuted, fontSize: t.fontSize.xs, fontWeight: t.fontWeight.medium }}
            >
              {label}
            </Text>
          ) : null}
          {valueLabel ? (
            <Text
              style={{
                color: inTarget ? t.colors.success : t.colors.warning,
                fontSize: t.fontSize.xs,
                fontWeight: t.fontWeight.semibold,
                fontFamily: t.monoFontFamily,
              }}
            >
              {valueLabel}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View
        style={[
          styles.meterTrack,
          { backgroundColor: t.colors.surfaceAlt, borderRadius: t.radius.pill },
        ]}
      >
        <View
          style={[
            styles.meterFill,
            { width: pct(v), backgroundColor: fillColor, borderRadius: t.radius.pill },
          ]}
        />
        {/* Zone cible : le repère visuel de la recette thermique. */}
        <View
          pointerEvents="none"
          style={[
            styles.meterTarget,
            {
              left: pct(lo),
              width: pct(hi - lo),
              backgroundColor: t.colors.accent,
              borderColor: t.colors.accent,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[styles.meterKnob, { left: pct(v), borderColor: fillColor, backgroundColor: t.colors.surface }]}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- Badge */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  style?: StyleProp<ViewStyle>;
}

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const t = useTokens();
  const color =
    tone === 'success'
      ? t.colors.success
      : tone === 'warning'
        ? t.colors.warning
        : tone === 'danger'
          ? t.colors.danger
          : t.colors.textMuted;

  return (
    <View
      style={[
        styles.badge,
        {
          borderRadius: t.radius.sm,
          borderColor: color,
          backgroundColor: tone === 'neutral' ? t.colors.surfaceAlt : 'transparent',
          paddingHorizontal: t.spacing.sm,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{
          color,
          fontSize: t.fontSize.xs,
          fontWeight: t.fontWeight.semibold,
          letterSpacing: 0.2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  /** Glyphe textuel : aucune image n'est utilisée dans la démo. */
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon = '◍',
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  const t = useTokens();

  return (
    <View style={[styles.emptyState, { padding: t.spacing.xl, gap: t.spacing.sm }, style]}>
      <View
        style={[
          styles.emptyIcon,
          { backgroundColor: t.colors.surfaceAlt, borderColor: t.colors.border },
        ]}
      >
        <Text style={{ fontSize: 22, color: t.colors.textFaint }}>{icon}</Text>
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {description ? (
        <AppText variant="body" tone="muted" align="center">
          {description}
        </AppText>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={{ marginTop: t.spacing.sm }} />
      ) : null}
    </View>
  );
}

/* ------------------------------------------------------------------ Styles */

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screenRoot: { flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },

  button: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonIcon: { fontWeight: '600' },
  disabled: { opacity: 0.45 },

  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipDot: { width: 12, height: 12, borderRadius: 6, borderWidth: StyleSheet.hairlineWidth },

  card: { borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },

  badge: {
    minHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },

  swatchColumn: { alignItems: 'center' },
  swatchBox: { overflow: 'hidden', borderWidth: 1 },
  swatchFavorite: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotLayer: { justifyContent: 'space-evenly' },
  dotRow: { flexDirection: 'row', justifyContent: 'space-evenly' },

  meterHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meterTrack: { height: 10, width: '100%', justifyContent: 'center', overflow: 'visible' },
  meterTarget: {
    position: 'absolute',
    top: -2,
    bottom: -2,
    opacity: 0.16,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderRadius: 3,
  },
  meterFill: { height: 10 },
  meterKnob: {
    position: 'absolute',
    width: 14,
    height: 14,
    marginLeft: -7,
    borderRadius: 7,
    borderWidth: 2,
  },

  emptyState: { alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
});
