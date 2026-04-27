import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { startTransition, useDeferredValue, useState } from "react";

import { bundledDataset, bundledManifest } from "./src/data/loadBundledDataset";
import { filterDrugs } from "./src/lib/filterDrugs";
import { copy } from "./src/lib/i18n";
import type { DrugRecord, Language, SourceDocument, TestKind } from "./src/types";

const TAB_ORDER: TestKind[] = ["prick", "idr", "patch"];

function isTestAvailable(drug: DrugRecord, kind: TestKind) {
  const test = drug.tests[kind];
  return Boolean(test?.concentration || test?.maxConcentration || test?.notes.length);
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

function DrugRow({
  drug,
  language,
  onPress,
}: {
  drug: DrugRecord;
  language: Language;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <Text style={styles.resultName}>{drug.name[language]}</Text>
        <View style={styles.classBadge}>
          <Text style={styles.classBadgeText}>{drug.className[language]}</Text>
        </View>
      </View>
      <Text style={styles.resultAlias}>
        {copy(language, "search.aliases")}: {drug.aliases.join(", ")}
      </Text>
    </Pressable>
  );
}

function SourceCard({
  source,
  language,
}: {
  source: SourceDocument;
  language: Language;
}) {
  return (
    <View style={styles.sourceCard}>
      <Text style={styles.sourceTitle}>{source.label}</Text>
      <Text style={styles.sourceMeta}>{source.documentName[language]}</Text>
      <Text style={styles.sourceExcerpt}>{source.excerpt[language]}</Text>
    </View>
  );
}

function DetailScreen({
  drug,
  language,
  onBack,
}: {
  drug: DrugRecord;
  language: Language;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TestKind>(availableTests(drug)[0] ?? "prick");
  const [showSource, setShowSource] = useState(false);
  const test = drug.tests[activeTab];
  const source = bundledDataset.sources[test.sourceId];

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>{copy(language, "detail.back")}</Text>
      </Pressable>

      <View style={styles.detailHeader}>
        <Text style={styles.detailEyebrow}>{drug.className[language]}</Text>
        <Text style={styles.detailTitle}>{drug.name[language]}</Text>
        <Text style={styles.detailSubtitle}>{copy(language, "detail.seedNotice")}</Text>
      </View>

      <View style={styles.tabRow}>
        {TAB_ORDER.map((kind) => {
          const selected = kind === activeTab;
          const disabled = !isTestAvailable(drug, kind);

          return (
            <Pressable
              key={kind}
              disabled={disabled}
              onPress={() => setActiveTab(kind)}
              style={[
                styles.tabButton,
                selected && styles.tabButtonSelected,
                disabled && styles.tabButtonDisabled,
              ]}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  selected && styles.tabButtonTextSelected,
                  disabled && styles.tabButtonTextDisabled,
                ]}
              >
                {testTitle(language, kind)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.panel}>
        {test.concentration ? (
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{concentrationLabel(language, activeTab)}</Text>
            <Text style={styles.metricValue}>{test.concentration}</Text>
          </View>
        ) : null}

        {test.maxConcentration ? (
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{copy(language, "detail.idr.maxConcentration")}</Text>
            <Text style={styles.metricValue}>{test.maxConcentration}</Text>
          </View>
        ) : null}

        {test.dilutions.length ? (
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{copy(language, "detail.idr.dilutions")}</Text>
            <Text style={styles.metricValue}>{test.dilutions.join(" -> ")}</Text>
          </View>
        ) : null}

        {test.vehicle ? (
          <View style={styles.metricBlock}>
            <Text style={styles.metricLabel}>{copy(language, "detail.patch.vehicle")}</Text>
            <Text style={styles.metricValue}>{test.vehicle[language]}</Text>
          </View>
        ) : null}

        {test.notes.length ? (
          <View style={styles.notesBlock}>
            <Text style={styles.sectionTitle}>{copy(language, "detail.notes")}</Text>
            {test.notes.map((note) => (
              <View key={note[language]} style={styles.noteRow}>
                <Text style={styles.noteBullet}>•</Text>
                <Text style={styles.noteText}>{note[language]}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyState}>{copy(language, "detail.noTestData")}</Text>
        )}
      </View>

      <View style={styles.panel}>
        <Pressable onPress={() => setShowSource((current) => !current)} style={styles.sourceToggle}>
          <View>
            <Text style={styles.sectionTitle}>{copy(language, "detail.source")}</Text>
            <Text style={styles.sourceLabel}>{source.label}</Text>
          </View>
          <Text style={styles.sourceToggleLabel}>
            {showSource ? copy(language, "detail.hideSource") : copy(language, "detail.showSource")}
          </Text>
        </Pressable>

        {showSource ? <SourceCard source={source} language={language} /> : null}
      </View>
    </ScrollView>
  );
}

export default function App() {
  const [language, setLanguage] = useState<Language>("en");
  const [query, setQuery] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<DrugRecord | null>(null);
  const deferredQuery = useDeferredValue(query);
  const results = filterDrugs(bundledDataset.drugs, deferredQuery, language);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.eyebrow}>{copy(language, "home.eyebrow")}</Text>
            <Text style={styles.title}>{copy(language, "home.title")}</Text>
          </View>
          <View style={styles.languageToggle}>
            {(["en", "fr"] as Language[]).map((nextLanguage) => {
              const selected = nextLanguage === language;

              return (
                <Pressable
                  key={nextLanguage}
                  onPress={() => setLanguage(nextLanguage)}
                  style={[
                    styles.languageButton,
                    selected && styles.languageButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.languageButtonText,
                      selected && styles.languageButtonTextSelected,
                    ]}
                  >
                    {nextLanguage.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selectedDrug ? (
          <DetailScreen
            drug={selectedDrug}
            language={language}
            onBack={() => {
              startTransition(() => setSelectedDrug(null));
            }}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.screenContent}>
            <View style={styles.heroCard}>
              <Text style={styles.heroTitle}>{copy(language, "home.heroTitle")}</Text>
              <Text style={styles.heroBody}>{copy(language, "home.heroBody")}</Text>
              <Text style={styles.heroMeta}>
                {copy(language, "home.release")}: {bundledManifest.version}
              </Text>
            </View>

            <View style={styles.searchCard}>
              <Text style={styles.sectionTitle}>{copy(language, "search.title")}</Text>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder={copy(language, "search.placeholder")}
                placeholderTextColor="#6D7B8A"
                style={styles.searchInput}
                value={query}
              />
              <Text style={styles.searchSummary}>
                {results.length} {copy(language, "search.results")}
              </Text>
            </View>

            <View style={styles.resultsList}>
              {results.map((drug) => (
                <DrugRow
                  key={drug.id}
                  drug={drug}
                  language={language}
                  onPress={() => {
                    startTransition(() => setSelectedDrug(drug));
                  }}
                />
              ))}
            </View>

            {!results.length ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>{copy(language, "search.emptyTitle")}</Text>
                <Text style={styles.emptyText}>{copy(language, "search.emptyBody")}</Text>
              </View>
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F3F0E8",
  },
  container: {
    flex: 1,
    backgroundColor: "#F3F0E8",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  eyebrow: {
    color: "#0E6B66",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#16222E",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 4,
  },
  languageToggle: {
    flexDirection: "row",
    gap: 8,
  },
  languageButton: {
    borderWidth: 1,
    borderColor: "#D2D0C8",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FCFBF7",
  },
  languageButtonSelected: {
    backgroundColor: "#16222E",
    borderColor: "#16222E",
  },
  languageButtonText: {
    color: "#16222E",
    fontSize: 12,
    fontWeight: "700",
  },
  languageButtonTextSelected: {
    color: "#FCFBF7",
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#16353D",
    borderRadius: 28,
    padding: 20,
    gap: 10,
  },
  heroTitle: {
    color: "#F7F3EA",
    fontSize: 20,
    fontWeight: "800",
  },
  heroBody: {
    color: "#D7E6E2",
    fontSize: 15,
    lineHeight: 22,
  },
  heroMeta: {
    color: "#9EC2BB",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  searchCard: {
    backgroundColor: "#FCFBF7",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    gap: 12,
  },
  sectionTitle: {
    color: "#16222E",
    fontSize: 16,
    fontWeight: "800",
  },
  searchInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#C8D0D8",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: "#16222E",
    fontSize: 16,
  },
  searchSummary: {
    color: "#536070",
    fontSize: 13,
  },
  resultsList: {
    gap: 12,
  },
  resultCard: {
    backgroundColor: "#FCFBF7",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    gap: 10,
  },
  resultHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  resultName: {
    flex: 1,
    color: "#16222E",
    fontSize: 19,
    fontWeight: "800",
  },
  classBadge: {
    backgroundColor: "#E3F0ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  classBadgeText: {
    color: "#0E6B66",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  resultAlias: {
    color: "#536070",
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    backgroundColor: "#FCE6D8",
    borderRadius: 22,
    padding: 18,
    gap: 8,
  },
  emptyTitle: {
    color: "#8A3312",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: "#8A3312",
    fontSize: 14,
    lineHeight: 20,
  },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#FCFBF7",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#16222E",
    fontSize: 13,
    fontWeight: "700",
  },
  detailHeader: {
    backgroundColor: "#FCFBF7",
    borderRadius: 26,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#D8D4CB",
  },
  detailEyebrow: {
    color: "#0E6B66",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  detailTitle: {
    color: "#16222E",
    fontSize: 28,
    fontWeight: "800",
  },
  detailSubtitle: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "#E4E9EE",
    paddingVertical: 12,
    alignItems: "center",
  },
  tabButtonSelected: {
    backgroundColor: "#B53E16",
  },
  tabButtonDisabled: {
    opacity: 0.5,
  },
  tabButtonText: {
    color: "#16222E",
    fontSize: 14,
    fontWeight: "800",
  },
  tabButtonTextSelected: {
    color: "#FFF9F5",
  },
  tabButtonTextDisabled: {
    color: "#70808F",
  },
  panel: {
    backgroundColor: "#FCFBF7",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    gap: 16,
  },
  metricBlock: {
    gap: 6,
  },
  metricLabel: {
    color: "#536070",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: "#16222E",
    fontSize: 24,
    fontWeight: "800",
  },
  notesBlock: {
    gap: 10,
  },
  noteRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  noteBullet: {
    color: "#B53E16",
    fontSize: 18,
    lineHeight: 20,
  },
  noteText: {
    flex: 1,
    color: "#223243",
    fontSize: 15,
    lineHeight: 22,
  },
  emptyState: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
  },
  sourceToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  sourceLabel: {
    color: "#536070",
    fontSize: 14,
    marginTop: 4,
  },
  sourceToggleLabel: {
    color: "#0E6B66",
    fontSize: 13,
    fontWeight: "700",
    alignSelf: "center",
  },
  sourceCard: {
    gap: 8,
    backgroundColor: "#F4F7FA",
    borderRadius: 18,
    padding: 14,
  },
  sourceTitle: {
    color: "#16222E",
    fontSize: 15,
    fontWeight: "800",
  },
  sourceMeta: {
    color: "#536070",
    fontSize: 13,
  },
  sourceExcerpt: {
    color: "#223243",
    fontSize: 14,
    lineHeight: 20,
  },
});
