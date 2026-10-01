import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ActionButton } from "../components/ActionButton";
import { ComplianceCard } from "../components/ComplianceCard";
import { searchDrugs } from "../lib/drugSearch";
import { canSharePdf, printHtml, shareHtmlAsPdf, shareText } from "../lib/exportActions";
import { formatDateTime } from "../lib/formatters";
import { copy, countCopy } from "../lib/i18n";
import {
  panelCategoryLabel,
  panelHasPatchData,
  panelTestValues,
  panelToHtml,
  panelToText,
} from "../lib/panelExport";
import { panelRationales, type PanelItem } from "../lib/panels";
import { useTheme } from "../theme/ThemeContext";
import type { DatasetManifest, DrugRecord, Language, SourceDocument } from "../types";

const MAX_ADD_RESULTS = 6;

export function PanelScreen({
  items,
  language,
  allDrugs,
  sources,
  manifest,
  onBack,
  onOpenDrug,
  onAddDrug,
  onRemoveDrug,
  onReset,
  onDelete,
  activeSessionStartedAt,
  previousSessions,
  onStartSession,
  onOpenSession,
}: {
  items: PanelItem[];
  language: Language;
  allDrugs: DrugRecord[];
  sources: Record<string, SourceDocument>;
  manifest: DatasetManifest;
  onBack: () => void;
  onOpenDrug: (drugId: string) => void;
  onAddDrug: (drugId: string) => void;
  onRemoveDrug: (drugId: string) => void;
  onReset: () => void;
  onDelete: () => void;
  activeSessionStartedAt?: string;
  previousSessions: { id: string; startedAt: string; positiveCount: number }[];
  onStartSession: () => void;
  onOpenSession: (sessionId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [addQuery, setAddQuery] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timeout = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirmingDelete]);

  const culprit = items.find((item) => item.role === "culprit")?.drug;
  const rationales = culprit ? panelRationales(culprit) : [];
  const showPatch = panelHasPatchData(items, sources, language);
  const panelIds = new Set(items.map((item) => item.drug.id));
  const addResults = addQuery.trim()
    ? searchDrugs(allDrugs, addQuery, language)
        .filter((result) => !panelIds.has(result.drug.id))
        .slice(0, MAX_ADD_RESULTS)
    : [];
  const exportContext = { items, language, sources, manifest };

  async function runExport(action: () => Promise<void>) {
    try {
      await action();
    } catch (error) {
      console.warn("Panel export failed.", error);
      Alert.alert(copy(language, "panel.exportError"));
    }
  }

  const printPanel = () => runExport(() => printHtml(panelToHtml(exportContext)));

  function tierColor(item: PanelItem) {
    if (item.role === "culprit") return theme.accent;
    if (item.role === "added") return theme.textSecondary;
    switch (item.tier) {
      case "higher-concern": return theme.warningAccent;
      case "lower-expected": return theme.subclassBadgeText;
      default: return theme.borderMid;
    }
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
        <Text style={styles.navTitle} numberOfLines={1}>{copy(language, "panel.title")}</Text>
        <Pressable
          onPress={printPanel}
          style={styles.navButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy(language, "panel.print")}
        >
          <Ionicons name="print-outline" size={20} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>{copy(language, "panel.culprit")}</Text>
          <Text style={styles.headerTitle}>{culprit?.name[language]}</Text>
          <Text style={styles.headerMeta}>{countCopy(language, items.length, "search.drugOne", "search.drugMany")}</Text>
        </View>

        <View style={styles.panel}>
          <ActionButton
            icon={activeSessionStartedAt ? "play-forward-outline" : "timer-outline"}
            label={copy(language, activeSessionStartedAt ? "session.resume" : "session.start")}
            onPress={onStartSession}
            primary
          />
          {activeSessionStartedAt ? (
            <Text style={styles.mutedText}>
              {copy(language, "session.inProgress")} · {copy(language, "session.started")}{" "}
              {formatDateTime(activeSessionStartedAt, language)}
            </Text>
          ) : null}
          {previousSessions.length ? (
            <>
              <Text style={styles.sectionLabel}>{copy(language, "session.previous")}</Text>
              {previousSessions.map((session) => (
                <Pressable
                  key={session.id}
                  style={styles.addRow}
                  onPress={() => onOpenSession(session.id)}
                  accessibilityRole="button"
                >
                  <Ionicons name="document-text-outline" size={18} color={theme.accent} />
                  <View style={styles.flex1}>
                    <Text style={styles.addRowName}>{formatDateTime(session.startedAt, language)}</Text>
                    <Text style={styles.mutedText}>
                      {session.positiveCount} {copy(language, "session.positiveCount")}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={theme.textDisabled} />
                </Pressable>
              ))}
            </>
          ) : null}
        </View>

        {rationales.length ? (
          <View style={styles.panel}>
            <Text style={styles.sectionLabel}>{copy(language, "panel.why")}</Text>
            {rationales.map((rationale) => (
              <Text key={rationale.en} style={styles.bodyText}>{rationale[language]}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => {
            const values = panelTestValues(item.drug, sources, language);
            const color = tierColor(item);
            return (
              <View
                key={item.drug.id}
                style={[styles.itemCard, item.role === "culprit" && styles.itemCardCulprit]}
              >
                <View style={styles.itemHeader}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Pressable
                    style={styles.itemTitleBlock}
                    onPress={() => onOpenDrug(item.drug.id)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.itemName}>{item.drug.name[language]}</Text>
                    <Text style={[styles.itemCategory, { color }]}>{panelCategoryLabel(item, language)}</Text>
                  </Pressable>
                  {item.role !== "culprit" ? (
                    <Pressable
                      onPress={() => onRemoveDrug(item.drug.id)}
                      hitSlop={8}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={`${copy(language, "panel.remove")} ${item.drug.name[language]}`}
                    >
                      <Ionicons name="close" size={16} color={theme.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>

                {values.provenanceMissing ? (
                  <Text style={styles.warningText}>{copy(language, "panel.provenanceMissing")}</Text>
                ) : null}

                <View style={styles.valueGrid}>
                  <ValueCell label={copy(language, "panel.prick")} value={values.prick} styles={styles} />
                  <ValueCell label={copy(language, "panel.idrMax")} value={values.idrMax} styles={styles} />
                  <ValueCell
                    label={copy(language, "panel.dilutions")}
                    value={values.idrDilutions.length ? values.idrDilutions.join(" → ") : undefined}
                    styles={styles}
                  />
                  {showPatch ? (
                    <ValueCell label={copy(language, "panel.patch")} value={values.patch} styles={styles} />
                  ) : null}
                </View>

                {values.sourcesDiffer ? (
                  <View style={styles.inlineNote}>
                    <Ionicons name="git-compare-outline" size={13} color={theme.warningText} />
                    <Text style={styles.warningText}>{copy(language, "panel.sourcesDiffer")}</Text>
                  </View>
                ) : null}
                {item.role === "added" ? (
                  <Text style={styles.mutedText}>{copy(language, "panel.addedNote")}</Text>
                ) : null}
                {item.rationale ? (
                  <Text style={styles.mutedText}>{item.rationale[language]}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>{copy(language, "panel.addDrug")}</Text>
          <TextInput
            value={addQuery}
            onChangeText={setAddQuery}
            placeholder={copy(language, "panel.addPlaceholder")}
            placeholderTextColor={theme.textDisabled}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {addQuery.trim() && !addResults.length ? (
            <Text style={styles.mutedText}>{copy(language, "panel.noMatch")}</Text>
          ) : null}
          {addResults.map((result) => (
            <Pressable
              key={result.drug.id}
              style={styles.addRow}
              onPress={() => {
                onAddDrug(result.drug.id);
                setAddQuery("");
              }}
              accessibilityRole="button"
              accessibilityLabel={`${copy(language, "panel.addDrug")}: ${result.drug.name[language]}`}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
              <View style={styles.flex1}>
                <Text style={styles.addRowName}>{result.drug.name[language]}</Text>
                <Text style={styles.mutedText}>{result.drug.className[language]}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <ActionButton icon="print-outline" label={copy(language, "panel.print")} onPress={printPanel} />
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
          <ActionButton icon="refresh-outline" label={copy(language, "panel.reset")} onPress={onReset} />
          <ActionButton
            icon="trash-outline"
            label={copy(language, confirmingDelete ? "panel.deleteConfirm" : "panel.delete")}
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

type Styles = ReturnType<typeof makeStyles>;

function ValueCell({ label, value, styles }: { label: string; value?: string; styles: Styles }) {
  return (
    <View style={styles.valueCell}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={value ? styles.value : styles.valueEmpty}>{value ?? "—"}</Text>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
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
      gap: 16,
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
    headerMeta: { color: theme.textSecondary, fontSize: 13 },
    panel: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 10,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    bodyText: { color: theme.textPrimary, fontSize: 14, lineHeight: 20 },
    list: { gap: 10 },
    itemCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemCardCulprit: { borderColor: theme.accentBorder, backgroundColor: theme.accentBg },
    itemHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    itemTitleBlock: { flex: 1, gap: 2 },
    itemName: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
    itemCategory: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    removeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    valueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    valueCell: {
      flexGrow: 1,
      flexBasis: "30%",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    valueLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    value: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
    valueEmpty: { color: theme.textDisabled, fontSize: 14, fontWeight: "600" },
    inlineNote: { flexDirection: "row", alignItems: "center", gap: 6 },
    warningText: { color: theme.warningText, fontSize: 12, lineHeight: 16, flexShrink: 1 },
    mutedText: { color: theme.textSecondary, fontSize: 12, lineHeight: 17 },
    input: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textPrimary,
      fontSize: 15,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    addRowName: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
    actions: { gap: 8 },
  });
}
