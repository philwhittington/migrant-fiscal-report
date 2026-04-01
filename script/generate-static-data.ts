/**
 * Build-time script: converts content/migrant-fiscal-impact.md into a static
 * JSON file, and copies data assets to client/public.
 *
 * Produces:
 *   client/public/data/report.json     -- full report content
 *   client/public/data/*.json          -- widget data files from data/output/
 *   client/public/data/*.json          -- processed data from data/processed/
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_FILE = path.join(ROOT, "content", "migrant-fiscal-impact.md");
const OUTPUT_DIR = path.join(ROOT, "data", "output");
const PROCESSED_DIR = path.join(ROOT, "data", "processed");
const PUBLIC_DIR = path.join(ROOT, "client", "public");
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Migrant Fiscal Impact Report";
}

function copyJsonFiles(srcDir: string, destDir: string, label: string): void {
  if (!fs.existsSync(srcDir)) {
    console.warn(`  Warning: ${label} directory not found -- skipping.`);
    return;
  }
  const files = fs.readdirSync(srcDir).filter(f => f.endsWith(".json"));
  for (const file of files) {
    const destPath = path.join(destDir, file);
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(path.join(srcDir, file), destPath);
      console.log(`  OK ${file} (from ${label})`);
    }
  }
}

function generateData() {
  console.log("Generating static data for migrant fiscal report...\n");
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

  // 1. Report markdown to JSON
  if (!fs.existsSync(CONTENT_FILE)) {
    console.warn("  Warning: content/migrant-fiscal-impact.md not found -- skipping report.json.");
  } else {
    const content = fs.readFileSync(CONTENT_FILE, "utf-8");
    const report = { id: "report", title: extractTitle(content), content };
    fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "report.json"), JSON.stringify(report));
    console.log("  OK report.json");
  }

  // 2. Widget data files from data/output/ (takes precedence)
  copyJsonFiles(OUTPUT_DIR, PUBLIC_DATA_DIR, "data/output");

  // 3. Processed data files from data/processed/
  copyJsonFiles(PROCESSED_DIR, PUBLIC_DATA_DIR, "data/processed");

  console.log("\nStatic data generation complete.\n");
}

try {
  generateData();
} catch (err) {
  console.error("Static data generation failed:", err);
  process.exit(1);
}
