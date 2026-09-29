import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { App as NativeApp } from "@capacitor/app";

interface RecipePlatformPlugin {
  saveBackup(options: { filename: string; data: string }): Promise<{ saved: boolean }>;
  print(options: { title: string }): Promise<void>;
}

export const isAndroidApp = Capacitor.getPlatform() === "android";
export const recipePlatform = registerPlugin<RecipePlatformPlugin>("RecipePlatform");

export function updateAndroidTheme(theme: "light" | "dark") {
  if (!isAndroidApp) return;
  void SystemBars.setStyle({ style: theme === "dark" ? SystemBarsStyle.Dark : SystemBarsStyle.Light })
    .catch((error) => console.error("Could not update Android system bars", error));
}

export async function initializeAndroidApp() {
  if (!isAndroidApp) return;
  await NativeApp.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      void NativeApp.minimizeApp();
    }
  });
  await navigator.storage?.persist?.().catch(() => false);
}

export async function printDocument() {
  if (!isAndroidApp) {
    window.print();
    return;
  }
  try {
    await recipePlatform.print({ title: document.title });
  } catch (error) {
    window.alert(error instanceof Error ? error.message : String(error));
  }
}
