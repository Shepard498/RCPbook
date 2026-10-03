# Recipe Ingredient Manager

A local-first recipe, ingredient, costing, and production planning app for cooks,
bakers, and small food production workflows.

The app is meant to answer practical production questions:

- What ingredients and packaging do I need for this set of recipes?
- How does a recipe change when I scale it to a different yield, pan size, or batch size?
- What will a recipe or production run cost based on my current purchase options?
- What do I still need to buy after counting available stock?

It runs in the browser, stores data locally with IndexedDB, and does not require a
backend server for day-to-day use.

## What it does

Recipe Ingredient Manager is built around five connected areas.

### Ingredients

Ingredients are the foundation of the app. Each ingredient stores its preferred
display unit, optional density, optional unit weight, category, notes, and one or
more purchase options.

Purchase options describe how that ingredient is actually bought: package amount,
unit, price, currency, supplier, brand, reference URL, notes, and last updated
date. The app uses these options to estimate recipe costs and batch shopping
costs. When a conversion or price is incomplete, the app shows warnings instead
of guessing.

### Recipes

Recipes contain ingredient lines, optional sub-recipe lines, structured procedure
steps, optional images, notes, and an explicit yield definition.

Supported yield types include:

- count, such as 12 cookies
- mass, such as 1 kg dough
- volume, such as 2 L soup
- servings
- mold area, useful for scaling between pans with similar height
- mold volume, useful for scaling between molds with different dimensions

Recipe previews show ingredient costs, total estimated cost, cost per count or
serving when available, procedure steps, warnings, and print-friendly output.
Printing defaults to A4, uses high-contrast light colors in either app theme,
and lays out ingredients in two columns with full-width procedure steps.
Use Show sub-recipes to include their instructions in the preview and printout.

### Scaling

The scaling logic uses the recipe yield type to calculate a scale factor, then
multiplies every recipe line by that factor. A count recipe scales only to another
count target, a mass recipe to another mass target, a mold-area recipe to another
mold-area target, and so on.

This keeps scaling explicit. The app does not silently treat unrelated yield
types as equivalent.

### Batch Planner

The Batch Planner lets you combine multiple recipe targets into one production
plan. For each row, choose a recipe and target yield. The app scales each recipe,
aggregates all ingredient requirements, estimates costs, and builds a shopping
list.

The planner can also include miscellaneous items, such as packaging or supplies.
Purchase planning can use either a simple closest-package choice or a
multi-option mode that combines available package sizes.

Batch plans can be printed as a shopping list or as scaled recipe sheets.
On phones, the printer button follows the selected tab: Production targets
prints scaled recipes, while Shopping list prints the shopping list.

### Inventory

Inventory records available stock by ingredient, amount, unit, location,
expiration date, and notes. The Batch Planner reads inventory and subtracts
available stock from total requirements so the shopping list focuses on what
still needs to be purchased.

## Workflow

1. Add ingredients and miscellaneous items.
2. Add purchase options so the app can calculate prices.
3. Add density or unit weight when cross-dimension conversions are needed, such
   as grams to cups or eggs to grams.
4. Create recipes with explicit yields and structured procedure steps.
5. Use recipe previews to review warnings, costs, and printable recipe output.
6. Build a batch plan by choosing recipes and target yields.
7. Review total ingredients, inventory coverage, purchase plans, and total cost.
8. Export a backup from Settings when you want a portable copy of the local data.

## Calculation rules

The app is intentionally conservative with calculations:

- Units convert directly only within the same dimension.
- Mass-to-volume conversion requires ingredient density.
- Count-to-mass conversion requires ingredient unit weight.
- Count-to-volume conversion requires both unit weight and density.
- Missing price data, stale prices, invalid purchase options, and impossible
  conversions are shown as warnings.
- Expected data problems return structured warnings instead of crashing the app.

This behavior is important for kitchen and production work: incomplete data should
be visible, not hidden behind made-up assumptions.

## Data and backups

Data is stored locally in the browser using Dexie over IndexedDB. Settings include
backup export/import controls so data can be saved to a JSON file and restored
later.
On phones, navigation and Settings share the left-hand drawer, opened with the
menu button or an inward swipe from the left edge. The current app version is
listed at the bottom of Settings.

The browser package includes a small local Node server only to launch the built
app in a browser. It is not a remote backend.

## Local setup

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Browser package

Create a browser-launchable package:

```bash
npm run package:browser
```

The package is written to `release/recipe-ingredient-manager-browser`. It includes
the built app, `launch-windows.cmd`, `launch-mac-linux.sh`, and a tiny local Node
server that opens the app in a browser.
On macOS/Linux, run `sh ./launch-mac-linux.sh` from the extracted folder so the
launcher also works when a ZIP extractor does not preserve executable permissions.

## Netlify package

```bash
npm run package:netlify
```

The deploy-ready files are written to `release/recipe-ingredient-manager-netlify`.
The release ZIP contains `index.html` and `assets/` at its root, without a local
server or Node dependencies. Extract and upload this folder to Netlify Drop, or
upload the ZIP where supported. See [Netlify's manual deployment guide](https://docs.netlify.com/deploy/create-deploys/).

For Git-connected deployments, `netlify.toml` sets the build command to
`npm run build`, publishes `dist`, and selects Node 22. Navigation uses hash routes,
so no SPA path rewrite is needed. Updating the same site preserves its browser
storage; moving to a different domain requires exporting and importing a backup.

## Android test APK

The Android app bundles the same React UI with Capacitor and works offline.
It uses application ID `io.github.shepard498.rcpbook`, supports Android 7+
(with an up-to-date Android System WebView), and keeps its own local database.
Transfer browser data with Settings > Save data, then Load data in the Android app.

Requirements: Node 22+, JDK 21, Android SDK platform 36, and build tools 35/36.
On Windows, install the SDK locally into the ignored `.android-tools` directory:

```bash
npm install
npm run android:setup
npm run package:android
```

The setup command downloads Google's SDK tools, verifies their SHA-256 checksum,
and accepts the SDK licenses while installing the required packages. An existing
SDK can also be used by setting `ANDROID_HOME`.

The build runs TypeScript/Vite, synchronizes Capacitor, builds the Android debug
variant, and runs Android lint. The resulting test APK is written to
`release/recipe-ingredient-manager-v0.5.0-android-debug.apk`.
SDK and Gradle caches stay in `.android-tools`; nothing needs to be installed on
the phone except the APK. Android Studio is optional for these command-line builds.

Backup export uses Android's document picker. Printing opens Android's print
service, which also supports saving to PDF. Import and recipe image selection use
the system file picker. Test these flows on a physical device, along with Back,
keyboard resizing, airplane mode, and persistence after restarting the app.

This command produces a debug build for testing. Keep the `android/` source
project in version control; regenerate bundled web assets with
`npm run android:sync` after web changes.

## Android release APK

Release builds use a separate permanent signing key. Configure
`.android-signing/release.properties` locally:

```properties
storeFile=.android-signing/rcpbook-release.jks
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=rcpbook
keyPassword=YOUR_KEY_PASSWORD
```

`storeFile` is relative to the repository root. The entire `.android-signing/`
directory is ignored by Git. Never publish its contents; back up both the
keystore and credentials securely. Future updates must use the same signing key.

```bash
npm run package:android:release
```

This runs the production web build, Capacitor sync, `assembleRelease`, and
`lintRelease`. The signed, non-debuggable APK is written to
`release/recipe-ingredient-manager-v0.5.0-android.apk`. Each Android release must
increase `versionCode` in `android/app/build.gradle`; `versionName` comes from
`package.json`.

Version 0.5.0 uses the same release signing key as 0.4.0 and can be installed as
an update without uninstalling that release or the signed UX preview APKs.
Export a backup before upgrading as a precaution.

Before replacing the old debug app, use Settings > Save data. Android cannot
install an APK signed with a different key over that app: uninstall the debug
version, install the release APK, and use Load data to restore the backup.
Uninstalling without a backup can erase the app's local data. The APK is intended
for direct installation, not a Google Play submission. The backup includes the
ingredient/recipe library, images, and inventory, but not the saved batch plan or
app preferences; record those separately before reinstalling. See
[Android's signing documentation](https://developer.android.com/studio/publish/app-signing)
for signing-key storage and update requirements.

## Tech stack

- React
- TypeScript
- Vite
- Dexie.js
- IndexedDB

Domain logic is kept separate from React components under `src/domain`, with UI
components under `src/components` and persistence under `src/db`.
