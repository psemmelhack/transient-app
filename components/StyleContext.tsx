import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loadStyle, saveStyle } from '../src/style/persist';
import { randomStyle } from '../src/style/randomize';
import type { Style } from '../src/style/types';

interface StyleApi {
  style: Style;
  update: (next: Style) => void;
  randomize: () => void;
  undo: () => void;
  canUndo: boolean;
}

const Ctx = createContext<StyleApi | null>(null);

export function StyleProvider({ children }: { children: ReactNode }) {
  const [style, setStyle] = useState<Style>(() => loadStyle());
  const [previous, setPrevious] = useState<Style | null>(null);

  useEffect(() => {
    const onAdopt = (event: Event) => {
      const next = (event as CustomEvent<Style>).detail;
      if (!next) return;
      setPrevious(null);
      setStyle(next);
    };
    window.addEventListener('transient-style-adopted', onAdopt);
    return () => window.removeEventListener('transient-style-adopted', onAdopt);
  }, []);

  const update = useCallback((next: Style) => {
    setPrevious(null);
    setStyle(next);
    saveStyle(next);
  }, []);

  const randomize = useCallback(() => {
    setStyle((current) => {
      setPrevious(current);
      const next = randomStyle(current);
      saveStyle(next);
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPrevious((prior) => {
      if (!prior) return null;
      setStyle(prior);
      saveStyle(prior);
      return null;
    });
  }, []);

  const api = useMemo(
    () => ({ style, update, randomize, undo, canUndo: previous != null }),
    [style, update, randomize, undo, previous],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStyle(): StyleApi {
  const value = useContext(Ctx);
  if (!value) throw new Error('StyleProvider is missing');
  return value;
}
