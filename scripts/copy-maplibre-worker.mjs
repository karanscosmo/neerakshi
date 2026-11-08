import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.join(
  process.cwd(),
  "node_modules",
  "maplibre-gl",
  "dist",
  "maplibre-gl-worker.mjs",
);
const destinationDir = path.join(process.cwd(), "public", "vendor", "maplibre");

await mkdir(destinationDir, { recursive: true });
await copyFile(source, path.join(destinationDir, "maplibre-gl-worker.mjs"));
