export const FRIENDS = [
  "Sun","Son","Pond","Au","Zeno","Bacon","Fai","Ink","Mild",
  "Prairie","Dee","Jaja","Copter","Ta","GayAu","Punpun","Baimon","Earn",
] as const;

export const TIME_SLOTS = [
  { key: "morning", label: "Morning", hours: "9–12" },
  { key: "noon",    label: "Noon",    hours: "12–15" },
  { key: "evening", label: "Evening", hours: "15–20" },
  { key: "night",   label: "Night",   hours: "20+" },
] as const;

export const PLACES = ["Siam","Dusit Park","One Bangkok","Samyan","Icon"] as const;
export const FOOD_TYPES = ["Japanese","Italian","Mala","Korean"] as const;

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
