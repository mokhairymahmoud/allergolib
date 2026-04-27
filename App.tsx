import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

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
  DrugRecord,
  Language,
  NoteKind,
  SourceDocument,
  TestKind,
  TestNote,
  TestRecord,
} from "./src/types";

const TAB_ORDER: TestKind[] = ["prick", "idr", "patch"];
const HOME_TABS = ["search", "favorites", "info"] as const;

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
  return Boolean(
    test.concentration ||
      test.maxConcentration ||
      test.dilutions.length ||
      test.vehicle ||
      test.notes.length
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

  return hasSourceDocumentContent(sources[test.preferredSourceId]);
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

// Slim blue compliance banner shown on non-Info screens
function ComplianceBanner({ language }: { language: Language }) {
  return (
    <View style={styles.complianceBanner}>
      <Ionicons name="shield-checkmark-outline" size={14} color="#1E40AF" style={{ marginTop: 1 }} />
      <Text style={styles.complianceBannerText}>{copy(language, "compliance.badge")} — {copy(language, "compliance.title")}</Text>
    </View>
  );
}

// Full compliance card used on InfoScreen
function ComplianceCard({ language }: { language: Language }) {
  return (
    <View style={styles.complianceCard}>
      <View style={styles.complianceBadgeRow}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#1E40AF" />
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
                color={isSaved ? "#1A73D4" : "#94A3B8"}
              />
            </Pressable>
          ) : null}
          <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
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
  favoriteDrugIds,
  onChangeQuery,
  onOpenDrug,
  onToggleFavorite,
}: {
  language: Language;
  query: string;
  searchResults: DrugSearchResult[];
  recentDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onChangeQuery: (value: string) => void;
  onOpenDrug: (drugId: string) => void;
  onToggleFavorite: (drugId: string) => void;
}) {
  const favoriteDrugSet = new Set(favoriteDrugIds);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.screenContent} keyboardShouldPersistTaps="handled">
      <View style={styles.searchHeader}>
        <Text style={styles.screenTitle}>{copy(language, "search.heroTitle")}</Text>
        <Text style={styles.screenSubtitle}>{copy(language, "search.heroBody")}</Text>
      </View>

      <View style={styles.searchInputWrap}>
        <Ionicons name="search" size={18} color="#64748B" style={styles.searchIcon} />
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={onChangeQuery}
          placeholder={copy(language, "search.placeholder")}
          placeholderTextColor="#94A3B8"
          style={styles.searchInput}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => onChangeQuery("")} hitSlop={8} style={styles.searchClear}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </Pressable>
        ) : null}
      </View>

      {hasQuery ? (
        <>
          <Text style={styles.resultCount}>
            {searchResults.length} {copy(language, "search.results")}
          </Text>
          {searchResults.length ? (
            <View style={styles.resultsList}>
              {searchResults.map((result) => (
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
              <Ionicons name="search-outline" size={32} color="#94A3B8" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>{copy(language, "search.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{copy(language, "search.emptyBody")}</Text>
            </View>
          )}
        </>
      ) : (
        <>
          {recentDrugs.length > 0 ? (
            <View style={styles.recentSection}>
              <Text style={styles.sectionLabel}>{copy(language, "search.recentTitle")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentChips}
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
            </View>
          ) : (
            <NeutralEmptyCard
              title={copy(language, "search.emptyRecentTitle")}
              body={copy(language, "search.emptyRecentBody")}
            />
          )}
        </>
      )}

      <ComplianceBanner language={language} />
    </ScrollView>
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
          <Ionicons name="heart-outline" size={56} color="#CBD5E1" />
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
  return (
    <View style={styles.sourceCard}>
      <Text style={styles.sourceEyebrow}>{eyebrow}</Text>
      <Text style={styles.sourceTitle}>{source.label}</Text>
      <Text style={styles.sourceMeta}>
        {source.organization} {source.year} • {source.version} • {source.status}
      </Text>
      <Text style={styles.sourceMeta}>{source.documentName[language]}</Text>
      <Text style={styles.sourceExcerpt}>{source.excerpt[language]}</Text>
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
          <Ionicons name="calculator-outline" size={18} color="#1A73D4" />
          <Text style={styles.sectionTitle}>{copy(language, "detail.calculatorTitle")}</Text>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color="#64748B"
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
                placeholderTextColor="#94A3B8"
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
                placeholderTextColor="#94A3B8"
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

function DetailScreen({
  drug,
  language,
  sources,
  isSaved,
  onBack,
  onToggleFavorite,
}: {
  drug: DrugRecord;
  language: Language;
  sources: Record<string, SourceDocument>;
  isSaved: boolean;
  onBack: () => void;
  onToggleFavorite: () => void;
}) {
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
  const preferredSource = canShowProvenance ? sources[test.preferredSourceId] : undefined;
  const alternateSource =
    canShowProvenance && test.alternateSourceId
      ? sources[test.alternateSourceId]
      : undefined;
  const { warnings, supporting } = splitNotes(test.notes);
  const concentrationUnit = extractConcentrationUnit(test.maxConcentration ?? test.concentration);
  const shouldShowStandardConcentration =
    Boolean(test.concentration) && (activeTab !== "idr" || test.concentration !== test.maxConcentration);
  const metricItems: DetailMetricItem[] = [];

  if (shouldShowStandardConcentration) {
    metricItems.push({
      label: concentrationLabel(language, activeTab),
      value: test.concentration ?? "",
    });
  }

  if (test.maxConcentration) {
    metricItems.push({
      label: copy(language, "detail.idr.maxConcentration"),
      value: test.maxConcentration,
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
          <Ionicons name="arrow-back" size={20} color="#0F172A" />
        </Pressable>
        <Text style={styles.detailNavTitle} numberOfLines={1}>{drug.name[language]}</Text>
        <Pressable onPress={onToggleFavorite} style={styles.detailNavAction} hitSlop={8}>
          <Ionicons
            name={isSaved ? "heart" : "heart-outline"}
            size={22}
            color={isSaved ? "#1A73D4" : "#64748B"}
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
              <Ionicons name="warning-outline" size={18} color="#92400E" />
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
              <Ionicons name="warning-outline" size={18} color="#92400E" />
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
                <SourceCard
                  source={preferredSource}
                  language={language}
                  eyebrow={copy(language, "detail.preferredSource")}
                />
                {alternateSource ? (
                  <SourceCard
                    source={alternateSource}
                    language={language}
                    eyebrow={copy(language, "detail.alternateSource")}
                  />
                ) : null}
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
      const [storedDataset, storedFavorites, storedRecents] = await Promise.all([
        loadActiveDataset(),
        loadFavoriteDrugIds(),
        loadRecentDrugIds(),
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
    .filter((drug): drug is DrugRecord => Boolean(drug));
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
          <Text style={styles.title}>{copy(language, "home.title")}</Text>
        </View>
        <View style={styles.languageToggle}>
          {(["fr", "en"] as Language[]).map((nextLanguage) => {
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

      <View style={styles.mainContent}>
        {homeTab === "search" ? (
          <SearchScreen
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
                  color={selected ? "#1A73D4" : "#94A3B8"}
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
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
                  onToggleFavorite={() => toggleFavorite(selectedDrug.id)}
                  sources={activeDataset.dataset.sources}
                />
              ) : null}
            </View>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ─── Layout ──────────────────────────────────────────────────────────
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#F4F6F9",
  },
  mainContent: {
    flex: 1,
  },
  flex1: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    backgroundColor: "#F4F6F9",
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
    borderBottomColor: "#E4E9EF",
    backgroundColor: "#F4F6F9",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "700",
  },
  languageToggle: {
    flexDirection: "row",
    gap: 6,
  },
  languageButton: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  languageButtonSelected: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  languageButtonText: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "700",
  },
  languageButtonTextSelected: {
    color: "#FFFFFF",
  },

  // ─── Bottom Tab Bar ───────────────────────────────────────────────────
  footer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E4E9EF",
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
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "600",
  },
  topLevelTabTextSelected: {
    color: "#1A73D4",
  },

  // ─── Screen Headers ───────────────────────────────────────────────────
  searchHeader: {
    gap: 4,
  },
  screenTitle: {
    color: "#0F172A",
    fontSize: 20,
    fontWeight: "700",
  },
  screenSubtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── Search Input ─────────────────────────────────────────────────────
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CBD5E1",
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
    color: "#0F172A",
    fontSize: 16,
    paddingVertical: 0,
  },
  searchClear: {
    flexShrink: 0,
  },
  resultCount: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: -4,
  },

  // ─── Recent searches ─────────────────────────────────────────────────
  recentSection: {
    gap: 10,
  },
  sectionLabel: {
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  recentChips: {
    gap: 8,
    paddingRight: 16,
  },
  recentChip: {
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#CBD5E1",
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
    color: "#0F172A",
    fontSize: 13,
    fontWeight: "600",
  },

  // ─── Result Cards ─────────────────────────────────────────────────────
  resultsList: {
    gap: 10,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  classBadge: {
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  classBadgeText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  resultAlias: {
    color: "#64748B",
    fontSize: 13,
    lineHeight: 18,
  },
  matchHint: {
    color: "#1A73D4",
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
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  neutralEmptyCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  neutralEmptyTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  neutralEmptyBody: {
    color: "#64748B",
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
    backgroundColor: "#FFFFFF",
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
    color: "#64748B",
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
    color: "#1A73D4",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },

  // ─── Compliance ───────────────────────────────────────────────────────
  complianceBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#EFF6FF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  complianceBannerText: {
    flex: 1,
    color: "#1E40AF",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "500",
  },
  complianceCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  complianceBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  complianceBadge: {
    color: "#1E40AF",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  complianceTitle: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "700",
  },
  complianceBody: {
    color: "#1E3A5F",
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── Info Screen ──────────────────────────────────────────────────────
  infoAppCard: {
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#1A73D4",
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
    color: "#0F172A",
    fontSize: 18,
    fontWeight: "700",
  },
  infoAppVersion: {
    color: "#64748B",
    fontSize: 13,
  },
  infoMetaCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  infoMetaHeader: {
    color: "#64748B",
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
    borderBottomColor: "#E4E9EF",
  },
  infoMetaLabel: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "500",
  },
  infoMetaValue: {
    color: "#64748B",
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
    borderBottomColor: "#E4E9EF",
    backgroundColor: "#F4F6F9",
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
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
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  detailNavAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#FFFFFF",
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
    backgroundColor: "#DBEAFE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailClassBadgeText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  detailIdBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailIdBadgeText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  detailTitle: {
    color: "#0F172A",
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 30,
  },
  detailSubtitle: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── Segmented Control ────────────────────────────────────────────────
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#E4E9EF",
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
    backgroundColor: "#FFFFFF",
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
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },
  segmentButtonTextSelected: {
    color: "#0F172A",
    fontWeight: "700",
  },
  segmentButtonTextDisabled: {
    color: "#94A3B8",
  },

  // ─── Warning Panel ────────────────────────────────────────────────────
  warningPanel: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
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
    color: "#92400E",
    fontSize: 15,
    fontWeight: "700",
  },
  warningText: {
    color: "#92400E",
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── Metric Cards ─────────────────────────────────────────────────────
  metricGrid: {
    gap: 10,
  },
  metricCard: {
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  metricCardCompact: {
    gap: 4,
  },
  metricLabel: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: "#0F172A",
    fontSize: 22,
    fontWeight: "800",
  },
  metricValueSmall: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "700",
  },

  // ─── Notes ────────────────────────────────────────────────────────────
  notesBlock: {
    gap: 8,
  },
  noteRow: {
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  noteRowWarning: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FCD34D",
    borderLeftWidth: 3,
    borderLeftColor: "#F59E0B",
  },
  noteBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#E4E9EF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  noteBadgeWarning: {
    backgroundColor: "#FEF3C7",
  },
  noteBadgeText: {
    color: "#64748B",
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  noteBadgeTextWarning: {
    color: "#92400E",
  },
  noteText: {
    color: "#0F172A",
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
    flexDirection: "row",
    gap: 12,
  },
  calculatorField: {
    flex: 1,
    gap: 6,
  },
  calcInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#0F172A",
    fontSize: 15,
  },
  fieldHint: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 16,
  },
  calculatorResults: {
    gap: 10,
  },
  calculatorCard: {
    gap: 4,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  calculatorRatio: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
  },
  calculatorMeta: {
    color: "#0F172A",
    fontSize: 13,
    lineHeight: 20,
  },
  emptyState: {
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
  },

  // ─── Source / References ──────────────────────────────────────────────
  sourceSummaryCard: {
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  sourceToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sourceToggleLabel: {
    color: "#1A73D4",
    fontSize: 13,
    fontWeight: "700",
  },
  sourceStack: {
    gap: 10,
  },
  sourceCard: {
    gap: 6,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E4E9EF",
  },
  sourceEyebrow: {
    color: "#1A73D4",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sourceTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontWeight: "700",
  },
  sourceMeta: {
    color: "#64748B",
    fontSize: 13,
  },
  sourceLabel: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 2,
  },
  sourceExcerpt: {
    color: "#0F172A",
    fontSize: 13,
    lineHeight: 20,
  },
});
