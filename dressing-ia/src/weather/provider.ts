/**
 * Fournisseurs de bulletin météo. WeatherAPI.com est retenu parce que son plan
 * gratuit (100 000 appels/mois) autorise explicitement l'usage commercial.
 *
 * La démo tourne par défaut sur `MockWeatherProvider` : aucun réseau, aucune clé,
 * et un bulletin reproductible dérivé de la ville et d'une date INJECTÉE
 * (ce module n'appelle jamais `new Date()` ni `Math.random()`).
 */

import type { WeatherCondition, WeatherSnapshot } from '@/domain/types';
import { RAIN_PROBABILITY } from '@/weather/clo-target';

export interface WeatherProvider {
  getToday(city: string): Promise<WeatherSnapshot>;
}

/** Erreur explicite du provider réseau : l'appelant sait qu'il doit retomber sur le mock. */
export class WeatherProviderError extends Error {
  readonly detail: string;

  constructor(message: string, detail = '') {
    super(message);
    this.name = 'WeatherProviderError';
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ */
/* Outils déterministes                                                */
/* ------------------------------------------------------------------ */

/**
 * PRNG et hachage redéfinis ici plutôt qu'importés du moteur : le module météo
 * alimente le moteur, l'inverse créerait une dépendance circulaire.
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a : graine stable à partir d'une chaîne. */
function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Normalisation maison : Hermes n'expose pas toujours String.normalize. */
function normalizeCity(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ûùü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, ' ');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Date acceptée sous forme d'objet ou de chaîne ISO : on ne garde que le jour. */
export type DateLike = Date | string;

function toIsoDate(date: DateLike): string {
  if (typeof date === 'string') {
    const day = date.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : FALLBACK_DATE;
  }
  const time = date.getTime();
  if (Number.isNaN(time)) {
    return FALLBACK_DATE;
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const dayOfMonth = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${dayOfMonth}`;
}

/** Date de repli, fixe et documentée : une démo ne doit jamais dépendre d'une horloge. */
export const FALLBACK_DATE = '2026-03-21';

const DAYS_BEFORE_MONTH: readonly number[] = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function dayOfYear(isoDate: string): number {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  const offset = DAYS_BEFORE_MONTH[clamp(month - 1, 0, 11)] ?? 0;
  return offset + day;
}

/* ------------------------------------------------------------------ */
/* Bulletins de démonstration                                          */
/* ------------------------------------------------------------------ */

/** Clés des bulletins scriptés, utilisées par l'écran de démonstration. */
export type DemoWeatherKey =
  | 'canicule'
  | 'eteDoux'
  | 'miSaison'
  | 'pluie'
  | 'froidSec'
  | 'gel';

/**
 * Jeu de bulletins figés : ils permettent de dérouler la démo devant un client
 * quel que soit le temps qu'il fait réellement dehors.
 */
export const DEMO_WEATHERS: Readonly<Record<DemoWeatherKey, WeatherSnapshot>> = {
  canicule: {
    tempC: 34,
    feelsLikeC: 37,
    tempMinC: 24,
    tempMaxC: 35,
    precipitationMm: 0,
    precipitationProbability: 0,
    windKph: 8,
    condition: 'ensoleille',
    city: 'Paris',
    observedAt: '2026-07-15T08:00:00.000Z',
    isMock: true,
  },
  eteDoux: {
    tempC: 24,
    feelsLikeC: 24,
    tempMinC: 16,
    tempMaxC: 26,
    precipitationMm: 0,
    precipitationProbability: 10,
    windKph: 12,
    condition: 'ensoleille',
    city: 'Paris',
    observedAt: '2026-06-10T08:00:00.000Z',
    isMock: true,
  },
  miSaison: {
    tempC: 15,
    feelsLikeC: 14,
    tempMinC: 9,
    tempMaxC: 17,
    precipitationMm: 0,
    precipitationProbability: 25,
    windKph: 15,
    condition: 'nuageux',
    city: 'Paris',
    observedAt: '2026-04-12T08:00:00.000Z',
    isMock: true,
  },
  pluie: {
    tempC: 11,
    feelsLikeC: 9,
    tempMinC: 8,
    tempMaxC: 13,
    precipitationMm: 6.4,
    precipitationProbability: 80,
    windKph: 22,
    condition: 'pluie',
    city: 'Paris',
    observedAt: '2026-10-08T08:00:00.000Z',
    isMock: true,
  },
  froidSec: {
    tempC: 3,
    feelsLikeC: 1,
    tempMinC: -1,
    tempMaxC: 5,
    precipitationMm: 0,
    precipitationProbability: 5,
    windKph: 10,
    condition: 'ensoleille',
    city: 'Paris',
    observedAt: '2026-01-20T08:00:00.000Z',
    isMock: true,
  },
  gel: {
    tempC: -4,
    feelsLikeC: -11,
    tempMinC: -7,
    tempMaxC: -1,
    precipitationMm: 0,
    precipitationProbability: 15,
    windKph: 35,
    condition: 'nuageux',
    city: 'Paris',
    observedAt: '2026-02-05T08:00:00.000Z',
    isMock: true,
  },
};

/** Libellés français des bulletins scriptés, pour les boutons de la démo. */
export const DEMO_WEATHER_LABELS: Readonly<Record<DemoWeatherKey, string>> = {
  canicule: 'Canicule, 34 °C',
  eteDoux: 'Été doux, 24 °C',
  miSaison: 'Mi-saison, 15 °C',
  pluie: 'Pluie, 11 °C',
  froidSec: 'Froid sec, 3 °C',
  gel: 'Gel et vent, −4 °C',
};

export interface DemoWeatherEntry {
  key: DemoWeatherKey;
  label: string;
  weather: WeatherSnapshot;
}

/** Même jeu, sous forme de liste ordonnée, prêt pour un `map` dans l'interface. */
export const DEMO_WEATHER_LIST: readonly DemoWeatherEntry[] = (
  ['canicule', 'eteDoux', 'miSaison', 'pluie', 'froidSec', 'gel'] as const
).map((key) => ({ key, label: DEMO_WEATHER_LABELS[key], weather: DEMO_WEATHERS[key] }));

/* ------------------------------------------------------------------ */
/* Provider de démonstration                                           */
/* ------------------------------------------------------------------ */

/** Moyenne annuelle et amplitude saisonnière, en °C (climat tempéré océanique). */
const YEAR_MEAN_C = 12.5;
const YEAR_AMPLITUDE_C = 8.5;
/** Jour le plus chaud de l'année (mi-juillet). */
const WARMEST_DAY = 202;

/**
 * Écart au climat de référence, en °C, pour les villes les plus courantes.
 * Sans cette table, Nice pourrait tomber plus froide que Lille : le bulletin
 * resterait déterministe, mais il ne serait plus crédible en démonstration.
 * Ville inconnue ⇒ décalage dérivé du nom, stable d'un jour à l'autre.
 */
const CITY_OFFSETS: Readonly<Record<string, number>> = {
  nice: 4,
  marseille: 3.5,
  toulon: 3.5,
  montpellier: 3,
  perpignan: 3,
  ajaccio: 3,
  bastia: 3,
  biarritz: 2,
  toulouse: 1.5,
  bordeaux: 1.5,
  nantes: 1.2,
  'la rochelle': 1.2,
  lyon: 0.5,
  grenoble: 0,
  paris: 0,
  tours: 0,
  rennes: -0.3,
  dijon: -0.5,
  brest: -0.5,
  strasbourg: -1,
  lille: -1.2,
  rouen: -1.2,
  amiens: -1.5,
  reims: -1.5,
  nancy: -1.8,
  besancon: -2,
  'clermont-ferrand': -2,
};

/**
 * Bulletin plausible et reproductible, dérivé de la ville et de la date.
 * La même paire (ville, date) redonne toujours le même bulletin : c'est ce qui
 * rend la démonstration rejouable à l'identique devant un client.
 */
export class MockWeatherProvider implements WeatherProvider {
  private readonly isoDate: string;

  constructor(date: DateLike = FALLBACK_DATE) {
    this.isoDate = toIsoDate(date);
  }

  /** Date effectivement utilisée, exposée pour l'affichage et les tests. */
  get date(): string {
    return this.isoDate;
  }

  getToday(city: string): Promise<WeatherSnapshot> {
    return Promise.resolve(this.snapshotFor(city));
  }

  /** Variante synchrone : pratique pour l'état initial d'un écran. */
  snapshotFor(city: string): WeatherSnapshot {
    return buildMockSnapshot(city, this.isoDate);
  }
}

function buildMockSnapshot(city: string, isoDate: string): WeatherSnapshot {
  const key = normalizeCity(city) || 'paris';
  const cityRandom = mulberry32(hashString(key));
  const random = mulberry32(hashString(`${key}|${isoDate}`));

  const doy = dayOfYear(isoDate);
  const seasonal = YEAR_MEAN_C + YEAR_AMPLITUDE_C * Math.cos((2 * Math.PI * (doy - WARMEST_DAY)) / 365);

  // Décalage propre à la ville (latitude, littoral) : stable d'un jour à l'autre.
  const knownOffset: number | undefined = CITY_OFFSETS[key];
  const cityOffset = knownOffset ?? (cityRandom() - 0.5) * 5;
  const dailySwing = (random() - 0.5) * 7;
  const tempC = round1(seasonal + cityOffset + dailySwing);

  // Il pleut davantage hors saison chaude.
  const wetSeason = 1.35 - 0.7 * Math.cos((2 * Math.PI * (doy - 15)) / 365);
  const precipitationProbability = Math.round(clamp(random() * 100 * wetSeason * 0.75, 0, 95));
  const windKph = Math.round(clamp(4 + random() * 26 + (precipitationProbability > 60 ? 8 : 0), 2, 60));

  // Même seuil que la cible d'isolation : le bulletin et la recommandation
  // ne peuvent pas être en désaccord sur « est-ce qu'il pleut ».
  const rainy = precipitationProbability >= RAIN_PROBABILITY;
  const precipitationMm = rainy ? round1((precipitationProbability / 100) * (0.6 + random() * 6)) : 0;
  const condition = pickMockCondition(tempC, precipitationProbability, windKph, random());

  const feelsLikeC = round1(feelsLike(tempC, windKph, rainy));
  const spread = 2 + random() * 3;

  return {
    tempC,
    feelsLikeC,
    tempMinC: round1(tempC - spread),
    tempMaxC: round1(tempC + spread * 0.8),
    precipitationMm,
    precipitationProbability,
    windKph,
    condition,
    city: city.trim() === '' ? 'Paris' : city.trim(),
    observedAt: `${isoDate}T08:00:00.000Z`,
    isMock: true,
  };
}

/** Ressenti : refroidissement éolien sous 12 °C, lourdeur moite au-dessus de 26 °C. */
function feelsLike(tempC: number, windKph: number, rainy: boolean): number {
  if (tempC <= 12) {
    const chill = Math.min(8, windKph * 0.14) + (rainy ? 1 : 0);
    return tempC - chill;
  }
  if (tempC >= 26) {
    return tempC + Math.min(4, (tempC - 26) * 0.5 + 1);
  }
  return tempC - (rainy ? 1 : 0);
}

function pickMockCondition(
  tempC: number,
  precipitationProbability: number,
  windKph: number,
  draw: number,
): WeatherCondition {
  if (precipitationProbability >= RAIN_PROBABILITY) {
    if (tempC <= 1) return 'neige';
    if (tempC >= 24 && draw > 0.6) return 'orage';
    return 'pluie';
  }
  if (precipitationProbability >= 30) {
    return 'nuageux';
  }
  // Brouillard : air froid, vent faible, petit matin d'arrière-saison.
  if (tempC <= 8 && windKph <= 8 && draw < 0.25) {
    return 'brouillard';
  }
  return draw < 0.55 ? 'ensoleille' : 'nuageux';
}

/* ------------------------------------------------------------------ */
/* Provider réel : WeatherAPI.com                                      */
/* ------------------------------------------------------------------ */

interface FetchResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<FetchResponseLike>;

export interface WeatherApiOptions {
  /** Injection pour les tests ; par défaut le `fetch` global (web et natif). */
  fetchImpl?: FetchLike;
  /** Délai au-delà duquel on abandonne et on laisse l'appelant retomber sur le mock. */
  timeoutMs?: number;
  /** Provider de secours appelé si la clé manque ou si l'appel échoue. */
  fallback?: WeatherProvider;
}

const DEFAULT_TIMEOUT_MS = 6000;
const WEATHER_API_URL = 'https://api.weatherapi.com/v1/forecast.json';

/** Codes de condition WeatherAPI regroupés vers notre vocabulaire. */
const THUNDER_CODES: readonly number[] = [1087, 1273, 1276, 1279, 1282];
const SNOW_CODES: readonly number[] = [
  1066, 1069, 1072, 1114, 1117, 1147, 1168, 1171, 1198, 1201, 1204, 1207, 1210, 1213, 1216, 1219,
  1222, 1225, 1237, 1249, 1252, 1255, 1258, 1261, 1264,
];
const RAIN_CODES: readonly number[] = [1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246];
const FOG_CODES: readonly number[] = [1030, 1135];
const CLOUD_CODES: readonly number[] = [1003, 1006, 1009];

/** Traduit un code WeatherAPI en `WeatherCondition`. Repli : nuageux. */
export function mapWeatherApiCode(code: number): WeatherCondition {
  if (code === 1000) return 'ensoleille';
  if (THUNDER_CODES.includes(code)) return 'orage';
  if (SNOW_CODES.includes(code)) return 'neige';
  if (RAIN_CODES.includes(code)) return 'pluie';
  if (FOG_CODES.includes(code)) return 'brouillard';
  if (CLOUD_CODES.includes(code)) return 'nuageux';
  return 'nuageux';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNumber(source: unknown, key: string, fallback: number): number {
  if (!isRecord(source)) return fallback;
  const value = source[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readString(source: unknown, key: string, fallback: string): string {
  if (!isRecord(source)) return fallback;
  const value = source[key];
  return typeof value === 'string' && value !== '' ? value : fallback;
}

function readObject(source: unknown, key: string): unknown {
  return isRecord(source) ? source[key] : undefined;
}

/** « 2026-09-21 08:30 » → « 2026-09-21T08:30:00.000Z ». */
function toIsoInstant(raw: string, isoDateFallback: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/.exec(raw);
  if (match === null) {
    return `${isoDateFallback}T08:00:00.000Z`;
  }
  return `${match[1]}T${match[2]}:00.000Z`;
}

/**
 * Adaptateur WeatherAPI.com. Il échoue proprement : clé absente, HTTP en erreur,
 * délai dépassé ou charge utile inattendue ⇒ `fallback` si fourni, sinon
 * `WeatherProviderError`. Jamais de crash silencieux, jamais de donnée inventée.
 */
export class WeatherApiProvider implements WeatherProvider {
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly timeoutMs: number;
  private readonly fallback: WeatherProvider | undefined;

  constructor(apiKey: string, options: WeatherApiOptions = {}) {
    this.apiKey = apiKey.trim();
    this.fetchImpl = options.fetchImpl ?? globalFetch();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.fallback = options.fallback;
  }

  async getToday(city: string): Promise<WeatherSnapshot> {
    try {
      return await this.fetchToday(city);
    } catch (error) {
      if (this.fallback !== undefined) {
        return this.fallback.getToday(city);
      }
      throw error instanceof WeatherProviderError
        ? error
        : new WeatherProviderError('Météo indisponible.', String(error));
    }
  }

  private async fetchToday(city: string): Promise<WeatherSnapshot> {
    if (this.apiKey === '') {
      throw new WeatherProviderError('Clé WeatherAPI absente.');
    }
    const doFetch = this.fetchImpl;
    if (doFetch === undefined) {
      throw new WeatherProviderError('Aucune implémentation de fetch disponible.');
    }

    const url =
      `${WEATHER_API_URL}?key=${encodeURIComponent(this.apiKey)}` +
      `&q=${encodeURIComponent(city)}&days=1&aqi=no&alerts=no&lang=fr`;

    const controller = createAbortController();
    const timer =
      controller === undefined
        ? undefined
        : setTimeout(() => {
            controller.abort();
          }, this.timeoutMs);

    try {
      const response = await doFetch(url, controller === undefined ? undefined : { signal: controller.signal });
      if (!response.ok) {
        throw new WeatherProviderError('Appel WeatherAPI refusé.', `HTTP ${response.status}`);
      }
      return mapWeatherApiPayload(await response.json(), city);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}

/** Conversion de la charge utile WeatherAPI en `WeatherSnapshot`. Exportée pour les tests. */
export function mapWeatherApiPayload(payload: unknown, requestedCity: string): WeatherSnapshot {
  const current = readObject(payload, 'current');
  const location = readObject(payload, 'location');
  const forecast = readObject(payload, 'forecast');
  const forecastDays = readObject(forecast, 'forecastday');
  const firstDay = Array.isArray(forecastDays) ? forecastDays[0] : undefined;
  const day = readObject(firstDay, 'day');

  if (!isRecord(current)) {
    throw new WeatherProviderError('Réponse WeatherAPI inexploitable.');
  }

  const tempC = readNumber(current, 'temp_c', Number.NaN);
  if (Number.isNaN(tempC)) {
    throw new WeatherProviderError('Réponse WeatherAPI sans température.');
  }

  const code = readNumber(readObject(current, 'condition'), 'code', 1003);
  const lastUpdated = readString(current, 'last_updated', '');
  const dayIso = readString(firstDay, 'date', FALLBACK_DATE);

  return {
    tempC: round1(tempC),
    feelsLikeC: round1(readNumber(current, 'feelslike_c', tempC)),
    tempMinC: round1(readNumber(day, 'mintemp_c', tempC - 3)),
    tempMaxC: round1(readNumber(day, 'maxtemp_c', tempC + 3)),
    precipitationMm: round1(readNumber(day, 'totalprecip_mm', readNumber(current, 'precip_mm', 0))),
    precipitationProbability: Math.round(clamp(readNumber(day, 'daily_chance_of_rain', 0), 0, 100)),
    windKph: Math.round(readNumber(current, 'wind_kph', 0)),
    condition: mapWeatherApiCode(code),
    city: readString(location, 'name', requestedCity),
    observedAt: toIsoInstant(lastUpdated, dayIso),
    isMock: false,
  };
}

/** `fetch` global, récupéré sans dépendre du DOM : présent sur web comme sur natif. */
function globalFetch(): FetchLike | undefined {
  const candidate = (globalThis as { fetch?: unknown }).fetch;
  return typeof candidate === 'function' ? (candidate as FetchLike) : undefined;
}

/** `AbortController` n'est pas garanti sur toutes les cibles : on le lit prudemment. */
function createAbortController(): AbortController | undefined {
  const candidate = (globalThis as { AbortController?: unknown }).AbortController;
  if (typeof candidate !== 'function') {
    return undefined;
  }
  const Ctor = candidate as new () => AbortController;
  return new Ctor();
}

/* ------------------------------------------------------------------ */
/* Sélection du provider                                               */
/* ------------------------------------------------------------------ */

export interface ResolveProviderOptions {
  /** Date injectée pour le mock (jamais d'horloge dans ce module). */
  today?: DateLike;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

/**
 * Provider réel si une clé est fournie, mock sinon.
 * Le provider réel garde le mock en secours : la démo ne tombe jamais en panne.
 */
export function resolveProvider(apiKey?: string, options: ResolveProviderOptions = {}): WeatherProvider {
  const mock = new MockWeatherProvider(options.today ?? FALLBACK_DATE);
  const key = (apiKey ?? '').trim();
  if (key === '') {
    return mock;
  }
  return new WeatherApiProvider(key, {
    fetchImpl: options.fetchImpl,
    timeoutMs: options.timeoutMs,
    fallback: mock,
  });
}
