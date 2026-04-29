import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Theme } from "../theme/colors";

export function AppLogo({ theme }: { theme: Theme }) {
  const logoStyles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
        },
        mark: {
          width: 36,
          height: 36,
          alignItems: "center",
          justifyContent: "center",
        },
        shield: {
          width: 32,
          height: 36,
          borderRadius: 6,
          borderBottomLeftRadius: 14,
          borderBottomRightRadius: 14,
          backgroundColor: theme.accent,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: theme.accent,
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 4,
        },
        crossV: {
          position: "absolute",
          width: 4,
          height: 18,
          borderRadius: 2,
          backgroundColor: "#FFFFFF",
        },
        crossH: {
          position: "absolute",
          width: 18,
          height: 4,
          borderRadius: 2,
          backgroundColor: "#FFFFFF",
        },
        dot: {
          position: "absolute",
          bottom: 5,
          right: 5,
          width: 5,
          height: 5,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.5)",
        },
        wordmark: {
          flexDirection: "row",
          alignItems: "baseline",
        },
        wordPrimary: {
          fontSize: 20,
          fontWeight: "800",
          color: theme.textPrimary,
          letterSpacing: -0.3,
        },
        wordAccent: {
          fontSize: 20,
          fontWeight: "800",
          color: theme.accent,
          letterSpacing: -0.3,
        },
      }),
    [theme]
  );

  return (
    <View style={logoStyles.root}>
      <View style={logoStyles.mark}>
        <View style={logoStyles.shield}>
          <View style={logoStyles.crossV} />
          <View style={logoStyles.crossH} />
          <View style={logoStyles.dot} />
        </View>
      </View>
      <View style={logoStyles.wordmark}>
        <Text style={logoStyles.wordPrimary}>Allergo</Text>
        <Text style={logoStyles.wordAccent}>lib</Text>
      </View>
    </View>
  );
}
