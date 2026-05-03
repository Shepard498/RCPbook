import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface RouteActionsContextValue {
  action: ReactNode;
  setAction: (action: ReactNode) => void;
}

const RouteActionsContext = createContext<RouteActionsContextValue | null>(null);

export function RouteActionsProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<ReactNode>(null);
  const value = useMemo(() => ({ action, setAction }), [action]);

  return <RouteActionsContext.Provider value={value}>{children}</RouteActionsContext.Provider>;
}

export function useRouteActions() {
  const context = useContext(RouteActionsContext);

  if (!context) {
    throw new Error("useRouteActions must be used within RouteActionsProvider");
  }

  return context;
}
