import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import { copy } from "../../lib/i18n";
import { useTheme } from "../../theme/ThemeContext";
import type {
  CrossReactivityEntry,
  CrossReactivityGroup,
  CrossReactivityTier,
  DrugRecord,
  Language,
  SourceDocument,
  StructuralRelation,
} from "../../types";

import { centerFontSize, centerMaxLines } from "./OrbitNode";

function highestTier(entries: CrossReactivityEntry[]): CrossReactivityTier {
  if (entries.some((e) => e.tier === "higher-concern")) return "higher-concern";
  if (entries.some((e) => e.tier === "lower-expected")) return "lower-expected";
  return "uncertain";
}

export function OrbitMap({
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
  const [expandedGroupIdx, setExpandedGroupIdx] = useState<number | null>(null);
  const [sheetEntry, setSheetEntry] = useState<{ entry: CrossReactivityEntry; groupName: string } | null>(null);
  const sheetSlide = useRef(new Animated.Value(400)).current;
  const prevSheetEntry = useRef(sheetEntry);
  if (sheetEntry && !prevSheetEntry.current) {
    sheetSlide.setValue(400);
    Animated.spring(sheetSlide, { toValue: 0, useNativeDriver: true, friction: 10, tension: 65 }).start();
  }
  prevSheetEntry.current = sheetEntry;

  const drugNameById: Record<string, { en: string; fr: string }> = {};
  for (const d of allDrugs) drugNameById[d.id] = d.name;

  if (!drug.crossReactivity || drug.crossReactivity.length === 0) {
    return (
      <View style={{ gap: 8, paddingVertical: 24, alignItems: "center" }}>
        <View style={styles.emptyIcon}>
          <Ionicons name="help-circle-outline" size={24} color={theme.textDisabled} />
        </View>
        <Text style={styles.emptyTitle}>{copy(language, "crossReactivity.emptyTitle")}</Text>
        <Text style={styles.emptyBody}>{copy(language, "crossReactivity.emptyBody")}</Text>
      </View>
    );
  }

  const groups = drug.crossReactivity;
  const tierOrder: CrossReactivityTier[] = ["higher-concern", "lower-expected", "uncertain"];

  function tierIcon(tier: CrossReactivityTier): React.ComponentProps<typeof Ionicons>["name"] {
    switch (tier) {
      case "higher-concern": return "alert-circle";
      case "lower-expected": return "checkmark-circle";
      case "uncertain": return "help-circle";
    }
  }
  function tierLabel(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return copy(language, "crossReactivity.tierHigher");
      case "lower-expected": return copy(language, "crossReactivity.tierLower");
      case "uncertain": return copy(language, "crossReactivity.tierUncertain");
    }
  }
  function tierIconColor(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return theme.warningAccent;
      case "lower-expected": return theme.subclassBadgeText;
      case "uncertain": return theme.textDisabled;
    }
  }
  function nodeColor(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return theme.warningAccent;
      case "lower-expected": return theme.subclassBadgeText;
      case "uncertain": return theme.borderMid;
    }
  }
  function nodeBgColor(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return theme.warningBg;
      case "lower-expected": return theme.subclassBadgeBg;
      case "uncertain": return theme.surfaceAlt;
    }
  }
  function nodeBorderColor(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return theme.warningBorder;
      case "lower-expected": return theme.subclassBadgeText;
      case "uncertain": return theme.borderMid;
    }
  }
  function tierBadgeStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.badgeHigher;
      case "lower-expected": return styles.badgeLower;
      case "uncertain": return styles.badgeUncertain;
    }
  }
  function tierBadgeTextStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.badgeHigherText;
      case "lower-expected": return styles.badgeLowerText;
      case "uncertain": return styles.badgeUncertainText;
    }
  }
  function structuralLabel(rel: StructuralRelation) {
    switch (rel) {
      case "structurally-related": return copy(language, "crossReactivity.structurallyRelated");
      case "structurally-distinct": return copy(language, "crossReactivity.structurallyDistinct");
    }
  }

  // ─── Hub-and-spoke geometry ─────────────────────────────────────────────
  const screenW = Dimensions.get("window").width - 32;
  const centerR = 38;
  const groupR = 32;
  const ringRadii: Record<CrossReactivityTier, number> = {
    "higher-concern": centerR + 50,
    "lower-expected": centerR + 95,
    "uncertain": centerR + 140,
  };

  type NodeData = { group: CrossReactivityGroup; idx: number; tier: CrossReactivityTier; x: number; y: number };

  const sortedGroups = groups.map((g, i) => ({ group: g, idx: i, tier: highestTier(g.entries) }))
    .sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier));

  const angleStep = (2 * Math.PI) / Math.max(sortedGroups.length, 1);
  const startAngle = -Math.PI / 2;
  const nodes: NodeData[] = sortedGroups.map((sg, i) => {
    const angle = startAngle + angleStep * i;
    const r = ringRadii[sg.tier];
    return { group: sg.group, idx: sg.idx, tier: sg.tier, x: r * Math.cos(angle), y: r * Math.sin(angle) };
  });

  const usedTiers = [...new Set(nodes.map((n) => n.tier))];
  const maxRing = Math.max(...usedTiers.map((t) => ringRadii[t]));
  const sz = (maxRing + groupR + 40) * 2;
  const ctr = sz / 2;

  return (
    <View style={{ gap: 16 }}>
      {/* ─── Hub-and-spoke diagram ─── */}
      <View style={{ width: sz, height: sz, alignSelf: "center", maxWidth: screenW + 16 }}>
        {/* SVG: ring guides + connecting lines */}
        <Svg width={sz} height={sz} style={StyleSheet.absoluteFill}>
          {usedTiers.map((tier) => (
            <Circle
              key={`ring-${tier}`}
              cx={ctr} cy={ctr} r={ringRadii[tier]}
              fill="none"
              stroke={theme.borderMid}
              strokeWidth={1}
              strokeDasharray="4,6"
              opacity={0.3}
            />
          ))}
          {nodes.map(({ x, y, tier, idx }) => (
            <Line
              key={`line-${idx}`}
              x1={ctr} y1={ctr}
              x2={ctr + x} y2={ctr + y}
              stroke={nodeColor(tier)}
              strokeWidth={1.5}
              opacity={0.35}
            />
          ))}
        </Svg>

        {/* Center node */}
        <View style={{ position: "absolute", left: ctr - centerR, top: ctr - centerR, width: centerR * 2, height: centerR * 2, zIndex: 10 }}>
          <View style={{
            width: centerR * 2, height: centerR * 2, borderRadius: centerR,
            backgroundColor: theme.accent,
            alignItems: "center", justifyContent: "center",
            shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8,
            borderWidth: 2.5, borderColor: theme.surface,
          }}>
            <Text style={{
              color: "#FFF",
              fontSize: centerFontSize(drug.name[language], centerR),
              fontWeight: "800", textAlign: "center",
              paddingHorizontal: 3,
              lineHeight: centerFontSize(drug.name[language], centerR) + 3,
            }} numberOfLines={centerMaxLines(drug.name[language], centerR)}>
              {drug.name[language]}
            </Text>
          </View>
        </View>

        {/* Group nodes */}
        {nodes.map(({ group, idx, tier, x, y }) => {
          const nx = ctr + x;
          const ny = ctr + y;
          const entryCount = group.entries.length;
          const isSelected = expandedGroupIdx === idx;
          return (
            <Pressable
              key={`node-${idx}`}
              onPress={() => setExpandedGroupIdx(isSelected ? null : idx)}
              style={{
                position: "absolute",
                left: nx - groupR,
                top: ny - groupR,
                width: groupR * 2,
                height: groupR * 2,
                zIndex: 5,
              }}
            >
              <View style={{
                width: groupR * 2, height: groupR * 2, borderRadius: groupR,
                backgroundColor: nodeBgColor(tier),
                borderWidth: isSelected ? 3 : 2,
                borderColor: isSelected ? nodeColor(tier) : nodeBorderColor(tier),
                alignItems: "center", justifyContent: "center",
                shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
              }}>
                <Text style={{
                  color: nodeColor(tier),
                  fontSize: entryCount >= 10 ? 16 : 18,
                  fontWeight: "800",
                }}>
                  {entryCount}
                </Text>
              </View>
              {/* Label below/above */}
              <View style={{
                position: "absolute",
                top: y >= 0 ? groupR * 2 + 2 : -30,
                left: -20,
                width: groupR * 2 + 40,
                alignItems: "center",
              }} pointerEvents="none">
                <Text style={{
                  color: theme.textPrimary,
                  fontSize: 11,
                  fontWeight: "700",
                  textAlign: "center",
                  lineHeight: 14,
                }} numberOfLines={2}>
                  {group.groupName[language]}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Hint */}
      <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: "center", fontStyle: "italic" }}>
        {copy(language, "crossReactivity.mapHint")} {drug.name[language].toLowerCase()}.
      </Text>

      {/* Legend */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6, justifyContent: "center" }}>
        {([
          { color: nodeColor("higher-concern"), label: copy(language, "crossReactivity.legendHigher") },
          { color: nodeColor("lower-expected"), label: copy(language, "crossReactivity.legendLower") },
          { color: nodeColor("uncertain"), label: copy(language, "crossReactivity.legendUncertain") },
        ] as const).map(({ color, label: l }) => (
          <View key={l} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* ─── Suggested Panel ─── */}
      {(() => {
        const panelDrugIds = new Set<string>();
        for (const g of groups) for (const id of g.suggestedPanel) panelDrugIds.add(id);
        if (panelDrugIds.size === 0) return null;
        const tierDrugs: Record<CrossReactivityTier, string[]> = { "higher-concern": [], "lower-expected": [], "uncertain": [] };
        for (const g of groups) for (const entry of g.entries) {
          if (panelDrugIds.has(entry.drugId) && !tierDrugs[entry.tier].includes(entry.drugId)) tierDrugs[entry.tier].push(entry.drugId);
        }
        const tierBuckets = tierOrder.filter((t) => tierDrugs[t].length > 0).map((t) => ({ tier: t, drugs: tierDrugs[t] }));
        if (tierBuckets.length === 0) return null;
        return (
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>{copy(language, "crossReactivity.panelTitle")}</Text>
            {tierBuckets.map(({ tier, drugs }) => (
              <View key={tier} style={{ gap: 4 }}>
                <Text style={[styles.panelTierLabel, { color: nodeColor(tier) }]}>{tierLabel(tier)}</Text>
                <Text style={styles.panelDrugList}>{drugs.map((id) => drugNameById[id]?.[language] ?? id).join(", ")}</Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* ─── Group drill-down overlay ─── */}
      <Modal visible={expandedGroupIdx !== null} transparent animationType="fade" onRequestClose={() => setExpandedGroupIdx(null)}>
        <Pressable style={styles.overlayBg} onPress={() => { setExpandedGroupIdx(null); setSheetEntry(null); }}>
          <Pressable onPress={() => {}} style={styles.overlayContent}>
            {expandedGroupIdx !== null ? (() => {
              const group = groups[expandedGroupIdx];
              if (!group) return null;
              const tier = highestTier(group.entries);
              return (
                <View style={styles.overlayCard}>
                  {/* Header */}
                  <View style={styles.overlayHeader}>
                    <View style={[styles.overlayTierDot, { backgroundColor: nodeColor(tier) }]} />
                    <Text style={styles.overlayGroupName}>{group.groupName[language]}</Text>
                    <Pressable onPress={() => { setExpandedGroupIdx(null); setSheetEntry(null); }} hitSlop={8}>
                      <Ionicons name="close" size={20} color={theme.textDisabled} />
                    </Pressable>
                  </View>
                  <View style={styles.overlayBadgeRow}>
                    <View style={tierBadgeStyle(tier)}>
                      <Ionicons name={tierIcon(tier)} size={10} color={tierIconColor(tier)} />
                      <Text style={tierBadgeTextStyle(tier)}>{tierLabel(tier)}</Text>
                    </View>
                    <Text style={styles.overlayCount}>
                      {group.entries.length} {copy(language, "crossReactivity.drugs")}
                    </Text>
                  </View>

                  {/* Drug list */}
                  <ScrollView style={styles.overlayScroll} bounces={false} showsVerticalScrollIndicator={false}>
                    {group.entries.map((entry) => {
                      const name = drugNameById[entry.drugId];
                      const displayName = name ? name[language] : entry.drugId;
                      const isNavigable = Boolean(name);
                      return (
                        <Pressable
                          key={entry.drugId}
                          onPress={() => setSheetEntry({ entry, groupName: group.groupName[language] })}
                          style={styles.drugRow}
                        >
                          <View style={[styles.drugDot, { backgroundColor: nodeColor(entry.tier) }]} />
                          <View style={styles.drugInfo}>
                            <Text style={styles.drugName}>{displayName}</Text>
                            <View style={styles.drugBadges}>
                              <View style={tierBadgeStyle(entry.tier)}>
                                <Text style={tierBadgeTextStyle(entry.tier)}>{tierLabel(entry.tier)}</Text>
                              </View>
                              <View style={styles.structBadge}>
                                <Text style={styles.structBadgeText}>{structuralLabel(entry.structuralRelation)}</Text>
                              </View>
                            </View>
                          </View>
                          {isNavigable ? (
                            <Pressable onPress={() => { setSheetEntry(null); setExpandedGroupIdx(null); onOpenDrug(entry.drugId); }} hitSlop={8} style={styles.drugOpenBtn}>
                              <Ionicons name="open-outline" size={14} color={theme.accent} />
                            </Pressable>
                          ) : null}
                          <Ionicons name="chevron-forward" size={14} color={theme.textDisabled} />
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              );
            })() : null}
          </Pressable>
        </Pressable>

        {/* ─── Drug detail bottom sheet ─── */}
        {sheetEntry ? (
          <Pressable style={[styles.sheetOverlay, { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }]} onPress={() => setSheetEntry(null)}>
            <Animated.View style={[styles.sheetContainer, { transform: [{ translateY: sheetSlide }] }]}>
              <Pressable onPress={() => {}} style={{ width: "100%" }}>
                <View style={styles.sheetHandle} />
                {(() => {
                  const { entry, groupName } = sheetEntry;
                  const name = drugNameById[entry.drugId];
                  const isNavigable = Boolean(name);
                  const displayName = name ? name[language] : entry.drugId;
                  const sourceCitations = entry.sourceIds.map((sid) => sources[sid]?.label).filter(Boolean);
                  return (
                    <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                      <View style={styles.sheetTitleRow}>
                        <Text style={styles.sheetDrugName}>{drug.name[language]}</Text>
                        <Text style={styles.sheetArrow}>↔</Text>
                        <Text style={[styles.sheetDrugName, { flex: 1 }]} numberOfLines={1}>{displayName}</Text>
                      </View>
                      <View style={[styles.sheetBadgeRow, { marginBottom: 16 }]}>
                        <View style={tierBadgeStyle(entry.tier)}>
                          <Ionicons name={tierIcon(entry.tier)} size={12} color={tierIconColor(entry.tier)} />
                          <Text style={tierBadgeTextStyle(entry.tier)}>{tierLabel(entry.tier)}</Text>
                        </View>
                        <View style={styles.structBadge}>
                          <Text style={styles.structBadgeText}>{structuralLabel(entry.structuralRelation)}</Text>
                        </View>
                      </View>
                      <View style={styles.sheetSection}>
                        <Text style={styles.sheetSectionLabel}>{copy(language, "crossReactivity.whyLinked")}</Text>
                        <View style={styles.sheetRationaleBox}>
                          <Text style={styles.sheetMechanism}>{groupName}</Text>
                        </View>
                      </View>
                      <View style={styles.sheetDivider} />
                      <View style={styles.sheetSection}>
                        <Text style={styles.sheetSectionLabel}>{copy(language, "crossReactivity.clinicalNote")}</Text>
                        <Text style={styles.sheetRationale}>{entry.rationale[language]}</Text>
                      </View>
                      {sourceCitations.length > 0 ? (<><View style={styles.sheetDivider} /><Text style={styles.sheetSource}>{copy(language, "crossReactivity.source")}: {sourceCitations.join(", ")}</Text></>) : null}
                      {isNavigable ? (<><View style={styles.sheetDivider} /><Pressable style={styles.sheetActionBtn} onPress={() => { setSheetEntry(null); setExpandedGroupIdx(null); onOpenDrug(entry.drugId); }}><Ionicons name="open-outline" size={16} color={theme.accent} /><Text style={styles.sheetActionText}>{copy(language, "crossReactivity.openDrug")} — {displayName}</Text></Pressable></>) : null}
                    </ScrollView>
                  );
                })()}
              </Pressable>
            </Animated.View>
          </Pressable>
        ) : null}
      </Modal>
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    emptyIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },
    emptyTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" },
    emptyBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, textAlign: "center" },

    /* Tier badges */
    badgeHigher: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.warningBg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: theme.warningBorder },
    badgeHigherText: { color: theme.warningText, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    badgeLower: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.subclassBadgeBg, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
    badgeLowerText: { color: theme.subclassBadgeText, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    badgeUncertain: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: theme.border },
    badgeUncertainText: { color: theme.textSecondary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    structBadge: { backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: theme.border },
    structBadgeText: { color: theme.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

    /* Suggested panel */
    panelCard: { backgroundColor: theme.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, padding: 16, gap: 14 },
    panelTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    panelTierLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    panelDrugList: { fontSize: 14, fontWeight: "500", color: theme.textPrimary },

    /* Overlay */
    overlayBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
    overlayContent: { width: "100%", maxHeight: "80%" },
    overlayCard: { backgroundColor: theme.surface, borderRadius: 16, overflow: "hidden" },
    overlayHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, paddingBottom: 8 },
    overlayTierDot: { width: 10, height: 10, borderRadius: 5 },
    overlayGroupName: { flex: 1, color: theme.textPrimary, fontSize: 17, fontWeight: "800" },
    overlayBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    overlayCount: { color: theme.textSecondary, fontSize: 12, fontWeight: "600" },
    overlayScroll: { maxHeight: 400 },

    /* Drug rows */
    drugRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border },
    drugDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
    drugInfo: { flex: 1, gap: 4 },
    drugName: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
    drugBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    drugOpenBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.accentBg, alignItems: "center", justifyContent: "center", flexShrink: 0 },

    /* Bottom sheet */
    sheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
    sheetContainer: { backgroundColor: theme.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 34, maxHeight: "80%" },
    sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: theme.borderMid, alignSelf: "center", marginBottom: 16 },
    sheetTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
    sheetArrow: { color: theme.textDisabled, fontSize: 14, fontWeight: "600" },
    sheetDrugName: { color: theme.accent, fontSize: 17, fontWeight: "800" },
    sheetBadgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    sheetSection: { gap: 6 },
    sheetSectionLabel: { color: theme.textSecondary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    sheetRationaleBox: { backgroundColor: theme.surfaceAlt, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: theme.border },
    sheetMechanism: { color: theme.textSecondary, fontSize: 12, textAlign: "center", fontStyle: "italic" },
    sheetRationale: { color: theme.textPrimary, fontSize: 14, lineHeight: 22 },
    sheetDivider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
    sheetSource: { color: theme.textDisabled, fontSize: 12 },
    sheetActionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, padding: 13, borderWidth: 1, borderColor: theme.accentBorder, backgroundColor: theme.accentBg },
    sheetActionText: { color: theme.accent, fontSize: 14, fontWeight: "700" },
  });
}
