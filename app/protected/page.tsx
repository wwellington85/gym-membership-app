import { redirect } from "next/navigation";
export default function LegacyAccountPage() {
  redirect("/auth/post-login");
}
