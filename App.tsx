import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { createContext, startTransition, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  getBundledActiveDataset,
  loadActiveDataset,
  syncDatasetInBackground,
  type DatasetOrigin,
} from "./src/data/runtimeDataset";
import {
  buildDilutionPlans,
  extractConcentrationUnit,
  preferredDilutionRatios,
} from "./src/lib/dilutionCalculator";
import { loadFavoriteDrugIds, persistFavoriteDrugIds, sanitizeFavoriteDrugIds } from "./src/lib/favorites";
import { copy } from "./src/lib/i18n";
import {
  loadRecentDrugIds,
  persistRecentDrugIds,
  recordRecentDrugId,
  sanitizeRecentDrugIds,
} from "./src/lib/recentSearches";
import { searchDrugs, type DrugSearchResult } from "./src/lib/drugSearch";
import type {
  CrossReactivityGroup,
  CrossReactivityTier,
  DrugRecord,
  Language,
  NoteKind,
  SourceDocument,
  StructuralRelation,
  TestKind,
  TestNote,
  TestRecord,
  TestSourceEntry,
} from "./src/types";

// ─── Theme ────────────────────────────────────────────────────────────────────

export type Theme = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  borderMid: string;
  textPrimary: string;
  textSecondary: string;
  textDisabled: string;
  accent: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  accentBadgeBg: string;
  accentBadgeText: string;
  accentCountBg: string;
  subclassBadgeBg: string;
  subclassBadgeText: string;
  subclassChipBg: string;
  subclassChipActiveBg: string;
  subclassChipActiveText: string;
  subclassChipActiveBorder: string;
  warningBg: string;
  warningBorder: string;
  warningAccent: string;
  warningText: string;
  statusBar: string;
};

export const lightTheme: Theme = {
  bg: "#F4F6F9",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  border: "#E4E9EF",
  borderMid: "#CBD5E1",
  textPrimary: "#0F172A",
  textSecondary: "#64748B",
  textDisabled: "#94A3B8",
  accent: "#1A73D4",
  accentBg: "#EFF6FF",
  accentBorder: "#BFDBFE",
  accentText: "#1E40AF",
  accentBadgeBg: "#DBEAFE",
  accentBadgeText: "#1D4ED8",
  accentCountBg: "#BFDBFE",
  subclassBadgeBg: "#CCFBF1",
  subclassBadgeText: "#0F766E",
  subclassChipBg: "#F0FDFA",
  subclassChipActiveBg: "#CCFBF1",
  subclassChipActiveText: "#0F766E",
  subclassChipActiveBorder: "#5EEAD4",
  warningBg: "#FFFBEB",
  warningBorder: "#FCD34D",
  warningAccent: "#F59E0B",
  warningText: "#92400E",
  statusBar: "dark",
};

export const darkTheme: Theme = {
  bg: "#0F172A",
  surface: "#1E293B",
  surfaceAlt: "#162032",
  border: "#2D3F55",
  borderMid: "#334155",
  textPrimary: "#F1F5F9",
  textSecondary: "#94A3B8",
  textDisabled: "#64748B",
  accent: "#1A73D4",
  accentBg: "#1E3A5F",
  accentBorder: "#1E40AF",
  accentText: "#93C5FD",
  accentBadgeBg: "#1E3A5F",
  accentBadgeText: "#93C5FD",
  accentCountBg: "#1E3A5F",
  subclassBadgeBg: "#134E4A",
  subclassBadgeText: "#2DD4BF",
  subclassChipBg: "#0F2927",
  subclassChipActiveBg: "#134E4A",
  subclassChipActiveText: "#2DD4BF",
  subclassChipActiveBorder: "#0D9488",
  warningBg: "#1C1506",
  warningBorder: "#78350F",
  warningAccent: "#F59E0B",
  warningText: "#FCD34D",
  statusBar: "light",
};

// ─── ThemeContext ─────────────────────────────────────────────────────────────

const ThemeContext = createContext<Theme>(lightTheme);

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

// ─── makeStyles ───────────────────────────────────────────────────────────────

function makeStyles(theme: Theme) {
  return StyleSheet.create({
    // ─── Layout ──────────────────────────────────────────────────────────
    safeArea: {
      flex: 1,
      backgroundColor: theme.surface,
    },
    stackRoot: {
      flex: 1,
      overflow: "hidden",
    },
    stackLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    container: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    mainContent: {
      flex: 1,
    },
    flex1: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
      backgroundColor: theme.bg,
    },
    screenContent: {
      flexGrow: 1,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },

    // ─── Top Bar ─────────────────────────────────────────────────────────
    topBar: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
      gap: 12,
    },
    titleBlock: {
      flex: 1,
    },
    title: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: "700",
    },
    languageButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderColor: theme.borderMid,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.surface,
    },
    languageButtonText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },

    // ─── Bottom Tab Bar ───────────────────────────────────────────────────
    footer: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    topLevelTabs: {
      flexDirection: "row",
      height: 56,
    },
    topLevelTab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    topLevelTabText: {
      color: theme.textDisabled,
      fontSize: 11,
      fontWeight: "600",
    },
    topLevelTabTextSelected: {
      color: theme.accent,
    },

    // ─── Screen Headers ───────────────────────────────────────────────────
    searchHeader: {
      gap: 4,
    },
    screenTitle: {
      color: theme.textPrimary,
      fontSize: 20,
      fontWeight: "700",
    },
    screenSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },

    searchStickyHeader: {
      backgroundColor: theme.bg,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },

    // ─── Search Input ─────────────────────────────────────────────────────
    searchInputWrap: {
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
    searchIcon: {
      flexShrink: 0,
    },
    searchInput: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      paddingVertical: 0,
    },
    searchClear: {
      flexShrink: 0,
    },
    resultCount: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
      marginBottom: -4,
    },

    // ─── Recent searches ─────────────────────────────────────────────────
    categorySection: {
      gap: 10,
    },
    horizontalChipScroll: {
      marginHorizontal: -16,
    },
    horizontalChipList: {
      gap: 8,
      paddingHorizontal: 16,
    },
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
    categoryChipCount: {
      backgroundColor: theme.border,
      borderRadius: 999,
      minWidth: 20,
      height: 20,
      paddingHorizontal: 5,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryChipCountActive: {
      backgroundColor: theme.accentCountBg,
    },
    categoryChipCountText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    categoryChipCountTextActive: {
      color: theme.accentBadgeText,
    },
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
    subclassChipCountActive: {
      backgroundColor: theme.subclassBadgeBg,
    },
    subclassChipCountText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
    },
    subclassChipCountTextActive: {
      color: theme.subclassBadgeText,
    },
    recentSection: {
      gap: 10,
    },
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

    // ─── Result Cards ─────────────────────────────────────────────────────
    resultsList: {
      gap: 10,
    },
    resultCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    resultCardPressed: {
      opacity: 0.95,
    },
    resultHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
    },
    resultTitleColumn: {
      flex: 1,
      gap: 4,
    },
    resultNameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },
    resultName: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      flexShrink: 1,
    },
    classBadge: {
      backgroundColor: theme.accentBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    classBadgeText: {
      color: theme.accentBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    subclassBadge: {
      backgroundColor: theme.subclassBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      alignSelf: "flex-start",
    },
    subclassBadgeText: {
      color: theme.subclassBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    resultAlias: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    matchHint: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "600",
    },
    resultActions: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    heartButton: {
      padding: 2,
    },

    // ─── Empty States ─────────────────────────────────────────────────────
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
    emptyIcon: {
      marginBottom: 4,
    },
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
    neutralEmptyCard: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 12,
      padding: 16,
      gap: 6,
      borderWidth: 1,
      borderColor: theme.border,
    },
    neutralEmptyTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
    neutralEmptyBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
      textAlign: "center",
    },
    favoritesEmptyState: {
      alignItems: "center",
      gap: 12,
      paddingVertical: 32,
    },

    // ─── Panels ───────────────────────────────────────────────────────────
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
    panelBody: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 22,
    },
    panelHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
    },
    panelHeaderLabel: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    sectionTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },

    // ─── Compliance ───────────────────────────────────────────────────────
    complianceBanner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      backgroundColor: theme.accentBg,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    complianceBannerText: {
      flex: 1,
      color: theme.accentText,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "500",
    },
    complianceCard: {
      backgroundColor: theme.accentBg,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      gap: 8,
    },
    complianceBadgeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    complianceBadge: {
      color: theme.accentText,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    complianceTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    complianceBody: {
      color: theme.accentText,
      fontSize: 14,
      lineHeight: 20,
    },

    // ─── Info Screen ──────────────────────────────────────────────────────
    infoAppCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      gap: 14,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    infoAppIcon: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    infoAppIconText: {
      color: "#FFFFFF",
      fontSize: 26,
      fontWeight: "800",
    },
    infoAppMeta: {
      flex: 1,
      gap: 2,
    },
    infoAppName: {
      color: theme.textPrimary,
      fontSize: 18,
      fontWeight: "700",
    },
    infoAppVersion: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    infoMetaCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    infoMetaHeader: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 8,
    },
    infoMetaRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 13,
      gap: 16,
    },
    infoMetaRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    infoMetaLabel: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "500",
    },
    infoMetaValue: {
      color: theme.textSecondary,
      fontSize: 14,
      textAlign: "right",
      flexShrink: 1,
    },

    // ─── Detail Screen ────────────────────────────────────────────────────
    detailNavHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.bg,
      gap: 8,
    },
    backButton: {
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
      flexShrink: 0,
    },
    detailNavTitle: {
      flex: 1,
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
      textAlign: "center",
    },
    detailNavAction: {
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
      flexShrink: 0,
    },
    detailHeader: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      padding: 16,
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    detailHeaderMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    detailClassBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.accentBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    detailClassBadgeText: {
      color: theme.accentBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    detailSubclassBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.subclassBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    detailSubclassBadgeText: {
      color: theme.subclassBadgeText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    detailIdBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    detailIdBadgeText: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "600",
    },
    detailTitle: {
      color: theme.textPrimary,
      fontSize: 24,
      fontWeight: "800",
      lineHeight: 30,
    },
    detailSubtitle: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },

    // ─── Segmented Control ────────────────────────────────────────────────
    segmentedControl: {
      flexDirection: "row",
      backgroundColor: theme.border,
      borderRadius: 10,
      padding: 3,
      gap: 2,
    },
    segmentButton: {
      flex: 1,
      borderRadius: 8,
      paddingVertical: 9,
      alignItems: "center",
    },
    segmentButtonSelected: {
      backgroundColor: theme.surface,
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 2,
    },
    segmentButtonDisabled: {
      opacity: 0.4,
    },
    segmentButtonText: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
    segmentButtonTextSelected: {
      color: theme.textPrimary,
      fontWeight: "700",
    },
    segmentButtonTextDisabled: {
      color: theme.textDisabled,
    },

    // ─── Warning Panel ────────────────────────────────────────────────────
    warningPanel: {
      backgroundColor: theme.warningBg,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: theme.warningAccent,
      gap: 10,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    warningPanelHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    warningTitle: {
      color: theme.warningText,
      fontSize: 15,
      fontWeight: "700",
    },
    warningText: {
      color: theme.warningText,
      fontSize: 14,
      lineHeight: 20,
    },

    // ─── Metric Cards ─────────────────────────────────────────────────────
    metricGrid: {
      gap: 10,
    },
    metricCard: {
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.border,
    },
    metricCardCompact: {
      gap: 4,
    },
    metricLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    metricValue: {
      color: theme.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    metricValueSmall: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "700",
    },

    // ─── Notes ────────────────────────────────────────────────────────────
    notesBlock: {
      gap: 8,
    },
    noteRow: {
      gap: 8,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    noteRowWarning: {
      backgroundColor: theme.warningBg,
      borderColor: theme.warningBorder,
      borderLeftWidth: 3,
      borderLeftColor: theme.warningAccent,
    },
    noteBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    noteBadgeWarning: {
      backgroundColor: theme.warningBorder,
    },
    noteBadgeText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    noteBadgeTextWarning: {
      color: theme.warningText,
    },
    noteText: {
      color: theme.textPrimary,
      fontSize: 14,
      lineHeight: 22,
    },

    // ─── Dilution Calculator ──────────────────────────────────────────────
    calculatorToggle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    calculatorToggleLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    calculatorRow: {
      gap: 12,
    },
    calculatorField: {
      gap: 6,
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
    calculatorResults: {
      gap: 10,
    },
    calculatorCard: {
      gap: 4,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    calculatorRatio: {
      color: theme.textPrimary,
      fontSize: 16,
      fontWeight: "800",
    },
    calculatorMeta: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 20,
    },
    emptyState: {
      color: theme.textSecondary,
      fontSize: 14,
      lineHeight: 20,
    },

    // ─── Source / References ──────────────────────────────────────────────
    sourceSummaryCard: {
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sourceToggle: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    },
    sourceToggleLabel: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "700",
    },
    sourceStack: {
      gap: 10,
    },
    sourceBreakdownTable: {
      marginTop: 10,
      gap: 6,
    },
    sourceBreakdownHeading: {
      color: theme.warningText,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.6,
      marginBottom: 2,
    },
    sourceBreakdownRow: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      alignItems: "center" as const,
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    sourceBreakdownLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      flex: 1,
    },
    sourceBreakdownLabelPreferred: {
      color: theme.textPrimary,
      fontWeight: "600",
    },
    sourceBreakdownValue: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "500",
    },
    sourceBreakdownValuePreferred: {
      color: theme.textPrimary,
      fontWeight: "700",
    },
    sourceCard: {
      gap: 6,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sourceEyebrow: {
      color: theme.accent,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    sourceTitle: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
    },
    sourceMeta: {
      color: theme.textSecondary,
      fontSize: 13,
    },
    sourceLabel: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    sourceExcerpt: {
      color: theme.textPrimary,
      fontSize: 13,
      lineHeight: 20,
    },
    sourceLinkRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 8,
      alignSelf: "flex-start",
    },
    sourceLink: {
      color: theme.accent,
      fontSize: 13,
      textDecorationLine: "underline",
    },

    // ─── Cross-Reactivity ─────────────────────────────────────────────────
    crossReactivityGroup: {
      gap: 10,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    crossReactivityGroupName: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
    },
    crossReactivityEntry: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 6,
    },
    crossReactivityEntryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    crossReactivityDrugName: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    crossReactivityDrugNameInert: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    crossReactivityBadgeRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    crossReactivityTierBadgeHigher: {
      alignSelf: "flex-start",
      backgroundColor: theme.warningBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.warningBorder,
    },
    crossReactivityTierTextHigher: {
      color: theme.warningText,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crossReactivityTierBadgeLower: {
      alignSelf: "flex-start",
      backgroundColor: theme.subclassBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    crossReactivityTierTextLower: {
      color: theme.subclassBadgeText,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crossReactivityTierBadgeUncertain: {
      alignSelf: "flex-start",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    crossReactivityTierTextUncertain: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crossReactivityStructBadge: {
      alignSelf: "flex-start",
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    crossReactivityStructBadgeText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    crossReactivityRationale: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      fontStyle: "italic",
    },
    crossReactivitySourceCitation: {
      color: theme.textDisabled,
      fontSize: 11,
    },
    crossReactivityNotInDataset: {
      color: theme.textDisabled,
      fontSize: 11,
      fontStyle: "italic",
    },
    crossReactivityPanelContainer: {
      backgroundColor: theme.accentBg,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      gap: 8,
    },
    crossReactivityPanelTitle: {
      color: theme.accentText,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    crossReactivityPanelBody: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
    },
    crossReactivityPanelChipList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    crossReactivityPanelChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surface,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: theme.accentBorder,
    },
    crossReactivityPanelChipText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: "600",
    },
    crossReactivityPanelChipTextInert: {
      color: theme.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },
  });
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TAB_ORDER: TestKind[] = ["prick", "idr", "patch"];
const HOME_TABS = ["search", "favorites", "info"] as const;
const DARK_MODE_STORAGE_KEY = "@allergolib/dark-mode";

type HomeTab = (typeof HOME_TABS)[number];
type DetailMetricItem = {
  label: string;
  value: string;
  compact?: boolean;
};

function homeTabIconName(tab: HomeTab, selected: boolean): React.ComponentProps<typeof Ionicons>["name"] {
  if (tab === "favorites") return selected ? "heart" : "heart-outline";
  if (tab === "info") return selected ? "information-circle" : "information-circle-outline";
  return selected ? "search" : "search-outline";
}

function hasDisplayableTestContent(test: TestRecord) {
  return (
    test.sourceEntries.some((e) => e.concentration || e.maxConcentration) ||
    test.dilutions.length > 0 ||
    Boolean(test.vehicle) ||
    test.notes.length > 0
  );
}

function isTestAvailable(drug: DrugRecord, kind: TestKind) {
  return hasDisplayableTestContent(drug.tests[kind]);
}

function availableTests(drug: DrugRecord) {
  return TAB_ORDER.filter((kind) => isTestAvailable(drug, kind));
}

function concentrationLabel(language: Language, kind: TestKind) {
  if (kind === "idr") {
    return copy(language, "detail.idr.maxConcentration");
  }

  return copy(language, "detail.concentration");
}

function testTitle(language: Language, kind: TestKind) {
  return copy(language, `tests.${kind}`);
}

function datasetOriginLabelKey(origin: DatasetOrigin) {
  if (origin === "bundled") {
    return "home.datasetOriginBundled";
  }

  return "home.datasetOriginUpdated";
}

function homeTabLabelKey(tab: HomeTab) {
  if (tab === "favorites") {
    return "home.tabFavorites";
  }

  if (tab === "info") {
    return "home.tabInfo";
  }

  return "home.tabSearch";
}

function matchLabel(language: Language, result: DrugSearchResult) {
  if (result.matchedField === "alias") {
    return copy(language, "search.matchAlias");
  }

  if (result.matchedField === "class") {
    return copy(language, "search.matchClass");
  }

  if (result.matchedField === "id") {
    return copy(language, "search.matchId");
  }

  if (result.matchedField === "name") {
    return copy(language, "search.matchName");
  }

  return null;
}

function noteLabel(language: Language, kind: NoteKind) {
  if (kind === "cross-reactivity") {
    return copy(language, "detail.note.cross-reactivity");
  }

  if (kind === "warning") {
    return copy(language, "detail.note.warning");
  }

  return copy(language, "detail.note.info");
}

function formatNumber(value: number, language: Language) {
  return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
    maximumFractionDigits: 3,
  }).format(Math.round((value + Number.EPSILON) * 1000) / 1000);
}

function parsePositiveNumber(value: string) {
  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function arraysEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function splitNotes(notes: TestNote[]) {
  return {
    warnings: notes.filter((note) => note.kind === "warning"),
    supporting: notes.filter((note) => note.kind !== "warning"),
  };
}

function hasSourceDocumentContent(source: SourceDocument | undefined) {
  return Boolean(
    source?.label &&
      source.organization &&
      source.year &&
      source.version &&
      source.documentName.en &&
      source.documentName.fr &&
      source.excerpt.en &&
      source.excerpt.fr
  );
}

function hasTestProvenance(
  test: TestRecord,
  sources: Record<string, SourceDocument>
) {
  if (!hasDisplayableTestContent(test)) {
    return true;
  }

  const preferred = test.sourceEntries.find((e) => e.isPreferred);
  return hasSourceDocumentContent(preferred ? sources[preferred.sourceId] : undefined);
}

function formatReleaseDate(value: string, language: Language) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "fr" ? "fr-FR" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}

function AppLogo({ theme }: { theme: Theme }) {
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
      {/* Icon mark */}
      <View style={logoStyles.mark}>
        {/* Outer hexagonal shield built from a rotated square + pseudo-circle overlay */}
        <View style={logoStyles.shield}>
          {/* Cross — vertical bar */}
          <View style={logoStyles.crossV} />
          {/* Cross — horizontal bar */}
          <View style={logoStyles.crossH} />
          {/* Small dot accent bottom-right */}
          <View style={logoStyles.dot} />
        </View>
      </View>
      {/* Wordmark */}
      <View style={logoStyles.wordmark}>
        <Text style={logoStyles.wordPrimary}>Allergo</Text>
        <Text style={logoStyles.wordAccent}>lib</Text>
      </View>
    </View>
  );
}

// Slim blue compliance banner shown on non-Info screens
function ComplianceBanner({ language }: { language: Language }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.complianceBanner}>
      <Ionicons name="shield-checkmark-outline" size={14} color={theme.accentText} style={{ marginTop: 1 }} />
      <Text style={styles.complianceBannerText}>{copy(language, "compliance.badge")} — {copy(language, "compliance.title")}</Text>
    </View>
  );
}

// Full compliance card used on InfoScreen
function ComplianceCard({ language }: { language: Language }) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.complianceCard}>
      <View style={styles.complianceBadgeRow}>
        <Ionicons name="shield-checkmark-outline" size={14} color={theme.accentText} />
        <Text style={styles.complianceBadge}>{copy(language, "compliance.badge")}</Text>
      </View>
      <Text style={styles.complianceTitle}>{copy(language, "compliance.title")}</Text>
      <Text style={styles.complianceBody}>{copy(language, "compliance.body")}</Text>
    </View>
  );
}

function DrugRow({
  language,
  result,
  isSaved,
  onPress,
  onToggleFavorite,
}: {
  language: Language;
  result: DrugSearchResult;
  isSaved: boolean;
  onPress: () => void;
  onToggleFavorite?: () => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const matchCopy = matchLabel(language, result);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.resultCard, pressed && styles.resultCardPressed]}
    >
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleColumn}>
          <View style={styles.resultNameRow}>
            <Text style={styles.resultName} numberOfLines={1}>{result.drug.name[language]}</Text>
            <View style={styles.classBadge}>
              <Text style={styles.classBadgeText}>{result.drug.className[language]}</Text>
            </View>
            {result.drug.subclassName ? (
              <View style={styles.subclassBadge}>
                <Text style={styles.subclassBadgeText}>{result.drug.subclassName[language]}</Text>
              </View>
            ) : null}
          </View>
          {result.drug.aliases.length > 0 ? (
            <Text style={styles.resultAlias} numberOfLines={1}>
              {result.drug.aliases.join(", ")}
            </Text>
          ) : null}
          {matchCopy && result.matchedText ? (
            <Text style={styles.matchHint}>
              {matchCopy}: {result.matchedText}
            </Text>
          ) : null}
        </View>
        <View style={styles.resultActions}>
          {onToggleFavorite ? (
            <Pressable
              onPress={(e) => { e.stopPropagation(); onToggleFavorite(); }}
              hitSlop={8}
              style={styles.heartButton}
            >
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={20}
                color={isSaved ? theme.accent : theme.textDisabled}
              />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color={theme.borderMid} />
        </View>
      </View>
    </Pressable>
  );
}

function NeutralEmptyCard({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.neutralEmptyCard}>
      <Text style={styles.neutralEmptyTitle}>{title}</Text>
      <Text style={styles.neutralEmptyBody}>{body}</Text>
    </View>
  );
}

function SearchScreen({
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
  const [recentCollapsed, setRecentCollapsed] = useState(true);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(true);
  const favoriteDrugSet = new Set(favoriteDrugIds);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  // Derive sorted unique class names from the full drug list
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

  // Derive sorted unique subclass names for the active class (empty when no subclasses exist)
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

  // Drugs shown in browse mode (no text query): filtered by class + subclass or all, sorted A→Z
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
      {/* ── Sticky header ── */}
      <View style={styles.searchStickyHeader}>
        {/* Recent searches — visible when no query is active */}
        {!hasQuery && recentDrugs.length > 0 ? (
          <View style={styles.recentSection}>
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
                contentContainerStyle={styles.horizontalChipList}
                style={styles.horizontalChipScroll}
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
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={18} color={theme.textSecondary} style={styles.searchIcon} />
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={(v) => { onChangeQuery(v); setActiveClass(null); }}
            placeholder={copy(language, "search.placeholder")}
            placeholderTextColor={theme.textDisabled}
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => onChangeQuery("")} hitSlop={8} style={styles.searchClear}>
              <Ionicons name="close-circle" size={18} color={theme.textDisabled} />
            </Pressable>
          ) : null}
        </View>

        {/* Category chips */}
        <View style={styles.categorySection}>
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
                contentContainerStyle={styles.horizontalChipList}
                style={styles.horizontalChipScroll}
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  onPress={() => { setActiveClass(null); setActiveSubclass(null); }}
                  style={[styles.categoryChip, activeClass === null && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, activeClass === null && styles.categoryChipTextActive]}>
                    {copy(language, "search.categoryAll")}
                  </Text>
                  <View style={[styles.categoryChipCount, activeClass === null && styles.categoryChipCountActive]}>
                    <Text style={[styles.categoryChipCountText, activeClass === null && styles.categoryChipCountTextActive]}>
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
                      <View style={[styles.categoryChipCount, active && styles.categoryChipCountActive]}>
                        <Text style={[styles.categoryChipCountText, active && styles.categoryChipCountTextActive]}>
                          {count}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Subclass chips — only when the active class has subcategories */}
              {subclasses.length > 0 ? (
                <View style={styles.categorySection}>
                  <Text style={styles.sectionLabel}>{copy(language, "search.subcategories")}</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalChipList}
                    style={styles.horizontalChipScroll}
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

      {/* ── Scrollable results ── */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.screenContent}
        keyboardShouldPersistTaps="handled"
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

        <ComplianceBanner language={language} />
      </ScrollView>
    </View>
  );
}

function FavoritesScreen({
  language,
  favoriteDrugs,
  favoriteDrugIds,
  onOpenDrug,
  onToggleFavorite,
}: {
  language: Language;
  favoriteDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onOpenDrug: (drugId: string) => void;
  onToggleFavorite: (drugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.screenContent}>
      <View style={styles.searchHeader}>
        <Text style={styles.screenTitle}>{copy(language, "favorites.title")}</Text>
        <Text style={styles.screenSubtitle}>{copy(language, "favorites.body")}</Text>
      </View>

      {favoriteDrugs.length ? (
        <View style={styles.resultsList}>
          {favoriteDrugs.map((drug) => (
            <DrugRow
              key={`favorite-${drug.id}`}
              isSaved={favoriteDrugIds.includes(drug.id)}
              language={language}
              onPress={() => onOpenDrug(drug.id)}
              onToggleFavorite={() => onToggleFavorite(drug.id)}
              result={{
                drug,
                score: Number.MAX_SAFE_INTEGER,
              }}
            />
          ))}
        </View>
      ) : (
        <View style={styles.favoritesEmptyState}>
          <Ionicons name="heart-outline" size={56} color={theme.borderMid} />
          <Text style={styles.neutralEmptyTitle}>{copy(language, "favorites.emptyTitle")}</Text>
          <Text style={styles.neutralEmptyBody}>{copy(language, "favorites.emptyBody")}</Text>
        </View>
      )}

      <ComplianceBanner language={language} />
    </ScrollView>
  );
}

function InfoScreen({
  activeDataset,
  language,
}: {
  activeDataset: ReturnType<typeof getBundledActiveDataset>;
  language: Language;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const rows = [
    {
      label: copy(language, "home.release"),
      value: activeDataset.manifest.version,
    },
    {
      label: copy(language, "home.datasetOrigin"),
      value: copy(language, datasetOriginLabelKey(activeDataset.origin)),
    },
    {
      label: copy(language, "home.approvedBy"),
      value: activeDataset.manifest.approvedBy,
    },
    {
      label: copy(language, "home.releasedAt"),
      value: formatReleaseDate(activeDataset.manifest.releasedAt, language),
    },
  ];

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.screenContent}>
      <View style={styles.infoAppCard}>
        <View style={styles.infoAppIcon}>
          <Text style={styles.infoAppIconText}>A</Text>
        </View>
        <View style={styles.infoAppMeta}>
          <Text style={styles.infoAppName}>{copy(language, "home.heroTitle")}</Text>
          <Text style={styles.infoAppVersion}>{copy(language, "info.releaseCardTitle")} {activeDataset.manifest.version}</Text>
        </View>
      </View>

      <View style={styles.infoMetaCard}>
        <Text style={styles.infoMetaHeader}>{copy(language, "info.title")}</Text>
        {rows.map((row, index) => (
          <View key={row.label} style={[styles.infoMetaRow, index < rows.length - 1 && styles.infoMetaRowBorder]}>
            <Text style={styles.infoMetaLabel}>{row.label}</Text>
            <Text style={styles.infoMetaValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <ComplianceCard language={language} />
    </ScrollView>
  );
}

function SourceCard({
  source,
  language,
  eyebrow,
}: {
  source: SourceDocument;
  language: Language;
  eyebrow: string;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.sourceCard}>
      <Text style={styles.sourceEyebrow}>{eyebrow}</Text>
      <Text style={styles.sourceTitle}>{source.label}</Text>
      <Text style={styles.sourceMeta}>
        {source.organization} {source.year} • {source.version} • {source.status}
      </Text>
      <Text style={styles.sourceMeta}>{source.documentName[language]}</Text>
      <Text style={styles.sourceExcerpt}>{source.excerpt[language]}</Text>
      {source.url ? (
        <Pressable
          style={styles.sourceLinkRow}
          onPress={() => Linking.openURL(source.url!)}
          hitSlop={8}
        >
          <Ionicons name="open-outline" size={14} color={theme.accent} />
          <Text style={styles.sourceLink}>
            {language === "fr" ? "Voir le document source" : "View source document"}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function NoteList({
  language,
  notes,
  tone = "default",
}: {
  language: Language;
  notes: TestNote[];
  tone?: "default" | "warning";
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.notesBlock}>
      {notes.map((note, index) => (
        <View
          key={`${note.kind}-${note.value.en}-${note.value.fr}-${index}`}
          style={[styles.noteRow, tone === "warning" && styles.noteRowWarning]}
        >
          <View style={[styles.noteBadge, tone === "warning" && styles.noteBadgeWarning]}>
            <Text style={[styles.noteBadgeText, tone === "warning" && styles.noteBadgeTextWarning]}>
              {noteLabel(language, note.kind)}
            </Text>
          </View>
          <Text style={styles.noteText}>{note.value[language]}</Text>
        </View>
      ))}
    </View>
  );
}

function DilutionCalculator({
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
  const [expanded, setExpanded] = useState(false);
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
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.calculatorToggle}>
        <View style={styles.calculatorToggleLeft}>
          <Ionicons name="calculator-outline" size={18} color={theme.accent} />
          <Text style={styles.sectionTitle}>{copy(language, "detail.calculatorTitle")}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={theme.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <>
          <Text style={styles.panelBody}>{copy(language, "detail.calculatorBody")}</Text>

          <View style={styles.calculatorRow}>
            <View style={styles.calculatorField}>
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

            <View style={styles.calculatorField}>
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
            <View style={styles.calculatorResults}>
              {plans.map((plan) => (
                <View key={plan.ratio} style={styles.calculatorCard}>
                  <Text style={styles.calculatorRatio}>{plan.ratio}</Text>
                  <Text style={styles.calculatorMeta}>
                    {copy(language, "detail.calculatorTarget")}:{" "}
                    {formatNumber(plan.targetConcentration, language)}
                    {concentrationUnit ? ` ${concentrationUnit}` : ""}
                  </Text>
                  <Text style={styles.calculatorMeta}>
                    {copy(language, "detail.calculatorDirect")}:{" "}
                    {formatNumber(plan.stockVolumeMl, language)} mL +{" "}
                    {formatNumber(plan.diluentVolumeMl, language)} mL diluent
                  </Text>
                  {plan.stepUpFromRatio &&
                  plan.stepUpStockVolumeMl !== undefined &&
                  plan.stepUpDiluentVolumeMl !== undefined ? (
                    <Text style={styles.calculatorMeta}>
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
        </>
      ) : null}
    </View>
  );
}

function CrossReactivitySection({
  drug,
  language,
  allDrugs,
  sources,
  onOpenDrug,
}: {
  drug: DrugRecord;
  language: Language;
  allDrugs: DrugRecord[];
  sources: Record<string, SourceDocument>;
  onOpenDrug: (drugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (!drug.crossReactivity || drug.crossReactivity.length === 0) {
    return null;
  }

  const drugNameById: Record<string, { en: string; fr: string }> = {};
  for (const d of allDrugs) {
    drugNameById[d.id] = d.name;
  }

  function tierBadgeStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.crossReactivityTierBadgeHigher;
      case "lower-expected": return styles.crossReactivityTierBadgeLower;
      case "uncertain": return styles.crossReactivityTierBadgeUncertain;
    }
  }

  function tierTextStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.crossReactivityTierTextHigher;
      case "lower-expected": return styles.crossReactivityTierTextLower;
      case "uncertain": return styles.crossReactivityTierTextUncertain;
    }
  }

  function tierLabel(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return copy(language, "crossReactivity.tierHigher");
      case "lower-expected": return copy(language, "crossReactivity.tierLower");
      case "uncertain": return copy(language, "crossReactivity.tierUncertain");
    }
  }

  function structuralLabel(rel: StructuralRelation) {
    switch (rel) {
      case "structurally-related": return copy(language, "crossReactivity.structurallyRelated");
      case "structurally-distinct": return copy(language, "crossReactivity.structurallyDistinct");
    }
  }

  return (
    <View style={styles.panel}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Ionicons name="git-network-outline" size={18} color={theme.accent} />
        <Text style={styles.sectionTitle}>
          {copy(language, "crossReactivity.sectionTitle")}
        </Text>
      </View>
      <Text style={styles.panelBody}>
        {copy(language, "crossReactivity.sectionBody")}
      </Text>

      {drug.crossReactivity.map((group, gi) => (
        <View key={`crg-${gi}`} style={styles.crossReactivityGroup}>
          <Text style={styles.crossReactivityGroupName}>{group.groupName[language]}</Text>

          {group.entries.map((entry, ei) => {
            const name = drugNameById[entry.drugId];
            const isNavigable = Boolean(name);
            const sourceCitations = entry.sourceIds
              .map((sid) => sources[sid]?.label)
              .filter(Boolean);

            return (
              <Pressable
                key={`cre-${ei}`}
                style={styles.crossReactivityEntry}
                onPress={isNavigable ? () => onOpenDrug(entry.drugId) : undefined}
                disabled={!isNavigable}
              >
                <View style={styles.crossReactivityEntryHeader}>
                  <Text style={isNavigable ? styles.crossReactivityDrugName : styles.crossReactivityDrugNameInert}>
                    {name ? name[language] : entry.drugId}
                  </Text>
                  {isNavigable ? (
                    <Ionicons name="chevron-forward" size={14} color={theme.accent} />
                  ) : (
                    <Text style={styles.crossReactivityNotInDataset}>
                      {copy(language, "crossReactivity.drugNotInDataset")}
                    </Text>
                  )}
                </View>
                <View style={styles.crossReactivityBadgeRow}>
                  <View style={tierBadgeStyle(entry.tier)}>
                    <Text style={tierTextStyle(entry.tier)}>{tierLabel(entry.tier)}</Text>
                  </View>
                  <View style={styles.crossReactivityStructBadge}>
                    <Text style={styles.crossReactivityStructBadgeText}>
                      {structuralLabel(entry.structuralRelation)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.crossReactivityRationale}>{entry.rationale[language]}</Text>
                {sourceCitations.length > 0 ? (
                  <Text style={styles.crossReactivitySourceCitation}>
                    {copy(language, "crossReactivity.source")}: {sourceCitations.join(", ")}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}

          {group.suggestedPanel.length > 0 ? (
            <View style={styles.crossReactivityPanelContainer}>
              <Text style={styles.crossReactivityPanelTitle}>
                {copy(language, "crossReactivity.panelTitle")}
              </Text>
              {group.panelRationale ? (
                <Text style={styles.crossReactivityPanelBody}>
                  {group.panelRationale[language]}
                </Text>
              ) : (
                <Text style={styles.crossReactivityPanelBody}>
                  {copy(language, "crossReactivity.panelBody")}
                </Text>
              )}
              <View style={styles.crossReactivityPanelChipList}>
                {group.suggestedPanel.map((panelDrugId) => {
                  const pName = drugNameById[panelDrugId];
                  const pNavigable = Boolean(pName);
                  return (
                    <Pressable
                      key={panelDrugId}
                      style={styles.crossReactivityPanelChip}
                      onPress={pNavigable ? () => onOpenDrug(panelDrugId) : undefined}
                      disabled={!pNavigable}
                    >
                      <Text style={pNavigable ? styles.crossReactivityPanelChipText : styles.crossReactivityPanelChipTextInert}>
                        {pName ? pName[language] : panelDrugId}
                      </Text>
                      {pNavigable ? (
                        <Ionicons name="chevron-forward" size={12} color={theme.accent} />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function DetailScreen({
  drug,
  language,
  sources,
  allDrugs,
  isSaved,
  onBack,
  onToggleFavorite,
  onOpenDrug,
}: {
  drug: DrugRecord;
  language: Language;
  sources: Record<string, SourceDocument>;
  allDrugs: DrugRecord[];
  isSaved: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
  onOpenDrug: (drugId: string) => void;
}) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<TestKind>(availableTests(drug)[0] ?? "prick");
  const [showSource, setShowSource] = useState(false);
  const availableTestKinds = availableTests(drug);

  useEffect(() => {
    const nextAvailableTests = availableTests(drug);

    if (!nextAvailableTests.includes(activeTab)) {
      setActiveTab(nextAvailableTests[0] ?? "prick");
    }
  }, [activeTab, drug]);

  useEffect(() => {
    setShowSource(false);
  }, [drug.id, activeTab]);

  const test = drug.tests[activeTab];
  const canShowProvenance = hasTestProvenance(test, sources);
  const preferredEntry = test.sourceEntries.find((e) => e.isPreferred);
  const nonPreferredEntries = test.sourceEntries.filter((e) => !e.isPreferred);
  const preferredSource = canShowProvenance && preferredEntry ? sources[preferredEntry.sourceId] : undefined;
  const { warnings, supporting } = splitNotes(test.notes);
  const concentrationUnit = extractConcentrationUnit(
    preferredEntry?.maxConcentration ?? preferredEntry?.concentration
  );
  const shouldShowStandardConcentration =
    Boolean(preferredEntry?.concentration) &&
    (activeTab !== "idr" || preferredEntry?.concentration !== preferredEntry?.maxConcentration);
  const sourcesDisagree = nonPreferredEntries.some(
    (e) => e.concentration && e.concentration !== preferredEntry?.concentration
  );
  const metricItems: DetailMetricItem[] = [];

  if (shouldShowStandardConcentration) {
    metricItems.push({
      label: concentrationLabel(language, activeTab),
      value: preferredEntry?.concentration ?? "",
    });
  }

  if (preferredEntry?.maxConcentration) {
    metricItems.push({
      label: copy(language, "detail.idr.maxConcentration"),
      value: preferredEntry.maxConcentration,
    });
  }

  if (test.dilutions.length) {
    metricItems.push({
      label: copy(language, "detail.idr.dilutions"),
      value: test.dilutions.join(" → "),
      compact: true,
    });
  }

  if (test.vehicle) {
    metricItems.push({
      label: copy(language, "detail.patch.vehicle"),
      value: test.vehicle[language],
      compact: true,
    });
  }

  return (
    <View style={styles.flex1}>
      {/* Sticky nav header */}
      <View style={styles.detailNavHeader}>
        <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="arrow-back" size={20} color={theme.textPrimary} />
        </Pressable>
        <Text style={styles.detailNavTitle} numberOfLines={1}>{drug.name[language]}</Text>
        <Pressable onPress={onToggleFavorite} style={styles.detailNavAction} hitSlop={8}>
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={22}
            color={isSaved ? theme.accent : theme.textSecondary}
          />
        </Pressable>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.screenContent}>
        {/* Drug header card */}
        <View style={styles.detailHeader}>
          <View style={styles.detailHeaderMetaRow}>
            <View style={styles.detailClassBadge}>
              <Text style={styles.detailClassBadgeText}>{drug.className[language]}</Text>
            </View>
            {drug.subclassName ? (
              <View style={styles.detailSubclassBadge}>
                <Text style={styles.detailSubclassBadgeText}>{drug.subclassName[language]}</Text>
              </View>
            ) : null}
            <View style={styles.detailIdBadge}>
              <Text style={styles.detailIdBadgeText}>{drug.id}</Text>
            </View>
          </View>
          <Text style={styles.detailTitle}>{drug.name[language]}</Text>
          {drug.aliases.length > 0 ? (
            <Text style={styles.detailSubtitle}>{drug.aliases.join(", ")}</Text>
          ) : null}
        </View>

        {/* Segmented control for test types */}
        {availableTestKinds.length > 1 ? (
          <View style={styles.segmentedControl}>
            {TAB_ORDER.map((kind) => {
              const selected = kind === activeTab;
              const disabled = !isTestAvailable(drug, kind);

              return (
                <Pressable
                  key={kind}
                  disabled={disabled}
                  onPress={() => setActiveTab(kind)}
                  style={[
                    styles.segmentButton,
                    selected && styles.segmentButtonSelected,
                    disabled && styles.segmentButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentButtonText,
                      selected && styles.segmentButtonTextSelected,
                      disabled && styles.segmentButtonTextDisabled,
                    ]}
                  >
                    {testTitle(language, kind)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {!canShowProvenance ? (
          <View style={styles.warningPanel}>
            <View style={styles.warningPanelHeader}>
              <Ionicons name="warning-outline" size={18} color={theme.warningText} />
              <Text style={styles.warningTitle}>
                {copy(language, "detail.provenanceUnavailableTitle")}
              </Text>
            </View>
            <Text style={styles.warningText}>
              {copy(language, "detail.provenanceUnavailableBody")}
            </Text>
          </View>
        ) : null}

        {canShowProvenance ? (
          <View style={styles.panel}>
            <View style={styles.panelHeaderRow}>
              <Text style={styles.sectionTitle}>{testTitle(language, activeTab)}</Text>
              <Text style={styles.panelHeaderLabel}>{copy(language, "detail.validatedData")}</Text>
            </View>

            {metricItems.length ? (
              <View style={styles.metricGrid}>
                {metricItems.map((item) => (
                  <View
                    key={`${activeTab}-${item.label}`}
                    style={[styles.metricCard, item.compact && styles.metricCardCompact]}
                  >
                    <Text style={styles.metricLabel}>{item.label}</Text>
                    <Text style={item.compact ? styles.metricValueSmall : styles.metricValue}>
                      {item.value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyState}>{copy(language, "detail.noTestData")}</Text>
            )}
          </View>
        ) : null}

        {canShowProvenance && warnings.length ? (
          <View style={styles.warningPanel}>
            <View style={styles.warningPanelHeader}>
              <Ionicons name="warning-outline" size={18} color={theme.warningText} />
              <Text style={styles.warningTitle}>{copy(language, "detail.warnings")}</Text>
            </View>
            <NoteList language={language} notes={warnings} tone="warning" />
          </View>
        ) : null}

        {canShowProvenance && supporting.length ? (
          <View style={styles.panel}>
            <Text style={styles.sectionTitle}>{copy(language, "detail.notes")}</Text>
            <NoteList language={language} notes={supporting} />
          </View>
        ) : null}

        {canShowProvenance ? (
          <DilutionCalculator
            language={language}
            dilutions={test.dilutions}
            concentrationUnit={concentrationUnit}
          />
        ) : null}

        <CrossReactivitySection
          drug={drug}
          language={language}
          allDrugs={allDrugs}
          sources={sources}
          onOpenDrug={onOpenDrug}
        />

        {canShowProvenance && sourcesDisagree ? (
          <View style={styles.warningPanel}>
            <View style={styles.warningPanelHeader}>
              <Ionicons name="git-compare-outline" size={18} color={theme.warningText} />
              <Text style={styles.warningTitle}>
                {copy(language, "detail.sourceDiscrepancyTitle")}
              </Text>
            </View>
            <Text style={styles.warningText}>
              {copy(language, "detail.sourceDiscrepancyBody")}
            </Text>
            <View style={styles.sourceBreakdownTable}>
              <Text style={styles.sourceBreakdownHeading}>
                {copy(language, "detail.sourceBreakdownTitle")}
              </Text>
              {test.sourceEntries.map((entry) => {
                const src = sources[entry.sourceId];
                const conc = entry.concentration ?? entry.maxConcentration ?? "—";
                return (
                  <View key={entry.sourceId} style={styles.sourceBreakdownRow}>
                    <Text
                      style={[
                        styles.sourceBreakdownLabel,
                        entry.isPreferred && styles.sourceBreakdownLabelPreferred,
                      ]}
                    >
                      {src?.label ?? entry.sourceId}
                    </Text>
                    <Text
                      style={[
                        styles.sourceBreakdownValue,
                        entry.isPreferred && styles.sourceBreakdownValuePreferred,
                      ]}
                    >
                      {conc}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {canShowProvenance && preferredSource ? (
          <View style={styles.panel}>
            <View style={styles.sourceSummaryCard}>
              <Text style={styles.sourceEyebrow}>{copy(language, "detail.preferredSource")}</Text>
              <Text style={styles.sourceTitle}>{preferredSource.label}</Text>
              <Text style={styles.sourceMeta}>
                {preferredSource.organization} {preferredSource.year} • {preferredSource.version}
              </Text>
              <Text style={styles.sourceLabel}>{preferredSource.documentName[language]}</Text>
            </View>
            <Pressable onPress={() => setShowSource((current) => !current)} style={styles.sourceToggle}>
              <Text style={styles.sectionTitle}>{copy(language, "detail.source")}</Text>
              <Text style={styles.sourceToggleLabel}>
                {showSource ? copy(language, "detail.hideSource") : copy(language, "detail.showSource")}
              </Text>
            </Pressable>

            {showSource ? (
              <View style={styles.sourceStack}>
                {test.sourceEntries.map((entry) => {
                  const src = sources[entry.sourceId];
                  if (!src) return null;
                  return (
                    <SourceCard
                      key={entry.sourceId}
                      source={src}
                      language={language}
                      eyebrow={copy(language, entry.isPreferred ? "detail.preferredSource" : "detail.alternateSource")}
                    />
                  );
                })}
              </View>
            ) : null}
          </View>
        ) : null}

        <ComplianceBanner language={language} />
      </ScrollView>
    </View>
  );
}

export default function App() {
  const systemScheme = useColorScheme();
  const [darkOverride, setDarkOverride] = useState<boolean | null>(null);

  const effectiveScheme: "light" | "dark" =
    darkOverride !== null ? (darkOverride ? "dark" : "light") : (systemScheme ?? "light");
  const isDark = effectiveScheme === "dark";
  const theme = isDark ? darkTheme : lightTheme;
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [activeDataset, setActiveDataset] = useState(() => getBundledActiveDataset());
  const [language, setLanguage] = useState<Language>("fr");
  const [homeTab, setHomeTab] = useState<HomeTab>("search");
  const [query, setQuery] = useState("");
  const [selectedDrugId, setSelectedDrugId] = useState<string | null>(null);
  const [favoriteDrugIds, setFavoriteDrugIds] = useState<string[]>([]);
  const [recentDrugIds, setRecentDrugIds] = useState<string[]>([]);
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [recentHydrated, setRecentHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [storedDataset, storedFavorites, storedRecents, storedDarkMode] = await Promise.all([
        loadActiveDataset(),
        loadFavoriteDrugIds(),
        loadRecentDrugIds(),
        AsyncStorage.getItem(DARK_MODE_STORAGE_KEY),
      ]);

      if (cancelled) {
        return;
      }

      const validDrugIds = storedDataset.dataset.drugs.map((drug) => drug.id);

      startTransition(() => {
        setActiveDataset(storedDataset);
        setFavoriteDrugIds(sanitizeFavoriteDrugIds(storedFavorites, validDrugIds));
        setRecentDrugIds(sanitizeRecentDrugIds(storedRecents, validDrugIds));
        setFavoritesHydrated(true);
        setRecentHydrated(true);
        if (storedDarkMode === "dark") {
          setDarkOverride(true);
        } else if (storedDarkMode === "light") {
          setDarkOverride(false);
        }
      });

      const syncResult = await syncDatasetInBackground(storedDataset.manifest);

      if (cancelled || syncResult.status !== "activated") {
        return;
      }

      startTransition(() => {
        setActiveDataset(syncResult.activeDataset);
      });
    }

    hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    const sanitized = sanitizeFavoriteDrugIds(
      favoriteDrugIds,
      activeDataset.dataset.drugs.map((drug) => drug.id)
    );

    if (!arraysEqual(sanitized, favoriteDrugIds)) {
      setFavoriteDrugIds(sanitized);
    }
  }, [activeDataset.dataset.drugs, favoriteDrugIds, favoritesHydrated]);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    void persistFavoriteDrugIds(favoriteDrugIds);
  }, [favoriteDrugIds, favoritesHydrated]);

  useEffect(() => {
    if (!recentHydrated) {
      return;
    }

    const sanitized = sanitizeRecentDrugIds(
      recentDrugIds,
      activeDataset.dataset.drugs.map((drug) => drug.id)
    );

    if (!arraysEqual(sanitized, recentDrugIds)) {
      setRecentDrugIds(sanitized);
    }
  }, [activeDataset.dataset.drugs, recentDrugIds, recentHydrated]);

  useEffect(() => {
    if (!recentHydrated) {
      return;
    }

    void persistRecentDrugIds(recentDrugIds);
  }, [recentDrugIds, recentHydrated]);

  const selectedDrug = selectedDrugId
    ? activeDataset.dataset.drugs.find((drug) => drug.id === selectedDrugId) ?? null
    : null;
  const hasQuery = query.trim().length > 0;
  const searchResults = hasQuery ? searchDrugs(activeDataset.dataset.drugs, query, language) : [];
  const favoriteDrugs = favoriteDrugIds
    .map((drugId) => activeDataset.dataset.drugs.find((drug) => drug.id === drugId) ?? null)
    .filter((drug): drug is DrugRecord => Boolean(drug))
    .sort((a, b) => a.name[language].localeCompare(b.name[language], language));
  const recentDrugs = recentDrugIds
    .map((drugId) => activeDataset.dataset.drugs.find((drug) => drug.id === drugId) ?? null)
    .filter((drug): drug is DrugRecord => Boolean(drug));

  useEffect(() => {
    if (selectedDrugId && !selectedDrug) {
      startTransition(() => {
        setSelectedDrugId(null);
      });
    }
  }, [selectedDrug, selectedDrugId]);

  function toggleFavorite(drugId: string) {
    startTransition(() => {
      setFavoriteDrugIds((current) => {
        if (current.includes(drugId)) {
          return current.filter((id) => id !== drugId);
        }

        return [drugId, ...current];
      });
    });
  }

  function openDrug(drugId: string) {
    startTransition(() => {
      setSelectedDrugId(drugId);
      setRecentDrugIds((current) => recordRecentDrugId(current, drugId));
    });
  }

  function toggleDark() {
    const next = !isDark;
    setDarkOverride(next);
    void AsyncStorage.setItem(DARK_MODE_STORAGE_KEY, next ? "dark" : "light");
  }

  const SCREEN_WIDTH = Dimensions.get("window").width;
  const slideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const prevSelectedDrugIdRef = useRef<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  // Slide in when a drug is newly selected, slide out when dismissed
  useEffect(() => {
    const prev = prevSelectedDrugIdRef.current;
    prevSelectedDrugIdRef.current = selectedDrugId;

    if (selectedDrugId && !prev) {
      // entering: make visible, snap to right edge, then animate to 0
      setDetailVisible(true);
      slideX.setValue(SCREEN_WIDTH);
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start();
    } else if (!selectedDrugId && prev) {
      // exiting: animate back to right edge, then hide
      Animated.spring(slideX, {
        toValue: SCREEN_WIDTH,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start(() => setDetailVisible(false));
    }
  }, [selectedDrugId, SCREEN_WIDTH, slideX]);

  // Swipe-back pan responder: moves the detail panel with the finger
  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 10 && Math.abs(g.dy) < 60 && g.moveX < 60,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) slideX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_WIDTH * 0.35 || g.vx > 0.5) {
          // commit: finish sliding off
          Animated.spring(slideX, {
            toValue: SCREEN_WIDTH,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start(() => {
            setDetailVisible(false);
            startTransition(() => setSelectedDrugId(null));
          });
        } else {
          // cancel: snap back
          Animated.spring(slideX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
          }).start();
        }
      },
    })
  ).current;

  // Home screen background slides left as detail slides right (parallax)
  const homeTranslateX = slideX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [-SCREEN_WIDTH * 0.25, 0],
    extrapolate: "clamp",
  });

  const HomeContent = (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.titleBlock}>
          <AppLogo theme={theme} />
        </View>
        <Pressable
          onPress={toggleDark}
          style={styles.languageButton}
        >
          <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={14} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => setLanguage(language === "fr" ? "en" : "fr")}
          style={styles.languageButton}
        >
          <Ionicons name="globe-outline" size={14} color={theme.textSecondary} />
          <Text style={styles.languageButtonText}>{language.toUpperCase()}</Text>
        </Pressable>
      </View>

      <View style={styles.mainContent}>
        {homeTab === "search" ? (
          <SearchScreen
            allDrugs={activeDataset.dataset.drugs}
            favoriteDrugIds={favoriteDrugIds}
            language={language}
            onChangeQuery={setQuery}
            onOpenDrug={openDrug}
            onToggleFavorite={toggleFavorite}
            query={query}
            recentDrugs={recentDrugs}
            searchResults={searchResults}
          />
        ) : null}

        {homeTab === "favorites" ? (
          <FavoritesScreen
            favoriteDrugIds={favoriteDrugIds}
            favoriteDrugs={favoriteDrugs}
            language={language}
            onOpenDrug={openDrug}
            onToggleFavorite={toggleFavorite}
          />
        ) : null}

        {homeTab === "info" ? (
          <InfoScreen activeDataset={activeDataset} language={language} />
        ) : null}
      </View>

      {/* Flat bottom tab bar */}
      <View style={styles.footer}>
        <View style={styles.topLevelTabs}>
          {HOME_TABS.map((tab) => {
            const selected = tab === homeTab;

            return (
              <Pressable
                key={tab}
                onPress={() => setHomeTab(tab)}
                style={styles.topLevelTab}
              >
                <Ionicons
                  name={homeTabIconName(tab, selected)}
                  size={24}
                  color={selected ? theme.accent : theme.textDisabled}
                />
                <Text
                  style={[styles.topLevelTabText, selected && styles.topLevelTabTextSelected]}
                >
                  {copy(language, homeTabLabelKey(tab))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaProvider>
    <ThemeContext.Provider value={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBar as "dark" | "light"} />
        <View style={styles.stackRoot}>
          {/* Home layer — always rendered, slides left as detail comes in */}
          <Animated.View
            style={[styles.stackLayer, { transform: [{ translateX: homeTranslateX }] }]}
            pointerEvents={selectedDrug ? "none" : "auto"}
          >
            {HomeContent}
          </Animated.View>

          {/* Detail layer — slides in from right, kept mounted during exit animation */}
          {detailVisible ? (
            <Animated.View
              style={[styles.stackLayer, { transform: [{ translateX: slideX }] }]}
              {...swipeBack.panHandlers}
            >
              <View style={styles.container}>
                {selectedDrug ? (
                  <DetailScreen
                    drug={selectedDrug}
                    allDrugs={activeDataset.dataset.drugs}
                    isSaved={favoriteDrugIds.includes(selectedDrug.id)}
                    language={language}
                    onBack={() => {
                      Animated.spring(slideX, {
                        toValue: SCREEN_WIDTH,
                        useNativeDriver: true,
                        bounciness: 0,
                        speed: 20,
                      }).start(() => {
                        setDetailVisible(false);
                        startTransition(() => setSelectedDrugId(null));
                      });
                    }}
                    onOpenDrug={openDrug}
                    onToggleFavorite={() => toggleFavorite(selectedDrug.id)}
                    sources={activeDataset.dataset.sources}
                  />
                ) : null}
              </View>
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>
    </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}
