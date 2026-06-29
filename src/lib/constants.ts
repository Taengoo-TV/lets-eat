export const FRIENDS = [
  "Au","Bacon","Baimon","Copter","Dee","Earn","Fai","GayAu","Ink",
  "Jaja","Mild","Pond","Prairie","Punpun","Son","Sun","Ta","Zeno",
] as const;

export const TIME_SLOTS = [
  { key: "Morning",   emoji: "🌅", hours: "9:00am – 12:00pm" },
  { key: "Afternoon", emoji: "☀️", hours: "1:00pm – 4:00pm" },
  { key: "Evening",   emoji: "🌙", hours: "6:00pm – 9:00pm" },
] as const;

export const TIME_SLOT_STYLES: Record<string, { bg: string; color: string }> = {
  "Morning":   { bg: "#FEF3C7", color: "#92400E" },
  "Afternoon": { bg: "#DBEAFE", color: "#1E40AF" },
  "Evening":   { bg: "#EDE9FE", color: "#5B21B6" },
};

export const PLACES = ["Siam","Dusit Park","One Bangkok","Samyan","Icon"] as const;
export const FOOD_TYPES = ["Japanese","Italian","Mala","Korean"] as const;

// Pastel chip styles for vote page
export const PLACE_CHIP: Record<string, { bg: string; color: string }> = {
  "Siam":        { bg: "#FCE7F3", color: "#9D174D" },
  "Dusit Park":  { bg: "#D1FAE5", color: "#065F46" },
  "One Bangkok": { bg: "#FEE2E2", color: "#991B1B" },
  "Samyan":      { bg: "#FEF9C3", color: "#713F12" },
  "Icon":        { bg: "#E0F2FE", color: "#0C4A6E" },
};

export const FOOD_CHIP: Record<string, { bg: string; color: string }> = {
  "Japanese": { bg: "#E0F2FE", color: "#0C4A6E" },
  "Italian":  { bg: "#D1FAE5", color: "#065F46" },
  "Mala":     { bg: "#FEE2E2", color: "#991B1B" },
  "Korean":   { bg: "#FEF3C7", color: "#92400E" },
};

// Saturated bar chart fill colors (distinct, matches original spec)
export const PLACE_COLORS: Record<string, string> = {
  "Siam":        "#E8593C",
  "Dusit Park":  "#14B8A6",
  "One Bangkok": "#9333EA",
  "Samyan":      "#F59E0B",
  "Icon":        "#3B82F6",
};

export const FOOD_COLORS: Record<string, string> = {
  "Japanese": "#3B82F6",
  "Italian":  "#22C55E",
  "Mala":     "#EF4444",
  "Korean":   "#9333EA",
};

// Friend pill palette — assigned by FRIENDS index, cycling
export const FRIEND_PALETTE = [
  "#FEE2E2","#FEF3C7","#D1FAE5","#DBEAFE",
  "#EDE9FE","#FCE7F3","#E0F2FE","#F3F4F6",
];

export function friendBg(name: string): string {
  const idx = FRIENDS.indexOf(name as typeof FRIENDS[number]);
  return FRIEND_PALETTE[(idx >= 0 ? idx : 0) % FRIEND_PALETTE.length];
}
