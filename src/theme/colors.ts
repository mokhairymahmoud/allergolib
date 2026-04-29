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
