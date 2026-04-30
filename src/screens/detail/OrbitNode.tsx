import React, { useRef } from "react";
import { Animated, Pressable, Text, View } from "react-native";

function formatOrbitText(label: string, maxLineLength: number, maxLines: number) {
  const normalized = label.replace(/\s+/g, " ").trim();
  if (!normalized) return label;

  const words = normalized.split(" ");
  if (words.length === 1) {
    if (normalized.length <= maxLineLength || maxLines === 1) {
      return normalized;
    }

    const splitAt = Math.ceil(normalized.length / Math.min(maxLines, 2));
    return `${normalized.slice(0, splitAt)}\n${normalized.slice(splitAt)}`;
  }

  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLineLength || currentLine.length === 0) {
      currentLine = nextLine;
      continue;
    }

    lines.push(currentLine);
    currentLine = word;

    if (lines.length === maxLines - 1) {
      break;
    }
  }

  const consumedWords = lines.join(" ").split(" ").filter(Boolean).length;
  const remainingWords = words.slice(consumedWords);
  const trailingLine = [currentLine, ...remainingWords.slice(currentLine ? 1 : 0)].filter(Boolean).join(" ");
  if (trailingLine) {
    lines.push(trailingLine);
  }

  return lines.slice(0, maxLines).join("\n");
}

function getInitials(name: string): string {
  const words = name.replace(/[()]/g, "").replace(/\s+/g, " ").trim().split(" ");
  if (words.length === 1) return words[0].substring(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase().substring(0, 4);
}

export function OrbitNode({
  nx,
  ny,
  nodeR,
  bg,
  label,
  onPress,
  borderColor,
  textColor,
  sublabel,
}: {
  nx: number;
  ny: number;
  nodeR: number;
  bg: string;
  label: string;
  onPress: () => void;
  borderColor?: string;
  textColor?: string;
  sublabel?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.spring(scale, { toValue: 1.18, useNativeDriver: true, friction: 4, tension: 200 }).start();
  }

  function handlePressOut() {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 120 }).start();
  }

  const isGroupNode = Boolean(borderColor);
  const displayLabel = isGroupNode ? sublabel ?? "" : formatOrbitText(label, 11, 2);
  const initials = isGroupNode ? getInitials(label) : "";

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: nx - nodeR,
        top: ny - nodeR,
        width: nodeR * 2,
        height: nodeR * 2,
        zIndex: 5,
        transform: [{ scale }],
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          width: nodeR * 2,
          height: nodeR * 2,
          borderRadius: nodeR,
          backgroundColor: bg,
          borderWidth: borderColor ? 2 : 0,
          borderColor: borderColor,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 3,
        }}
      >
        {isGroupNode ? (
          <View style={{ alignItems: "center" }}>
            <Text
              style={{
                color: textColor ?? "#FFFFFF",
                fontSize: 10,
                fontWeight: "700",
                textAlign: "center",
                letterSpacing: 0.5,
                opacity: 0.75,
              }}
              numberOfLines={1}
            >
              {initials}
            </Text>
            <Text
              style={{
                color: textColor ?? "#FFFFFF",
                fontSize: 18,
                fontWeight: "800",
                textAlign: "center",
                marginTop: -1,
              }}
              numberOfLines={1}
            >
              {displayLabel}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

export function centerFontSize(name: string, radius: number): number {
  const diameter = radius * 2;
  const usableWidth = diameter * 0.75;
  const words = name.trim().split(/\s+/);
  const longest = words.length >= 2 ? Math.max(...words.map((w) => w.length)) : name.length;
  const fitted = Math.floor(usableWidth / (longest * 0.58));
  return Math.min(Math.max(fitted, 9), 16);
}

export function centerMaxLines(name: string, radius: number): number {
  const words = name.trim().split(/\s+/);
  if (words.length <= 1) return 1;
  const fontSize = centerFontSize(name, radius);
  const lineH = fontSize + 3;
  const usableHeight = radius * 2 * 0.75;
  return Math.min(words.length, Math.max(2, Math.floor(usableHeight / lineH)));
}
