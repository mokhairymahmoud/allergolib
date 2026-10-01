import type { SourceDocument, TestKind, TestRecord, TestSourceEntry } from "../types";

export const TEST_KINDS: TestKind[] = ["prick", "idr", "patch"];

export function hasDisplayableTestContent(test: TestRecord) {
  return (
    test.sourceEntries.some((e) => e.concentration || e.maxConcentration) ||
    test.dilutions.length > 0 ||
    Boolean(test.vehicle) ||
    test.notes.length > 0
  );
}

export function preferredSourceEntry(test: TestRecord): TestSourceEntry | undefined {
  return test.sourceEntries.find((e) => e.isPreferred);
}

export function sourcesDisagree(test: TestRecord) {
  const preferred = preferredSourceEntry(test);
  return test.sourceEntries.some(
    (e) => !e.isPreferred && e.concentration && e.concentration !== preferred?.concentration
  );
}

function hasSourceDocumentContent(source: SourceDocument | undefined) {
  return Boolean(
    source?.label &&
      source.organization &&
      source.year &&
      source.version &&
      source.documentName.en &&
      source.documentName.fr &&
      source.excerpt.en &&
      source.excerpt.fr
  );
}

export function hasTestProvenance(test: TestRecord, sources: Record<string, SourceDocument>) {
  if (!hasDisplayableTestContent(test)) {
    return true;
  }
  const preferred = preferredSourceEntry(test);
  return hasSourceDocumentContent(preferred ? sources[preferred.sourceId] : undefined);
}
