// theme.ts
export const theme = {
  colors: {
    bg: "#F6F0EA",
    surface: "#FFFFFF",
    ink: "#1E1E1E",
    muted: "#6B6B6B",
    accent: "#2DD4BF",
    accentSoft: "#BFF3EC",
  },
  radius: {
    md: 16,
    lg: 22,
    xl: 28,
  },
  stroke: {
    card: 2,
  },
  space: (n: number) => n * 8,
  shadow: {
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
    },
    android: {
      elevation: 4,
    },
  },
};
