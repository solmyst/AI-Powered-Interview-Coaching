export type Band = "strong" | "promising" | "mixed" | "weak" | "insufficient";
export const bandLabel: Record<Band, string> = {
  strong: "Strong",
  promising: "Promising",
  mixed: "Mixed",
  weak: "Weak",
  insufficient: "Not enough to judge",
};
