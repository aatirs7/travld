import { paletteFor, type ThemeColors, type ThemeMode } from "@travld/ui";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getString, setString } from "./local-flags";

interface AppThemeValue {
  colors: ThemeColors;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const AppThemeContext = createContext<AppThemeValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(getString("themeMode") === "light" ? "light" : "dark");
  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    setString("themeMode", m);
  }, []);
  const colors = useMemo(() => paletteFor(mode), [mode]);
  const value = useMemo(() => ({ colors, mode, setMode }), [colors, mode, setMode]);
  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

function useCtx(): AppThemeValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) throw new Error("useAppTheme must be used within AppThemeProvider");
  return ctx;
}

/** The active themed palette. Screens build styles from this. */
export function useAppColors(): ThemeColors {
  return useCtx().colors;
}

export function useAppTheme(): AppThemeValue {
  return useCtx();
}
