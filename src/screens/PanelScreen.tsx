import { Ionicons } from "@expo/vector-icons";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { ComplianceCard } from "../components/ComplianceCard";
import { searchDrugs } from "../lib/drugSearch";
import { copy } from "../lib/i18n";
import {
  panelCategoryLabel,
  panelHasPatchData,
  panelTestValues,
  panelToHtml,
  panelToText,
} from "../lib/panelExport";
import { panelRationales, type PanelItem } from "../lib/panels";
import { useTheme } from "../theme/ThemeContext";
import type { DatasetManifest, DrugRecord, Language, SourceDocument } from "../types";

const MAX_ADD_RESULTS = 6;

export function PanelScreen({
  items,
  language,
  allDrugs,
  sources,
  manifest,
  onBack,
  onOpenDrug,
  onAddDrug,
  onRemoveDrug,
  onReset,
  onDelete,
}: {
  items: PanelItem[];
  language: Language;
  allDrugs: DrugRecord[];
  sources: Record<string, SourceDocument>;
  manifest: DatasetManifest;
  onBack: () => void;
  onOpenDrug: (drugId: string) => void;
  onAddDrug: (drugId: string) => void;
  onRemoveDrug: (drugId: string) => void;
  onReset: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [addQuery, setAddQuery] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!confirmingDelete) return;
    const timeout = setTimeout(() => setConfirmingDelete(false), 3000);
    return () => clearTimeout(timeout);
  }, [confirmingDelete]);

  const culprit = items.find((item) => item.role === "culprit")?.drug;
  const rationales = culprit ? panelRationales(culprit) : [];
  const showPatch = panelHasPatchData(items, sources, language);
  const panelIds = new Set(items.map((item) => item.drug.id));
  const addResults = addQuery.trim()
    ? searchDrugs(allDrugs, addQuery, language)
        .filter((result) => !panelIds.has(result.drug.id))
        .slice(0, MAX_ADD_RESULTS)
    : [];
  const exportContext = { items, language, sources, manifest };

  async function printPanel() {
    try {
      const html = panelToHtml(exportContext);
      if (Platform.OS === "web") {
        // expo-print on web prints the current page, so print the sheet from its own window.
        const printWindow = window.open("", "_blank");
        if (!printWindow) throw new Error("Popup blocked");
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
      }
      await Print.printAsync({ html });
    } catch (error) {
      console.warn("Panel print failed.", error);
      Alert.alert(copy(language, "panel.exportError"));
    }
  }

  async function sharePdf() {
    try {
      const { uri } = await Print.printToFileAsync({ html: panelToHtml(exportContext) });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
    } catch (error) {
      console.warn("Panel PDF share failed.", error);
      Alert.alert(copy(language, "panel.exportError"));
    }
  }

  async function shareText() {
    try {
      await Share.share({ message: panelToText(exportContext) });
    } catch (error) {
      console.warn("Panel text share failed.", error);
      Alert.alert(copy(language, "panel.exportError"));
    }
  }

  function tierColor(item: PanelItem) {
    if (item.role === "culprit") return theme.accent;
    if (item.role === "added") return theme.textSecondary;
    switch (item.tier) {
      case "higher-concern": return theme.warningAccent;
      case "lower-expected": return theme.subclassBadgeText;
      default: return theme.borderMid;
    }
  }

  return (
    <View style={styles.flex1}>
      <View style={styles.navHeader}>
        <Pressable
          onPress={onBack}
          style={styles.navButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy(language, "detail.back")}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>{copy(language, "panel.title")}</Text>
        <Pressable
          onPress={printPanel}
          style={styles.navButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy(language, "panel.print")}
        >
          <Ionicons name="print-outline" size={20} color={theme.accent} />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerCard}>
          <Text style={styles.eyebrow}>{copy(language, "panel.culprit")}</Text>
          <Text style={styles.headerTitle}>{culprit?.name[language]}</Text>
          <Text style={styles.headerMeta}>{items.length} {copy(language, "panel.drugs")}</Text>
        </View>

        {rationales.length ? (
          <View style={styles.panel}>
            <Text style={styles.sectionLabel}>{copy(language, "panel.why")}</Text>
            {rationales.map((rationale) => (
              <Text key={rationale.en} style={styles.bodyText}>{rationale[language]}</Text>
            ))}
          </View>
        ) : null}

        <View style={styles.list}>
          {items.map((item) => {
            const values = panelTestValues(item.drug, sources, language);
            const color = tierColor(item);
            return (
              <View
                key={item.drug.id}
                style={[styles.itemCard, item.role === "culprit" && styles.itemCardCulprit]}
              >
                <View style={styles.itemHeader}>
                  <View style={[styles.dot, { backgroundColor: color }]} />
                  <Pressable
                    style={styles.itemTitleBlock}
                    onPress={() => onOpenDrug(item.drug.id)}
                    accessibilityRole="link"
                  >
                    <Text style={styles.itemName}>{item.drug.name[language]}</Text>
                    <Text style={[styles.itemCategory, { color }]}>{panelCategoryLabel(item, language)}</Text>
                  </Pressable>
                  {item.role !== "culprit" ? (
                    <Pressable
                      onPress={() => onRemoveDrug(item.drug.id)}
                      hitSlop={8}
                      style={styles.removeButton}
                      accessibilityRole="button"
                      accessibilityLabel={`${copy(language, "panel.remove")} ${item.drug.name[language]}`}
                    >
                      <Ionicons name="close" size={16} color={theme.textSecondary} />
                    </Pressable>
                  ) : null}
                </View>

                {values.provenanceMissing ? (
                  <Text style={styles.warningText}>{copy(language, "panel.provenanceMissing")}</Text>
                ) : null}

                <View style={styles.valueGrid}>
                  <ValueCell label={copy(language, "panel.prick")} value={values.prick} styles={styles} />
                  <ValueCell label={copy(language, "panel.idrMax")} value={values.idrMax} styles={styles} />
                  <ValueCell
                    label={copy(language, "panel.dilutions")}
                    value={values.idrDilutions.length ? values.idrDilutions.join(" → ") : undefined}
                    styles={styles}
                  />
                  {showPatch ? (
                    <ValueCell label={copy(language, "panel.patch")} value={values.patch} styles={styles} />
                  ) : null}
                </View>

                {values.sourcesDiffer ? (
                  <View style={styles.inlineNote}>
                    <Ionicons name="git-compare-outline" size={13} color={theme.warningText} />
                    <Text style={styles.warningText}>{copy(language, "panel.sourcesDiffer")}</Text>
                  </View>
                ) : null}
                {item.role === "added" ? (
                  <Text style={styles.mutedText}>{copy(language, "panel.addedNote")}</Text>
                ) : null}
                {item.rationale ? (
                  <Text style={styles.mutedText}>{item.rationale[language]}</Text>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionLabel}>{copy(language, "panel.addDrug")}</Text>
          <TextInput
            value={addQuery}
            onChangeText={setAddQuery}
            placeholder={copy(language, "panel.addPlaceholder")}
            placeholderTextColor={theme.textDisabled}
            style={styles.input}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {addQuery.trim() && !addResults.length ? (
            <Text style={styles.mutedText}>{copy(language, "panel.noMatch")}</Text>
          ) : null}
          {addResults.map((result) => (
            <Pressable
              key={result.drug.id}
              style={styles.addRow}
              onPress={() => {
                onAddDrug(result.drug.id);
                setAddQuery("");
              }}
              accessibilityRole="button"
              accessibilityLabel={`${copy(language, "panel.addDrug")}: ${result.drug.name[language]}`}
            >
              <Ionicons name="add-circle-outline" size={18} color={theme.accent} />
              <View style={styles.flex1}>
                <Text style={styles.addRowName}>{result.drug.name[language]}</Text>
                <Text style={styles.mutedText}>{result.drug.className[language]}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <ActionButton icon="print-outline" label={copy(language, "panel.print")} onPress={printPanel} primary styles={styles} theme={theme} />
          {Platform.OS !== "web" ? (
            <ActionButton icon="document-outline" label={copy(language, "panel.sharePdf")} onPress={sharePdf} styles={styles} theme={theme} />
          ) : null}
          <ActionButton icon="share-outline" label={copy(language, "panel.shareText")} onPress={shareText} styles={styles} theme={theme} />
          <ActionButton icon="refresh-outline" label={copy(language, "panel.reset")} onPress={onReset} styles={styles} theme={theme} />
          <ActionButton
            icon="trash-outline"
            label={copy(language, confirmingDelete ? "panel.deleteConfirm" : "panel.delete")}
            onPress={() => {
              if (confirmingDelete) onDelete();
              else setConfirmingDelete(true);
            }}
            destructive
            styles={styles}
            theme={theme}
          />
        </View>

        <ComplianceCard language={language} />
      </ScrollView>
    </View>
  );
}

type Styles = ReturnType<typeof makeStyles>;

function ValueCell({ label, value, styles }: { label: string; value?: string; styles: Styles }) {
  return (
    <View style={styles.valueCell}>
      <Text style={styles.valueLabel}>{label}</Text>
      <Text style={value ? styles.value : styles.valueEmpty}>{value ?? "—"}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  primary,
  destructive,
  styles,
  theme,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  primary?: boolean;
  destructive?: boolean;
  styles: Styles;
  theme: ReturnType<typeof useTheme>;
}) {
  const color = primary ? "#FFF" : destructive ? theme.warningText : theme.accent;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, primary && styles.actionButtonPrimary, destructive && styles.actionButtonDestructive]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    flex1: { flex: 1 },
    navHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
      gap: 8,
    },
    navButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    navTitle: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    scrollView: { flex: 1, backgroundColor: theme.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    headerCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 4,
      borderLeftWidth: 4,
      borderLeftColor: theme.accent,
    },
    eyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    headerTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "800" },
    headerMeta: { color: theme.textSecondary, fontSize: 13 },
    panel: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 10,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    bodyText: { color: theme.textPrimary, fontSize: 14, lineHeight: 20 },
    list: { gap: 10 },
    itemCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemCardCulprit: { borderColor: theme.accentBorder, backgroundColor: theme.accentBg },
    itemHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    itemTitleBlock: { flex: 1, gap: 2 },
    itemName: { color: theme.textPrimary, fontSize: 16, fontWeight: "700" },
    itemCategory: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
    removeButton: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    valueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    valueCell: {
      flexGrow: 1,
      flexBasis: "30%",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 2,
      borderWidth: 1,
      borderColor: theme.border,
    },
    valueLabel: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    value: { color: theme.textPrimary, fontSize: 14, fontWeight: "700" },
    valueEmpty: { color: theme.textDisabled, fontSize: 14, fontWeight: "600" },
    inlineNote: { flexDirection: "row", alignItems: "center", gap: 6 },
    warningText: { color: theme.warningText, fontSize: 12, lineHeight: 16, flexShrink: 1 },
    mutedText: { color: theme.textSecondary, fontSize: 12, lineHeight: 17 },
    input: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.textPrimary,
      fontSize: 15,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    addRowName: { color: theme.textPrimary, fontSize: 14, fontWeight: "600" },
    actions: { gap: 8 },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 10,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentBg,
    },
    actionButtonPrimary: { backgroundColor: theme.accent, borderColor: theme.accent },
    actionButtonDestructive: { backgroundColor: theme.warningBg, borderColor: theme.warningBorder },
    actionText: { fontSize: 14, fontWeight: "700" },
  });
}
