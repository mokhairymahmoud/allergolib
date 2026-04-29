import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeContext";
import type { Language, SourceDocument } from "../types";

export function SourceCard({
  source,
  language,
  eyebrow,
}: {
  source: SourceDocument;
  language: Language;
  eyebrow: string;
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          gap: 6,
          backgroundColor: theme.surfaceAlt,
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.border,
        },
        eyebrow: {
          color: theme.accent,
          fontSize: 11,
          fontWeight: "800",
          textTransform: "uppercase",
          letterSpacing: 0.8,
        },
        title: {
          color: theme.textPrimary,
          fontSize: 14,
          fontWeight: "700",
        },
        meta: {
          color: theme.textSecondary,
          fontSize: 13,
        },
        excerpt: {
          color: theme.textPrimary,
          fontSize: 13,
          lineHeight: 20,
        },
        linkRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
          marginTop: 8,
          alignSelf: "flex-start",
        },
        link: {
          color: theme.accent,
          fontSize: 13,
          textDecorationLine: "underline",
        },
      }),
    [theme]
  );

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{source.label}</Text>
      <Text style={styles.meta}>
        {source.organization} {source.year} • {source.version} • {source.status}
      </Text>
      <Text style={styles.meta}>{source.documentName[language]}</Text>
      <Text style={styles.excerpt}>{source.excerpt[language]}</Text>
      {source.url ? (
        <Pressable
          style={styles.linkRow}
          onPress={() => Linking.openURL(source.url!)}
          hitSlop={8}
        >
          <Ionicons name="open-outline" size={14} color={theme.accent} />
          <Text style={styles.link}>
            {language === "fr" ? "Voir le document source" : "View source document"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
