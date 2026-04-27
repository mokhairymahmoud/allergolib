import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const generatedDir = join(rootDir, "src", "data", "generated");
const DEFAULT_SPREADSHEET_ID = "1s2fAK0GokMk7hrWrXu6y4Av5au-cwQR0BND58ERbt9Q";
const SHEET_RANGES = {
  release_metadata: "release_metadata!A:B",
  sources: "sources!A:Z",
  drugs: "drugs!A:Z",
  aliases: "aliases!A:Z",
  test_entries: "test_entries!A:Z",
  notes: "notes!A:Z",
};

const LANGUAGES = ["en", "fr"];
const TEST_KINDS = ["prick", "idr", "patch"];
const REQUIRED_METADATA_KEYS = [
  "version",
  "releasedAt",
  "minSupportedAppVersion",
  "approvedBy",
];
const DILUTION_PATTERN = /^1:\d+$/;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function spreadsheetId() {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

function privateKey() {
  return process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

async function authHeaders() {
  if (process.env.GOOGLE_SHEETS_API_KEY) {
    return {};
  }

  if (process.env.GOOGLE_SHEETS_CLIENT_EMAIL && privateKey()) {
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: privateKey(),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    return client.getRequestHeaders("https://sheets.googleapis.com/");
  }

  fail(
    [
      "Google Sheets credentials are missing.",
      "For a private sheet, set GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY, then share the sheet with that service account.",
      "For a public sheet, set GOOGLE_SHEETS_API_KEY instead.",
      `Spreadsheet ID in use: ${spreadsheetId()}`,
    ].join(" ")
  );
}

async function fetchSheetRows(tabName) {
  const range = SHEET_RANGES[tabName];
  const headers = await authHeaders();
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}/values/${encodeURIComponent(range)}`
  );
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");

  if (process.env.GOOGLE_SHEETS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_SHEETS_API_KEY);
  }

  const response = await fetch(url, { headers });
  const body = await response.text();

  if (!response.ok) {
    fail(
      `Failed to read Google Sheet tab "${tabName}" (${range}). HTTP ${response.status}. ${body}`
    );
  }

  const json = JSON.parse(body);
  const rows = json.values ?? [];
  assert(rows.length >= 2, `${tabName} must include a header row and at least one data row.`);
  return rows;
}

function rowsToObjects(tabName, rows) {
  const headers = rows[0];

  return rows.slice(1).map((values, index) => {
    while (values.length < headers.length) {
      values.push("");
    }

    assert(
      values.length <= headers.length,
      `${tabName}:${index + 2} has ${values.length} columns but expected at most ${headers.length}.`
    );

    return Object.fromEntries(headers.map((header, columnIndex) => [header, values[columnIndex] ?? ""]));
  });
}

function requireLocalizedColumns(row, context, prefix) {
  for (const language of LANGUAGES) {
    const key = `${prefix}_${language}`;
    assert(row[key]?.trim(), `${context} is missing ${key}.`);
  }
}

function buildRelease(metadataRows) {
  const release = Object.fromEntries(metadataRows.map((row) => [row.key, row.value]));

  for (const key of REQUIRED_METADATA_KEYS) {
    assert(release[key], `release_metadata is missing ${key}.`);
  }

  return release;
}

function buildSources(sourceRows) {
  const sources = {};

  for (const row of sourceRows) {
    assert(row.id, "sources contains a source without id.");
    assert(!sources[row.id], `Duplicate source id: ${row.id}`);
    requireLocalizedColumns(row, `Source ${row.id}`, "document_name");
    requireLocalizedColumns(row, `Source ${row.id}`, "excerpt");

    sources[row.id] = {
      id: row.id,
      label: row.label,
      organization: row.organization,
      year: row.year,
      version: row.version,
      status: row.status,
      documentName: {
        en: row.document_name_en,
        fr: row.document_name_fr,
      },
      excerpt: {
        en: row.excerpt_en,
        fr: row.excerpt_fr,
      },
    };
  }

  return sources;
}

function emptyTestRecord(sourceId = "") {
  return {
    concentration: "",
    maxConcentration: "",
    dilutions: [],
    vehicle: undefined,
    notes: [],
    sourceId,
  };
}

function buildDrugs(drugRows, aliasRows, testRows, noteRows, sources) {
  const drugsById = {};

  for (const row of drugRows) {
    assert(row.id, "drugs contains a drug without id.");
    requireLocalizedColumns(row, `Drug ${row.id}`, "name");
    requireLocalizedColumns(row, `Drug ${row.id}`, "class_name");
    assert(!drugsById[row.id], `Duplicate drug id: ${row.id}`);

    drugsById[row.id] = {
      id: row.id,
      name: {
        en: row.name_en,
        fr: row.name_fr,
      },
      className: {
        en: row.class_name_en,
        fr: row.class_name_fr,
      },
      aliases: [],
      tests: {
        prick: emptyTestRecord(),
        idr: emptyTestRecord(),
        patch: emptyTestRecord(),
      },
    };
  }

  for (const row of aliasRows) {
    assert(drugsById[row.drug_id], `aliases references unknown drug ${row.drug_id}.`);
    assert(row.alias.trim(), `aliases contains an empty alias for ${row.drug_id}.`);
    drugsById[row.drug_id].aliases.push(row.alias);
  }

  for (const row of testRows) {
    assert(drugsById[row.drug_id], `test_entries references unknown drug ${row.drug_id}.`);
    assert(TEST_KINDS.includes(row.test_kind), `Invalid test kind ${row.test_kind} for ${row.drug_id}.`);
    assert(sources[row.source_id], `test_entries references unknown source ${row.source_id}.`);

    const dilutions = row.dilutions
      ? row.dilutions.split(";").map((value) => value.trim()).filter(Boolean)
      : [];

    for (const dilution of dilutions) {
      assert(
        DILUTION_PATTERN.test(dilution),
        `Invalid dilution "${dilution}" for ${row.drug_id}/${row.test_kind}.`
      );
    }

    if (row.vehicle_en || row.vehicle_fr) {
      assert(row.vehicle_en && row.vehicle_fr, `${row.drug_id}/${row.test_kind} must include vehicle in both languages.`);
    }

    drugsById[row.drug_id].tests[row.test_kind] = {
      concentration: row.concentration,
      maxConcentration: row.max_concentration,
      dilutions,
      vehicle: row.vehicle_en || row.vehicle_fr ? { en: row.vehicle_en, fr: row.vehicle_fr } : undefined,
      notes: [],
      sourceId: row.source_id,
    };
  }

  for (const row of noteRows) {
    assert(drugsById[row.drug_id], `notes references unknown drug ${row.drug_id}.`);
    assert(TEST_KINDS.includes(row.test_kind), `Invalid test kind ${row.test_kind} in notes.`);
    requireLocalizedColumns(row, `Note ${row.drug_id}/${row.test_kind}`, "note");

    drugsById[row.drug_id].tests[row.test_kind].notes.push({
      en: row.note_en,
      fr: row.note_fr,
    });
  }

  for (const drug of Object.values(drugsById)) {
    assert(drug.aliases.length > 0, `Drug ${drug.id} must have at least one alias.`);

    for (const kind of TEST_KINDS) {
      const test = drug.tests[kind];
      assert(test.sourceId, `Drug ${drug.id} is missing a source for ${kind}.`);
    }
  }

  return Object.values(drugsById);
}

async function buildDataset() {
  const releaseRows = rowsToObjects("release_metadata", await fetchSheetRows("release_metadata"));
  const sourceRows = rowsToObjects("sources", await fetchSheetRows("sources"));
  const drugRows = rowsToObjects("drugs", await fetchSheetRows("drugs"));
  const aliasRows = rowsToObjects("aliases", await fetchSheetRows("aliases"));
  const testRows = rowsToObjects("test_entries", await fetchSheetRows("test_entries"));
  const noteRows = rowsToObjects("notes", await fetchSheetRows("notes"));

  const release = buildRelease(releaseRows);
  const sources = buildSources(sourceRows);
  const drugs = buildDrugs(
    drugRows,
    aliasRows,
    testRows,
    noteRows,
    sources
  );

  return {
    release,
    sources,
    drugs,
  };
}

function writeArtifacts(dataset) {
  mkdirSync(generatedDir, { recursive: true });

  const datasetPath = join(generatedDir, "dataset.json");
  const manifestPath = join(generatedDir, "manifest.json");
  const datasetJson = `${JSON.stringify(dataset, null, 2)}\n`;
  const checksum = createHash("sha256").update(datasetJson).digest("hex");
  const manifest = {
    version: dataset.release.version,
    releasedAt: dataset.release.releasedAt,
    minSupportedAppVersion: dataset.release.minSupportedAppVersion,
    approvedBy: dataset.release.approvedBy,
    checksum,
    datasetFile: "dataset.json",
    drugCount: dataset.drugs.length,
    sourceIds: Object.keys(dataset.sources),
  };

  writeFileSync(datasetPath, datasetJson);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return { checksum, datasetPath, manifestPath };
}

const dataset = buildDataset();
const resolvedDataset = await dataset;
const result = writeArtifacts(resolvedDataset);

console.log(`Generated dataset for ${resolvedDataset.drugs.length} drugs from Google Sheets.`);
console.log(`Spreadsheet ID: ${spreadsheetId()}`);
console.log(`Checksum: ${result.checksum}`);
