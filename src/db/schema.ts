export const databaseName = "recipeIngredientManager";

export const schemaV1 = {
  ingredients: "id, name, categoryId, preferredUnit, updatedAt",
  categories: "id, name, sortOrder",
  purchaseOptions: "id, ingredientId, isPreferred, lastUpdated, updatedAt",
};

export const schemaV2 = {
  ...schemaV1,
  recipes: "id, name, categoryId, isSubRecipe, updatedAt",
};

export const schemaV3 = {
  ...schemaV2,
  imageBlobs: "id, mimeType, updatedAt",
};

export const schemaV4 = {
  ...schemaV3,
  inventory: "id, ingredientId, expirationDate, updatedAt",
};
