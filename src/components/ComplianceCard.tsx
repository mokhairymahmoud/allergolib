import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { Language } from "../types";

export function ComplianceCard({ language }: { language: Language }) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.accentBg,
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: theme.accentBorder,
          gap: 8,
        },
        badgeRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        badge: {
          color: theme.accentText,
          fontSize: 11,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 0.8,
        },
        title: {
          color: theme.textPrimary,
          fontSize: 15,
          fontWeight: "700",
        },
        body: {
          color: theme.accentText,
          fontSize: 14,
          lineHeight: 20,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.card}>
      <View style={styles.badgeRow}>
        <Ionicons name="shield-checkmark-outline" size={14} color={theme.accentText} />
        <Text style={styles.badge}>{copy(language, "compliance.badge")}</Text>
      </View>
      <Text style={styles.title}>{copy(language, "compliance.title")}</Text>
      <Text style={styles.body}>{copy(language, "compliance.body")}</Text>
    </View>
  );
}
