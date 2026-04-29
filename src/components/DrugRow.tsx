import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { DrugSearchResult } from "../lib/drugSearch";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { Language } from "../types";

function matchLabel(language: Language, result: DrugSearchResult) {
  if (result.matchedField === "alias") {
    return copy(language, "search.matchAlias");
  }

  if (result.matchedField === "class") {
    return copy(language, "search.matchClass");
  }

  if (result.matchedField === "id") {
    return copy(language, "search.matchId");
  }

  if (result.matchedField === "name") {
    return copy(language, "search.matchName");
  }

  return null;
}

export function DrugRow({
  language,
  result,
  isSaved,
  onPress,
  onToggleFavorite,
}: {
  language: Language;
  result: DrugSearchResult;
  isSaved: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surface,
          borderRadius: 12,
          padding: 16,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 2,
        },
        cardPressed: {
          opacity: 0.95,
        },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        },
        titleColumn: {
          flex: 1,
          gap: 4,
        },
        nameRow: {
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 8,
        },
        name: {
          color: theme.textPrimary,
          fontSize: 16,
          fontWeight: "700",
          flexShrink: 1,
        },
        classBadge: {
          backgroundColor: theme.accentBadgeBg,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
          alignSelf: "flex-start",
        },
        classBadgeText: {
          color: theme.accentBadgeText,
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        subclassBadge: {
          backgroundColor: theme.subclassBadgeBg,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
          alignSelf: "flex-start",
        },
        subclassBadgeText: {
          color: theme.subclassBadgeText,
          fontSize: 11,
          fontWeight: "700",
          textTransform: "uppercase",
        },
        alias: {
          color: theme.textSecondary,
          fontSize: 13,
          lineHeight: 18,
        },
        matchHint: {
          color: theme.accent,
          fontSize: 12,
          fontWeight: "600",
        },
        actions: {
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        },
        heartButton: {
          padding: 2,
        },
      }),
    [theme]
  );

  const matchCopy = matchLabel(language, result);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.header}>
        <View style={styles.titleColumn}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{result.drug.name[language]}</Text>
            <View style={styles.classBadge}>
              <Text style={styles.classBadgeText}>{result.drug.className[language]}</Text>
            </View>
            {result.drug.subclassName ? (
              <View style={styles.subclassBadge}>
                <Text style={styles.subclassBadgeText}>{result.drug.subclassName[language]}</Text>
              </View>
            ) : null}
          </View>
          {result.drug.aliases.length > 0 ? (
            <Text style={styles.alias} numberOfLines={1}>
              {result.drug.aliases.join(", ")}
            </Text>
          ) : null}
          {matchCopy && result.matchedText ? (
            <Text style={styles.matchHint}>
              {matchCopy}: {result.matchedText}
            </Text>
          ) : null}
        </View>
        <View style={styles.actions}>
          {onToggleFavorite ? (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              hitSlop={8}
              style={styles.heartButton}
            >
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
                color={isSaved ? theme.accent : theme.textDisabled}
              />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={theme.borderMid} />
        </View>
      </View>
    </Pressable>
  );
}
