export const rewardPresets = [
  {
    icon: "drink",
    label: "Drink",
    title: "One selected cocktail or mocktail",
    terms:
      "Choose from the selected house drinks. One drink for the named member.",
  },
  {
    icon: "food",
    label: "Food",
    title: "One selected appetizer",
    terms: "Choose one item from the selected appetizer menu.",
  },
  {
    icon: "treat",
    label: "Treat",
    title: "One selected dessert",
    terms: "Choose one dessert from the selected menu.",
  },
  {
    icon: "gift",
    label: "Gift",
    title: "A gift from Travellers",
    terms: "Please ask our team about your selected gift.",
  },
] as const;
export type RewardIconName = (typeof rewardPresets)[number]["icon"];
