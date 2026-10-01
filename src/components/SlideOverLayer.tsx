import React, { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, useWindowDimensions, type ViewStyle } from "react-native";

const SPRING = { useNativeDriver: true, bounciness: 0, speed: 20 } as const;

/**
 * A full-screen layer that slides in from the right while `open` and supports an
 * edge swipe to dismiss. Keeps rendering its last content while sliding out.
 */
export function SlideOverLayer({
  open,
  onRequestClose,
  interactive = true,
  style,
  children,
}: {
  open: boolean;
  onRequestClose: () => void;
  interactive?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}) {
  const { width } = useWindowDimensions();
  const slideX = useRef(new Animated.Value(width)).current;
  const [mounted, setMounted] = useState(open);
  const lastChildren = useRef(children);
  const widthRef = useRef(width);
  const onRequestCloseRef = useRef(onRequestClose);
  widthRef.current = width;
  onRequestCloseRef.current = onRequestClose;
  if (open) lastChildren.current = children;

  useEffect(() => {
    if (open) {
      setMounted(true);
      Animated.spring(slideX, { ...SPRING, toValue: 0 }).start();
    } else {
      Animated.spring(slideX, { ...SPRING, toValue: widthRef.current }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [open, slideX]);

  const swipeBack = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 10 && Math.abs(g.dy) < 60 && g.moveX < 100,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0) slideX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx > widthRef.current * 0.35 || g.vx > 0.5) {
          onRequestCloseRef.current();
        } else {
          Animated.spring(slideX, { ...SPRING, toValue: 0 }).start();
        }
      },
    })
  ).current;

  if (!mounted) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { transform: [{ translateX: slideX }] }]}
      pointerEvents={interactive && open ? "auto" : "none"}
      {...swipeBack.panHandlers}
    >
      {open ? children : lastChildren.current}
    </Animated.View>
  );
}
