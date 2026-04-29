import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";

export function NeutralEmptyCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.surfaceAlt,
          borderRadius: 12,
          padding: 16,
          gap: 6,
          borderWidth: 1,
          borderColor: theme.border,
        },
        title: {
          color: theme.textPrimary,
          fontSize: 15,
          fontWeight: "700",
          textAlign: "center",
        },
        body: {
          color: theme.textSecondary,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
        },
      }),
    [theme]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}
