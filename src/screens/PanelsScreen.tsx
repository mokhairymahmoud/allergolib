import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { formatReleaseDate } from "../lib/formatters";
import { copy, countCopy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DrugRecord, Language } from "../types";

export type SavedPanelSummary = {
  culprit: DrugRecord;
  drugCount: number;
  updatedAt: string;
  hasActiveSession: boolean;
};

export function PanelsScreen({
  language,
  savedPanels,
  onOpenPanel,
}: {
  language: Language;
  savedPanels: SavedPanelSummary[];
  onOpenPanel: (culpritDrugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">{copy(language, "panel.savedTitle")}</Text>
        <Text style={styles.subtitle}>{copy(language, "panel.savedBody")}</Text>
      </View>

      {savedPanels.length ? (
        <View style={styles.list}>
          {savedPanels.map(({ culprit, drugCount, updatedAt, hasActiveSession }) => (
            <Pressable
              key={`panel-${culprit.id}`}
              style={styles.panelRow}
              onPress={() => onOpenPanel(culprit.id)}
              accessibilityRole="button"
            >
              <View style={styles.panelIcon}>
                <Ionicons name="clipboard-outline" size={18} color={theme.accent} />
              </View>
              <View style={styles.panelText}>
                <Text style={styles.panelName}>{culprit.name[language]}</Text>
                <Text style={styles.panelMeta}>
                  {countCopy(language, drugCount, "search.drugOne", "search.drugMany")} · {copy(language, "panel.updated")}{" "}
                  {formatReleaseDate(updatedAt, language)}
                </Text>
              </View>
              {hasActiveSession ? (
                <View style={styles.activeBadge}>
                  <Ionicons name="timer-outline" size={12} color={theme.warningText} />
                  <Text style={styles.activeBadgeText}>{copy(language, "session.inProgress")}</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="clipboard-outline" size={56} color={theme.borderMid} />
          <Text style={styles.emptyTitle}>{copy(language, "panel.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{copy(language, "panel.emptyBody")}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    scrollView: { flex: 1, backgroundColor: theme.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    header: { gap: 4 },
    title: { color: theme.textPrimary, fontSize: 20, fontWeight: "700" },
    subtitle: { color: theme.textSecondary, fontSize: 14, lineHeight: 20 },
    list: { gap: 10 },
    panelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    panelIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentBg,
    },
    panelText: { flex: 1, gap: 2 },
    panelName: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
    panelMeta: { color: theme.textSecondary, fontSize: 12 },
    activeBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.warningBg,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.warningBorder,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    activeBadgeText: { color: theme.warningText, fontSize: 11, fontWeight: "700" },
    emptyState: { alignItems: "center", gap: 12, paddingVertical: 32 },
    emptyTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" },
    emptyBody: { color: theme.textSecondary, fontSize: 14, lineHeight: 20, textAlign: "center" },
  });
}
