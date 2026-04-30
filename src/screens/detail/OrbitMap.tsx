import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
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

  const drugNameById: Record<string, { en: string; fr: string }> = {};
  for (const d of allDrugs) {
    drugNameById[d.id] = d.name;
  }

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

  // ─── Compact orbit geometry ───────────────────────────────────────────────
  const screenW = Dimensions.get("window").width - 32;
  const availableR = (screenW - 40) / 2;
  const centerR = Math.max(36, Math.min(44, availableR * 0.2));
  const arcThickness = Math.max(28, Math.min(36, availableR * 0.16));
  const ringGap = 6;
  const firstRingOffset = 8;
  const tierRadii: Record<CrossReactivityTier, number> = {
    "higher-concern": centerR + firstRingOffset,
    "lower-expected": centerR + firstRingOffset + arcThickness + ringGap,
    "uncertain": centerR + firstRingOffset + (arcThickness + ringGap) * 2,
  };

  type ArcData = { group: CrossReactivityGroup; idx: number; tier: CrossReactivityTier; orbitR: number; startAngle: number; sweepAngle: number; midAngle: number };
  const arcs: ArcData[] = [];
  const tierBaseOffsets: Record<CrossReactivityTier, number> = {
    "higher-concern": -Math.PI / 2,
    "lower-expected": -Math.PI / 2 + (2 * Math.PI) / 3,
    "uncertain": -Math.PI / 2 - (2 * Math.PI) / 3,
  };

  for (const tier of tierOrder) {
    const tierGroups = groups.map((g, i) => ({ group: g, idx: i })).filter(({ group }) => highestTier(group.entries) === tier);
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

  const maxR = Math.max(...arcs.map((a) => a.orbitR + arcThickness), centerR + 30);
  const sz = Math.min((maxR + 50) * 2, screenW + 16);
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

  // Sort groups: higher-concern first, then lower-expected, then uncertain
  const sortedGroupIndices = [...groups.keys()].sort((a, b) => {
    const tierA = highestTier(groups[a].entries);
    const tierB = highestTier(groups[b].entries);
    return tierOrder.indexOf(tierA) - tierOrder.indexOf(tierB);
  });

  return (
    <View style={{ gap: 16 }}>
      {/* ─── Compact orbit summary ─── */}
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
              opacity={expandedGroupIdx === gIdx ? 1 : 0.75}
              onPress={() => setExpandedGroupIdx(expandedGroupIdx === gIdx ? null : gIdx)}
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
            <SvgText
              key={`txt-${gIdx}`}
              fill="#FFF"
              fontSize={9}
              fontWeight="700"
              dy={3}
              textAnchor="middle"
              onPress={() => setExpandedGroupIdx(expandedGroupIdx === gIdx ? null : gIdx)}
            >
              <TextPath href={`#textarc-${gIdx}`} startOffset="50%">
                {group.groupName[language]}
              </TextPath>
            </SvgText>
          ))}
        </Svg>

        {/* Center node */}
        <View style={{ position: "absolute", left: c - centerR, top: c - centerR, width: centerR * 2, height: centerR * 2, zIndex: 10 }}>
          <View
            style={{ width: centerR * 2, height: centerR * 2, borderRadius: centerR, backgroundColor: theme.accent, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8, borderWidth: 2.5, borderColor: theme.surface }}
          >
            <Text style={{ color: "#FFF", fontSize: centerFontSize(drug.name[language], centerR), fontWeight: "800", textAlign: "center", paddingHorizontal: 3, lineHeight: centerFontSize(drug.name[language], centerR) + 3 }} numberOfLines={centerMaxLines(drug.name[language], centerR)}>{drug.name[language]}</Text>
          </View>
        </View>
      </View>

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

      {/* ─── Group cards ─── */}
      {sortedGroupIndices.map((gIdx) => {
        const group = groups[gIdx];
        const tier = highestTier(group.entries);
        const isExpanded = expandedGroupIdx === gIdx;
        const entryCount = group.entries.length;

        return (
          <View key={gIdx} style={[styles.groupCard, { borderLeftColor: nodeColor(tier) }]}>
            <Pressable
              onPress={() => setExpandedGroupIdx(isExpanded ? null : gIdx)}
              style={styles.groupHeader}
            >
              <View style={styles.groupHeaderLeft}>
                <Ionicons name={tierIcon(tier)} size={16} color={tierIconColor(tier)} />
                <Text style={styles.groupName}>{group.groupName[language]}</Text>
              </View>
              <View style={styles.groupHeaderRight}>
                <View style={tierBadgeStyle(tier)}>
                  <Text style={tierBadgeTextStyle(tier)}>{tierLabel(tier)}</Text>
                </View>
                <Text style={styles.groupCount}>{entryCount}</Text>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={theme.textDisabled} />
              </View>
            </Pressable>

            {isExpanded ? (
              <View style={styles.groupEntries}>
                {group.entries.map((entry) => {
                  const name = drugNameById[entry.drugId];
                  const displayName = name ? name[language] : entry.drugId;
                  const isNavigable = Boolean(name);
                  const sourceCitations = entry.sourceIds.map((sid) => sources[sid]?.label).filter(Boolean);

                  return (
                    <View key={entry.drugId} style={styles.entryCard}>
                      <View style={styles.entryHeader}>
                        <View style={[styles.entryDot, { backgroundColor: nodeColor(entry.tier) }]} />
                        <Text style={styles.entryName}>{displayName}</Text>
                        {isNavigable ? (
                          <Pressable onPress={() => onOpenDrug(entry.drugId)} hitSlop={8} style={styles.entryOpenBtn}>
                            <Ionicons name="open-outline" size={14} color={theme.accent} />
                          </Pressable>
                        ) : null}
                      </View>

                      <View style={styles.entryBadges}>
                        <View style={tierBadgeStyle(entry.tier)}>
                          <Ionicons name={tierIcon(entry.tier)} size={10} color={tierIconColor(entry.tier)} />
                          <Text style={tierBadgeTextStyle(entry.tier)}>{tierLabel(entry.tier)}</Text>
                        </View>
                        <View style={styles.structBadge}>
                          <Text style={styles.structBadgeText}>{structuralLabel(entry.structuralRelation)}</Text>
                        </View>
                      </View>

                      {entry.rationale[language] ? (
                        <Text style={styles.entryRationale}>{entry.rationale[language]}</Text>
                      ) : null}

                      {sourceCitations.length > 0 ? (
                        <Text style={styles.entrySource}>{copy(language, "crossReactivity.source")}: {sourceCitations.join(", ")}</Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.groupPreview} numberOfLines={1}>
                {group.entries.map((e) => drugNameById[e.drugId]?.[language] ?? e.drugId).join(", ")}
              </Text>
            )}
          </View>
        );
      })}

      {/* ─── Suggested Panel ─── */}
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
        for (const t of tierOrder) {
          if (tierDrugs[t].length > 0) tierBuckets.push({ tier: t, drugs: tierDrugs[t] });
        }
        if (tierBuckets.length === 0) return null;

        return (
          <View style={styles.panelCard}>
            <Text style={styles.panelTitle}>{copy(language, "crossReactivity.panelTitle")}</Text>
            {tierBuckets.map(({ tier, drugs }) => (
              <View key={tier} style={{ gap: 4 }}>
                <Text style={[styles.panelTierLabel, { color: nodeColor(tier) }]}>{tierLabel(tier)}</Text>
                <Text style={styles.panelDrugList}>
                  {drugs.map((id) => drugNameById[id]?.[language] ?? id).join(", ")}
                </Text>
              </View>
            ))}
          </View>
        );
      })()}
    </View>
  );
}

function makeStyles(theme: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
    emptyIcon: {
      width: 48, height: 48, borderRadius: 24,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center", justifyContent: "center", alignSelf: "center",
      borderWidth: 1, borderColor: theme.border,
    },
    emptyTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "700", textAlign: "center" },
    emptyBody: { color: theme.textSecondary, fontSize: 13, lineHeight: 18, textAlign: "center" },

    /* Tier badges */
    badgeHigher: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.warningBg, borderRadius: 999,
      paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: theme.warningBorder,
    },
    badgeHigherText: { color: theme.warningText, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    badgeLower: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.subclassBadgeBg, borderRadius: 999,
      paddingHorizontal: 7, paddingVertical: 2,
    },
    badgeLowerText: { color: theme.subclassBadgeText, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    badgeUncertain: {
      flexDirection: "row", alignItems: "center", gap: 4,
      backgroundColor: theme.surfaceAlt, borderRadius: 999,
      paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: theme.border,
    },
    badgeUncertainText: { color: theme.textSecondary, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
    structBadge: {
      backgroundColor: theme.surfaceAlt, borderRadius: 999,
      paddingHorizontal: 7, paddingVertical: 2,
      borderWidth: 1, borderColor: theme.border,
    },
    structBadgeText: { color: theme.textSecondary, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },

    /* Group cards */
    groupCard: {
      backgroundColor: theme.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderLeftWidth: 4,
      overflow: "hidden",
    },
    groupHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 12,
      gap: 8,
    },
    groupHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },
    groupName: {
      color: theme.textPrimary,
      fontSize: 14,
      fontWeight: "700",
      flex: 1,
    },
    groupHeaderRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexShrink: 0,
    },
    groupCount: {
      color: theme.textDisabled,
      fontSize: 12,
      fontWeight: "600",
    },
    groupPreview: {
      color: theme.textSecondary,
      fontSize: 13,
      paddingHorizontal: 12,
      paddingBottom: 10,
    },
    groupEntries: {
      gap: 1,
      backgroundColor: theme.border,
    },
    entryCard: {
      backgroundColor: theme.surface,
      padding: 12,
      gap: 8,
    },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    entryDot: {
      width: 8, height: 8, borderRadius: 4, flexShrink: 0,
    },
    entryName: {
      color: theme.textPrimary,
      fontSize: 15,
      fontWeight: "700",
      flex: 1,
    },
    entryOpenBtn: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: theme.accentBg,
      alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    },
    entryBadges: {
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
      paddingLeft: 16,
    },
    entryRationale: {
      color: theme.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      paddingLeft: 16,
    },
    entrySource: {
      color: theme.textDisabled,
      fontSize: 11,
      paddingLeft: 16,
    },

    /* Suggested panel */
    panelCard: {
      backgroundColor: theme.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    panelTitle: { fontSize: 15, fontWeight: "700", color: theme.textPrimary },
    panelTierLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
    panelDrugList: { fontSize: 14, fontWeight: "500", color: theme.textPrimary },
  });
}
