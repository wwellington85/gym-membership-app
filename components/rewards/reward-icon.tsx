import { Martini, UtensilsCrossed, CakeSlice, Gift } from "lucide-react";
export function RewardIcon({
  icon,
  className = "h-6 w-6",
}: {
  icon?: string | null;
  className?: string;
}) {
  const Icon =
    icon === "drink"
      ? Martini
      : icon === "food"
        ? UtensilsCrossed
        : icon === "treat"
          ? CakeSlice
          : Gift;
  return <Icon className={className} aria-hidden="true" />;
}
