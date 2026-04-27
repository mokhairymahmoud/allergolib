import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@periop-skin-test/favorite-drugs";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export async function loadFavoriteDrugIds() {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return isStringArray(parsed) ? unique(parsed) : [];
  } catch (error) {
    console.warn("Discarded invalid favorites.", error);
    return [];
  }
}

export async function persistFavoriteDrugIds(drugIds: string[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(unique(drugIds)));
}

export function sanitizeFavoriteDrugIds(favoriteDrugIds: string[], validDrugIds: string[]) {
  const validIds = new Set(validDrugIds);
  return unique(favoriteDrugIds).filter((drugId) => validIds.has(drugId));
}
