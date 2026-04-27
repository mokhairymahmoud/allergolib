import { StatusBar } from "expo-status-bar";
import { startTransition, useEffect, useState } from "react";
import {
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

function ComplianceCard({ language }: { language: Language }) {
  return (
    <View style={styles.complianceCard}>
      <Text style={styles.complianceBadge}>{copy(language, "compliance.badge")}</Text>
      <Text style={styles.complianceTitle}>{copy(language, "compliance.title")}</Text>
      <Text style={styles.complianceBody}>{copy(language, "compliance.body")}</Text>
    </View>
  );
}

function SavePill({
  language,
  isSaved,
  onPress,
}: {
  language: Language;
  isSaved: boolean;
  onPress?: () => void;
}) {
  if (!onPress) {
    return (
      <View style={[styles.savePill, isSaved && styles.savePillActive]}>
        <Text style={[styles.savePillText, isSaved && styles.savePillTextActive]}>
          {copy(language, isSaved ? "detail.saved" : "detail.save")}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={[styles.savePill, isSaved && styles.savePillActive]}
    >
      <Text style={[styles.savePillText, isSaved && styles.savePillTextActive]}>
        {copy(language, isSaved ? "detail.saved" : "detail.save")}
      </Text>
    </Pressable>
  );
}

function DrugRow({
  language,
  result,
  isSaved,
  onPress,
}: {
  language: Language;
  result: DrugSearchResult;
  isSaved: boolean;
  onPress: () => void;
}) {
  const matchCopy = matchLabel(language, result);

  return (
    <Pressable onPress={onPress} style={styles.resultCard}>
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleColumn}>
          <Text style={styles.resultName}>{result.drug.name[language]}</Text>
          <Text style={styles.resultAlias}>
            {copy(language, "search.aliases")}: {result.drug.aliases.join(", ")}
          </Text>
        </View>
        <View style={styles.resultHeaderBadges}>
          {isSaved ? <SavePill language={language} isSaved /> : null}
          <View style={styles.classBadge}>
            <Text style={styles.classBadgeText}>{result.drug.className[language]}</Text>
          </View>
        </View>
      </View>
      {matchCopy && result.matchedText ? (
        <Text style={styles.matchHint}>
          {matchCopy}: {result.matchedText}
        </Text>
      ) : null}
    </Pressable>
  );
}

function SectionIntro({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <View style={styles.sectionIntro}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.panelBody}>{body}</Text>
    </View>
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
}: {
  language: Language;
  query: string;
  searchResults: DrugSearchResult[];
  recentDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onChangeQuery: (value: string) => void;
  onOpenDrug: (drugId: string) => void;
}) {
  const favoriteDrugSet = new Set(favoriteDrugIds);
  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.searchHeroCard}>
        <Text style={styles.searchHeroTitle}>{copy(language, "search.heroTitle")}</Text>
        <Text style={styles.searchHeroBody}>{copy(language, "search.heroBody")}</Text>
        <View style={styles.searchInputWrap}>
          <Text style={styles.metricLabel}>{copy(language, "search.title")}</Text>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={onChangeQuery}
            placeholder={copy(language, "search.placeholder")}
            placeholderTextColor="#6B7888"
            style={styles.searchInput}
            value={query}
          />
        </View>
        {hasQuery ? (
          <Text style={styles.searchSummary}>
            {searchResults.length} {copy(language, "search.results")}
          </Text>
        ) : null}
      </View>

      {hasQuery ? (
        <>
          {searchResults.length ? (
            <View style={styles.resultsList}>
              {searchResults.map((result) => (
                <DrugRow
                  key={result.drug.id}
                  isSaved={favoriteDrugSet.has(result.drug.id)}
                  language={language}
                  onPress={() => onOpenDrug(result.drug.id)}
                  result={result}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{copy(language, "search.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{copy(language, "search.emptyBody")}</Text>
            </View>
          )}
        </>
      ) : (
        <View style={styles.panel}>
          <SectionIntro
            title={copy(language, "search.recentTitle")}
            body={copy(language, "search.recentBody")}
          />
          {recentDrugs.length ? (
            <View style={styles.resultsList}>
              {recentDrugs.map((drug) => (
                <DrugRow
                  key={`recent-${drug.id}`}
                  isSaved={favoriteDrugSet.has(drug.id)}
                  language={language}
                  onPress={() => onOpenDrug(drug.id)}
                  result={{
                    drug,
                    score: Number.MAX_SAFE_INTEGER,
                  }}
                />
              ))}
            </View>
          ) : (
            <NeutralEmptyCard
              title={copy(language, "search.emptyRecentTitle")}
              body={copy(language, "search.emptyRecentBody")}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

function FavoritesScreen({
  language,
  favoriteDrugs,
  favoriteDrugIds,
  onOpenDrug,
}: {
  language: Language;
  favoriteDrugs: DrugRecord[];
  favoriteDrugIds: string[];
  onOpenDrug: (drugId: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.panel}>
        <SectionIntro
          title={copy(language, "favorites.title")}
          body={copy(language, "favorites.body")}
        />
        {favoriteDrugs.length ? (
          <View style={styles.resultsList}>
            {favoriteDrugs.map((drug) => (
              <DrugRow
                key={`favorite-${drug.id}`}
                isSaved={favoriteDrugIds.includes(drug.id)}
                language={language}
                onPress={() => onOpenDrug(drug.id)}
                result={{
                  drug,
                  score: Number.MAX_SAFE_INTEGER,
                }}
              />
            ))}
          </View>
        ) : (
          <NeutralEmptyCard
            title={copy(language, "favorites.emptyTitle")}
            body={copy(language, "favorites.emptyBody")}
          />
        )}
      </View>
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
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.panel}>
        <SectionIntro
          title={copy(language, "info.title")}
          body={copy(language, "info.body")}
        />
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.heroMeta}>{copy(language, "info.releaseCardTitle")}</Text>
        <Text style={styles.heroTitle}>{copy(language, "home.heroTitle")}</Text>
        <Text style={styles.heroBody}>{copy(language, "home.heroBody")}</Text>
        <Text style={styles.heroMetaSecondary}>
          {copy(language, "home.release")}: {activeDataset.manifest.version}
        </Text>
        <Text style={styles.heroMetaSecondary}>
          {copy(language, "home.datasetOrigin")}:{" "}
          {copy(language, datasetOriginLabelKey(activeDataset.origin))}
        </Text>
        <Text style={styles.heroMetaSecondary}>
          {copy(language, "home.approvedBy")}: {activeDataset.manifest.approvedBy}
        </Text>
        <Text style={styles.heroMetaSecondary}>
          {copy(language, "home.releasedAt")}:{" "}
          {formatReleaseDate(activeDataset.manifest.releasedAt, language)}
        </Text>
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
}: {
  language: Language;
  notes: TestNote[];
}) {
  return (
    <View style={styles.notesBlock}>
      {notes.map((note, index) => (
        <View
          key={`${note.kind}-${note.value.en}-${note.value.fr}-${index}`}
          style={styles.noteRow}
        >
          <View style={styles.noteBadge}>
            <Text style={styles.noteBadgeText}>{noteLabel(language, note.kind)}</Text>
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
      <Text style={styles.sectionTitle}>{copy(language, "detail.calculatorTitle")}</Text>
      <Text style={styles.panelBody}>{copy(language, "detail.calculatorBody")}</Text>

      <View style={styles.calculatorRow}>
        <View style={styles.calculatorField}>
          <Text style={styles.metricLabel}>{copy(language, "detail.calculatorStock")}</Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setStockConcentration}
            placeholder={copy(language, "detail.calculatorStockPlaceholder")}
            placeholderTextColor="#6D7B8A"
            style={styles.searchInput}
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
            placeholderTextColor="#6D7B8A"
            style={styles.searchInput}
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

  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>{copy(language, "detail.back")}</Text>
      </Pressable>

      <View style={styles.detailHeader}>
        <View style={styles.detailHeaderTop}>
          <View style={styles.detailHeaderTitleBlock}>
            <Text style={styles.detailEyebrow}>{drug.className[language]}</Text>
            <Text style={styles.detailTitle}>{drug.name[language]}</Text>
          </View>
          <SavePill language={language} isSaved={isSaved} onPress={onToggleFavorite} />
        </View>
        <Text style={styles.detailSubtitle}>{copy(language, "detail.seedNotice")}</Text>
      </View>

      <ComplianceCard language={language} />

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

      {!canShowProvenance ? (
        <View style={styles.warningPanel}>
          <Text style={styles.warningTitle}>
            {copy(language, "detail.provenanceUnavailableTitle")}
          </Text>
          <Text style={styles.warningText}>
            {copy(language, "detail.provenanceUnavailableBody")}
          </Text>
        </View>
      ) : null}

      {canShowProvenance ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>{copy(language, "detail.validatedData")}</Text>

          {shouldShowStandardConcentration ? (
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
              <Text style={styles.metricValueSmall}>{test.dilutions.join(" -> ")}</Text>
            </View>
          ) : null}

          {test.vehicle ? (
            <View style={styles.metricBlock}>
              <Text style={styles.metricLabel}>{copy(language, "detail.patch.vehicle")}</Text>
              <Text style={styles.metricValueSmall}>{test.vehicle[language]}</Text>
            </View>
          ) : null}

          {!shouldShowStandardConcentration &&
          !test.maxConcentration &&
          !test.dilutions.length &&
          !test.vehicle ? (
            <Text style={styles.emptyState}>{copy(language, "detail.noTestData")}</Text>
          ) : null}
        </View>
      ) : null}

      {canShowProvenance && warnings.length ? (
        <View style={styles.warningPanel}>
          <Text style={styles.warningTitle}>{copy(language, "detail.warnings")}</Text>
          <NoteList language={language} notes={warnings} />
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
          <Pressable onPress={() => setShowSource((current) => !current)} style={styles.sourceToggle}>
            <View>
              <Text style={styles.sectionTitle}>{copy(language, "detail.source")}</Text>
              <Text style={styles.sourceLabel}>{preferredSource.label}</Text>
            </View>
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
    </ScrollView>
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

  if (selectedDrug) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.container}>
          <DetailScreen
            drug={selectedDrug}
            isSaved={favoriteDrugIds.includes(selectedDrug.id)}
            language={language}
            onBack={() => {
              startTransition(() => setSelectedDrugId(null));
            }}
            onToggleFavorite={() => toggleFavorite(selectedDrug.id)}
            sources={activeDataset.dataset.sources}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.titleBlock}>
            <Text style={styles.eyebrow}>{copy(language, "home.eyebrow")}</Text>
            <Text style={styles.title}>{copy(language, "home.title")}</Text>
          </View>
          <View style={styles.topBarBody}>
            <Text style={styles.topBarLabel}>{copy(language, "home.language")}</Text>
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
        </View>

        <View style={styles.topLevelTabs}>
          {HOME_TABS.map((tab) => {
            const selected = tab === homeTab;

            return (
              <Pressable
                key={tab}
                onPress={() => setHomeTab(tab)}
                style={[styles.topLevelTab, selected && styles.topLevelTabSelected]}
              >
                <Text
                  style={[styles.topLevelTabText, selected && styles.topLevelTabTextSelected]}
                >
                  {copy(language, homeTabLabelKey(tab))}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {homeTab === "search" ? (
          <SearchScreen
            favoriteDrugIds={favoriteDrugIds}
            language={language}
            onChangeQuery={setQuery}
            onOpenDrug={openDrug}
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
          />
        ) : null}

        {homeTab === "info" ? (
          <InfoScreen activeDataset={activeDataset} language={language} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  container: {
    flex: 1,
    backgroundColor: "#EEF3F8",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
    gap: 16,
  },
  titleBlock: {
    flex: 1,
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
  topBarBody: {
    alignItems: "flex-end",
    gap: 8,
  },
  topBarLabel: {
    color: "#536070",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
  topLevelTabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  topLevelTab: {
    flex: 1,
    backgroundColor: "#F7FAFC",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D5DEE7",
    paddingVertical: 13,
    alignItems: "center",
  },
  topLevelTabSelected: {
    backgroundColor: "#16353D",
    borderColor: "#16353D",
  },
  topLevelTabText: {
    color: "#536070",
    fontSize: 13,
    fontWeight: "800",
  },
  topLevelTabTextSelected: {
    color: "#F7F9FB",
  },
  screenContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 16,
  },
  sectionIntro: {
    gap: 6,
  },
  searchHeroCard: {
    backgroundColor: "#16353D",
    borderRadius: 28,
    padding: 22,
    gap: 16,
  },
  searchHeroTitle: {
    color: "#F7F3EA",
    fontSize: 24,
    fontWeight: "800",
  },
  searchHeroBody: {
    color: "#D7E6E2",
    fontSize: 15,
    lineHeight: 22,
  },
  searchInputWrap: {
    gap: 8,
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
  heroMetaSecondary: {
    color: "#D7E6E2",
    fontSize: 13,
    lineHeight: 20,
  },
  complianceCard: {
    backgroundColor: "#FFF6E8",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F2CFA2",
    gap: 8,
  },
  complianceBadge: {
    color: "#8A3312",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  complianceTitle: {
    color: "#16222E",
    fontSize: 16,
    fontWeight: "800",
  },
  complianceBody: {
    color: "#5A4331",
    fontSize: 14,
    lineHeight: 20,
  },
  panel: {
    backgroundColor: "#FCFBF7",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    gap: 14,
  },
  panelBody: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
  },
  neutralEmptyCard: {
    backgroundColor: "#F4F7FA",
    borderRadius: 18,
    padding: 16,
    gap: 8,
  },
  neutralEmptyTitle: {
    color: "#16222E",
    fontSize: 15,
    fontWeight: "800",
  },
  neutralEmptyBody: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
  },
  warningPanel: {
    backgroundColor: "#FCE6D8",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F2C1AB",
    gap: 12,
  },
  warningTitle: {
    color: "#8A3312",
    fontSize: 16,
    fontWeight: "800",
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
  fieldHint: {
    color: "#536070",
    fontSize: 12,
    lineHeight: 18,
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
  resultTitleColumn: {
    flex: 1,
    gap: 6,
  },
  resultHeaderBadges: {
    alignItems: "flex-end",
    gap: 8,
  },
  resultName: {
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
  savePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "#D8D4CB",
    backgroundColor: "#FCFBF7",
  },
  savePillActive: {
    borderColor: "#0E6B66",
    backgroundColor: "#E3F0ED",
  },
  savePillText: {
    color: "#536070",
    fontSize: 12,
    fontWeight: "800",
  },
  savePillTextActive: {
    color: "#0E6B66",
  },
  resultAlias: {
    color: "#536070",
    fontSize: 13,
    lineHeight: 18,
  },
  matchHint: {
    color: "#0E6B66",
    fontSize: 13,
    fontWeight: "700",
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
  detailHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  detailHeaderTitleBlock: {
    flex: 1,
    gap: 8,
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
  metricValueSmall: {
    color: "#16222E",
    fontSize: 18,
    fontWeight: "700",
  },
  notesBlock: {
    gap: 10,
  },
  noteRow: {
    gap: 8,
  },
  noteBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF2F5",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  noteBadgeText: {
    color: "#536070",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  noteText: {
    color: "#223243",
    fontSize: 15,
    lineHeight: 22,
  },
  warningText: {
    color: "#8A3312",
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    color: "#536070",
    fontSize: 14,
    lineHeight: 20,
  },
  calculatorRow: {
    flexDirection: "row",
    gap: 12,
  },
  calculatorField: {
    flex: 1,
    gap: 8,
  },
  calculatorResults: {
    gap: 12,
  },
  calculatorCard: {
    gap: 6,
    backgroundColor: "#F4F7FA",
    borderRadius: 18,
    padding: 14,
  },
  calculatorRatio: {
    color: "#16222E",
    fontSize: 18,
    fontWeight: "800",
  },
  calculatorMeta: {
    color: "#223243",
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
  sourceStack: {
    gap: 12,
  },
  sourceCard: {
    gap: 8,
    backgroundColor: "#F4F7FA",
    borderRadius: 18,
    padding: 14,
  },
  sourceEyebrow: {
    color: "#0E6B66",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
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
