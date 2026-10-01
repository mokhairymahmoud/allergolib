import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { DrugRow } from "../components/DrugRow";
import { formatReleaseDate } from "../lib/formatters";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DrugRecord, Language } from "../types";

export function FavoritesScreen({
  language,
  favoriteDrugs,
  favoriteDrugIds,
  onOpenDrug,
  onOpenPanel,
  onToggleFavorite,
  savedPanels,
}: {
  language: Language;
  favoriteDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onOpenDrug: (drugId: string) => void;
  onOpenPanel: (culpritDrugId: string) => void;
  onToggleFavorite: (drugId: string) => void;
  savedPanels: { culprit: DrugRecord; drugCount: number; updatedAt: string }[];
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
        header: {
          gap: 4,
        },
        title: {
          color: theme.textPrimary,
          fontSize: 20,
          fontWeight: "700",
        },
        subtitle: {
          color: theme.textSecondary,
          fontSize: 14,
          lineHeight: 20,
        },
        resultsList: {
          gap: 10,
        },
        emptyState: {
          alignItems: "center",
          gap: 12,
          paddingVertical: 32,
        },
        emptyTitle: {
          color: theme.textPrimary,
          fontSize: 15,
          fontWeight: "700",
          textAlign: "center",
        },
        emptyBody: {
          color: theme.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
        },
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
        panelText: {
          flex: 1,
          gap: 2,
        },
        panelName: {
          color: theme.textPrimary,
          fontSize: 15,
          fontWeight: "700",
        },
        panelMeta: {
          color: theme.textSecondary,
          fontSize: 12,
        },
      }),
    [theme]
  );

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{copy(language, "favorites.title")}</Text>
        <Text style={styles.subtitle}>{copy(language, "favorites.body")}</Text>
      </View>

      {favoriteDrugs.length ? (
        <View style={styles.resultsList}>
          {favoriteDrugs.map((drug) => (
            <DrugRow
              key={`favorite-${drug.id}`}
              isSaved={favoriteDrugIds.includes(drug.id)}
              language={language}
              onPress={() => onOpenDrug(drug.id)}
              onToggleFavorite={() => onToggleFavorite(drug.id)}
              result={{
                drug,
                score: Number.MAX_SAFE_INTEGER,
              }}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={56} color={theme.borderMid} />
          <Text style={styles.emptyTitle}>{copy(language, "favorites.emptyTitle")}</Text>
          <Text style={styles.emptyBody}>{copy(language, "favorites.emptyBody")}</Text>
        </View>
      )}

      {savedPanels.length ? (
        <>
          <View style={styles.header}>
            <Text style={styles.title}>{copy(language, "panel.savedTitle")}</Text>
            <Text style={styles.subtitle}>{copy(language, "panel.savedBody")}</Text>
          </View>
          <View style={styles.resultsList}>
            {savedPanels.map(({ culprit, drugCount, updatedAt }) => (
              <Pressable
                key={`panel-${culprit.id}`}
                style={styles.panelRow}
                onPress={() => onOpenPanel(culprit.id)}
                accessibilityRole="button"
              >
                <View style={styles.panelIcon}>
                  <Ionicons name="list-outline" size={18} color={theme.accent} />
                </View>
                <View style={styles.panelText}>
                  <Text style={styles.panelName}>{culprit.name[language]}</Text>
                  <Text style={styles.panelMeta}>
                    {drugCount} {copy(language, "panel.drugs")} · {copy(language, "panel.updated")}{" "}
                    {formatReleaseDate(updatedAt, language)}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textDisabled} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
