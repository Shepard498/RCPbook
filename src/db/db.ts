import Dexie, { type Table } from "dexie";
import type {
  Ingredient,
  IngredientCategory,
  PurchaseOption,
} from "../domain/ingredients/ingredientTypes";
import type { ImageBlobRecord } from "../domain/images/imageTypes";
import type { InventoryItem } from "../domain/inventory/inventoryTypes";
import type { Recipe } from "../domain/recipes/recipeTypes";
import { databaseName, schemaV1, schemaV2, schemaV3, schemaV4 } from "./schema";

export class RecipeIngredientDatabase extends Dexie {
  ingredients!: Table<Ingredient, string>;
  categories!: Table<IngredientCategory, string>;
  purchaseOptions!: Table<PurchaseOption, string>;
  recipes!: Table<Recipe, string>;
  imageBlobs!: Table<ImageBlobRecord, string>;
  inventory!: Table<InventoryItem, string>;

  constructor() {
    super(databaseName);
    this.version(1).stores(schemaV1);
    this.version(2).stores(schemaV2);
    this.version(3).stores(schemaV3);
    this.version(4).stores(schemaV4);
  }
}

export const db = new RecipeIngredientDatabase();
