/**
 * Conversion météo → cible d'isolation, en clo.
 *
 * La cible est calculée sur le RESSENTI (`feelsLikeC`) et non sur la température
 * sèche : à 10 °C, 30 kph de vent ne se portent pas comme 10 °C sans un souffle.
 * La courbe est tabulée puis interpolée linéairement, ce qui la rend continue,
 * décroissante et surtout lisible : on peut la montrer au client.
 *
 * Aucune horloge, aucun aléa : même bulletin ⇒ même cible, au centième près.
 */

import type { Preferences, WeatherSnapshot } from '@/domain/types';

/** Frilosité déclarée. Le type de référence reste celui de `Preferences`. */
export type ThermalBias = Preferences['thermalBias'];

/**
 * Paliers de référence, du plus chaud au plus froid.
 * 25 °C et plus ⇒ 0,30 clo (un t-shirt) ; −5 °C ⇒ 2,30 clo (trois couches
 * chaudes et un manteau d'hiver). Entre deux paliers, on interpole.
 */
export const CLO_CURVE: readonly { readonly feelsLikeC: number; readonly clo: number }[] = [
  { feelsLikeC: 25, clo: 0.3 },
  { feelsLikeC: 20, clo: 0.5 },
  { feelsLikeC: 15, clo: 0.8 },
  { feelsLikeC: 10, clo: 1.1 },
  { feelsLikeC: 5, clo: 1.5 },
  { feelsLikeC: 0, clo: 1.9 },
  { feelsLikeC: -5, clo: 2.3 },
];

/** Pente du dernier segment (0,4 clo pour 5 °C), prolongée sous −5 °C. */
const COLD_EXTRAPOLATION_SLOPE = 0.08;

/** Majorations liées au temps. */
export const WIND_BONUS_CLO = 0.15;
export const RAIN_BONUS_CLO = 0.1;

/** Au-delà, le vent traverse les couches : il faut un coupe-vent en plus. */
export const WINDY_KPH = 25;

/** Seuil de probabilité à partir duquel on s'habille « pour la pluie ». */
export const RAIN_PROBABILITY = 50;

/** Ajustement de frilosité, en clo. */
export const BIAS_CLO = 0.15;

/** Bornes de sécurité : en dessous on est nu, au-dessus on est en expédition. */
export const TARGET_CLO_MIN = 0.2;
export const TARGET_CLO_MAX = 3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** `true` si la tenue doit encaisser de l'eau (condition ou probabilité). */
export function isRainy(weather: WeatherSnapshot): boolean {
  if (weather.condition === 'pluie' || weather.condition === 'orage' || weather.condition === 'neige') {
    return true;
  }
  return weather.precipitationProbability >= RAIN_PROBABILITY || weather.precipitationMm > 0;
}

/** `true` si le vent justifie une couche coupe-vent supplémentaire. */
export function isWindy(weather: WeatherSnapshot): boolean {
  return weather.windKph > WINDY_KPH;
}

/**
 * Isolation de base pour un ressenti donné, avant météo et frilosité.
 * Plate au-dessus de 25 °C, interpolée entre les paliers, prolongée en
 * ligne droite sous −5 °C jusqu'à la borne haute.
 */
export function baseCloForFeelsLike(feelsLikeC: number): number {
  const first = CLO_CURVE[0];
  const last = CLO_CURVE[CLO_CURVE.length - 1];
  if (first === undefined || last === undefined) {
    return TARGET_CLO_MIN;
  }

  if (feelsLikeC >= first.feelsLikeC) {
    return first.clo;
  }
  if (feelsLikeC <= last.feelsLikeC) {
    const degreesBelow = last.feelsLikeC - feelsLikeC;
    return clamp(last.clo + degreesBelow * COLD_EXTRAPOLATION_SLOPE, TARGET_CLO_MIN, TARGET_CLO_MAX);
  }

  for (let i = 0; i < CLO_CURVE.length - 1; i += 1) {
    const upper = CLO_CURVE[i];
    const lower = CLO_CURVE[i + 1];
    if (upper === undefined || lower === undefined) {
      continue;
    }
    if (feelsLikeC <= upper.feelsLikeC && feelsLikeC >= lower.feelsLikeC) {
      const span = upper.feelsLikeC - lower.feelsLikeC;
      const ratio = span === 0 ? 0 : (upper.feelsLikeC - feelsLikeC) / span;
      return upper.clo + (lower.clo - upper.clo) * ratio;
    }
  }

  return last.clo;
}

/**
 * Cible d'isolation du jour, en clo.
 * Base ressentie + vent + pluie + frilosité, bornée puis arrondie au centième.
 */
export function targetClo(weather: WeatherSnapshot, thermalBias: ThermalBias = 0): number {
  let target = baseCloForFeelsLike(weather.feelsLikeC);

  if (isWindy(weather)) {
    target += WIND_BONUS_CLO;
  }
  if (isRainy(weather)) {
    target += RAIN_BONUS_CLO;
  }

  if (thermalBias === -1) {
    target += BIAS_CLO;
  } else if (thermalBias === 1) {
    target -= BIAS_CLO;
  }

  return round2(clamp(target, TARGET_CLO_MIN, TARGET_CLO_MAX));
}

/** Équivalents parlants, du plus léger au plus chaud. Borne haute exclue. */
const TARGET_LABELS: readonly { readonly max: number; readonly label: string }[] = [
  { max: 0.45, label: 'une seule couche légère suffit' },
  { max: 0.7, label: 'une couche légère et un bas fin suffisent' },
  { max: 1, label: 'il faut deux couches, dont un pull fin' },
  { max: 1.35, label: 'il faut deux couches et une veste' },
  { max: 1.75, label: 'il faut un pull épais sous une veste chaude' },
  { max: 2.2, label: 'il faut trois couches et un manteau' },
  { max: Number.POSITIVE_INFINITY, label: 'il faut trois couches chaudes, un manteau d’hiver et des accessoires' },
];

function labelForTarget(target: number): string {
  for (const step of TARGET_LABELS) {
    if (target < step.max) {
      return step.label;
    }
  }
  return 'il faut trois couches chaudes, un manteau d’hiver et des accessoires';
}

/** Nombre au format français : séparateur décimal virgule. */
function formatClo(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

/**
 * Phrase courte qui explique la cible en langage clair.
 * Gabarit pur : les chiffres viennent du moteur, aucun appel LLM.
 */
export function describeTarget(weather: WeatherSnapshot, target: number): string {
  const feels = Math.round(weather.feelsLikeC);
  const parts: string[] = [`Ressenti ${feels} °C`];

  if (isWindy(weather)) {
    parts.push(`vent à ${Math.round(weather.windKph)} kph`);
  }
  if (isRainy(weather)) {
    parts.push(`${Math.round(weather.precipitationProbability)} % de risque de pluie`);
  }

  const context = parts.join(', ');
  return `${context} : on vise ${formatClo(target)} clo, ${labelForTarget(target)}.`;
}
