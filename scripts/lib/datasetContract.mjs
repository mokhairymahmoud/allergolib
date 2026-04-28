const LANGUAGES = ["en", "fr"];
const TEST_KINDS = ["prick", "idr", "patch"];
const NOTE_KINDS = new Set(["info", "warning", "cross-reactivity"]);
const CROSS_REACTIVITY_TIERS = new Set(["higher-concern", "lower-expected", "uncertain"]);
const STRUCTURAL_RELATIONS = new Set(["structurally-related", "structurally-distinct"]);
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
  return (
    test.sourceEntries.some((e) => e.concentration || e.maxConcentration) ||
    test.dilutions.length > 0 ||
    Boolean(test.vehicle) ||
    test.notes.length > 0
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
      ...(row.url?.trim() ? { url: row.url.trim() } : {}),
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

function emptyTestRecord() {
  return {
    sourceEntries: [],
    dilutions: [],
    vehicle: undefined,
    notes: [],
  };
}

// Detect whether test_entries rows use the new multi-source layout (has is_preferred column)
// or the legacy layout (has source_id + alternate_source_id columns).
function isNewTestEntriesLayout(testRows) {
  if (!testRows.length) return false;
  return "is_preferred" in testRows[0];
}

function buildDrugs(drugRows, aliasRows, testRows, noteRows, sources) {
  const drugsById = {};

  for (const row of drugRows) {
    assert(row.id, "drugs contains a drug without id.");
    requireLocalizedColumns(row, `Drug ${row.id}`, "name");
    requireLocalizedColumns(row, `Drug ${row.id}`, "class_name");
    assert(!drugsById[row.id], `Duplicate drug id: ${row.id}`);

    const subclassName =
      row.subclass_name_en?.trim() || row.subclass_name_fr?.trim()
        ? { en: row.subclass_name_en ?? "", fr: row.subclass_name_fr ?? "" }
        : undefined;

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
      ...(subclassName ? { subclassName } : {}),
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

  if (isNewTestEntriesLayout(testRows)) {
    buildTestEntriesNew(testRows, drugsById, sources);
  } else {
    buildTestEntriesLegacy(testRows, drugsById, sources);
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

      for (const entry of test.sourceEntries) {
        assertSourceDocumentComplete(
          sources[entry.sourceId],
          `Drug ${drug.id}/${kind} source ${entry.sourceId}`
        );
      }
    }
  }

  return Object.values(drugsById);
}

function buildTestEntriesNew(testRows, drugsById, sources) {
  // Group rows by (drug_id, test_kind) preserving order.
  const grouped = {};

  for (const row of testRows) {
    assert(drugsById[row.drug_id], `test_entries references unknown drug ${row.drug_id}.`);
    assert(TEST_KINDS.includes(row.test_kind), `Invalid test kind ${row.test_kind} for ${row.drug_id}.`);
    assert(row.source_id?.trim(), `test_entries row for ${row.drug_id}/${row.test_kind} is missing source_id.`);
    assert(sources[row.source_id], `test_entries references unknown source ${row.source_id} for ${row.drug_id}/${row.test_kind}.`);

    const key = `${row.drug_id}::${row.test_kind}`;

    if (!grouped[key]) {
      grouped[key] = { drug_id: row.drug_id, test_kind: row.test_kind, rows: [] };
    }

    grouped[key].rows.push(row);
  }

  for (const { drug_id, test_kind, rows } of Object.values(grouped)) {
    const preferredRows = rows.filter((r) => r.is_preferred === "true");
    assert(
      preferredRows.length === 1,
      `test_entries for ${drug_id}/${test_kind} must have exactly one row with is_preferred=true (found ${preferredRows.length}).`
    );

    const sourceIds = rows.map((r) => r.source_id);
    const uniqueIds = new Set(sourceIds);
    assert(uniqueIds.size === sourceIds.length, `test_entries for ${drug_id}/${test_kind} has duplicate source_id values.`);

    const preferredRow = preferredRows[0];

    const dilutions = preferredRow.dilutions
      ? preferredRow.dilutions.split(";").map((v) => v.trim()).filter(Boolean)
      : [];

    const normalizedDilutions = [];
    for (const dilution of dilutions) {
      assert(DILUTION_PATTERN.test(dilution), `Invalid dilution "${dilution}" for ${drug_id}/${test_kind}.`);
      normalizedDilutions.push(normalizeDilution(dilution));
    }

    const vehicle =
      preferredRow.vehicle_en || preferredRow.vehicle_fr
        ? (() => {
            assert(
              preferredRow.vehicle_en && preferredRow.vehicle_fr,
              `${drug_id}/${test_kind} must include vehicle in both languages.`
            );
            return { en: preferredRow.vehicle_en, fr: preferredRow.vehicle_fr };
          })()
        : undefined;

    const sourceEntries = rows.map((row) => ({
      sourceId: row.source_id,
      ...(row.concentration?.trim() ? { concentration: row.concentration.trim() } : {}),
      ...(row.max_concentration?.trim() ? { maxConcentration: row.max_concentration.trim() } : {}),
      isPreferred: row.is_preferred === "true",
    }));

    drugsById[drug_id].tests[test_kind] = {
      sourceEntries,
      dilutions: normalizedDilutions,
      vehicle,
      notes: [],
    };
  }
}

function buildTestEntriesLegacy(testRows, drugsById, sources) {
  // Legacy layout: one row per test with source_id + optional alternate_source_id.
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
      assert(DILUTION_PATTERN.test(dilution), `Invalid dilution "${dilution}" for ${row.drug_id}/${row.test_kind}.`);
      normalizedDilutions.push(normalizeDilution(dilution));
    }

    if (row.vehicle_en || row.vehicle_fr) {
      assert(row.vehicle_en && row.vehicle_fr, `${row.drug_id}/${row.test_kind} must include vehicle in both languages.`);
    }

    const sourceEntries = [
      {
        sourceId: row.source_id,
        ...(row.concentration?.trim() ? { concentration: row.concentration.trim() } : {}),
        ...(row.max_concentration?.trim() ? { maxConcentration: row.max_concentration.trim() } : {}),
        isPreferred: true,
      },
    ];

    if (row.alternate_source_id?.trim()) {
      sourceEntries.push({
        sourceId: row.alternate_source_id.trim(),
        isPreferred: false,
      });
    }

    drugsById[row.drug_id].tests[row.test_kind] = {
      sourceEntries,
      dilutions: normalizedDilutions,
      vehicle: row.vehicle_en || row.vehicle_fr ? { en: row.vehicle_en, fr: row.vehicle_fr } : undefined,
      notes: [],
    };
  }
}

function buildCrossReactivity(crossReactivityRows, drugsById, sources) {
  const grouped = {};

  for (const row of crossReactivityRows) {
    assert(drugsById[row.drug_id], `cross_reactivity references unknown drug ${row.drug_id}.`);
    requireLocalizedColumns(row, `CrossReactivity ${row.drug_id}`, "group_name");
    requireTrimmedField(row, "related_drug_id", `CrossReactivity ${row.drug_id}`);
    assert(
      drugsById[row.related_drug_id],
      `cross_reactivity references unknown related drug ${row.related_drug_id} for ${row.drug_id}.`
    );
    assert(
      CROSS_REACTIVITY_TIERS.has(row.tier),
      `Invalid tier "${row.tier}" in cross_reactivity for ${row.drug_id}/${row.related_drug_id}.`
    );
    assert(
      STRUCTURAL_RELATIONS.has(row.structural_relation),
      `Invalid structural_relation "${row.structural_relation}" in cross_reactivity for ${row.drug_id}/${row.related_drug_id}.`
    );
    requireLocalizedColumns(row, `CrossReactivity ${row.drug_id}/${row.related_drug_id}`, "rationale");

    const key = `${row.drug_id}::${row.group_name_en}`;
    if (!grouped[key]) {
      grouped[key] = { drug_id: row.drug_id, rows: [] };
    }
    grouped[key].rows.push(row);
  }

  const parseSemicolonList = (value) =>
    value ? value.split(";").map((s) => s.trim()).filter(Boolean) : [];

  const crossReactivityByDrugId = {};

  for (const { drug_id, rows } of Object.values(grouped)) {
    const firstRow = rows[0];

    for (const row of rows) {
      for (const sid of parseSemicolonList(row.source_ids)) {
        assert(
          sources[sid],
          `cross_reactivity references unknown source ${sid} for ${row.drug_id}/${row.related_drug_id}.`
        );
      }
    }

    const entries = rows.map((row) => ({
      drugId: row.related_drug_id.trim(),
      tier: row.tier,
      structuralRelation: row.structural_relation,
      rationale: { en: row.rationale_en, fr: row.rationale_fr },
      sourceIds: parseSemicolonList(row.source_ids),
    }));

    const panelRow = rows.find((r) => r.panel_drug_ids?.trim());
    const panelDrugIds = panelRow ? parseSemicolonList(panelRow.panel_drug_ids) : [];

    for (const pid of panelDrugIds) {
      assert(
        drugsById[pid],
        `cross_reactivity panel references unknown drug ${pid} for ${drug_id}.`
      );
    }

    const panelRationale =
      panelRow && (panelRow.panel_rationale_en?.trim() || panelRow.panel_rationale_fr?.trim())
        ? (() => {
            requireLocalizedColumns(panelRow, `CrossReactivity panel ${drug_id}`, "panel_rationale");
            return { en: panelRow.panel_rationale_en, fr: panelRow.panel_rationale_fr };
          })()
        : undefined;

    const group = {
      groupName: { en: firstRow.group_name_en, fr: firstRow.group_name_fr },
      entries,
      suggestedPanel: panelDrugIds,
      ...(panelRationale ? { panelRationale } : {}),
    };

    if (!crossReactivityByDrugId[drug_id]) {
      crossReactivityByDrugId[drug_id] = [];
    }
    crossReactivityByDrugId[drug_id].push(group);
  }

  return crossReactivityByDrugId;
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

  const crossReactivityRawRows = tabRowsByName.cross_reactivity;
  if (Array.isArray(crossReactivityRawRows) && crossReactivityRawRows.length >= 2) {
    const crossReactivityRows = rowsToObjects("cross_reactivity", crossReactivityRawRows);
    const drugsById = Object.fromEntries(drugs.map((d) => [d.id, d]));
    const crossReactivityByDrugId = buildCrossReactivity(crossReactivityRows, drugsById, sources);

    for (const drug of drugs) {
      if (crossReactivityByDrugId[drug.id]) {
        drug.crossReactivity = crossReactivityByDrugId[drug.id];
      }
    }
  }

  return {
    release,
    sources,
    drugs,
  };
}

export {
  buildCrossReactivity,
  buildDatasetFromTabRows,
  buildDrugs,
  buildRelease,
  buildSources,
  rowsToObjects,
};
