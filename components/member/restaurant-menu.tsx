import type { RestaurantMenu } from "@/lib/dining/menu";

export function RestaurantMenuContent({ menu }: { menu: RestaurantMenu }) {
  return (
    <>
      <p className="text-xs text-muted-foreground">{menu.priceNote}</p>
      <nav className="club-menu-categories" aria-label="Menu categories">
        {menu.sections.map((section) => (
          <a href={`#${section.id}`} key={section.id}>
            {section.title}
          </a>
        ))}
      </nav>
      <div className="space-y-7">
        {menu.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="scroll-mt-8 space-y-1"
          >
            <h2 className="mb-2 text-lg font-semibold">{section.title}</h2>
            <div className="divide-y">
              {section.items.map((item, i) => (
                <article className="py-4" key={`${item.name}-${i}`}>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="min-w-0 text-base font-medium">
                      {item.name}
                      {item.vegetarian && (
                        <span
                          className="ml-2 inline-block rounded bg-secondary px-1.5 py-0.5 align-middle text-xs font-medium text-primary"
                          aria-label="Vegetarian option"
                        >
                          V
                        </span>
                      )}
                    </h3>
                    <div className="shrink-0 space-y-1 text-right text-sm tabular-nums">
                      {item.prices.map((price, j) => (
                        <p key={j}>
                          <span className="font-medium">{price.amount}</span>
                          {price.label && (
                            <span className="ml-1.5 text-xs text-muted-foreground">
                              {price.label}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  </div>
                  {item.description && (
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {item.description}
                    </p>
                  )}
                  {item.note && (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {item.note}
                    </p>
                  )}
                </article>
              ))}
            </div>
            {section.note && (
              <p className="rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
                {section.note}
              </p>
            )}
          </section>
        ))}
      </div>
      <div className="space-y-2 border-t pt-4 text-xs text-muted-foreground">
        <p>V · Vegetarian option, where marked on the restaurant menu.</p>
        <p>{menu.allergyNote}</p>
        <p>{menu.priceNote}</p>
      </div>
    </>
  );
}
