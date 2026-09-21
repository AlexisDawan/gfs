/**
 * Contrat de types partagé par tout le projet.
 * Aucun module ne redéfinit ces types : ils sont importés depuis ici.
 */

/** Emplacement anatomique. Détermine les créneaux d'une tenue. */
export type Category =
  | 'haut'
  | 'bas'
  | 'robe'
  | 'veste'
  | 'chaussures'
  | 'accessoire';

/** Libellé fin, libre mais tiré de la taxonomie (ex. 't-shirt', 'pull fin'). */
export type Subcategory = string;

/** 1 = très décontracté (jogging) … 5 = très habillé (costume, robe de soirée). */
export type Formality = 1 | 2 | 3 | 4 | 5;

export type Season = 'printemps' | 'ete' | 'automne' | 'hiver';

export type Pattern = 'uni' | 'raye' | 'carreaux' | 'imprime' | 'chine';

export type WeatherCondition =
  | 'ensoleille'
  | 'nuageux'
  | 'pluie'
  | 'neige'
  | 'orage'
  | 'brouillard';

/**
 * Couche de superposition sur le haut du corps.
 * 0 = base (contre la peau), 1 = intermédiaire (pull, gilet), 2 = externe (veste, manteau).
 * Les bas, chaussures et accessoires portent toujours 0.
 */
export type Layer = 0 | 1 | 2;

export interface Garment {
  id: string;
  name: string;
  category: Category;
  subcategory: Subcategory;
  /** Teinte HSL 0–360. `null` pour un neutre (noir, blanc, gris, beige, denim brut). */
  hue: number | null;
  /** Saturation HSL 0–100. */
  saturation: number;
  /** Luminosité HSL 0–100. */
  lightness: number;
  /** Nom lisible de la couleur, utilisé dans les filtres et les explications. */
  colorName: string;
  pattern: Pattern;
  /** Isolation thermique de la pièce seule, en clo (ISO 9920). */
  clo: number;
  formality: Formality;
  seasons: Season[];
  layer: Layer;
  /** Une pièce de `layer` 1 portable seule (ex. un pull épais) a `standalone: true`. */
  standalone?: boolean;
  /** Imperméable / coupe-vent : bonus quand il pleut ou qu'il vente. */
  waterproof?: boolean;
  wearCount: number;
  favorite: boolean;
  /** ISO 8601. */
  createdAt: string;
}

export interface WeatherSnapshot {
  tempC: number;
  feelsLikeC: number;
  tempMinC: number;
  tempMaxC: number;
  precipitationMm: number;
  /** 0–100. */
  precipitationProbability: number;
  windKph: number;
  condition: WeatherCondition;
  city: string;
  /** ISO 8601. */
  observedAt: string;
  /** `true` si la donnée vient du jeu de démonstration et non d'une API. */
  isMock: boolean;
}

export interface Preferences {
  /** Formalité visée par défaut. */
  formality: Formality;
  /** `colorName` que l'utilisateur ne veut jamais voir proposer. */
  avoidedColors: string[];
  /** Catégories exclues des propositions (ex. 'robe'). */
  excludedCategories: Category[];
  /** −1 = frileux (cible clo majorée), 0 = neutre, +1 = ne craint pas le froid. */
  thermalBias: -1 | 0 | 1;
  city: string;
}

export type OutfitSlot =
  | 'base'
  | 'intermediaire'
  | 'externe'
  | 'bas'
  | 'robe'
  | 'chaussures'
  | 'accessoire';

export interface OutfitSlotItem {
  slot: OutfitSlot;
  garment: Garment;
}

export interface OutfitBreakdown {
  /** 0–100 : proximité de l'isolation totale avec la cible du jour. */
  thermal: number;
  /** 0–100 : harmonie colorimétrique. */
  color: number;
  /** 0–100 : cohérence de formalité entre les pièces et avec la préférence. */
  formality: number;
  /** 0–100 : pièces peu portées récemment. */
  novelty: number;
}

export interface Outfit {
  id: string;
  /** Empreinte stable des ids de pièces, pour dédupliquer d'une génération à l'autre. */
  signature: string;
  items: OutfitSlotItem[];
  /** Isolation totale, en clo. */
  totalClo: number;
  /** Cible clo du jour, préférence thermique incluse. */
  targetClo: number;
  /** totalClo / targetClo. Le critère de recette vise 0,85 ≤ ratio ≤ 1,15. */
  thermalRatio: number;
  /** Score global 0–100. */
  score: number;
  breakdown: OutfitBreakdown;
  /** Phrase générée par gabarit à partir du moteur. Aucun appel LLM. */
  explanation: string;
}

export interface EngineInput {
  wardrobe: Garment[];
  weather: WeatherSnapshot;
  preferences: Preferences;
  /** Signatures déjà proposées, à éviter pour varier les suggestions. */
  excludeSignatures?: string[];
  /** Graine du générateur pseudo-aléatoire. Même graine ⇒ même résultat. */
  seed?: number;
  /** Nombre de tenues à renvoyer (défaut 3). */
  count?: number;
}

export interface EngineShortfall {
  /** Message lisible expliquant pourquoi aucune tenue n'est générable. */
  reason: string;
  /** Catégories manquantes ou insuffisantes dans le dressing. */
  missing: Category[];
}

export interface EngineResult {
  outfits: Outfit[];
  shortfall: EngineShortfall | null;
  /** Cible clo retenue, exposée pour l'affichage et les tests. */
  targetClo: number;
}
