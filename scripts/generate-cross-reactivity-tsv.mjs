import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const datasetPath = join(rootDir, "src", "data", "generated", "dataset.json");
const tsvPath = join(rootDir, "data", "sheets", "tsv", "cross_reactivity.tsv");

const dataset = JSON.parse(readFileSync(datasetPath, "utf8"));

const headers = [
  "drug_id",
  "group_name_en",
  "group_name_fr",
  "related_drug_id",
  "tier",
  "structural_relation",
  "rationale_en",
  "rationale_fr",
  "source_ids",
  "panel_drug_ids",
  "panel_rationale_en",
  "panel_rationale_fr",
];

const rows = [headers.join("\t")];

for (const drug of dataset.drugs) {
  if (!drug.crossReactivity) continue;

  for (const group of drug.crossReactivity) {
    const isFirstEntryInGroup = new Set();

    for (let i = 0; i < group.entries.length; i++) {
      const entry = group.entries[i];
      const isFirst = i === 0;

      const cols = [
        drug.id,
        group.groupName.en,
        group.groupName.fr,
        entry.drugId,
        entry.tier,
        entry.structuralRelation,
        entry.rationale.en,
        entry.rationale.fr,
        entry.sourceIds.join("; "),
        isFirst ? group.suggestedPanel.join("; ") : "",
        isFirst && group.panelRationale ? group.panelRationale.en : "",
        isFirst && group.panelRationale ? group.panelRationale.fr : "",
      ];

      rows.push(cols.join("\t"));
    }
  }
}

writeFileSync(tsvPath, rows.join("\n") + "\n");
console.log(`Generated ${tsvPath}`);
console.log(`${rows.length - 1} data rows (plus header)`);
