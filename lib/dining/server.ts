import { unstable_cache } from "next/cache";
import { menuSource, parseRestaurantMenu, type Meal } from "./menu";

async function fetchMenu(meal: Meal) {
  const response = await fetch(menuSource(meal), {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("text/html")
  )
    throw new Error("Restaurant menu unavailable");
  const html = await response.text();
  if (html.length > 2_000_000) throw new Error("Restaurant menu unavailable");
  return parseRestaurantMenu(html, meal);
}
const cachedMenu = unstable_cache(fetchMenu, ["restaurant-menu-v1"], {
  revalidate: 900,
  tags: ["restaurant-menus"],
});

export async function loadRestaurantMenu(meal: Meal) {
  try {
    const menu = await cachedMenu(meal);
    return Date.now() - Date.parse(menu.fetchedAt) <= 86_400_000
      ? menu
      : await fetchMenu(meal);
  } catch {
    return null;
  }
}
