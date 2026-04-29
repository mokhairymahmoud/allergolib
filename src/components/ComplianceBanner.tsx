import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { Language } from "../types";

export function ComplianceBanner({ language }: { language: Language }) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 6,
          backgroundColor: theme.accentBg,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: theme.accentBorder,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        text: {
          flex: 1,
          color: theme.accentText,
          fontSize: 11,
          lineHeight: 16,
          fontWeight: "500",
        },
      }),
    [theme]
  );

  return (
    <View style={styles.banner}>
      <Ionicons name="shield-checkmark-outline" size={14} color={theme.accentText} style={{ marginTop: 1 }} />
      <Text style={styles.text}>{copy(language, "compliance.badge")} — {copy(language, "compliance.title")}</Text>
    </View>
  );
}
