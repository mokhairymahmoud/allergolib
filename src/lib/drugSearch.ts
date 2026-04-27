import type { DrugRecord, Language } from "../types";

export type SearchField = "alias" | "class" | "id" | "name";

export type DrugSearchResult = {
  drug: DrugRecord;
  matchedField?: SearchField;
  matchedText?: string;
  score: number;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function scoreValue(value: string, query: string) {
  const normalizedValue = normalize(value);

  if (!normalizedValue) {
    return -1;
  }

  if (normalizedValue === query) {
    return 300;
  }

  if (normalizedValue.startsWith(query)) {
    return 220;
  }

  if (normalizedValue.includes(query)) {
    return 140;
  }

  return -1;
}

function bestMatch(drug: DrugRecord, query: string, language: Language) {
  const matches: Array<{ field: SearchField; text: string; score: number }> = [
    { field: "name", text: drug.name[language], score: scoreValue(drug.name[language], query) + 12 },
    { field: "name", text: drug.name.en, score: scoreValue(drug.name.en, query) + 10 },
    { field: "name", text: drug.name.fr, score: scoreValue(drug.name.fr, query) + 10 },
    { field: "id", text: drug.id, score: scoreValue(drug.id, query) + 8 },
    { field: "class", text: drug.className[language], score: scoreValue(drug.className[language], query) },
    { field: "class", text: drug.className.en, score: scoreValue(drug.className.en, query) },
    { field: "class", text: drug.className.fr, score: scoreValue(drug.className.fr, query) },
    ...drug.aliases.map((alias) => ({
      field: "alias" as const,
      text: alias,
      score: scoreValue(alias, query) + 16,
    })),
  ];

  return matches
    .filter((match) => match.score >= 0)
    .sort((left, right) => right.score - left.score)[0];
}

export function searchDrugs(drugs: DrugRecord[], query: string, language: Language) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return drugs.map((drug, index) => ({
      drug,
      score: drugs.length - index,
    }));
  }

  const results: DrugSearchResult[] = [];

  for (const drug of drugs) {
    const match = bestMatch(drug, normalizedQuery, language);

    if (!match) {
      continue;
    }

    results.push({
      drug,
      matchedField: match.field,
      matchedText: match.text,
      score: match.score,
    });
  }

  return results
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.drug.name[language].localeCompare(right.drug.name[language]);
    });
}
