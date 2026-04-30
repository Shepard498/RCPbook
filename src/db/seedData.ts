import type {
  Ingredient,
  IngredientCategory,
  PurchaseOption,
} from "../domain/ingredients/ingredientTypes";
import { isoDaysAgo } from "../utils/dates";
import { db } from "./db";

const categorySeeds: IngredientCategory[] = [
  { id: "cat-flours", name: "Flours & starches", sortOrder: 10 },
  { id: "cat-sugars", name: "Sugars & sweeteners", sortOrder: 20 },
  { id: "cat-dairy", name: "Dairy", sortOrder: 30 },
  { id: "cat-eggs", name: "Eggs", sortOrder: 40 },
  { id: "cat-fats", name: "Fats & oils", sortOrder: 50 },
  { id: "cat-chocolate", name: "Chocolate & cocoa", sortOrder: 60 },
  { id: "cat-nuts", name: "Nuts & seeds", sortOrder: 70 },
  { id: "cat-fruits", name: "Fruits", sortOrder: 80 },
  { id: "cat-leavening", name: "Leavening agents", sortOrder: 90 },
  { id: "cat-flavorings", name: "Flavorings & extracts", sortOrder: 100 },
  { id: "cat-spices", name: "Spices", sortOrder: 110 },
  { id: "cat-liquids", name: "Liquids", sortOrder: 120 },
  { id: "cat-additives", name: "Additives & stabilizers", sortOrder: 130 },
  { id: "cat-packaging", name: "Miscellaneous", sortOrder: 140 },
  { id: "cat-other", name: "Other", sortOrder: 150 },
];

export async function seedDatabase() {
  const categoryCount = await db.categories.count();
  const ingredientCount = await db.ingredients.count();

  if (categoryCount > 0 || ingredientCount > 0) {
    return;
  }

  const createdAt = new Date().toISOString();
  const ingredients: Ingredient[] = [
    {
      id: "ing-flour",
      name: "Flour",
      categoryId: "cat-flours",
      preferredUnit: "g",
      density: { value: 0.53, unit: "g/mL" },
      notes: "All-purpose flour seed record.",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-sugar",
      name: "Sugar",
      categoryId: "cat-sugars",
      preferredUnit: "g",
      density: { value: 0.85, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-butter",
      name: "Butter",
      categoryId: "cat-fats",
      preferredUnit: "g",
      density: { value: 0.91, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-egg",
      name: "Egg",
      categoryId: "cat-eggs",
      preferredUnit: "unit",
      unitWeight: { value: 50, unit: "g/unit" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-milk",
      name: "Milk",
      categoryId: "cat-dairy",
      preferredUnit: "mL",
      density: { value: 1.03, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-water",
      name: "Water",
      categoryId: "cat-liquids",
      preferredUnit: "mL",
      density: { value: 1, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-vanilla",
      name: "Vanilla extract",
      categoryId: "cat-flavorings",
      preferredUnit: "mL",
      density: { value: 0.95, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-cocoa",
      name: "Cocoa powder",
      categoryId: "cat-chocolate",
      preferredUnit: "g",
      density: { value: 0.42, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-chocolate",
      name: "Chocolate",
      categoryId: "cat-chocolate",
      preferredUnit: "g",
      createdAt,
      updatedAt: createdAt,
    },
    {
      id: "ing-heavy-cream",
      name: "Heavy cream",
      categoryId: "cat-dairy",
      preferredUnit: "mL",
      density: { value: 0.99, unit: "g/mL" },
      createdAt,
      updatedAt: createdAt,
    },
  ];

  const purchaseOptions: PurchaseOption[] = [
    option("po-flour-1kg", "ing-flour", 1, "kg", 2.1, "$", 12, true, "Local market", "House"),
    option("po-flour-5kg", "ing-flour", 5, "kg", 8.9, "$", 28, false, "Bakery supply", "Miller"),
    option("po-sugar-1kg", "ing-sugar", 1, "kg", 1.8, "$", 18, true, "Local market", "House"),
    option("po-butter-454g", "ing-butter", 454, "g", 4.5, "$", 9, true, "Local market", "Creamery"),
    option("po-egg-dozen", "ing-egg", 12, "unit", 3.8, "$", 6, true, "Farm stand", "Free range"),
    option("po-milk-1l", "ing-milk", 1, "L", 1.6, "$", 4, true, "Local market", "Dairy"),
    option("po-water-1l", "ing-water", 1, "L", 0.25, "$", 20, true, "Utility estimate", "Tap"),
    option("po-vanilla-60ml", "ing-vanilla", 60, "mL", 5.25, "$", 34, true, "Specialty shop", "Pure"),
    option("po-cocoa-250g", "ing-cocoa", 250, "g", 4.1, "$", 135, true, "Bakery supply", "Dark"),
    option("po-chocolate-500g", "ing-chocolate", 500, "g", 6.75, "$", 19, true, "Bakery supply", "Semi-sweet"),
    option("po-heavy-cream-1l", "ing-heavy-cream", 1, "L", 5.4, "$", 8, true, "Local market", "Dairy"),
  ];

  await db.transaction("rw", db.categories, db.ingredients, db.purchaseOptions, async () => {
    await db.categories.bulkPut(categorySeeds);
    await db.ingredients.bulkPut(ingredients);
    await db.purchaseOptions.bulkPut(purchaseOptions);
  });
}

function option(
  id: string,
  ingredientId: string,
  amount: number,
  unit: PurchaseOption["unit"],
  price: number,
  currency: string,
  daysAgo: number,
  isPreferred: boolean,
  supplier: string,
  brand: string,
): PurchaseOption {
  const now = new Date().toISOString();

  return {
    id,
    ingredientId,
    amount,
    unit,
    price,
    currency,
    lastUpdated: isoDaysAgo(daysAgo),
    supplier,
    brand,
    isPreferred,
    createdAt: now,
    updatedAt: now,
  };
}
