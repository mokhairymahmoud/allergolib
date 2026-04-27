const LANGUAGES = ["en", "fr"];
const TEST_KINDS = ["prick", "idr", "patch"];
const NOTE_KINDS = new Set(["info", "warning", "cross-reactivity"]);
const REQUIRED_METADATA_KEYS = [
  "version",
  "releasedAt",
  "minSupportedAppVersion",
  "approvedBy",
];
const DILUTION_PATTERN = /^[1-9]\d*:[1-9]\d*$/;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function gcd(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);

  while (y !== 0) {
    const remainder = x % y;
    x = y;
    y = remainder;
  }

  return x || 1;
}

function normalizeDilution(value) {
  const [leftRaw, rightRaw] = value.split(":");
  const left = Number.parseInt(leftRaw, 10);
  const right = Number.parseInt(rightRaw, 10);

  assert(Number.isInteger(left) && left > 0, `Invalid dilution numerator "${leftRaw}" in ${value}.`);
  assert(Number.isInteger(right) && right > 0, `Invalid dilution denominator "${rightRaw}" in ${value}.`);

  const divisor = gcd(left, right);
  return `${left / divisor}:${right / divisor}`;
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

function requireTrimmedField(row, key, context) {
  assert(row[key]?.trim(), `${context} is missing ${key}.`);
}

function hasDisplayableTestContent(test) {
  return Boolean(
    test.concentration ||
      test.maxConcentration ||
      test.dilutions.length ||
      test.vehicle ||
      test.notes.length
  );
}

function assertSourceDocumentComplete(source, context) {
  assert(source, `${context} must reference an existing source.`);

  for (const key of ["label", "organization", "year", "version", "status"]) {
    assert(source[key]?.trim(), `${context} is missing ${key}.`);
  }

  assert(source.documentName.en.trim(), `${context} is missing document_name_en.`);
  assert(source.documentName.fr.trim(), `${context} is missing document_name_fr.`);
  assert(source.excerpt.en.trim(), `${context} is missing excerpt_en.`);
  assert(source.excerpt.fr.trim(), `${context} is missing excerpt_fr.`);
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
    requireTrimmedField(row, "label", `Source ${row.id}`);
    requireTrimmedField(row, "organization", `Source ${row.id}`);
    requireTrimmedField(row, "year", `Source ${row.id}`);
    requireTrimmedField(row, "version", `Source ${row.id}`);
    requireTrimmedField(row, "status", `Source ${row.id}`);
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
    preferredSourceId: sourceId,
    alternateSourceId: undefined,
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
    if (row.alternate_source_id) {
      assert(
        sources[row.alternate_source_id],
        `test_entries references unknown alternate source ${row.alternate_source_id}.`
      );
      assert(
        row.alternate_source_id !== row.source_id,
        `test_entries alternate source must differ from preferred source for ${row.drug_id}/${row.test_kind}.`
      );
    }

    const dilutions = row.dilutions
      ? row.dilutions.split(";").map((value) => value.trim()).filter(Boolean)
      : [];

    const normalizedDilutions = [];

    for (const dilution of dilutions) {
      assert(
        DILUTION_PATTERN.test(dilution),
        `Invalid dilution "${dilution}" for ${row.drug_id}/${row.test_kind}.`
      );
      normalizedDilutions.push(normalizeDilution(dilution));
    }

    if (row.vehicle_en || row.vehicle_fr) {
      assert(row.vehicle_en && row.vehicle_fr, `${row.drug_id}/${row.test_kind} must include vehicle in both languages.`);
    }

    drugsById[row.drug_id].tests[row.test_kind] = {
      concentration: row.concentration,
      maxConcentration: row.max_concentration,
      dilutions: normalizedDilutions,
      vehicle: row.vehicle_en || row.vehicle_fr ? { en: row.vehicle_en, fr: row.vehicle_fr } : undefined,
      notes: [],
      preferredSourceId: row.source_id,
      alternateSourceId: row.alternate_source_id || undefined,
    };
  }

  for (const row of noteRows) {
    assert(drugsById[row.drug_id], `notes references unknown drug ${row.drug_id}.`);
    assert(TEST_KINDS.includes(row.test_kind), `Invalid test kind ${row.test_kind} in notes.`);
    requireLocalizedColumns(row, `Note ${row.drug_id}/${row.test_kind}`, "note");
    const noteKind = row.note_kind || "info";
    assert(
      NOTE_KINDS.has(noteKind),
      `Invalid note_kind "${noteKind}" for ${row.drug_id}/${row.test_kind}.`
    );

    drugsById[row.drug_id].tests[row.test_kind].notes.push({
      kind: noteKind,
      value: {
        en: row.note_en,
        fr: row.note_fr,
      },
    });
  }

  for (const drug of Object.values(drugsById)) {
    assert(drug.aliases.length > 0, `Drug ${drug.id} must have at least one alias.`);

    for (const kind of TEST_KINDS) {
      const test = drug.tests[kind];

      if (!hasDisplayableTestContent(test)) {
        continue;
      }

      assert(test.preferredSourceId, `Drug ${drug.id} is missing a source for ${kind}.`);

      assertSourceDocumentComplete(
        sources[test.preferredSourceId],
        `Drug ${drug.id}/${kind} preferred source`
      );

      if (test.alternateSourceId) {
        assertSourceDocumentComplete(
          sources[test.alternateSourceId],
          `Drug ${drug.id}/${kind} alternate source`
        );
      }
    }
  }

  return Object.values(drugsById);
}

function buildDatasetFromTabRows(tabRowsByName) {
  const requiredTabs = ["release_metadata", "sources", "drugs", "aliases", "test_entries", "notes"];

  for (const tabName of requiredTabs) {
    const rows = tabRowsByName[tabName];
    assert(Array.isArray(rows) && rows.length >= 2, `${tabName} must include a header row and at least one data row.`);
  }

  const releaseRows = rowsToObjects("release_metadata", tabRowsByName.release_metadata);
  const sourceRows = rowsToObjects("sources", tabRowsByName.sources);
  const drugRows = rowsToObjects("drugs", tabRowsByName.drugs);
  const aliasRows = rowsToObjects("aliases", tabRowsByName.aliases);
  const testRows = rowsToObjects("test_entries", tabRowsByName.test_entries);
  const noteRows = rowsToObjects("notes", tabRowsByName.notes);

  const release = buildRelease(releaseRows);
  const sources = buildSources(sourceRows);
  const drugs = buildDrugs(drugRows, aliasRows, testRows, noteRows, sources);

  return {
    release,
    sources,
    drugs,
  };
}

export {
  buildDatasetFromTabRows,
  buildDrugs,
  buildRelease,
  buildSources,
  rowsToObjects,
};
