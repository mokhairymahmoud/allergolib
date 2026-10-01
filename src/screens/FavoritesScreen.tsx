import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { DrugRow } from "../components/DrugRow";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DrugRecord, Language } from "../types";

export function FavoritesScreen({
  language,
  favoriteDrugs,
  favoriteDrugIds,
  onOpenDrug,
  onToggleFavorite,
}: {
  language: Language;
  favoriteDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onOpenDrug: (drugId: string) => void;
  onToggleFavorite: (drugId: string) => void;
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

    </ScrollView>
  );
}
