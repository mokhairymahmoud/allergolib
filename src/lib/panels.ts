import AsyncStorage from "@react-native-async-storage/async-storage";

import type {
  CrossReactivityTier,
  DrugRecord,
  LocalizedString,
} from "../types";

const STORAGE_KEY = "@allergolib/test-panels";

// One saved panel per suspected culprit. Panels never hold patient data.
export type TestPanel = {
  culpritDrugId: string;
  drugIds: string[];
  updatedAt: string;
};

export type PanelItemRole = "culprit" | "suggested" | "added";

export type PanelItem = {
  drug: DrugRecord;
  role: PanelItemRole;
  tier?: CrossReactivityTier;
  rationale?: LocalizedString;
};

const TIER_ORDER: CrossReactivityTier[] = ["higher-concern", "lower-expected", "uncertain"];

function isTestPanel(value: unknown): value is TestPanel {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.culpritDrugId === "string" &&
    typeof record.updatedAt === "string" &&
    Array.isArray(record.drugIds) &&
    record.drugIds.every((id) => typeof id === "string")
  );
}

export async function loadPanels(): Promise<TestPanel[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(isTestPanel) : [];
  } catch (error) {
    console.warn("Discarded invalid test panels.", error);
    return [];
  }
}

export async function persistPanels(panels: TestPanel[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(panels));
}

export function sanitizePanels(panels: TestPanel[], validDrugIds: string[]) {
  const validIds = new Set(validDrugIds);
  return panels
    .filter((panel) => validIds.has(panel.culpritDrugId))
    .map((panel) => ({
      ...panel,
      drugIds: Array.from(new Set(panel.drugIds)).filter(
        (id) => validIds.has(id) && id !== panel.culpritDrugId
      ),
    }));
}

/** Drug ids the curated dataset suggests testing alongside the culprit, in dataset order. */
export function suggestedPanelDrugIds(culprit: DrugRecord) {
  const ids = new Set<string>();
  for (const group of culprit.crossReactivity ?? []) {
    for (const id of group.suggestedPanel) {
      if (id !== culprit.id) ids.add(id);
    }
  }
  return [...ids];
}

export function createSuggestedPanel(culprit: DrugRecord, validDrugIds: string[]): TestPanel {
  const validIds = new Set(validDrugIds);
  return {
    culpritDrugId: culprit.id,
    drugIds: suggestedPanelDrugIds(culprit).filter((id) => validIds.has(id)),
    updatedAt: new Date().toISOString(),
  };
}

/** Distinct panel rationales from the culprit's cross-reactivity groups. */
export function panelRationales(culprit: DrugRecord): LocalizedString[] {
  const seen = new Set<string>();
  const result: LocalizedString[] = [];
  for (const group of culprit.crossReactivity ?? []) {
    if (group.panelRationale && !seen.has(group.panelRationale.en)) {
      seen.add(group.panelRationale.en);
      result.push(group.panelRationale);
    }
  }
  return result;
}

/**
 * Resolves a panel into display rows: the culprit first, then curated drugs by tier
 * (unclassified last), then drugs the clinician added manually.
 */
export function resolvePanelItems(panel: TestPanel, drugsById: Map<string, DrugRecord>): PanelItem[] {
  const culprit = drugsById.get(panel.culpritDrugId);
  if (!culprit) return [];

  const suggested = new Set(suggestedPanelDrugIds(culprit));
  const entries = new Map<string, { tier: CrossReactivityTier; rationale: LocalizedString }>();
  for (const group of culprit.crossReactivity ?? []) {
    for (const entry of group.entries) {
      const current = entries.get(entry.drugId);
      if (!current || TIER_ORDER.indexOf(entry.tier) < TIER_ORDER.indexOf(current.tier)) {
        entries.set(entry.drugId, { tier: entry.tier, rationale: entry.rationale });
      }
    }
  }

  const items: PanelItem[] = panel.drugIds.flatMap((id) => {
    const drug = drugsById.get(id);
    if (!drug) return [];
    const entry = entries.get(id);
    return [{
      drug,
      role: suggested.has(id) ? "suggested" : "added",
      tier: entry?.tier,
      rationale: entry?.rationale,
    } satisfies PanelItem];
  });

  const rank = (item: PanelItem) => {
    if (item.role === "added") return TIER_ORDER.length + 1;
    return item.tier ? TIER_ORDER.indexOf(item.tier) : TIER_ORDER.length;
  };
  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
    .map(({ item }) => item);

  return [{ drug: culprit, role: "culprit" }, ...sorted];
}
