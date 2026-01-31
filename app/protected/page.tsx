import { redirect } from "next/navigation";

export default function ProtectedRedirectPage() {
  redirect("/dashboard");
}
