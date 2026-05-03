import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface AppPreferencesContextValue {
  confirmDeletes: boolean;
  setConfirmDeletes: (confirmDeletes: boolean) => void;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);
const confirmDeletesStorageKey = "recipe-app-confirm-deletes";

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [confirmDeletes, setConfirmDeletesState] = useState(() => {
    return localStorage.getItem(confirmDeletesStorageKey) !== "false";
  });

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      confirmDeletes,
      setConfirmDeletes: (nextConfirmDeletes) => {
        localStorage.setItem(confirmDeletesStorageKey, String(nextConfirmDeletes));
        setConfirmDeletesState(nextConfirmDeletes);
      },
    }),
    [confirmDeletes],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }

  return context;
}
