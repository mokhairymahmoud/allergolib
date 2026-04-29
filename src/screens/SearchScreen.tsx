import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DrugRow } from "../components/DrugRow";
import type { DrugSearchResult } from "../lib/drugSearch";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DrugRecord, Language } from "../types";

export function SearchScreen({
  language,
  query,
  searchResults,
  recentDrugs,
  allDrugs,
  favoriteDrugIds,
  onChangeQuery,
  onOpenDrug,
  onToggleFavorite,
}: {
  language: Language;
  query: string;
  searchResults: DrugSearchResult[];
  recentDrugs: DrugRecord[];
  allDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onChangeQuery: (value: string) => void;
  onOpenDrug: (drugId: string) => void;
  onToggleFavorite: (drugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeClass, setActiveClass] = useState<string | null>(null);
  const [activeSubclass, setActiveSubclass] = useState<string | null>(null);
  const [recentCollapsed, setRecentCollapsed] = useState(false);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);
  const favoriteDrugSet = new Set(favoriteDrugIds);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const drugClasses = [...new Set(allDrugs.map((d) => d.className[language]))]
    .sort()
    .sort((a, b) => {
      const miscEn = "Miscellaneous";
      const miscFr = "Divers";
      const aIsMisc = a === miscEn || a === miscFr;
      const bIsMisc = b === miscEn || b === miscFr;
      if (aIsMisc && !bIsMisc) return 1;
      if (!aIsMisc && bIsMisc) return -1;
      return 0;
    });

  const activeClassDrugs = activeClass
    ? allDrugs.filter((d) => d.className[language] === activeClass)
    : [];
  const subclasses = activeClass
    ? [...new Set(
        activeClassDrugs
          .map((d) => d.subclassName?.[language])
          .filter((s): s is string => Boolean(s))
      )].sort()
    : [];

  const browseDrugs: DrugRecord[] = (
    activeSubclass
      ? allDrugs.filter(
          (d) =>
            d.className[language] === activeClass &&
            d.subclassName?.[language] === activeSubclass
        )
      : activeClass
      ? activeClassDrugs
      : allDrugs
  ).slice().sort((a, b) => a.name[language].localeCompare(b.name[language], language));

  function handleClassPress(cls: string) {
    setActiveClass(cls);
    setActiveSubclass(null);
  }

  const displayDrugs = hasQuery ? null : browseDrugs;
  const displayResults = hasQuery ? searchResults : null;
  const resultCount = hasQuery ? searchResults.length : browseDrugs.length;

  return (
    <View style={styles.flex1}>
      {/* Sticky header */}
      <View style={styles.stickyHeader}>
        {/* Recent searches */}
        {!hasQuery && recentDrugs.length > 0 ? (
          <View style={styles.section}>
            <Pressable
              onPress={() => setRecentCollapsed((v) => !v)}
              style={styles.sectionLabelRow}
              hitSlop={8}
            >
              <Text style={styles.sectionLabel}>{copy(language, "search.recentTitle")}</Text>
              <Ionicons
                name={recentCollapsed ? "chevron-forward" : "chevron-down"}
                size={14}
                color={theme.textSecondary}
              />
            </Pressable>
            {!recentCollapsed ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipList}
                style={styles.chipScroll}
              >
                {recentDrugs.map((drug) => (
                  <Pressable
                    key={`recent-${drug.id}`}
                    onPress={() => onOpenDrug(drug.id)}
                    style={styles.recentChip}
                  >
                    <Text style={styles.recentChipText} numberOfLines={1}>{drug.name[language]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
          </View>
        ) : null}

        {/* Search input */}
        <View style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeQuery}
            placeholder={copy(language, "search.placeholder")}
            placeholderTextColor={theme.textDisabled}
            style={styles.input}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => onChangeQuery("")} hitSlop={8} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={theme.textDisabled} />
            </Pressable>
          ) : null}
        </View>

        {/* Category chips */}
        <View style={styles.section}>
          <Pressable
            onPress={() => setCategoriesCollapsed((v) => !v)}
            style={styles.sectionLabelRow}
            hitSlop={8}
          >
            <Text style={styles.sectionLabel}>{copy(language, "search.categories")}</Text>
            <Ionicons
              name={categoriesCollapsed ? "chevron-forward" : "chevron-down"}
              size={14}
              color={theme.textSecondary}
            />
          </Pressable>
          {!categoriesCollapsed ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipList}
                style={styles.chipScroll}
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  onPress={() => { setActiveClass(null); setActiveSubclass(null); }}
                  style={[styles.categoryChip, activeClass === null && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, activeClass === null && styles.categoryChipTextActive]}>
                    {copy(language, "search.categoryAll")}
                  </Text>
                  <View style={[styles.chipCount, activeClass === null && styles.chipCountActive]}>
                    <Text style={[styles.chipCountText, activeClass === null && styles.chipCountTextActive]}>
                      {allDrugs.length}
                    </Text>
                  </View>
                </Pressable>

                {drugClasses.map((cls) => {
                  const active = cls === activeClass;
                  const count = allDrugs.filter((d) => d.className[language] === cls).length;
                  return (
                    <Pressable
                      key={cls}
                      onPress={() => handleClassPress(cls)}
                      style={[styles.categoryChip, active && styles.categoryChipActive]}
                    >
                      <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                        {cls}
                      </Text>
                      <View style={[styles.chipCount, active && styles.chipCountActive]}>
                        <Text style={[styles.chipCountText, active && styles.chipCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {subclasses.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>{copy(language, "search.subcategories")}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipList}
                    style={styles.chipScroll}
                    keyboardShouldPersistTaps="handled"
                  >
                    <Pressable
                      onPress={() => setActiveSubclass(null)}
                      style={[styles.subclassChip, activeSubclass === null && styles.subclassChipActive]}
                    >
                      <Text style={[styles.subclassChipText, activeSubclass === null && styles.subclassChipTextActive]}>
                        {copy(language, "search.categoryAll")}
                      </Text>
                      <View style={[styles.subclassChipCount, activeSubclass === null && styles.subclassChipCountActive]}>
                        <Text style={[styles.subclassChipCountText, activeSubclass === null && styles.subclassChipCountTextActive]}>
                          {activeClassDrugs.length}
                        </Text>
                      </View>
                    </Pressable>
                    {subclasses.map((sub) => {
                      const active = sub === activeSubclass;
                      const count = activeClassDrugs.filter(
                        (d) => d.subclassName?.[language] === sub
                      ).length;
                      return (
                        <Pressable
                          key={sub}
                          onPress={() => setActiveSubclass(sub)}
                          style={[styles.subclassChip, active && styles.subclassChipActive]}
                        >
                          <Text style={[styles.subclassChipText, active && styles.subclassChipTextActive]}>
                            {sub}
                          </Text>
                          <View style={[styles.subclassChipCount, active && styles.subclassChipCountActive]}>
                            <Text style={[styles.subclassChipCountText, active && styles.subclassChipCountTextActive]}>
                              {count}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      {/* Scrollable results */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={styles.resultCount}>
          {resultCount} {copy(language, "search.results")}
        </Text>

        {hasQuery && displayResults !== null ? (
          displayResults.length ? (
            <View style={styles.resultsList}>
              {displayResults.map((result) => (
                <DrugRow
                  key={result.drug.id}
                  isSaved={favoriteDrugSet.has(result.drug.id)}
                  language={language}
                  onPress={() => onOpenDrug(result.drug.id)}
                  onToggleFavorite={() => onToggleFavorite(result.drug.id)}
                  result={result}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="search-outline" size={32} color={theme.textDisabled} style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{copy(language, "search.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{copy(language, "search.emptyBody")}</Text>
            </View>
          )
        ) : displayDrugs !== null ? (
          <View style={styles.resultsList}>
            {displayDrugs.map((drug) => (
              <DrugRow
                key={drug.id}
                isSaved={favoriteDrugSet.has(drug.id)}
                language={language}
                onPress={() => onOpenDrug(drug.id)}
                onToggleFavorite={() => onToggleFavorite(drug.id)}
                result={{ drug, score: Number.MAX_SAFE_INTEGER }}
              />
            ))}
          </View>
        ) : null}

      </ScrollView>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    flex1: { flex: 1 },
    stickyHeader: {
      backgroundColor: theme.bg,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    section: { gap: 10 },
    sectionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    sectionLabel: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    chipScroll: { marginHorizontal: -16 },
    chipList: { gap: 8, paddingHorizontal: 16 },
    recentChip: {
      backgroundColor: theme.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderMid,
      paddingHorizontal: 14,
      paddingVertical: 8,
      maxWidth: 200,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    recentChipText: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderMid,
      paddingHorizontal: 12,
      height: 52,
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    searchIcon: { flexShrink: 0 },
    input: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      paddingVertical: 0,
    },
    clearButton: { flexShrink: 0 },
    categoryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    categoryChipActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentBg,
    },
    categoryChipText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    categoryChipTextActive: {
      color: theme.accent,
      fontWeight: "700",
    },
    chipCount: {
      backgroundColor: theme.border,
      borderRadius: 999,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    chipCountActive: { backgroundColor: theme.accentCountBg },
    chipCountText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    chipCountTextActive: { color: theme.accentBadgeText },
    subclassChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.borderMid,
      backgroundColor: theme.subclassChipBg,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    subclassChipActive: {
      borderColor: theme.subclassChipActiveBorder,
      backgroundColor: theme.subclassChipActiveBg,
    },
    subclassChipText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    subclassChipTextActive: {
      color: theme.subclassChipActiveText,
      fontWeight: "700",
    },
    subclassChipCount: {
      backgroundColor: theme.border,
      borderRadius: 999,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    subclassChipCountActive: { backgroundColor: theme.subclassBadgeBg },
    subclassChipCountText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    subclassChipCountTextActive: { color: theme.subclassBadgeText },
    scrollView: { flex: 1, backgroundColor: theme.bg },
    content: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    resultCount: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: -4,
    },
    resultsList: { gap: 10 },
    emptyCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 24,
      alignItems: "center",
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    emptyIcon: { marginBottom: 4 },
    emptyTitle: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    emptyText: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
  });
}
