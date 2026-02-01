"use client";

import { BottomTabs } from "./bottom-tabs";

type Role = "admin" | "front_desk" | "security";

export function BottomTabsClient({ role }: { role: Role }) {
  return <BottomTabs role={role} />;
}