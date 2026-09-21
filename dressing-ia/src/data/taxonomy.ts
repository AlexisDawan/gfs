/**
 * Taxonomie d'affichage : libellés français, icônes et palette.
 * Aucun type du contrat n'est redéfini ici, tout vient de '@/domain/types'.
 */

import type {
  Category,
  Formality,
  Garment,
  Pattern,
  Season,
  Subcategory,
  WeatherCondition,
} from '@/domain/types';

/* ------------------------------------------------------------------ */
/* Catégories                                                          */
/* ------------------------------------------------------------------ */

export interface CategoryMeta {
  /** Libellé singulier affichable. */
  label: string;
  /** Libellé pluriel, pour les titres de sections et les compteurs. */
  labelPlural: string;
  /** Nom de glyphe SF Symbols, consommé par expo-symbols sur iOS. */
  symbol: string;
  /**
   * Repli texte : expo-symbols ne rend rien sur react-native-web,
   * l'interface doit pouvoir afficher ce caractère à la place.
   */
  glyph: string;
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  haut: {
    label: 'Haut',
    labelPlural: 'Hauts',
    symbol: 'tshirt.fill',
    glyph: '👕',
  },
  bas: {
    label: 'Bas',
    labelPlural: 'Bas',
    symbol: 'rectangle.portrait.fill',
    glyph: '👖',
  },
  robe: {
    label: 'Robe',
    labelPlural: 'Robes',
    symbol: 'figure.dress.line.vertical.figure',
    glyph: '👗',
  },
  veste: {
    label: 'Veste',
    labelPlural: 'Vestes et manteaux',
    symbol: 'jacket.fill',
    glyph: '🧥',
  },
  chaussures: {
    label: 'Chaussures',
    labelPlural: 'Chaussures',
    symbol: 'shoe.fill',
    glyph: '👟',
  },
  accessoire: {
    label: 'Accessoire',
    labelPlural: 'Accessoires',
    symbol: 'bag.fill',
    glyph: '🧣',
  },
};

/** Ordre d'affichage stable des catégories dans l'interface. */
export const CATEGORY_ORDER: readonly Category[] = [
  'haut',
  'bas',
  'robe',
  'veste',
  'chaussures',
  'accessoire',
];

/* ------------------------------------------------------------------ */
/* Sous-catégories                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sous-catégories proposées à la saisie. Les libellés reprennent les clés de la
 * table clo du moteur (`@/domain/clo`), qui les normalise sans les accents :
 * une pièce saisie ici a donc toujours une valeur d'isolation de référence.
 */
export const SUBCATEGORIES_BY_CATEGORY: Record<Category, readonly Subcategory[]> = {
  haut: [
    'débardeur',
    't-shirt',
    'marinière',
    'polo',
    'blouse',
    'chemise',
    'chemise épaisse',
    'pull fin',
    'pull col roulé',
    'pull épais',
    'gilet',
    'cardigan',
    'sweat',
    'sweat à capuche',
    'polaire',
  ],
  bas: [
    'short',
    'jupe',
    'jupe longue',
    'legging',
    'pantalon fin',
    'chino',
    'pantalon de costume',
    'jean',
    'jogging',
    'pantalon épais',
  ],
  robe: [
    "robe d'été",
    'robe légère',
    'robe de soirée',
    'robe en maille',
    'robe pull',
    'combinaison',
  ],
  veste: [
    'coupe-vent',
    'imperméable',
    'veste légère',
    'veste en jean',
    'veste en cuir',
    'blazer',
    'trench',
    'parka',
    'doudoune',
    "manteau d'hiver",
  ],
  chaussures: [
    'sandales',
    'baskets',
    'mocassins',
    'escarpins',
    'derbies',
    'bottines',
    'bottes',
  ],
  accessoire: [
    'ceinture',
    'casquette',
    'chapeau',
    'foulard',
    'bonnet',
    'gants',
    'écharpe',
    'collants',
    'lunettes de soleil',
  ],
};

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

export type ColorName =
  | 'noir'
  | 'blanc'
  | 'gris clair'
  | 'gris anthracite'
  | 'beige'
  | 'écru'
  | 'denim brut'
  | 'marine'
  | 'bleu roi'
  | 'bleu ciel'
  | 'bordeaux'
  | 'rouge cerise'
  | 'terracotta'
  | 'camel'
  | 'chocolat'
  | 'moutarde'
  | 'kaki'
  | 'vert sapin'
  | "vert d'eau"
  | 'rose poudré'
  | 'lavande'
  | 'prune';

export interface ColorPreset {
  name: ColorName;
  /** Teinte utilisée par le moteur. `null` = neutre : la pièce n'entre pas dans le calcul d'harmonie. */
  hue: number | null;
  saturation: number;
  lightness: number;
  /**
   * Teinte de rendu. Identique à `hue` pour les couleurs franches ; pour un neutre
   * (`hue: null`) elle porte la nuance réelle du tissu (beige chaud, denim froid)
   * que le moteur, lui, doit ignorer.
   */
  swatchHue: number;
}

export const COLOR_PRESETS: readonly ColorPreset[] = [
  // Neutres : hue null, le moteur les considère comme compatibles avec tout.
  { name: 'noir', hue: null, saturation: 0, lightness: 10, swatchHue: 0 },
  { name: 'blanc', hue: null, saturation: 0, lightness: 97, swatchHue: 0 },
  { name: 'gris clair', hue: null, saturation: 0, lightness: 78, swatchHue: 0 },
  { name: 'gris anthracite', hue: null, saturation: 0, lightness: 26, swatchHue: 0 },
  { name: 'beige', hue: null, saturation: 26, lightness: 80, swatchHue: 38 },
  { name: 'écru', hue: null, saturation: 28, lightness: 92, swatchHue: 45 },
  { name: 'denim brut', hue: null, saturation: 24, lightness: 34, swatchHue: 218 },
  // Couleurs franches.
  { name: 'marine', hue: 220, saturation: 45, lightness: 24, swatchHue: 220 },
  { name: 'bleu roi', hue: 222, saturation: 62, lightness: 44, swatchHue: 222 },
  { name: 'bleu ciel', hue: 205, saturation: 58, lightness: 72, swatchHue: 205 },
  { name: 'bordeaux', hue: 350, saturation: 50, lightness: 28, swatchHue: 350 },
  { name: 'rouge cerise', hue: 356, saturation: 62, lightness: 46, swatchHue: 356 },
  { name: 'terracotta', hue: 16, saturation: 52, lightness: 52, swatchHue: 16 },
  { name: 'camel', hue: 32, saturation: 48, lightness: 52, swatchHue: 32 },
  { name: 'chocolat', hue: 24, saturation: 35, lightness: 26, swatchHue: 24 },
  { name: 'moutarde', hue: 45, saturation: 62, lightness: 50, swatchHue: 45 },
  { name: 'kaki', hue: 78, saturation: 28, lightness: 38, swatchHue: 78 },
  { name: 'vert sapin', hue: 152, saturation: 40, lightness: 24, swatchHue: 152 },
  { name: "vert d'eau", hue: 168, saturation: 32, lightness: 72, swatchHue: 168 },
  { name: 'rose poudré', hue: 350, saturation: 40, lightness: 80, swatchHue: 350 },
  { name: 'lavande', hue: 262, saturation: 35, lightness: 74, swatchHue: 262 },
  { name: 'prune', hue: 300, saturation: 30, lightness: 32, swatchHue: 300 },
];

export const COLOR_PRESETS_BY_NAME: Readonly<Record<ColorName, ColorPreset>> =
  COLOR_PRESETS.reduce(
    (acc, preset) => {
      acc[preset.name] = preset;
      return acc;
    },
    {} as Record<ColorName, ColorPreset>,
  );

/**
 * Couleur CSS/RN d'une pièce. Un neutre n'a pas de teinte côté moteur :
 * on retrouve sa nuance de rendu dans la palette, sinon on retombe sur un gris.
 */
export function garmentColor(
  garment: Pick<Garment, 'hue' | 'saturation' | 'lightness' | 'colorName'>,
): string {
  if (garment.hue !== null) {
    return `hsl(${garment.hue}, ${garment.saturation}%, ${garment.lightness}%)`;
  }
  const preset = COLOR_PRESETS.find((item) => item.name === garment.colorName);
  const hue = preset ? preset.swatchHue : 0;
  return `hsl(${hue}, ${garment.saturation}%, ${garment.lightness}%)`;
}

/* ------------------------------------------------------------------ */
/* Libellés                                                            */
/* ------------------------------------------------------------------ */

export const FORMALITY_LABELS: Record<Formality, string> = {
  1: 'décontracté',
  2: 'quotidien',
  3: 'soigné',
  4: 'habillé',
  5: 'cérémonie',
};

export const SEASON_LABELS: Record<Season, string> = {
  printemps: 'printemps',
  ete: 'été',
  automne: 'automne',
  hiver: 'hiver',
};

export const PATTERN_LABELS: Record<Pattern, string> = {
  uni: 'uni',
  raye: 'rayé',
  carreaux: 'à carreaux',
  imprime: 'imprimé',
  chine: 'chiné',
};

export const CONDITION_LABELS: Record<WeatherCondition, string> = {
  ensoleille: 'ensoleillé',
  nuageux: 'nuageux',
  pluie: 'pluie',
  neige: 'neige',
  orage: 'orage',
  brouillard: 'brouillard',
};

/** Repli texte des conditions météo, même raison que `CategoryMeta.glyph`. */
export const CONDITION_GLYPHS: Record<WeatherCondition, string> = {
  ensoleille: '☀️',
  nuageux: '☁️',
  pluie: '🌧️',
  neige: '❄️',
  orage: '⛈️',
  brouillard: '🌫️',
};
