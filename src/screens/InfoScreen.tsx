import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { ComplianceCard } from "../components/ComplianceCard";
import type { DatasetOrigin } from "../data/runtimeDataset";
import { formatReleaseDate } from "../lib/formatters";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DatasetManifest, Language } from "../types";

function datasetOriginLabelKey(origin: DatasetOrigin) {
  if (origin === "bundled") {
    return "home.datasetOriginBundled";
  }

  return "home.datasetOriginUpdated";
}

export function InfoScreen({
  manifest,
  origin,
  language,
}: {
  manifest: DatasetManifest;
  origin: DatasetOrigin;
  language: Language;
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        scrollView: {
          flex: 1,
          backgroundColor: theme.bg,
        },
        content: {
          flexGrow: 1,
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 32,
          gap: 16,
        },
        appCard: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        appIcon: {
          width: 52,
          height: 52,
          borderRadius: 14,
          backgroundColor: theme.accent,
          alignItems: "center",
          justifyContent: "center",
        },
        appIconText: {
          color: "#FFFFFF",
          fontSize: 26,
          fontWeight: "800",
        },
        appMeta: {
          flex: 1,
          gap: 2,
        },
        appName: {
          color: theme.textPrimary,
          fontSize: 18,
          fontWeight: "700",
        },
        appVersion: {
          color: theme.textSecondary,
          fontSize: 13,
        },
        metaCard: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 1 },
          elevation: 1,
        },
        metaHeader: {
          color: theme.textSecondary,
          fontSize: 12,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: 0.8,
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 8,
        },
        metaRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 13,
          gap: 16,
        },
        metaRowBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
        metaLabel: {
          color: theme.textPrimary,
          fontSize: 14,
          fontWeight: "500",
        },
        metaValue: {
          color: theme.textSecondary,
          fontSize: 14,
          textAlign: "right",
          flexShrink: 1,
        },
      }),
    [theme]
  );

  const rows = [
    {
      label: copy(language, "home.release"),
      value: manifest.version,
    },
    {
      label: copy(language, "home.datasetOrigin"),
      value: copy(language, datasetOriginLabelKey(origin)),
    },
    {
      label: copy(language, "home.approvedBy"),
      value: manifest.approvedBy,
    },
    {
      label: copy(language, "home.releasedAt"),
      value: formatReleaseDate(manifest.releasedAt, language),
    },
  ];

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.appCard}>
        <View style={styles.appIcon}>
          <Text style={styles.appIconText}>A</Text>
        </View>
        <View style={styles.appMeta}>
          <Text style={styles.appName}>{copy(language, "home.heroTitle")}</Text>
          <Text style={styles.appVersion}>{copy(language, "info.releaseCardTitle")} {manifest.version}</Text>
        </View>
      </View>

      <View style={styles.metaCard}>
        <Text style={styles.metaHeader}>{copy(language, "info.title")}</Text>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.metaRow, index < rows.length - 1 && styles.metaRowBorder]}>
            <Text style={styles.metaLabel}>{row.label}</Text>
            <Text style={styles.metaValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <ComplianceCard language={language} />
    </ScrollView>
  );
}
