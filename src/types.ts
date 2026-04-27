export type Language = "en" | "fr";

export type LocalizedString = Record<Language, string>;

export type TestKind = "prick" | "idr" | "patch";
export type NoteKind = "info" | "warning" | "cross-reactivity";

export type DatasetRelease = {
  version: string;
  releasedAt: string;
  minSupportedAppVersion: string;
  approvedBy: string;
};

export type DatasetManifest = DatasetRelease & {
  checksum: string;
  datasetFile: string;
  drugCount: number;
  sourceIds: string[];
};

export type SourceDocument = {
  id: string;
  label: string;
  organization: string;
  year: string;
  version: string;
  status: string;
  url?: string;
  documentName: LocalizedString;
  excerpt: LocalizedString;
};

export type TestNote = {
  kind: NoteKind;
  value: LocalizedString;
};

export type TestSourceEntry = {
  sourceId: string;
  concentration?: string;
  maxConcentration?: string;
  isPreferred: boolean;
};

export type TestRecord = {
  sourceEntries: TestSourceEntry[];
  dilutions: string[];
  vehicle?: LocalizedString;
  notes: TestNote[];
};

export type DrugRecord = {
  id: string;
  name: LocalizedString;
  className: LocalizedString;
  subclassName?: LocalizedString;
  aliases: string[];
  tests: Record<TestKind, TestRecord>;
};

export type Dataset = {
  release: DatasetRelease;
  sources: Record<string, SourceDocument>;
  drugs: DrugRecord[];
};
