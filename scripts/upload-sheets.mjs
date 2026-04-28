/**
 * Uploads local TSV files from data/sheets/tsv/ to the Google Spreadsheet,
 * overwriting each matching tab in full.
 *
 * Usage:
 *   node scripts/upload-sheets.mjs
 *
 * Credentials: same env vars as export-dataset.mjs
 *   GOOGLE_SHEETS_CLIENT_EMAIL + GOOGLE_SHEETS_PRIVATE_KEY  (service account)
 *   or GOOGLE_SHEETS_API_KEY for public sheets (read-only — won't work for writes)
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleAuth } from "google-auth-library";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const tsvDir = join(rootDir, "data", "sheets", "tsv");
const DEFAULT_SPREADSHEET_ID = "1s2fAK0GokMk7hrWrXu6y4Av5au-cwQR0BND58ERbt9Q";

// Tab names in the order they should be processed (matches SHEET_RANGES in export-dataset.mjs)
const TAB_NAMES = [
  "release_metadata",
  "sources",
  "drugs",
  "aliases",
  "test_entries",
  "notes",
  "cross_reactivity",
];

// ── env loading ───────────────────────────────────────────────────────────────

function loadEnvFile(filename) {
  const filePath = join(rootDir, filename);
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const sep = line.indexOf("=");
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(sep + 1).trim();
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

// ── helpers ───────────────────────────────────────────────────────────────────

function fail(msg) {
  console.error(`\nError: ${msg}`);
  process.exit(1);
}

function spreadsheetId() {
  return process.env.GOOGLE_SHEETS_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;
}

function parseTsv(tabName) {
  const filePath = join(tsvDir, `${tabName}.tsv`);
  if (!existsSync(filePath)) fail(`TSV file not found: ${filePath}`);
  const content = readFileSync(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.split("\t"));
}

async function getAccessToken() {
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY;
  if (!email || !rawKey) {
    fail(
      "GOOGLE_SHEETS_CLIENT_EMAIL and GOOGLE_SHEETS_PRIVATE_KEY must be set in .env.local. " +
        "Note: an API key is read-only and cannot be used for writes."
    );
  }
  const auth = new GoogleAuth({
    credentials: {
      client_email: email,
      private_key: rawKey.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

async function sheetsRequest(method, path, body, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId()}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) fail(`Sheets API ${method} ${path} → HTTP ${response.status}: ${text}`);
  return JSON.parse(text);
}

// ── core logic ────────────────────────────────────────────────────────────────

async function getSheetMetadata(token) {
  const data = await sheetsRequest("GET", "?fields=sheets.properties", null, token);
  return data.sheets.map((s) => ({
    id: s.properties.sheetId,
    title: s.properties.title,
  }));
}

async function clearAndUploadTab(tabName, rows, token) {
  // 1. Clear existing content
  await sheetsRequest("POST", `/values/${encodeURIComponent(tabName)}:clear`, {}, token);

  // 2. Write new values
  const result = await sheetsRequest(
    "PUT",
    `/values/${encodeURIComponent(tabName)}?valueInputOption=RAW`,
    {
      range: tabName,
      majorDimension: "ROWS",
      values: rows,
    },
    token
  );

  return result.updatedCells ?? 0;
}

// ── main ──────────────────────────────────────────────────────────────────────

const token = await getAccessToken();

// Verify expected tabs exist, create missing ones
const sheetMeta = await getSheetMetadata(token);
const existingTitles = new Set(sheetMeta.map((s) => s.title));
const missingTabs = TAB_NAMES.filter((t) => !existingTitles.has(t));

if (missingTabs.length > 0) {
  console.log(`Creating missing tabs: ${missingTabs.join(", ")}\n`);
  for (const tabName of missingTabs) {
    await sheetsRequest("POST", ":batchUpdate", {
      requests: [{ addSheet: { properties: { title: tabName } } }],
    }, token);
  }
}

// Filter to tabs that have a local TSV file
const tsvTabNames = TAB_NAMES.filter((t) => {
  const filePath = join(tsvDir, `${t}.tsv`);
  return existsSync(filePath);
});

console.log(`Uploading ${tsvTabNames.length} tabs to spreadsheet ${spreadsheetId()}\n`);

for (const tabName of tsvTabNames) {
  const rows = parseTsv(tabName);
  const updatedCells = await clearAndUploadTab(tabName, rows, token);
  console.log(`  ✓ ${tabName.padEnd(20)} ${rows.length} rows, ${updatedCells} cells written`);
}

console.log("\nDone.");
