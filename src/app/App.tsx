import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { IngredientsPage } from "../components/ingredients/IngredientsPage";
import { InventoryPage } from "../components/inventory/InventoryPage";
import { BatchPlanner, batchPlannerStorageKey } from "../components/production/BatchPlanner";
import { RecipesPage } from "../components/recipes/RecipesPage";
import { downloadBackupFile, importBackup } from "../db/backup";
import { db } from "../db/db";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { I18nProvider, useI18n } from "./i18n";
import { AppPreferencesProvider, useAppPreferences } from "./preferences";
import { RouteActionsProvider, useRouteActions } from "./routeActions";
import { routes } from "./routes";
import { useInAppBackClose } from "./useInAppBackClose";
import { updateAndroidTheme } from "./platform";

type ThemeMode = "light" | "dark";

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
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem("recipe-app-theme");
    return savedTheme === "dark" ? "dark" : "light";
  });
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const settingsMenuRef = useRef<HTMLDivElement | null>(null);
  const { language, setLanguage, t } = useI18n();
  const { confirmDeletes, setConfirmDeletes } = useAppPreferences();
  const { action: routeAction } = useRouteActions();
  const activeRouteLabel = t(routes.find((route) => route.path === activeRoute)?.label ?? "Ingredients");

  useInAppBackClose(isNavOpen, () => setIsNavOpen(false), "navigation-menu");
  useInAppBackClose(isSettingsOpen, () => setIsSettingsOpen(false), "settings-menu");

  useEffect(() => {
    if (!isNavOpen && !isSettingsOpen) return;

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
  }, [isNavOpen, isSettingsOpen]);

  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = "#ingredients";
    }

    const handleHashChange = () => setActiveRoute(getActiveRoute());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("recipe-app-theme", theme);
    updateAndroidTheme(theme);
  }, [theme]);

  async function handleExportBackup() {
    setBackupStatus(null);

    try {
      const saved = await downloadBackupFile();
      setBackupStatus(t(saved ? "Backup saved." : "Backup cancelled."));
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : t("Backup failed."));
    }
  }

  async function handleImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setBackupStatus(null);

    try {
      await importBackup(await file.text());
      setBackupStatus(t("Backup loaded."));
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : t("Backup failed."));
    } finally {
      event.target.value = "";
    }
  }

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
    setBackupStatus(t("App data reset."));
    setIsResetDialogOpen(false);
  }

  return (
    <div className="app-shell">
      <header className={`app-header route-${activeRoute.slice(1)}`}>
        <div className="app-title-area">
          <h1>{t("Recipe Manager")}</h1>
          <div className="app-route-controls">
            <div className="app-route-menu" ref={navMenuRef}>
              <button
                type="button"
                className="menu-button"
                aria-expanded={isNavOpen}
                aria-label={t("Menu")}
                onClick={() => {
                  setIsNavOpen((isOpen) => !isOpen);
                  setIsSettingsOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
                <span>{activeRouteLabel}</span>
              </button>
              {isNavOpen ? (
                <nav className="nav-popover" aria-label={t("Primary navigation")}>
                  {routes.map((route) => (
                    <a
                      key={route.path}
                      href={route.path}
                      aria-current={activeRoute === route.path ? "page" : undefined}
                      onClick={() => setIsNavOpen(false)}
                    >
                      {t(route.label)}
                    </a>
                  ))}
                </nav>
              ) : null}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <div className="settings-control" ref={settingsMenuRef}>
            <button
              type="button"
              className="icon-button settings-button"
              aria-label={t("Settings")}
              aria-expanded={isSettingsOpen}
              onClick={() => {
                setIsSettingsOpen((isOpen) => !isOpen);
                setIsNavOpen(false);
              }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M19.4 13.5c.1-.5.1-1 .1-1.5s0-1-.1-1.5l2-1.5-2-3.5-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2h-4l-.4 2.5A7.6 7.6 0 0 0 7 6L4.6 5l-2 3.5 2 1.5c-.1.5-.1 1-.1 1.5s0 1 .1 1.5l-2 1.5 2 3.5 2.4-1a7.6 7.6 0 0 0 2.6 1.5L10 22h4l.4-2.5A7.6 7.6 0 0 0 17 18l2.4 1 2-3.5-2-1.5ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
            {isSettingsOpen ? (
              <div className="settings-popover" role="dialog" aria-label={t("Settings")}>
              <div className="settings-row">
                <label>
                  {t("Language")}
                  <select
                    className="language-select"
                    value={language}
                    onChange={(event) => setLanguage(event.target.value === "es" ? "es" : "en")}
                  >
                    <option value="en">{t("English")}</option>
                    <option value="es">{t("Spanish")}</option>
                  </select>
                </label>
              </div>
              <div className="settings-row">
                <span className="field-label">{t("Theme")}</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    aria-pressed={theme === "light"}
                    onClick={() => setTheme("light")}
                  >
                    {t("Light")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={theme === "dark"}
                    onClick={() => setTheme("dark")}
                  >
                    {t("Dark")}
                  </button>
                </div>
              </div>
              <div className="settings-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={confirmDeletes}
                    onChange={(event) => setConfirmDeletes(event.target.checked)}
                  />
                  {t("Ask before deleting")}
                </label>
              </div>
              <div className="settings-row">
                <span className="field-label">{t("Backup")}</span>
                <div className="settings-actions">
                  <button type="button" onClick={handleExportBackup}>
                    {t("Save data")}
                  </button>
                  <button type="button" onClick={() => importInputRef.current?.click()}>
                    {t("Load data")}
                  </button>
                </div>
                <input
                  ref={importInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportBackup}
                />
                {backupStatus ? <p className="settings-status">{backupStatus}</p> : null}
              </div>
              <div className="settings-row">
                <span className="field-label">{t("Data")}</span>
                <button type="button" className="danger" onClick={() => setIsResetDialogOpen(true)}>
                  {t("Start over")}
                </button>
              </div>
            </div>
            ) : null}
          </div>
          {routeAction ? (
            <div className={`app-header-route-action ${activeRoute === "#production" ? "batch-route-action" : "single-route-action"}`}>
              {routeAction}
            </div>
          ) : null}
        </div>
      </header>
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
