import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { Language, NoteKind, TestNote } from "../types";

function noteLabel(language: Language, kind: NoteKind) {
  if (kind === "cross-reactivity") {
    return copy(language, "detail.note.cross-reactivity");
  }

  if (kind === "warning") {
    return copy(language, "detail.note.warning");
  }

  return copy(language, "detail.note.info");
}

export function NoteList({
  language,
  notes,
  tone = "default",
}: {
  language: Language;
  notes: TestNote[];
  tone?: "default" | "warning";
}) {
  const theme = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        block: {
          gap: 8,
        },
        row: {
          gap: 8,
          backgroundColor: theme.surfaceAlt,
          borderRadius: 10,
          padding: 12,
          borderWidth: 1,
          borderColor: theme.border,
        },
        rowWarning: {
          backgroundColor: theme.warningBg,
          borderColor: theme.warningBorder,
          borderLeftWidth: 3,
          borderLeftColor: theme.warningAccent,
        },
        badge: {
          alignSelf: "flex-start",
          backgroundColor: theme.border,
          borderRadius: 999,
          paddingHorizontal: 8,
          paddingVertical: 3,
        },
        badgeWarning: {
          backgroundColor: theme.warningBorder,
        },
        badgeText: {
          color: theme.textSecondary,
          fontSize: 10,
          fontWeight: "800",
          textTransform: "uppercase",
        },
        badgeTextWarning: {
          color: theme.warningText,
        },
        noteText: {
          color: theme.textPrimary,
          fontSize: 14,
          lineHeight: 22,
        },
      }),
    [theme]
  );

  return (
    <View style={styles.block}>
      {notes.map((note, index) => (
        <View
          key={`${note.kind}-${note.value.en}-${note.value.fr}-${index}`}
          style={[styles.row, tone === "warning" && styles.rowWarning]}
        >
          <View style={[styles.badge, tone === "warning" && styles.badgeWarning]}>
            <Text style={[styles.badgeText, tone === "warning" && styles.badgeTextWarning]}>
              {noteLabel(language, note.kind)}
            </Text>
          </View>
          <Text style={styles.noteText}>{note.value[language]}</Text>
        </View>
      ))}
    </View>
  );
}
