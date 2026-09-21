/**
 * Harmonie colorimétrique sur la roue HSL.
 *
 * Le moteur n'a pas de goût : il applique des règles de roue chromatique
 * (camaïeu, complémentaire, discordance) et une hygiène de base sur les motifs
 * et le nombre de couleurs vives.
 */

import type { Garment, Pattern } from '@/domain/types';

/** En dessous de ce seuil de saturation, une teinte se comporte comme un neutre. */
const NEUTRAL_SATURATION = 15;

/** Au-dessus, une couleur est « vive » : plus de deux dans une tenue, c'est trop. */
const VIVID_SATURATION = 60;

/** Bornes angulaires, en degrés, des familles d'accords. */
const CAMAIEU_MAX = 30;
const DISSONANT_MIN = 90;
const DISSONANT_MAX = 150;
const COMPLEMENTARY_MIN = 150;

const BASE_SCORE = 72;
const NEUTRAL_ONLY_SCORE = 86;
const SINGLE_COLOR_SCORE = 84;

const DELTA_CAMAIEU = 18;
const DELTA_COMPLEMENTARY = 15;
const DELTA_ANALOGOUS = -4;
const DELTA_DISSONANT = -22;

const PENALTY_PER_EXTRA_VIVID = 9;
const PENALTY_TWO_PATTERNS = 20;
const PENALTY_PER_EXTRA_PATTERN = 6;

type Accord = 'camaieu' | 'complementaire' | 'intermediaire' | 'discordant';

interface HueFamily {
  /** Borne haute exclusive, en degrés. */
  max: number;
  plural: string;
}

/** Familles de teintes, utilisées uniquement pour la phrase d'explication. */
const HUE_FAMILIES: readonly HueFamily[] = [
  { max: 15, plural: 'rouges' },
  { max: 45, plural: 'oranges' },
  { max: 70, plural: 'jaunes' },
  { max: 160, plural: 'verts' },
  { max: 195, plural: 'bleu-vert' },
  { max: 255, plural: 'bleus' },
  { max: 290, plural: 'violets' },
  { max: 330, plural: 'roses' },
  { max: 360, plural: 'rouges' },
];

function normalizeHue(hue: number): number {
  const wrapped = hue % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

function hueFamily(hue: number): string {
  const h = normalizeHue(hue);
  for (const family of HUE_FAMILIES) {
    if (h < family.max) {
      return family.plural;
    }
  }
  return 'rouges';
}

/** Distance angulaire la plus courte sur la roue : 0–180. */
export function hueDistance(a: number, b: number): number {
  const raw = Math.abs(normalizeHue(a) - normalizeHue(b));
  return raw > 180 ? 360 - raw : raw;
}

function classifyAccord(distance: number): Accord {
  if (distance < CAMAIEU_MAX) return 'camaieu';
  if (distance >= COMPLEMENTARY_MIN) return 'complementaire';
  if (distance >= DISSONANT_MIN && distance < DISSONANT_MAX) return 'discordant';
  return 'intermediaire';
}

function accordDelta(accord: Accord): number {
  switch (accord) {
    case 'camaieu':
      return DELTA_CAMAIEU;
    case 'complementaire':
      return DELTA_COMPLEMENTARY;
    case 'discordant':
      return DELTA_DISSONANT;
    default:
      return DELTA_ANALOGOUS;
  }
}

/** Une pièce neutre (hue null ou quasi désaturée) s'accorde avec tout. */
function isNeutral(garment: Garment): boolean {
  return garment.hue === null || garment.saturation < NEUTRAL_SATURATION;
}

function isPatterned(pattern: Pattern): boolean {
  return pattern !== 'uni';
}

interface Analysis {
  hues: number[];
  colorNames: string[];
  accords: Accord[];
  vividCount: number;
  patternCount: number;
}

function analyze(garments: readonly Garment[]): Analysis {
  const hues: number[] = [];
  const colorNames: string[] = [];
  let vividCount = 0;
  let patternCount = 0;

  for (const garment of garments) {
    if (isPatterned(garment.pattern)) {
      patternCount += 1;
    }
    if (isNeutral(garment)) {
      continue;
    }
    if (garment.hue !== null) {
      hues.push(garment.hue);
      colorNames.push(garment.colorName);
    }
    if (garment.saturation > VIVID_SATURATION) {
      vividCount += 1;
    }
  }

  const accords: Accord[] = [];
  for (let i = 0; i < hues.length; i += 1) {
    for (let j = i + 1; j < hues.length; j += 1) {
      const a: number | undefined = hues[i];
      const b: number | undefined = hues[j];
      if (a !== undefined && b !== undefined) {
        accords.push(classifyAccord(hueDistance(a, b)));
      }
    }
  }

  return { hues, colorNames, accords, vividCount, patternCount };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Note d'harmonie 0–100.
 * Les neutres ne pénalisent jamais ; seuls les couples de teintes comptent, en
 * moyenne (pour qu'une tenue de six pièces ne soit pas structurellement pénalisée).
 */
export function harmonyScore(garments: readonly Garment[]): number {
  const { hues, accords, vividCount, patternCount } = analyze(garments);

  let score: number;
  if (hues.length === 0) {
    score = NEUTRAL_ONLY_SCORE;
  } else if (accords.length === 0) {
    score = SINGLE_COLOR_SCORE;
  } else {
    let sum = 0;
    for (const accord of accords) {
      sum += accordDelta(accord);
    }
    score = BASE_SCORE + sum / accords.length;
  }

  if (vividCount > 2) {
    score -= (vividCount - 2) * PENALTY_PER_EXTRA_VIVID;
  }

  if (patternCount >= 2) {
    score -= PENALTY_TWO_PATTERNS + (patternCount - 2) * PENALTY_PER_EXTRA_PATTERN;
  }

  return Math.round(clamp(score, 0, 100));
}

/**
 * Formule courte et française de l'accord, réutilisée telle quelle dans la
 * phrase d'explication du moteur (« …, sur un camaïeu de bleus. »).
 */
export function describeHarmony(garments: readonly Garment[]): string {
  const { hues, colorNames, accords, patternCount } = analyze(garments);

  if (patternCount >= 2) {
    return 'un mélange de motifs';
  }

  if (hues.length === 0) {
    return 'une base neutre';
  }

  if (hues.length === 1) {
    const only: string | undefined = colorNames[0];
    return only === undefined ? 'une touche de couleur' : `une touche de ${only}`;
  }

  let camaieu = 0;
  let complementaire = 0;
  let discordant = 0;
  for (const accord of accords) {
    if (accord === 'camaieu') camaieu += 1;
    else if (accord === 'complementaire') complementaire += 1;
    else if (accord === 'discordant') discordant += 1;
  }

  if (camaieu === accords.length) {
    const first: number | undefined = hues[0];
    if (first === undefined) return 'un camaïeu';
    const family = hueFamily(first);
    // Élision : « un camaïeu d'oranges », pas « de oranges ».
    const article = /^[aeiouyàâéèêëîïôöûü]/.test(family) ? "d'" : 'de ';
    return `un camaïeu ${article}${family}`;
  }
  if (discordant > 0) {
    return 'un mélange coloré';
  }
  if (complementaire > 0) {
    return 'un contraste franc';
  }
  return 'un accord doux';
}
