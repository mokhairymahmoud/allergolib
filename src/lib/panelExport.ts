import { formatReleaseDate } from "./formatters";
import { copy } from "./i18n";
import type { PanelItem } from "./panels";
import { hasTestProvenance, preferredSourceEntry, sourcesDisagree } from "./testData";
import type {
  CrossReactivityTier,
  DatasetManifest,
  DrugRecord,
  Language,
  SourceDocument,
  TestKind,
} from "../types";

export type PanelTestValues = {
  prick?: string;
  idrMax?: string;
  idrDilutions: string[];
  patch?: string;
  sourcesDiffer: boolean;
  provenanceMissing: boolean;
  sourceIds: string[];
};

/** Preferred-source values for each test kind, hiding any value without valid provenance. */
export function panelTestValues(
  drug: DrugRecord,
  sources: Record<string, SourceDocument>,
  language: Language
): PanelTestValues {
  const kinds: TestKind[] = ["prick", "idr", "patch"];
  const values: PanelTestValues = {
    idrDilutions: [],
    sourcesDiffer: false,
    provenanceMissing: false,
    sourceIds: [],
  };

  for (const kind of kinds) {
    const test = drug.tests[kind];
    if (!hasTestProvenance(test, sources)) {
      values.provenanceMissing = true;
      continue;
    }

    const preferred = preferredSourceEntry(test);
    if (preferred && (preferred.concentration || preferred.maxConcentration)) {
      values.sourceIds.push(preferred.sourceId);
    }
    if (sourcesDisagree(test)) values.sourcesDiffer = true;

    if (kind === "prick") {
      values.prick = preferred?.concentration ?? preferred?.maxConcentration;
    } else if (kind === "idr") {
      values.idrMax = preferred?.maxConcentration ?? preferred?.concentration;
      values.idrDilutions = test.dilutions;
    } else {
      const concentration = preferred?.concentration ?? preferred?.maxConcentration;
      const vehicle = test.vehicle?.[language];
      values.patch = [concentration, vehicle].filter(Boolean).join(" · ") || undefined;
    }
  }

  values.sourceIds = Array.from(new Set(values.sourceIds));
  return values;
}

export function panelHasPatchData(items: PanelItem[], sources: Record<string, SourceDocument>, language: Language) {
  return items.some((item) => Boolean(panelTestValues(item.drug, sources, language).patch));
}

export function panelCategoryLabel(item: PanelItem, language: Language) {
  if (item.role === "culprit") return copy(language, "panel.culprit");
  if (item.role === "added") return copy(language, "panel.roleAdded");
  return item.tier ? tierLabel(item.tier, language) : copy(language, "panel.unclassified");
}

function tierLabel(tier: CrossReactivityTier, language: Language) {
  switch (tier) {
    case "higher-concern": return copy(language, "crossReactivity.tierHigher");
    case "lower-expected": return copy(language, "crossReactivity.tierLower");
    case "uncertain": return copy(language, "crossReactivity.tierUncertain");
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ExportContext = {
  items: PanelItem[];
  language: Language;
  sources: Record<string, SourceDocument>;
  manifest: DatasetManifest;
};

function citedSources({ items, sources, language }: ExportContext) {
  const ids = new Set<string>();
  for (const item of items) {
    for (const id of panelTestValues(item.drug, sources, language).sourceIds) ids.add(id);
  }
  return [...ids].map((id) => sources[id]).filter((source): source is SourceDocument => Boolean(source));
}

function datasetLine({ manifest, language }: ExportContext) {
  return `${copy(language, "panel.sheetDataset")} ${manifest.version} (${formatReleaseDate(manifest.releasedAt, language)})`;
}

/** A printable bench sheet: test concentrations plus blank columns for recording results. */
export function panelToHtml(context: ExportContext) {
  const { items, language, sources } = context;
  const t = (key: Parameters<typeof copy>[1]) => escapeHtml(copy(language, key));
  const showPatch = panelHasPatchData(items, sources, language);
  const culprit = items.find((item) => item.role === "culprit");
  const columnCount = showPatch ? 9 : 8;

  const rows = items.map((item) => {
    const values = panelTestValues(item.drug, sources, language);
    const missing = values.provenanceMissing ? ` <span class="muted">(${t("panel.provenanceMissing")})</span>` : "";
    const marker = `${item.role === "added" ? "†" : ""}${values.sourcesDiffer ? "*" : ""}`;
    const cell = (value?: string) => escapeHtml(value ?? "—");
    return `<tr class="${item.role === "culprit" ? "culprit" : ""}">
      <td><strong>${escapeHtml(item.drug.name[language])}</strong>${marker}${missing}</td>
      <td>${escapeHtml(panelCategoryLabel(item, language))}</td>
      <td>${cell(values.prick)}</td>
      <td>${cell(values.idrMax)}</td>
      <td>${values.idrDilutions.length ? escapeHtml(values.idrDilutions.join(" → ")) : "—"}</td>
      ${showPatch ? `<td>${cell(values.patch)}</td>` : ""}
      <td class="blank"></td><td class="blank"></td><td class="blank"></td>
    </tr>`;
  });

  const controlRow = (label: string) =>
    `<tr class="control"><td colspan="${columnCount - 3}">${label}</td><td class="blank"></td><td class="blank"></td><td class="blank"></td></tr>`;

  const sourceItems = citedSources(context)
    .map((source) => `<li>${escapeHtml(source.label)}: ${escapeHtml(source.documentName[language])} (${escapeHtml(source.organization)}, ${escapeHtml(source.year)})</li>`)
    .join("");

  return `<!doctype html>
<html lang="${language}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${t("panel.title")}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif; color: #0f172a; font-size: 11px; margin: 0; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .subtitle { color: #475569; margin: 0 0 12px; }
  .fields { display: flex; gap: 24px; margin-bottom: 12px; }
  .fields span { flex: 1; border-bottom: 1px solid #94a3b8; padding-bottom: 14px; color: #475569; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  tr.culprit td { background: #eff6ff; }
  tr.control td { color: #475569; font-style: italic; }
  td.blank { min-width: 70px; }
  .muted { color: #64748b; font-size: 10px; }
  .legend, .footer { color: #475569; margin-top: 10px; }
  .footer ul { margin: 4px 0; padding-left: 16px; }
  .disclaimer { margin-top: 10px; padding: 8px; border: 1px solid #bfdbfe; background: #eff6ff; }
</style>
</head>
<body>
  <h1>${t("panel.title")}</h1>
  <p class="subtitle">${t("panel.culprit")}: <strong>${escapeHtml(culprit?.drug.name[language] ?? "")}</strong> · ${items.length} ${t("panel.drugs")}</p>
  <div class="fields">
    <span>${t("panel.sheetPatient")}</span>
    <span>${t("panel.sheetDate")}</span>
    <span>${t("panel.sheetOperator")}</span>
  </div>
  <table>
    <thead><tr>
      <th>${t("panel.sheetDrug")}</th>
      <th>${t("panel.sheetCategory")}</th>
      <th>${t("panel.prick")}</th>
      <th>${t("panel.idrMax")}</th>
      <th>${t("panel.dilutions")}</th>
      ${showPatch ? `<th>${t("panel.patch")}</th>` : ""}
      <th>${t("panel.sheetPrickResult")}</th>
      <th>${t("panel.sheetIdrResult")}</th>
      <th>${t("panel.sheetInterpretation")}</th>
    </tr></thead>
    <tbody>
      ${controlRow(t("panel.sheetPositiveControl"))}
      ${controlRow(t("panel.sheetNegativeControl"))}
      ${rows.join("")}
    </tbody>
  </table>
  <div class="legend">
    ${items.some((item) => item.role === "added") ? `<div>${t("panel.sheetAddedLegend")}</div>` : ""}
    ${items.some((item) => panelTestValues(item.drug, sources, language).sourcesDiffer) ? `<div>${t("panel.sheetDifferLegend")}</div>` : ""}
  </div>
  <div class="footer">
    <strong>${t("panel.sheetSources")}</strong>
    <ul>${sourceItems}</ul>
    <div>${escapeHtml(datasetLine(context))}</div>
  </div>
  <div class="disclaimer"><strong>${t("compliance.title")}.</strong> ${t("compliance.body")}</div>
</body>
</html>`;
}

/** A plain-text summary suitable for pasting into a patient record or referral letter. */
export function panelToText(context: ExportContext) {
  const { items, language, sources } = context;
  const culprit = items.find((item) => item.role === "culprit");
  const lines = [
    `${copy(language, "panel.title")} | ${copy(language, "panel.culprit")}: ${culprit?.drug.name[language] ?? ""}`,
    "",
  ];

  for (const item of items) {
    const values = panelTestValues(item.drug, sources, language);
    const parts = [
      values.prick ? `${copy(language, "panel.prick")} ${values.prick}` : null,
      values.idrMax ? `${copy(language, "panel.idrMax")} ${values.idrMax}` : null,
      values.idrDilutions.length ? `(${values.idrDilutions.join(" → ")})` : null,
      values.patch ? `${copy(language, "panel.patch")} ${values.patch}` : null,
    ].filter(Boolean);
    const marker = `${item.role === "added" ? "†" : ""}${values.sourcesDiffer ? "*" : ""}`;
    lines.push(
      `- ${item.drug.name[language]}${marker} [${panelCategoryLabel(item, language)}]: ${parts.join(", ") || copy(language, "panel.noValue")}`
    );
  }

  lines.push("");
  if (items.some((item) => item.role === "added")) lines.push(copy(language, "panel.sheetAddedLegend"));
  if (items.some((item) => panelTestValues(item.drug, sources, language).sourcesDiffer)) {
    lines.push(copy(language, "panel.sheetDifferLegend"));
  }
  lines.push(
    `${copy(language, "panel.sheetSources")}: ${citedSources(context).map((source) => source.label).join(", ")}`,
    datasetLine(context),
    `${copy(language, "compliance.title")}. ${copy(language, "compliance.body")}`
  );

  return lines.join("\n");
}
