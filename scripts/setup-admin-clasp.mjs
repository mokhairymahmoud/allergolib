import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const adminDir = join(rootDir, "admin", "apps-script");
const targetPath = join(adminDir, ".clasp.json");
const templatePath = join(adminDir, ".clasp.json.example");
const scriptId = (process.argv[2] || "").trim();

if (!scriptId) {
  console.error("Usage: npm run admin:clasp:link -- <SCRIPT_ID>");
  process.exit(1);
}

if (!existsSync(templatePath)) {
  console.error(`Missing template file: ${templatePath}`);
  process.exit(1);
}

const template = JSON.parse(readFileSync(templatePath, "utf8"));
template.scriptId = scriptId;

writeFileSync(targetPath, `${JSON.stringify(template, null, 2)}\n`);

console.log(`Wrote ${targetPath}`);
console.log("Next steps:");
console.log("1. npm run admin:clasp:login");
console.log("2. npm run admin:clasp:push");
