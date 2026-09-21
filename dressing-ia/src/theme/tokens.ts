/**
 * Jetons de design de la maquette « Dressing IA ».
 *
 * Identité : papier chaud et encre brune plutôt que blanc/noir purs, accent
 * terre cuite. Aucun bleu générique, aucune image : la couleur porte seule
 * l'identité du produit.
 */

import { useMemo } from 'react';
import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

export type ThemeName = 'light' | 'dark';

export interface ColorTokens {
  /** Fond de l'écran. */
  background: string;
  /** Fond des cartes et des panneaux. */
  surface: string;
  /** Fond secondaire : champs, pastilles, lignes alternées. */
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  accent: string;
  /** Couleur du texte posé sur `accent`. */
  accentText: string;
  success: string;
  warning: string;
  danger: string;
  /** Voile des modales et des fonds obscurcis. */
  overlay: string;
}

export const palette: Record<ThemeName, ColorTokens> = {
  light: {
    background: '#F7F3EE',
    surface: '#FDFBF8',
    surfaceAlt: '#EFE8DF',
    border: '#E0D6C9',
    text: '#221C17',
    textMuted: '#6E6055',
    textFaint: '#9C8E80',
    accent: '#A8492A',
    accentText: '#FDF6F1',
    success: '#3E6B4B',
    warning: '#8A6415',
    danger: '#A3372D',
    overlay: 'rgba(34, 28, 23, 0.45)',
  },
  dark: {
    background: '#15120F',
    surface: '#1D1915',
    surfaceAlt: '#272119',
    border: '#383027',
    text: '#F1E9E0',
    textMuted: '#A99B8C',
    textFaint: '#776C60',
    accent: '#E08654',
    accentText: '#1A0E07',
    success: '#74AC82',
    warning: '#D2A64F',
    danger: '#E07E71',
    overlay: 'rgba(0, 0, 0, 0.62)',
  },
};

/** Échelle d'espacement, multiples de 4. */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  none: 0,
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fontSize = {
  /** Légende, métadonnées. */
  xs: 12,
  sm: 13,
  /** Corps de texte. */
  md: 15,
  lg: 17,
  /** Titre de section. */
  xl: 21,
  /** Titre d'écran. */
  xxl: 28,
  display: 34,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export const lineHeight = {
  tight: 1.15,
  normal: 1.4,
  relaxed: 1.6,
} as const;

/** Familles monospace disponibles sans police embarquée. */
export const monoFontFamily: string = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
});

export interface ShadowTokens {
  none: ViewStyle;
  sm: ViewStyle;
  md: ViewStyle;
  lg: ViewStyle;
}

/**
 * Ombres discrètes. Sur le web on émet `boxShadow` (les props `shadow*` y sont
 * dépréciées), sur natif les props historiques plus `elevation` pour Android.
 */
function makeShadows(scheme: ThemeName): ShadowTokens {
  const tint = scheme === 'light' ? '34, 28, 23' : '0, 0, 0';
  const base = scheme === 'light' ? 1 : 1.6;

  const build = (y: number, blur: number, opacity: number, elevation: number): ViewStyle =>
    Platform.select<ViewStyle>({
      web: { boxShadow: `0px ${y}px ${blur}px rgba(${tint}, ${(opacity * base).toFixed(3)})` },
      default: {
        shadowColor: scheme === 'light' ? '#221C17' : '#000000',
        shadowOffset: { width: 0, height: y },
        shadowRadius: blur,
        shadowOpacity: opacity * base,
        elevation,
      },
    });

  return {
    none: Platform.select<ViewStyle>({ web: { boxShadow: 'none' }, default: { elevation: 0 } }),
    sm: build(1, 3, 0.06, 1),
    md: build(3, 10, 0.08, 3),
    lg: build(8, 24, 0.1, 8),
  };
}

const shadowsByScheme: Record<ThemeName, ShadowTokens> = {
  light: makeShadows('light'),
  dark: makeShadows('dark'),
};

/** Largeur maximale du contenu : la démo reste lisible dans un navigateur large. */
export const MAX_CONTENT_WIDTH = 560;

export interface Tokens {
  scheme: ThemeName;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  fontWeight: typeof fontWeight;
  lineHeight: typeof lineHeight;
  monoFontFamily: string;
  shadow: ShadowTokens;
  maxContentWidth: number;
}

export function getTokens(scheme: ThemeName): Tokens {
  return {
    scheme,
    colors: palette[scheme],
    spacing,
    radius,
    fontSize,
    fontWeight,
    lineHeight,
    monoFontFamily,
    shadow: shadowsByScheme[scheme],
    maxContentWidth: MAX_CONTENT_WIDTH,
  };
}

const tokensByScheme: Record<ThemeName, Tokens> = {
  light: getTokens('light'),
  dark: getTokens('dark'),
};

/** Jeu de jetons correspondant au thème système courant. */
export function useTokens(): Tokens {
  const scheme = useColorScheme();
  const name: ThemeName = scheme === 'dark' ? 'dark' : 'light';
  return useMemo(() => tokensByScheme[name], [name]);
}
