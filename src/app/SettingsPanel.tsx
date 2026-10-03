import { FolderOpen, Moon, RotateCcw, Save, Sun } from "lucide-react";
import { useRef, useState, type ChangeEvent } from "react";
import { version } from "../../package.json";
import { downloadBackupFile, importBackup } from "../db/backup";
import { useI18n } from "./i18n";
import { useAppPreferences } from "./preferences";

export type ThemeMode = "light" | "dark";

export function SettingsPanel({ theme, onThemeChange, onReset }: {
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  onReset: () => void;
}) {
  const { language, setLanguage, t } = useI18n();
  const { confirmDeletes, setConfirmDeletes } = useAppPreferences();
  const [backupStatus, setBackupStatus] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

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
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setBackupStatus(null);
    try {
      await importBackup(await file.text());
      setBackupStatus(t("Backup loaded."));
    } catch (err) {
      setBackupStatus(err instanceof Error ? err.message : t("Backup failed."));
    } finally {
      input.value = "";
    }
  }

  return (
    <div className="settings-content">
      <div className="settings-row">
        <label>
          {t("Language")}
          <select className="language-select" value={language} onChange={(event) => setLanguage(event.target.value === "es" ? "es" : "en")}>
            <option value="en">{t("English")}</option>
            <option value="es">{t("Spanish")}</option>
          </select>
        </label>
      </div>
      <div className="settings-row">
        <span className="field-label">{t("Theme")}</span>
        <div className="segmented-control">
          <button type="button" aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}>
            <Sun size={16} aria-hidden="true" /> {t("Light")}
          </button>
          <button type="button" aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}>
            <Moon size={16} aria-hidden="true" /> {t("Dark")}
          </button>
        </div>
      </div>
      <div className="settings-row">
        <label className="checkbox-label">
          <input type="checkbox" checked={confirmDeletes} onChange={(event) => setConfirmDeletes(event.target.checked)} />
          {t("Ask before deleting")}
        </label>
      </div>
      <div className="settings-row">
        <span className="field-label">{t("Backup")}</span>
        <div className="settings-actions">
          <button type="button" onClick={handleExportBackup}><Save size={16} aria-hidden="true" /> {t("Save data")}</button>
          <button type="button" onClick={() => importInputRef.current?.click()}><FolderOpen size={16} aria-hidden="true" /> {t("Load data")}</button>
        </div>
        <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={handleImportBackup} />
        {backupStatus ? <p className="settings-status" role="status">{backupStatus}</p> : null}
      </div>
      <div className="settings-row">
        <span className="field-label">{t("Data")}</span>
        <button type="button" className="danger" onClick={onReset}><RotateCcw size={16} aria-hidden="true" /> {t("Start over")}</button>
      </div>
      <p className="app-version">{t("Version")} {version}</p>
    </div>
  );
}
