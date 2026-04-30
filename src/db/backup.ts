import type { ImageBlobRecord } from "../domain/images/imageTypes";
import type { Ingredient, IngredientCategory, PurchaseOption } from "../domain/ingredients/ingredientTypes";
import type { InventoryItem } from "../domain/inventory/inventoryTypes";
import type { Recipe } from "../domain/recipes/recipeTypes";
import { db } from "./db";

const backupFormat = "recipe-manager-backup";
const backupVersion = 1;

interface BackupImageBlobRecord extends Omit<ImageBlobRecord, "blob"> {
  blobDataUrl: string;
}

interface RecipeManagerBackup {
  format: typeof backupFormat;
  version: typeof backupVersion;
  exportedAt: string;
  data: {
    categories: IngredientCategory[];
    ingredients: Ingredient[];
    purchaseOptions: PurchaseOption[];
    recipes: Recipe[];
    imageBlobs: BackupImageBlobRecord[];
    inventory: InventoryItem[];
  };
}

export async function exportBackup() {
  const [categories, ingredients, purchaseOptions, recipes, imageBlobs, inventory] = await Promise.all([
    db.categories.toArray(),
    db.ingredients.toArray(),
    db.purchaseOptions.toArray(),
    db.recipes.toArray(),
    db.imageBlobs.toArray(),
    db.inventory.toArray(),
  ]);

  const backup: RecipeManagerBackup = {
    format: backupFormat,
    version: backupVersion,
    exportedAt: new Date().toISOString(),
    data: {
      categories,
      ingredients,
      purchaseOptions,
      recipes,
      imageBlobs: await Promise.all(imageBlobs.map(toBackupImageBlob)),
      inventory,
    },
  };

  return backup;
}

export async function importBackup(fileText: string) {
  const backup = parseBackup(fileText);
  const imageBlobs = await Promise.all(backup.data.imageBlobs.map(fromBackupImageBlob));

  await db.transaction(
    "rw",
    [db.categories, db.ingredients, db.purchaseOptions, db.recipes, db.imageBlobs, db.inventory],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.ingredients.clear(),
        db.purchaseOptions.clear(),
        db.recipes.clear(),
        db.imageBlobs.clear(),
        db.inventory.clear(),
      ]);

      await Promise.all([
        db.categories.bulkPut(backup.data.categories),
        db.ingredients.bulkPut(backup.data.ingredients),
        db.purchaseOptions.bulkPut(backup.data.purchaseOptions),
        db.recipes.bulkPut(backup.data.recipes),
        db.imageBlobs.bulkPut(imageBlobs),
        db.inventory.bulkPut(backup.data.inventory),
      ]);
    },
  );
}

export async function downloadBackupFile() {
  const backup = await exportBackup();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);

  anchor.href = url;
  anchor.download = `recipe-manager-backup-${date}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function toBackupImageBlob(record: ImageBlobRecord): Promise<BackupImageBlobRecord> {
  const { blob, ...rest } = record;

  return {
    ...rest,
    blobDataUrl: await blobToDataUrl(blob),
  };
}

async function fromBackupImageBlob(record: BackupImageBlobRecord): Promise<ImageBlobRecord> {
  const { blobDataUrl, ...rest } = record;

  return {
    ...rest,
    blob: await dataUrlToBlob(blobDataUrl),
  };
}

function parseBackup(fileText: string): RecipeManagerBackup {
  const parsed = JSON.parse(fileText) as Partial<RecipeManagerBackup>;

  if (
    parsed.format !== backupFormat ||
    parsed.version !== backupVersion ||
    !parsed.data ||
    !Array.isArray(parsed.data.categories) ||
    !Array.isArray(parsed.data.ingredients) ||
    !Array.isArray(parsed.data.purchaseOptions) ||
    !Array.isArray(parsed.data.recipes)
  ) {
    throw new Error("Invalid backup file.");
  }

  return {
    format: backupFormat,
    version: backupVersion,
    exportedAt: parsed.exportedAt ?? new Date().toISOString(),
    data: {
      categories: parsed.data.categories,
      ingredients: parsed.data.ingredients,
      purchaseOptions: parsed.data.purchaseOptions,
      recipes: parsed.data.recipes,
      imageBlobs: Array.isArray(parsed.data.imageBlobs) ? parsed.data.imageBlobs : [],
      inventory: Array.isArray(parsed.data.inventory) ? parsed.data.inventory : [],
    },
  };
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}
