// Copies the MapLibre web worker into public/vendor so the browser can load it
// (MapLibre 6 resolves its worker relative to its own module URL, which a bundler rewrites).
import fs from "node:fs";
import path from "node:path";

const src = path.join("node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const dst = path.join("public", "vendor", "maplibre-gl-worker.mjs");
if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  console.log(`copied ${src} → ${dst}`);
}
