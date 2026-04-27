export type Language = "en" | "fr";

export type LocalizedString = Record<Language, string>;

export type TestKind = "prick" | "idr" | "patch";

export type SourceDocument = {
  id: string;
  label: string;
  documentName: LocalizedString;
  excerpt: LocalizedString;
};

export type TestRecord = {
  concentration?: string;
  maxConcentration?: string;
  dilutions: string[];
  vehicle?: LocalizedString;
  notes: LocalizedString[];
  sourceId: string;
};

export type DrugRecord = {
  id: string;
  name: LocalizedString;
  className: LocalizedString;
  aliases: string[];
  tests: Record<TestKind, TestRecord>;
};

export type Dataset = {
  sources: Record<string, SourceDocument>;
  drugs: DrugRecord[];
};

