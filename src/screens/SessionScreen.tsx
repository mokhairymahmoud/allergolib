import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ComplianceCard } from "../components/ComplianceCard";
import { canSharePdf, printHtml, shareHtmlAsPdf, shareText } from "../lib/exportActions";
import { copy, countCopy } from "../lib/i18n";
import {
  interpretationLabel,
  panelCategoryLabel,
  panelTestValues,
  panelToHtml,
  panelToText,
} from "../lib/panelExport";
import type { PanelItem } from "../lib/panels";
import {
  IDR_READING_MINUTES,
  PRICK_READING_MINUTES,
  controlsValidity,
  suggestIdr,
  suggestPrick,
  type Interpretation,
} from "../lib/readingCriteria";
import { parseMillimetres, type DrugResult, type TestSession, type TimedStage } from "../lib/testSessions";
import { useTheme } from "../theme/ThemeContext";
import type { DatasetManifest, Language, SourceDocument } from "../types";

const INTERPRETATIONS: Interpretation[] = ["positive", "negative", "equivocal"];
const STAGES: TimedStage[] = ["prick", "idr"];

type Theme = ReturnType<typeof useTheme>;
type Styles = ReturnType<typeof makeStyles>;

export function SessionScreen({
  session,
  items,
  language,
  sources,
  manifest,
  onBack,
  onOpenDrug,
  onUpdate,
  onStartTimer,
  onResetTimer,
  onFinish,
  onReopen,
  onDelete,
}: {
  session: TestSession;
  items: PanelItem[];
  language: Language;
  sources: Record<string, SourceDocument>;
  manifest: DatasetManifest;
  onBack: () => void;
  onOpenDrug: (drugId: string) => void;
  onUpdate: (update: (session: TestSession) => TestSession) => void;
  onStartTimer: (stage: TimedStage) => void;
  onResetTimer: (stage: TimedStage) => void;
  onFinish: () => void;
  /** Omitted when another session for the same culprit is already in progress. */
  onReopen?: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [now, setNow] = useState(() => Date.now());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const completed = Boolean(session.completedAt);
  const anyTimerRunning = STAGES.some((stage) => session.readyAt[stage]);

  useEffect(() => {
    if (!anyTimerRunning || completed) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [anyTimerRunning, completed]);

  // Vibrate once when a timer becomes due while the screen is open.
  const notifiedStages = useRef(new Set<string>());
  useEffect(() => {
    for (const stage of STAGES) {
      const readyAt = session.readyAt[stage];
      const key = `${stage}-${readyAt}`;
      if (readyAt && Date.parse(readyAt) <= now && !notifiedStages.current.has(key)) {
        notifiedStages.current.add(key);
        if (now - Date.parse(readyAt) < 5000) Vibration.vibrate([0, 400, 200, 400]);
      }
    }
  }, [now, session.readyAt]);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timeout = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirmingDelete]);

  const culprit = items.find((item) => item.role === "culprit")?.drug;
  const validity = controlsValidity(session.positiveControlMm, session.negativeControlMm);
  const exportContext = { items, language, sources, manifest, session };

  async function runExport(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      console.warn("Session export failed.", error);
      Alert.alert(copy(language, "panel.exportError"));
    }
  }

  function updateResult(drugId: string, patch: Partial<DrugResult>) {
    onUpdate((current) => ({
      ...current,
      results: { ...current.results, [drugId]: { ...current.results[drugId], ...patch } },
    }));
  }

  return (
    <View style={styles.flex1}>
      <View style={styles.navHeader}>
        <Pressable
          onPress={onBack}
          style={styles.navButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy(language, "detail.back")}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{copy(language, "session.title")}</Text>
        <Pressable
          onPress={() => runExport(() => printHtml(panelToHtml(exportContext)))}
          style={styles.navButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy(language, "session.print")}
        >
          <Ionicons name="print-outline" size={20} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>{copy(language, "panel.culprit")}</Text>
          <Text style={styles.headerTitle}>{culprit?.name[language]}</Text>
          <Text style={styles.mutedText}>
            {copy(language, completed ? "session.completed" : "session.inProgress")} ·{" "}
            {countCopy(language, items.length, "search.drugOne", "search.drugMany")}
          </Text>
        </View>

        {!completed ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{copy(language, "session.timers")}</Text>
            {STAGES.map((stage) => (
              <TimerRow
                key={stage}
                stage={stage}
                readyAt={session.readyAt[stage]}
                now={now}
                language={language}
                onStart={() => {
                  setNow(Date.now());
                  onStartTimer(stage);
                }}
                onReset={() => onResetTimer(stage)}
                styles={styles}
                theme={theme}
              />
            ))}
            <Text style={styles.mutedText}>{copy(language, "session.timerHint")}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{copy(language, "session.controls")}</Text>
          <View style={styles.inputRow}>
            <MmInput
              label={copy(language, "session.positiveControl")}
              value={session.positiveControlMm}
              onChange={(value) => onUpdate((current) => ({ ...current, positiveControlMm: value }))}
              styles={styles}
              theme={theme}
            />
            <MmInput
              label={copy(language, "session.negativeControl")}
              value={session.negativeControlMm}
              onChange={(value) => onUpdate((current) => ({ ...current, negativeControlMm: value }))}
              styles={styles}
              theme={theme}
            />
          </View>
          <View style={styles.inlineNote}>
            <Ionicons
              name={validity === "valid" ? "checkmark-circle" : validity === "invalid" ? "warning" : "ellipse-outline"}
              size={15}
              color={validity === "valid" ? theme.subclassBadgeText : validity === "invalid" ? theme.warningAccent : theme.textDisabled}
            />
            <Text style={validity === "invalid" ? styles.warningText : styles.mutedText}>
              {copy(
                language,
                validity === "valid"
                  ? "session.controlsValid"
                  : validity === "invalid"
                    ? "session.controlsInvalid"
                    : "session.controlsIncomplete"
              )}
            </Text>
          </View>
        </View>

        {items.map((item) => {
          const values = panelTestValues(item.drug, sources, language);
          const result = session.results[item.drug.id] ?? {};
          const prickSuggestion = suggestPrick(result.prickMm, session.negativeControlMm);
          const idrSuggestion = suggestIdr(result.idrInitialMm, result.idrMm);
          const suggestions = [
            prickSuggestion ? `${copy(language, "panel.prick")} ${interpretationLabel(prickSuggestion, language).toLowerCase()}` : null,
            idrSuggestion ? `IDR ${interpretationLabel(idrSuggestion, language).toLowerCase()}` : null,
          ].filter(Boolean);
          const reference = [
            values.prick ? `${copy(language, "panel.prick")} ${values.prick}` : null,
            values.idrMax ? `${copy(language, "panel.idrMax")} ${values.idrMax}` : null,
            values.idrDilutions.length ? `(${values.idrDilutions.join(" → ")})` : null,
          ].filter(Boolean).join(" · ");

          return (
            <View key={item.drug.id} style={[styles.card, item.role === "culprit" && styles.cardCulprit]}>
              <Pressable onPress={() => onOpenDrug(item.drug.id)} accessibilityRole="link" style={styles.drugHeader}>
                <Text style={styles.drugName}>{item.drug.name[language]}</Text>
                <Text style={styles.drugCategory}>{panelCategoryLabel(item, language)}</Text>
              </Pressable>
              {reference ? <Text style={styles.mutedText}>{reference}</Text> : null}

              <View style={styles.inputRow}>
                <MmInput
                  label={copy(language, "session.prickWheal")}
                  value={result.prickMm}
                  onChange={(value) => updateResult(item.drug.id, { prickMm: value })}
                  styles={styles}
                  theme={theme}
                />
                <MmInput
                  label={copy(language, "session.idrInitial")}
                  value={result.idrInitialMm}
                  onChange={(value) => updateResult(item.drug.id, { idrInitialMm: value })}
                  styles={styles}
                  theme={theme}
                />
                <MmInput
                  label={copy(language, "session.idrWheal")}
                  value={result.idrMm}
                  onChange={(value) => updateResult(item.drug.id, { idrMm: value })}
                  styles={styles}
                  theme={theme}
                />
              </View>

              {suggestions.length ? (
                <Text style={styles.mutedText}>
                  {copy(language, "session.suggested")}: {suggestions.join(" · ")}
                </Text>
              ) : null}

              <View style={styles.segmented} accessibilityRole="radiogroup">
                {INTERPRETATIONS.map((interpretation) => {
                  const selected = result.interpretation === interpretation;
                  return (
                    <Pressable
                      key={interpretation}
                      onPress={() =>
                        updateResult(item.drug.id, { interpretation: selected ? undefined : interpretation })
                      }
                      style={[styles.segment, selected && interpretationStyle(interpretation, styles)]}
                      accessibilityRole="radio"
                      aria-checked={selected}
                    >
                      <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>
                        {interpretationLabel(interpretation, language)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{copy(language, "session.criteriaTitle")}</Text>
          <Text style={styles.mutedText}>{copy(language, "session.criteriaBody")}</Text>
          <Text style={styles.mutedText}>
            {copy(language, "session.timerPrick")}: {PRICK_READING_MINUTES} {copy(language, "session.timerMinutes")} ·{" "}
            {copy(language, "session.timerIdr")}: {IDR_READING_MINUTES} {copy(language, "session.timerMinutes")}
          </Text>
        </View>

        <View style={styles.actions}>
          {completed ? (
            onReopen ? (
              <ActionButton icon="lock-open-outline" label={copy(language, "session.reopen")} onPress={onReopen} />
            ) : null
          ) : (
            <ActionButton icon="checkmark-done-outline" label={copy(language, "session.finish")} onPress={onFinish} primary />
          )}
          <ActionButton
            icon="print-outline"
            label={copy(language, "session.print")}
            onPress={() => runExport(() => printHtml(panelToHtml(exportContext)))}
          />
          {canSharePdf ? (
            <ActionButton
              icon="document-outline"
              label={copy(language, "panel.sharePdf")}
              onPress={() => runExport(() => shareHtmlAsPdf(panelToHtml(exportContext)))}
            />
          ) : null}
          <ActionButton
            icon="share-outline"
            label={copy(language, "panel.shareText")}
            onPress={() => runExport(() => shareText(panelToText(exportContext)))}
          />
          <ActionButton
            icon="trash-outline"
            label={copy(language, confirmingDelete ? "panel.deleteConfirm" : "session.delete")}
            onPress={() => {
              if (confirmingDelete) onDelete();
              else setConfirmingDelete(true);
            }}
            destructive
          />
        </View>

        <ComplianceCard language={language} />
      </ScrollView>
    </View>
  );
}

function interpretationStyle(interpretation: Interpretation, styles: Styles) {
  switch (interpretation) {
    case "positive": return styles.segmentPositive;
    case "negative": return styles.segmentNegative;
    case "equivocal": return styles.segmentEquivocal;
  }
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function TimerRow({
  stage,
  readyAt,
  now,
  language,
  onStart,
  onReset,
  styles,
  theme,
}: {
  stage: TimedStage;
  readyAt?: string;
  now: number;
  language: Language;
  onStart: () => void;
  onReset: () => void;
  styles: Styles;
  theme: Theme;
}) {
  const minutes = stage === "prick" ? PRICK_READING_MINUTES : IDR_READING_MINUTES;
  const remaining = readyAt ? Date.parse(readyAt) - now : undefined;
  const ready = remaining !== undefined && remaining <= 0;
  const label = copy(language, stage === "prick" ? "session.timerPrick" : "session.timerIdr");

  return (
    <View style={[styles.timerRow, ready && styles.timerRowReady]}>
      <Ionicons name={ready ? "alarm" : "timer-outline"} size={20} color={ready ? theme.warningAccent : theme.accent} />
      <View style={styles.flex1}>
        <Text style={styles.timerLabel}>{label}</Text>
        <Text style={ready ? styles.timerReady : styles.timerValue} accessibilityLiveRegion="polite">
          {remaining === undefined
            ? `${minutes} ${copy(language, "session.timerMinutes")}`
            : ready
              ? copy(language, "session.timerReady")
              : formatCountdown(remaining)}
        </Text>
      </View>
      <Pressable
        onPress={remaining === undefined ? onStart : onReset}
        style={[styles.timerButton, remaining === undefined && styles.timerButtonPrimary]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${copy(language, remaining === undefined ? "session.timerStart" : "session.timerReset")}`}
      >
        <Text style={[styles.timerButtonText, remaining === undefined && styles.timerButtonTextPrimary]}>
          {copy(language, remaining === undefined ? "session.timerStart" : "session.timerReset")}
        </Text>
      </Pressable>
    </View>
  );
}

function MmInput({
  label,
  value,
  onChange,
  styles,
  theme,
}: {
  label: string;
  value?: number;
  onChange: (value: number | undefined) => void;
  styles: Styles;
  theme: Theme;
}) {
  // Keep the raw text so partial input such as "3," is not reformatted while typing.
  const [text, setText] = useState(() => (value === undefined ? "" : String(value)));
  const invalid = text.trim() !== "" && parseMillimetres(text) === undefined;

  return (
    <View style={styles.inputField}>
      <Text style={styles.inputLabel} numberOfLines={2}>{label}</Text>
      <View style={[styles.inputBox, invalid && styles.inputBoxInvalid]}>
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            const parsed = parseMillimetres(next);
            if (next.trim() === "" || parsed !== undefined) onChange(parsed);
          }}
          keyboardType="decimal-pad"
          placeholder="—"
          placeholderTextColor={theme.textDisabled}
          style={styles.input}
          accessibilityLabel={`${label} (mm)`}
        />
        <Text style={styles.inputUnit}>mm</Text>
      </View>
    </View>
  );
}

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    flex1: { flex: 1 },
    navHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
      gap: 8,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    navTitle: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    scrollView: { flex: 1, backgroundColor: theme.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 12,
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 4,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    headerTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "800" },
    card: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardCulprit: { borderColor: theme.accentBorder },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    mutedText: { color: theme.textSecondary, fontSize: 12, lineHeight: 17, flexShrink: 1 },
    warningText: { color: theme.warningText, fontSize: 12, lineHeight: 17, flexShrink: 1 },
    inlineNote: { flexDirection: "row", alignItems: "center", gap: 6 },
    timerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    timerRowReady: { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
    timerLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: "600" },
    timerValue: { color: theme.textPrimary, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] },
    timerReady: { color: theme.warningText, fontSize: 18, fontWeight: "800" },
    timerButton: {
      borderRadius: 8,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
    },
    timerButtonPrimary: { backgroundColor: theme.accent, borderColor: theme.accent },
    timerButtonText: { color: theme.textSecondary, fontSize: 13, fontWeight: "700" },
    timerButtonTextPrimary: { color: "#FFF" },
    drugHeader: { gap: 2 },
    drugName: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
    drugCategory: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    inputRow: { flexDirection: "row", gap: 8 },
    inputField: { flex: 1, gap: 4, justifyContent: "flex-end" },
    inputLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: "600" },
    inputBox: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.bg,
      paddingHorizontal: 10,
    },
    inputBoxInvalid: { borderColor: theme.warningAccent },
    input: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 9,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    inputUnit: { color: theme.textDisabled, fontSize: 12, fontWeight: "600" },
    segmented: {
      flexDirection: "row",
      backgroundColor: theme.border,
      borderRadius: 10,
      padding: 3,
      gap: 3,
    },
    segment: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
    segmentPositive: { backgroundColor: "#DC2626" },
    segmentNegative: { backgroundColor: theme.subclassBadgeText },
    segmentEquivocal: { backgroundColor: theme.warningAccent },
    segmentText: { color: theme.textSecondary, fontSize: 13, fontWeight: "700" },
    segmentTextSelected: { color: "#FFF" },
    actions: { gap: 8 },
  });
}
