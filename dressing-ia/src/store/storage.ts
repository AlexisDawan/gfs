/**
 * Persistance locale, volontairement minimale.
 *
 * Web : `window.localStorage`. Natif : repli en mémoire, car la dépendance
 * AsyncStorage n'est pas installée et la démo ne doit rien ajouter.
 *
 * Tous les accès sont protégés : en navigation privée, avec les données de site
 * bloquées ou un quota plein, la simple lecture de `localStorage` peut lever.
 * Dans ce cas la couche renvoie « vide » et l'application repart des données de
 * démonstration — jamais d'écran blanc parce qu'un stockage a refusé.
 */

import { Platform } from 'react-native';

/** Sous-ensemble de l'API Web Storage réellement utilisé. */
interface WebStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Nature du support réellement utilisé, exposée pour l'affichage de démonstration. */
export type StorageKind = 'navigateur' | 'memoire';

/** Repli natif (et repli web si localStorage est inaccessible). */
const memoryStore = new Map<string, string>();

function isWebStorage(value: unknown): value is WebStorageLike {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<WebStorageLike>;
  return (
    typeof candidate.getItem === 'function' &&
    typeof candidate.setItem === 'function' &&
    typeof candidate.removeItem === 'function'
  );
}

/**
 * `window.localStorage` quand il existe ET qu'il est lisible.
 * L'accès passe par `globalThis` pour ne dépendre d'aucune API DOM sur natif.
 */
function webStorage(): WebStorageLike | null {
  if (Platform.OS !== 'web') {
    return null;
  }
  try {
    const browserWindow = (globalThis as { window?: { localStorage?: unknown } }).window;
    if (browserWindow === undefined) {
      return null;
    }
    const candidate = browserWindow.localStorage;
    return isWebStorage(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

/** Support effectivement utilisé. Utile pour expliquer au client où vivent ses données. */
export function storageKind(): StorageKind {
  return webStorage() === null ? 'memoire' : 'navigateur';
}

export async function getItem(key: string): Promise<string | null> {
  const web = webStorage();
  if (web !== null) {
    try {
      return web.getItem(key);
    } catch {
      // Stockage refusé en cours de route : on retombe sur la mémoire de session.
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

export async function setItem(key: string, value: string): Promise<void> {
  const web = webStorage();
  if (web !== null) {
    try {
      web.setItem(key, value);
      return;
    } catch {
      // Quota dépassé ou écriture interdite : la session reste cohérente en mémoire.
      memoryStore.set(key, value);
      return;
    }
  }
  memoryStore.set(key, value);
}

export async function removeItem(key: string): Promise<void> {
  const web = webStorage();
  if (web !== null) {
    try {
      web.removeItem(key);
      return;
    } catch {
      memoryStore.delete(key);
      return;
    }
  }
  memoryStore.delete(key);
}

/** Même API regroupée, pratique à injecter dans un test ou un composant. */
export const storage = { getItem, setItem, removeItem, storageKind } as const;
