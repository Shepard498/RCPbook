import { Menu, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IngredientsPage } from "../components/ingredients/IngredientsPage";
import { InventoryPage } from "../components/inventory/InventoryPage";
import { BatchPlanner, batchPlannerStorageKey } from "../components/production/BatchPlanner";
import { RecipesPage } from "../components/recipes/RecipesPage";
import { db } from "../db/db";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { I18nProvider, useI18n } from "./i18n";
import { AppPreferencesProvider } from "./preferences";
import { RouteActionsProvider, useRouteActions } from "./routeActions";
import { routes } from "./routes";
import { useInAppBackClose } from "./useInAppBackClose";
import { updateAndroidTheme } from "./platform";

import { MobileNavigation } from "./MobileNavigation";
import { SettingsPanel, type ThemeMode } from "./SettingsPanel";

const mobileQuery = "(max-width: 720px)";

export function App() {
  return (
    <I18nProvider>
      <AppPreferencesProvider>
        <RouteActionsProvider>
          <AppShell />
        </RouteActionsProvider>
      </AppPreferencesProvider>
    </I18nProvider>
  );
}

function AppShell() {
  const [activeRoute, setActiveRoute] = useState(() => getActiveRoute());
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(mobileQuery).matches);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem("recipe-app-theme");
    return savedTheme === "dark" ? "dark" : "light";
  });
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();
  const { action: routeAction } = useRouteActions();
  const activeRouteLabel = t(routes.find((route) => route.path === activeRoute)?.label ?? "Ingredients");

  useInAppBackClose(isNavOpen, () => setIsNavOpen(false), "navigation-menu");
  useInAppBackClose(isSettingsOpen, () => setIsSettingsOpen(false), "settings-menu");

  useEffect(() => {
    const query = window.matchMedia(mobileQuery);
    const handleChange = () => {
      setIsMobile(query.matches);
      setIsNavOpen(false);
      setIsSettingsOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isMobile || (!isNavOpen && !isSettingsOpen)) return;

    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;
      if (!navMenuRef.current?.contains(event.target)) setIsNavOpen(false);
      if (!settingsMenuRef.current?.contains(event.target)) setIsSettingsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const activeMenu = isNavOpen ? navMenuRef.current : settingsMenuRef.current;
      setIsNavOpen(false);
      setIsSettingsOpen(false);
      activeMenu?.querySelector("button")?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobile, isNavOpen, isSettingsOpen]);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#ingredients";
    }

    const handleHashChange = () => {
      setActiveRoute(getActiveRoute());
      setIsNavOpen(false);
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("recipe-app-theme", theme);
    updateAndroidTheme(theme);
  }, [theme]);

  async function resetAppData() {
    await db.transaction("rw", [db.ingredients, db.purchaseOptions, db.recipes, db.imageBlobs, db.inventory], async () => {
      await Promise.all([
        db.ingredients.clear(),
        db.purchaseOptions.clear(),
        db.recipes.clear(),
        db.imageBlobs.clear(),
        db.inventory.clear(),
      ]);
    });

    localStorage.removeItem(batchPlannerStorageKey);
    window.dispatchEvent(new Event("recipe-app-reset"));
    setIsResetDialogOpen(false);
  }

  const navigation = routes.map((route) => (
    <a key={route.path} href={route.path} aria-current={activeRoute === route.path ? "page" : undefined} onClick={() => setIsNavOpen(false)}>
      {t(route.label)}
    </a>
  ));
  const settings = <SettingsPanel theme={theme} onThemeChange={setTheme} onReset={() => {
    setIsNavOpen(false);
    setIsSettingsOpen(false);
    setIsResetDialogOpen(true);
  }} />;

  return (
    <div className="app-shell">
      <header className={`app-header route-${activeRoute.slice(1)}`}>
        <div className="app-title-area">
          <h1>{isMobile ? activeRouteLabel : t("Recipe Manager")}</h1>
          <div className="app-route-controls">
            <div className="app-route-menu" ref={navMenuRef}>
              <button
                type="button"
                className="menu-button"
                aria-expanded={isNavOpen}
                aria-label={t("Menu")}
                title={t("Menu")}
                aria-controls={isMobile ? "mobile-navigation" : undefined}
                aria-haspopup={isMobile ? "dialog" : undefined}
                onClick={() => {
                  setIsNavOpen((isOpen) => !isOpen);
                  setIsSettingsOpen(false);
                }}
              >
                <Menu size={20} aria-hidden="true" />
                <span>{activeRouteLabel}</span>
              </button>
              {isNavOpen && !isMobile ? (
                <nav className="nav-popover" aria-label={t("Primary navigation")}>
                  {navigation}
                </nav>
              ) : null}
            </div>
          </div>
        </div>
        <div className="header-actions">
          {!isMobile ? <div className="settings-control" ref={settingsMenuRef}>
            <button
              type="button"
              className="icon-button settings-button"
              aria-label={t("Settings")}
              title={t("Settings")}
              aria-expanded={isSettingsOpen}
              onClick={() => {
                setIsSettingsOpen((isOpen) => !isOpen);
                setIsNavOpen(false);
              }}
            >
              <Settings size={18} aria-hidden="true" />
            </button>
            {isSettingsOpen ? (
              <div className="settings-popover" role="dialog" aria-label={t("Settings")}>
                {settings}
            </div>
            ) : null}
          </div> : null}
          {routeAction ? (
            <div className={`app-header-route-action ${activeRoute === "#production" ? "batch-route-action" : "single-route-action"}`}>
              {routeAction}
            </div>
          ) : null}
        </div>
      </header>
      {isMobile ? (
        <MobileNavigation open={isNavOpen} onOpen={() => setIsNavOpen(true)} onClose={() => setIsNavOpen(false)} navigation={navigation}>
          {settings}
        </MobileNavigation>
      ) : null}
      {activeRoute === "#recipes" ? (
        <RecipesPage />
      ) : activeRoute === "#miscellaneous" ? (
        <IngredientsPage mode="miscellaneous" />
      ) : activeRoute === "#production" ? (
        <BatchPlanner />
      ) : activeRoute === "#inventory" ? (
        <InventoryPage />
      ) : (
        <IngredientsPage />
      )}
      {isResetDialogOpen ? (
        <ConfirmDialog
          title={t("Start over?")}
          message={t(
            "This will delete all ingredients, purchase options, recipes, images, inventory, and the saved batch plan. This cannot be undone.",
          )}
          confirmLabel={t("Start over")}
          onCancel={() => setIsResetDialogOpen(false)}
          onConfirm={() => {
            void resetAppData();
          }}
        />
      ) : null}
    </div>
  );
}

function getActiveRoute() {
  if (
    window.location.hash === "#recipes" ||
    window.location.hash === "#miscellaneous" ||
    window.location.hash === "#production" ||
    window.location.hash === "#inventory"
  ) {
    return window.location.hash;
  }

  return "#ingredients";
}
