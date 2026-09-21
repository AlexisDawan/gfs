/**
 * État global du dressing : contexte React natif, sans dépendance externe.
 *
 * Deux règles structurantes :
 *  - la date du jour est injectée UNE SEULE FOIS au montage du provider, puis
 *    conservée dans l'état ; aucune logique en aval n'appelle `new Date()`, ce
 *    qui garde les propositions reproductibles pendant toute la démonstration ;
 *  - la persistance est « au mieux » : si le stockage est vide ou refusé, on
 *    repart du dressing de démonstration.
 */

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { DEMO_PREFERENCES, DEMO_WARDROBE } from '@/data/wardrobe';
import { hashString } from '@/domain/engine';
import type {
  Category,
  Formality,
  Garment,
  Outfit,
  Preferences,
  WeatherSnapshot,
} from '@/domain/types';
import { getItem, setItem } from '@/store/storage';
import {
  DEMO_WEATHERS,
  MockWeatherProvider,
  type DateLike,
  type DemoWeatherKey,
} from '@/weather/provider';

/* ------------------------------------------------------------------ */
/* Clés de persistance                                                 */
/* ------------------------------------------------------------------ */

const STORAGE_PREFIX = 'dressing-ia/v1';
const KEY_WARDROBE = `${STORAGE_PREFIX}/wardrobe`;
const KEY_PREFERENCES = `${STORAGE_PREFIX}/preferences`;
const KEY_HISTORY = `${STORAGE_PREFIX}/history`;
const KEY_DEMO_WEATHER = `${STORAGE_PREFIX}/demo-weather`;

/** Bulletin déduit de la ville et de la date du jour, par opposition aux bulletins scriptés. */
export const AUTO_WEATHER_KEY = 'auto';

/** Au-delà, l'historique des signatures ne sert plus à rien et alourdit le stockage. */
const HISTORY_LIMIT = 60;

/* ------------------------------------------------------------------ */
/* Types publics du module                                             */
/* ------------------------------------------------------------------ */

/** Pièce en cours de saisie : l'identité et les compteurs sont posés par le store. */
export type GarmentDraft = Omit<Garment, 'id' | 'wearCount' | 'favorite' | 'createdAt'> &
  Partial<Pick<Garment, 'wearCount' | 'favorite'>>;

export interface WardrobeState {
  wardrobe: Garment[];
  preferences: Preferences;
  weather: WeatherSnapshot;
  /** Clé du bulletin scripté, ou `AUTO_WEATHER_KEY`. */
  selectedDemoWeather: string;
  /** Signatures de tenues déjà proposées, pour ne pas se répéter. */
  history: string[];
  loading: boolean;
  /** Date injectée au montage, au format AAAA-MM-JJ. */
  today: string;
}

export interface WardrobeActions {
  addGarment: (draft: GarmentDraft) => void;
  updateGarment: (id: string, patch: Partial<Omit<Garment, 'id'>>) => void;
  removeGarment: (id: string) => void;
  toggleFavorite: (id: string) => void;
  /** Incrémente `wearCount` de chaque pièce de la tenue et mémorise sa signature. */
  markWorn: (outfit: Outfit) => void;
  setPreferences: (patch: Partial<Preferences>) => void;
  setDemoWeather: (key: string) => void;
  /** Recharge le dressing de démonstration et efface l'historique. */
  resetDemo: () => void;
  /** Vide le dressing : sert à montrer l'écran vide et le message de pénurie. */
  clearWardrobe: () => void;
  /** Mémorise des signatures proposées, pour varier la génération suivante. */
  rememberSignatures: (signatures: readonly string[]) => void;
  clearHistory: () => void;
}

export type WardrobeContextValue = WardrobeState & WardrobeActions;

/* ------------------------------------------------------------------ */
/* Météo                                                               */
/* ------------------------------------------------------------------ */

function isDemoWeatherKey(key: string): key is DemoWeatherKey {
  return Object.prototype.hasOwnProperty.call(DEMO_WEATHERS, key);
}

/**
 * Bulletin courant. Clé scriptée ⇒ bulletin figé ; sinon bulletin simulé,
 * déterministe, dérivé de la ville et de la date injectée. Aucun appel réseau.
 */
function resolveWeather(key: string, city: string, today: string): WeatherSnapshot {
  if (isDemoWeatherKey(key)) {
    return DEMO_WEATHERS[key];
  }
  return new MockWeatherProvider(today).snapshotFor(city);
}

/* ------------------------------------------------------------------ */
/* Identifiants déterministes                                          */
/* ------------------------------------------------------------------ */

const CATEGORY_PREFIX: Readonly<Record<Category, string>> = {
  haut: 'h',
  bas: 'b',
  robe: 'r',
  veste: 'v',
  chaussures: 'c',
  accessoire: 'a',
};

/** Translittération maison : Hermes n'expose pas toujours `String.normalize`. */
function slugify(raw: string): string {
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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Identifiant stable, sans horloge ni aléa : même saisie ⇒ même identifiant. */
function nextGarmentId(draft: GarmentDraft, taken: ReadonlySet<string>): string {
  const prefix = CATEGORY_PREFIX[draft.category];
  const slug = slugify(draft.name) || hashString(`${draft.category}|${draft.subcategory}`).toString(36);
  const base = `${prefix}-${slug}`;
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

/* ------------------------------------------------------------------ */
/* Lecture défensive du stockage                                       */
/* ------------------------------------------------------------------ */

function parseJson(raw: string | null): unknown {
  if (raw === null || raw === '') {
    return null;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    // Donnée corrompue : on l'ignore, la démo repart des valeurs par défaut.
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

/** Contrôle de forme minimal : on refuse une pièce inexploitable par le moteur. */
function isGarment(value: unknown): value is Garment {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.category === 'string' &&
    Object.prototype.hasOwnProperty.call(CATEGORY_PREFIX, value.category) &&
    typeof value.subcategory === 'string' &&
    (value.hue === null || typeof value.hue === 'number') &&
    typeof value.saturation === 'number' &&
    typeof value.lightness === 'number' &&
    typeof value.colorName === 'string' &&
    typeof value.clo === 'number' &&
    typeof value.formality === 'number' &&
    Array.isArray(value.seasons) &&
    typeof value.layer === 'number' &&
    typeof value.wearCount === 'number' &&
    typeof value.favorite === 'boolean' &&
    typeof value.createdAt === 'string'
  );
}

function parseWardrobe(raw: string | null): Garment[] | null {
  const parsed = parseJson(raw);
  if (!Array.isArray(parsed)) {
    return null;
  }
  // Un dressing vidé volontairement est une donnée valide : on garde le tableau vide.
  return parsed.filter(isGarment);
}

function parsePreferences(raw: string | null): Preferences | null {
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) {
    return null;
  }
  const formality = parsed.formality;
  const bias = parsed.thermalBias;
  return {
    formality:
      typeof formality === 'number' && formality >= 1 && formality <= 5
        ? (Math.round(formality) as Formality)
        : DEMO_PREFERENCES.formality,
    avoidedColors: isStringArray(parsed.avoidedColors) ? parsed.avoidedColors : [],
    excludedCategories: Array.isArray(parsed.excludedCategories)
      ? parsed.excludedCategories.filter(
          (entry): entry is Category =>
            typeof entry === 'string' && Object.prototype.hasOwnProperty.call(CATEGORY_PREFIX, entry),
        )
      : [],
    thermalBias: bias === -1 || bias === 0 || bias === 1 ? bias : DEMO_PREFERENCES.thermalBias,
    city: typeof parsed.city === 'string' && parsed.city.trim() !== '' ? parsed.city : DEMO_PREFERENCES.city,
  };
}

/* ------------------------------------------------------------------ */
/* Réducteur                                                           */
/* ------------------------------------------------------------------ */

interface HydratePayload {
  wardrobe: Garment[] | null;
  preferences: Preferences | null;
  history: string[] | null;
  selectedDemoWeather: string | null;
}

type Action =
  | { type: 'hydrate'; payload: HydratePayload }
  | { type: 'addGarment'; draft: GarmentDraft }
  | { type: 'updateGarment'; id: string; patch: Partial<Omit<Garment, 'id'>> }
  | { type: 'removeGarment'; id: string }
  | { type: 'toggleFavorite'; id: string }
  | { type: 'markWorn'; outfit: Outfit }
  | { type: 'setPreferences'; patch: Partial<Preferences> }
  | { type: 'setDemoWeather'; key: string }
  | { type: 'resetDemo' }
  | { type: 'clearWardrobe' }
  | { type: 'rememberSignatures'; signatures: readonly string[] }
  | { type: 'clearHistory' };

function pushSignatures(history: readonly string[], signatures: readonly string[]): string[] {
  const merged = history.slice();
  for (const signature of signatures) {
    if (signature !== '' && !merged.includes(signature)) {
      merged.push(signature);
    }
  }
  return merged.length > HISTORY_LIMIT ? merged.slice(merged.length - HISTORY_LIMIT) : merged;
}

/** Recalcule le bulletin après tout changement de clé, de ville ou de date. */
function withWeather(state: WardrobeState): WardrobeState {
  return {
    ...state,
    weather: resolveWeather(state.selectedDemoWeather, state.preferences.city, state.today),
  };
}

function reducer(state: WardrobeState, action: Action): WardrobeState {
  switch (action.type) {
    case 'hydrate': {
      const preferences = action.payload.preferences ?? DEMO_PREFERENCES;
      const next: WardrobeState = {
        ...state,
        wardrobe: action.payload.wardrobe ?? DEMO_WARDROBE.slice(),
        preferences,
        history: action.payload.history ?? [],
        selectedDemoWeather: action.payload.selectedDemoWeather ?? state.selectedDemoWeather,
        loading: false,
      };
      return withWeather(next);
    }

    case 'addGarment': {
      const taken = new Set(state.wardrobe.map((g) => g.id));
      const garment: Garment = {
        ...action.draft,
        id: nextGarmentId(action.draft, taken),
        wearCount: action.draft.wearCount ?? 0,
        favorite: action.draft.favorite ?? false,
        createdAt: `${state.today}T08:00:00.000Z`,
      };
      return { ...state, wardrobe: [garment, ...state.wardrobe] };
    }

    case 'updateGarment':
      return {
        ...state,
        wardrobe: state.wardrobe.map((garment) =>
          garment.id === action.id ? { ...garment, ...action.patch, id: garment.id } : garment,
        ),
      };

    case 'removeGarment':
      return { ...state, wardrobe: state.wardrobe.filter((garment) => garment.id !== action.id) };

    case 'toggleFavorite':
      return {
        ...state,
        wardrobe: state.wardrobe.map((garment) =>
          garment.id === action.id ? { ...garment, favorite: !garment.favorite } : garment,
        ),
      };

    case 'markWorn': {
      const worn = new Set(action.outfit.items.map((item) => item.garment.id));
      return {
        ...state,
        wardrobe: state.wardrobe.map((garment) =>
          worn.has(garment.id) ? { ...garment, wearCount: garment.wearCount + 1 } : garment,
        ),
        history: pushSignatures(state.history, [action.outfit.signature]),
      };
    }

    case 'setPreferences': {
      const preferences: Preferences = { ...state.preferences, ...action.patch };
      return withWeather({ ...state, preferences });
    }

    case 'setDemoWeather':
      return withWeather({ ...state, selectedDemoWeather: action.key });

    case 'resetDemo':
      // Copie : le jeu de démonstration ne doit jamais être modifié en place.
      return { ...state, wardrobe: DEMO_WARDROBE.slice(), history: [] };

    case 'clearWardrobe':
      return { ...state, wardrobe: [], history: [] };

    case 'rememberSignatures':
      return { ...state, history: pushSignatures(state.history, action.signatures) };

    case 'clearHistory':
      return { ...state, history: [] };
  }
}

/* ------------------------------------------------------------------ */
/* Provider                                                            */
/* ------------------------------------------------------------------ */

const WardrobeContext = createContext<WardrobeContextValue | null>(null);

/** Date du jour au format AAAA-MM-JJ, en heure locale. Appelée une seule fois. */
function toIsoDay(date: DateLike): string {
  if (typeof date === 'string') {
    return date.slice(0, 10);
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface WardrobeProviderProps {
  children: ReactNode;
  /** Date injectable, pour rejouer une démonstration ou un test à l'identique. */
  today?: DateLike;
  /** Bulletin affiché au premier rendu. */
  initialDemoWeather?: string;
}

function initialState(today: string, demoWeatherKey: string): WardrobeState {
  return {
    wardrobe: DEMO_WARDROBE.slice(),
    preferences: DEMO_PREFERENCES,
    weather: resolveWeather(demoWeatherKey, DEMO_PREFERENCES.city, today),
    selectedDemoWeather: demoWeatherKey,
    history: [],
    loading: true,
    today,
  };
}

export function WardrobeProvider(props: WardrobeProviderProps) {
  const { children, today, initialDemoWeather } = props;

  // Seul point d'entrée d'une horloge dans toute l'application : figé au montage.
  const [injectedToday] = useState<string>(() => toIsoDay(today ?? new Date()));
  const [startKey] = useState<string>(() => initialDemoWeather ?? AUTO_WEATHER_KEY);

  const [state, dispatch] = useReducer(reducer, undefined, () => initialState(injectedToday, startKey));

  // Hydratation : une seule fois, et sans écraser l'état si le composant est démonté.
  const hydrated = useRef(false);
  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      const [rawWardrobe, rawPreferences, rawHistory, rawKey] = await Promise.all([
        getItem(KEY_WARDROBE),
        getItem(KEY_PREFERENCES),
        getItem(KEY_HISTORY),
        getItem(KEY_DEMO_WEATHER),
      ]);
      if (cancelled) {
        return;
      }
      hydrated.current = true;
      const parsedHistory = parseJson(rawHistory);
      dispatch({
        type: 'hydrate',
        payload: {
          wardrobe: parseWardrobe(rawWardrobe),
          preferences: parsePreferences(rawPreferences),
          history: isStringArray(parsedHistory) ? parsedHistory : null,
          selectedDemoWeather: rawKey !== null && rawKey !== '' ? rawKey : null,
        },
      });
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Écritures : jamais avant l'hydratation, sinon on écraserait le stockage
  // existant avec les valeurs de démonstration du premier rendu.
  useEffect(() => {
    if (!hydrated.current) return;
    void setItem(KEY_WARDROBE, JSON.stringify(state.wardrobe));
  }, [state.wardrobe]);

  useEffect(() => {
    if (!hydrated.current) return;
    void setItem(KEY_PREFERENCES, JSON.stringify(state.preferences));
  }, [state.preferences]);

  useEffect(() => {
    if (!hydrated.current) return;
    void setItem(KEY_HISTORY, JSON.stringify(state.history));
  }, [state.history]);

  useEffect(() => {
    if (!hydrated.current) return;
    void setItem(KEY_DEMO_WEATHER, state.selectedDemoWeather);
  }, [state.selectedDemoWeather]);

  const addGarment = useCallback((draft: GarmentDraft) => {
    dispatch({ type: 'addGarment', draft });
  }, []);

  const updateGarment = useCallback((id: string, patch: Partial<Omit<Garment, 'id'>>) => {
    dispatch({ type: 'updateGarment', id, patch });
  }, []);

  const removeGarment = useCallback((id: string) => {
    dispatch({ type: 'removeGarment', id });
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    dispatch({ type: 'toggleFavorite', id });
  }, []);

  const markWorn = useCallback((outfit: Outfit) => {
    dispatch({ type: 'markWorn', outfit });
  }, []);

  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    dispatch({ type: 'setPreferences', patch });
  }, []);

  const setDemoWeather = useCallback((key: string) => {
    dispatch({ type: 'setDemoWeather', key });
  }, []);

  const resetDemo = useCallback(() => {
    dispatch({ type: 'resetDemo' });
  }, []);

  const clearWardrobe = useCallback(() => {
    dispatch({ type: 'clearWardrobe' });
  }, []);

  const rememberSignatures = useCallback((signatures: readonly string[]) => {
    dispatch({ type: 'rememberSignatures', signatures });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'clearHistory' });
  }, []);

  const value = useMemo<WardrobeContextValue>(
    () => ({
      ...state,
      addGarment,
      updateGarment,
      removeGarment,
      toggleFavorite,
      markWorn,
      setPreferences,
      setDemoWeather,
      resetDemo,
      clearWardrobe,
      rememberSignatures,
      clearHistory,
    }),
    [
      state,
      addGarment,
      updateGarment,
      removeGarment,
      toggleFavorite,
      markWorn,
      setPreferences,
      setDemoWeather,
      resetDemo,
      clearWardrobe,
      rememberSignatures,
      clearHistory,
    ],
  );

  // `createElement` plutôt que du JSX : ce module reste un fichier .ts.
  return createElement(WardrobeContext.Provider, { value }, children);
}

export function useWardrobe(): WardrobeContextValue {
  const value = useContext(WardrobeContext);
  if (value === null) {
    throw new Error('useWardrobe() doit être appelé à l’intérieur de <WardrobeProvider>.');
  }
  return value;
}
