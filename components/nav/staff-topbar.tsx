import { LogoutButton } from "@/components/logout-button";

export function StaffTopbar() {
  return (
    <div className="sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto flex max-w-md items-center justify-between px-3 py-2">
        <div className="text-sm font-semibold">Travellers Staff</div>
        <LogoutButton />
      </div>
    </div>
  );
}
