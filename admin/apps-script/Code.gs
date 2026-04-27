const ADMIN_APP = Object.freeze({
  tabs: {
    drugs: "drugs",
    aliases: "aliases",
    testEntries: "test_entries",
    notes: "notes",
    sources: "sources",
  },
  testKinds: ["prick", "idr", "patch"],
  noteKinds: ["info", "warning", "cross-reactivity"],
  dilutionPattern: /^[1-9]\d*:[1-9]\d*$/,
});

function doGet() {
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("Allergolib Admin")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function bootstrapAdminApp() {
  const spreadsheet = getSpreadsheet_();
  const sources = listSources_();
  const githubTrigger = getGithubTriggerConfig_();

  return {
    spreadsheetName: spreadsheet.getName(),
    defaultSourceId: sources[0] ? sources[0].id : "",
    connectedStatus: buildConnectedStatusMessage_(spreadsheet.getName(), githubTrigger),
    noteKinds: ADMIN_APP.noteKinds.slice(),
    testKinds: ADMIN_APP.testKinds.slice(),
    uiText: buildAdminUiText_(githubTrigger),
    lookups: listDrugLookups_(),
    sources,
  };
}

function loadDrugForAdmin(drugId) {
  const normalizedDrugId = toTrimmedString_(drugId);

  if (!normalizedDrugId) {
    throw new Error("Drug id is required.");
  }

  const sources = listSources_();
  const defaultSourceId = sources[0] ? sources[0].id : "";
  const drugsTable = readTable_(ADMIN_APP.tabs.drugs);
  const aliasesTable = readTable_(ADMIN_APP.tabs.aliases);
  const testEntriesTable = readTable_(ADMIN_APP.tabs.testEntries);
  const notesTable = readTable_(ADMIN_APP.tabs.notes);
  const drugRow = drugsTable.objects.find((row) => row.id === normalizedDrugId);
  const applicableKinds = {};

  if (!drugRow) {
    throw new Error(`Unknown drug id "${normalizedDrugId}".`);
  }

  const record = emptyDrugForm_(defaultSourceId);
  record.id = drugRow.id;
  record.name.en = toTrimmedString_(drugRow.name_en);
  record.name.fr = toTrimmedString_(drugRow.name_fr);
  record.className.en = toTrimmedString_(drugRow.class_name_en);
  record.className.fr = toTrimmedString_(drugRow.class_name_fr);

  record.aliases = aliasesTable.objects
    .filter((row) => row.drug_id === normalizedDrugId)
    .map((row) => toTrimmedString_(row.alias))
    .filter(Boolean);

  if (!record.aliases.length) {
    record.aliases = [""];
  }

  // Group test_entries by test_kind (new multi-source layout: one row per source entry).
  const testEntriesByKind = {};
  testEntriesTable.objects
    .filter((row) => row.drug_id === normalizedDrugId && ADMIN_APP.testKinds.includes(row.test_kind))
    .forEach((row) => {
      if (!testEntriesByKind[row.test_kind]) {
        testEntriesByKind[row.test_kind] = [];
      }
      testEntriesByKind[row.test_kind].push(row);
    });

  ADMIN_APP.testKinds.forEach((testKind) => {
    const rows = testEntriesByKind[testKind] || [];

    if (!rows.length) {
      return;
    }

    const preferredRow = rows.find((r) => r.is_preferred === "true") || rows[0];

    record.tests[testKind] = {
      dilutions: toTrimmedString_(preferredRow.dilutions),
      vehicle: {
        en: toTrimmedString_(preferredRow.vehicle_en),
        fr: toTrimmedString_(preferredRow.vehicle_fr),
      },
      sourceEntries: rows.map((row) => ({
        sourceId: toTrimmedString_(row.source_id) || defaultSourceId,
        concentration: toTrimmedString_(row.concentration),
        maxConcentration: toTrimmedString_(row.max_concentration),
        isPreferred: row.is_preferred === "true",
      })),
      notes: [],
    };

    if (hasMeaningfulTestFormContent_(record.tests[testKind])) {
      applicableKinds[testKind] = true;
    }
  });

  notesTable.objects
    .filter((row) => row.drug_id === normalizedDrugId)
    .forEach((row) => {
      if (!ADMIN_APP.testKinds.includes(row.test_kind)) {
        return;
      }

      record.tests[row.test_kind].notes.push({
        kind: toTrimmedString_(row.note_kind) || "info",
        value: {
          en: toTrimmedString_(row.note_en),
          fr: toTrimmedString_(row.note_fr),
        },
      });
      applicableKinds[row.test_kind] = true;
    });

  record.applicableTests = ADMIN_APP.testKinds.filter((testKind) => applicableKinds[testKind]);

  return {
    mode: "edit",
    originalId: normalizedDrugId,
    drug: record,
  };
}

function saveDrugFromAdmin(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const existingSources = listSources_();
    const existingSourcesById = Object.fromEntries(
      existingSources.map((source) => [source.id, source])
    );
    const newSources = normalizeSourceDrafts_((payload && payload.sources) || [], {
      existingSourceIds: Object.keys(existingSourcesById),
    });
    const sourcesById = Object.assign(
      {},
      existingSourcesById,
      Object.fromEntries(newSources.map((source) => [source.id, source]))
    );
    const lookups = listDrugLookups_();
    const originalId = toTrimmedString_(payload && payload.originalId);
    const normalized = normalizeDrugPayload_(payload && payload.drug, {
      existingIds: lookups.map((lookup) => lookup.id),
      originalId,
      sourcesById,
    });

    const drugsTable = readTable_(ADMIN_APP.tabs.drugs);
    const aliasesTable = readTable_(ADMIN_APP.tabs.aliases);
    const testEntriesTable = readTable_(ADMIN_APP.tabs.testEntries);
    const notesTable = readTable_(ADMIN_APP.tabs.notes);
    const sourcesTable = readTable_(ADMIN_APP.tabs.sources);

    newSources.forEach((source) => {
      upsertRowById_(sourcesTable, source.id, {
        id: source.id,
        label: source.label,
        organization: source.organization,
        year: source.year,
        version: source.version,
        status: source.status,
        url: source.url || "",
        document_name_en: source.documentName.en,
        document_name_fr: source.documentName.fr,
        excerpt_en: source.excerpt.en,
        excerpt_fr: source.excerpt.fr,
      });
    });

    upsertRowById_(drugsTable, originalId || normalized.id, {
      id: normalized.id,
      class_name_en: normalized.className.en,
      class_name_fr: normalized.className.fr,
      name_en: normalized.name.en,
      name_fr: normalized.name.fr,
    });

    replaceRowsByDrugId_(
      aliasesTable,
      originalId || normalized.id,
      normalized.aliases.map((alias) => ({
        drug_id: normalized.id,
        alias,
      }))
    );

    replaceTestEntryRows_(testEntriesTable, originalId || normalized.id, normalized);

    replaceRowsByDrugId_(
      notesTable,
      originalId || normalized.id,
      normalized.applicableTests.flatMap((testKind) =>
        normalized.tests[testKind].notes.map((note) => ({
          drug_id: normalized.id,
          test_kind: testKind,
          note_kind: note.kind,
          note_en: note.value.en,
          note_fr: note.value.fr,
        }))
      )
    );

    writeTable_(sourcesTable);
    writeTable_(drugsTable);
    writeTable_(aliasesTable);
    writeTable_(testEntriesTable);
    writeTable_(notesTable);

    SpreadsheetApp.flush();

    return {
      message: `Saved ${normalized.id} to Google Sheets.`,
      lookups: listDrugLookups_(),
      sources: listSources_(),
      record: loadDrugForAdmin(normalized.id),
    };
  } finally {
    lock.releaseLock();
  }
}

function publishDatasetFromAdmin() {
  const githubTrigger = dispatchGithubWorkflowOnSave_("manual", { promoteLatest: true, dryRun: false });

  if (githubTrigger.status === "disabled") {
    return { message: "GitHub workflow triggering is not enabled. Set GITHUB_TRIGGER_ON_SAVE=true in script properties." };
  }

  if (githubTrigger.status === "misconfigured") {
    return { message: `GitHub workflow triggering is enabled but misconfigured: ${githubTrigger.message}.` };
  }

  if (githubTrigger.status === "failed") {
    return { message: `GitHub workflow dispatch failed: ${githubTrigger.message}.` };
  }

  return { message: `Triggered GitHub dataset publish with latest promotion for ${githubTrigger.repo} on ${githubTrigger.ref}.` };
}

function deleteDrugFromAdmin(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const drugId = toTrimmedString_(payload && payload.drugId);
    const confirmation = toTrimmedString_(payload && payload.confirmation);

    if (!drugId) {
      throw new Error("Drug id is required before delete.");
    }

    if (confirmation !== drugId) {
      throw new Error(`Type ${drugId} exactly to confirm permanent delete.`);
    }

    const drugsTable = readTable_(ADMIN_APP.tabs.drugs);
    const aliasesTable = readTable_(ADMIN_APP.tabs.aliases);
    const testEntriesTable = readTable_(ADMIN_APP.tabs.testEntries);
    const notesTable = readTable_(ADMIN_APP.tabs.notes);

    if (!drugsTable.objects.some((row) => row.id === drugId)) {
      throw new Error(`Unknown drug id "${drugId}".`);
    }

    removeRowsByField_(drugsTable, "id", drugId);
    removeRowsByField_(aliasesTable, "drug_id", drugId);
    removeRowsByField_(testEntriesTable, "drug_id", drugId);
    removeRowsByField_(notesTable, "drug_id", drugId);

    writeTable_(drugsTable);
    writeTable_(aliasesTable);
    writeTable_(testEntriesTable);
    writeTable_(notesTable);

    SpreadsheetApp.flush();

    return {
      message: `Deleted ${drugId} and its linked aliases, tests, and notes.`,
      lookups: listDrugLookups_(),
      sources: listSources_(),
      record: {
        mode: "create",
        originalId: "",
        drug: emptyDrugForm_(firstSourceId_(Object.fromEntries(listSources_().map((source) => [source.id, source])))),
      },
    };
  } finally {
    lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const configuredId = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");

  if (configuredId) {
    return SpreadsheetApp.openById(configuredId);
  }

  const active = SpreadsheetApp.getActiveSpreadsheet();

  if (active) {
    return active;
  }

  throw new Error(
    "Spreadsheet access is not configured. Bind this Apps Script to the sheet or set the SPREADSHEET_ID script property."
  );
}

function getRequiredSheet_(tabName) {
  const sheet = getSpreadsheet_().getSheetByName(tabName);

  if (!sheet) {
    throw new Error(`Missing required sheet tab "${tabName}".`);
  }

  return sheet;
}

function readTable_(tabName) {
  const sheet = getRequiredSheet_(tabName);
  const range = sheet.getDataRange();
  const values = range.getDisplayValues();

  if (!values.length) {
    throw new Error(`Sheet "${tabName}" must include a header row.`);
  }

  const headers = values[0].map((value) => toTrimmedString_(value));
  const rows = values.slice(1).map((row) => padRow_(row, headers.length));
  const objects = rows.map((row) => rowToObject_(headers, row));

  return { headers, objects, rows, sheet, tabName };
}

function writeTable_(table) {
  const values = [table.headers, ...table.rows];
  table.sheet.clearContents();
  table.sheet.getRange(1, 1, values.length, table.headers.length).setValues(values);
}

function getGithubTriggerConfig_() {
  const enabled = getBooleanScriptProperty_("GITHUB_TRIGGER_ON_SAVE", false);
  const config = {
    enabled,
    owner: toTrimmedString_(
      PropertiesService.getScriptProperties().getProperty("GITHUB_TRIGGER_OWNER")
    ),
    repo: toTrimmedString_(
      PropertiesService.getScriptProperties().getProperty("GITHUB_TRIGGER_REPO")
    ),
    token: toTrimmedString_(
      PropertiesService.getScriptProperties().getProperty("GITHUB_TRIGGER_TOKEN")
    ),
    workflowFile:
      toTrimmedString_(
        PropertiesService.getScriptProperties().getProperty("GITHUB_TRIGGER_WORKFLOW_FILE")
      ) || "publish-dataset.yml",
    ref:
      toTrimmedString_(
        PropertiesService.getScriptProperties().getProperty("GITHUB_TRIGGER_REF")
      ) || "master",
    dryRun: getBooleanScriptProperty_("GITHUB_TRIGGER_DRY_RUN", true),
    promoteLatest: getBooleanScriptProperty_("GITHUB_TRIGGER_PROMOTE_LATEST", false),
  };

  const missing = [];

  if (enabled) {
    if (!config.owner) {
      missing.push("GITHUB_TRIGGER_OWNER");
    }

    if (!config.repo) {
      missing.push("GITHUB_TRIGGER_REPO");
    }

    if (!config.token) {
      missing.push("GITHUB_TRIGGER_TOKEN");
    }
  }

  config.configured = enabled && !missing.length;
  config.missing = missing;
  config.target = config.owner && config.repo ? `${config.owner}/${config.repo}` : "GitHub Actions";

  return config;
}

function getBooleanScriptProperty_(key, defaultValue) {
  const rawValue = toTrimmedString_(PropertiesService.getScriptProperties().getProperty(key));

  if (!rawValue) {
    return defaultValue;
  }

  return /^(1|true|yes|on)$/i.test(rawValue);
}

function buildAdminUiText_(githubTrigger) {
  const publishSummary = !githubTrigger.enabled
    ? "GitHub workflow triggering is disabled."
    : !githubTrigger.configured
      ? `GitHub workflow triggering is enabled but incomplete (missing: ${githubTrigger.missing.join(", ")}).`
      : githubTrigger.dryRun
        ? `Publish triggers a dry run for ${githubTrigger.target} on ${githubTrigger.ref}.`
        : githubTrigger.promoteLatest
          ? `Publish triggers a dataset publish with latest promotion for ${githubTrigger.target} on ${githubTrigger.ref}.`
          : `Publish triggers a versioned dataset publish for ${githubTrigger.target} on ${githubTrigger.ref}.`;

  return {
    actionNote:
      `Save writes directly to \`drugs\`, \`aliases\`, \`test_entries\`, \`notes\`, and any new inline \`sources\`. ${publishSummary}`,
    lookupBody:
      "Create or update a drug record in the normalized Google Sheet tabs. Save updates the sheet; Publish triggers the GitHub workflow.",
  };
}

function buildConnectedStatusMessage_(spreadsheetName, githubTrigger) {
  if (!githubTrigger.enabled) {
    return `Connected to ${spreadsheetName}. Save updates the sheet only.`;
  }

  if (!githubTrigger.configured) {
    return (
      `Connected to ${spreadsheetName}. Save updates the sheet, but GitHub workflow triggering is enabled ` +
      `without all required script properties: ${githubTrigger.missing.join(", ")}.`
    );
  }

  if (githubTrigger.dryRun) {
    return (
      `Connected to ${spreadsheetName}. Save updates the sheet and triggers a GitHub Actions dry run ` +
      `for ${githubTrigger.target} on ${githubTrigger.ref}.`
    );
  }

  if (githubTrigger.promoteLatest) {
    return (
      `Connected to ${spreadsheetName}. Save updates the sheet and triggers a GitHub dataset publish ` +
      `with latest promotion for ${githubTrigger.target} on ${githubTrigger.ref}.`
    );
  }

  return (
    `Connected to ${spreadsheetName}. Save updates the sheet and triggers a versioned GitHub dataset ` +
    `publish for ${githubTrigger.target} on ${githubTrigger.ref}.`
  );
}

function dispatchGithubWorkflowOnSave_(drugId, overrides) {
  const githubTrigger = getGithubTriggerConfig_();

  if (overrides) {
    if (overrides.promoteLatest != null) githubTrigger.promoteLatest = overrides.promoteLatest;
    if (overrides.dryRun != null) githubTrigger.dryRun = overrides.dryRun;
  }

  if (!githubTrigger.enabled) {
    return { status: "disabled" };
  }

  if (!githubTrigger.configured) {
    return {
      message: `missing script properties: ${githubTrigger.missing.join(", ")}`,
      status: "misconfigured",
    };
  }

  const url =
    `https://api.github.com/repos/${encodeURIComponent(githubTrigger.owner)}/` +
    `${encodeURIComponent(githubTrigger.repo)}/actions/workflows/` +
    `${encodeURIComponent(githubTrigger.workflowFile)}/dispatches`;

  const payload = {
    ref: githubTrigger.ref,
    inputs: {
      dry_run: String(githubTrigger.dryRun),
      promote_latest: String(githubTrigger.promoteLatest),
    },
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      contentType: "application/json",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${githubTrigger.token}`,
        "User-Agent": "Allergolib-Admin-App",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      method: "post",
      muteHttpExceptions: true,
      payload: JSON.stringify(payload),
    });
    const statusCode = response.getResponseCode();

    if (statusCode < 200 || statusCode >= 300) {
      throw new Error(parseGithubDispatchError_(response));
    }

    return {
      dryRun: githubTrigger.dryRun,
      promoteLatest: githubTrigger.promoteLatest,
      ref: githubTrigger.ref,
      repo: githubTrigger.target,
      status: "triggered",
      workflowFile: githubTrigger.workflowFile,
    };
  } catch (error) {
    console.error(
      `GitHub workflow dispatch failed after saving ${drugId}: ${error && error.message ? error.message : error}`
    );

    return {
      message: error && error.message ? error.message : "unknown dispatch error",
      status: "failed",
    };
  }
}

function parseGithubDispatchError_(response) {
  const statusCode = response.getResponseCode();
  const body = toTrimmedString_(response.getContentText());

  if (!body) {
    return `GitHub dispatch returned HTTP ${statusCode}.`;
  }

  try {
    const parsed = JSON.parse(body);
    const message = toTrimmedString_(parsed.message);

    if (message) {
      return `GitHub dispatch returned HTTP ${statusCode}: ${message}`;
    }
  } catch (error) {
    // Fall through to the raw body when GitHub does not return JSON.
  }

  return `GitHub dispatch returned HTTP ${statusCode}: ${body}`;
}


function listSources_() {
  const table = readTable_(ADMIN_APP.tabs.sources);

  return table.objects
    .map((row) => ({
      id: toTrimmedString_(row.id),
      label: toTrimmedString_(row.label),
      organization: toTrimmedString_(row.organization),
      year: toTrimmedString_(row.year),
      version: toTrimmedString_(row.version),
      status: toTrimmedString_(row.status),
      url: toTrimmedString_(row.url),
      documentName: {
        en: toTrimmedString_(row.document_name_en),
        fr: toTrimmedString_(row.document_name_fr),
      },
      excerpt: {
        en: toTrimmedString_(row.excerpt_en),
        fr: toTrimmedString_(row.excerpt_fr),
      },
    }))
    .filter((row) => row.id)
    .sort((left, right) => left.id.localeCompare(right.id));
}

function listDrugLookups_() {
  const table = readTable_(ADMIN_APP.tabs.drugs);

  return table.objects
    .map((row) => ({
      id: toTrimmedString_(row.id),
      className: {
        en: toTrimmedString_(row.class_name_en),
        fr: toTrimmedString_(row.class_name_fr),
      },
      name: {
        en: toTrimmedString_(row.name_en),
        fr: toTrimmedString_(row.name_fr),
      },
    }))
    .filter((row) => row.id)
    .sort((left, right) => {
      const leftName = normalizeText_(left.name.fr || left.name.en || left.id);
      const rightName = normalizeText_(right.name.fr || right.name.en || right.id);
      return leftName.localeCompare(rightName);
    });
}

function emptyDrugForm_(defaultSourceId) {
  const tests = {};

  ADMIN_APP.testKinds.forEach((testKind) => {
    tests[testKind] = emptyTestForm_(defaultSourceId);
  });

  return {
    id: "",
    name: { en: "", fr: "" },
    className: { en: "", fr: "" },
    aliases: [""],
    applicableTests: [],
    sources: [],
    tests,
  };
}

function emptyTestForm_(defaultSourceId) {
  return {
    dilutions: "",
    vehicle: { en: "", fr: "" },
    sourceEntries: [
      { sourceId: defaultSourceId || "", concentration: "", maxConcentration: "", isPreferred: true },
    ],
    notes: [],
  };
}

function emptySourceForm_() {
  return {
    id: "",
    label: "",
    organization: "",
    year: "",
    version: "",
    status: "",
    url: "",
    documentName: { en: "", fr: "" },
    excerpt: { en: "", fr: "" },
  };
}

function normalizeSourceDrafts_(drafts, options) {
  const errors = [];
  const existingSourceIds = new Set(options.existingSourceIds || []);
  const seenDraftIds = {};
  const normalized = (Array.isArray(drafts) ? drafts : [])
    .map((draft) => {
      const source = emptySourceForm_();

      source.id = toTrimmedString_(draft && draft.id);
      source.label = toTrimmedString_(draft && draft.label);
      source.organization = toTrimmedString_(draft && draft.organization);
      source.year = toTrimmedString_(draft && draft.year);
      source.version = toTrimmedString_(draft && draft.version);
      source.status = toTrimmedString_(draft && draft.status);
      source.documentName.en = toTrimmedString_(draft && draft.documentName && draft.documentName.en);
      source.documentName.fr = toTrimmedString_(draft && draft.documentName && draft.documentName.fr);
      source.url = toTrimmedString_(draft && draft.url);
      source.excerpt.en = toTrimmedString_(draft && draft.excerpt && draft.excerpt.en);
      source.excerpt.fr = toTrimmedString_(draft && draft.excerpt && draft.excerpt.fr);

      if (isSourceFormBlank_(source)) {
        return null;
      }

      if (!source.id) {
        errors.push("New sources must include an id.");
      } else if (existingSourceIds.has(source.id)) {
        errors.push(`Source id "${source.id}" already exists.`);
      } else if (seenDraftIds[source.id]) {
        errors.push(`Source id "${source.id}" is duplicated in the draft sources.`);
      } else {
        seenDraftIds[source.id] = true;
      }

      ["label", "organization", "year", "version", "status"].forEach((key) => {
        if (!source[key]) {
          errors.push(`Source ${source.id || "(new source)"} is missing ${key}.`);
        }
      });

      if (!source.documentName.fr || !source.documentName.en) {
        errors.push(`Source ${source.id || "(new source)"} must include document name in French and English.`);
      }

      if (!source.excerpt.fr || !source.excerpt.en) {
        errors.push(`Source ${source.id || "(new source)"} must include excerpt in French and English.`);
      }

      return source;
    })
    .filter((source) => source);

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  return normalized;
}

function normalizeDrugPayload_(payload, options) {
  const errors = [];
  const record = emptyDrugForm_(firstSourceId_(options.sourcesById));
  const existingIds = new Set(options.existingIds || []);
  const usedSourceIds = {};

  record.id = toTrimmedString_(payload && payload.id);
  record.name.en = toTrimmedString_(payload && payload.name && payload.name.en);
  record.name.fr = toTrimmedString_(payload && payload.name && payload.name.fr);
  record.className.en = toTrimmedString_(payload && payload.className && payload.className.en);
  record.className.fr = toTrimmedString_(payload && payload.className && payload.className.fr);
  record.aliases = uniqueStrings_((payload && payload.aliases) || []);
  record.applicableTests = uniqueStrings_((payload && payload.applicableTests) || []).filter((testKind) =>
    ADMIN_APP.testKinds.includes(testKind)
  );

  if (!record.id) {
    errors.push("Drug id is required.");
  }

  if (!record.name.fr || !record.name.en) {
    errors.push("Drug name is required in both French and English.");
  }

  if (!record.className.fr || !record.className.en) {
    errors.push("Drug class is required in both French and English.");
  }

  if (!record.aliases.length) {
    errors.push("At least one alias is required.");
  }

  if (!record.applicableTests.length) {
    errors.push("At least one applicable test entry is required.");
  }

  if (record.id && record.id !== options.originalId && existingIds.has(record.id)) {
    errors.push(`Drug id "${record.id}" already exists.`);
  }

  ADMIN_APP.testKinds.forEach((testKind) => {
    const rawTest = payload && payload.tests ? payload.tests[testKind] : null;
    const normalizedTest = emptyTestForm_(firstSourceId_(options.sourcesById));

    normalizedTest.dilutions = normalizeDilutionList_(rawTest && rawTest.dilutions, errors, testKind);
    normalizedTest.vehicle.en = toTrimmedString_(rawTest && rawTest.vehicle && rawTest.vehicle.en);
    normalizedTest.vehicle.fr = toTrimmedString_(rawTest && rawTest.vehicle && rawTest.vehicle.fr);
    normalizedTest.notes = normalizeNotes_(rawTest && rawTest.notes, errors, testKind);
    normalizedTest.sourceEntries = normalizeTestSourceEntries_(
      rawTest && rawTest.sourceEntries,
      errors,
      testKind,
      options.sourcesById,
      usedSourceIds
    );

    if (!record.applicableTests.includes(testKind)) {
      record.tests[testKind] = normalizedTest;
      return;
    }

    if (!hasMeaningfulTestFormContent_(normalizedTest)) {
      errors.push(
        `Test ${testKind} must include at least one of concentration, dilution, vehicle, note, or source entry.`
      );
    }

    if (Boolean(normalizedTest.vehicle.en) !== Boolean(normalizedTest.vehicle.fr)) {
      errors.push(`Vehicle must be bilingual for ${testKind} when provided.`);
    }

    record.tests[testKind] = normalizedTest;
  });

  if (!Object.keys(usedSourceIds).length) {
    errors.push("At least one source is required before save.");
  }

  if (errors.length) {
    throw new Error(errors.join("\n"));
  }

  return record;
}

function normalizeNotes_(notes, errors, testKind) {
  return (Array.isArray(notes) ? notes : [])
    .map((note) => ({
      kind: toTrimmedString_(note && note.kind) || "info",
      value: {
        en: toTrimmedString_(note && note.value && note.value.en),
        fr: toTrimmedString_(note && note.value && note.value.fr),
      },
    }))
    .filter((note) => note.value.en || note.value.fr)
    .map((note) => {
      if (!ADMIN_APP.noteKinds.includes(note.kind)) {
        errors.push(`Invalid note kind "${note.kind}" for ${testKind}.`);
      }

      if (!note.value.en || !note.value.fr) {
        errors.push(`Notes must be bilingual for ${testKind}.`);
      }

      return note;
    });
}

function normalizeTestSourceEntries_(rawEntries, errors, testKind, sourcesById, usedSourceIds) {
  const entries = Array.isArray(rawEntries) ? rawEntries : [];
  const normalized = entries
    .map((entry) => ({
      sourceId: toTrimmedString_(entry && entry.sourceId),
      concentration: toTrimmedString_(entry && entry.concentration),
      maxConcentration: toTrimmedString_(entry && entry.maxConcentration),
      isPreferred: Boolean(entry && entry.isPreferred),
    }))
    .filter((entry) => entry.sourceId);

  const preferredCount = normalized.filter((e) => e.isPreferred).length;

  if (normalized.length > 0 && preferredCount !== 1) {
    errors.push(`Test ${testKind} must have exactly one preferred source entry (found ${preferredCount}).`);
  }

  const seenIds = {};
  normalized.forEach((entry) => {
    if (!sourcesById[entry.sourceId]) {
      errors.push(`Source "${entry.sourceId}" does not exist for ${testKind}.`);
    } else {
      usedSourceIds[entry.sourceId] = true;
    }

    if (seenIds[entry.sourceId]) {
      errors.push(`Duplicate source "${entry.sourceId}" in ${testKind}.`);
    }
    seenIds[entry.sourceId] = true;
  });

  return normalized;
}

function normalizeDilutionList_(value, errors, testKind) {
  const raw = toTrimmedString_(value);

  if (!raw) {
    return "";
  }

  const seen = {};
  const normalized = raw
    .split(";")
    .map((item) => toTrimmedString_(item))
    .filter(Boolean)
    .map((dilution) => {
      if (!ADMIN_APP.dilutionPattern.test(dilution)) {
        errors.push(`Dilution "${dilution}" is invalid for ${testKind}. Use the form 1:10.`);
        return "";
      }

      return normalizeDilutionValue_(dilution, errors, testKind);
    })
    .filter((value) => {
      if (!value || seen[value]) {
        return false;
      }

      seen[value] = true;
      return true;
    });

  return normalized.join("; ");
}

function normalizeDilutionValue_(value, errors, testKind) {
  const parts = value.split(":");
  const left = Number(parts[0]);
  const right = Number(parts[1]);

  if (!(left > 0) || !(right > 0)) {
    errors.push(`Dilution "${value}" is invalid for ${testKind}. Values must be positive integers.`);
    return "";
  }

  const divisor = gcd_(left, right);
  return `${left / divisor}:${right / divisor}`;
}

function gcd_(left, right) {
  let a = Math.abs(left);
  let b = Math.abs(right);

  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }

  return a || 1;
}

function hasMeaningfulTestFormContent_(test) {
  return Boolean(
    (test.sourceEntries && test.sourceEntries.some((e) => e.concentration || e.maxConcentration)) ||
      test.dilutions ||
      test.vehicle.en ||
      test.vehicle.fr ||
      test.notes.length
  );
}

function isSourceFormBlank_(source) {
  return !(
    source.id ||
    source.label ||
    source.organization ||
    source.year ||
    source.version ||
    source.status ||
    source.documentName.en ||
    source.documentName.fr ||
    source.excerpt.en ||
    source.excerpt.fr
  );
}

function upsertRowById_(table, targetId, object) {
  const index = table.objects.findIndex((row) => row.id === targetId);
  const existingRow = index >= 0 ? table.rows[index] : null;
  const values = objectToRow_(table.headers, object, existingRow);

  if (index >= 0) {
    table.rows[index] = values;
    table.objects[index] = rowToObject_(table.headers, values);
    return;
  }

  table.rows.push(values);
  table.objects.push(rowToObject_(table.headers, values));
}

function replaceRowsByDrugId_(table, targetId, objects) {
  const filteredRows = [];

  table.objects.forEach((row, index) => {
    if (row.drug_id === targetId) {
      return;
    }

    filteredRows.push(table.rows[index]);
  });

  const nextRows = objects.map((object) => objectToRow_(table.headers, object));
  table.rows = filteredRows.concat(nextRows);
  table.objects = table.rows.map((row) => rowToObject_(table.headers, row));
}

function replaceTestEntryRows_(table, targetId, record) {
  const preservedRows = [];

  table.objects.forEach((row, index) => {
    if (row.drug_id === targetId) {
      return;
    }

    preservedRows.push(table.rows[index]);
  });

  const nextRows = [];
  record.applicableTests.forEach((testKind) => {
    const test = record.tests[testKind];
    const entries = test.sourceEntries && test.sourceEntries.length
      ? test.sourceEntries
      : [{ sourceId: "", concentration: "", maxConcentration: "", isPreferred: true }];

    entries.forEach((entry, entryIndex) => {
      nextRows.push(
        objectToRow_(
          table.headers,
          {
            drug_id: record.id,
            test_kind: testKind,
            source_id: entry.sourceId,
            is_preferred: entry.isPreferred ? "true" : "false",
            concentration: entry.concentration || "",
            max_concentration: entry.maxConcentration || "",
            dilutions: entryIndex === 0 ? test.dilutions : "",
            vehicle_en: entryIndex === 0 ? test.vehicle.en : "",
            vehicle_fr: entryIndex === 0 ? test.vehicle.fr : "",
          },
          null
        )
      );
    });
  });

  table.rows = preservedRows.concat(nextRows);
  table.objects = table.rows.map((row) => rowToObject_(table.headers, row));
}

function removeRowsByField_(table, fieldName, targetValue) {
  const filteredRows = [];

  table.objects.forEach((row, index) => {
    if (row[fieldName] === targetValue) {
      return;
    }

    filteredRows.push(table.rows[index]);
  });

  table.rows = filteredRows;
  table.objects = table.rows.map((row) => rowToObject_(table.headers, row));
}

function rowToObject_(headers, row) {
  const object = {};

  headers.forEach((header, index) => {
    object[header] = row[index] || "";
  });

  return object;
}

function objectToRow_(headers, object, existingRow) {
  const row = padRow_(existingRow || [], headers.length);

  headers.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(object, header)) {
      row[index] = toTrimmedString_(object[header]);
    }
  });

  return row;
}

function padRow_(row, width) {
  const nextRow = row.slice(0, width);

  while (nextRow.length < width) {
    nextRow.push("");
  }

  return nextRow;
}

function uniqueStrings_(values) {
  const seen = {};

  return (Array.isArray(values) ? values : [])
    .map((value) => toTrimmedString_(value))
    .filter((value) => {
      if (!value || seen[value]) {
        return false;
      }

      seen[value] = true;
      return true;
    });
}

function firstSourceId_(sourcesById) {
  const ids = Object.keys(sourcesById || {});
  return ids[0] || "";
}

function toTrimmedString_(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeText_(value) {
  return toTrimmedString_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
