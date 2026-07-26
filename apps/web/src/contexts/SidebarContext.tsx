"use client";

import {
  createContext,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const SIDEBAR_COLLAPSED_KEY = "dd-sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (value: SetStateAction<boolean>) => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

let cachedSidebarCollapsed: boolean | null = null;

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    const stored = readSidebarCollapsedPreference();
    setCollapsedState(stored);
  }, []);

  const setCollapsed = useCallback((value: SetStateAction<boolean>) => {
    setCollapsedState((current) => {
      const next = typeof value === "function"
        ? (value as (current: boolean) => boolean)(current)
        : value;

      cachedSidebarCollapsed = next;
      writeSidebarCollapsedPreference(next);
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ collapsed, setCollapsed }),
    [collapsed, setCollapsed],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebarState must be used within SidebarProvider.");
  }

  return context;
}

function readSidebarCollapsedPreference() {
  if (cachedSidebarCollapsed !== null) return cachedSidebarCollapsed;
  if (typeof window === "undefined") return false;

  try {
    cachedSidebarCollapsed = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
  } catch {
    cachedSidebarCollapsed = false;
  }

  return cachedSidebarCollapsed;
}

function writeSidebarCollapsedPreference(value: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, value ? "true" : "false");
  } catch {
    // Storage can be unavailable in private browsing or embedded previews.
  }
}
