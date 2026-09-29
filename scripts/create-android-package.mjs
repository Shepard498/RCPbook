import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isRelease = process.argv.includes("--release");
const variant = isRelease ? "release" : "debug";
if (isRelease && !existsSync(path.join(repoRoot, ".android-signing", "release.properties"))) {
  throw new Error("Release signing is not configured. See the Android release APK section in README.md.");
}
const toolsRoot = path.join(repoRoot, ".android-tools");
const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(toolsRoot, "sdk");
if (!existsSync(path.join(sdkRoot, "platforms", "android-36"))) {
  throw new Error("Android SDK 36 is missing. Run npm run android:setup on Windows, or set ANDROID_HOME to an installed SDK.");
}

const gradleArgs = isRelease
  ? ["assembleRelease", "lintRelease", "--no-daemon", "--console=plain"]
  : ["assembleDebug", "lintDebug", "--no-daemon", "--console=plain"];
const result = spawnSync(
  process.platform === "win32" ? (process.env.ComSpec || "cmd.exe") : "./gradlew",
  process.platform === "win32" ? ["/d", "/s", "/c", `gradlew.bat ${gradleArgs.join(" ")}`] : gradleArgs,
  {
    cwd: path.join(repoRoot, "android"),
    stdio: "inherit",
    env: {
      ...process.env,
      ANDROID_HOME: sdkRoot,
      ANDROID_SDK_ROOT: sdkRoot,
      ANDROID_USER_HOME: process.env.ANDROID_USER_HOME || path.join(toolsRoot, "user-home"),
      GRADLE_USER_HOME: process.env.GRADLE_USER_HOME || path.join(toolsRoot, "gradle-home"),
    },
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const { version } = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const releaseDir = path.join(repoRoot, "release");
mkdirSync(releaseDir, { recursive: true });
const apk = path.join(releaseDir, `recipe-ingredient-manager-v${version}-android${isRelease ? "" : "-debug"}.apk`);
copyFileSync(path.join(repoRoot, "android", "app", "build", "outputs", "apk", variant, `app-${variant}.apk`), apk);
console.log(`${isRelease ? "Release" : "Test"} APK ready: ${apk}`);
