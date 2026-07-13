import { defaultMapTheme, normalizeMapTheme, type MapTheme } from "@travld/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";

interface MapThemeContextValue {
  theme: MapTheme;
  /** Optimistically apply + persist a new palette. */
  setTheme: (theme: MapTheme) => Promise<void>;
  loading: boolean;
}

const MapThemeContext = createContext<MapThemeContextValue | null>(null);

export function MapThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<MapTheme>(defaultMapTheme);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { theme } = await api.getTheme();
        setThemeState(normalizeMapTheme(theme));
      } catch {
        /* keep default */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setTheme = useCallback(async (next: MapTheme) => {
    const normalized = normalizeMapTheme(next);
    setThemeState(normalized); // optimistic
    try {
      const { theme } = await api.setTheme(normalized);
      setThemeState(normalizeMapTheme(theme));
    } catch {
      /* leave optimistic value; will reconcile on next load */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme, loading }), [theme, setTheme, loading]);
  return <MapThemeContext.Provider value={value}>{children}</MapThemeContext.Provider>;
}

export function useMapTheme(): MapThemeContextValue {
  const ctx = useContext(MapThemeContext);
  if (!ctx) throw new Error("useMapTheme must be used within MapThemeProvider");
  return ctx;
}
