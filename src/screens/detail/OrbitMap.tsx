import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, Path, Text as SvgText, TextPath } from "react-native-svg";

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

import { OrbitNode, centerFontSize } from "./OrbitNode";

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
  const [sheetEntry, setSheetEntry] = useState<{
    entry: CrossReactivityEntry;
    groupName: string;
  } | null>(null);

  const [expandedGroupIdx, setExpandedGroupIdx] = useState<number | null>(null);
  const sheetSlide = useRef(new Animated.Value(400)).current;

  const prevSheetEntry = useRef(sheetEntry);
  if (sheetEntry && !prevSheetEntry.current) {
    sheetSlide.setValue(400);
    Animated.spring(sheetSlide, { toValue: 0, useNativeDriver: true, friction: 10, tension: 65 }).start();
  }
  prevSheetEntry.current = sheetEntry;

  const drugNameById: Record<string, { en: string; fr: string }> = {};
  for (const d of allDrugs) {
    drugNameById[d.id] = d.name;
  }

  if (!drug.crossReactivity || drug.crossReactivity.length === 0) {
    return (
      <View style={{ gap: 8, paddingVertical: 24, alignItems: "center" }}>
        <View style={styles.crEmptyIcon}>
          <Ionicons name="help-circle-outline" size={24} color={theme.textDisabled} />
        </View>
        <Text style={styles.crEmptyTitle}>{copy(language, "crossReactivity.emptyTitle")}</Text>
        <Text style={styles.crEmptyBody}>{copy(language, "crossReactivity.emptyBody")}</Text>
      </View>
    );
  }

  const groups = drug.crossReactivity;

  function tierIcon(tier: CrossReactivityTier): React.ComponentProps<typeof Ionicons>["name"] {
    switch (tier) {
      case "higher-concern": return "alert-circle";
      case "lower-expected": return "checkmark-circle";
      case "uncertain": return "help-circle";
    }
  }
  function tierBadgeStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.crBadgeHigher;
      case "lower-expected": return styles.crBadgeLower;
      case "uncertain": return styles.crBadgeUncertain;
    }
  }
  function tierBadgeTextStyle(tier: CrossReactivityTier) {
    switch (tier) {
      case "higher-concern": return styles.crBadgeHigherText;
      case "lower-expected": return styles.crBadgeLowerText;
      case "uncertain": return styles.crBadgeUncertainText;
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
  function structuralLabel(rel: StructuralRelation) {
    switch (rel) {
      case "structurally-related": return copy(language, "crossReactivity.structurallyRelated");
      case "structurally-distinct": return copy(language, "crossReactivity.structurallyDistinct");
    }
  }

  const screenW = Dimensions.get("window").width - 32;

  function evenAngles(count: number, startAngle = -Math.PI / 2) {
    return Array.from({ length: count }, (_, i) =>
      startAngle + (2 * Math.PI * i) / Math.max(count, 1)
    );
  }

  const centerR = 42;
  const arcThickness = 36;
  const ringGap = 8;
  const firstRingOffset = 10;
  const tierRadii: Record<CrossReactivityTier, number> = {
    "higher-concern": centerR + firstRingOffset,
    "lower-expected": centerR + firstRingOffset + arcThickness + ringGap,
    "uncertain": centerR + firstRingOffset + (arcThickness + ringGap) * 2,
  };

  const tierOrder: CrossReactivityTier[] = ["higher-concern", "lower-expected", "uncertain"];
  type ArcData = { group: CrossReactivityGroup; idx: number; tier: CrossReactivityTier; orbitR: number; startAngle: number; sweepAngle: number; midAngle: number };
  const arcs: ArcData[] = [];

  const tierBaseOffsets: Record<CrossReactivityTier, number> = {
    "higher-concern": -Math.PI / 2,
    "lower-expected": -Math.PI / 2 + (2 * Math.PI) / 3,
    "uncertain": -Math.PI / 2 - (2 * Math.PI) / 3,
  };

  for (const tier of tierOrder) {
    const tierGroups = groups
      .map((g, i) => ({ group: g, idx: i }))
      .filter(({ group }) => highestTier(group.entries) === tier);
    if (tierGroups.length === 0) continue;

    const orbitR = tierRadii[tier];
    const n = tierGroups.length;
    const gapAngle = 0.15;
    const sweepPerGroup = (2 * Math.PI - gapAngle * n) / n;
    const clampedSweep = Math.min(sweepPerGroup, Math.PI * 0.8);

    const totalUsed = clampedSweep * n + gapAngle * n;
    let angle = tierBaseOffsets[tier] - totalUsed / 2 + gapAngle / 2;

    for (const { group, idx } of tierGroups) {
      arcs.push({ group, idx, tier, orbitR, startAngle: angle, sweepAngle: clampedSweep, midAngle: angle + clampedSweep / 2 });
      angle += clampedSweep + gapAngle;
    }
  }

  const maxR = Math.max(...arcs.map((a) => a.orbitR + arcThickness), centerR + 40);
  const sz = (maxR + 70) * 2;
  const c = sz / 2;

  function arcPath(sa: number, sweep: number, innerR: number, outerR: number): string {
    const ea = sa + sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const ox1 = c + outerR * Math.cos(sa);
    const oy1 = c + outerR * Math.sin(sa);
    const ox2 = c + outerR * Math.cos(ea);
    const oy2 = c + outerR * Math.sin(ea);
    const ix2 = c + innerR * Math.cos(ea);
    const iy2 = c + innerR * Math.sin(ea);
    const ix1 = c + innerR * Math.cos(sa);
    const iy1 = c + innerR * Math.sin(sa);
    return [
      `M ${ox1} ${oy1}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${ox2} ${oy2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={{ width: sz, height: sz, alignSelf: "center" }}>
        <Svg width={sz} height={sz}>
          {[...new Set(arcs.map((a) => a.orbitR))].map((r) => {
            const gr = r + arcThickness / 2;
            return (
              <Path
                key={`guide-${r}`}
                d={`M ${c - gr} ${c} A ${gr} ${gr} 0 1 1 ${c + gr} ${c} A ${gr} ${gr} 0 1 1 ${c - gr} ${c}`}
                fill="none"
                stroke={theme.borderMid}
                strokeWidth={1}
                strokeDasharray="4,6"
                opacity={0.25}
              />
            );
          })}
          {arcs.map(({ tier, orbitR, startAngle, sweepAngle, idx: gIdx }) => (
            <Path
              key={`arc-${gIdx}`}
              d={arcPath(startAngle, sweepAngle, orbitR, orbitR + arcThickness)}
              fill={nodeColor(tier)}
              opacity={0.9}
              onPress={() => setExpandedGroupIdx(gIdx)}
            />
          ))}
          <Defs>
            {arcs.map(({ startAngle, sweepAngle, orbitR, idx: gIdx, midAngle }) => {
              const textR = orbitR + arcThickness / 2;
              const sa = startAngle;
              const ea = startAngle + sweepAngle;
              const normMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
              const isBottom = normMid > Math.PI * 0.15 && normMid < Math.PI * 0.85;
              if (isBottom) {
                const sx = c + textR * Math.cos(ea);
                const sy = c + textR * Math.sin(ea);
                const ex = c + textR * Math.cos(sa);
                const ey = c + textR * Math.sin(sa);
                return <Path key={`tp-${gIdx}`} id={`textarc-${gIdx}`} d={`M ${sx} ${sy} A ${textR} ${textR} 0 0 0 ${ex} ${ey}`} fill="none" />;
              }
              const sx = c + textR * Math.cos(sa);
              const sy = c + textR * Math.sin(sa);
              const ex = c + textR * Math.cos(ea);
              const ey = c + textR * Math.sin(ea);
              return <Path key={`tp-${gIdx}`} id={`textarc-${gIdx}`} d={`M ${sx} ${sy} A ${textR} ${textR} 0 0 1 ${ex} ${ey}`} fill="none" />;
            })}
          </Defs>
          {arcs.map(({ group, idx: gIdx }) => (
            <SvgText key={`txt-${gIdx}`} fill="#FFF" fontSize={10} fontWeight="700" dy={4} textAnchor="middle" onPress={() => setExpandedGroupIdx(gIdx)}>
              <TextPath href={`#textarc-${gIdx}`} startOffset="50%">
                {group.groupName[language]}
              </TextPath>
            </SvgText>
          ))}
        </Svg>

        {/* Center node */}
        <View style={{ position: "absolute", left: c - centerR, top: c - centerR, width: centerR * 2, height: centerR * 2, zIndex: 10 }}>
          <View
            style={{ width: centerR * 2, height: centerR * 2, borderRadius: centerR, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 8, borderWidth: 3, borderColor: theme.surface }}
          >
            <Text style={{ color: "#FFF", fontSize: centerFontSize(drug.name[language], centerR), fontWeight: "800", textAlign: "center", paddingHorizontal: 4, lineHeight: centerFontSize(drug.name[language], centerR) + 3 }} numberOfLines={drug.name[language].trim().split(/\s+/).length >= 2 ? 2 : 1}>{drug.name[language]}</Text>
          </View>
        </View>
      </View>

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
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
            <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{l}</Text>
          </View>
        ))}
      </View>

      {/* Suggested Panel card */}
      {(() => {
        const panelDrugIds = new Set<string>();
        for (const g of groups) {
          for (const id of g.suggestedPanel) panelDrugIds.add(id);
        }
        if (panelDrugIds.size === 0) return null;

        const tierBuckets: { tier: CrossReactivityTier; drugs: string[] }[] = [];
        const tierDrugs: Record<CrossReactivityTier, string[]> = {
          "higher-concern": [],
          "lower-expected": [],
          "uncertain": [],
        };
        for (const g of groups) {
          for (const entry of g.entries) {
            if (panelDrugIds.has(entry.drugId) && !tierDrugs[entry.tier].includes(entry.drugId)) {
              tierDrugs[entry.tier].push(entry.drugId);
            }
          }
        }
        for (const tier of tierOrder) {
          if (tierDrugs[tier].length > 0) tierBuckets.push({ tier, drugs: tierDrugs[tier] });
        }
        if (tierBuckets.length === 0) return null;

        return (
          <View style={styles.suggestedPanelCard}>
            <Text style={styles.suggestedPanelTitle}>{copy(language, "crossReactivity.panelTitle")}</Text>
            {tierBuckets.map(({ tier, drugs }) => (
              <View key={tier} style={{ gap: 4 }}>
                <Text style={[styles.suggestedPanelTierLabel, { color: nodeColor(tier) }]}>{tierLabel(tier)}</Text>
                <Text style={styles.suggestedPanelDrugList}>
                  {drugs.map((id) => drugNameById[id]?.[language] ?? id).join(", ")}
                </Text>
              </View>
            ))}
          </View>
        );
      })()}

      {/* Group drill-down overlay */}
      <Modal visible={expandedGroupIdx !== null} transparent animationType="fade" onRequestClose={() => setExpandedGroupIdx(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.82)", justifyContent: "center", alignItems: "center" }} onPress={() => setExpandedGroupIdx(null)}>
          <Pressable onPress={() => {}} style={{ width: screenW, alignItems: "center" }}>
            {expandedGroupIdx !== null ? (() => {
              const eGroup = groups[expandedGroupIdx];
              if (!eGroup) return null;
              const entries = eGroup.entries;
              const eTier = highestTier(entries);
              const eGR = 48;
              const eNR = 28;
              const eLabelW = 120;
              const eOrbitR = eGR + eNR + 44;
              const ePad = 32;
              const eSz = (eOrbitR + eNR + ePad) * 2;
              const eC = eSz / 2;
              const eAngles = evenAngles(entries.length);
              const eFontSize = centerFontSize(eGroup.groupName[language], eGR);
              return (
                <View style={{ width: eSz, height: eSz, overflow: "visible" }}>
                  <View style={{ position: "absolute", left: eC - eOrbitR, top: eC - eOrbitR, width: eOrbitR * 2, height: eOrbitR * 2, borderRadius: eOrbitR, borderWidth: 1.5, borderColor: nodeBorderColor(eTier), borderStyle: "dashed", opacity: 0.25 }} />
                  <View style={{ position: "absolute", left: eC - eGR, top: eC - eGR, width: eGR * 2, height: eGR * 2, borderRadius: eGR, backgroundColor: nodeBgColor(eTier), borderWidth: 2.5, borderColor: nodeBorderColor(eTier), alignItems: "center", justifyContent: "center", zIndex: 10, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 8 }}>
                    <Text style={{ color: nodeColor(eTier), fontSize: eFontSize, fontWeight: "800", textAlign: "center", paddingHorizontal: 6, lineHeight: eFontSize + 3 }} numberOfLines={eGroup.groupName[language].trim().split(/\s+/).length >= 2 ? 2 : 1}>{eGroup.groupName[language]}</Text>
                  </View>
                  {entries.map((entry, idx) => {
                    const angle = eAngles[idx];
                    const nx = eC + eOrbitR * Math.cos(angle);
                    const ny = eC + eOrbitR * Math.sin(angle);
                    const name = drugNameById[entry.drugId];
                    const label = name ? name[language] : entry.drugId;
                    const isBelow = Math.sin(angle) >= -0.25;
                    const labelTop = isBelow ? ny + eNR + 3 : ny - eNR - 28;
                    const labelLeft = nx - eLabelW / 2;
                    return (
                      <React.Fragment key={entry.drugId}>
                        <OrbitNode nx={nx} ny={ny} nodeR={eNR} bg={nodeColor(entry.tier)} label={label} onPress={() => setSheetEntry({ entry, groupName: eGroup.groupName[language] })} />
                        <View style={{ position: "absolute", left: labelLeft, top: labelTop, width: eLabelW, alignItems: "center", zIndex: 4 }} pointerEvents="none">
                          <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700", textAlign: "center", lineHeight: 15 }} numberOfLines={2}>{label}</Text>
                        </View>
                      </React.Fragment>
                    );
                  })}
                </View>
              );
            })() : null}
          </Pressable>
        </Pressable>

        {/* Bottom sheet */}
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
                    <View style={styles.sheetTitleRow}><Text style={styles.sheetDrugPill}>{drug.name[language]}</Text><Text style={styles.sheetArrow}>↔</Text><Text style={[styles.sheetDrugPill, { flex: 1 }]} numberOfLines={1}>{displayName}</Text></View>
                    <View style={[styles.sheetBadgeRow, { marginBottom: 16 }]}><View style={tierBadgeStyle(entry.tier)}><Ionicons name={tierIcon(entry.tier)} size={12} color={tierIconColor(entry.tier)} /><Text style={tierBadgeTextStyle(entry.tier)}>{tierLabel(entry.tier)}</Text></View><View style={styles.crStructBadge}><Text style={styles.crStructBadgeText}>{structuralLabel(entry.structuralRelation)}</Text></View></View>
                    <View style={styles.sheetSection}><Text style={styles.sheetSectionLabel}>{copy(language, "crossReactivity.whyLinked")}</Text><View style={styles.sheetRationaleBox}><Text style={styles.sheetMechanismLink}>{groupName}</Text></View></View>
                    <View style={styles.sheetDivider} />
                    <View style={styles.sheetSection}><Text style={styles.sheetSectionLabel}>{copy(language, "crossReactivity.clinicalNote")}</Text><Text style={styles.sheetRationale}>{entry.rationale[language]}</Text></View>
                    {sourceCitations.length > 0 ? (<><View style={styles.sheetDivider} /><Text style={styles.sheetSourceCitation}>{copy(language, "crossReactivity.source")}: {sourceCitations.join(", ")}</Text></>) : null}
                    {isNavigable ? (<><View style={styles.sheetDivider} /><Pressable style={styles.sheetActionButton} onPress={() => { setSheetEntry(null); setExpandedGroupIdx(null); onOpenDrug(entry.drugId); }}><Ionicons name="open-outline" size={16} color={theme.accent} /><Text style={styles.sheetActionText}>{copy(language, "crossReactivity.openDrug")} — {displayName}</Text></Pressable></>) : null}
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
    crEmptyIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      alignSelf: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    crEmptyTitle: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      textAlign: "center",
    },
    crEmptyBody: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 18,
      textAlign: "center",
    },
    crBadgeHigher: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.warningBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.warningBorder,
    },
    crBadgeHigherText: {
      color: theme.warningText,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crBadgeLower: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.subclassBadgeBg,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    crBadgeLowerText: {
      color: theme.subclassBadgeText,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crBadgeUncertain: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    crBadgeUncertainText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
    },
    crStructBadge: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    crStructBadgeText: {
      color: theme.textSecondary,
      fontSize: 10,
      fontWeight: "700",
      textTransform: "uppercase",
    },
    suggestedPanelCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    suggestedPanelTitle: {
      fontSize: 15,
      fontWeight: "700",
      color: theme.textPrimary,
    },
    suggestedPanelTierLabel: {
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    suggestedPanelDrugList: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.textPrimary,
    },
    sheetOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    sheetContainer: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 12,
      paddingHorizontal: 20,
      paddingBottom: 34,
      maxHeight: "80%",
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.borderMid,
      alignSelf: "center",
      marginBottom: 16,
    },
    sheetTitleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 4,
    },
    sheetArrow: {
      color: theme.textDisabled,
      fontSize: 14,
      fontWeight: "600",
    },
    sheetDrugPill: {
      color: theme.accent,
      fontSize: 17,
      fontWeight: "800",
    },
    sheetBadgeRow: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    sheetSection: {
      gap: 6,
    },
    sheetSectionLabel: {
      color: theme.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    sheetRationaleBox: {
      backgroundColor: theme.surfaceAlt,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sheetMechanismLink: {
      flex: 1,
      color: theme.textSecondary,
      fontSize: 12,
      textAlign: "center",
      fontStyle: "italic",
    },
    sheetRationale: {
      color: theme.textPrimary,
      fontSize: 14,
      lineHeight: 22,
    },
    sheetDivider: {
      height: 1,
      backgroundColor: theme.border,
      marginVertical: 12,
    },
    sheetSourceCitation: {
      color: theme.textDisabled,
      fontSize: 12,
    },
    sheetActionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderRadius: 10,
      padding: 13,
      borderWidth: 1,
      borderColor: theme.accentBorder,
      backgroundColor: theme.accentBg,
    },
    sheetActionText: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: "700",
    },
  });
}
