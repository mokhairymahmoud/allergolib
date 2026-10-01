import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Interpretation } from "./readingCriteria";

const STORAGE_KEY = "@allergolib/test-sessions";
const MAX_SESSIONS = 20;

export type TimedStage = "prick" | "idr";

export type DrugResult = {
  prickMm?: number;
  idrInitialMm?: number;
  idrMm?: number;
  interpretation?: Interpretation;
};

/**
 * One bench workup run from a panel. Holds measurements only; never patient identity.
 * Timer deadlines are stored as ISO timestamps so they survive app restarts.
 */
export type TestSession = {
  id: string;
  culpritDrugId: string;
  drugIds: string[];
  startedAt: string;
  completedAt?: string;
  readyAt: Partial<Record<TimedStage, string>>;
  notificationIds: Partial<Record<TimedStage, string>>;
  positiveControlMm?: number;
  negativeControlMm?: number;
  results: Record<string, DrugResult>;
};

function isTestSession(value: unknown): value is TestSession {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.culpritDrugId === "string" &&
    typeof record.startedAt === "string" &&
    Array.isArray(record.drugIds) &&
    typeof record.results === "object" &&
    record.results !== null &&
    typeof record.readyAt === "object" &&
    record.readyAt !== null
  );
}

export async function loadSessions(): Promise<TestSession[]> {
  const rawValue = await AsyncStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed)
      ? parsed.filter(isTestSession).map((session) => ({ ...session, notificationIds: session.notificationIds ?? {} }))
      : [];
  } catch (error) {
    console.warn("Discarded invalid test sessions.", error);
    return [];
  }
}

export async function persistSessions(sessions: TestSession[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

/** Keeps sessions whose culprit still exists, dropping drugs removed from the dataset. */
export function sanitizeSessions(sessions: TestSession[], validDrugIds: string[]) {
  const validIds = new Set(validDrugIds);
  return sessions
    .filter((session) => validIds.has(session.culpritDrugId))
    .map((session) => ({ ...session, drugIds: session.drugIds.filter((id) => validIds.has(id)) }));
}

/** Adds a session, evicting the oldest completed sessions beyond the storage cap. */
export function addSession(sessions: TestSession[], session: TestSession) {
  const next = [session, ...sessions];
  if (next.length <= MAX_SESSIONS) return next;
  const removable = next
    .filter((s) => s.completedAt)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(0, next.length - MAX_SESSIONS)
    .map((s) => s.id);
  return next.filter((s) => !removable.includes(s.id));
}

export function createSession(culpritDrugId: string, panelDrugIds: string[]): TestSession {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    culpritDrugId,
    drugIds: [culpritDrugId, ...panelDrugIds.filter((id) => id !== culpritDrugId)],
    startedAt: new Date().toISOString(),
    readyAt: {},
    notificationIds: {},
    results: {},
  };
}

export function activeSessionFor(sessions: TestSession[], culpritDrugId: string) {
  return sessions.find((session) => session.culpritDrugId === culpritDrugId && !session.completedAt);
}

/** Parses a wheal diameter in mm; accepts 0 and comma decimals. */
export function parseMillimetres(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 100 ? parsed : undefined;
}
