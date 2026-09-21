/**
 * Moteur de génération de tenues.
 *
 * Entièrement déterministe : aucune horloge, aucun Math.random, aucun appel
 * réseau, aucun LLM. Même entrée + même graine ⇒ mêmes tenues, au bit près.
 * Les phrases d'explication sont produites par gabarit à partir des chiffres
 * calculés ici.
 */

import { RATIO_MAX, RATIO_MIN, cloForGarment, totalClo } from '@/domain/clo';
import { describeHarmony, harmonyScore } from '@/domain/color';
import type {
  Category,
  EngineInput,
  EngineResult,
  EngineShortfall,
  Garment,
  Outfit,
  OutfitBreakdown,
  OutfitSlot,
  OutfitSlotItem,
  Preferences,
  Season,
  WeatherSnapshot,
} from '@/domain/types';

/* ------------------------------------------------------------------ */
/* Constantes de réglage                                               */
/* ------------------------------------------------------------------ */

/** Pondération du score global. */
export const SCORE_WEIGHTS = {
  thermal: 0.45,
  color: 0.25,
  formality: 0.2,
  novelty: 0.1,
} as const;

/** Au-delà, on échantillonne au lieu d'explorer toutes les combinaisons. */
const MAX_EXHAUSTIVE_COMBINATIONS = 20000;
const SAMPLE_DRAWS = 6000;

/**
 * Budget de notation. L'énumération peut produire jusqu'à 20 000 combinaisons ;
 * on n'en note qu'un sous-ensemble tiré au PRNG, ce qui garde la génération
 * sous ~150 ms sans rien perdre en reproductibilité (même graine, même tirage).
 */
const SCORING_BUDGET = 6000;

/** Température de confort de référence, et pente en degrés par clo. */
const COMFORT_TEMP_C = 26;
const DEGREES_PER_CLO = 13.6;
const TARGET_CLO_MIN = 0.25;
const TARGET_CLO_MAX = 3;

/** Majorations de cible liées au temps. */
const RAIN_TARGET_BONUS = 0.05;
const WIND_TARGET_BONUS = 0.1;

/** Ajustement selon la frilosité déclarée. */
const CHILLY_MULTIPLIER = 1.12;
const HARDY_MULTIPLIER = 0.88;

const WINDY_KPH = 25;
const RAIN_PROBABILITY = 50;

/** Pénalités appliquées au score global quand le dressing ne peut pas suivre. */
const PENALTY_NO_WATERPROOF = 12;
const PENALTY_NO_OUTER_WINDY = 8;

const DEFAULT_COUNT = 3;

/* ------------------------------------------------------------------ */
/* PRNG à graine (mulberry32) — pur, reproductible                     */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hachage FNV-1a : sert aux identifiants stables et aux graines dérivées. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/* ------------------------------------------------------------------ */
/* Saison et cible thermique                                           */
/* ------------------------------------------------------------------ */

/** Saison déduite de la date d'observation, pas d'une horloge système. */
export function seasonFromDate(isoDate: string): Season {
  const month = Number(isoDate.slice(5, 7));
  if (month >= 3 && month <= 5) return 'printemps';
  if (month >= 6 && month <= 8) return 'ete';
  if (month >= 9 && month <= 11) return 'automne';
  return 'hiver';
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Cible d'isolation du jour, en clo.
 * Base linéaire sur la température ressentie, majorée par la pluie et le vent,
 * puis modulée par la frilosité déclarée.
 */
export function targetCloFor(weather: WeatherSnapshot, preferences: Preferences): number {
  let target = (COMFORT_TEMP_C - weather.feelsLikeC) / DEGREES_PER_CLO;

  if (isRainy(weather)) {
    target += RAIN_TARGET_BONUS;
  }
  if (isWindy(weather)) {
    target += WIND_TARGET_BONUS;
  }

  if (preferences.thermalBias === -1) {
    target *= CHILLY_MULTIPLIER;
  } else if (preferences.thermalBias === 1) {
    target *= HARDY_MULTIPLIER;
  }

  return round2(clamp(target, TARGET_CLO_MIN, TARGET_CLO_MAX));
}

function isRainy(weather: WeatherSnapshot): boolean {
  return (
    weather.precipitationProbability >= RAIN_PROBABILITY ||
    weather.precipitationMm > 0 ||
    weather.condition === 'pluie' ||
    weather.condition === 'orage'
  );
}

function isWindy(weather: WeatherSnapshot): boolean {
  return weather.windKph > WINDY_KPH;
}

/* ------------------------------------------------------------------ */
/* Filtrage du dressing                                                */
/* ------------------------------------------------------------------ */

interface SlotPools {
  base: Garment[];
  intermediaire: Garment[];
  externe: Garment[];
  bas: Garment[];
  robe: Garment[];
  chaussures: Garment[];
  accessoire: Garment[];
}

function matchesPreferences(garment: Garment, preferences: Preferences): boolean {
  if (preferences.excludedCategories.includes(garment.category)) {
    return false;
  }
  const avoided = preferences.avoidedColors.map((c) => c.toLowerCase().trim());
  if (avoided.includes(garment.colorName.toLowerCase().trim())) {
    return false;
  }
  return true;
}

function matchesSeason(garment: Garment, season: Season): boolean {
  // Un dressing de démo peut laisser `seasons` vide : la pièce est alors intemporelle.
  return garment.seasons.length === 0 || garment.seasons.includes(season);
}

/** Tri stable et déterministe : favoris d'abord, puis peu portés, puis id. */
function sortGarments(a: Garment, b: Garment): number {
  if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
  if (a.wearCount !== b.wearCount) return a.wearCount - b.wearCount;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function buildPools(wardrobe: readonly Garment[]): SlotPools {
  const pools: SlotPools = {
    base: [],
    intermediaire: [],
    externe: [],
    bas: [],
    robe: [],
    chaussures: [],
    accessoire: [],
  };

  for (const garment of wardrobe) {
    switch (garment.category) {
      case 'haut':
        if (garment.layer === 0) {
          pools.base.push(garment);
        } else if (garment.layer === 1) {
          pools.intermediaire.push(garment);
          // Un pull épais se porte à même la peau : il peut tenir lieu de base.
          if (garment.standalone === true) {
            pools.base.push(garment);
          }
        } else {
          pools.externe.push(garment);
        }
        break;
      case 'veste':
        pools.externe.push(garment);
        break;
      case 'bas':
        pools.bas.push(garment);
        break;
      case 'robe':
        pools.robe.push(garment);
        break;
      case 'chaussures':
        pools.chaussures.push(garment);
        break;
      case 'accessoire':
        pools.accessoire.push(garment);
        break;
    }
  }

  pools.base.sort(sortGarments);
  pools.intermediaire.sort(sortGarments);
  pools.externe.sort(sortGarments);
  pools.bas.sort(sortGarments);
  pools.robe.sort(sortGarments);
  pools.chaussures.sort(sortGarments);
  pools.accessoire.sort(sortGarments);

  return pools;
}

/* ------------------------------------------------------------------ */
/* Construction des combinaisons                                       */
/* ------------------------------------------------------------------ */

interface Constraints {
  requireWaterproofOuter: boolean;
  requireOuter: boolean;
}

interface Candidate {
  items: OutfitSlotItem[];
  garments: Garment[];
  signature: string;
}

function slotItem(slot: OutfitSlot, garment: Garment): OutfitSlotItem {
  return { slot, garment };
}

/** Ordre d'affichage naturel : du torse vers le bas, accessoire en dernier. */
const SLOT_ORDER: readonly OutfitSlot[] = [
  'robe',
  'base',
  'intermediaire',
  'externe',
  'bas',
  'chaussures',
  'accessoire',
];

function sortBySlot(items: readonly OutfitSlotItem[]): OutfitSlotItem[] {
  return items
    .slice()
    .sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));
}

function signatureOf(garments: readonly Garment[]): string {
  return garments
    .map((g) => g.id)
    .slice()
    .sort()
    .join('|');
}

function satisfies(items: readonly OutfitSlotItem[], constraints: Constraints): boolean {
  if (constraints.requireWaterproofOuter) {
    const outer = items.find((i) => i.slot === 'externe');
    if (outer === undefined || outer.garment.waterproof !== true) {
      return false;
    }
  }
  if (constraints.requireOuter && !items.some((i) => i.slot === 'externe')) {
    return false;
  }
  return true;
}

function pushCandidate(
  out: Candidate[],
  seen: Set<string>,
  items: OutfitSlotItem[],
  constraints: Constraints,
): void {
  if (!satisfies(items, constraints)) return;
  const garments = items.map((i) => i.garment);
  const signature = signatureOf(garments);
  if (seen.has(signature)) return;
  seen.add(signature);
  out.push({ items, garments, signature });
}

function withNone(list: readonly Garment[]): (Garment | null)[] {
  return [null, ...list];
}

/** Nombre théorique de combinaisons, pour choisir exploration ou échantillonnage. */
function combinationCount(pools: SlotPools): number {
  const optionalOuter = pools.externe.length + 1;
  const optionalAccessory = pools.accessoire.length + 1;
  const dressCount = pools.robe.length * pools.chaussures.length * optionalOuter * optionalAccessory;
  const separatesCount =
    pools.base.length *
    pools.bas.length *
    pools.chaussures.length *
    (pools.intermediaire.length + 1) *
    optionalOuter *
    optionalAccessory;
  return dressCount + separatesCount;
}

function enumerateAll(pools: SlotPools, constraints: Constraints): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const outers = withNone(pools.externe);
  const accessories = withNone(pools.accessoire);
  const mids = withNone(pools.intermediaire);

  for (const robe of pools.robe) {
    for (const shoes of pools.chaussures) {
      for (const outer of outers) {
        for (const accessory of accessories) {
          const items: OutfitSlotItem[] = [slotItem('robe', robe), slotItem('chaussures', shoes)];
          if (outer !== null) items.push(slotItem('externe', outer));
          if (accessory !== null) items.push(slotItem('accessoire', accessory));
          pushCandidate(out, seen, items, constraints);
        }
      }
    }
  }

  for (const base of pools.base) {
    for (const bottom of pools.bas) {
      for (const shoes of pools.chaussures) {
        for (const mid of mids) {
          if (mid !== null && mid.id === base.id) continue;
          for (const outer of outers) {
            for (const accessory of accessories) {
              const items: OutfitSlotItem[] = [
                slotItem('base', base),
                slotItem('bas', bottom),
                slotItem('chaussures', shoes),
              ];
              if (mid !== null) items.push(slotItem('intermediaire', mid));
              if (outer !== null) items.push(slotItem('externe', outer));
              if (accessory !== null) items.push(slotItem('accessoire', accessory));
              pushCandidate(out, seen, items, constraints);
            }
          }
        }
      }
    }
  }

  return out;
}

function sampleCombinations(
  pools: SlotPools,
  constraints: Constraints,
  rng: () => number,
): Candidate[] {
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const pick = <T,>(list: readonly T[]): T | null => {
    if (list.length === 0) return null;
    const value: T | undefined = list[Math.floor(rng() * list.length)];
    return value === undefined ? null : value;
  };

  const canDress = pools.robe.length > 0 && pools.chaussures.length > 0;
  const canSeparates =
    pools.base.length > 0 && pools.bas.length > 0 && pools.chaussures.length > 0;

  for (let draw = 0; draw < SAMPLE_DRAWS; draw += 1) {
    const useDress = canDress && (!canSeparates || rng() < 0.3);
    const shoes = pick(pools.chaussures);
    if (shoes === null) break;

    const items: OutfitSlotItem[] = [];
    if (useDress) {
      const robe = pick(pools.robe);
      if (robe === null) continue;
      items.push(slotItem('robe', robe));
    } else if (canSeparates) {
      const base = pick(pools.base);
      const bottom = pick(pools.bas);
      if (base === null || bottom === null) continue;
      items.push(slotItem('base', base), slotItem('bas', bottom));
      if (rng() < 0.55) {
        const mid = pick(pools.intermediaire);
        if (mid !== null && mid.id !== base.id) {
          items.push(slotItem('intermediaire', mid));
        }
      }
    } else {
      break;
    }

    items.push(slotItem('chaussures', shoes));

    if (constraints.requireWaterproofOuter || constraints.requireOuter || rng() < 0.6) {
      const outer = pick(pools.externe);
      if (outer !== null) items.push(slotItem('externe', outer));
    }
    if (rng() < 0.45) {
      const accessory = pick(pools.accessoire);
      if (accessory !== null) items.push(slotItem('accessoire', accessory));
    }

    pushCandidate(out, seen, items, constraints);
  }

  return out;
}

/** Tirage sans remise (Fisher-Yates partiel) : déterministe pour une graine donnée. */
function limitCandidates(candidates: Candidate[], rng: () => number): Candidate[] {
  if (candidates.length <= SCORING_BUDGET) return candidates;
  const pool = candidates.slice();
  const picked: Candidate[] = [];
  for (let i = 0; i < SCORING_BUDGET; i += 1) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const a: Candidate | undefined = pool[i];
    const b: Candidate | undefined = pool[j];
    if (a === undefined || b === undefined) break;
    pool[i] = b;
    pool[j] = a;
    picked.push(b);
  }
  return picked;
}

/* ------------------------------------------------------------------ */
/* Notation                                                            */
/* ------------------------------------------------------------------ */

interface ScoringContext {
  targetClo: number;
  weather: WeatherSnapshot;
  preferences: Preferences;
  /** Pénalité globale quand le dressing ne peut pas répondre à la météo. */
  penalty: number;
  rainy: boolean;
  windy: boolean;
}

/**
 * Courbe en cloche rationnelle : 100 à la cible, ~62 aux bornes de recette
 * (0,85 / 1,15). Elle ne sature jamais à 0, sinon toutes les tenues d'un
 * dressing trop léger auraient la même note thermique et se départageraient
 * sur la couleur — un manteau doit toujours battre un gilet à −7 °C.
 */
function thermalScore(ratio: number): number {
  const drift = Math.abs(ratio - 1) / 0.19;
  return clamp(100 / (1 + drift * drift), 0, 100);
}

/**
 * Être sous-couvert est une faute asymétrique : on la sanctionne en plus du
 * score thermique, pour que le moteur aille chercher la couche manquante.
 */
function underdressPenalty(ratio: number): number {
  return Math.min(30, Math.max(0, RATIO_MIN - ratio) * 45);
}

function formalityScore(garments: readonly Garment[], preferences: Preferences): number {
  if (garments.length === 0) return 0;
  let sum = 0;
  let min = 5;
  let max = 1;
  for (const garment of garments) {
    sum += garment.formality;
    if (garment.formality < min) min = garment.formality;
    if (garment.formality > max) max = garment.formality;
  }
  const mean = sum / garments.length;
  let score = 100 - Math.abs(mean - preferences.formality) * 22;
  // Un jogging avec des escarpins : l'écart interne compte autant que la cible.
  if (max - min > 2) {
    score -= 28;
  }
  return clamp(score, 0, 100);
}

function noveltyScore(garments: readonly Garment[]): number {
  if (garments.length === 0) return 0;
  let wear = 0;
  let favorites = 0;
  for (const garment of garments) {
    wear += garment.wearCount;
    if (garment.favorite) favorites += 1;
  }
  const meanWear = wear / garments.length;
  const base = 100 - meanWear * 7;
  const favoriteBonus = (favorites / garments.length) * 10;
  return clamp(base + favoriteBonus, 0, 100);
}

interface ScoredCandidate {
  candidate: Candidate;
  outfit: Outfit;
}

function scoreCandidate(candidate: Candidate, context: ScoringContext): ScoredCandidate {
  const clo = totalClo(candidate.garments);
  const ratio = context.targetClo > 0 ? clo / context.targetClo : 0;

  const breakdown: OutfitBreakdown = {
    thermal: Math.round(thermalScore(ratio)),
    color: harmonyScore(candidate.garments),
    formality: Math.round(formalityScore(candidate.garments, context.preferences)),
    novelty: Math.round(noveltyScore(candidate.garments)),
  };

  const weighted =
    breakdown.thermal * SCORE_WEIGHTS.thermal +
    breakdown.color * SCORE_WEIGHTS.color +
    breakdown.formality * SCORE_WEIGHTS.formality +
    breakdown.novelty * SCORE_WEIGHTS.novelty;

  const score = Math.round(clamp(weighted - context.penalty - underdressPenalty(ratio), 0, 100));

  const outfit: Outfit = {
    id: `tenue-${hashString(candidate.signature).toString(36)}`,
    signature: candidate.signature,
    items: sortBySlot(candidate.items),
    totalClo: clo,
    targetClo: context.targetClo,
    thermalRatio: Math.round(ratio * 100) / 100,
    score,
    breakdown,
    explanation: buildExplanation(candidate, clo, ratio, context),
  };

  return { candidate, outfit };
}

/* ------------------------------------------------------------------ */
/* Explication par gabarit                                             */
/* ------------------------------------------------------------------ */

function fr(value: number, decimals: number): string {
  return value.toFixed(decimals).replace('.', ',');
}

function degrees(value: number): string {
  return String(Math.round(value));
}

function buildExplanation(
  candidate: Candidate,
  clo: number,
  ratio: number,
  context: ScoringContext,
): string {
  const { weather } = context;
  const harmony = describeHarmony(candidate.garments);
  const target = fr(context.targetClo, 1);
  const total = fr(clo, 2);
  const outer = candidate.items.find((i) => i.slot === 'externe');

  let opening: string;
  if (context.rainy) {
    const shelter =
      outer !== undefined && outer.garment.waterproof === true
        ? `${outer.garment.name} te garde au sec`
        : 'prévois de quoi te couvrir';
    opening = `Pluie annoncée sur ${weather.city} (${Math.round(weather.precipitationProbability)} % de risque) : ${shelter}. Il fait ${degrees(weather.tempC)} degrés, ressenti ${degrees(weather.feelsLikeC)}, soit environ ${target} clo à couvrir`;
  } else if (context.windy) {
    opening = `${Math.round(weather.windKph)} km/h de vent à ${weather.city} : il te faut une vraie couche externe. Il fait ${degrees(weather.tempC)} degrés, ressenti ${degrees(weather.feelsLikeC)}, soit environ ${target} clo`;
  } else if (weather.tempC >= 25) {
    opening = `Il fait ${degrees(weather.tempC)} degrés à ${weather.city} : on reste léger, ${target} clo suffisent`;
  } else if (weather.feelsLikeC <= 5) {
    opening = `Il fait ${degrees(weather.tempC)} degrés mais on ressent ${degrees(weather.feelsLikeC)} : il te faut environ ${target} clo`;
  } else {
    opening = `Il fait ${degrees(weather.tempC)} degrés, ressenti ${degrees(weather.feelsLikeC)} : il te faut environ ${target} clo`;
  }

  const core = `${opening}. Cette tenue en apporte ${total}, sur ${harmony}.`;

  let closing = '';
  if (ratio < 0.7) {
    closing =
      ' Ton dressing ne couvre pas ce froid : il te manque une vraie couche externe.';
  } else if (ratio < RATIO_MIN) {
    closing = ' Tu seras un peu juste : ajoute une écharpe si tu restes dehors.';
  } else if (ratio > RATIO_MAX) {
    closing = ' Tu auras de la marge : la couche du dessus s’enlève facilement.';
  } else if (ratio >= 0.97 && ratio <= 1.03) {
    closing = ' C’est le compte exact pour la journée.';
  }

  return `${core}${closing}`;
}

/* ------------------------------------------------------------------ */
/* Sélection finale                                                    */
/* ------------------------------------------------------------------ */

function sharedGarmentCount(a: Outfit, b: Outfit): number {
  const ids = new Set(a.items.map((i) => i.garment.id));
  let shared = 0;
  for (const item of b.items) {
    if (ids.has(item.garment.id)) shared += 1;
  }
  return shared;
}

/** Deux tenues proposées ne partagent pas plus d'une pièce. */
function selectDiverse(scored: readonly ScoredCandidate[], count: number): Outfit[] {
  const selected: Outfit[] = [];

  for (const maxShared of [1, 2]) {
    for (const entry of scored) {
      if (selected.length >= count) break;
      if (selected.some((o) => o.signature === entry.outfit.signature)) continue;
      if (selected.every((o) => sharedGarmentCount(o, entry.outfit) <= maxShared)) {
        selected.push(entry.outfit);
      }
    }
    if (selected.length >= count) break;
  }

  return selected;
}

/* ------------------------------------------------------------------ */
/* Pénurie de dressing                                                 */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  haut: 'un haut',
  bas: 'un bas',
  robe: 'une robe',
  veste: 'une veste',
  chaussures: 'une paire de chaussures',
  accessoire: 'un accessoire',
};

function joinFr(parts: readonly string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1] ?? ''}`;
}

function missingCategories(pools: SlotPools): Category[] {
  const missing: Category[] = [];
  const hasDress = pools.robe.length > 0;
  if (pools.chaussures.length === 0) missing.push('chaussures');
  if (!hasDress && pools.base.length === 0) missing.push('haut');
  if (!hasDress && pools.bas.length === 0) missing.push('bas');
  return missing;
}

function buildShortfall(
  wardrobe: readonly Garment[],
  filtered: readonly Garment[],
  pools: SlotPools,
  season: Season,
  preferences: Preferences,
): EngineShortfall {
  if (wardrobe.length === 0) {
    return {
      reason:
        'Ton dressing est vide. Ajoute au moins un haut, un bas et une paire de chaussures : le moteur pourra alors composer une tenue.',
      missing: ['haut', 'bas', 'chaussures'],
    };
  }

  const missing = missingCategories(pools);

  if (missing.length > 0) {
    const labels = missing.map((category) => CATEGORY_LABELS[category]);
    const removed = wardrobe.length - filtered.length;
    const filterNote =
      removed > 0
        ? ` ${removed} pièce${removed > 1 ? 's sont écartées' : ' est écartée'} par tes filtres (saison ${season}, couleurs évitées, catégories exclues).`
        : '';
    return {
      reason: `Impossible de composer une tenue : il manque ${joinFr(labels)} dans ton dressing.${filterNote}`,
      missing,
    };
  }

  const excluded = preferences.excludedCategories.length > 0 || preferences.avoidedColors.length > 0;
  return {
    reason: excluded
      ? 'Aucune combinaison ne passe tes filtres actuels. Assouplis les couleurs évitées ou les catégories exclues, ou ajoute quelques pièces de saison.'
      : `Aucune combinaison exploitable pour la saison ${season}. Ajoute quelques pièces adaptées à cette saison.`,
    missing: [],
  };
}

/* ------------------------------------------------------------------ */
/* Point d'entrée                                                      */
/* ------------------------------------------------------------------ */

export function generateOutfits(input: EngineInput): EngineResult {
  const { wardrobe, weather, preferences } = input;
  const count = input.count ?? DEFAULT_COUNT;
  const excluded = new Set(input.excludeSignatures ?? []);
  const season = seasonFromDate(weather.observedAt);
  const targetClo = targetCloFor(weather, preferences);

  const seed =
    input.seed ?? hashString(`${weather.observedAt}|${weather.city}|${wardrobe.length}`);
  const rng = mulberry32(seed);

  // 1. Filtrage : les préférences sont impératives, la saison est indicative.
  const allowed = wardrobe.filter((g) => matchesPreferences(g, preferences));
  let filtered = allowed.filter((g) => matchesSeason(g, season));
  let pools = buildPools(filtered);
  if (missingCategories(pools).length > 0) {
    // Plutôt que de bloquer, on retire la contrainte de saison avant d'abandonner.
    filtered = allowed;
    pools = buildPools(filtered);
  }

  if (missingCategories(pools).length > 0) {
    return {
      outfits: [],
      shortfall: buildShortfall(wardrobe, filtered, pools, season, preferences),
      targetClo,
    };
  }

  // 2. Contraintes météo, dans la limite de ce que le dressing permet.
  const rainy = isRainy(weather);
  const windy = isWindy(weather);
  const hasWaterproofOuter = pools.externe.some((g) => g.waterproof === true);
  const hasOuter = pools.externe.length > 0;

  const constraints: Constraints = {
    requireWaterproofOuter: rainy && hasWaterproofOuter,
    requireOuter: windy && hasOuter && !(rainy && hasWaterproofOuter),
  };

  let penalty = 0;
  if (rainy && !hasWaterproofOuter) penalty += PENALTY_NO_WATERPROOF;
  if (windy && !hasOuter) penalty += PENALTY_NO_OUTER_WINDY;

  // 3. Combinaisons : exhaustif tant que le volume reste raisonnable.
  const estimate = combinationCount(pools);
  const relaxed: Constraints = { requireWaterproofOuter: false, requireOuter: false };

  let candidates =
    estimate <= MAX_EXHAUSTIVE_COMBINATIONS
      ? enumerateAll(pools, constraints)
      : sampleCombinations(pools, constraints, rng);

  if (candidates.length === 0 && (constraints.requireWaterproofOuter || constraints.requireOuter)) {
    // Le dressing ne permet pas de tenir la contrainte : on la troque contre une pénalité.
    candidates =
      estimate <= MAX_EXHAUSTIVE_COMBINATIONS
        ? enumerateAll(pools, relaxed)
        : sampleCombinations(pools, relaxed, rng);
    penalty += constraints.requireWaterproofOuter ? PENALTY_NO_WATERPROOF : PENALTY_NO_OUTER_WINDY;
  }

  const usable = limitCandidates(
    candidates.filter((c) => !excluded.has(c.signature)),
    rng,
  );

  if (usable.length === 0) {
    return {
      outfits: [],
      shortfall:
        candidates.length > 0
          ? {
              reason:
                'Toutes les combinaisons possibles ont déjà été proposées aujourd’hui. Ajoute quelques pièces pour renouveler les propositions.',
              missing: [],
            }
          : buildShortfall(wardrobe, filtered, pools, season, preferences),
      targetClo,
    };
  }

  // 4. Notation puis tri déterministe (le tri par signature départage les ex æquo).
  const context: ScoringContext = { targetClo, weather, preferences, penalty, rainy, windy };
  const scored = usable.map((candidate) => scoreCandidate(candidate, context));
  scored.sort((a, b) => {
    if (b.outfit.score !== a.outfit.score) return b.outfit.score - a.outfit.score;
    if (b.outfit.breakdown.thermal !== a.outfit.breakdown.thermal) {
      return b.outfit.breakdown.thermal - a.outfit.breakdown.thermal;
    }
    return a.outfit.signature < b.outfit.signature ? -1 : 1;
  });

  return {
    outfits: selectDiverse(scored, count),
    shortfall: null,
    targetClo,
  };
}

export { RATIO_MAX, RATIO_MIN, cloForGarment, totalClo };
