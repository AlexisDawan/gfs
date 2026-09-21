/**
 * Recette du moteur : 30 situations nommées, jouées à l'identique à chaque appel.
 *
 * L'intérêt commercial est là : le critère d'acceptation n'est pas « les tenues
 * sont jolies », c'est « le rapport isolation / cible tombe entre 0,85 et 1,15 ».
 * C'est binaire, mesurable, et rejouable devant le client — aucun aléa, aucune
 * horloge, aucun appel réseau.
 *
 * Les scénarios ne sont pas calibrés pour que tout passe : sur le dressing de
 * démonstration, les cinq situations sous 0 °C échouent, parce que 42 pièces
 * sans sous-couche thermique ni pantalon épais plafonnent autour de 1,5 clo
 * quand il en faudrait 2,1 à 2,4. C'est précisément ce que la recette doit
 * rendre visible : elle nomme la pièce manquante au lieu de promettre 100 %.
 *
 * Coût : les 30 scénarios prennent moins d'une seconde ; l'écran de recette les
 * joue sur action, pas au montage.
 */

import { RATIO_MAX, RATIO_MIN } from '@/domain/clo';
import { generateOutfits, hashString } from '@/domain/engine';
import type { Garment, Outfit, Preferences, WeatherSnapshot } from '@/domain/types';

/* ------------------------------------------------------------------ */
/* Types publics                                                       */
/* ------------------------------------------------------------------ */

export interface RecetteScenario {
  id: string;
  label: string;
  weather: WeatherSnapshot;
  preferences: Preferences;
}

export interface RecetteResult {
  scenario: RecetteScenario;
  /** `true` si une tenue est générée ET que son ratio thermique tient les bornes. */
  passed: boolean;
  /** Ratio thermique de la tenue retenue. `0` si le moteur n'a rien pu composer. */
  ratio: number;
  outfit: Outfit | null;
}

export interface RecetteReport {
  results: RecetteResult[];
  /** Pourcentage de scénarios réussis, entier de 0 à 100. */
  passRate: number;
  passed: number;
  total: number;
}

/* ------------------------------------------------------------------ */
/* Fabriques internes                                                  */
/* ------------------------------------------------------------------ */

type WeatherDraft = Partial<WeatherSnapshot> &
  Pick<WeatherSnapshot, 'tempC' | 'feelsLikeC' | 'condition' | 'city' | 'observedAt'>;

/** Complète un bulletin : les valeurs non pertinentes pour le scénario sont déduites. */
function bulletin(draft: WeatherDraft): WeatherSnapshot {
  return {
    tempMinC: draft.tempC - 4,
    tempMaxC: draft.tempC + 3,
    precipitationMm: 0,
    precipitationProbability: 0,
    windKph: 10,
    isMock: true,
    ...draft,
  };
}

type PreferencesDraft = Partial<Preferences> & Pick<Preferences, 'city'>;

function reglages(draft: PreferencesDraft): Preferences {
  return {
    formality: 2,
    avoidedColors: [],
    excludedCategories: [],
    thermalBias: 0,
    ...draft,
  };
}

/* ------------------------------------------------------------------ */
/* Les 30 scénarios                                                    */
/* ------------------------------------------------------------------ */

export const RECETTE_SCENARIOS: readonly RecetteScenario[] = [
  /* --- Canicule --------------------------------------------------- */
  {
    id: 'canicule-38-paris',
    label: 'Canicule, 38 °C à Paris',
    weather: bulletin({
      tempC: 38,
      feelsLikeC: 41,
      condition: 'ensoleille',
      city: 'Paris',
      observedAt: '2026-08-04T08:00:00.000Z',
      windKph: 6,
    }),
    preferences: reglages({ city: 'Paris' }),
  },
  {
    id: 'canicule-35-nimes-frileux',
    label: 'Canicule, 35 °C à Nîmes, personne frileuse',
    weather: bulletin({
      tempC: 35,
      feelsLikeC: 38,
      condition: 'ensoleille',
      city: 'Nîmes',
      observedAt: '2026-07-22T08:00:00.000Z',
      windKph: 9,
    }),
    preferences: reglages({ city: 'Nîmes', thermalBias: -1 }),
  },
  {
    id: 'canicule-orage-33-montpellier',
    label: 'Canicule orageuse, 33 °C à Montpellier',
    weather: bulletin({
      tempC: 33,
      feelsLikeC: 36,
      condition: 'orage',
      city: 'Montpellier',
      observedAt: '2026-08-18T08:00:00.000Z',
      precipitationMm: 4.2,
      precipitationProbability: 70,
      windKph: 30,
    }),
    preferences: reglages({ city: 'Montpellier' }),
  },

  /* --- Chaleur ---------------------------------------------------- */
  {
    id: 'chaleur-30-lyon',
    label: 'Grosse chaleur, 30 °C à Lyon',
    weather: bulletin({
      tempC: 30,
      feelsLikeC: 32,
      condition: 'ensoleille',
      city: 'Lyon',
      observedAt: '2026-07-08T08:00:00.000Z',
    }),
    preferences: reglages({ city: 'Lyon' }),
  },
  {
    id: 'chaleur-28-bordeaux-endurant',
    label: 'Chaleur, 28 °C à Bordeaux, ne craint pas le froid',
    weather: bulletin({
      tempC: 28,
      feelsLikeC: 30,
      condition: 'ensoleille',
      city: 'Bordeaux',
      observedAt: '2026-06-27T08:00:00.000Z',
    }),
    preferences: reglages({ city: 'Bordeaux', thermalBias: 1 }),
  },
  {
    id: 'chaleur-27-bureau-formel',
    label: 'Bureau en été, 27 °C, tenue habillée',
    weather: bulletin({
      tempC: 27,
      feelsLikeC: 28,
      condition: 'ensoleille',
      city: 'Toulouse',
      observedAt: '2026-06-16T08:00:00.000Z',
    }),
    preferences: reglages({ city: 'Toulouse', formality: 4 }),
  },
  {
    id: 'ete-doux-24-nantes',
    label: 'Été doux, 24 °C à Nantes',
    weather: bulletin({
      tempC: 24,
      feelsLikeC: 24,
      condition: 'ensoleille',
      city: 'Nantes',
      observedAt: '2026-06-05T08:00:00.000Z',
      precipitationProbability: 10,
      windKph: 12,
    }),
    preferences: reglages({ city: 'Nantes' }),
  },
  {
    id: 'ete-26-biarritz-decontracte',
    label: 'Bord de mer, 26 °C à Biarritz, très décontracté',
    weather: bulletin({
      tempC: 26,
      feelsLikeC: 27,
      condition: 'ensoleille',
      city: 'Biarritz',
      observedAt: '2026-07-30T08:00:00.000Z',
      windKph: 18,
    }),
    preferences: reglages({ city: 'Biarritz', formality: 1, avoidedColors: ['noir'] }),
  },

  /* --- Mi-saison -------------------------------------------------- */
  {
    id: 'mi-saison-20-printemps',
    label: 'Printemps, 20 °C à Nantes',
    weather: bulletin({
      tempC: 20,
      feelsLikeC: 20,
      condition: 'ensoleille',
      city: 'Nantes',
      observedAt: '2026-04-18T08:00:00.000Z',
      precipitationProbability: 15,
    }),
    preferences: reglages({ city: 'Nantes' }),
  },
  {
    id: 'mi-saison-18-vent-brest',
    label: 'Printemps venté, 18 °C à Brest',
    weather: bulletin({
      tempC: 18,
      feelsLikeC: 16,
      condition: 'nuageux',
      city: 'Brest',
      observedAt: '2026-04-27T08:00:00.000Z',
      windKph: 32,
    }),
    preferences: reglages({ city: 'Brest' }),
  },
  {
    id: 'mi-saison-15-nuageux-paris',
    label: 'Mi-saison, 15 °C à Paris, sans robe',
    weather: bulletin({
      tempC: 15,
      feelsLikeC: 14,
      condition: 'nuageux',
      city: 'Paris',
      observedAt: '2026-05-12T08:00:00.000Z',
      precipitationProbability: 25,
      windKph: 15,
    }),
    preferences: reglages({ city: 'Paris', excludedCategories: ['robe'] }),
  },
  {
    id: 'mi-saison-13-frileux-rennes',
    label: 'Printemps frais, 13 °C à Rennes, personne frileuse',
    weather: bulletin({
      tempC: 13,
      feelsLikeC: 12,
      condition: 'nuageux',
      city: 'Rennes',
      observedAt: '2026-03-24T08:00:00.000Z',
      precipitationProbability: 30,
      windKph: 18,
    }),
    preferences: reglages({ city: 'Rennes', thermalBias: -1 }),
  },
  {
    id: 'mi-saison-12-automne-endurant',
    label: 'Automne, 12 °C à Dijon, ne craint pas le froid',
    weather: bulletin({
      tempC: 12,
      feelsLikeC: 11,
      condition: 'nuageux',
      city: 'Dijon',
      observedAt: '2026-10-20T08:00:00.000Z',
      precipitationProbability: 20,
    }),
    preferences: reglages({ city: 'Dijon', thermalBias: 1 }),
  },
  {
    id: 'printemps-17-pluie-fine-lille',
    label: 'Pluie fine, 17 °C à Lille',
    weather: bulletin({
      tempC: 17,
      feelsLikeC: 15,
      condition: 'pluie',
      city: 'Lille',
      observedAt: '2026-04-09T08:00:00.000Z',
      precipitationMm: 1.4,
      precipitationProbability: 65,
      windKph: 16,
    }),
    preferences: reglages({ city: 'Lille' }),
  },
  {
    id: 'automne-16-bureau-formel',
    label: 'Automne, 16 °C, journée au bureau très habillée',
    weather: bulletin({
      tempC: 16,
      feelsLikeC: 15,
      condition: 'nuageux',
      city: 'Paris',
      observedAt: '2026-10-06T08:00:00.000Z',
      precipitationProbability: 20,
    }),
    preferences: reglages({ city: 'Paris', formality: 5 }),
  },
  {
    id: 'automne-14-vent-fort-brest',
    label: 'Vent fort, 14 °C à Brest, 55 km/h',
    weather: bulletin({
      tempC: 14,
      feelsLikeC: 11,
      condition: 'nuageux',
      city: 'Brest',
      observedAt: '2026-11-03T08:00:00.000Z',
      precipitationProbability: 35,
      windKph: 55,
    }),
    preferences: reglages({ city: 'Brest' }),
  },
  {
    id: 'automne-11-pluie-rouen',
    label: 'Pluie soutenue, 11 °C à Rouen',
    weather: bulletin({
      tempC: 11,
      feelsLikeC: 9,
      condition: 'pluie',
      city: 'Rouen',
      observedAt: '2026-10-29T08:00:00.000Z',
      precipitationMm: 5.6,
      precipitationProbability: 85,
      windKph: 22,
    }),
    preferences: reglages({ city: 'Rouen' }),
  },

  /* --- Froid ------------------------------------------------------ */
  {
    id: 'froid-8-sec-dijon',
    label: 'Froid sec, 8 °C à Dijon',
    weather: bulletin({
      tempC: 8,
      feelsLikeC: 6,
      condition: 'ensoleille',
      city: 'Dijon',
      observedAt: '2026-11-18T08:00:00.000Z',
      windKph: 14,
    }),
    preferences: reglages({ city: 'Dijon' }),
  },
  {
    id: 'froid-6-frileux-amiens',
    label: 'Froid, 6 °C à Amiens, personne frileuse',
    weather: bulletin({
      tempC: 6,
      feelsLikeC: 5,
      condition: 'brouillard',
      city: 'Amiens',
      observedAt: '2026-11-26T08:00:00.000Z',
      windKph: 8,
    }),
    preferences: reglages({ city: 'Amiens', thermalBias: -1 }),
  },
  {
    id: 'froid-5-hiver-paris',
    label: 'Hiver, 5 °C à Paris',
    weather: bulletin({
      tempC: 5,
      feelsLikeC: 4,
      condition: 'nuageux',
      city: 'Paris',
      observedAt: '2026-01-14T08:00:00.000Z',
      windKph: 12,
    }),
    preferences: reglages({ city: 'Paris' }),
  },
  {
    id: 'froid-3-endurant-lyon',
    label: 'Froid, 3 °C à Lyon, ne craint pas le froid',
    weather: bulletin({
      tempC: 3,
      feelsLikeC: 2,
      condition: 'ensoleille',
      city: 'Lyon',
      observedAt: '2026-12-09T08:00:00.000Z',
      windKph: 10,
    }),
    preferences: reglages({ city: 'Lyon', thermalBias: 1 }),
  },
  {
    id: 'froid-7-pluie-nantes',
    label: 'Pluie froide, 7 °C à Nantes',
    weather: bulletin({
      tempC: 7,
      feelsLikeC: 5,
      condition: 'pluie',
      city: 'Nantes',
      observedAt: '2026-12-02T08:00:00.000Z',
      precipitationMm: 4.1,
      precipitationProbability: 80,
      windKph: 20,
    }),
    preferences: reglages({ city: 'Nantes' }),
  },
  {
    id: 'froid-6-vent-45-lille',
    label: 'Vent fort et froid, 6 °C à Lille, 45 km/h',
    weather: bulletin({
      tempC: 6,
      feelsLikeC: 3,
      condition: 'nuageux',
      city: 'Lille',
      observedAt: '2026-01-27T08:00:00.000Z',
      precipitationProbability: 30,
      windKph: 45,
    }),
    preferences: reglages({ city: 'Lille' }),
  },

  /* --- Gel -------------------------------------------------------- */
  {
    id: 'gel-moins2-paris',
    label: 'Gel, −2 °C à Paris',
    weather: bulletin({
      tempC: -2,
      feelsLikeC: -6,
      condition: 'nuageux',
      city: 'Paris',
      observedAt: '2026-01-08T08:00:00.000Z',
      windKph: 20,
    }),
    preferences: reglages({ city: 'Paris' }),
  },
  {
    id: 'gel-moins8-strasbourg-frileux',
    label: 'Grand froid, −8 °C à Strasbourg, personne frileuse',
    weather: bulletin({
      tempC: -8,
      feelsLikeC: -14,
      condition: 'ensoleille',
      city: 'Strasbourg',
      observedAt: '2026-02-03T08:00:00.000Z',
      windKph: 26,
    }),
    preferences: reglages({ city: 'Strasbourg', thermalBias: -1 }),
  },
  {
    id: 'gel-moins5-grenoble-endurant',
    label: 'Gel, −5 °C à Grenoble, ne craint pas le froid',
    weather: bulletin({
      tempC: -5,
      feelsLikeC: -9,
      condition: 'ensoleille',
      city: 'Grenoble',
      observedAt: '2026-12-18T08:00:00.000Z',
      windKph: 18,
    }),
    preferences: reglages({ city: 'Grenoble', thermalBias: 1 }),
  },

  /* --- Neige ------------------------------------------------------ */
  {
    id: 'neige-0-nancy',
    label: 'Neige, 0 °C à Nancy',
    weather: bulletin({
      tempC: 0,
      feelsLikeC: -2,
      condition: 'neige',
      city: 'Nancy',
      observedAt: '2026-01-21T08:00:00.000Z',
      precipitationMm: 2.2,
      precipitationProbability: 75,
      windKph: 14,
    }),
    preferences: reglages({ city: 'Nancy' }),
  },
  {
    id: 'neige-moins3-besancon-endurant',
    label: 'Neige, −3 °C à Besançon, ne craint pas le froid',
    weather: bulletin({
      tempC: -3,
      feelsLikeC: -5,
      condition: 'neige',
      city: 'Besançon',
      observedAt: '2026-02-11T08:00:00.000Z',
      precipitationMm: 3.4,
      precipitationProbability: 90,
      windKph: 16,
    }),
    preferences: reglages({ city: 'Besançon', thermalBias: 1 }),
  },

  /* --- Formalité élevée ------------------------------------------- */
  {
    id: 'soiree-8-automne-formelle',
    label: 'Soirée habillée, 8 °C en automne',
    weather: bulletin({
      tempC: 8,
      feelsLikeC: 7,
      condition: 'nuageux',
      city: 'Paris',
      observedAt: '2026-10-16T08:00:00.000Z',
      windKph: 12,
    }),
    preferences: reglages({ city: 'Paris', formality: 5 }),
  },
  {
    id: 'entretien-14-printemps-formel',
    label: 'Entretien d’embauche, 14 °C au printemps',
    weather: bulletin({
      tempC: 14,
      feelsLikeC: 13,
      condition: 'nuageux',
      city: 'Bordeaux',
      observedAt: '2026-04-02T08:00:00.000Z',
      precipitationProbability: 20,
    }),
    preferences: reglages({ city: 'Bordeaux', formality: 5 }),
  },
];

/* ------------------------------------------------------------------ */
/* Exécution de la recette                                             */
/* ------------------------------------------------------------------ */

/**
 * Joue les 30 scénarios sur un dressing donné.
 * Chaque scénario reçoit une graine dérivée de son identifiant : deux exécutions
 * consécutives rendent exactement le même rapport, au centième de ratio près.
 */
export function runRecette(wardrobe: readonly Garment[]): RecetteReport {
  const items = wardrobe.slice();

  const results: RecetteResult[] = RECETTE_SCENARIOS.map((scenario) => {
    const engineResult = generateOutfits({
      wardrobe: items,
      weather: scenario.weather,
      preferences: scenario.preferences,
      seed: hashString(scenario.id),
      count: 1,
    });

    const outfit = engineResult.outfits[0] ?? null;
    const ratio = outfit === null ? 0 : outfit.thermalRatio;
    const passed = outfit !== null && ratio >= RATIO_MIN && ratio <= RATIO_MAX;

    return { scenario, passed, ratio, outfit };
  });

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;

  return {
    results,
    passed,
    total,
    passRate: total === 0 ? 0 : Math.round((passed / total) * 100),
  };
}
