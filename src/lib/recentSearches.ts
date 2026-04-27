import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@periop-skin-test/recent-searches";
const MAX_RECENT_DRUG_IDS = 6;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function loadRecentDrugIds() {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return isStringArray(parsed) ? unique(parsed).slice(0, MAX_RECENT_DRUG_IDS) : [];
  } catch (error) {
    console.warn("Discarded invalid recent searches.", error);
    return [];
  }
}

export async function persistRecentDrugIds(drugIds: string[]) {
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(unique(drugIds).slice(0, MAX_RECENT_DRUG_IDS))
  );
}

export function sanitizeRecentDrugIds(recentDrugIds: string[], validDrugIds: string[]) {
  const validIds = new Set(validDrugIds);
  return unique(recentDrugIds)
    .filter((drugId) => validIds.has(drugId))
    .slice(0, MAX_RECENT_DRUG_IDS);
}

export function recordRecentDrugId(recentDrugIds: string[], drugId: string) {
  return sanitizeRecentDrugIds([drugId, ...recentDrugIds], [drugId, ...recentDrugIds]);
}
