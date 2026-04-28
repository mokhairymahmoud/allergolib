import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

import { buildDatasetFromTabRows } from "./lib/datasetContract.mjs";

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
const OPTIONAL_SHEET_RANGES = {
  cross_reactivity: "cross_reactivity!A:Z",
};

function loadEnvFile(filename) {
  const filePath = join(rootDir, filename);

  if (!existsSync(filePath)) {
    return;
  }

  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

function fail(message) {
  throw new Error(message);
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
  const range = SHEET_RANGES[tabName] || OPTIONAL_SHEET_RANGES[tabName];
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
  return json.values ?? [];
}

async function fetchOptionalSheetRows(tabName) {
  try {
    return await fetchSheetRows(tabName);
  } catch {
    return [];
  }
}

async function buildDataset() {
  const tabRowsByName = Object.fromEntries(
    await Promise.all(
      Object.keys(SHEET_RANGES).map(async (tabName) => [tabName, await fetchSheetRows(tabName)])
    )
  );

  const optionalEntries = await Promise.all(
    Object.keys(OPTIONAL_SHEET_RANGES).map(async (tabName) => [tabName, await fetchOptionalSheetRows(tabName)])
  );
  Object.assign(tabRowsByName, Object.fromEntries(optionalEntries));

  return buildDatasetFromTabRows(tabRowsByName);
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

const resolvedDataset = await buildDataset();
const result = writeArtifacts(resolvedDataset);

console.log(`Generated dataset for ${resolvedDataset.drugs.length} drugs from Google Sheets.`);
console.log(`Spreadsheet ID: ${spreadsheetId()}`);
console.log(`Checksum: ${result.checksum}`);
