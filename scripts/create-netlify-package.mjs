import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const packageDir = path.join(repoRoot, "release", "recipe-ingredient-manager-netlify");

if (!existsSync(path.join(distDir, "index.html"))) {
  throw new Error("Missing dist/index.html. Run npm run build before packaging.");
}

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });
cpSync(distDir, packageDir, { recursive: true });

console.log(`Netlify package created at ${path.relative(repoRoot, packageDir)}`);
console.log("Deploy this folder's contents to Netlify, with index.html at the root.");
