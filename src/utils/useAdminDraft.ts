import { useEffect, useRef } from 'react';

export function useAdminDraft<T>(
  key: string,
  isNew: boolean,
  state: T,
  setFromDraft: (data: T) => void
) {
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isNew && isInitialMount.current) {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setFromDraft(parsed);
        } catch (e) {
          console.error('Error loading draft', e);
        }
      }
    }
    isInitialMount.current = false;
  }, [key, isNew, setFromDraft]);

  useEffect(() => {
    if (isNew && !isInitialMount.current) {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, isNew, state]);

  return () => {
    localStorage.removeItem(key);
  };
}
