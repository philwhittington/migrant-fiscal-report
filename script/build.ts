/**
 * Production build — static site only.
 * 1. Generate static JSON data from content + data files
 * 2. Build the Vite client (React SPA)
 *
 * Output: dist/public/ — deploy this directory to Cloudflare Pages.
 * Cloudflare Pages Functions in functions/ are auto-deployed alongside.
 */

import { build as viteBuild } from "vite";
import { rm } from "fs/promises";
import { execSync } from "child_process";
import path from "path";

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("generating static data...");
  execSync("npx tsx script/generate-static-data.ts", {
    stdio: "inherit",
    cwd: path.resolve(import.meta.dirname, ".."),
  });

  console.log("building client...");
  await viteBuild();

  console.log("\n✓ Production build complete.");
  console.log("  Static site → dist/public/");
  console.log("  Cloudflare Functions → functions/");
  console.log("  Deploy: push to GitHub, connect Cloudflare Pages.\n");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
