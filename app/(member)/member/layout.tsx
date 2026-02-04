import { MemberTabs } from "@/components/nav/member-tabs";

export default function MemberLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh">
      <div className="mx-auto w-full max-w-md px-4 py-6 pb-24">{children}</div>
      <MemberTabs />
    </div>
  );
}
