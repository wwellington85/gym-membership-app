import Link from "next/link";
import Image from "next/image";
import { requireMember } from "@/lib/access/server";
import { meals, mealName, menuSource, restaurantMeal } from "@/lib/dining/menu";
import { loadRestaurantMenu } from "@/lib/dining/server";
import { RestaurantMenuContent } from "@/components/member/restaurant-menu";
export const dynamic = "force-dynamic";
export default async function Dining({
  searchParams,
}: {
  searchParams: Promise<{ meal?: string }>;
}) {
  await requireMember();
  const q = await searchParams;
  const meal = restaurantMeal(q.meal);
  const menu = await loadRestaurantMenu(meal);
  return (
    <div className="space-y-5">
      <header>
        <p className="club-eyebrow">Dining at Travellers</p>
        <h1 className="mt-2 text-2xl font-semibold">Restaurant menus</h1>
      </header>
      <div className="relative h-36 overflow-hidden rounded-2xl">
        <Image
          src="/images/hotel/restaurant-terrace.webp"
          alt="The beachfront restaurant at Travellers"
          fill
          sizes="(max-width:640px) 100vw, 640px"
          className="object-cover"
        />
      </div>
      <nav
        className="grid grid-cols-3 gap-2 text-sm"
        aria-label="Restaurant meals"
      >
        {meals.map((value) => (
          <Link
            key={value}
            href={`/member/dining?meal=${value}`}
            aria-current={meal === value ? "page" : undefined}
            className={`rounded-xl border px-2 py-3 text-center font-medium ${meal === value ? "border-primary bg-primary text-primary-foreground" : "border-border text-primary hover:bg-muted"}`}
          >
            {mealName[value]}
          </Link>
        ))}
      </nav>
      {menu ? (
        <RestaurantMenuContent menu={menu} />
      ) : (
        <div className="space-y-3 rounded-xl border p-4">
          <p role="status">This menu is temporarily unavailable in the app.</p>
          <a
            href={menuSource(meal)}
            target="_blank"
            rel="noopener noreferrer"
            className="club-text-link"
          >
            View the {meal} menu on our website ↗
          </a>
        </div>
      )}
      <aside className="space-y-2 border-t pt-5">
        <h2 className="font-medium">A private evening for two</h2>
        <p className="text-sm text-muted-foreground">
          Starlight Dinner has its own menu and beach setting.
        </p>
        <Link
          href="/member/experiences?kind=dinner"
          className="club-text-link text-sm"
        >
          Explore Starlight Dinner →
        </Link>
      </aside>
    </div>
  );
}
