import type { DrugRecord, Language } from "../types";

export type SearchField = "alias" | "class" | "id" | "name";
export type MatchTier = "exact" | "prefix" | "substring" | "fuzzy";

export type DrugSearchResult = {
  drug: DrugRecord;
  matchedField?: SearchField;
  matchedText?: string;
  matchedTier?: MatchTier;
  score: number;
};

type SearchCandidate = {
  field: SearchField;
  text: string;
  fieldScore: number;
};

type EvaluatedMatch = {
  field: SearchField;
  text: string;
  tier: MatchTier;
  score: number;
};

const TIER_SCORE: Record<MatchTier, number> = {
  exact: 4000,
  prefix: 3000,
  substring: 2000,
  fuzzy: 1000,
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string) {
  return value.replace(/\s+/g, "");
}

function tokens(value: string) {
  return value.split(" ").filter(Boolean);
}

function fuzzyThreshold(query: string) {
  if (query.length <= 4) {
    return 1;
  }

  if (query.length <= 8) {
    return 2;
  }

  return 3;
}

function boundedDamerauLevenshtein(left: string, right: string, maxDistance: number) {
  const leftLength = left.length;
  const rightLength = right.length;

  if (!leftLength) {
    return rightLength <= maxDistance ? rightLength : Number.POSITIVE_INFINITY;
  }

  if (!rightLength) {
    return leftLength <= maxDistance ? leftLength : Number.POSITIVE_INFINITY;
  }

  if (Math.abs(leftLength - rightLength) > maxDistance) {
    return Number.POSITIVE_INFINITY;
  }

  const matrix = Array.from({ length: leftLength + 1 }, () =>
    new Array<number>(rightLength + 1).fill(0)
  );

  for (let row = 0; row <= leftLength; row += 1) {
    matrix[row][0] = row;
  }

  for (let column = 0; column <= rightLength; column += 1) {
    matrix[0][column] = column;
  }

  for (let row = 1; row <= leftLength; row += 1) {
    let rowMinimum = Number.POSITIVE_INFINITY;

    for (let column = 1; column <= rightLength; column += 1) {
      const substitutionCost = left[row - 1] === right[column - 1] ? 0 : 1;

      let value = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + substitutionCost
      );

      if (
        row > 1 &&
        column > 1 &&
        left[row - 1] === right[column - 2] &&
        left[row - 2] === right[column - 1]
      ) {
        value = Math.min(value, matrix[row - 2][column - 2] + 1);
      }

      matrix[row][column] = value;
      rowMinimum = Math.min(rowMinimum, value);
    }

    if (rowMinimum > maxDistance) {
      return Number.POSITIVE_INFINITY;
    }
  }

  const distance = matrix[leftLength][rightLength];
  return distance <= maxDistance ? distance : Number.POSITIVE_INFINITY;
}

function bestFuzzyDistance(normalizedValue: string, normalizedQuery: string) {
  if (normalizedQuery.length < 3) {
    return Number.POSITIVE_INFINITY;
  }

  const normalizedCompactValue = compact(normalizedValue);
  const normalizedCompactQuery = compact(normalizedQuery);
  const maxDistance = fuzzyThreshold(normalizedCompactQuery);
  const candidates = [normalizedCompactValue, ...tokens(normalizedValue)];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const distance = boundedDamerauLevenshtein(candidate, normalizedCompactQuery, maxDistance);

    if (distance < bestDistance) {
      bestDistance = distance;
    }
  }

  return bestDistance;
}

function scoreExactMatch(
  normalizedValue: string,
  normalizedQuery: string,
  fieldScore: number
) {
  if (compact(normalizedValue) !== compact(normalizedQuery)) {
    return null;
  }

  return TIER_SCORE.exact + fieldScore - Math.max(0, normalizedValue.length - normalizedQuery.length);
}

function scorePrefixMatch(
  normalizedValue: string,
  normalizedQuery: string,
  fieldScore: number
) {
  const normalizedCompactValue = compact(normalizedValue);
  const normalizedCompactQuery = compact(normalizedQuery);
  const normalizedTokens = tokens(normalizedValue);
  let distancePenalty = Number.POSITIVE_INFINITY;

  if (normalizedValue.startsWith(normalizedQuery)) {
    distancePenalty = 0;
  } else if (normalizedCompactValue.startsWith(normalizedCompactQuery)) {
    distancePenalty = 3;
  } else {
    const tokenMatch = normalizedTokens.findIndex((token) => token.startsWith(normalizedQuery));

    if (tokenMatch >= 0) {
      distancePenalty = 6 + tokenMatch;
    }
  }

  if (!Number.isFinite(distancePenalty)) {
    return null;
  }

  return (
    TIER_SCORE.prefix +
    fieldScore -
    distancePenalty -
    Math.max(0, normalizedCompactValue.length - normalizedCompactQuery.length)
  );
}

function scoreSubstringMatch(
  normalizedValue: string,
  normalizedQuery: string,
  fieldScore: number
) {
  const normalizedCompactValue = compact(normalizedValue);
  const normalizedCompactQuery = compact(normalizedQuery);
  let positionPenalty = Number.POSITIVE_INFINITY;

  const substringIndex = normalizedValue.indexOf(normalizedQuery);

  if (substringIndex >= 0) {
    positionPenalty = substringIndex;
  } else {
    const compactIndex = normalizedCompactValue.indexOf(normalizedCompactQuery);

    if (compactIndex >= 0) {
      positionPenalty = compactIndex + 4;
    }
  }

  if (!Number.isFinite(positionPenalty)) {
    return null;
  }

  return TIER_SCORE.substring + fieldScore - positionPenalty;
}

function scoreFuzzyMatch(
  normalizedValue: string,
  normalizedQuery: string,
  fieldScore: number
) {
  const distance = bestFuzzyDistance(normalizedValue, normalizedQuery);

  if (!Number.isFinite(distance)) {
    return null;
  }

  return TIER_SCORE.fuzzy + fieldScore - distance * 80;
}

function evaluateCandidate(candidate: SearchCandidate, normalizedQuery: string) {
  const normalizedValue = normalize(candidate.text);

  if (!normalizedValue) {
    return null;
  }

  const exactScore = scoreExactMatch(normalizedValue, normalizedQuery, candidate.fieldScore);

  if (exactScore !== null) {
    return {
      field: candidate.field,
      text: candidate.text,
      tier: "exact" as const,
      score: exactScore,
    };
  }

  const prefixScore = scorePrefixMatch(normalizedValue, normalizedQuery, candidate.fieldScore);

  if (prefixScore !== null) {
    return {
      field: candidate.field,
      text: candidate.text,
      tier: "prefix" as const,
      score: prefixScore,
    };
  }

  const substringScore = scoreSubstringMatch(normalizedValue, normalizedQuery, candidate.fieldScore);

  if (substringScore !== null) {
    return {
      field: candidate.field,
      text: candidate.text,
      tier: "substring" as const,
      score: substringScore,
    };
  }

  const fuzzyScore = scoreFuzzyMatch(normalizedValue, normalizedQuery, candidate.fieldScore);

  if (fuzzyScore !== null) {
    return {
      field: candidate.field,
      text: candidate.text,
      tier: "fuzzy" as const,
      score: fuzzyScore,
    };
  }

  return null;
}

function searchCandidates(drug: DrugRecord, language: Language): SearchCandidate[] {
  const localeNames =
    language === "fr"
      ? [drug.name.fr, drug.name.en]
      : [drug.name.en, drug.name.fr];
  const localeClasses =
    language === "fr"
      ? [drug.className.fr, drug.className.en]
      : [drug.className.en, drug.className.fr];
  const localeSubclasses = drug.subclassName
    ? language === "fr"
      ? [drug.subclassName.fr, drug.subclassName.en]
      : [drug.subclassName.en, drug.subclassName.fr]
    : [];

  return [
    { field: "name", text: localeNames[0], fieldScore: 180 },
    { field: "name", text: localeNames[1], fieldScore: 168 },
    { field: "alias", text: drug.aliases[0] ?? "", fieldScore: 160 },
    ...drug.aliases.slice(1).map((alias) => ({
      field: "alias" as const,
      text: alias,
      fieldScore: 156,
    })),
    { field: "id", text: drug.id, fieldScore: 154 },
    { field: "class", text: localeClasses[0], fieldScore: 100 },
    { field: "class", text: localeClasses[1], fieldScore: 92 },
    ...localeSubclasses.map((text, i) => ({
      field: "class" as const,
      text,
      fieldScore: 88 - i * 4,
    })),
  ];
}

function bestMatch(drug: DrugRecord, normalizedQuery: string, language: Language) {
  const matches = searchCandidates(drug, language)
    .map((candidate) => evaluateCandidate(candidate, normalizedQuery))
    .filter((match): match is EvaluatedMatch => Boolean(match));

  if (!matches.length) {
    return null;
  }

  return matches.sort((left, right) => right.score - left.score)[0];
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
      matchedTier: match.tier,
      score: match.score,
    });
  }

  return results.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    return left.drug.name[language].localeCompare(right.drug.name[language]);
  });
}
