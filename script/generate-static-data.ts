/**
 * Build-time script: converts content/pacific-llm-revenue.md into a static
 * JSON file, and copies data assets to client/public.
 *
 * Produces:
 *   client/public/data/report.json          — full report content
 *   client/public/data/vat-register.json    — 112-row VAT register
 *   client/public/data/source-a.json        — messy GRT source file
 *   client/public/data/source-b.json        — business licence source
 *   client/public/data/source-c.json        — VAT interest log source
 */

import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT_FILE = path.join(ROOT, "content", "pacific-llm-revenue.md");
const DATA_DIR = path.join(ROOT, "data");
const PUBLIC_DIR = path.join(ROOT, "client", "public");
const PUBLIC_DATA_DIR = path.join(PUBLIC_DIR, "data");

function extractTitle(content: string): string {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : "Pacific LLM Report";
}

function generateData() {
  console.log("Generating static data...");
  fs.mkdirSync(PUBLIC_DATA_DIR, { recursive: true });

  // 1. Report markdown
  if (!fs.existsSync(CONTENT_FILE)) {
    console.warn("  ⚠ content/pacific-llm-revenue.md not found — skipping.");
  } else {
    const content = fs.readFileSync(CONTENT_FILE, "utf-8");
    const report = { id: "report", title: extractTitle(content), content };
    fs.writeFileSync(path.join(PUBLIC_DATA_DIR, "report.json"), JSON.stringify(report));
    console.log("  ✓ report.json");
  }

  // 2. Data files — copy from data/ to client/public/data/
  const dataFiles: { src: string; dest: string }[] = [
    { src: "vat-register.json",              dest: "vat-register.json" },
    { src: "source-a-grt-register.json",     dest: "source-a.json" },
    { src: "source-b-business-licences.json", dest: "source-b.json" },
    { src: "source-c-vat-interest-log.json", dest: "source-c.json" },
    { src: "implementation-plan.json",       dest: "implementation-plan.json" },
  ];

  for (const { src, dest } of dataFiles) {
    const srcPath = path.join(DATA_DIR, src);
    const destPath = path.join(PUBLIC_DATA_DIR, dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`  ✓ ${dest}`);
    } else {
      console.warn(`  ⚠ ${src} not found — skipping.`);
    }
  }

  console.log("\n✓ Static data generation complete.\n");
}

try {
  generateData();
} catch (err) {
  console.error("Static data generation failed:", err);
  process.exit(1);
}
