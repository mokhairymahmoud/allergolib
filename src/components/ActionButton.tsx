import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { useTheme } from "../theme/ThemeContext";

export function ActionButton({
  icon,
  label,
  onPress,
  primary,
  destructive,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = primary ? "#FFF" : destructive ? theme.warningText : theme.accent;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, primary && styles.primary, destructive && styles.destructive]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    button: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentBg,
    },
    primary: { backgroundColor: theme.accent, borderColor: theme.accent },
    destructive: { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
    text: { fontSize: 14, fontWeight: "700" },
  });
}
