import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { DrugRow } from "../components/DrugRow";
import type { DrugSearchResult } from "../lib/drugSearch";
import { copy } from "../lib/i18n";
import { useTheme } from "../theme/ThemeContext";
import type { DrugRecord, Language } from "../types";

type CategoryIconName = React.ComponentProps<typeof Ionicons>["name"];

function categoryIcon(cls: string): CategoryIconName {
  const lower = cls.toLowerCase();
  if (lower.includes("beta-lactam") || lower.includes("bêta-lactam")) return "medical-outline";
  if (lower.includes("morphini") || lower.includes("antalgi") || lower.includes("opioid")) return "fitness-outline";
  if (lower.includes("anesth")) return "water-outline";
  if (lower.includes("curare") || lower.includes("neuromusc")) return "pulse-outline";
  if (lower.includes("hypnoti")) return "moon-outline";
  if (lower.includes("colorant") || lower.includes("dye")) return "color-palette-outline";
  return "flask-outline";
}

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
  const [browseAll, setBrowseAll] = useState(false);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const drugClassEntries = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of allDrugs) {
      const cls = d.className[language];
      map.set(cls, (map.get(cls) ?? 0) + 1);
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b, language))
      .sort(([a], [b]) => {
        const miscEn = "Miscellaneous";
        const miscFr = "Divers";
        const aIsMisc = a === miscEn || a === miscFr;
        const bIsMisc = b === miscEn || b === miscFr;
        if (aIsMisc && !bIsMisc) return 1;
        if (!aIsMisc && bIsMisc) return -1;
        return 0;
      });
  }, [allDrugs, language]);

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
    setBrowseAll(false);
    if (cls === activeClass) {
      setActiveClass(null);
      setActiveSubclass(null);
    } else {
      setActiveClass(cls);
      setActiveSubclass(null);
    }
  }

  const filteredResults = hasQuery && activeClass
    ? searchResults.filter((r) =>
        r.drug.className[language] === activeClass &&
        (!activeSubclass || r.drug.subclassName?.[language] === activeSubclass)
      )
    : searchResults;

  const listData: DrugSearchResult[] = hasQuery
    ? filteredResults
    : browseDrugs.map((drug) => ({ drug, score: Number.MAX_SAFE_INTEGER }));
  const resultCount = listData.length;

  const renderItem = useCallback(
    ({ item }: { item: DrugSearchResult }) => (
      <DrugRow
        isSaved={favoriteDrugIds.includes(item.drug.id)}
        language={language}
        onPress={() => onOpenDrug(item.drug.id)}
        onToggleFavorite={() => onToggleFavorite(item.drug.id)}
        result={item}
      />
    ),
    [favoriteDrugIds, language, onOpenDrug, onToggleFavorite],
  );

  const keyExtractor = useCallback((item: DrugSearchResult) => item.drug.id, []);

  const showBrowseView = !hasQuery && !activeClass && !browseAll;

  return (
    <View style={styles.flex1}>
      {/* Search input — always at top */}
      <View style={styles.searchHeader}>
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
            <Pressable onPress={() => { onChangeQuery(""); setActiveClass(null); setActiveSubclass(null); setBrowseAll(false); }} hitSlop={8} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={theme.textDisabled} />
            </Pressable>
          ) : null}
        </View>

        {/* Category filter chips — shown when searching or browsing a category */}
        {(hasQuery || activeClass || browseAll) ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipList}
            style={styles.filterChipScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => { setActiveClass(null); setActiveSubclass(null); }}
              style={[styles.filterChip, activeClass === null && (hasQuery || browseAll) && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, activeClass === null && (hasQuery || browseAll) && styles.filterChipTextActive]}>
                {copy(language, "search.categoryAll")}
              </Text>
            </Pressable>
            {drugClassEntries.map(([cls]) => {
              const active = cls === activeClass;
              return (
                <Pressable
                  key={cls}
                  onPress={() => handleClassPress(cls)}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]} numberOfLines={1}>
                    {cls}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {/* Subclass chips */}
        {activeClass && subclasses.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterChipList}
            style={styles.filterChipScroll}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => setActiveSubclass(null)}
              style={[styles.subFilterChip, activeSubclass === null && styles.subFilterChipActive]}
            >
              <Text style={[styles.subFilterChipText, activeSubclass === null && styles.subFilterChipTextActive]}>
                {copy(language, "search.categoryAll")}
              </Text>
            </Pressable>
            {subclasses.map((sub) => {
              const active = sub === activeSubclass;
              return (
                <Pressable
                  key={sub}
                  onPress={() => setActiveSubclass(sub)}
                  style={[styles.subFilterChip, active && styles.subFilterChipActive]}
                >
                  <Text style={[styles.subFilterChipText, active && styles.subFilterChipTextActive]} numberOfLines={1}>
                    {sub}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {showBrowseView ? (
        /* ─── Browse view: recents + category grid ─── */
        <ScrollView
          style={styles.browseScroll}
          contentContainerStyle={styles.browseContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* Recent searches */}
          {recentDrugs.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>{copy(language, "search.recentTitle")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentList}
              >
                {recentDrugs.map((drug) => (
                  <Pressable
                    key={`recent-${drug.id}`}
                    onPress={() => onOpenDrug(drug.id)}
                    style={styles.recentChip}
                  >
                    <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                    <Text style={styles.recentChipText} numberOfLines={1}>{drug.name[language]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Category grid */}
          <View style={styles.categorySection}>
            <Text style={styles.sectionLabel}>{copy(language, "search.categories")}</Text>
            <View style={styles.categoryGrid}>
              {drugClassEntries.map(([cls, count]) => (
                <Pressable
                  key={cls}
                  onPress={() => handleClassPress(cls)}
                  style={styles.categoryCard}
                >
                  <View style={styles.categoryCardIcon}>
                    <Ionicons name={categoryIcon(cls)} size={20} color={theme.accent} />
                  </View>
                  <Text style={styles.categoryCardName} numberOfLines={2}>{cls}</Text>
                  <Text style={styles.categoryCardCount}>
                    {count} {count === 1
                      ? (language === "fr" ? "médicament" : "drug")
                      : (language === "fr" ? "médicaments" : "drugs")}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* All drugs count as a tap target */}
          <Pressable
            onPress={() => setBrowseAll(true)}
            style={styles.browseAllCard}
          >
            <Ionicons name="list-outline" size={18} color={theme.accent} />
            <Text style={styles.browseAllText}>
              {copy(language, "search.categoryAll")} — {allDrugs.length} {language === "fr" ? "médicaments" : "drugs"}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={theme.textDisabled} />
          </Pressable>
        </ScrollView>
      ) : (
        /* ─── Results list: search or filtered browse ─── */
        <FlatList
          data={listData}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <View style={styles.resultHeader}>
              <Text style={styles.resultCount}>
                {resultCount} {copy(language, hasQuery ? "search.results" : "search.resultsAll")}
              </Text>
              {(activeClass || browseAll) && !hasQuery ? (
                <Pressable onPress={() => { setActiveClass(null); setActiveSubclass(null); setBrowseAll(false); }} hitSlop={8}>
                  <Text style={styles.clearFilter}>{language === "fr" ? "Effacer" : "Clear"}</Text>
                </Pressable>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            hasQuery ? (
              <View style={styles.emptyCard}>
                <Ionicons name="search-outline" size={32} color={theme.textDisabled} style={styles.emptyIcon} />
                <Text style={styles.emptyTitle}>{copy(language, "search.emptyTitle")}</Text>
                <Text style={styles.emptyText}>{copy(language, "search.emptyBody")}</Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        />
      )}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    flex1: { flex: 1 },

    /* ─── Search header ─── */
    searchHeader: {
      backgroundColor: theme.bg,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 10,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderMid,
      paddingHorizontal: 12,
      height: 48,
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

    /* ─── Filter chips (horizontal, compact) ─── */
    filterChipScroll: { marginHorizontal: -16 },
    filterChipList: { gap: 6, paddingHorizontal: 16 },
    filterChip: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.borderMid,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    filterChipActive: {
      borderColor: theme.accent,
      backgroundColor: theme.accentBg,
    },
    filterChipText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    filterChipTextActive: {
      color: theme.accent,
      fontWeight: "700",
    },
    subFilterChip: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: theme.borderMid,
      backgroundColor: theme.subclassChipBg,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    subFilterChipActive: {
      borderColor: theme.subclassChipActiveBorder,
      backgroundColor: theme.subclassChipActiveBg,
    },
    subFilterChipText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    subFilterChipTextActive: {
      color: theme.subclassChipActiveText,
      fontWeight: "700",
    },

    /* ─── Browse view ─── */
    browseScroll: { flex: 1, backgroundColor: theme.bg },
    browseContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 32,
      gap: 20,
    },
    sectionLabel: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    recentSection: { gap: 10 },
    recentList: { gap: 8 },
    recentChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.surface,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderMid,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: 200,
    },
    recentChipText: {
      color: theme.textPrimary,
      fontSize: 13,
      fontWeight: "600",
    },
    categorySection: { gap: 10 },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    categoryCard: {
      width: "48%",
      flexGrow: 1,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      gap: 8,
      borderWidth: 1,
      borderColor: theme.border,
    },
    categoryCardIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: theme.accentBg,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryCardName: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 18,
    },
    categoryCardCount: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "500",
    },
    browseAllCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    browseAllText: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "600",
    },

    /* ─── Results list ─── */
    scrollView: { flex: 1, backgroundColor: theme.bg },
    listContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
    },
    resultHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 6,
    },
    resultCount: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    clearFilter: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    itemSeparator: { height: 10 },
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
