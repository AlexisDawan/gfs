/**
 * Isolation thermique (clo), inspirée de l'ISO 9920.
 *
 * Deux responsabilités :
 *  - une table de valeurs par sous-catégorie, qui sert de repli quand une pièce
 *    n'a pas de `clo` propre ;
 *  - le cumul d'une tenue, qui n'est PAS une simple somme (voir `totalClo`).
 */

import type { Category, Garment, OutfitSlotItem } from '@/domain/types';

/** Bornes du critère de recette : une tenue est « juste » dans cette fourchette. */
export const RATIO_MIN = 0.85;
export const RATIO_MAX = 1.15;

/**
 * Valeurs d'isolation par sous-catégorie, en clo, pour une pièce portée seule.
 * Les clés sont normalisées (minuscules, sans accent) à la lecture : on peut
 * donc écrire « écharpe » ou « echarpe » dans le dressing.
 */
export const CLO_TABLE: Readonly<Record<string, number>> = {
  // Hauts — couche de base
  'debardeur': 0.06,
  'top': 0.06,
  't-shirt': 0.09,
  't-shirt manches courtes': 0.09,
  'polo': 0.12,
  't-shirt manches longues': 0.14,
  'blouse': 0.15,
  'chemise legere': 0.15,
  'chemise': 0.2,
  'chemise epaisse': 0.25,
  'mariniere': 0.14,

  // Hauts — couche intermédiaire
  'cardigan': 0.26,
  'pull fin': 0.25,
  'gilet': 0.28,
  'sweat': 0.3,
  'sweat a capuche': 0.32,
  'pull epais': 0.36,
  'pull col roule': 0.34,
  'polaire': 0.33,

  // Bas
  'short': 0.1,
  'jupe': 0.14,
  'legging': 0.15,
  'jupe longue': 0.2,
  'pantalon fin': 0.24,
  'chino': 0.25,
  'pantalon de costume': 0.26,
  'jean': 0.28,
  'jogging': 0.28,
  'pantalon epais': 0.32,

  // Robes et combinaisons
  "robe d'ete": 0.18,
  'robe legere': 0.2,
  'robe de soiree': 0.22,
  'combinaison': 0.28,
  'robe en maille': 0.32,
  'robe pull': 0.35,

  // Vestes et manteaux
  'coupe-vent': 0.3,
  'impermeable': 0.32,
  'veste en jean': 0.35,
  'veste legere': 0.36,
  'blazer': 0.36,
  'veste en cuir': 0.4,
  'trench': 0.45,
  'doudoune': 0.55,
  'parka': 0.58,
  "manteau d'hiver": 0.6,

  // Chaussures
  'sandales': 0.01,
  'baskets': 0.02,
  'mocassins': 0.02,
  'escarpins': 0.02,
  'chaussettes': 0.02,
  'derbies': 0.03,
  'bottines': 0.08,
  'bottes': 0.1,

  // Accessoires
  'lunettes de soleil': 0,
  'ceinture': 0.01,
  'casquette': 0.01,
  'chapeau': 0.02,
  'foulard': 0.02,
  'bonnet': 0.03,
  'gants': 0.03,
  'echarpe': 0.04,
  'collants': 0.06,
};

/** Repli de dernier recours quand la sous-catégorie est inconnue. */
const DEFAULT_CLO_BY_CATEGORY: Readonly<Record<Category, number>> = {
  haut: 0.15,
  bas: 0.22,
  robe: 0.22,
  veste: 0.36,
  chaussures: 0.02,
  accessoire: 0.02,
};

/**
 * Facteurs de superposition sur le torse : deux couches superposées isolent
 * moins que la somme de leurs valeurs (l'air emprisonné est compressé et la
 * surface d'échange ne double pas). La couche la plus isolante compte à 100 %,
 * la suivante à 85 %, la troisième à 70 %, les suivantes à 60 %.
 */
const LAYER_FACTORS: readonly number[] = [1, 0.85, 0.7];
const DEEP_LAYER_FACTOR = 0.6;

/** Catégories portées sur le torse : ce sont elles qui se superposent. */
const TORSO_CATEGORIES: readonly Category[] = ['haut', 'veste', 'robe'];

/** Accepte indifféremment des pièces nues ou des créneaux de tenue. */
export type CloInput = Garment | OutfitSlotItem;

function toGarment(item: CloInput): Garment {
  return 'garment' in item ? item.garment : item;
}

/** Normalisation maison : Hermes n'expose pas toujours String.normalize. */
function normalizeKey(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûùü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/œ/g, 'oe')
    .replace(/\s+/g, ' ');
}

const CLO_INDEX: Readonly<Record<string, number>> = (() => {
  const index: Record<string, number> = {};
  for (const key of Object.keys(CLO_TABLE)) {
    const value: number | undefined = CLO_TABLE[key];
    if (value !== undefined) {
      index[normalizeKey(key)] = value;
    }
  }
  return index;
})();

/** Mémoïsation : la normalisation est appelée des milliers de fois par génération. */
const LOOKUP_CACHE = new Map<string, number | undefined>();

/** Valeur de table pour une sous-catégorie, ou `undefined` si inconnue. */
export function cloForSubcategory(subcategory: string): number | undefined {
  if (LOOKUP_CACHE.has(subcategory)) {
    return LOOKUP_CACHE.get(subcategory);
  }
  const value: number | undefined = CLO_INDEX[normalizeKey(subcategory)];
  LOOKUP_CACHE.set(subcategory, value);
  return value;
}

/** `garment.clo` fait foi ; sinon table ; sinon repli par catégorie. */
export function cloForGarment(garment: Garment): number {
  if (typeof garment.clo === 'number' && garment.clo > 0) {
    return garment.clo;
  }
  const fromTable = cloForSubcategory(garment.subcategory);
  if (fromTable !== undefined) {
    return fromTable;
  }
  return DEFAULT_CLO_BY_CATEGORY[garment.category];
}

function layerFactor(rank: number): number {
  const factor: number | undefined = LAYER_FACTORS[rank];
  return factor === undefined ? DEEP_LAYER_FACTOR : factor;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Isolation totale d'une tenue, en clo.
 * Les pièces du torse sont triées par isolation décroissante puis pondérées par
 * `LAYER_FACTORS` ; bas, chaussures et accessoires comptent à 100 %.
 */
export function totalClo(items: readonly CloInput[]): number {
  const torso: number[] = [];
  let sum = 0;

  for (const item of items) {
    const garment = toGarment(item);
    const clo = cloForGarment(garment);
    if (TORSO_CATEGORIES.includes(garment.category)) {
      torso.push(clo);
    } else {
      sum += clo;
    }
  }

  torso.sort((a, b) => b - a);
  for (let rank = 0; rank < torso.length; rank += 1) {
    const clo: number | undefined = torso[rank];
    if (clo !== undefined) {
      sum += clo * layerFactor(rank);
    }
  }

  return round2(sum);
}
