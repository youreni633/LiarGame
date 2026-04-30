import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "src", "CatchMind", "words.json");
const targetDir = join(root, "dist", "CatchMind");
const target = join(targetDir, "words.json");

if (!existsSync(source)) {
  throw new Error(`Missing catchmind words file: ${source}`);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);

console.log(`Copied ${source} -> ${target}`);
