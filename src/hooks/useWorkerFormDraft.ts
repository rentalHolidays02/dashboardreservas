import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearWorkerDraft,
  loadWorkerDraft,
  saveWorkerDraft,
  type WorkerDraftKind,
} from '../utils/workerFormDrafts';

interface UseWorkerFormDraftOptions<T> {
  userId: string;
  kind: WorkerDraftKind;
  empty: T;
  isEmpty: (data: T) => boolean;
  isOpen: boolean;
}

export function useWorkerFormDraft<T>({
  userId,
  kind,
  empty,
  isEmpty,
  isOpen,
}: UseWorkerFormDraftOptions<T>) {
  const [data, setData] = useState<T>(empty);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || !userId) return;
    const saved = loadWorkerDraft<T>(userId, kind);
    if (saved && !isEmpty(saved)) {
      setData(saved);
      setRestoredFromDraft(true);
    } else {
      setRestoredFromDraft(false);
    }
    hydratedRef.current = true;
  }, [isOpen, userId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!userId || !hydratedRef.current) return;
    if (isEmpty(data)) {
      clearWorkerDraft(userId, kind);
      return;
    }
    const timer = window.setTimeout(() => {
      saveWorkerDraft(userId, kind, data);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [data, userId, kind, isEmpty]);

  const clearDraft = useCallback(() => {
    if (userId) clearWorkerDraft(userId, kind);
    setData(empty);
    setRestoredFromDraft(false);
  }, [userId, kind, empty]);

  const dismissRestoredHint = useCallback(() => setRestoredFromDraft(false), []);

  return {
    data,
    setData,
    clearDraft,
    restoredFromDraft,
    dismissRestoredHint,
    hasDraft: !isEmpty(data),
  };
}
