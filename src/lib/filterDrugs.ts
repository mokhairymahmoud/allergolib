import type { DrugRecord, Language } from "../types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filterDrugs(drugs: DrugRecord[], query: string, language: Language) {
  const normalizedQuery = normalize(query.trim());

  if (!normalizedQuery) {
    return drugs;
  }

  return drugs.filter((drug) => {
    const haystack = [
      drug.id,
      drug.name.en,
      drug.name.fr,
      drug.className.en,
      drug.className.fr,
      ...drug.aliases,
    ].map(normalize);

    if (haystack.some((value) => value.includes(normalizedQuery))) {
      return true;
    }

    return normalize(drug.name[language]).includes(normalizedQuery);
  });
}

