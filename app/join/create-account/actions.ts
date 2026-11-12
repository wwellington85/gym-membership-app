"use server";
import { redirect } from "next/navigation";
// Legacy application links now use verified sign-in to claim an existing member.
export async function createMemberAccount() {
  redirect("/auth/login");
}
