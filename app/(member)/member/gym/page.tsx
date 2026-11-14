import { redirect } from "next/navigation";

// Preserve installed shortcuts and old links after visits move into Club Home.
export default function GymPage() {
  redirect("/member#club-visits");
}
