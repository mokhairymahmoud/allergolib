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
  dilutionPattern: /^\d+:\d+$/,
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
  const lookups = listDrugLookups_();

  return {
    spreadsheetName: spreadsheet.getName(),
    defaultSourceId: sources[0] ? sources[0].id : "",
    noteKinds: ADMIN_APP.noteKinds.slice(),
    testKinds: ADMIN_APP.testKinds.slice(),
    lookups,
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

  testEntriesTable.objects
    .filter((row) => row.drug_id === normalizedDrugId)
    .forEach((row) => {
      if (!ADMIN_APP.testKinds.includes(row.test_kind)) {
        return;
      }

      record.tests[row.test_kind] = {
        concentration: toTrimmedString_(row.concentration),
        maxConcentration: toTrimmedString_(row.max_concentration),
        dilutions: toTrimmedString_(row.dilutions),
        vehicle: {
          en: toTrimmedString_(row.vehicle_en),
          fr: toTrimmedString_(row.vehicle_fr),
        },
        sourceId: toTrimmedString_(row.source_id) || defaultSourceId,
        alternateSourceId: toTrimmedString_(row.alternate_source_id),
        notes: [],
      };
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
    });

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
    const sources = listSources_();
    const sourcesById = Object.fromEntries(sources.map((source) => [source.id, source]));
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

    upsertDrugRow_(drugsTable, originalId || normalized.id, {
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

    replaceTestEntryRows_(
      testEntriesTable,
      originalId || normalized.id,
      normalized
    );

    replaceRowsByDrugId_(
      notesTable,
      originalId || normalized.id,
      ADMIN_APP.testKinds.flatMap((testKind) =>
        normalized.tests[testKind].notes.map((note) => ({
          drug_id: normalized.id,
          test_kind: testKind,
          note_kind: note.kind,
          note_en: note.value.en,
          note_fr: note.value.fr,
        }))
      )
    );

    writeTable_(drugsTable);
    writeTable_(aliasesTable);
    writeTable_(testEntriesTable);
    writeTable_(notesTable);

    SpreadsheetApp.flush();

    return {
      message: `Saved ${normalized.id} to Google Sheets. Dataset publication remains a separate step.`,
      lookups: listDrugLookups_(),
      record: loadDrugForAdmin(normalized.id),
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
    tests,
  };
}

function emptyTestForm_(defaultSourceId) {
  return {
    concentration: "",
    maxConcentration: "",
    dilutions: "",
    vehicle: { en: "", fr: "" },
    sourceId: defaultSourceId || "",
    alternateSourceId: "",
    notes: [],
  };
}

function normalizeDrugPayload_(payload, options) {
  const errors = [];
  const record = emptyDrugForm_(firstSourceId_(options.sourcesById));
  const existingIds = new Set(options.existingIds || []);

  record.id = toTrimmedString_(payload && payload.id);
  record.name.en = toTrimmedString_(payload && payload.name && payload.name.en);
  record.name.fr = toTrimmedString_(payload && payload.name && payload.name.fr);
  record.className.en = toTrimmedString_(payload && payload.className && payload.className.en);
  record.className.fr = toTrimmedString_(payload && payload.className && payload.className.fr);
  record.aliases = uniqueStrings_((payload && payload.aliases) || []);

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

  if (record.id && record.id !== options.originalId && existingIds.has(record.id)) {
    errors.push(`Drug id "${record.id}" already exists.`);
  }

  ADMIN_APP.testKinds.forEach((testKind) => {
    const rawTest = payload && payload.tests ? payload.tests[testKind] : null;
    const normalizedTest = emptyTestForm_(firstSourceId_(options.sourcesById));
    normalizedTest.concentration = toTrimmedString_(rawTest && rawTest.concentration);
    normalizedTest.maxConcentration = toTrimmedString_(rawTest && rawTest.maxConcentration);
    normalizedTest.dilutions = normalizeDilutionList_(rawTest && rawTest.dilutions, errors, testKind);
    normalizedTest.vehicle.en = toTrimmedString_(rawTest && rawTest.vehicle && rawTest.vehicle.en);
    normalizedTest.vehicle.fr = toTrimmedString_(rawTest && rawTest.vehicle && rawTest.vehicle.fr);
    normalizedTest.sourceId =
      toTrimmedString_(rawTest && rawTest.sourceId) || firstSourceId_(options.sourcesById);
    normalizedTest.alternateSourceId = toTrimmedString_(rawTest && rawTest.alternateSourceId);

    if (!normalizedTest.sourceId) {
      errors.push(`Preferred source is required for ${testKind}.`);
    } else if (!options.sourcesById[normalizedTest.sourceId]) {
      errors.push(`Preferred source "${normalizedTest.sourceId}" does not exist for ${testKind}.`);
    }

    if (normalizedTest.alternateSourceId) {
      if (!options.sourcesById[normalizedTest.alternateSourceId]) {
        errors.push(
          `Alternate source "${normalizedTest.alternateSourceId}" does not exist for ${testKind}.`
        );
      }

      if (normalizedTest.alternateSourceId === normalizedTest.sourceId) {
        errors.push(`Alternate source must differ from the preferred source for ${testKind}.`);
      }
    }

    if (Boolean(normalizedTest.vehicle.en) !== Boolean(normalizedTest.vehicle.fr)) {
      errors.push(`Vehicle must be bilingual for ${testKind} when provided.`);
    }

    normalizedTest.notes = normalizeNotes_(
      rawTest && rawTest.notes,
      errors,
      testKind
    );

    record.tests[testKind] = normalizedTest;
  });

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

function normalizeDilutionList_(value, errors, testKind) {
  const raw = toTrimmedString_(value);

  if (!raw) {
    return "";
  }

  const dilutions = raw
    .split(";")
    .map((item) => toTrimmedString_(item))
    .filter(Boolean);

  const normalized = dilutions.map((dilution) => {
    if (!ADMIN_APP.dilutionPattern.test(dilution)) {
      errors.push(`Dilution "${dilution}" is invalid for ${testKind}. Use the form 1:10.`);
      return "";
    }

    return normalizeDilutionValue_(dilution);
  });

  return normalized.filter(Boolean).join("; ");
}

function normalizeDilutionValue_(value) {
  const parts = value.split(":");
  const left = Number(parts[0]);
  const right = Number(parts[1]);
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

function upsertDrugRow_(table, targetId, object) {
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
  const existingByKind = {};
  const preservedRows = [];

  table.objects.forEach((row, index) => {
    if (row.drug_id === targetId && ADMIN_APP.testKinds.includes(row.test_kind)) {
      existingByKind[row.test_kind] = table.rows[index];
      return;
    }

    if (row.drug_id === targetId) {
      return;
    }

    preservedRows.push(table.rows[index]);
  });

  const nextRows = ADMIN_APP.testKinds.map((testKind) =>
    objectToRow_(
      table.headers,
      {
        drug_id: record.id,
        test_kind: testKind,
        concentration: record.tests[testKind].concentration,
        max_concentration: record.tests[testKind].maxConcentration,
        dilutions: record.tests[testKind].dilutions,
        vehicle_en: record.tests[testKind].vehicle.en,
        vehicle_fr: record.tests[testKind].vehicle.fr,
        source_id: record.tests[testKind].sourceId,
        alternate_source_id: record.tests[testKind].alternateSourceId,
      },
      existingByKind[testKind] || null
    )
  );

  table.rows = preservedRows.concat(nextRows);
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
