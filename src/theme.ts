// UrbanMaps Brand Theme
export const theme = {
  colors: {
    // Primary
    urbanBlue: "#2563EB",
    communityGreen: "#059669",
    civicOrange: "#F59E0B",

    // Neutrals
    bg: "#F6F0EA",          // Warm neutral background
    surface: "#FFFFFF",     // White surface
    surfaceGray: "#F3F4F6", // Light gray surface
    ink: "#1E1E1E",         // Charcoal text
    muted: "#6B6B6B",       // Medium gray text

    // Legacy (for compatibility)
    accent: "#2563EB",      // Urban blue
    accentSoft: "#DBEAFE", // Light blue
  },
  radius: {
    sm: 12,
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
