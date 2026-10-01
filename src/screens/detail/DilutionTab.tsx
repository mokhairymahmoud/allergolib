import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  buildDilutionPlans,
  buildTargetDilutionPlan,
  parseConcentration,
  preferredDilutionRatios,
} from "../../lib/dilutionCalculator";
import { formatNumber, parsePositiveNumber } from "../../lib/formatters";
import { copy } from "../../lib/i18n";
import { useTheme } from "../../theme/ThemeContext";
import type { Language } from "../../types";

export type DilutionTarget = {
  kind: "prick" | "idr";
  value: string;
};

function formatConcentration(value: number, language: Language) {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    maximumSignificantDigits: 3,
  }).format(value);
}

export function DilutionTab({
  language,
  dilutions,
  concentrationUnit,
  targets,
}: {
  language: Language;
  dilutions: string[];
  concentrationUnit: string;
  /** Validated maxima for this drug; the calculator can dilute the stock down to each. */
  targets: DilutionTarget[];
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [stockConcentration, setStockConcentration] = useState("");
  const [finalVolume, setFinalVolume] = useState("10");

  // The stock is entered in the unit of the validated values; targets in another unit can't be used.
  const parsedTargets = targets.flatMap((target) => {
    const parsed = parseConcentration(target.value);
    return parsed ? [{ ...target, ...parsed }] : [];
  });
  const stockUnit = parsedTargets[0]?.unit ?? concentrationUnit;
  const usableTargets = parsedTargets.filter(
    (target) => target.unit.toLowerCase() === stockUnit.toLowerCase()
  );
  const [targetKind, setTargetKind] = useState<DilutionTarget["kind"] | null>(null);
  const selectedTarget =
    usableTargets.find((target) => target.kind === targetKind) ?? usableTargets[0];

  const ratios = preferredDilutionRatios(dilutions);
  const parsedStockConcentration = parsePositiveNumber(stockConcentration);
  const parsedFinalVolume = parsePositiveNumber(finalVolume);
  const ready = parsedStockConcentration !== null && parsedFinalVolume !== null;
  const plans = ready ? buildDilutionPlans(ratios, parsedStockConcentration, parsedFinalVolume) : [];
  const targetPlan =
    ready && selectedTarget
      ? buildTargetDilutionPlan(parsedStockConcentration, selectedTarget.amount, parsedFinalVolume)
      : null;
  const showInvalidState = stockConcentration.trim() !== "" && parsedStockConcentration === null;
  const showVolumeInvalidState = finalVolume.trim() !== "" && parsedFinalVolume === null;
  const ml = (value: number) => `${formatNumber(value, language)} mL`;
  const conc = (value: number) =>
    `${formatConcentration(value, language)}${stockUnit ? ` ${stockUnit}` : ""}`;

  return (
    <View style={styles.panel}>
      <View style={styles.toggleLeft}>
        <Ionicons name="calculator-outline" size={18} color={theme.accent} />
        <Text style={styles.sectionTitle}>{copy(language, "detail.calculatorTitle")}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.field}>
          <Text style={styles.metricLabel}>{copy(language, "detail.calculatorStock")}</Text>
          <View style={styles.inputWithUnit}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setStockConcentration}
              placeholder={copy(language, "detail.calculatorStockPlaceholder")}
              placeholderTextColor={theme.textDisabled}
              style={styles.calcInputInner}
              value={stockConcentration}
              accessibilityLabel={`${copy(language, "detail.calculatorStock")}${stockUnit ? ` (${stockUnit})` : ""}`}
            />
            {stockUnit ? <Text style={styles.inputUnit}>{stockUnit}</Text> : null}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.metricLabel}>{copy(language, "detail.calculatorVolume")}</Text>
          <View style={styles.inputWithUnit}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setFinalVolume}
              placeholder="10"
              placeholderTextColor={theme.textDisabled}
              style={styles.calcInputInner}
              value={finalVolume}
              accessibilityLabel={copy(language, "detail.calculatorVolume")}
            />
            <Text style={styles.inputUnit}>mL</Text>
          </View>
        </View>
      </View>

      {showInvalidState || showVolumeInvalidState ? (
        <Text style={styles.warningText}>{copy(language, "detail.calculatorInvalid")}</Text>
      ) : null}

      {!stockConcentration.trim() ? (
        <Text style={styles.emptyState}>{copy(language, "detail.calculatorEmpty")}</Text>
      ) : null}

      {usableTargets.length ? (
        <View style={styles.recipeSection}>
          <Text style={styles.recipeLabel}>{copy(language, "detail.calculatorTargetTitle")}</Text>
          <View style={styles.targetChips}>
            {usableTargets.map((target) => {
              const selected = target.kind === selectedTarget?.kind;
              return (
                <Pressable
                  key={target.kind}
                  onPress={() => setTargetKind(target.kind)}
                  style={[styles.targetChip, selected && styles.targetChipSelected]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.targetChipText, selected && styles.targetChipTextSelected]}>
                    {copy(language, target.kind === "prick" ? "detail.calculatorTargetPrick" : "detail.calculatorTargetIdr")}
                    {" · "}
                    {target.value}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {targetPlan && selectedTarget ? (
        <View style={[styles.card, styles.targetCard]}>
          {targetPlan.factor <= 1 + 1e-9 ? (
            <Text style={styles.panelBody}>{copy(language, "detail.calculatorNoDilution")}</Text>
          ) : (
            <>
              <View style={styles.cardHeader}>
                <Text style={styles.ratio}>1:{formatNumber(targetPlan.factor, language)}</Text>
                <Text style={styles.targetConc}>→ {selectedTarget.value}</Text>
              </View>

              <View style={styles.recipeSection}>
                <Text style={styles.recipeLabel}>{copy(language, "detail.calculatorDirect")}</Text>
                <View style={styles.recipeRow}>
                  <View style={styles.recipePill}>
                    <Text style={styles.recipePillValue}>{ml(targetPlan.stockVolumeMl)}</Text>
                    <Text style={styles.recipePillLabel}>{copy(language, "detail.calculatorStockVol")}</Text>
                  </View>
                  <Text style={styles.recipePlus}>+</Text>
                  <View style={styles.recipePill}>
                    <Text style={styles.recipePillValue}>{ml(targetPlan.diluentVolumeMl)}</Text>
                    <Text style={styles.recipePillLabel}>{copy(language, "detail.calculatorDiluentVol")}</Text>
                  </View>
                  <Text style={styles.recipeEquals}>= {ml(parsedFinalVolume!)}</Text>
                </View>
              </View>

              {targetPlan.serialSteps.length ? (
                <View style={styles.recipeSection}>
                  <Text style={styles.recipeLabel}>{copy(language, "detail.calculatorSerial")}</Text>
                  {targetPlan.serialSteps.map((step, index) => (
                    <View key={index} style={styles.stepRow}>
                      <Text style={styles.stepIndex}>{index + 1}</Text>
                      <Text style={styles.stepText}>
                        {ml(step.carryVolumeMl)}{" "}
                        {index === 0
                          ? copy(language, "detail.calculatorFromStock")
                          : `${copy(language, "detail.calculatorFromStep")} ${index}`}
                        {" + "}
                        {ml(step.diluentVolumeMl)} {copy(language, "detail.calculatorDiluentVol")}
                      </Text>
                      <Text style={styles.stepConc}>{conc(step.concentration)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          )}
          <Text style={styles.fieldHint}>{copy(language, "detail.calculatorCheck")}</Text>
        </View>
      ) : null}

      {plans.length ? (
        <View style={styles.results}>
          <Text style={styles.recipeLabel}>{copy(language, "detail.calculatorCommonRatios")}</Text>
          {plans.map((plan) => (
            <View key={plan.ratio} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.ratio}>{plan.ratio}</Text>
                <Text style={styles.targetConc}>→ {conc(plan.targetConcentration)}</Text>
              </View>

              <View style={styles.recipeSection}>
                <Text style={styles.recipeLabel}>{copy(language, "detail.calculatorDirect")}</Text>
                <View style={styles.recipeRow}>
                  <View style={styles.recipePill}>
                    <Text style={styles.recipePillValue}>{ml(plan.stockVolumeMl)}</Text>
                    <Text style={styles.recipePillLabel}>{copy(language, "detail.calculatorStockVol")}</Text>
                  </View>
                  <Text style={styles.recipePlus}>+</Text>
                  <View style={styles.recipePill}>
                    <Text style={styles.recipePillValue}>{ml(plan.diluentVolumeMl)}</Text>
                    <Text style={styles.recipePillLabel}>{copy(language, "detail.calculatorDiluentVol")}</Text>
                  </View>
                  <Text style={styles.recipeEquals}>= {ml(parsedFinalVolume!)}</Text>
                </View>
              </View>

              {plan.stepUpFromRatio &&
              plan.stepUpStockVolumeMl !== undefined &&
              plan.stepUpDiluentVolumeMl !== undefined ? (
                <View style={styles.recipeSection}>
                  <Text style={styles.recipeLabel}>
                    {copy(language, "detail.calculatorStepwise")} ({plan.stepUpFromRatio})
                  </Text>
                  <View style={styles.recipeRow}>
                    <View style={styles.recipePillAlt}>
                      <Text style={styles.recipePillValue}>{ml(plan.stepUpStockVolumeMl)}</Text>
                      <Text style={styles.recipePillLabel}>{plan.stepUpFromRatio}</Text>
                    </View>
                    <Text style={styles.recipePlus}>+</Text>
                    <View style={styles.recipePillAlt}>
                      <Text style={styles.recipePillValue}>{ml(plan.stepUpDiluentVolumeMl)}</Text>
                      <Text style={styles.recipePillLabel}>{copy(language, "detail.calculatorDiluentVol")}</Text>
                    </View>
                  </View>
                </View>
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
    inputWithUnit: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
    },
    calcInputInner: {
      flex: 1,
      minWidth: 0,
      paddingVertical: 12,
      color: theme.textPrimary,
      fontSize: 15,
    },
    inputUnit: {
      color: theme.textSecondary,
      fontSize: 14,
      fontWeight: "600",
      marginLeft: 8,
    },
    targetChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    targetChip: {
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
    },
    targetChipSelected: {
      borderColor: theme.accent,
      backgroundColor: theme.accentBg,
    },
    targetChipText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    targetChipTextSelected: {
      color: theme.accentText,
      fontWeight: "700",
    },
    targetCard: {
      borderColor: theme.accentBorder,
    },
    stepRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    stepIndex: {
      width: 20,
      height: 20,
      borderRadius: 10,
      overflow: "hidden",
      backgroundColor: theme.accentBadgeBg,
      color: theme.accentBadgeText,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center",
      lineHeight: 20,
    },
    stepText: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 18,
    },
    stepConc: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
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
    results: { gap: 12 },
    card: {
      gap: 12,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      gap: 10,
    },
    ratio: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: "800",
    },
    targetConc: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    recipeSection: {
      gap: 6,
    },
    recipeLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    recipeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      flexWrap: "wrap",
    },
    recipePill: {
      backgroundColor: theme.accentBg,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    recipePillAlt: {
      backgroundColor: theme.surface,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 6,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.borderMid,
    },
    recipePillValue: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    recipePillLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "600",
    },
    recipePlus: {
      color: theme.textDisabled,
      fontSize: 16,
      fontWeight: "700",
    },
    recipeEquals: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
