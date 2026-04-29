import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ComplianceBanner } from "../../components/ComplianceBanner";
import { NoteList } from "../../components/NoteList";
import { SourceCard } from "../../components/SourceCard";
import { extractConcentrationUnit } from "../../lib/dilutionCalculator";
import { copy } from "../../lib/i18n";
import { useTheme } from "../../theme/ThemeContext";
import type {
  DrugRecord,
  Language,
  SourceDocument,
  TestKind,
  TestNote,
  TestRecord,
} from "../../types";

import { DilutionTab } from "./DilutionTab";
import { OrbitMap } from "./OrbitMap";

const TAB_ORDER: TestKind[] = ["prick", "idr", "patch"];

type DetailTab = "testing" | "cross" | "dilution" | "sources";
const DETAIL_TABS: DetailTab[] = ["testing", "cross", "dilution", "sources"];

function detailTabLabel(language: Language, tab: DetailTab) {
  switch (tab) {
    case "testing": return copy(language, "detail.tabTesting");
    case "cross": return copy(language, "detail.tabCross");
    case "dilution": return copy(language, "detail.tabDilution");
    case "sources": return copy(language, "detail.tabSources");
  }
}

function hasDisplayableTestContent(test: TestRecord) {
  return (
    test.sourceEntries.some((e) => e.concentration || e.maxConcentration) ||
    test.dilutions.length > 0 ||
    Boolean(test.vehicle) ||
    test.notes.length > 0
  );
}

function isTestAvailable(drug: DrugRecord, kind: TestKind) {
  return hasDisplayableTestContent(drug.tests[kind]);
}

function availableTests(drug: DrugRecord) {
  return TAB_ORDER.filter((kind) => isTestAvailable(drug, kind));
}

function concentrationLabel(language: Language, kind: TestKind) {
  if (kind === "idr") {
    return copy(language, "detail.idr.maxConcentration");
  }
  return copy(language, "detail.concentration");
}

function testTitle(language: Language, kind: TestKind) {
  return copy(language, `tests.${kind}`);
}

function hasSourceDocumentContent(source: SourceDocument | undefined) {
  return Boolean(
    source?.label &&
      source.organization &&
      source.year &&
      source.version &&
      source.documentName.en &&
      source.documentName.fr &&
      source.excerpt.en &&
      source.excerpt.fr
  );
}

function hasTestProvenance(
  test: TestRecord,
  sources: Record<string, SourceDocument>
) {
  if (!hasDisplayableTestContent(test)) {
    return true;
  }
  const preferred = test.sourceEntries.find((e) => e.isPreferred);
  return hasSourceDocumentContent(preferred ? sources[preferred.sourceId] : undefined);
}

function splitNotes(notes: TestNote[]) {
  return {
    warnings: notes.filter((note) => note.kind === "warning"),
    supporting: notes.filter((note) => note.kind !== "warning"),
  };
}

type DetailMetricItem = {
  label: string;
  value: string;
  compact?: boolean;
};

export function DetailScreen({
  drug,
  language,
  sources,
  allDrugs,
  isSaved,
  onBack,
  onToggleFavorite,
  onOpenDrug,
}: {
  drug: DrugRecord;
  language: Language;
  sources: Record<string, SourceDocument>;
  allDrugs: DrugRecord[];
  isSaved: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onOpenDrug: (drugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [detailTab, setDetailTab] = useState<DetailTab>("testing");
  const [testKind, setTestKind] = useState<TestKind>(availableTests(drug)[0] ?? "prick");
  const availableTestKinds = availableTests(drug);

  useEffect(() => {
    const nextAvailableTests = availableTests(drug);
    if (!nextAvailableTests.includes(testKind)) {
      setTestKind(nextAvailableTests[0] ?? "prick");
    }
  }, [testKind, drug]);

  const test = drug.tests[testKind];
  const canShowProvenance = hasTestProvenance(test, sources);
  const preferredEntry = test.sourceEntries.find((e) => e.isPreferred);
  const nonPreferredEntries = test.sourceEntries.filter((e) => !e.isPreferred);
  const { warnings, supporting } = splitNotes(test.notes);
  const concentrationUnit = extractConcentrationUnit(
    preferredEntry?.maxConcentration ?? preferredEntry?.concentration
  );
  const shouldShowStandardConcentration =
    Boolean(preferredEntry?.concentration) &&
    (testKind !== "idr" || preferredEntry?.concentration !== preferredEntry?.maxConcentration);
  const sourcesDisagree = nonPreferredEntries.some(
    (e) => e.concentration && e.concentration !== preferredEntry?.concentration
  );
  const [headerExpanded, setHeaderExpanded] = useState(false);

  const metricItems: DetailMetricItem[] = [];

  if (shouldShowStandardConcentration) {
    metricItems.push({
      label: concentrationLabel(language, testKind),
      value: preferredEntry?.concentration ?? "",
    });
  }
  if (preferredEntry?.maxConcentration) {
    metricItems.push({
      label: copy(language, "detail.idr.maxConcentration"),
      value: preferredEntry.maxConcentration,
    });
  }
  if (test.dilutions.length) {
    metricItems.push({
      label: copy(language, "detail.idr.dilutions"),
      value: test.dilutions.join(" → "),
      compact: true,
    });
  }
  if (test.vehicle) {
    metricItems.push({
      label: copy(language, "detail.patch.vehicle"),
      value: test.vehicle[language],
      compact: true,
    });
  }

  return (
    <View style={styles.flex1}>
      {/* Sticky nav header */}
      <View style={styles.navHeader}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{drug.name[language]}</Text>
        <Pressable onPress={onToggleFavorite} style={styles.navAction} hitSlop={8}>
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={22}
            color={isSaved ? theme.accent : theme.textSecondary}
          />
        </Pressable>
      </View>

      {/* Drug header card — collapsible */}
      <Pressable
        onPress={() => setHeaderExpanded((v) => !v)}
        style={{ paddingHorizontal: 16, paddingTop: headerExpanded ? 8 : 0, paddingBottom: headerExpanded ? 4 : 0 }}
      >
        {headerExpanded ? (
          <View style={styles.detailHeader}>
            <View style={styles.metaRow}>
              <View style={styles.classBadge}>
                <Text style={styles.classBadgeText}>{drug.className[language]}</Text>
              </View>
              {drug.subclassName ? (
                <View style={styles.subclassBadge}>
                  <Text style={styles.subclassBadgeText}>{drug.subclassName[language]}</Text>
                </View>
              ) : null}
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-up" size={16} color={theme.textDisabled} />
            </View>
            <Text style={styles.detailTitle}>{drug.name[language]}</Text>
            {drug.aliases.length > 0 ? (
              <Text style={styles.detailSubtitle}>{drug.aliases.join(", ")}</Text>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6, gap: 8 }}>
            <View style={styles.classBadge}>
              <Text style={styles.classBadgeText}>{drug.className[language]}</Text>
            </View>
            {drug.subclassName ? (
              <View style={styles.subclassBadge}>
                <Text style={styles.subclassBadgeText}>{drug.subclassName[language]}</Text>
              </View>
            ) : null}
            <View style={{ flex: 1 }} />
            <Ionicons name="chevron-down" size={16} color={theme.textDisabled} />
          </View>
        )}
      </Pressable>

      {/* Top-level underline tab bar */}
      <View style={styles.tabBar}>
        {DETAIL_TABS.map((tab) => {
          const selected = tab === detailTab;
          return (
            <Pressable
              key={tab}
              onPress={() => setDetailTab(tab)}
              style={[styles.tab, selected && styles.tabSelected]}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {detailTabLabel(language, tab)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Tab: Testing */}
        {detailTab === "testing" ? (
          <>
            {availableTestKinds.length > 1 ? (
              <View style={[styles.segmentedControl, { marginBottom: 4 }]}>
                {TAB_ORDER.map((kind) => {
                  const selected = kind === testKind;
                  const disabled = !isTestAvailable(drug, kind);
                  return (
                    <Pressable
                      key={kind}
                      disabled={disabled}
                      onPress={() => setTestKind(kind)}
                      style={[
                        styles.segmentButton,
                        selected && styles.segmentButtonSelected,
                        disabled && styles.segmentButtonDisabled,
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentButtonText,
                          selected && styles.segmentButtonTextSelected,
                          disabled && styles.segmentButtonTextDisabled,
                        ]}
                      >
                        {testTitle(language, kind)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!canShowProvenance ? (
              <View style={styles.warningPanel}>
                <View style={styles.warningPanelHeader}>
                  <Ionicons name="warning-outline" size={18} color={theme.warningText} />
                  <Text style={styles.warningTitle}>
                    {copy(language, "detail.provenanceUnavailableTitle")}
                  </Text>
                </View>
                <Text style={styles.warningText}>
                  {copy(language, "detail.provenanceUnavailableBody")}
                </Text>
              </View>
            ) : null}

            {canShowProvenance ? (
              <View style={styles.panel}>
                <View style={styles.panelHeaderRow}>
                  <Text style={styles.sectionTitle}>{testTitle(language, testKind)}</Text>
                  <Text style={styles.panelHeaderLabel}>{copy(language, "detail.validatedData")}</Text>
                </View>
                {metricItems.length ? (
                  <View style={styles.metricGrid}>
                    {metricItems.map((item) => (
                      <View
                        key={`${testKind}-${item.label}`}
                        style={[styles.metricCard, item.compact && styles.metricCardCompact]}
                      >
                        <Text style={styles.metricLabel}>{item.label}</Text>
                        <Text style={item.compact ? styles.metricValueSmall : styles.metricValue}>
                          {item.value}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyState}>{copy(language, "detail.noTestData")}</Text>
                )}
              </View>
            ) : null}

            {canShowProvenance && warnings.length ? (
              <View style={styles.warningPanel}>
                <View style={styles.warningPanelHeader}>
                  <Ionicons name="warning-outline" size={18} color={theme.warningText} />
                  <Text style={styles.warningTitle}>{copy(language, "detail.warnings")}</Text>
                </View>
                <NoteList language={language} notes={warnings} tone="warning" />
              </View>
            ) : null}

            {canShowProvenance && supporting.length ? (
              <View style={styles.panel}>
                <Text style={styles.sectionTitle}>{copy(language, "detail.notes")}</Text>
                <NoteList language={language} notes={supporting} />
              </View>
            ) : null}

            {canShowProvenance && sourcesDisagree ? (
              <View style={styles.warningPanel}>
                <View style={styles.warningPanelHeader}>
                  <Ionicons name="git-compare-outline" size={18} color={theme.warningText} />
                  <Text style={styles.warningTitle}>
                    {copy(language, "detail.sourceDiscrepancyTitle")}
                  </Text>
                </View>
                <Text style={styles.warningText}>
                  {copy(language, "detail.sourceDiscrepancyBody")}
                </Text>
                <View style={styles.breakdownTable}>
                  <Text style={styles.breakdownHeading}>
                    {copy(language, "detail.sourceBreakdownTitle")}
                  </Text>
                  {test.sourceEntries.map((entry) => {
                    const src = sources[entry.sourceId];
                    const conc = entry.concentration ?? entry.maxConcentration ?? "—";
                    return (
                      <View key={entry.sourceId} style={styles.breakdownRow}>
                        <Text
                          style={[
                            styles.breakdownLabel,
                            entry.isPreferred && styles.breakdownLabelPreferred,
                          ]}
                        >
                          {src?.label ?? entry.sourceId}
                        </Text>
                        <Text
                          style={[
                            styles.breakdownValue,
                            entry.isPreferred && styles.breakdownValuePreferred,
                          ]}
                        >
                          {conc}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </>
        ) : null}

        {/* Tab: Cross-Reactivity */}
        {detailTab === "cross" ? (
          <OrbitMap
            drug={drug}
            language={language}
            allDrugs={allDrugs}
            sources={sources}
            onOpenDrug={onOpenDrug}
          />
        ) : null}

        {/* Tab: Dilution */}
        {detailTab === "dilution" ? (
          <DilutionTab
            language={language}
            dilutions={test.dilutions}
            concentrationUnit={concentrationUnit}
          />
        ) : null}

        {/* Tab: Sources */}
        {detailTab === "sources" ? (
          <>
            {canShowProvenance ? (
              <View style={{ gap: 10 }}>
                {test.sourceEntries.map((entry) => {
                  const src = sources[entry.sourceId];
                  if (!src) return null;
                  return (
                    <SourceCard
                      key={entry.sourceId}
                      source={src}
                      language={language}
                      eyebrow={copy(language, entry.isPreferred ? "detail.preferredSource" : "detail.alternateSource")}
                    />
                  );
                })}
              </View>
            ) : (
              <View style={styles.warningPanel}>
                <View style={styles.warningPanelHeader}>
                  <Ionicons name="warning-outline" size={18} color={theme.warningText} />
                  <Text style={styles.warningTitle}>
                    {copy(language, "detail.provenanceUnavailableTitle")}
                  </Text>
                </View>
                <Text style={styles.warningText}>
                  {copy(language, "detail.provenanceUnavailableBody")}
                </Text>
              </View>
            )}
          </>
        ) : null}

        <ComplianceBanner language={language} />
      </ScrollView>
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
    backButton: {
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
      flexShrink: 0,
    },
    navTitle: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    navAction: {
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
      flexShrink: 0,
    },
    detailHeader: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    classBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.accentBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    classBadgeText: {
      color: theme.accentBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    subclassBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.subclassBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    subclassBadgeText: {
      color: theme.subclassBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    detailTitle: {
      color: theme.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
    },
    detailSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    tabBar: {
      flexDirection: "row",
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingHorizontal: 16,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabSelected: {
      borderBottomColor: theme.accent,
    },
    tabText: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "600",
    },
    tabTextSelected: {
      color: theme.accent,
      fontWeight: "700",
    },
    scrollView: { flex: 1, backgroundColor: theme.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.border,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segmentButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: "center",
    },
    segmentButtonSelected: {
      backgroundColor: theme.surface,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentButtonDisabled: { opacity: 0.4 },
    segmentButtonText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    segmentButtonTextSelected: {
      color: theme.textPrimary,
      fontWeight: "700",
    },
    segmentButtonTextDisabled: { color: theme.textDisabled },
    panel: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 14,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    panelHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    panelHeaderLabel: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sectionTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    metricGrid: { gap: 10 },
    metricCard: {
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metricCardCompact: { gap: 4 },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metricValue: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    metricValueSmall: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },
    emptyState: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    warningPanel: {
      backgroundColor: theme.warningBg,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.warningAccent,
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    warningPanelHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    warningTitle: {
      color: theme.warningText,
      fontSize: 15,
      fontWeight: "700",
    },
    warningText: {
      color: theme.warningText,
      fontSize: 14,
      lineHeight: 20,
    },
    breakdownTable: {
      marginTop: 10,
      gap: 6,
    },
    breakdownHeading: {
      color: theme.warningText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    breakdownRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    breakdownLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    breakdownLabelPreferred: {
      color: theme.textPrimary,
      fontWeight: "600",
    },
    breakdownValue: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    breakdownValuePreferred: {
      color: theme.textPrimary,
      fontWeight: "700",
    },
  });
}
