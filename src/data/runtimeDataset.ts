import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

import appConfig from "../../app.json";
import type {
  CrossReactivityEntry,
  CrossReactivityGroup,
  CrossReactivityTier,
  Dataset,
  DatasetManifest,
  NoteKind,
  DatasetRelease,
  LocalizedString,
  SourceDocument,
  StructuralRelation,
  TestNote,
  TestKind,
  TestRecord,
  TestSourceEntry,
} from "../types";
import { bundledDatasetJson, bundledManifestJson } from "./loadBundledDataset";

const STORAGE_KEY = "@periop-skin-test/active-dataset";
const TEST_KINDS: TestKind[] = ["prick", "idr", "patch"];
const APP_VERSION = appConfig.expo.version;
const REMOTE_MANIFEST_URL =
  process.env.EXPO_PUBLIC_DATASET_MANIFEST_URL?.trim() ||
  appConfig.expo.extra.datasetManifestUrl.trim();

type UnknownRecord = Record<string, unknown>;

export type DatasetOrigin = "bundled" | "cached" | "remote";

export type ActiveDataset = {
  dataset: Dataset;
  manifest: DatasetManifest;
  origin: DatasetOrigin;
};

export type DatasetSyncResult =
  | {
      status: "disabled" | "failed" | "unsupported" | "up-to-date";
    }
  | {
      status: "activated";
      activeDataset: ActiveDataset;
    };

const bundledActiveDataset = createActiveDataset(
  normalizeManifest(bundledManifestJson, "bundled manifest"),
  normalizeDataset(bundledDatasetJson, "bundled dataset"),
  "bundled"
);

function fail(message: string): never {
  throw new Error(message);
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown, context: string): UnknownRecord {
  if (!isRecord(value)) {
    fail(`${context} must be an object.`);
  }

  return value;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== "string") {
    fail(`${context} must be a string.`);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    fail(`${context} must not be empty.`);
  }

  return trimmed;
}

function asOptionalString(value: unknown, context: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    fail(`${context} must be a string when present.`);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function asStringArray(value: unknown, context: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${context} must be an array.`);
  }

  return value.map((entry, index) => asString(entry, `${context}[${index}]`));
}

function asLocalizedString(value: unknown, context: string): LocalizedString {
  const record = asRecord(value, context);

  return {
    en: asString(record.en, `${context}.en`),
    fr: asString(record.fr, `${context}.fr`),
  };
}

function asLocalizedStringArray(value: unknown, context: string): LocalizedString[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${context} must be an array.`);
  }

  return value.map((entry, index) => asLocalizedString(entry, `${context}[${index}]`));
}

function hasDisplayableTestContent(test: TestRecord) {
  return (
    test.sourceEntries.some((e) => e.concentration || e.maxConcentration) ||
    test.dilutions.length > 0 ||
    Boolean(test.vehicle) ||
    test.notes.length > 0
  );
}

function assertSourceDocumentComplete(
  source: SourceDocument | undefined,
  context: string
) {
  if (!source) {
    fail(`${context} must reference an existing source.`);
  }

  const localizedFields: Array<[string, string]> = [
    ["documentName.en", source.documentName.en],
    ["documentName.fr", source.documentName.fr],
    ["excerpt.en", source.excerpt.en],
    ["excerpt.fr", source.excerpt.fr],
  ];
  const stringFields: Array<[string, string]> = [
    ["label", source.label],
    ["organization", source.organization],
    ["year", source.year],
    ["version", source.version],
    ["status", source.status],
  ];

  for (const [fieldName, value] of [...stringFields, ...localizedFields]) {
    if (!value.trim()) {
      fail(`${context}.${fieldName} must not be empty.`);
    }
  }
}

function inferLegacyNoteKind(note: LocalizedString): NoteKind {
  const combined = `${note.en} ${note.fr}`.toLowerCase();

  if (
    combined.includes("cross-react") ||
    combined.includes("cross react") ||
    combined.includes("reactivite croisee")
  ) {
    return "cross-reactivity";
  }

  if (
    combined.includes("risk") ||
    combined.includes("warning") ||
    combined.includes("irritant") ||
    combined.includes("false positive") ||
    combined.includes("aucune") ||
    combined.includes("no ") ||
    combined.includes("risque") ||
    combined.includes("attention")
  ) {
    return "warning";
  }

  return "info";
}

function asNoteKind(value: unknown, context: string): NoteKind {
  if (value === undefined || value === null || value === "") {
    return "info";
  }

  if (value !== "info" && value !== "warning" && value !== "cross-reactivity") {
    fail(`${context} must be info, warning, or cross-reactivity.`);
  }

  return value;
}

function asTestNotes(value: unknown, context: string): TestNote[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    fail(`${context} must be an array.`);
  }

  return value.map((entry, index) => {
    if (isRecord(entry) && ("value" in entry || "kind" in entry)) {
      return {
        kind: asNoteKind(entry.kind, `${context}[${index}].kind`),
        value: asLocalizedString(entry.value, `${context}[${index}].value`),
      };
    }

    const localizedValue = asLocalizedString(entry, `${context}[${index}]`);

    return {
      kind: inferLegacyNoteKind(localizedValue),
      value: localizedValue,
    };
  });
}

function normalizeRelease(value: unknown, context: string): DatasetRelease {
  const record = asRecord(value, context);

  return {
    version: asString(record.version, `${context}.version`),
    releasedAt: asString(record.releasedAt, `${context}.releasedAt`),
    minSupportedAppVersion: asString(
      record.minSupportedAppVersion,
      `${context}.minSupportedAppVersion`
    ),
    approvedBy: asString(record.approvedBy, `${context}.approvedBy`),
  };
}

function normalizeSourceDocument(value: unknown, context: string): SourceDocument {
  const record = asRecord(value, context);

  return {
    id: asString(record.id, `${context}.id`),
    label: asString(record.label, `${context}.label`),
    organization: asString(record.organization, `${context}.organization`),
    year: asString(record.year, `${context}.year`),
    version: asString(record.version, `${context}.version`),
    status: asString(record.status, `${context}.status`),
    url: asOptionalString(record.url, `${context}.url`),
    documentName: asLocalizedString(record.documentName, `${context}.documentName`),
    excerpt: asLocalizedString(record.excerpt, `${context}.excerpt`),
  };
}

function normalizeTestSourceEntry(
  value: unknown,
  context: string,
  sourceIds: Set<string>
): TestSourceEntry {
  const record = asRecord(value, context);
  const sourceId = asString(record.sourceId, `${context}.sourceId`);

  if (!sourceIds.has(sourceId)) {
    fail(`${context}.sourceId references an unknown source: ${sourceId}.`);
  }

  const concentration = asOptionalString(record.concentration, `${context}.concentration`);
  const maxConcentration = asOptionalString(record.maxConcentration, `${context}.maxConcentration`);
  const isPreferred = record.isPreferred === true || record.isPreferred === "true";

  return { sourceId, concentration, maxConcentration, isPreferred };
}

function normalizeTestRecord(
  value: unknown,
  context: string,
  sourceIds: Set<string>
): TestRecord {
  const record = asRecord(value, context);
  const dilutions = asStringArray(record.dilutions, `${context}.dilutions`);
  const vehicle = record.vehicle ? asLocalizedString(record.vehicle, `${context}.vehicle`) : undefined;
  const notes = asTestNotes(record.notes, `${context}.notes`);

  let sourceEntries: TestSourceEntry[];

  if (Array.isArray(record.sourceEntries)) {
    // New format.
    sourceEntries = record.sourceEntries.map((entry, i) =>
      normalizeTestSourceEntry(entry, `${context}.sourceEntries[${i}]`, sourceIds)
    );
  } else {
    // Legacy format: reconstruct sourceEntries from flat fields.
    const preferredSourceId = asOptionalString(
      record.preferredSourceId ?? record.sourceId,
      `${context}.preferredSourceId`
    ) ?? "";

    const concentration = asOptionalString(record.concentration, `${context}.concentration`);
    const maxConcentration = asOptionalString(record.maxConcentration, `${context}.maxConcentration`);
    const hasContent = Boolean(concentration || maxConcentration || dilutions.length || vehicle || notes.length);

    sourceEntries = [];

    if (preferredSourceId) {
      if (!sourceIds.has(preferredSourceId)) {
        fail(`${context}.preferredSourceId references an unknown source: ${preferredSourceId}.`);
      }
      sourceEntries.push({ sourceId: preferredSourceId, concentration, maxConcentration, isPreferred: true });
    } else if (hasContent) {
      fail(`${context}.preferredSourceId must not be empty.`);
    }

    const alternateSourceId = asOptionalString(record.alternateSourceId, `${context}.alternateSourceId`);

    if (alternateSourceId) {
      if (!sourceIds.has(alternateSourceId)) {
        fail(`${context}.alternateSourceId references an unknown source: ${alternateSourceId}.`);
      }
      sourceEntries.push({ sourceId: alternateSourceId, isPreferred: false });
    }
  }

  return { sourceEntries, dilutions, vehicle, notes };
}

function asCrossReactivityTier(value: unknown, context: string): CrossReactivityTier {
  if (value !== "higher-concern" && value !== "lower-expected" && value !== "uncertain") {
    fail(`${context} must be higher-concern, lower-expected, or uncertain.`);
  }
  return value;
}

function asStructuralRelation(value: unknown, context: string): StructuralRelation {
  if (value !== "structurally-related" && value !== "structurally-distinct") {
    fail(`${context} must be structurally-related or structurally-distinct.`);
  }
  return value;
}

function normalizeCrossReactivityEntry(
  value: unknown,
  context: string,
  sourceIds: Set<string>
): CrossReactivityEntry {
  const record = asRecord(value, context);
  const entrySourceIds = asStringArray(record.sourceIds, `${context}.sourceIds`);

  for (const sid of entrySourceIds) {
    if (!sourceIds.has(sid)) {
      fail(`${context}.sourceIds references unknown source: ${sid}.`);
    }
  }

  return {
    drugId: asString(record.drugId, `${context}.drugId`),
    tier: asCrossReactivityTier(record.tier, `${context}.tier`),
    structuralRelation: asStructuralRelation(record.structuralRelation, `${context}.structuralRelation`),
    rationale: asLocalizedString(record.rationale, `${context}.rationale`),
    sourceIds: entrySourceIds,
  };
}

function normalizeCrossReactivityGroup(
  value: unknown,
  context: string,
  sourceIds: Set<string>
): CrossReactivityGroup {
  const record = asRecord(value, context);
  const entries = Array.isArray(record.entries)
    ? record.entries.map((e, i) =>
        normalizeCrossReactivityEntry(e, `${context}.entries[${i}]`, sourceIds)
      )
    : [];
  const panelRationale = record.panelRationale
    ? asLocalizedString(record.panelRationale, `${context}.panelRationale`)
    : undefined;

  return {
    groupName: asLocalizedString(record.groupName, `${context}.groupName`),
    entries,
    suggestedPanel: asStringArray(record.suggestedPanel, `${context}.suggestedPanel`),
    ...(panelRationale ? { panelRationale } : {}),
  };
}

function normalizeDataset(value: unknown, context: string): Dataset {
  const record = asRecord(value, context);
  const sourcesRecord = asRecord(record.sources, `${context}.sources`);
  const sources = Object.fromEntries(
    Object.entries(sourcesRecord).map(([sourceId, sourceValue]) => {
      const source = normalizeSourceDocument(sourceValue, `${context}.sources.${sourceId}`);

      if (source.id !== sourceId) {
        fail(`${context}.sources.${sourceId}.id must match the source key.`);
      }

      return [sourceId, source];
    })
  ) as Record<string, SourceDocument>;
  const sourceIds = new Set(Object.keys(sources));

  if (!sourceIds.size) {
    fail(`${context}.sources must contain at least one source.`);
  }

  if (!Array.isArray(record.drugs)) {
    fail(`${context}.drugs must be an array.`);
  }

  const drugs = record.drugs.map((drugValue, index) => {
    const drug = asRecord(drugValue, `${context}.drugs[${index}]`);
    const testsRecord = asRecord(drug.tests, `${context}.drugs[${index}].tests`);

    const subclassNameRaw = drug.subclassName;
    const subclassName =
      subclassNameRaw !== undefined && subclassNameRaw !== null
        ? asLocalizedString(subclassNameRaw, `${context}.drugs[${index}].subclassName`)
        : undefined;

    const crossReactivityRaw = drug.crossReactivity;
    const crossReactivity =
      Array.isArray(crossReactivityRaw) && crossReactivityRaw.length > 0
        ? crossReactivityRaw.map((g, gi) =>
            normalizeCrossReactivityGroup(
              g,
              `${context}.drugs[${index}].crossReactivity[${gi}]`,
              sourceIds
            )
          )
        : undefined;

    return {
      id: asString(drug.id, `${context}.drugs[${index}].id`),
      name: asLocalizedString(drug.name, `${context}.drugs[${index}].name`),
      className: asLocalizedString(drug.className, `${context}.drugs[${index}].className`),
      subclassName,
      aliases: asStringArray(drug.aliases, `${context}.drugs[${index}].aliases`),
      tests: {
        prick: normalizeTestRecord(
          testsRecord.prick,
          `${context}.drugs[${index}].tests.prick`,
          sourceIds
        ),
        idr: normalizeTestRecord(
          testsRecord.idr,
          `${context}.drugs[${index}].tests.idr`,
          sourceIds
        ),
        patch: normalizeTestRecord(
          testsRecord.patch,
          `${context}.drugs[${index}].tests.patch`,
          sourceIds
        ),
      },
      ...(crossReactivity ? { crossReactivity } : {}),
    };
  });

  for (const drug of drugs) {
    for (const kind of TEST_KINDS) {
      const test = drug.tests[kind];

      if (!hasDisplayableTestContent(test)) {
        continue;
      }

      for (const entry of test.sourceEntries) {
        assertSourceDocumentComplete(
          sources[entry.sourceId],
          `${context}.drugs.${drug.id}.tests.${kind}.source.${entry.sourceId}`
        );
      }
    }
  }

  return {
    release: normalizeRelease(record.release, `${context}.release`),
    sources,
    drugs,
  };
}

function normalizeManifest(value: unknown, context: string): DatasetManifest {
  const record = asRecord(value, context);
  const drugCountRaw = record.drugCount;
  const drugCount =
    typeof drugCountRaw === "number"
      ? drugCountRaw
      : Number(asString(drugCountRaw, `${context}.drugCount`));

  if (!Number.isInteger(drugCount) || drugCount < 0) {
    fail(`${context}.drugCount must be a non-negative integer.`);
  }

  return {
    ...normalizeRelease(record, context),
    checksum: asString(record.checksum, `${context}.checksum`),
    datasetFile: asString(record.datasetFile, `${context}.datasetFile`),
    drugCount,
    sourceIds: asStringArray(record.sourceIds, `${context}.sourceIds`),
  };
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(/[.-]/);
  const rightParts = right.split(/[.-]/);
  const length = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? "0";
    const rightPart = rightParts[index] ?? "0";
    const leftNumber = Number(leftPart);
    const rightNumber = Number(rightPart);
    const bothNumeric =
      Number.isFinite(leftNumber) &&
      Number.isFinite(rightNumber) &&
      leftPart !== "" &&
      rightPart !== "";

    if (bothNumeric) {
      if (leftNumber > rightNumber) {
        return 1;
      }

      if (leftNumber < rightNumber) {
        return -1;
      }

      continue;
    }

    const lexical = leftPart.localeCompare(rightPart);

    if (lexical !== 0) {
      return lexical > 0 ? 1 : -1;
    }
  }

  return 0;
}

function sortStrings(values: string[]) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function assertManifestMatchesDataset(manifest: DatasetManifest, dataset: Dataset, context: string) {
  if (manifest.version !== dataset.release.version) {
    fail(`${context}: manifest version does not match dataset release version.`);
  }

  if (manifest.releasedAt !== dataset.release.releasedAt) {
    fail(`${context}: manifest releasedAt does not match dataset release.`);
  }

  if (manifest.minSupportedAppVersion !== dataset.release.minSupportedAppVersion) {
    fail(`${context}: manifest minSupportedAppVersion does not match dataset release.`);
  }

  if (manifest.approvedBy !== dataset.release.approvedBy) {
    fail(`${context}: manifest approvedBy does not match dataset release.`);
  }

  if (manifest.drugCount !== dataset.drugs.length) {
    fail(`${context}: manifest drugCount does not match dataset contents.`);
  }

  const manifestSourceIds = sortStrings(manifest.sourceIds);
  const datasetSourceIds = sortStrings(Object.keys(dataset.sources));

  if (manifestSourceIds.length !== datasetSourceIds.length) {
    fail(`${context}: manifest sourceIds do not match dataset sources.`);
  }

  for (let index = 0; index < manifestSourceIds.length; index += 1) {
    if (manifestSourceIds[index] !== datasetSourceIds[index]) {
      fail(`${context}: manifest sourceIds do not match dataset sources.`);
    }
  }
}

function createActiveDataset(
  manifest: DatasetManifest,
  dataset: Dataset,
  origin: DatasetOrigin
): ActiveDataset {
  assertManifestMatchesDataset(manifest, dataset, `${origin} dataset`);

  return {
    manifest,
    dataset,
    origin,
  };
}

async function persistActiveDataset(activeDataset: ActiveDataset) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      manifest: activeDataset.manifest,
      dataset: activeDataset.dataset,
    })
  );
}

async function fetchText(url: string, context: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
  });

  if (!response.ok) {
    fail(`${context} failed with HTTP ${response.status}.`);
  }

  return response.text();
}

export function getBundledActiveDataset() {
  return bundledActiveDataset;
}

export async function loadActiveDataset(): Promise<ActiveDataset> {
  const cachedValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!cachedValue) {
    return bundledActiveDataset;
  }

  try {
    const parsed = asRecord(JSON.parse(cachedValue), "cached active dataset");

    return createActiveDataset(
      normalizeManifest(parsed.manifest, "cached manifest"),
      normalizeDataset(parsed.dataset, "cached dataset"),
      "cached"
    );
  } catch (error) {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.warn("Discarded invalid cached dataset.", error);
    return bundledActiveDataset;
  }
}

export async function syncDatasetInBackground(
  currentManifest: DatasetManifest
): Promise<DatasetSyncResult> {
  if (!REMOTE_MANIFEST_URL) {
    return { status: "disabled" };
  }

  try {
    const manifestText = await fetchText(REMOTE_MANIFEST_URL, "Remote manifest fetch");
    const remoteManifest = normalizeManifest(JSON.parse(manifestText), "remote manifest");

    if (compareVersions(APP_VERSION, remoteManifest.minSupportedAppVersion) < 0) {
      return { status: "unsupported" };
    }

    if (compareVersions(remoteManifest.version, currentManifest.version) < 0) {
      return { status: "up-to-date" };
    }

    if (remoteManifest.checksum === currentManifest.checksum) {
      return { status: "up-to-date" };
    }

    const datasetUrl = new URL(remoteManifest.datasetFile, REMOTE_MANIFEST_URL).toString();
    const datasetText = await fetchText(datasetUrl, "Remote dataset fetch");
    const checksum = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      datasetText
    );

    if (checksum !== remoteManifest.checksum) {
      fail("Remote dataset checksum mismatch.");
    }

    const activeDataset = createActiveDataset(
      remoteManifest,
      normalizeDataset(JSON.parse(datasetText), "remote dataset"),
      "remote"
    );

    await persistActiveDataset(activeDataset);

    return {
      status: "activated",
      activeDataset,
    };
  } catch (error) {
    console.warn("Background dataset sync failed.", error);
    return { status: "failed" };
  }
}
