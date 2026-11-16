import { load } from "cheerio/slim";

export const meals = ["breakfast", "lunch", "dinner"] as const;
export type Meal = (typeof meals)[number];
export const mealName = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};
export function restaurantMeal(value: unknown): Meal {
  return meals.includes(value as Meal) ? (value as Meal) : "breakfast";
}
export function menuSource(meal: Meal) {
  return `https://tbr.travel/${meal}-menu/`;
}
export type MenuItem = {
  name: string;
  description: string;
  prices: { amount: string; label: string }[];
  vegetarian: boolean;
  note: string;
};
export type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
  note: string;
};
export type RestaurantMenu = {
  meal: Meal;
  sections: MenuSection[];
  allergyNote: string;
  priceNote: string;
  fetchedAt: string;
};
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
// Only extract known text fields. Never render the site's HTML, scripts or CSS.
export function parseRestaurantMenu(html: string, meal: Meal): RestaurantMenu {
  const $ = load(html);
  const root = $(
    meal === "breakfast"
      ? ".tbr-breakfast"
      : meal === "dinner"
        ? ".tbr-dinner"
        : ".tbr-lunch",
  ).first();
  if (!root.length) throw new Error("Menu layout unavailable");
  root.find("script, style, noscript, iframe").remove();
  const sections: MenuSection[] = [];
  root.find("section.section").each((i, section) => {
    const node = $(section);
    const title = clean(node.find(".section-title").first().text());
    const items: MenuItem[] = [];
    node.find(".item, .beverage-item").each((_i, item) => {
      const el = $(item);
      const label = el.find(".item-name").first().clone();
      const vegetarian = label.find(".veg").length > 0;
      label.find(".veg").remove();
      const name = clean(label.text());
      const prices: MenuItem["prices"] = [];
      if (el.find(".price-options").length) {
        el.find(".price-options > div").each((_p, opt) => {
          const amount = clean($(opt).find(".price").text());
          if (!/^\$\d+(?:\.\d{1,2})?$/.test(amount))
            throw new Error("Menu price unavailable");
          prices.push({ amount, label: clean($(opt).find("small").text()) });
        });
      } else {
        const amount = clean(el.find(".price").first().text());
        if (!/^\$\d+(?:\.\d{1,2})?$/.test(amount))
          throw new Error("Menu price unavailable");
        prices.push({ amount, label: "" });
      }
      if (!name || !prices.length) throw new Error("Menu item unavailable");
      items.push({
        name,
        prices,
        vegetarian,
        description: clean(el.find(".description, .beverage-options").text()),
        note: clean(el.find(".seasonal").text()),
      });
    });
    if (!title || !items.length) throw new Error("Menu section unavailable");
    sections.push({
      id: `menu-section-${i + 1}`,
      title,
      items,
      note: clean(node.find(".entree-note").text()),
    });
  });
  const sideItems: MenuItem[] = [];
  const sidePanel = root.find(".breakfast-sides, .sides-panel").first();
  if (sidePanel.length) {
    if (meal === "breakfast")
      sidePanel.find(".breakfast-side").each((_i, item) => {
        const node = $(item);
        const amount = clean(node.find(".breakfast-side-price").text());
        if (!/^\$\d+(?:\.\d{1,2})?$/.test(amount))
          throw new Error("Side price unavailable");
        sideItems.push({
          name: clean(node.find(".breakfast-side-name").text()),
          description: "",
          prices: [{ amount, label: "" }],
          vegetarian: false,
          note: "",
        });
      });
    else {
      const amount = clean(sidePanel.find(".sides-price").text()).replace(
        / each$/,
        "",
      );
      if (!/^\$\d+(?:\.\d{1,2})?$/.test(amount))
        throw new Error("Side price unavailable");
      sidePanel.find(".side").each((_i, item) => {
        sideItems.push({
          name: clean($(item).text()),
          description: "",
          prices: [{ amount, label: "each" }],
          vegetarian: false,
          note: "",
        });
      });
    }
    if (!sideItems.length || sideItems.some((item) => !item.name))
      throw new Error("Menu sides unavailable");
    sections.push({
      id: "menu-sides",
      title: "Something on the Side",
      items: sideItems,
      note: "",
    });
  }
  const allergyNote = clean(root.find(".footer .allergy").text());
  const priceNote = clean(
    root
      .find(".footer p")
      .filter((_i, p) => $(p).text().includes("prices are quoted"))
      .first()
      .text(),
  );
  if (
    !sections.length ||
    !allergyNote ||
    !priceNote.includes("USD") ||
    !/\d+(?:\.\d+)?%\s+(?:sales\s+)?tax/i.test(priceNote)
  )
    throw new Error("Menu information unavailable");
  return {
    meal,
    sections,
    allergyNote,
    priceNote,
    fetchedAt: new Date().toISOString(),
  };
}
