import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import {
  buildDilutionPlans,
  preferredDilutionRatios,
} from "../../lib/dilutionCalculator";
import { formatNumber, parsePositiveNumber } from "../../lib/formatters";
import { copy } from "../../lib/i18n";
import { useTheme } from "../../theme/ThemeContext";
import type { Language } from "../../types";

export function DilutionTab({
  language,
  dilutions,
  concentrationUnit,
}: {
  language: Language;
  dilutions: string[];
  concentrationUnit: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [stockConcentration, setStockConcentration] = useState("");
  const [finalVolume, setFinalVolume] = useState("10");
  const ratios = preferredDilutionRatios(dilutions);
  const parsedStockConcentration = parsePositiveNumber(stockConcentration);
  const parsedFinalVolume = parsePositiveNumber(finalVolume);
  const plans =
    parsedStockConcentration && parsedFinalVolume
      ? buildDilutionPlans(ratios, parsedStockConcentration, parsedFinalVolume)
      : [];
  const showInvalidState = stockConcentration.trim() !== "" && parsedStockConcentration === null;
  const showVolumeInvalidState = finalVolume.trim() !== "" && parsedFinalVolume === null;

  return (
    <View style={styles.panel}>
      <View style={styles.toggleLeft}>
        <Ionicons name="calculator-outline" size={18} color={theme.accent} />
        <Text style={styles.sectionTitle}>{copy(language, "detail.calculatorTitle")}</Text>
      </View>

      <Text style={styles.panelBody}>{copy(language, "detail.calculatorBody")}</Text>

          <View style={styles.row}>
            <View style={styles.field}>
              <Text style={styles.metricLabel}>{copy(language, "detail.calculatorStock")}</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setStockConcentration}
                placeholder={copy(language, "detail.calculatorStockPlaceholder")}
                placeholderTextColor={theme.textDisabled}
                style={styles.calcInput}
                value={stockConcentration}
              />
              {concentrationUnit ? (
                <Text style={styles.fieldHint}>{concentrationUnit}</Text>
              ) : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.metricLabel}>{copy(language, "detail.calculatorVolume")}</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setFinalVolume}
                placeholder="10"
                placeholderTextColor={theme.textDisabled}
                style={styles.calcInput}
                value={finalVolume}
              />
            </View>
          </View>

          <Text style={styles.fieldHint}>
            {copy(language, "detail.calculatorRatios")}: {ratios.join(", ")}
          </Text>

          {showInvalidState || showVolumeInvalidState ? (
            <Text style={styles.warningText}>{copy(language, "detail.calculatorInvalid")}</Text>
          ) : null}

          {!stockConcentration.trim() ? (
            <Text style={styles.emptyState}>{copy(language, "detail.calculatorEmpty")}</Text>
          ) : null}

          {plans.length ? (
            <View style={styles.results}>
              {plans.map((plan) => (
                <View key={plan.ratio} style={styles.card}>
                  <Text style={styles.ratio}>{plan.ratio}</Text>
                  <Text style={styles.meta}>
                    {copy(language, "detail.calculatorTarget")}:{" "}
                    {formatNumber(plan.targetConcentration, language)}
                    {concentrationUnit ? ` ${concentrationUnit}` : ""}
                  </Text>
                  <Text style={styles.meta}>
                    {copy(language, "detail.calculatorDirect")}:{" "}
                    {formatNumber(plan.stockVolumeMl, language)} mL +{" "}
                    {formatNumber(plan.diluentVolumeMl, language)} mL diluent
                  </Text>
                  {plan.stepUpFromRatio &&
                  plan.stepUpStockVolumeMl !== undefined &&
                  plan.stepUpDiluentVolumeMl !== undefined ? (
                    <Text style={styles.meta}>
                      {copy(language, "detail.calculatorStepwise")}: {plan.stepUpFromRatio}
                      {" -> "}
                      {formatNumber(plan.stepUpStockVolumeMl, language)} mL +{" "}
                      {formatNumber(plan.stepUpDiluentVolumeMl, language)} mL diluent
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : null}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    panel: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 14,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    toggleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    sectionTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    panelBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    row: { gap: 12 },
    field: { gap: 6 },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    calcInput: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 12,
      color: theme.textPrimary,
      fontSize: 15,
    },
    fieldHint: {
      color: theme.textSecondary,
      fontSize: 12,
      lineHeight: 16,
    },
    warningText: {
      color: theme.warningText,
      fontSize: 14,
      lineHeight: 20,
    },
    emptyState: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },
    results: { gap: 10 },
    card: {
      gap: 4,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    ratio: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    meta: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 20,
    },
  });
}
