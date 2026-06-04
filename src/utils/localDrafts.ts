// Borradores locales (solo navegador): se guardan al salir del informe sin pulsar "Guardar".
// Cuando el usuario pulsa "Guardar en borrador" se persiste en Supabase y se limpia el local.

import type { DraftKind } from '../services/reportsApi';

const KEY_PREFIX = 'worker_local_draft_';

const keyFor = (kind: DraftKind) => `${KEY_PREFIX}${kind}`;

export const localDrafts = {
  save<T>(kind: DraftKind, payload: T): void {
    try {
      localStorage.setItem(keyFor(kind), JSON.stringify(payload));
    } catch {
      /* quota / privado: ignoramos */
    }
  },
  load<T = unknown>(kind: DraftKind): T | null {
    try {
      const raw = localStorage.getItem(keyFor(kind));
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  clear(kind: DraftKind): void {
    try {
      localStorage.removeItem(keyFor(kind));
    } catch {
      /* noop */
    }
  },
};
