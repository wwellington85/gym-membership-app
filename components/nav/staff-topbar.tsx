import { LogoutButton } from "@/components/logout-button";

export function StaffTopbar() {
  return (
    <div className="sticky top-0 z-40 border-b oura-tabbar">
      <div className="mx-auto flex w-full items-center justify-end px-3 py-2">
        <LogoutButton />
      </div>
    </div>
  );
}
