export type WorkerDraftKind = 'servicio' | 'entrega-llaves' | 'incidencia' | 'sugerencia';

const STORAGE_PREFIX = 'rh_worker_draft_v1';

function draftKey(userId: string, kind: WorkerDraftKind): string {
  return `${STORAGE_PREFIX}:${userId}:${kind}`;
}

function notifyDraftChange(): void {
  window.dispatchEvent(new CustomEvent('rh-worker-draft-change'));
}

export function loadWorkerDraft<T>(userId: string, kind: WorkerDraftKind): T | null {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(draftKey(userId, kind));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveWorkerDraft<T>(userId: string, kind: WorkerDraftKind, data: T): void {
  if (!userId) return;
  try {
    localStorage.setItem(draftKey(userId, kind), JSON.stringify(data));
    notifyDraftChange();
  } catch (err) {
    console.warn('[workerFormDrafts] No se pudo guardar borrador:', err);
  }
}

export function clearWorkerDraft(userId: string, kind: WorkerDraftKind): void {
  if (!userId) return;
  localStorage.removeItem(draftKey(userId, kind));
  notifyDraftChange();
}

export type WorkerDraftFlags = Record<WorkerDraftKind, boolean>;

export function getWorkerDraftFlags(
  userId: string,
  isEmptyByKind: Record<WorkerDraftKind, (data: unknown) => boolean>
): WorkerDraftFlags {
  const kinds: WorkerDraftKind[] = ['servicio', 'entrega-llaves', 'incidencia', 'sugerencia'];
  const flags = {} as WorkerDraftFlags;
  for (const kind of kinds) {
    const data = loadWorkerDraft(userId, kind);
    flags[kind] = data != null && !isEmptyByKind[kind](data);
  }
  return flags;
}
