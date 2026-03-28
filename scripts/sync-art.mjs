import { cpSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "art-resources");
const targetDir = path.join(rootDir, "public", "art");

const assetMappings = [
  { from: path.join(sourceDir, "backgrounds"), to: path.join(targetDir, "backgrounds") },
  { from: path.join(sourceDir, "pets"), to: path.join(targetDir, "pets") },
  { from: path.join(sourceDir, "ui"), to: path.join(targetDir, "ui") },
  {
    from: path.join(sourceDir, "pets", "Mushroom_stage1_nobg_webp"),
    to: path.join(targetDir, "pets", "stage1"),
  },
  {
    from: path.join(sourceDir, "Preprocess", "Pet_Idle_nobg_webp"),
    to: path.join(targetDir, "pets", "idle"),
  },
];

function listFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      return listFiles(entryPath);
    }

    if (statSync(entryPath).isFile()) {
      return [entryPath];
    }

    return [];
  });
}

mkdirSync(targetDir, { recursive: true });

for (const mapping of assetMappings) {
  if (!existsSync(mapping.from)) {
    console.warn(`Skipping missing folder: ${path.relative(rootDir, mapping.from)}`);
    continue;
  }

  mkdirSync(mapping.to, { recursive: true });
  cpSync(mapping.from, mapping.to, { recursive: true, force: true });

  const syncedFiles = listFiles(mapping.from).map((file) => path.relative(rootDir, file));
  console.log(`Synced ${syncedFiles.length} file(s) from ${path.relative(rootDir, mapping.from)}`);
}

console.log(`Art assets are ready in ${path.relative(rootDir, targetDir)}`);
