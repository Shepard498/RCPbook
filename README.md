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

## Tech stack

- React
- TypeScript
- Vite
- Dexie.js
- IndexedDB

Domain logic is kept separate from React components under `src/domain`, with UI
components under `src/components` and persistence under `src/db`.
