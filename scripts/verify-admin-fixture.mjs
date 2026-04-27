import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildDatasetFromTabRows } from "./lib/datasetContract.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const rootDir = join(__dirname, "..");
const fixturePath = join(rootDir, "data", "sheets", "fixtures", "admin-phase6-fixture.json");

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const dataset = buildDatasetFromTabRows(fixture);
const drug = dataset.drugs.find((item) => item.id === "cefazoline");

if (!drug) {
  throw new Error("Fixture verification failed: cefazoline was not present in the built dataset.");
}

if (!drug.tests.idr.concentration || !drug.tests.idr.preferredSourceId) {
  throw new Error("Fixture verification failed: the applicable IDR test did not survive export.");
}

if (drug.tests.prick.concentration || drug.tests.patch.concentration) {
  throw new Error("Fixture verification failed: non-applicable tests should remain empty.");
}

console.log(`Verified admin fixture export compatibility for ${dataset.drugs.length} drug(s).`);
console.log(`Fixture drug: ${drug.id}`);
console.log(`Applicable test preserved: ${drug.tests.idr.preferredSourceId}`);
