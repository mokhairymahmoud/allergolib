import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React, { startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { AppLogo } from "./src/components/AppLogo";
import {
  getBundledActiveDataset,
  loadActiveDataset,
  syncDatasetInBackground,
} from "./src/data/runtimeDataset";
import { loadFavoriteDrugIds, persistFavoriteDrugIds, sanitizeFavoriteDrugIds } from "./src/lib/favorites";
import { arraysEqual } from "./src/lib/formatters";
import { copy } from "./src/lib/i18n";
import {
  loadRecentDrugIds,
  persistRecentDrugIds,
  recordRecentDrugId,
  sanitizeRecentDrugIds,
} from "./src/lib/recentSearches";
import { searchDrugs } from "./src/lib/drugSearch";
import { DetailScreen } from "./src/screens/detail/DetailScreen";
import { FavoritesScreen } from "./src/screens/FavoritesScreen";
import { InfoScreen } from "./src/screens/InfoScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { darkTheme, lightTheme } from "./src/theme/colors";
import { ThemeContext } from "./src/theme/ThemeContext";
import type { DrugRecord, Language } from "./src/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const HOME_TABS = ["search", "favorites", "info"] as const;
const DARK_MODE_STORAGE_KEY = "@allergolib/dark-mode";

type HomeTab = (typeof HOME_TABS)[number];

function homeTabIconName(tab: HomeTab, selected: boolean): React.ComponentProps<typeof Ionicons>["name"] {
  if (tab === "favorites") return selected ? "heart" : "heart-outline";
  if (tab === "info") return selected ? "information-circle" : "information-circle-outline";
  return selected ? "search" : "search-outline";
}

function homeTabLabelKey(tab: HomeTab) {
  if (tab === "favorites") return "home.tabFavorites";
  if (tab === "info") return "home.tabInfo";
  return "home.tabSearch";
}

// ─── Root App ────────────────────────────────────────────────────────────────

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

  // ─── Hydration ─────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [storedDataset, storedFavorites, storedRecents, storedDarkMode] = await Promise.all([
        loadActiveDataset(),
        loadFavoriteDrugIds(),
        loadRecentDrugIds(),
        AsyncStorage.getItem(DARK_MODE_STORAGE_KEY),
      ]);

      if (cancelled) return;

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

      if (cancelled || syncResult.status !== "activated") return;

      startTransition(() => {
        setActiveDataset(syncResult.activeDataset);
      });
    }

    hydrate();
    return () => { cancelled = true; };
  }, []);

  // ─── Favorites sync ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!favoritesHydrated) return;

    const sanitized = sanitizeFavoriteDrugIds(
      favoriteDrugIds,
      activeDataset.dataset.drugs.map((drug) => drug.id)
    );

    if (!arraysEqual(sanitized, favoriteDrugIds)) {
      setFavoriteDrugIds(sanitized);
    }
  }, [activeDataset.dataset.drugs, favoriteDrugIds, favoritesHydrated]);

  useEffect(() => {
    if (!favoritesHydrated) return;
    void persistFavoriteDrugIds(favoriteDrugIds);
  }, [favoriteDrugIds, favoritesHydrated]);

  // ─── Recents sync ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!recentHydrated) return;

    const sanitized = sanitizeRecentDrugIds(
      recentDrugIds,
      activeDataset.dataset.drugs.map((drug) => drug.id)
    );

    if (!arraysEqual(sanitized, recentDrugIds)) {
      setRecentDrugIds(sanitized);
    }
  }, [activeDataset.dataset.drugs, recentDrugIds, recentHydrated]);

  useEffect(() => {
    if (!recentHydrated) return;
    void persistRecentDrugIds(recentDrugIds);
  }, [recentDrugIds, recentHydrated]);

  // ─── Derived state ─────────────────────────────────────────────────────────

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
      startTransition(() => { setSelectedDrugId(null); });
    }
  }, [selectedDrug, selectedDrugId]);

  // ─── Actions ───────────────────────────────────────────────────────────────

  function toggleFavorite(drugId: string) {
    startTransition(() => {
      setFavoriteDrugIds((current) => {
        if (current.includes(drugId)) return current.filter((id) => id !== drugId);
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

  // ─── Slide animation ──────────────────────────────────────────────────────

  const SCREEN_WIDTH = Dimensions.get("window").width;
  const slideX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const prevSelectedDrugIdRef = useRef<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  useEffect(() => {
    const prev = prevSelectedDrugIdRef.current;
    prevSelectedDrugIdRef.current = selectedDrugId;

    if (selectedDrugId && !prev) {
      setDetailVisible(true);
      slideX.setValue(SCREEN_WIDTH);
      Animated.spring(slideX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start();
    } else if (!selectedDrugId && prev) {
      Animated.spring(slideX, {
        toValue: SCREEN_WIDTH,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }).start(() => setDetailVisible(false));
    }
  }, [selectedDrugId, SCREEN_WIDTH, slideX]);

  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        g.dx > 10 && Math.abs(g.dy) < 60 && g.moveX < 100,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) slideX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > SCREEN_WIDTH * 0.35 || g.vx > 0.5) {
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

  const homeTranslateX = slideX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [-SCREEN_WIDTH * 0.25, 0],
    extrapolate: "clamp",
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaProvider>
    <ThemeContext.Provider value={theme}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style={theme.statusBar as "dark" | "light"} />
        <View style={styles.stackRoot}>
          {/* Home layer */}
          <Animated.View
            style={[styles.stackLayer, { transform: [{ translateX: homeTranslateX }] }]}
            pointerEvents={selectedDrug ? "none" : "auto"}
          >
            <View style={styles.container}>
              {/* Top bar */}
              <View style={styles.topBar}>
                <View style={styles.titleBlock}>
                  <AppLogo theme={theme} />
                </View>
                <Pressable onPress={toggleDark} style={styles.pill}>
                  <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={14} color={theme.textSecondary} />
                </Pressable>
                <Pressable onPress={() => setLanguage(language === "fr" ? "en" : "fr")} style={styles.langPill}>
                  <Text style={styles.langOption}>{language === "fr" ? "FR" : "EN"}</Text>
                  <Text style={styles.langDivider}>|</Text>
                  <Text style={styles.langOptionInactive}>{language === "fr" ? "EN" : "FR"}</Text>
                </Pressable>
              </View>

              <View style={styles.mainContent}>
                {!favoritesHydrated || !recentHydrated ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : (
                  <>
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
                      <InfoScreen
                        manifest={activeDataset.manifest}
                        origin={activeDataset.origin}
                        language={language}
                      />
                    ) : null}
                  </>
                )}
              </View>

              {/* Bottom tab bar */}
              <View style={styles.footer}>
                <View style={styles.tabs}>
                  {HOME_TABS.map((tab) => {
                    const selected = tab === homeTab;
                    return (
                      <Pressable key={tab} onPress={() => setHomeTab(tab)} style={styles.tab}>
                        <Ionicons
                          name={homeTabIconName(tab, selected)}
                          size={24}
                          color={selected ? theme.accent : theme.textDisabled}
                        />
                        <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                          {copy(language, homeTabLabelKey(tab))}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Detail layer */}
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

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(theme: typeof lightTheme) {
  return StyleSheet.create({
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
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
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
    pill: {
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
    pillText: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: "700",
    },
    langPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderWidth: 1,
      borderColor: theme.borderMid,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.surface,
    },
    langOption: {
      color: theme.accent,
      fontSize: 12,
      fontWeight: "800",
    },
    langDivider: {
      color: theme.borderMid,
      fontSize: 12,
      fontWeight: "400",
    },
    langOptionInactive: {
      color: theme.textDisabled,
      fontSize: 12,
      fontWeight: "600",
    },
    footer: {
      backgroundColor: theme.surface,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    tabs: {
      flexDirection: "row",
      height: 56,
    },
    tab: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
    },
    tabText: {
      color: theme.textDisabled,
      fontSize: 11,
      fontWeight: "600",
    },
    tabTextSelected: {
      color: theme.accent,
    },
  });
}
